// FQ Solution — eventos de analítica (clics en WhatsApp y envío del formulario).
// Respeta el banner de cookies: window.va solo existe si la persona aceptó la analítica
// (lo define consent.js). Sin aceptación, estas llamadas no hacen nada ni envían datos.
// Nota: los eventos personalizados de Vercel Web Analytics requieren un plan que los incluya.
(() => {
  function track(name, data) {
    try {
      if (typeof window.va === 'function') window.va('event', { name, data });
    } catch { /* la analítica nunca debe romper la página */ }
  }
  window.fqTrack = track;

  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('[data-wa]') : null;
    if (!link) return;
    track('whatsapp_click', { seccion: link.dataset.wa || 'desconocida', pagina: location.pathname });
  });
})();
