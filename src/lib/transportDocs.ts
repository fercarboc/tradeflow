/**
 * Documentos de control administrativo en transporte (TX-DOCS-1).
 *   · DeCA de mercancías       — Orden FOM/2861/2012
 *   · Hoja de ruta de viajeros — Orden FOM/1230/2013
 * Formato electrónico — Resolución DGTCF 5-jun-2026 (BOE-A-2026-12784).
 *
 * Toda escritura pasa por la Edge Function `trade-transport-doc`.
 * La lectura se hace directamente (RLS: miembros de la org).
 */
import { supabase } from './supabase';

export type TransportDocTipo = 'deca' | 'hoja_ruta';
export type TransportDocEstado = 'vigente' | 'sustituido' | 'anulado';
export type NaturalezaServicio = 'discrecional' | 'refuerzo_regular' | 'colaboracion_regular_especial' | 'turistico';

export interface TransportDocParada { nombre: string; hora?: string | null }

export interface TransportControlDoc {
  id: string;
  org_id: string;
  tipo: TransportDocTipo;
  numero: string;
  estado: TransportDocEstado;
  public_token: string;
  service_id: string | null;
  trip_id: string | null;
  vehicle_id: string | null;
  conductor_id: string | null;
  client_id: string | null;
  transportista_nombre: string;
  transportista_nif: string;
  transportista_domicilio: string | null;
  cargador_nombre: string;
  cargador_nif: string | null;
  cargador_domicilio: string | null;
  origen: string;
  destino: string;
  paradas: TransportDocParada[];
  fecha_servicio: string;
  hora_salida: string | null;
  fecha_fin: string | null;
  naturaleza_mercancia: string | null;
  peso_kg: number | null;
  otra_magnitud: string | null;
  autorizacion_especial: string | null;
  matricula_remolque: string | null;
  matricula_vehiculo: string;
  conductor_nombre: string | null;
  conductor_nif: string | null;
  naturaleza_servicio: NaturalezaServicio | null;
  servicio_referencia: string | null;
  observaciones: string | null;
  sustituye_a: string | null;
  motivo_modificacion: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  pdf_path: string | null;
  pdf_sha256: string | null;
  shipment_id?: string | null;
  public_hasta: string;
  created_at: string;
}

/** Datos que envía el asistente. El transportista lo pone siempre el servidor (la empresa). */
export interface TransportDocInput {
  cargador_nombre: string;
  cargador_nif?: string | null;
  cargador_domicilio?: string | null;
  origen: string;
  destino: string;
  paradas?: TransportDocParada[];
  fecha_servicio: string;   // YYYY-MM-DD
  hora_salida?: string | null;
  fecha_fin?: string | null; // ISO
  naturaleza_mercancia?: string | null;
  peso_kg?: number | null;
  otra_magnitud?: string | null;
  autorizacion_especial?: string | null;
  matricula_vehiculo: string;
  matricula_remolque?: string | null;
  conductor_nombre?: string | null;
  conductor_nif?: string | null;
  naturaleza_servicio?: NaturalezaServicio | null;
  servicio_referencia?: string | null;
  observaciones?: string | null;
  vehicle_id?: string | null;
  conductor_id?: string | null;
  client_id?: string | null;
  service_id?: string | null;
  trip_id?: string | null;
  shipment_id?: string | null;
}

export const NATURALEZA_SERVICIO_OPCIONES: { value: NaturalezaServicio; label: string; hint: string }[] = [
  { value: 'discrecional', label: 'Discrecional', hint: 'Viaje contratado por un cliente (excursión, boda, empresa)' },
  { value: 'refuerzo_regular', label: 'Refuerzo de línea regular', hint: 'Autocar extra para una línea regular de uso general' },
  { value: 'colaboracion_regular_especial', label: 'Colaboración en regular especial', hint: 'Ayuda en un transporte escolar o de trabajadores' },
  { value: 'turistico', label: 'Turístico', hint: 'Viaje turístico organizado' },
];

export const NATURALEZA_SERVICIO_LABEL: Record<NaturalezaServicio, string> =
  Object.fromEntries(NATURALEZA_SERVICIO_OPCIONES.map(o => [o.value, o.label])) as Record<NaturalezaServicio, string>;

export const MERCANCIAS_FRECUENTES = [
  'Fruta y verdura', 'Material de obra', 'Paquetería', 'Bebidas', 'Aceite', 'Madera',
  'Congelados', 'Muebles', 'Vehículos', 'Alimentación', 'Ganado', 'Áridos',
];

// ── Validaciones (mismas reglas que el servidor) ─────────────────────────────

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function normalizeNif(raw: string): string {
  return raw.toUpperCase().replace(/[\s.-]/g, '');
}

