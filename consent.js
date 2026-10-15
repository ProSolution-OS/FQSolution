// FQ Solution — consentimiento de cookies: analítica y publicidad (Google AdSense).
// Compatible con CSP estricta (sin inline, sin innerHTML). La analítica (Vercel Web Analytics) NO se carga
// hasta que la persona la acepta (la publicidad de Google AdSense tampoco se carga sin aceptación); "Rechazar" y "Aceptar" tienen el mismo peso visual. La elección se guarda
// solo en este navegador (localStorage, clave fq_consent) y caduca a los 12 meses.
(() => {
  const KEY = 'fq_consent';
  const VERSION = 2; // v2: añade la categoría de publicidad; las elecciones v1 se vuelven a preguntar
  const ADS_CLIENT = 'ca-pub-3747681331852269';
  const MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  let loaded = false;
  let adsLoaded = false;
  let lastOpener = null;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && value.v === VERSION && typeof value.analytics === 'boolean' && typeof value.ads === 'boolean' && Date.now() - value.ts < MAX_AGE) return value;
    } catch { /* almacenamiento no disponible o valor dañado: se vuelve a preguntar */ }
    return null;
  }
  function write(analytics, ads) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics, ads, ts: Date.now() })); } catch { /* sin almacenamiento: la elección vale solo para esta página */ }
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

  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS_CLIENT;
    script.dataset.fqAds = '1';
    document.head.appendChild(script);
  }

  function updateStatus() {
    const choice = read();
    document.querySelectorAll('[data-consent-status]').forEach((el) => {
      el.textContent = choice
        ? 'Tu elección actual: analítica ' + (choice.analytics ? 'aceptada' : 'rechazada') + ' · publicidad ' + (choice.ads ? 'aceptada' : 'rechazada') + '.'
        : 'Aún no has elegido: la analítica y la publicidad están desactivadas.';
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

  function choose(analytics, ads) {
    const revoke = (loaded && !analytics) || (adsLoaded && !ads);
    write(analytics, ads);
    updateStatus();
    if (analytics) loadAnalytics();
    if (ads) loadAds();
    closeBanner(true);
    if (revoke) window.location.reload(); // retira los scripts ya cargados en esta página
  }

  function openBanner(focus) {
    if (document.getElementById('consentBanner')) return;
    const title = el('h2', { id: 'consentTitle', className: 'consent-title', tabIndex: -1, textContent: 'Tu privacidad' });
    const text = el('p', { className: 'consent-text' }, [
      'Solo con tu permiso medimos visitas con analítica anónima y mostramos publicidad de Google AdSense, que puede usar cookies e identificadores de tu navegador. Sin tu permiso no se carga ninguna de las dos. ',
      el('a', { href: '/cookies', textContent: 'Más información' }),
      '.'
    ]);
    const reject = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Rechazar todo' });
    const analyticsOnly = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Solo analítica' });
    const accept = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: 'Aceptar todo' });
    reject.addEventListener('click', () => choose(false, false));
    analyticsOnly.addEventListener('click', () => choose(true, false));
    accept.addEventListener('click', () => choose(true, true));
    const banner = el('section', { id: 'consentBanner', className: 'consent-banner' }, [
      title, text, el('div', { className: 'consent-actions' }, [reject, analyticsOnly, accept])
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
  if (stored && stored.ads) loadAds();
  updateStatus();
  if (!stored) openBanner(false);
})();
