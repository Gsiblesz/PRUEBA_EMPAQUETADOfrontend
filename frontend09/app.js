const DEFAULT_BACKEND_URL = "https://prueba-empaquetadobackend-1.onrender.com";
const LEGACY_BACKEND_URL = "https://prueba-empaquetadobackend.onrender.com";

function normalizeBackendUrl(url) {
  const value = String(url || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (value === LEGACY_BACKEND_URL) return DEFAULT_BACKEND_URL;
  return value;
}

function getBackendUrl() {
  const storedRaw = localStorage.getItem("BACKEND_URL") || "";
  const stored = normalizeBackendUrl(storedRaw);
  if (storedRaw && stored !== storedRaw.trim()) {
    try { localStorage.setItem("BACKEND_URL", stored); } catch (_) {}
  }
  return stored || DEFAULT_BACKEND_URL;
}

const loteList = document.getElementById("loteList");
const loteVacio = document.getElementById("loteVacio");
const detalleTitulo = document.getElementById("detalleTitulo");
const productosContainer = document.getElementById("productos");
const estado = document.getElementById("estado");
const validacionForm = document.getElementById("validacionForm");
const validarBtn = document.getElementById("validarBtn");
const recargarBtn = document.getElementById("recargar");
const btnEntradas = document.getElementById("btnEntradas");
const btnSalidas = document.getElementById("btnSalidas");
const btnAjustes = document.getElementById("btnAjustes");
const panelAjustes = document.getElementById("panelAjustes");
const adminKeyInput = document.getElementById("adminKey");
const guardarClaveBtn = document.getElementById("guardarClave");
const borrarSeleccionadosBtn = document.getElementById("borrarSeleccionados");
const borrarRegistrosBtn = document.getElementById("borrarRegistros");
const ajustesEstado = document.getElementById("ajustesEstado");
const erroresConteoTotal = document.getElementById("erroresConteoTotal");
const erroresConteoLista = document.getElementById("erroresConteoLista");

let lotes = [];
let loteActivo = null;
let modo = "entradas";

function api(path) {
  return `${getBackendUrl()}/api/almacen09${path}`;
}

function getRegistroLabel(codigoLote) {
  const index = lotes.findIndex((lote) => lote.codigo_lote === codigoLote);
  const numero = String(index + 1).padStart(5, "0");
  return `Registro ${numero}`;
}

function formatFechaVz(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // If backend already sends DD/MM/YYYY HH:MM, keep as-is.
  if (/^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function setEstado(mensaje, esError = false) {
  estado.textContent = mensaje;
  estado.classList.toggle("error", esError);
  estado.classList.toggle("ok", !esError && Boolean(mensaje));
}

function setAjustesEstado(mensaje, esError = false) {
  ajustesEstado.textContent = mensaje;
  ajustesEstado.classList.toggle("error", esError);
  ajustesEstado.classList.toggle("ok", !esError && Boolean(mensaje));
}

async function cargarErroresConteo() {
  const key = (adminKeyInput.value || "").trim();
  if (!key) {
    erroresConteoTotal.textContent = "Ingresa la clave para ver errores.";
    erroresConteoLista.innerHTML = "";
    return;
  }

  erroresConteoTotal.textContent = "Cargando...";
  erroresConteoLista.innerHTML = "";

  try {
    const response = await fetch(`${api("/errores-conteo")}?key=${encodeURIComponent(key)}`);
    if (!response.ok) {
      const text = await response.text();
      erroresConteoTotal.textContent = text || "Error al consultar";
      return;
    }

    const data = await response.json();
    const total = data.total || 0;
    erroresConteoTotal.textContent = `Total hoy: ${total}`;
    if (Array.isArray(data.items) && data.items.length) {
      data.items.forEach((item) => {
        const li = document.createElement("li");
        const fecha = formatFechaVz(item.created_at);
        li.textContent = `${fecha} · ${item.codigo_lote || "Sin lote"}`;
        erroresConteoLista.appendChild(li);
      });
    }
  } catch (_) {
    erroresConteoTotal.textContent = "Error de red al consultar";
  }
}

function limpiarInputs() {
  const inputs = productosContainer.querySelectorAll("input[data-codigo]");
  inputs.forEach((input) => { input.value = ""; });
}

function setModo(nuevoModo) {
  modo = nuevoModo;
  btnEntradas.classList.toggle("active", modo === "entradas");
  btnEntradas.setAttribute("aria-selected", modo === "entradas");
  btnSalidas.classList.toggle("active", modo === "salidas");
  btnSalidas.setAttribute("aria-selected", modo === "salidas");
  if (modo === "salidas") setEstado("Salidas estará disponible próximamente.");
  else setEstado("");
}

function crearElemento(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderLotes() {
  loteList.innerHTML = "";
  loteList.classList.toggle("ajustes-activo", !panelAjustes.hidden);

  if (!lotes.length) {
    loteVacio.style.display = "block";
    return;
  }
  loteVacio.style.display = "none";

  lotes.forEach((lote) => {
    const item = crearElemento("li", "lote-item");
    const checkbox = crearElemento("input", "lote-check");
    checkbox.type = "checkbox";
    checkbox.value = lote.codigo_lote;
    if (panelAjustes.hidden) checkbox.hidden = true;

    const button = crearElemento("button", "lote-btn");
    button.type = "button";
    const fechaLote = formatFechaVz(lote.created_at);
    button.innerHTML = `
      <span class="lote-codigo">${getRegistroLabel(lote.codigo_lote)} · ${lote.codigo_lote}</span>
      <span class="lote-meta">${fechaLote}</span>
    `;
    if (loteActivo && loteActivo.codigo_lote === lote.codigo_lote) button.classList.add("activo");
    button.addEventListener("click", () => seleccionarLote(lote.codigo_lote));

    item.appendChild(checkbox);
    item.appendChild(button);
    loteList.appendChild(item);
  });
}

function renderDetalle() {
  productosContainer.innerHTML = "";
  setEstado("");

  if (!loteActivo) {
    detalleTitulo.textContent = "Selecciona un lote";
    validarBtn.disabled = true;
    return;
  }

  detalleTitulo.textContent = `${getRegistroLabel(loteActivo.codigo_lote)} · ${loteActivo.codigo_lote}`;

  loteActivo.productos.forEach((producto) => {
    const row = crearElemento("div", "producto-row");
    const info = crearElemento("div", "producto-info");
    const nombreProducto = producto.descripcion || producto.codigo;

    info.innerHTML = `
      <div class="producto-codigo">${producto.codigo}</div>
      <div class="producto-descripcion">${nombreProducto}</div>
      <div class="producto-lote">Lote: ${producto.lote_producto || loteActivo.codigo_lote}</div>
      ${producto.cestas_calculadas !== null && producto.cestas_calculadas !== undefined ? `<div class="producto-cestas">Cestas: ${producto.cestas_calculadas}</div>` : ""}
    `;

    const inputWrap = crearElemento("div", "producto-input");
    const label = crearElemento("label", null, "Cantidad en almacén");
    label.setAttribute("for", `cantidad-${producto.id}`);

    const input = crearElemento("input");
    input.type = "number";
    input.min = "0";
    input.required = true;
    input.id = `cantidad-${producto.id}`;
    input.dataset.productoId = String(producto.id);
    input.dataset.codigo = producto.codigo;
    input.placeholder = "0";

    inputWrap.appendChild(label);
    inputWrap.appendChild(input);
    row.appendChild(info);
    row.appendChild(inputWrap);
    productosContainer.appendChild(row);
  });

  validarBtn.disabled = false;
}

function seleccionarLote(codigoLote) {
  loteActivo = lotes.find((lote) => lote.codigo_lote === codigoLote) || null;
  renderLotes();
  renderDetalle();
}

async function cargarLotes() {
  setEstado("");
  try {
    recargarBtn.disabled = true;
    const response = await fetch(api("/lotes"));
    if (!response.ok) {
      const text = await response.text();
      setEstado(`Error: ${text || response.status}`, true);
      return;
    }
    lotes = await response.json();
    if (loteActivo) loteActivo = lotes.find((l) => l.codigo_lote === loteActivo.codigo_lote) || null;
    renderLotes();
    renderDetalle();
  } catch (_) {
    setEstado("No se pudo cargar la lista de lotes.", true);
  } finally {
    recargarBtn.disabled = false;
  }
}

validacionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setEstado("");
  if (!loteActivo) return;

  const inputs = productosContainer.querySelectorAll("input[data-codigo]");
  const cantidades = Array.from(inputs).map((input) => ({
    id: Number(input.dataset.productoId),
    codigo: input.dataset.codigo,
    cantidad: Number(input.value),
  }));

  if (cantidades.some((item) => Number.isNaN(item.cantidad))) {
    setEstado("Completa todas las cantidades.", true);
    return;
  }

  try {
    validarBtn.disabled = true;
    const response = await fetch(api("/validar-conteo"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo_lote: loteActivo.codigo_lote,
        productos_y_cantidades: cantidades,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      limpiarInputs();
      setEstado(text || "Error al validar", true);
      return;
    }

    const data = await response.json();
    setEstado(data.message || "Lote validado y registrado.");
    await cargarLotes();
  } catch (_) {
    setEstado("Error de red al validar el lote.", true);
  } finally {
    validarBtn.disabled = false;
  }
});

recargarBtn.addEventListener("click", cargarLotes);
btnEntradas.addEventListener("click", () => setModo("entradas"));
btnSalidas.addEventListener("click", () => setModo("salidas"));

btnAjustes.addEventListener("click", () => {
  panelAjustes.hidden = !panelAjustes.hidden;
  if (!panelAjustes.hidden) {
    const stored = localStorage.getItem("ADMIN_KEY") || "";
    adminKeyInput.value = stored;
    cargarErroresConteo();
  }
  renderLotes();
});

guardarClaveBtn.addEventListener("click", () => {
  localStorage.setItem("ADMIN_KEY", adminKeyInput.value.trim());
  setAjustesEstado("Clave guardada.");
  cargarErroresConteo();
});

borrarRegistrosBtn.addEventListener("click", async () => {
  const key = (adminKeyInput.value || "").trim();
  if (!key) return setAjustesEstado("Ingresa la clave.", true);
  if (!confirm("¿Seguro que deseas descartar todos los registros pendientes?")) return;

  try {
    borrarRegistrosBtn.disabled = true;
    setAjustesEstado("Descartando...");
    const response = await fetch(api("/borrar-lotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    const text = await response.text();
    if (!response.ok) return setAjustesEstado(text || "Error al descartar.", true);

    setAjustesEstado("Registros descartados.");
    await cargarLotes();
  } catch (_) {
    setAjustesEstado("Error de red al descartar.", true);
  } finally {
    borrarRegistrosBtn.disabled = false;
  }
});

borrarSeleccionadosBtn.addEventListener("click", async () => {
  const key = (adminKeyInput.value || "").trim();
  if (!key) return setAjustesEstado("Ingresa la clave.", true);

  const seleccionados = Array.from(document.querySelectorAll(".lote-check:checked"))
    .map((input) => String(input.value || "").trim())
    .filter(Boolean);

  if (!seleccionados.length) return setAjustesEstado("Selecciona al menos un registro.", true);
  if (!confirm("¿Descartar los registros seleccionados?")) return;

  try {
    borrarSeleccionadosBtn.disabled = true;
    setAjustesEstado("Descartando...");
    const response = await fetch(api("/borrar-registros"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, codigos_lote: seleccionados }),
    });

    const text = await response.text();
    if (!response.ok) return setAjustesEstado(text || "Error al descartar.", true);

    setAjustesEstado("Registros descartados.");
    await cargarLotes();
  } catch (_) {
    setAjustesEstado("Error de red al descartar.", true);
  } finally {
    borrarSeleccionadosBtn.disabled = false;
  }
});

cargarLotes();
