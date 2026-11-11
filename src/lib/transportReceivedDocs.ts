/**
 * TX-DOCS-2 — Documentos de control RECIBIDOS de terceros (DeCA del cargador,
 * hoja de ruta de otra empresa): QR escaneado + fotos del papel + copia del PDF.
 */
import { supabase } from './supabase';

export type ReceivedDocTipo = 'deca' | 'hoja_ruta' | 'otro';

export interface ReceivedDoc {
  id: string;
  org_id: string;
  tipo: ReceivedDocTipo;
  qr_text: string | null;
  qr_url: string | null;
  emisor_nombre: string | null;
  numero_documento: string | null;
  fecha_servicio: string | null;
  matricula: string | null;
  origen: string | null;
  destino: string | null;
  notas: string | null;
  trip_id: string | null;
  shipment_id: string | null;
  service_id: string | null;
  pdf_path: string | null;
  pdf_bytes: number | null;
  pdf_fetched_at: string | null;
  pdf_fetch_error: string | null;
  fotos: string[];
  archivado: boolean;
  created_by: string | null;
  created_at: string;
  datos_extraidos?: ExtractedDocData | null;
  extraido_at?: string | null;
}

export interface ReceivedDocInput {
  tipo: ReceivedDocTipo;
  qr_text?: string | null;
  emisor_nombre?: string | null;
  numero_documento?: string | null;
  fecha_servicio?: string | null;
  matricula?: string | null;
  origen?: string | null;
  destino?: string | null;
  notas?: string | null;
  trip_id?: string | null;
  shipment_id?: string | null;
  service_id?: string | null;
}

export const RECEIVED_TIPO_LABEL: Record<ReceivedDocTipo, string> = {
  deca: 'DeCA del cargador',
  hoja_ruta: 'Hoja de ruta recibida',
  otro: 'Otro documento',
};

const BUCKET = 'transport-received-docs';

/** Si el texto del QR es una URL https válida la devuelve; si no, null. */
export function qrToUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  try {
    const u = new URL(t);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

/** Reduce una foto a máx. 1600 px y JPEG ~80 % (≈ 200-400 KB) para subirla rápido. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return await new Promise<Blob>(res => canvas.toBlob(b => res(b ?? file), 'image/jpeg', quality));
}

function newId(): string {
  return crypto.randomUUID();
}

async function uploadPhotos(orgId: string, docId: string, files: Blob[], start = 0): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const blob = await compressImage(files[i]);
    const path = `${orgId}/${docId}/foto-${Date.now()}-${start + i + 1}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`No se pudo subir la foto ${i + 1}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Guarda el documento (fotos primero) y pide al servidor la copia del PDF del QR. */
export async function saveReceivedDoc(orgId: string, input: ReceivedDocInput, photos: Blob[]): Promise<{ doc: ReceivedDoc; pdf: boolean; pdfError?: string }> {
  const id = newId();
  const qrText = input.qr_text?.trim() || null;
  if (!qrText && photos.length === 0) throw new Error('Escanee el QR o haga al menos una foto del documento');
  const fotos = photos.length ? await uploadPhotos(orgId, id, photos) : [];
  const clean = (v?: string | null) => (v && v.trim()) ? v.trim() : null;
  const row = {
    id, org_id: orgId, tipo: input.tipo,
    qr_text: qrText, qr_url: qrToUrl(qrText),
    emisor_nombre: clean(input.emisor_nombre), numero_documento: clean(input.numero_documento),
    fecha_servicio: input.fecha_servicio || null, matricula: clean(input.matricula)?.toUpperCase().replace(/[\s-]/g, '') ?? null,
    origen: clean(input.origen), destino: clean(input.destino), notas: clean(input.notas),
    trip_id: input.trip_id ?? null, shipment_id: input.shipment_id ?? null, service_id: input.service_id ?? null,
    fotos,
  };
  const { data, error } = await supabase.from('trade_transport_received_docs').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  let doc = data as ReceivedDoc;
  if (!doc.qr_url) return { doc, pdf: false };
  const r = await fetchReceivedPdf(orgId, id);
  if (r.pdf) {
    const fresh = await loadReceivedDoc(orgId, id);
    if (fresh) doc = fresh;
  }
  return { doc, pdf: r.pdf, pdfError: r.error };
}

export async function fetchReceivedPdf(orgId: string, id: string): Promise<{ pdf: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('trade-transport-received-doc', { body: { org_id: orgId, id } });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') { try { msg = (await ctx.json()).error ?? msg; } catch { /* sin cuerpo */ } }
    return { pdf: false, error: msg };
  }
  return { pdf: !!data?.pdf, error: data?.error };
}

export async function addReceivedPhotos(orgId: string, doc: ReceivedDoc, photos: Blob[]): Promise<ReceivedDoc> {
  const nuevas = await uploadPhotos(orgId, doc.id, photos, doc.fotos.length);
  const { data, error } = await supabase.from('trade_transport_received_docs')
    .update({ fotos: [...doc.fotos, ...nuevas] }).eq('id', doc.id).eq('org_id', orgId).select('*').single();
  if (error) throw new Error(error.message);
  return data as ReceivedDoc;
}