/** DNI, NIE o CIF español con dígito de control. */
export function isValidSpanishNif(raw: string): boolean {
  const v = normalizeNif(raw);
  if (/^\d{8}[A-Z]$/.test(v)) return DNI_LETTERS[parseInt(v.slice(0, 8), 10) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = 'XYZ'.indexOf(v[0]) + v.slice(1, 8);
    return DNI_LETTERS[parseInt(n, 10) % 23] === v[8];
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(v)) return DNI_LETTERS[parseInt(v.slice(1, 8), 10) % 23] === v[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      let d = parseInt(v[i + 1], 10);
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    const ctrl = (10 - (sum % 10)) % 10;
    const last = v[8];
    if (/[PQRSNW]/.test(v[0])) return last === 'JABCDEFGHI'[ctrl];
    if (/[ABEH]/.test(v[0])) return last === String(ctrl);
    return last === String(ctrl) || last === 'JABCDEFGHI'[ctrl];
  }
  return false;
}

/** Acepta NIF español o NIF extranjero con prefijo de país (p. ej. PT123456789). */
export function isValidNif(raw: string): boolean {
  const v = normalizeNif(raw);
  if (isValidSpanishNif(v)) return true;
  if (v.startsWith('ES')) return isValidSpanishNif(v.slice(2));
  return /^[A-Z]{2}[A-Z0-9]{4,14}$/.test(v);
}

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidPlate(raw: string): boolean {
  return /^[A-Z0-9]{4,10}$/.test(normalizePlate(raw));
}

// ── Fechas (hora peninsular) ─────────────────────────────────────────────────

export function madridToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function madridNowHHMM(): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export function fmtFechaEs(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtPesoKg(kg: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(kg) + ' kg';
}

// ── URL pública ──────────────────────────────────────────────────────────────

const PUBLIC_BASE = ((import.meta.env.VITE_TRANSPORT_DOC_PUBLIC_BASE as string | undefined) ?? 'https://trabflow.com/d').replace(/\/+$/, '');

export function publicDocUrl(token: string): string {
  return `${PUBLIC_BASE}/${token}`;
}

export function isPublicLinkActive(doc: Pick<TransportControlDoc, 'estado' | 'public_hasta'>): boolean {
  return doc.estado === 'vigente' && new Date(doc.public_hasta).getTime() > Date.now();
}

// ── API ──────────────────────────────────────────────────────────────────────

export class TransportDocError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('trade-transport-doc', { body });
  if (error) {
    // FunctionsHttpError: el cuerpo trae { error, code }
    let msg = error.message || 'Error al contactar con el servidor';
    let code: string | undefined;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j.error ?? msg; code = j.code; } catch { /* sin cuerpo */ }
    }
    throw new TransportDocError(msg, code);
  }
  return data as T;
}

export interface EmitResult { ok: true; id: string; numero: string; public_url: string; public_hasta: string; pdf_sha256: string }

export function emitTransportDoc(
  orgId: string,
  tipo: TransportDocTipo,
  datos: TransportDocInput,
  opts: { sustituyeA?: string; motivo?: string } = {},
): Promise<EmitResult> {
  return invoke<EmitResult>({
    action: 'emitir', org_id: orgId, tipo, datos,
    sustituye_a: opts.sustituyeA, motivo_modificacion: opts.motivo,
  });
}

export function cancelTransportDoc(orgId: string, id: string, motivo: string): Promise<{ ok: true }> {
  return invoke({ action: 'anular', org_id: orgId, id, motivo });
}

export async function reverseGeocode(orgId: string, lat: number, lng: number): Promise<string | null> {
  const r = await invoke<{ ok: true; address: string | null }>({ action: 'reverse_geocode', org_id: orgId, lat, lng });
  return r.address;
}

