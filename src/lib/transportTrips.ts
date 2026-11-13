/**
 * transportTrips.ts — Viajes de mercancías
 * TX-MC-1: gestión operativa de viajes de transporte de mercancías.
 * Entidad separada de trade_transport_services (Viajeros).
 * Solo vehículos con modalidad mercancias/reparto/mixto.
 */

import { supabase } from './supabase';
import type { TransportLocation } from './transportLocations';

// ── Catálogos ─────────────────────────────────────────────────────────────────

export const TIPO_CARGA_OPTIONS = [
  { value: 'paletizado',    label: 'Paletizado' },
  { value: 'carga_general', label: 'Carga general' },
  { value: 'frigorifica',   label: 'Frigorífica / Refrigerada' },
  { value: 'peligrosas',    label: 'Mercancías peligrosas (ADR)' },
  { value: 'especial',      label: 'Carga especial / Indivisible' },
  { value: 'otro',          label: 'Otro' },
] as const;

export const TRIP_ESTADOS = [
  { value: 'borrador',   label: 'Borrador',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'en_curso',   label: 'En curso',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'completado', label: 'Completado', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'cancelado',  label: 'Cancelado',  color: 'bg-red-100 text-red-600 border-red-200' },
] as const;

export const TIPO_CARGA_COLORS: Record<string, string> = {
  paletizado:    'bg-amber-100 text-amber-700 border-amber-200',
  carga_general: 'bg-slate-100 text-slate-600 border-slate-200',
  frigorifica:   'bg-sky-100 text-sky-700 border-sky-200',
  peligrosas:    'bg-red-100 text-red-700 border-red-200',
  especial:      'bg-violet-100 text-violet-700 border-violet-200',
  otro:          'bg-gray-100 text-gray-600 border-gray-200',
};

