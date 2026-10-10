// FQ Solution — consentimiento de cookies y analítica.
// Compatible con CSP estricta (sin inline, sin innerHTML). La analítica (Vercel Web Analytics) NO se carga
// hasta que la persona la acepta; "Rechazar" y "Aceptar" tienen el mismo peso visual. La elección se guarda
// solo en este navegador (localStorage, clave fq_consent) y caduca a los 12 meses.
(() => {
  const KEY = 'fq_consent';
  const VERSION = 1;
  const MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  let loaded = false;
  let lastOpener = null;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && value.v === VERSION && typeof value.analytics === 'boolean' && Date.now() - value.ts < MAX_AGE) return value;
    } catch { /* almacenamiento no disponible o valor dañado: se vuelve a preguntar */ }
    return null;
  }
  function write(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics, ts: Date.now() })); } catch { /* sin almacenamiento: la elección vale solo para esta página */ }
  }

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const script = document.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    script.dataset.fqAnalytics = '1';
    document.head.appendChild(script);
  }

  function updateStatus() {
    const choice = read();
    document.querySelectorAll('[data-consent-status]').forEach((el) => {
      el.textContent = choice
        ? (choice.analytics ? 'Tu elección actual: analítica aceptada.' : 'Tu elección actual: analítica rechazada.')
        : 'Aún no has elegido: la analítica está desactivada.';
    });
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    (children || []).forEach((child) => node.append(child));
    return node;
  }

  function closeBanner(returnFocus) {
    const banner = document.getElementById('consentBanner');
    if (banner) banner.remove();
    if (returnFocus && lastOpener && document.contains(lastOpener)) lastOpener.focus();
    lastOpener = null;
  }

  function choose(analytics) {
    const had = loaded;
    write(analytics);
    updateStatus();
    if (analytics) loadAnalytics();
    closeBanner(true);
    if (!analytics && had) window.location.reload(); // retira el script ya cargado en esta página
  }

  function openBanner(focus) {
    if (document.getElementById('consentBanner')) return;
    const title = el('h2', { id: 'consentTitle', className: 'consent-title', tabIndex: -1, textContent: 'Tu privacidad' });
    const text = el('p', { className: 'consent-text' }, [
      'Este sitio no usa cookies publicitarias. Solo con tu permiso medimos visitas con analítica anónima para mejorar la página. ',
      el('a', { href: '/cookies', textContent: 'Más información' }),
      '.'
    ]);
    const reject = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Rechazar analítica' });
    const accept = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Aceptar analítica' });
    reject.addEventListener('click', () => choose(false));
    accept.addEventListener('click', () => choose(true));
    const banner = el('section', { id: 'consentBanner', className: 'consent-banner' }, [
      title, text, el('div', { className: 'consent-actions' }, [reject, accept])
    ]);
    banner.setAttribute('aria-labelledby', 'consentTitle');
    banner.setAttribute('role', 'region');
    banner.addEventListener('keydown', (e) => { if (e.key === 'Escape' && read()) closeBanner(true); });
    document.body.append(banner);
    if (focus) title.focus();
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target instanceof Element ? e.target.closest('[data-consent-open]') : null;
    if (!trigger) return;
    lastOpener = trigger;
    openBanner(true);
  });

  const stored = read();
  if (stored && stored.analytics) loadAnalytics();
  updateStatus();
  if (!stored) openBanner(false);
})();