export async function loadReceivedDocs(orgId: string, opts: { archivados?: boolean; shipmentId?: string } = {}): Promise<ReceivedDoc[]> {
  let q = supabase.from('trade_transport_received_docs').select('*').eq('org_id', orgId)
    .eq('archivado', !!opts.archivados).order('created_at', { ascending: false }).limit(200);
  if (opts.shipmentId) q = q.eq('shipment_id', opts.shipmentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReceivedDoc[];
}

export async function loadReceivedDoc(orgId: string, id: string): Promise<ReceivedDoc | null> {
  const { data } = await supabase.from('trade_transport_received_docs').select('*').eq('org_id', orgId).eq('id', id).maybeSingle();
  return (data as ReceivedDoc) ?? null;
}

export async function setReceivedArchived(orgId: string, id: string, archivado: boolean): Promise<void> {
  const { error } = await supabase.from('trade_transport_received_docs').update({ archivado }).eq('id', id).eq('org_id', orgId);
  if (error) throw new Error(error.message);
}

/** Solo el mismo día y por quien lo creó (para corregir errores). */
export async function deleteReceivedDoc(orgId: string, id: string): Promise<void> {
  const { error, count } = await supabase.from('trade_transport_received_docs').delete({ count: 'exact' }).eq('id', id).eq('org_id', orgId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error('Solo se puede borrar el mismo día y por quien lo guardó. Puede archivarlo.');
}

export async function signedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No se pudo abrir el archivo');
  return data.signedUrl;
}

export async function signedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw new Error(error.message);
  return (data ?? []).map(d => d.signedUrl ?? '');
}

// ── TX-DOCS-3: lectura automática con IA ─────────────────────────────────────

export interface ExtractedDocData {
  tipo_documento: 'deca' | 'hoja_ruta' | 'otro';
  numero?: string | null;
  fecha_transporte?: string | null;
  hora_salida?: string | null;
  cargador_nombre?: string | null;
  cargador_nif?: string | null;
  cargador_domicilio?: string | null;
  transportista_nombre?: string | null;
  transportista_nif?: string | null;
  origen?: string | null;
  destino?: string | null;
  paradas?: string[];
  naturaleza_mercancia?: string | null;
  peso_kg?: number | null;
  otra_magnitud?: string | null;
  num_bultos?: number | null;
  matricula_vehiculo?: string | null;
  matricula_remolque?: string | null;
  conductor_nombre?: string | null;
  conductor_nif?: string | null;
  observaciones?: string | null;
  confianza: 'alta' | 'media' | 'baja';
  campos_dudosos: string[];
}

/** La IA lee el PDF guardado (o las fotos) y devuelve los datos. Hay que revisarlos siempre. */
export async function extractReceivedData(orgId: string, id: string): Promise<ExtractedDocData> {
  const { data, error } = await supabase.functions.invoke('trade-transport-received-doc', { body: { org_id: orgId, id, action: 'extract' } });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') { try { msg = (await ctx.json()).error ?? msg; } catch { /* sin cuerpo */ } }
    throw new Error(msg);
  }
  return data.datos as ExtractedDocData;
}

export async function linkReceivedToShipment(orgId: string, id: string, shipmentId: string): Promise<void> {
  const { error } = await supabase.from('trade_transport_received_docs').update({ shipment_id: shipmentId }).eq('id', id).eq('org_id', orgId);
  if (error) throw new Error(error.message);
}

const normNif = (v?: string | null) => (v ?? '').toUpperCase().replace(/[\s.-]/g, '');

/**
 * Convierte lo leído del documento en datos de expedición.
 * Si el NIF del cargador coincide con un cliente, se vincula a ese cliente.
 */
export function shipmentPrefillFromExtracted(
  d: ExtractedDocData,
  clients: { id: string; nif?: string | null }[] = [],
): {
  client_id: string | null; cargador_nombre: string; cargador_nif: string | null; cargador_domicilio: string | null;
  origen: string; destino: string; fecha_recogida: string | null; hora_recogida: string | null;
  naturaleza: string; peso_kg: number | null; num_bultos: number | null; referencia_cargador: string | null;
  observaciones: string | null;
} {
  const nif = normNif(d.cargador_nif) || null;
  const cliente = nif ? clients.find(c => normNif(c.nif) === nif) : undefined;
  const fecha = d.fecha_transporte && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_transporte) ? d.fecha_transporte : null;
  const hora = d.hora_salida && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.hora_salida) ? d.hora_salida : null;
  const obs = [
    d.otra_magnitud ? `Cantidad: ${d.otra_magnitud}` : '',
    d.paradas?.length ? `Paradas: ${d.paradas.join(' → ')}` : '',
    d.observaciones ?? '',
  ].filter(Boolean).join(' · ');
  return {
    client_id: cliente?.id ?? null,
    cargador_nombre: d.cargador_nombre?.trim() ?? '',
    cargador_nif: nif,
    cargador_domicilio: d.cargador_domicilio?.trim() || null,
    origen: d.origen?.trim() ?? '',
    destino: d.destino?.trim() ?? '',
    fecha_recogida: fecha,
    hora_recogida: hora,
    naturaleza: d.naturaleza_mercancia?.trim() ?? '',
    peso_kg: typeof d.peso_kg === 'number' && d.peso_kg > 0 ? d.peso_kg : null,
    num_bultos: typeof d.num_bultos === 'number' && d.num_bultos > 0 ? d.num_bultos : null,
    referencia_cargador: d.numero?.trim() || null,
    observaciones: obs || null,
  };
}