export type TipoCarga = typeof TIPO_CARGA_OPTIONS[number]['value'];
export type TripEstado = typeof TRIP_ESTADOS[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TradeTransportTrip {
  id: string;
  org_id: string;
  referencia?: string | null;
  titulo: string;
  origen: string;
  destino: string;
  fecha_inicio: string;   // ISO 8601 timestamptz
  fecha_fin?: string | null;
  vehicle_id?: string | null;
  conductor_id?: string | null;
  tipo_carga: TipoCarga;
  peso_kg?: number | null;
  volumen_m3?: number | null;
  num_bultos?: number | null;
  precio_acordado?: number | null;
  cliente_nombre?: string | null;
  /** TX-FACT-1: ficha de cliente vinculada (se rellena al facturar) */
  client_id?: string | null;
  observaciones?: string | null;
  estado: TripEstado;
  // Parte real
  hora_real_salida?: string | null;
  hora_real_llegada?: string | null;
  km_inicio?: number | null;
  km_fin?: number | null;
  km_realizados?: number | null;   // columna generada
  incidencias?: string | null;
  observaciones_cierre?: string | null;
  cerrado_at?: string | null;
  cerrado_por?: string | null;
  // Odómetro
  odometro_inicio?: number | null;
  odometro_final?: number | null;
  // Geo (añadidos con migración trip_geo_detalle)
  origen_detalle?:  TransportLocation | null;
  destino_detalle?: TransportLocation | null;
  // Auditoría
  created_at: string;
  updated_at: string;
}

export type TradeTransportTripInput = Omit<
  TradeTransportTrip,
  'id' | 'org_id' | 'km_realizados' | 'created_at' | 'updated_at'
>;

export interface TripConflictInfo {
  tipo: 'vehiculo' | 'conductor';
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  tabla: 'servicios' | 'viajes';
}

export interface TripParteInput {
  hora_real_salida?: string | null;
  hora_real_llegada?: string | null;
  km_inicio?: number | null;
  km_fin?: number | null;
  odometro_inicio?: number | null;
  odometro_final?: number | null;
  incidencias?: string | null;
  observaciones_cierre?: string | null;
}

// ── Validación ────────────────────────────────────────────────────────────────

export function validateTripInput(input: Partial<TradeTransportTripInput>): void {
  if (input.titulo !== undefined && (!input.titulo || input.titulo.trim() === '')) {
    throw new Error('El título del viaje es obligatorio');
  }
  if (input.origen !== undefined && (!input.origen || input.origen.trim() === '')) {
    throw new Error('El origen es obligatorio');
  }
  if (input.destino !== undefined && (!input.destino || input.destino.trim() === '')) {
    throw new Error('El destino es obligatorio');
  }
  if (!input.fecha_inicio) {
    throw new Error('La fecha de inicio es obligatoria');
  }
  if (input.fecha_fin) {
    const ini = new Date(input.fecha_inicio);
    const fin = new Date(input.fecha_fin);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime())) {
      throw new Error('Las fechas deben ser fechas válidas');
    }
    if (fin <= ini) {
      throw new Error('La fecha de finalización debe ser posterior a la de inicio');
    }
  }
  if (input.peso_kg !== null && input.peso_kg !== undefined) {
    if (input.peso_kg <= 0 || input.peso_kg > 50000) {
      throw new Error('El peso debe estar entre 0 y 50.000 kg');
    }
  }
  if (input.precio_acordado !== null && input.precio_acordado !== undefined) {
    if (input.precio_acordado < 0) {
      throw new Error('El precio acordado no puede ser negativo');
    }
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Crea un nuevo viaje de mercancías para la organización. */
export async function createTransportTrip(
  orgId: string,
  input: TradeTransportTripInput,
): Promise<TradeTransportTrip> {
  validateTripInput(input);

  const { data, error } = await supabase
    .from('trade_transport_trips')
    .insert([{
      ...input,
      org_id: orgId,
      titulo: input.titulo.trim(),
      origen: input.origen.trim(),
      destino: input.destino.trim(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data as TradeTransportTrip;
}

/** Actualiza un viaje existente. Solo puede tocarse si pertenece a la org. */
export async function updateTransportTrip(
  id: string,
  orgId: string,
  updates: Partial<TradeTransportTripInput>,
): Promise<TradeTransportTrip> {
  const patch = { ...updates };

  if (patch.titulo !== undefined) patch.titulo = patch.titulo!.trim();
  if (patch.origen !== undefined)  patch.origen = patch.origen!.trim();
  if (patch.destino !== undefined) patch.destino = patch.destino!.trim();

  if (patch.titulo !== undefined && patch.titulo === '') {
    throw new Error('El título del viaje es obligatorio');
  }
  if (patch.peso_kg !== null && patch.peso_kg !== undefined) {
    if (patch.peso_kg <= 0 || patch.peso_kg > 50000) {
      throw new Error('El peso debe estar entre 0 y 50.000 kg');
    }
  }

  const { data, error } = await supabase
    .from('trade_transport_trips')
    .update(patch)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as TradeTransportTrip;
}

/**
 * TX-CIERRE-1 — Presupuesto aceptado en una empresa de mercancías → viaje en
 * borrador (idempotente: si ya existe, devuelve el mismo viaje).
 */
export async function createTransportTripFromQuote(
  orgId: string,
  quoteId: string,
): Promise<{ ok: boolean; trip_id?: string; idempotent?: boolean; code?: string; message?: string }> {
  const { data, error } = await supabase.rpc('create_transport_trip_from_quote', {
    p_org_id: orgId,
    p_quote_id: quoteId,
  });
  if (error) throw error;
  return data as { ok: boolean; trip_id?: string; idempotent?: boolean; code?: string; message?: string };
}

/** Cancela un viaje (transición de estado controlada, sin borrado físico). */
export async function cancelTransportTrip(
  id: string,
  orgId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_transport_trips')
    .update({ estado: 'cancelado' })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

/**
 * Confirma un viaje de forma atómica, verificando solapamiento
 * también en trade_transport_services (orgs combinadas con vehículos mixto).
 * Retorna { ok: true } o { ok: false, conflictos: TripConflictInfo[] }.
 */
export async function confirmTransportTrip(
  id: string,
  orgId: string,
): Promise<{ ok: boolean; conflictos?: TripConflictInfo[] }> {
  const { data, error } = await supabase.rpc('confirm_transport_trip', {
    p_trip_id: id,
    p_org_id:  orgId,
  });
  if (error) throw error;
  const result = data as { ok: boolean; conflictos?: TripConflictInfo[] };
  return result;
}

/**
 * Inicia un viaje confirmado (confirmado → en_curso). TX-CIERRE-1: por RPC,
 * para que también pueda iniciarlo el conductor asignado, y con lectura
 * opcional del odómetro y hora real de salida.
 */
export async function startTransportTrip(
  id: string,
  orgId: string,
  odometroInicio?: number | null,
): Promise<void> {
  const { error } = await supabase.rpc('start_transport_trip', {
    p_trip_id: id,
    p_org_id: orgId,
    p_odometro_inicio: odometroInicio ?? null,
  });
  if (error) throw error;
}

/**
 * Completa un viaje con el parte real.
 * Llama al RPC complete_transport_trip para garantizar la transición atómica.
 */
export async function completeTransportTrip(
  id: string,
  orgId: string,
  parte: TripParteInput = {},
): Promise<void> {
  const { error } = await supabase.rpc('complete_transport_trip', {
    p_trip_id: id,
    p_org_id:  orgId,
    p_parte:   parte,
  });
  if (error) throw error;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Carga todos los viajes de la organización, más recientes primero. */
export async function loadTransportTrips(
  orgId: string,
  opts: {
    desde?: string;
    hasta?: string;
    estado?: TripEstado;
  } = {},
): Promise<TradeTransportTrip[]> {
  let q = supabase
    .from('trade_transport_trips')
    .select('*')
    .eq('org_id', orgId)
    .order('fecha_inicio', { ascending: false });

  if (opts.desde) q = q.gte('fecha_inicio', opts.desde);
  if (opts.hasta) q = q.lte('fecha_inicio', opts.hasta);
  if (opts.estado) q = q.eq('estado', opts.estado);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TradeTransportTrip[];
}

/** Carga los viajes del día indicado (por fecha_inicio). */
export async function loadTripsForDay(
  orgId: string,
  date: string,   // "YYYY-MM-DD"
): Promise<TradeTransportTrip[]> {
  const desde = `${date}T00:00:00`;
  const hasta = `${date}T23:59:59`;
  return loadTransportTrips(orgId, { desde, hasta });
}

/**
 * Carga todos los viajes que solapan con el rango UTC indicado.
 * Equivalente a loadServicesOverlappingRange pero para trade_transport_trips.
 * Condición: fecha_inicio <= hasta AND (fecha_fin >= desde OR fecha_fin IS NULL).
 * Usar toISOString() en los límites garantiza la interpretación UTC correcta por PostgREST.
 */
export async function loadTripsOverlappingRange(
  orgId: string,
  desde: string,   // UTC ISO (e.g. weekStart.toISOString())
  hasta: string,   // UTC ISO
): Promise<TradeTransportTrip[]> {
  const { data, error } = await supabase
    .from('trade_transport_trips')
    .select('*')
    .eq('org_id', orgId)
    .lte('fecha_inicio', hasta)
    .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeTransportTrip[];
}

/**
 * Carga todos los viajes que se solapan con el día indicado.
 * Incluye viajes que empezaron antes y terminan ese día (viajes nocturnos).
 */
export async function loadTripsOverlappingDay(
  orgId: string,
  date: string,   // "YYYY-MM-DD"
): Promise<TradeTransportTrip[]> {
  const dayStart = `${date}T00:00:00`;
  const dayEnd   = `${date}T23:59:59`;
  const { data, error } = await supabase
    .from('trade_transport_trips')
    .select('*')
    .eq('org_id', orgId)
    .lte('fecha_inicio', dayEnd)
    .or(`fecha_fin.gte.${dayStart},fecha_fin.is.null`)
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeTransportTrip[];
}

/** Carga un único viaje por id. */
export async function loadTransportTrip(
  id: string,
  orgId: string,
): Promise<TradeTransportTrip | null> {
  const { data, error } = await supabase
    .from('trade_transport_trips')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as TradeTransportTrip;
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

/** Devuelve el objeto de estado con label y color para un estado dado. */
export function getTripEstadoMeta(estado: TripEstado) {
  return TRIP_ESTADOS.find(e => e.value === estado) ?? TRIP_ESTADOS[0];
}

/** True si el viaje puede ser editado (no está completado ni cancelado). */
export function isTripEditable(estado: TripEstado): boolean {
  return estado === 'borrador' || estado === 'confirmado';
}

/** True si el viaje puede confirmarse. */
export function canConfirmTrip(estado: TripEstado): boolean {
  return estado === 'borrador';
}

/** True si el viaje puede iniciarse (en_curso). */
export function canStartTrip(estado: TripEstado): boolean {
  return estado === 'confirmado';
}

/** True si el viaje puede completarse. */
export function canCompleteTrip(estado: TripEstado): boolean {
  return estado === 'en_curso';
}

/** True si el viaje puede cancelarse. */
export function canCancelTrip(estado: TripEstado): boolean {
  return estado !== 'completado' && estado !== 'cancelado';
}
