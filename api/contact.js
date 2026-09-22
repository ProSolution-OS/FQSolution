// /api/contact — endpoint serverless para Vercel (Node)
// Seguridad: POST+JSON, límite de tamaño, honeypot, validación, sanitización, rate-limit, sin XSS/SQLi (no hay DB).
const ALLOWED_TIPOS = new Set(['desarrollo', 'migracion', 'arquitectura', 'consultoria']);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQ = 6;
// Skill security-and-hardening: en serverless el contador en memoria es best-effort
// (cada instancia lleva el suyo). Suficiente contra spam casual; para límite estricto
// usar store compartido (Upstash Redis) y contar allí.
const hits = new Map(); // ip -> {count, start}

function ipOf(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim().slice(0, 64);
  return (req.socket?.remoteAddress || 'unknown').slice(0, 64);
}
function clean(s, max) {
  return String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}
function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  // Cabeceras base
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { message: 'Método no permitido.' });
  }
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) return json(res, 415, { message: 'Content-Type debe ser application/json.' });

  // Límite de tamaño ~12KB
  let raw = '';
  try {
    raw = await new Promise((resolve, reject) => {
      let size = 0;
      req.on('data', (c) => { size += c.length; if (size > 12 * 1024) reject(new Error('too-large')); });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
      req.on('data', (c) => { raw += c; });
    });
  } catch {
    return json(res, 413, { message: 'Payload demasiado grande.' });
  }

  let body;
  try { body = JSON.parse(raw || '{}'); }
  catch { return json(res, 400, { message: 'JSON inválido.' }); }

  const ip = ipOf(req);
  const now = Date.now();
  const slot = hits.get(ip) || { count: 0, start: now };
  if (now - slot.start > WINDOW_MS) { slot.count = 0; slot.start = now; }
  slot.count += 1;
  hits.set(ip, slot);
  if (slot.count > MAX_REQ) {
    res.setHeader('Retry-After', '600');
    return json(res, 429, { message: 'Demasiados envíos. Intenta en 10 minutos.' });
  }

  // Honeypot + tiempo mínimo
  if (body.empresa_web) return json(res, 200, { message: 'Mensaje recibido. Te contactaremos en menos de 24h.' });
  if (Number(body._t) < 2500) return json(res, 400, { message: 'Envío demasiado rápido. Completa el formulario con calma.' });

  const nombre = clean(body.nombre, 120);
  const email = clean(body.email, 160).toLowerCase();
  const tipo = clean(body.tipo, 30);
  const presupuesto = clean(body.presupuesto, 20);
  const mensaje = clean(body.mensaje, 4000);

  if (nombre.length < 3) return json(res, 400, { message: 'Nombre inválido.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { message: 'Correo inválido.' });
  if (!ALLOWED_TIPOS.has(tipo)) return json(res, 400, { message: 'Tipo de proyecto inválido.' });
  if (mensaje.length < 20) return json(res, 400, { message: 'Mensaje demasiado corto (mín. 20 caracteres).' });

  // Envío a qfreddy03@gmail.com vía Resend (https://resend.com, plan gratis).
  // Configura en Vercel: RESEND_API_KEY (requerido), CONTACT_TO y CONTACT_FROM (opcionales).
  const TO = (process.env.CONTACT_TO || 'qfreddy03@gmail.com').trim();
  const FROM = (process.env.CONTACT_FROM || 'FQ Solution <onboarding@resend.dev>').trim();
  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] missing RESEND_API_KEY');
    return json(res, 503, { message: 'Correo no configurado en el servidor. Falta RESEND_API_KEY.' });
  }
  const subject = `[FQ Solution] ${tipo} — ${nombre}`.slice(0, 120);
  const text = `Nombre: ${nombre}\nEmail: ${email}\nTipo: ${tipo}\nPresupuesto: ${presupuesto || '-'}\nIP: ${ip}\n\n${mensaje}`.slice(0, 5000);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject, text, reply_to: email })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error(`[contact] resend fail ${r.status} ${t.slice(0, 300)}`);
      return json(res, 502, { message: 'No se pudo enviar el correo. Intenta de nuevo.' });
    }
  } catch (e) {
    console.error('[contact] send error', e?.message || e);
    return json(res, 502, { message: 'No se pudo enviar el correo. Intenta de nuevo.' });
  }

  console.log(`[contact] sent to=${TO} tipo=${tipo} len=${mensaje.length}`);

  return json(res, 200, { message: 'Mensaje recibido. Te contactaremos en menos de 24h.' });
};
