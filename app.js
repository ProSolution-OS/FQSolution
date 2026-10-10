// FQ Solution landing — JS mínimo, compatible con CSP estricta (sin inline, sin innerHTML)
document.documentElement.classList.add('js');
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const t0 = Date.now();

// Menú móvil
const menuBtn = $('#menuBtn');
const nav = $('#nav');
if (menuBtn && nav) {
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// Animación de entrada al hacer scroll
const items = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('in'));
}

// Contador de caracteres
const msg = $('#mensaje');
const count = $('#charCount');
if (msg && count) msg.addEventListener('input', () => { count.textContent = String(msg.value.length); });

// Envío al endpoint /api/contact (el servidor revalida todo)
const form = $('#contactForm');
const formMsg = $('#formMsg');
const submitBtn = $('#submitBtn');
let lastSubmit = 0;

function setMsg(text, kind) {
  if (!formMsg) return;
  formMsg.textContent = text; // textContent evita XSS
  formMsg.className = 'form-msg ' + (kind || '');
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('', '');

    const now = Date.now();
    if (now - lastSubmit < 8000) { setMsg('Espera unos segundos antes de reintentar.', 'err'); return; }
    if (now - t0 < 3000) { setMsg('Completa el formulario con calma y reintenta.', 'err'); return; }

    const data = {
      nombre: $('#nombre').value.trim(),
      email: $('#email').value.trim(),
      tipo: $('#tipo').value,
      presupuesto: $('#presupuesto').value,
      mensaje: $('#mensaje').value.trim(),
      empresa_web: $('#empresa_web').value, // honeypot
      _t: now - t0
    };

    if (data.nombre.length < 3 || data.nombre.length > 120) { setMsg('Nombre inválido (3-120 caracteres).', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) || data.email.length > 160) { setMsg('Correo inválido.', 'err'); return; }
    if (data.mensaje.length < 20 || data.mensaje.length > 4000) { setMsg('El mensaje debe tener 20-4000 caracteres.', 'err'); return; }
    if (data.empresa_web) { setMsg('Enviado.', 'ok'); return; } // bot: fingir éxito

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';
    lastSubmit = now;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(out.message || 'Mensaje enviado. Te contactaremos en <24h.', 'ok');
        form.reset();
        if (count) count.textContent = '0';
      } else {
        setMsg(out.message || 'No se pudo enviar. Intenta de nuevo.', 'err');
      }
    } catch {
      setMsg('Error de red. Intenta de nuevo.', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar mensaje';
    }
  });
}
