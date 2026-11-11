/**
 * Edge Function: trade-transport-doc-public   (verify_jwt = false)
 *
 * URL única del documento de control (DeCA / hoja de ruta).
 * Resolución DGTCF 5-jun-2026 (BOE-A-2026-12784), apartado de la URL:
 *   · HTTPS, sin credenciales ni autenticación.
 *   · Una invocación produce la DESCARGA DIRECTA del PDF (sin páginas intermedias).
 *   · Disponible al menos hasta el fin del servicio; puede desactivarse
 *     7 días naturales después (columna public_hasta).
 *
 * Acceso: GET /trade-transport-doc-public?t=<token>
 *         GET /trade-transport-doc-public/<token>
 * En producción se publica como https://trabflow.com/d/<token> (rewrite de Vercel).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function plain(status: number, msg: string): Response {
  return new Response(msg, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'Método no permitido');

  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!/^[a-f0-9]{32,128}$/.test(token)) return plain(404, 'Documento no encontrado');

  const { data: doc, error } = await admin.from('trade_transport_control_docs')
    .select('id, numero, tipo, estado, pdf_path, public_hasta')
    .eq('public_token', token)
    .maybeSingle();

  if (error) return plain(500, 'Error interno');
  if (!doc || !doc.pdf_path) return plain(404, 'Documento no encontrado');
  if (doc.estado === 'anulado') return plain(410, `El documento ${doc.numero} ha sido anulado por el transportista.`);
  if (doc.estado === 'sustituido') {
    const { data: nuevo } = await admin.from('trade_transport_control_docs')
      .select('numero').eq('sustituye_a', doc.id).maybeSingle();
    return plain(410, `El documento ${doc.numero} ha sido sustituido${nuevo ? ` por el ${nuevo.numero}` : ''}. Sus datos ya no son válidos.`);
  }
  if (new Date(doc.public_hasta).getTime() < Date.now()) {
    return plain(410, `El enlace público del documento ${doc.numero} ha caducado. El transportista lo conserva a disposición de la Inspección.`);
  }

  const { data: file, error: dlErr } = await admin.storage.from('transport-control-docs').download(doc.pdf_path);
  if (dlErr || !file) return plain(500, 'No se pudo recuperar el documento');
  const bytes = new Uint8Array(await file.arrayBuffer());

  return new Response(req.method === 'HEAD' ? null : bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${doc.numero}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
});