export async function loadTransportDocs(
  orgId: string,
  opts: { tipo?: TransportDocTipo; limit?: number } = {},
): Promise<TransportControlDoc[]> {
  let q = supabase.from('trade_transport_control_docs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.tipo) q = q.eq('tipo', opts.tipo);
  const { data, error } = await q;
  if (error) throw new TransportDocError(error.message);
  return (data ?? []) as TransportControlDoc[];
}

export async function loadTransportDoc(orgId: string, id: string): Promise<TransportControlDoc | null> {
  const { data, error } = await supabase.from('trade_transport_control_docs')
    .select('*').eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw new TransportDocError(error.message);
  return (data as TransportControlDoc) ?? null;
}

/** URL firmada (60 min) para ver/descargar el PDF desde la app, también tras caducar el enlace público. */
export async function getTransportDocPdfUrl(doc: Pick<TransportControlDoc, 'pdf_path' | 'numero'>, download = false): Promise<string> {
  if (!doc.pdf_path) throw new TransportDocError('El PDF todavía no está disponible');
  const { data, error } = await supabase.storage.from('transport-control-docs')
    .createSignedUrl(doc.pdf_path, 3600, download ? { download: `${doc.numero}.pdf` } : undefined);
  if (error || !data?.signedUrl) throw new TransportDocError(error?.message ?? 'No se pudo abrir el PDF');
  return data.signedUrl;
}

/** Datos de la empresa necesarios para emitir (transportista efectivo). */
export async function loadOrgTransportista(orgId: string): Promise<{ nombre: string; nif: string | null; direccion: string | null }> {
  const { data } = await supabase.from('trade_organizations')
    .select('nombre, nif, direccion').eq('id', orgId).maybeSingle();
  return { nombre: data?.nombre ?? '', nif: data?.nif ?? null, direccion: data?.direccion ?? null };
}

/** Texto para compartir por WhatsApp con el conductor o el cargador. */
export function shareText(doc: Pick<TransportControlDoc, 'tipo' | 'numero' | 'origen' | 'destino' | 'fecha_servicio' | 'matricula_vehiculo' | 'public_token'>): string {
  const t = doc.tipo === 'deca' ? 'DeCA' : 'Hoja de ruta';
  return `${t} ${doc.numero}\n${doc.origen} → ${doc.destino}\n${fmtFechaEs(doc.fecha_servicio)} · ${doc.matricula_vehiculo}\n${publicDocUrl(doc.public_token)}`;
}

// ── Rellenos automáticos desde viajes y expediciones ─────────────────────────

/** Fecha (YYYY-MM-DD) y hora (HH:MM) peninsulares de un instante ISO. */
export function madridDateTime(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    hora: new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
  };
}

interface TripLike {
  id: string; origen: string; destino: string; fecha_inicio: string;
  vehicle_id?: string | null; conductor_id?: string | null;
  peso_kg?: number | null; cliente_nombre?: string | null; observaciones?: string | null;
}
interface VehicleLike { id: string; matricula: string }
interface WorkerLike { id: string; nombre: string; nif?: string | null }

/** DeCA a partir de un viaje de mercancías (el cargador y su NIF se completan en el asistente). */
export function decaPrefillFromTrip(trip: TripLike, vehicle?: VehicleLike | null, conductor?: WorkerLike | null, naturaleza?: string): Partial<TransportDocInput> {
  const { fecha, hora } = madridDateTime(trip.fecha_inicio);
  return {
    trip_id: trip.id,
    origen: trip.origen, destino: trip.destino,
    fecha_servicio: fecha, hora_salida: hora,
    cargador_nombre: trip.cliente_nombre ?? '',
    peso_kg: trip.peso_kg ?? null,
    naturaleza_mercancia: naturaleza ?? null,
    vehicle_id: vehicle?.id ?? trip.vehicle_id ?? null,
    matricula_vehiculo: vehicle?.matricula ?? '',
    conductor_id: conductor?.id ?? trip.conductor_id ?? null,
    conductor_nombre: conductor?.nombre ?? null,
    conductor_nif: conductor?.nif ?? null,
  };
}

interface ShipmentLike {
  id: string; trip_id: string | null; client_id: string | null;
  cargador_nombre: string; cargador_nif: string | null; cargador_domicilio: string | null;
  destinatario_nombre: string | null;
  origen: string; destino: string; fecha_recogida: string; hora_recogida: string | null;
  naturaleza: string; peso_kg: number | null; num_bultos: number | null; referencia_cargador: string | null;
  observaciones: string | null;
}

/** DeCA a partir de una expedición (y del viaje al que va asignada, si lo hay). */
export function decaPrefillFromShipment(sh: ShipmentLike, trip?: TripLike | null, vehicle?: VehicleLike | null, conductor?: WorkerLike | null): Partial<TransportDocInput> {
  const base = trip ? decaPrefillFromTrip(trip, vehicle, conductor) : {};
  const obs = [
    sh.destinatario_nombre ? `Destinatario: ${sh.destinatario_nombre}` : '',
    sh.num_bultos ? `${sh.num_bultos} bultos` : '',
    sh.referencia_cargador ? `Ref. cargador: ${sh.referencia_cargador}` : '',
    sh.observaciones ?? '',
  ].filter(Boolean).join(' · ');
  return {
    ...base,
    shipment_id: sh.id,
    client_id: sh.client_id,
    cargador_nombre: sh.cargador_nombre,
    cargador_nif: sh.cargador_nif,
    cargador_domicilio: sh.cargador_domicilio,
    origen: sh.origen, destino: sh.destino,
    fecha_servicio: sh.fecha_recogida,
    hora_salida: sh.hora_recogida?.slice(0, 5) ?? base.hora_salida ?? null,
    naturaleza_mercancia: sh.naturaleza,
    peso_kg: sh.peso_kg,
    observaciones: obs || null,
  };
}
