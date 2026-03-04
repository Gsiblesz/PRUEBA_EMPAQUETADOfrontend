const DEFAULT_BACKEND_URL = "https://prueba-empaquetadobackend-1.onrender.com";
const LEGACY_BACKEND_URL = "https://prueba-empaquetadobackend.onrender.com";

function normalizeBackendUrl(url) {
    const value = String(url || '').trim().replace(/\/+$/, '');
    if (!value) return '';
    if (value === LEGACY_BACKEND_URL) return DEFAULT_BACKEND_URL;
    return value;
}

function getBackendUrl() {
    const storedRaw = localStorage.getItem('BACKEND_URL') || '';
    const stored = normalizeBackendUrl(storedRaw);
    if (storedRaw && stored !== storedRaw.trim()) {
        try { localStorage.setItem('BACKEND_URL', stored); } catch (_) {}
    }
    return stored || DEFAULT_BACKEND_URL;
}

function generarNonce() {
    try {
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(4);
            window.crypto.getRandomValues(arr);
            return Array.from(arr).map(n => n.toString(16)).join('');
        }
    } catch (_) {}
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function enviarRegistroBackend(formId, cabecera, detalle) {
    const endpoint = formId === "empaquetados-form" ? "/api/empaquetados" : "/api/mermas";
    const response = await fetch(`${getBackendUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabecera, detalle })
    });

    let parsed = null;
    try { parsed = await response.json(); } catch (_) {}

    if (!response.ok || (parsed && parsed.ok === false)) {
        const message = parsed && parsed.error ? parsed.error : `HTTP ${response.status}`;
        throw new Error(message);
    }

    return parsed;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFechaVisual(raw) {
    const value = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-');
        return `${d}-${m}-${y}`;
    }
    return value;
}

function getInputValueById(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

function buildResumenMeta(formId) {
    const isEmpa = formId === 'empaquetados-form';
    const fecha = isEmpa ? formatFechaVisual(getInputValueById('empa-fecha')) : formatFechaVisual(getInputValueById('merma-fecha'));
    const hora = isEmpa ? getInputValueById('empa-hora') : getInputValueById('merma-hora');
    const responsable = isEmpa ? getInputValueById('empa-responsable') : getInputValueById('merma-responsable');
    const sede = isEmpa ? getInputValueById('empa-sede') : getInputValueById('merma-sede');

    const baseItems = [
        ['Fecha', fecha || '-'],
        ['Hora', hora || '-'],
        ['Responsable', responsable || '-'],
        ['Sede', sede || '-']
    ];

    if (isEmpa) {
        const maquina = getInputValueById('empa-maquina');
        const entregado = getInputValueById('empa-entregado');
        const registro = getInputValueById('empa-registro');
        const lotePreview = getInputValueById('empa-lote-preview').replace(/^Lote:\s*/i, '');
        baseItems.splice(2, 0,
            ['Máquina', maquina || '-'],
            ['Entregado a', entregado || '-'],
            ['N° registro', registro || '-'],
            ['Lote sugerido', lotePreview || '-']
        );
    }

    return baseItems;
}

function buildProductosResumenRows(formId, seleccionados) {
    const isMerma = formId === 'merma-form';
    return (seleccionados || []).map((item, idx) => {
        const cantidad = `${item.cantidad}${item.unidad ? ` ${item.unidad}` : ''}`;
        const motivo = isMerma ? (item.motivo || '-') : '-';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(item.codigo || '-')}</td>
                <td>${escapeHtml(item.descripcion || '-')}</td>
                <td>${escapeHtml(cantidad)}</td>
                <td>${escapeHtml(item.lote || '-')}</td>
                <td>${escapeHtml(motivo)}</td>
            </tr>`;
    }).join('');
}

