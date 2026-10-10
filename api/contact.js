// /api/contact — endpoint serverless para Vercel (Node)
// Seguridad: POST+JSON, comprobación de Origin, límite de tamaño, honeypot, allowlists,
// validación, sanitización y rate-limit (best-effort en memoria; para límite estricto usar Upstash Redis).
const ALLOWED_TIPOS = new Set(['desarrollo', 'migracion', 'arquitectura', 'consultoria', 'supervisor360']);
const ALLOWED_PRESUPUESTO = new Set(['t1', 't2', 'retainer']);
const ALLOWED_HOSTS = new Set(['fq-solution-landing.vercel.app', 'localhost', '127.0.0.1']);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQ = 6;
const MAX_BODY = 12 * 1024;
const hits = new Map(); // ip -> {count, start}

// En Vercel, x-real-ip / x-vercel-forwarded-for los fija la plataforma; x-forwarded-for
// puede traer valores inyectados por el cliente, así que NO se usa como primera opción.
function ipOf(req) {
  const h = req.headers;
  const v = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  return String(v).split(',')[0].trim().slice(0, 64);
}
function clean(s, max) {
  return String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/<[^>]*>/g, '').trim().slice(0, max);
}
function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return false; // fetch POST desde el navegador siempre envía Origin
  try {
    const host = new URL(o).hostname;
    // Producción, local y previews de Vercel de este proyecto (fq-solution-landing-*.vercel.app)
    return ALLOWED_HOSTS.has(host) || /^fq-solution-landing(-[a-z0-9-]+)?\.vercel\.app$/.test(host);
  } catch { return false; }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function prune(now) {
  if (hits.size < 500) return;
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { message: 'Método no permitido.' });
  }
  if (!originOk(req)) return json(res, 403, { message: 'Origen no permitido.' });
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) return json(res, 415, { message: 'Content-Type debe ser application/json.' });

  // Rate-limit ANTES de procesar el cuerpo
  const ip = ipOf(req);
  const now = Date.now();
  prune(now);
  const slot = hits.get(ip) || { count: 0, start: now };
  if (now - slot.start > WINDOW_MS) { slot.count = 0; slot.start = now; }
  slot.count += 1;
  hits.set(ip, slot);
  if (slot.count > MAX_REQ) {
    res.setHeader('Retry-After', '600');
    return json(res, 429, { message: 'Demasiados envíos. Intenta en 10 minutos.' });
  }

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw || '{}');
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('shape');
  } catch (e) {
    if (e.message === 'too-large') return json(res, 413, { message: 'Payload demasiado grande.' });
    return json(res, 400, { message: 'JSON inválido.' });
  }

  // Honeypot + tiempo mínimo (si _t falta o no es número, se rechaza: antes NaN lo saltaba)
  if (body.empresa_web) return json(res, 200, { message: 'Mensaje recibido. Te contactaremos en menos de 24h.' });
  const elapsed = Number(body._t);
  if (!Number.isFinite(elapsed) || elapsed < 2500) return json(res, 400, { message: 'Envío demasiado rápido. Completa el formulario con calma.' });

  const nombre = clean(body.nombre, 120);
  const email = clean(body.email, 160).toLowerCase();
  const tipo = clean(body.tipo, 30);
  const presupuesto = clean(body.presupuesto, 20);
  const mensaje = String(body.mensaje ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '').trim().slice(0, 4000);

  if (nombre.length < 3) return json(res, 400, { message: 'Nombre inválido.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { message: 'Correo inválido.' });
  if (!ALLOWED_TIPOS.has(tipo)) return json(res, 400, { message: 'Tipo de proyecto inválido.' });
  if (presupuesto && !ALLOWED_PRESUPUESTO.has(presupuesto)) return json(res, 400, { message: 'Presupuesto inválido.' });
  if (mensaje.length < 20) return json(res, 400, { message: 'Mensaje demasiado corto (mín. 20 caracteres).' });

  // Configura en Vercel: RESEND_API_KEY (requerido), CONTACT_TO y CONTACT_FROM (opcionales).
  const TO = (process.env.CONTACT_TO || 'qfreddy03@gmail.com').trim();
  const FROM = (process.env.CONTACT_FROM || 'FQ Solution <onboarding@resend.dev>').trim();
  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] missing RESEND_API_KEY');
    return json(res, 503, { message: 'El servicio de correo no está disponible. Escríbenos a qfreddy03@gmail.com.' });
  }
  const subject = `[FQ Solution] ${tipo} — ${nombre}`.slice(0, 120);
  const text = `Nombre: ${nombre}\nEmail: ${email}\nTipo: ${tipo}\nPresupuesto: ${presupuesto || '-'}\nIP: ${ip}\n\n${mensaje}`.slice(0, 5000);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject, text, reply_to: email }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!r.ok) {
      console.error(`[contact] resend fail ${r.status}`); // no se registra el cuerpo (puede contener datos del usuario)
      return json(res, 502, { message: 'No se pudo enviar el correo. Intenta de nuevo.' });
    }
  } catch (e) {
    console.error('[contact] send error', e?.name || 'error');
    return json(res, 502, { message: 'No se pudo enviar el correo. Intenta de nuevo.' });
  }

  console.log(`[contact] sent tipo=${tipo} len=${mensaje.length}`);
  return json(res, 200, { message: 'Mensaje recibido. Te contactaremos en menos de 24h.' });
};
