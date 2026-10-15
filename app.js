// FQ Solution landing — JS mínimo, compatible con CSP estricta (sin inline, sin innerHTML)
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const t0 = Date.now();
const PRIVACY_VERSION = '2026-10-10'; // debe coincidir con la fecha de la Política de privacidad

// Formulario de demo: nombre, WhatsApp y cantidad de locales. El servidor revalida todo.
const form = $('#contactForm');
const formMsg = $('#formMsg');
const submitBtn = $('#submitBtn');
const SUBMIT_LABEL = 'Quiero mi demo';
let lastSubmit = 0;

function setMsg(text, kind) {
  if (!formMsg) return;
  formMsg.textContent = text; // textContent evita XSS
  formMsg.className = 'form-msg ' + (kind || '');
  formMsg.setAttribute('role', kind === 'err' ? 'alert' : 'status'); // los errores se anuncian de inmediato
}

// Marca el campo con error, lo anuncia y le da el foco (operable por teclado y lector de pantalla)
function fail(field, text) {
  $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  setMsg(text, 'err');
}

// WhatsApp plausible: 8 a 15 dígitos (acepta +, espacios, guiones y paréntesis)
function whatsappOk(v) {
  const d = v.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15;
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
      whatsapp: $('#whatsapp').value.trim(),
      locales: $('#locales').value,
      empresa_web: $('#empresa_web').value, // honeypot
      consentimiento: $('#consentimiento').checked,
      politica: PRIVACY_VERSION,
      _t: now - t0
    };

    if (data.nombre.length < 3 || data.nombre.length > 120) { fail($('#nombre'), 'Escribe tu nombre (3 a 120 caracteres).'); return; }
    if (!whatsappOk(data.whatsapp)) { fail($('#whatsapp'), 'Escribe tu WhatsApp con código de país o el 09… de Ecuador.'); return; }
    if (!data.locales) { fail($('#locales'), 'Indica cuántos locales tienes.'); return; }
    if (!data.consentimiento) { fail($('#consentimiento'), 'Para enviar la solicitud debes aceptar la Política de privacidad.'); return; }
    $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
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
        setMsg(out.message || 'Listo, recibimos tu solicitud. Te escribiremos por WhatsApp.', 'ok');
        form.reset();
        if (typeof window.fqTrack === 'function') window.fqTrack('formulario_enviado', { locales: data.locales });
      } else {
        setMsg(out.message || 'No se pudo enviar. Intenta de nuevo o escríbenos por WhatsApp.', 'err');
      }
    } catch {
      setMsg('Error de red. Intenta de nuevo o escríbenos por WhatsApp.', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = SUBMIT_LABEL;
    }
  });
}