function mostrarConfirmacionEnvio(formId, seleccionados) {
    const modal = document.getElementById('confirmacion-modal');
    const titleEl = document.getElementById('confirm-titulo');
    const metaEl = document.getElementById('confirm-meta');
    const bodyEl = document.getElementById('confirm-productos-body');
    const checkEl = document.getElementById('confirm-check');
    const editarBtn = document.getElementById('confirm-editar');
    const enviarBtn = document.getElementById('confirm-enviar');

    if (!modal || !titleEl || !metaEl || !bodyEl || !checkEl || !editarBtn || !enviarBtn) {
        return Promise.resolve(window.confirm('Verifica cantidades, productos y lotes antes de enviar. ¿Confirmas el envío?'));
    }

    const titulo = formId === 'empaquetados-form'
        ? 'Verifica Empaquetado antes de enviar'
        : 'Verifica Merma antes de enviar';
    titleEl.textContent = titulo;

    const metaItems = buildResumenMeta(formId);
    metaEl.innerHTML = metaItems
        .map(([key, val]) => `<div class="confirm-meta-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</div>`)
        .join('');

    bodyEl.innerHTML = buildProductosResumenRows(formId, seleccionados);
    checkEl.checked = false;
    enviarBtn.disabled = true;

    return new Promise((resolve) => {
        let closed = false;
        const close = (confirmed) => {
            if (closed) return;
            closed = true;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            checkEl.removeEventListener('change', onToggle);
            editarBtn.removeEventListener('click', onCancel);
            enviarBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onEsc);
            resolve(confirmed);
        };

        const onToggle = () => { enviarBtn.disabled = !checkEl.checked; };
        const onCancel = () => close(false);
        const onConfirm = () => close(true);
        const onBackdrop = (e) => { if (e.target === modal) close(false); };
        const onEsc = (e) => { if (e.key === 'Escape') close(false); };

        checkEl.addEventListener('change', onToggle);
        editarBtn.addEventListener('click', onCancel);
        enviarBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onEsc);

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    });
}

function enviarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        // Evitar envíos dobles (doble click, redoble toque)
        if (form.dataset.submitting === "1") {
            return; // ya se está enviando
        }
        form.dataset.submitting = "1";
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Revisar..."; }
        const msgEl = document.getElementById("mensaje");
        if (msgEl) msgEl.textContent = "Revisa el resumen y confirma el envío...";
        // Lote global para Empaquetado (respaldo si el lote por producto está vacío)
        let loteGlobal = '';
        if (formId === "empaquetados-form") {
            try {
                const preview = document.getElementById('empa-lote-preview');
                if (preview && preview.value) {
                    loteGlobal = String(preview.value).replace(/^Lote:\s*/i, '').trim();
                }
                if (!loteGlobal) {
                    const fechaInput = document.getElementById('empa-fecha');
                    const maqInput = document.getElementById('empa-maquina');
                    const raw = fechaInput ? (fechaInput.value||'').trim() : '';
                    const maq = maqInput ? (maqInput.value||'').trim() : '';
                    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                        const [y,m,d] = raw.split('-');
                        loteGlobal = `BC${d}${m}${y.slice(2)}${maq}`;
                    }
                }
            } catch(_) { /* no-op */ }
        }
        const qtyInputs = form.querySelectorAll('.prod-qty');
        let seleccionados = [];
        // Idempotencia: token anti-duplicado (reutiliza el mismo nonce en reintentos)
        let nonce = form.dataset.nonce || localStorage.getItem(`nonce_${formId}`) || '';
        if (!nonce) {
            nonce = generarNonce();
            form.dataset.nonce = nonce;
            try { localStorage.setItem(`nonce_${formId}`, nonce); } catch(_) {}
        }
        // Agregar solo los productos con cantidad > 0 como JSON
        try {
            const seleccionadosTmp = [];
            qtyInputs.forEach(inp => {
                const val = parseInt(inp.value, 10);
                if (!isNaN(val) && val > 0) {
                    const row = inp.closest('.producto-line');
                    const motivoEl = row ? row.querySelector('.merma-motivo') : null;
                    const loteEl = row ? row.querySelector('.merma-lote, .empa-lote') : null;
                    // read motivo and lote robustly: prefer value, fallback to selected option text
                    var motivoVal = '';
                    if (motivoEl) {
                        try {
                            motivoVal = (motivoEl.value || '').toString().trim();
                        } catch(_) { motivoVal = ''; }
                        try {
                            if (!motivoVal && typeof motivoEl.selectedIndex === 'number' && motivoEl.selectedIndex >= 0) {
                                var opt = motivoEl.options[motivoEl.selectedIndex];
                                motivoVal = (opt && (opt.value || opt.text) || '').toString().trim();
                            }
                        } catch(_) {}
                    }
                    var loteVal = '';
                    if (loteEl) {
                        try { loteVal = (loteEl.value || '').toString().trim(); } catch(_) { loteVal = ''; }
                    }
                    if (!loteVal && loteGlobal) loteVal = loteGlobal;
                    seleccionadosTmp.push({
                        id_producto: inp.dataset.id_producto,
                        codigo: inp.dataset.codigo,
                        descripcion: inp.dataset.desc || '',
                        unidad: inp.dataset.unidad || '',
                        cantidad: val,
                        paquetes: inp.dataset.paquetes || '',
                        sobre_piso: inp.dataset.sobrePiso || inp.dataset.sobre_piso || '',
                        motivo: motivoVal,
                        lote: loteVal
                    });
                }
            });
            seleccionados = seleccionadosTmp;
            // Validar motivo y lote en Merma
            if (formId === "merma-form") {
                const falta = seleccionados.find(it => !String(it.motivo || '').trim() || !String(it.lote || '').trim());
                if (falta) {
                    if (msgEl) msgEl.textContent = "Completa el motivo y el número de lote en todos los productos.";
                    form.dataset.submitting = "0";
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Enviar";
                    }
                    return;
                }
            }
            // Evitar duplicados de producto + lote (en Merma permite repetir lote si el motivo es distinto)
            const dupMap = new Set();
            let hasDup = false;
            const isMermaForm = formId === "merma-form";
            seleccionados.forEach(item => {
                const codigo = (item.codigo || '').trim().toLowerCase();
                const lote = (item.lote || '').trim().toLowerCase();
                const motivo = (item.motivo || '').trim().toLowerCase();
                if (!codigo) return;
                const key = isMermaForm ? (codigo + '|' + lote + '|' + motivo) : (codigo + '|' + lote);
                if (dupMap.has(key)) hasDup = true;
                else dupMap.add(key);
            });
            if (hasDup) {
                if (msgEl) msgEl.textContent = isMermaForm
                    ? "No se permite el mismo producto con el mismo lote y motivo."
                    : "No se permite el mismo producto con el mismo número de lote.";
                form.dataset.submitting = "0";
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Enviar";
                }
                return;
            }
            if (seleccionados.length) {
                // no-op: payload se arma como JSON para backend REST
            }
        } catch(_) { /* no-op */ }
        if (!seleccionados.length) {
            if (msgEl) msgEl.textContent = "Agrega al menos un producto con cantidad.";
            form.dataset.submitting = "0";
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Enviar";
            }
            return;
        }

        const confirmado = await mostrarConfirmacionEnvio(formId, seleccionados);
        if (!confirmado) {
            if (msgEl) msgEl.textContent = "Envío cancelado para que puedas corregir la información.";
            form.dataset.submitting = "0";
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Enviar";
            }
            return;
        }

        if (submitBtn) { submitBtn.textContent = "Enviando..."; }
        if (msgEl) msgEl.textContent = "Enviando...";

        try {
            let cabecera;
            let detalle;

            if (formId === "empaquetados-form") {
                cabecera = {
                    fecha: (document.getElementById('empa-fecha')?.value || '').trim(),
                    hora: (document.getElementById('empa-hora')?.value || '').trim(),
                    id_destino: Number((document.getElementById('empa-entregado')?.value || '').trim()),
                    numero_registro: (document.getElementById('empa-registro')?.value || '').trim(),
                    id_responsable: Number((document.getElementById('empa-responsable')?.value || '').trim()),
                    id_sede: Number((document.getElementById('empa-sede')?.value || '').trim())
                };

                detalle = seleccionados.map(item => ({
                    id_producto: Number(item.id_producto),
                    cantidad: Number(item.cantidad),
                    numero_lote: String(item.lote || loteGlobal || '').trim()
                }));
            } else {
                cabecera = {
                    fecha: (document.getElementById('merma-fecha')?.value || '').trim(),
                    hora: (document.getElementById('merma-hora')?.value || '').trim(),
                    id_responsable: Number((document.getElementById('merma-responsable')?.value || '').trim()),
                    id_sede: Number((document.getElementById('merma-sede')?.value || '').trim())
                };

                detalle = seleccionados.map(item => ({
                    id_producto: Number(item.id_producto),
                    cantidad: Number(item.cantidad),
                    motivo: String(item.motivo || '').trim(),
                    numero_lote: String(item.lote || '').trim()
                }));
            }
            await enviarRegistroBackend(formId, cabecera, detalle);

            if (msgEl) msgEl.textContent = "¡Formulario enviado correctamente!";
            try {
                const insertedCount = Array.from(form.querySelectorAll('.prod-qty')).filter(inp => parseInt(inp.value,10)>0).length;
                const hoja = formId === 'empaquetados-form' ? 'Empaquetado' : 'Merma';
                window.dispatchEvent(new CustomEvent('registroInsertado',{ detail:{ sheet:hoja, productos:insertedCount, nonce: form.dataset.nonce || '' }}));
            } catch(_) {}

            form.reset();
            const qtyInputsReset = form.querySelectorAll('.prod-qty');
            qtyInputsReset.forEach(i => i.value = "");
            const contenedores = form.querySelectorAll('.seleccionados');
            contenedores.forEach(c => c.innerHTML = "");
            delete form.dataset.nonce;
            try { localStorage.removeItem(`nonce_${formId}`); } catch(_) {}
            setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 3000);
        } catch (error) {
            if (msgEl) msgEl.textContent = "Error al enviar el formulario. Detalle: " + error.message;
        } finally {
            // Pequeño enfriamiento para evitar reenvío inmediato
            setTimeout(() => {
                form.dataset.submitting = "0";
                const btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    btn.disabled = false;
                    // Si hay nonce activo, ofrecer reintento; si no, volver a "Enviar"
                    btn.textContent = (form.dataset.nonce || localStorage.getItem(`nonce_${formId}`)) ? "Reintentar" : "Enviar";
                }
            }, 800);
        }
    });
}

// Limpieza manual de formulario
function clearForm(formId){
    const form = document.getElementById(formId);
    if(!form) return;
    form.reset();
    // Limpiar cantidades y contenedores de productos seleccionados
    const qtyInputs = form.querySelectorAll('.prod-qty');
    qtyInputs.forEach(i => i.value = "");
    const contenedores = form.querySelectorAll('.seleccionados');
    contenedores.forEach(c => c.innerHTML = "");
    // Limpiar nonce para permitir nuevo envío independiente
    delete form.dataset.nonce;
    try { localStorage.removeItem(`nonce_${formId}`); } catch(_) {}
    const msgEl = document.getElementById('mensaje');
    if (msgEl) {
        msgEl.textContent = 'Formulario limpiado.';
        setTimeout(()=>{ if(msgEl.textContent==='Formulario limpiado.') msgEl.textContent=''; },2000);
    }
    // Restaurar texto del botón si estaba en otro estado
    const btn = form.querySelector('button[type="submit"]');
    if(btn) btn.textContent = 'Enviar';
}

enviarFormulario("empaquetados-form");
