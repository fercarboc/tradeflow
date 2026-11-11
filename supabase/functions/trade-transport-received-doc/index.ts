/**
 * Edge Function: trade-transport-received-doc
 *
 * Guarda una copia del PDF de un documento de control RECIBIDO (DeCA del
 * cargador u hoja de ruta de otra empresa) a partir de la URL de su QR.
 * La Resolución DGTCF 5-jun-2026 obliga a que esa URL descargue el PDF
 * directamente y sin login, pero el emisor puede desactivarla 7 días
 * después del servicio: por eso conservamos nuestra copia.
 *
 * POST { org_id, id }   (JWT obligatorio; miembro activo de la org)
 *
 * Protecciones de la descarga:
 *   · solo https:// y puerto 443; sin IPs literales ni nombres internos
 *   · como mucho 3 redirecciones, revalidando cada destino
 *   · máximo 5 MB y comprobación de cabecera %PDF
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;
const BUCKET           = 'transport-received-docs';
const MAX_BYTES        = 5 * 1024 * 1024;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const ok = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Valida que la URL sea pública y segura para descargar. */
export function safeUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new HttpError(422, 'El QR no contiene un enlace válido'); }
  if (u.protocol !== 'https:') throw new HttpError(422, 'El enlace del QR no es seguro (https)');
  if (u.port && u.port !== '443') throw new HttpError(422, 'Puerto no permitido');
  if (u.username || u.password) throw new HttpError(422, 'El enlace no puede llevar credenciales');
  const h = u.hostname.toLowerCase();
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
  const isIpv6 = h.includes(':') || h.startsWith('[');
  if (isIpv4 || isIpv6 || !h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) {
    throw new HttpError(422, 'Dirección no permitida');
  }
  return u;
}

async function downloadPdf(raw: string): Promise<Uint8Array> {
  let url = safeUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'Accept': 'application/pdf,*/*', 'User-Agent': 'TrabFlow/1.0 (+https://trabflow.com)' } });
    } catch {
      clearTimeout(timer);
      throw new HttpError(502, 'No se pudo conectar con la web del emisor');
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const loc = res.headers.get('location');
      if (!loc) throw new HttpError(502, 'Redirección sin destino');
      url = safeUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) { clearTimeout(timer); throw new HttpError(502, `La web del emisor respondió ${res.status}`); }
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) { clearTimeout(timer); throw new HttpError(413, 'El PDF supera 5 MB'); }

    const reader = res.body?.getReader();
    if (!reader) { clearTimeout(timer); throw new HttpError(502, 'Respuesta vacía'); }
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, 'El PDF supera 5 MB'); }
        chunks.push(value);
      }
    } finally { clearTimeout(timer); }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const magic = new TextDecoder().decode(bytes.slice(0, 5));
    if (magic !== '%PDF-') throw new HttpError(422, 'El enlace no devuelve un PDF (puede pedir usuario o haber caducado)');
    return bytes;
  }
  throw new HttpError(502, 'Demasiadas redirecciones');
}

Deno.serve(async (request: Request) => {
  const headers = { ...cors(request), 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  let docId: string | null = null;
  try {
    // deno-lint-ignore no-explicit-any
    let body: any;
    try { body = await request.json(); } catch { throw new HttpError(400, 'JSON no válido'); }
    const orgId = typeof body?.org_id === 'string' ? body.org_id : '';
    docId = typeof body?.id === 'string' ? body.id : null;
    if (!orgId || !docId) throw new HttpError(400, 'Faltan datos');

    // Autenticación y pertenencia
    const auth = request.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Sesión no válida');
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) throw new HttpError(401, 'Sesión no válida');
    const { data: org } = await admin.from('trade_organizations').select('id, owner_id, transport_enabled').eq('id', orgId).maybeSingle();
    if (!org?.transport_enabled) throw new HttpError(403, 'El módulo de transporte no está activo');
    if (org.owner_id !== u.user.id) {
      const { data: m } = await admin.from('trade_org_members').select('activo').eq('org_id', orgId).eq('user_id', u.user.id).maybeSingle();
      if (!m || m.activo === false) throw new HttpError(403, 'No perteneces a esta organización');
    }

    const { data: doc } = await admin.from('trade_transport_received_docs')
      .select('id, org_id, qr_url, pdf_path').eq('id', docId).eq('org_id', orgId).maybeSingle();
    if (!doc) throw new HttpError(404, 'Documento no encontrado');
    if (doc.pdf_path) return new Response(JSON.stringify({ ok: true, pdf: true, already: true }), { status: 200, headers });
    if (!doc.qr_url) throw new HttpError(422, 'Este documento no tiene enlace en su QR');

    let bytes: Uint8Array;
    try {
      bytes = await downloadPdf(doc.qr_url);
    } catch (e) {
      const msg = e instanceof HttpError ? e.message : 'No se pudo descargar el PDF';
      await admin.from('trade_transport_received_docs').update({ pdf_fetch_error: msg }).eq('id', doc.id);
      return new Response(JSON.stringify({ ok: true, pdf: false, error: msg }), { status: 200, headers });
    }

    const path = `${orgId}/${doc.id}/documento.pdf`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new HttpError(500, 'No se pudo guardar la copia del PDF');
    await admin.from('trade_transport_received_docs').update({
      pdf_path: path, pdf_bytes: bytes.length, pdf_fetched_at: new Date().toISOString(), pdf_fetch_error: null,
    }).eq('id', doc.id);

    return new Response(JSON.stringify({ ok: true, pdf: true }), { status: 200, headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const msg = e instanceof HttpError ? e.message : 'Error interno';
    if (!(e instanceof HttpError)) console.error('[trade-transport-received-doc]', e);
    return new Response(JSON.stringify({ error: msg }), { status, headers });
  }
});
