/**
 * TX-EXP-1 — Expediciones (cargas) de transporte de mercancías.
 * Una expedición es un envío de un cargador: pendiente → recogida → entregada.
 * Puede asignarse a un viaje y generar su DeCA.
 */
import { supabase } from './supabase';
import { TIPO_CARGA_OPTIONS, type TipoCarga } from './transportTrips';

export type ShipmentEstado = 'pendiente' | 'recogida' | 'entregada' | 'incidencia' | 'cancelada';

export const SHIPMENT_ESTADOS: { value: ShipmentEstado; label: string; color: string }[] = [
  { value: 'pendiente',  label: 'Pendiente',   color: 'bg-slate-100 text-slate-700' },
  { value: 'recogida',   label: 'En tránsito', color: 'bg-blue-100 text-blue-700' },
  { value: 'entregada',  label: 'Entregada',   color: 'bg-emerald-100 text-emerald-700' },
  { value: 'incidencia', label: 'Incidencia',  color: 'bg-amber-100 text-amber-800' },
  { value: 'cancelada',  label: 'Cancelada',   color: 'bg-red-100 text-red-700' },
];

export function shipmentEstadoMeta(e: ShipmentEstado) {
  return SHIPMENT_ESTADOS.find(x => x.value === e) ?? SHIPMENT_ESTADOS[0];
}

export function tipoCargaLabel(t: string): string {
  return TIPO_CARGA_OPTIONS.find(o => o.value === t)?.label ?? t;
}

export interface TradeTransportShipment {
  id: string;
  org_id: string;
  referencia: string | null;
  trip_id: string | null;
  client_id: string | null;
  cargador_nombre: string;
  cargador_nif: string | null;
  cargador_domicilio: string | null;
  destinatario_nombre: string | null;
  destinatario_telefono: string | null;
  origen: string;
  destino: string;
  fecha_recogida: string;      // YYYY-MM-DD
  hora_recogida: string | null;
  naturaleza: string;
  tipo_carga: TipoCarga;
  peso_kg: number | null;
  num_bultos: number | null;
  volumen_m3: number | null;
  referencia_cargador: string | null;
  estado: ShipmentEstado;
  recogida_at: string | null;
  entregada_at: string | null;
  receptor_nombre: string | null;
  incidencia: string | null;
  observaciones: string | null;
  /** Precio pactado con el cargador (grupaje: se factura por expedición). */
  precio_acordado?: number | null;
  // ── Prueba de entrega (TX-CIERRE-1) ──
  receptor_dni?: string | null;
  firma_path?: string | null;
  fotos?: string[];
  entrega_lat?: number | null;
  entrega_lng?: number | null;
  entregada_por?: string | null;
  created_at: string;
  updated_at: string;
}

export type ShipmentInput = Omit<TradeTransportShipment,
  'id' | 'org_id' | 'referencia' | 'estado' | 'recogida_at' | 'entregada_at' | 'receptor_nombre' | 'incidencia' | 'created_at' | 'updated_at'
  | 'receptor_dni' | 'firma_path' | 'fotos' | 'entrega_lat' | 'entrega_lng' | 'entregada_por'>;

export function emptyShipmentInput(fecha: string): ShipmentInput {
  return {
    trip_id: null, client_id: null,
    cargador_nombre: '', cargador_nif: null, cargador_domicilio: null,
    destinatario_nombre: null, destinatario_telefono: null,
    origen: '', destino: '', fecha_recogida: fecha, hora_recogida: null,
    naturaleza: '', tipo_carga: 'carga_general',
    peso_kg: null, num_bultos: null, volumen_m3: null, referencia_cargador: null,
    observaciones: null, precio_acordado: null,
  };
}

/** Devuelve el primer error de validación o null. */
export function validateShipment(i: Partial<ShipmentInput>): string | null {
  if (!i.cargador_nombre?.trim()) return 'Indique el cargador (quién le contrata el porte)';
  if (!i.origen?.trim()) return 'Indique el lugar de recogida';
  if (!i.destino?.trim()) return 'Indique el lugar de entrega';
  if (!i.fecha_recogida) return 'Indique la fecha de recogida';
  if (!i.naturaleza?.trim()) return 'Indique qué mercancía es';
  if (i.peso_kg != null && (i.peso_kg < 0 || i.peso_kg > 100000)) return 'El peso no es válido';
  if (i.num_bultos != null && i.num_bultos < 0) return 'El número de bultos no es válido';
  if (i.precio_acordado != null && (!Number.isFinite(i.precio_acordado) || i.precio_acordado < 0)) return 'El precio no es válido';
  return null;
}

