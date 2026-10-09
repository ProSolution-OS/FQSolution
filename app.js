// FQ Solution landing — JS mínimo, sin innerHTML con datos de usuario
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const t0 = Date.now();

// Menú móvil
const menuBtn = $('#menuBtn');
const nav = $('#nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
}

// Contador
const msg = $('#mensaje');
const count = $('#charCount');
if (msg && count) msg.addEventListener('input', () => { count.textContent = String(msg.value.length); });

// Envío seguro al endpoint /api/contact
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

    // Rate-limit cliente: 1 envío cada 8s
    const now = Date.now();
    if (now - lastSubmit < 8000) { setMsg('Espera unos segundos antes de reintentar.', 'err'); return; }

    // Tiempo mínimo de permanencia (anti-bots): 3s
    if (Date.now() - t0 < 3000) { setMsg('Completa el formulario con calma y reintenta.', 'err'); return; }

    const data = {
      nombre: $('#nombre').value.trim(),
      email: $('#email').value.trim(),
      tipo: $('#tipo').value,
      presupuesto: $('#presupuesto').value,
      mensaje: $('#mensaje').value.trim(),
      empresa_web: $('#empresa_web').value, // honeypot
      _t: Date.now() - t0
    };

    // Validación cliente (el servidor revalida)
    if (data.nombre.length < 3 || data.nombre.length > 120) { setMsg('Nombre inválido (3-120 caracteres).', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) || data.email.length > 160) { setMsg('Correo inválido.', 'err'); return; }
    if (data.mensaje.length < 20 || data.mensaje.length > 4000) { setMsg('Mensaje debe tener 20-4000 caracteres.', 'err'); return; }
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
