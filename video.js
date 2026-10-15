// FQ Solution — sección de demo en video.
// Se configura SOLO con los atributos de <section data-video-url="...">  en index.html:
//   data-video-url     Archivo propio (ej. /assets/video/supervisor360-demo.mp4) o enlace de YouTube.
//   data-video-poster  Imagen de portada para el archivo propio (opcional).
// Si data-video-url está vacío o no es válido, la sección permanece oculta y el enlace
// "Ver cómo funciona" ([data-demo-link]) apunta a la galería de pantallas.
(() => {
  const section = document.querySelector('[data-video-url]');
  const slot = section && section.querySelector('[data-video-slot]');
  const demoLinks = Array.from(document.querySelectorAll('[data-demo-link]'));

  function fallback() {
    demoLinks.forEach((a) => a.setAttribute('href', '#pantallas'));
  }
  if (!section || !slot) { fallback(); return; }

  const url = (section.dataset.videoUrl || '').trim();
  if (!url) { fallback(); return; }

  const track = (name, data) => { if (typeof window.fqTrack === 'function') window.fqTrack(name, data); };

  // Identificador de YouTube (watch, youtu.be, embed o shorts); si no coincide, se trata como archivo propio.
  function youtubeId(u) {
    try {
      const x = new URL(u, location.href);
      if (x.hostname === 'youtu.be') return x.pathname.slice(1);
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(x.hostname)) {
        if (x.searchParams.get('v')) return x.searchParams.get('v');
        const m = x.pathname.match(/^\/(embed|shorts)\/([\w-]{6,})/);
        if (m) return m[2];
      }
    } catch { /* URL inválida */ }
    return '';
  }

  const id = youtubeId(url);
  if (id && /^[\w-]{6,}$/.test(id)) {
    // Fachada: YouTube no se carga hasta que la persona pulsa (evita cookies de terceros al entrar).
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'video-fachada';
    btn.setAttribute('aria-label', 'Reproducir el video de demostración de Supervisor 360');
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 480; img.height = 360;
    const play = document.createElement('span');
    play.className = 'video-play';
    play.setAttribute('aria-hidden', 'true');
    btn.append(img, play);
    btn.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      frame.title = 'Demostración de Supervisor 360';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen = true;
      slot.replaceChildren(frame);
      track('video_play', { origen: 'youtube' });
    });
    slot.append(btn);
  } else {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'none';
    const poster = (section.dataset.videoPoster || '').trim();
    if (poster) video.poster = poster;
    video.setAttribute('aria-label', 'Demostración en video de Supervisor 360');
    const src = document.createElement('source');
    src.src = url;
    src.type = /\.webm(\?|$)/i.test(url) ? 'video/webm' : 'video/mp4';
    video.append(src, 'Tu navegador no puede reproducir este video.');
    video.addEventListener('play', () => track('video_play', { origen: 'archivo' }), { once: true });
    slot.append(video);
  }

  section.hidden = false;
})();
