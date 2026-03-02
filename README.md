# Frontend - Empaquetado y Merma

Sitio estático para desplegar en Vercel.

## Variables y configuración

El frontend usa la URL del backend guardada en `localStorage` (`BACKEND_URL`) desde la sección **Configuración** en `index.html`.
Si no existe, usa el fallback en el código (`https://prueba-empaquetadobackend-1.onrender.com`).

## Deploy en Vercel

1. Importa este repositorio en Vercel.
2. Framework Preset: `Other`.
3. Build Command: vacío.
4. Output Directory: vacío.
5. Deploy.

`vercel.json` redirige `/` a `index.html`.