function clean(i: Partial<ShipmentInput>): Partial<ShipmentInput> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(i)) out[k] = typeof v === 'string' ? (v.trim() || null) : v;
  if (!out.hora_recogida) out.hora_recogida = null;
  return out as Partial<ShipmentInput>;
}

export async function loadShipments(orgId: string, opts: { tripId?: string } = {}): Promise<TradeTransportShipment[]> {
  let q = supabase.from('trade_transport_shipments').select('*').eq('org_id', orgId)
    .order('fecha_recogida', { ascending: false }).order('created_at', { ascending: false }).limit(300);
  if (opts.tripId) q = q.eq('trip_id', opts.tripId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TradeTransportShipment[];
}

export async function createShipment(orgId: string, input: ShipmentInput): Promise<TradeTransportShipment> {
  const err = validateShipment(input);
  if (err) throw new Error(err);
  const { data, error } = await supabase.from('trade_transport_shipments')
    .insert({ ...clean(input), org_id: orgId }).select('*').single();
  if (error) throw new Error(error.message);
  return data as TradeTransportShipment;
}

export async function updateShipment(orgId: string, id: string, patch: Partial<TradeTransportShipment>): Promise<TradeTransportShipment> {
  const { data, error } = await supabase.from('trade_transport_shipments')
    .update(clean(patch as Partial<ShipmentInput>)).eq('id', id).eq('org_id', orgId).select('*').single();
  if (error) throw new Error(error.message);
  return data as TradeTransportShipment;
}

export const markPicked    = (orgId: string, id: string) => updateShipment(orgId, id, { estado: 'recogida' });
export const markDelivered = (orgId: string, id: string, receptor: string) =>
  updateShipment(orgId, id, { estado: 'entregada', receptor_nombre: receptor || null });
export const markIncident  = (orgId: string, id: string, texto: string) =>
  updateShipment(orgId, id, { estado: 'incidencia', incidencia: texto });
export const cancelShipment = (orgId: string, id: string) => updateShipment(orgId, id, { estado: 'cancelada' });
export const assignTrip    = (orgId: string, id: string, tripId: string | null) => updateShipment(orgId, id, { trip_id: tripId });

// ── Prueba de entrega (firma, fotos, DNI y posición) ─────────────────────────

export const POD_BUCKET = 'transport-pod';

export interface DeliveryProof {
  receptor: string;
  dni?: string | null;
  firma?: Blob | null;
  fotos?: Blob[];
  lat?: number | null;
  lng?: number | null;
}

/** Reduce una foto a un JPEG de 1600 px como máximo (las del móvil pesan varios MB). */
export async function compressPhoto(file: Blob, max = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    return out ?? file;
  } catch {
    return file;
  }
}

async function uploadPod(orgId: string, shipmentId: string, blob: Blob, nombre: string): Promise<string> {
  const path = `${orgId}/${shipmentId}/${Date.now()}-${nombre}`;
  const { error } = await supabase.storage.from(POD_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg', upsert: false,
  });
  if (error) throw new Error('No se pudo guardar la prueba de entrega: ' + error.message);
  return path;
}

/** Marca la expedición como entregada con su prueba de entrega. */
export async function markDeliveredWithProof(orgId: string, id: string, proof: DeliveryProof): Promise<TradeTransportShipment> {
  if (!proof.receptor.trim()) throw new Error('Indique el nombre de quien recibe');
  const firma_path = proof.firma ? await uploadPod(orgId, id, proof.firma, 'firma.png') : null;
  const fotos: string[] = [];
  for (const [i, f] of (proof.fotos ?? []).slice(0, 4).entries()) {
    fotos.push(await uploadPod(orgId, id, await compressPhoto(f), `foto-${i + 1}.jpg`));
  }
  return updateShipment(orgId, id, {
    estado: 'entregada',
    receptor_nombre: proof.receptor.trim(),
    receptor_dni: proof.dni?.trim().toUpperCase() || null,
    firma_path, fotos,
    entrega_lat: proof.lat ?? null, entrega_lng: proof.lng ?? null,
  });
}

/** Enlace temporal (10 min) para ver un archivo de la prueba de entrega. */
export async function podSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(POD_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export function hasDeliveryProof(s: TradeTransportShipment): boolean {
  return !!(s.firma_path || (s.fotos && s.fotos.length) || s.receptor_dni);
}

export function canEditShipment(s: TradeTransportShipment) { return s.estado === 'pendiente'; }
export function canPick(s: TradeTransportShipment) { return s.estado === 'pendiente' || s.estado === 'incidencia'; }
export function canDeliver(s: TradeTransportShipment) { return s.estado === 'recogida' || s.estado === 'incidencia' || s.estado === 'pendiente'; }
