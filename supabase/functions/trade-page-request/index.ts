// Recibe solicitudes de presupuesto desde la página pública del instalador (trabflow.com/pro/{slug}).
// Pública (sin JWT): valida datos, aplica antispam y límites, inserta con service role y avisa por push.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'];
// Vistas previas de Vercel del proyecto
const PREVIEW_ORIGIN = /^https:\/\/tradeflow-[a-z0-9-]+-fercarboc-gmailcoms-projects\.vercel\.app$/;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface Pregunta { id: string; etiqueta: string; tipo: 'texto' | 'opciones'; opciones?: string[]; obligatoria?: boolean }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: 'JSON no válido' }, 400); }

  // Honeypot: los bots rellenan el campo oculto «website»
  if (clean(body.website, 200)) return json(req, { ok: true });

  const slug = clean(body.slug, 60).toLowerCase();
  const nombre = clean(body.nombre, 120);
  const telefono = clean(body.telefono, 30).replace(/[^\d+]/g, '');
  const mensaje = clean(body.mensaje, 2000);
  const consentimiento = body.consentimiento === true;

  if (!slug) return json(req, { error: 'Página no indicada' }, 400);
  if (nombre.length < 2) return json(req, { error: 'Escribe tu nombre' }, 400);
  if (telefono.replace(/\D/g, '').length < 9) return json(req, { error: 'Escribe un teléfono válido' }, 400);
  if (!consentimiento) return json(req, { error: 'Debes aceptar la política de privacidad' }, 400);

  const { data: page, error: pageError } = await adminClient
    .from('trade_public_pages')
    .select('id, org_id, activa, preguntas, nombre, whatsapp')
    .eq('slug', slug)
    .maybeSingle();
  if (pageError) return json(req, { error: 'Error interno' }, 500);
  if (!page || !page.activa) return json(req, { error: 'Esta página no está disponible' }, 404);

  // Respuestas: solo preguntas definidas por el instalador, con su orden y validación
  const preguntas = (Array.isArray(page.preguntas) ? page.preguntas : []) as Pregunta[];
  const enviadas = (body.respuestas && typeof body.respuestas === 'object') ? body.respuestas as Record<string, unknown> : {};
  const respuestas: { pregunta: string; respuesta: string }[] = [];
  for (const p of preguntas) {
    const r = clean(enviadas[p.id], 1000);
    if (p.obligatoria && !r) return json(req, { error: `Responde: ${p.etiqueta}` }, 400);
    if (p.tipo === 'opciones' && r && Array.isArray(p.opciones) && !p.opciones.includes(r)) {
      return json(req, { error: `Opción no válida en: ${p.etiqueta}` }, 400);
    }
    if (r) respuestas.push({ pregunta: clean(p.etiqueta, 200), respuesta: r });
  }

  // Límites antiabuso: por IP (5/hora) y por teléfono en la misma página (3/día)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida';
  const ipHash = await sha256(`${ip}|${SUPABASE_URL}`);
  const haceUnaHora = new Date(Date.now() - 3600_000).toISOString();
  const haceUnDia = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: porIp }, { count: porTel }] = await Promise.all([
    adminClient.from('trade_page_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', haceUnaHora),
    adminClient.from('trade_page_requests').select('id', { count: 'exact', head: true }).eq('page_id', page.id).eq('telefono', telefono).gte('created_at', haceUnDia),
  ]);
  if ((porIp ?? 0) >= 5 || (porTel ?? 0) >= 3) {
    return json(req, { error: 'Has enviado varias solicitudes. Inténtalo más tarde o escribe por WhatsApp.' }, 429);
  }

  const { error: insertError } = await adminClient.from('trade_page_requests').insert({
    org_id: page.org_id,
    page_id: page.id,
    nombre,
    telefono,
    respuestas,
    mensaje,
    consentimiento_at: new Date().toISOString(),
    ip_hash: ipHash,
  });
  if (insertError) return json(req, { error: 'No se pudo enviar la solicitud' }, 500);

  // Aviso push al instalador (no bloquea la respuesta)
  fetch(`${SUPABASE_URL}/functions/v1/trade-push-notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      org_id: page.org_id,
      title: 'Nueva solicitud de presupuesto',
      body_text: `${nombre} te ha pedido presupuesto desde tu página`,
      url: '/',
    }),
  }).catch(() => {});

  return json(req, { ok: true, whatsapp: page.whatsapp ?? '' });
});
