/**
 * transportServices.ts — Servicios puntuales de transporte
 * TRANSPORT-T1-A: gestión real de servicios de viajeros por organización.
 * Sin facturación automática, sin contratos recurrentes, sin parte firmado (T1-C).
 */

import { supabase } from './supabase';
import type { TransportLocation, TransportContact, TipoOperacionParada } from './transportLocations';
export type { TransportLocation, TransportContact, TipoOperacionParada } from './transportLocations';

// ── Catálogos ─────────────────────────────────────────────────────────────────

// Catálogo activo (12 tipos comerciales). El valor 'traslado_empresa' es heredado:
// válido en DB y renderizado en badges, pero no aparece en este selector de UI.
export const TIPO_SERVICIO_OPTIONS = [
  { value: 'excursion',               label: 'Excursión' },
  { value: 'circuito',                label: 'Circuito turístico' },
  { value: 'viaje_multidia',          label: 'Viaje de varios días' },
  { value: 'ruta_escolar',            label: 'Transporte escolar' },
  { value: 'transporte_trabajadores', label: 'Transporte de trabajadores' },
  { value: 'traslado_privado',        label: 'Traslado privado' },
  { value: 'aeropuerto',              label: 'Aeropuerto / Estación / Puerto' },
  { value: 'lanzadera',               label: 'Lanzadera' },
  { value: 'congreso_evento',         label: 'Congresos y eventos' },
  { value: 'servicio_deportivo',      label: 'Servicio deportivo' },
  { value: 'asociacion_grupo',        label: 'Asociaciones y grupos' },
  { value: 'otro',                    label: 'Otro' },
] as const;

export const SERVICIO_ESTADOS = [
  { value: 'borrador',    label: 'Borrador',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'confirmado',  label: 'Confirmado',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'en_curso',    label: 'En curso',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'completado',  label: 'Completado',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'cancelado',   label: 'Cancelado',   color: 'bg-red-100 text-red-600 border-red-200' },
] as const;

export const TIPO_SERVICIO_COLORS: Record<string, string> = {
  // Valores activos
  excursion:               'bg-indigo-100 text-indigo-700 border-indigo-200',
  circuito:                'bg-blue-100 text-blue-700 border-blue-200',
  viaje_multidia:          'bg-sky-100 text-sky-700 border-sky-200',
  ruta_escolar:            'bg-yellow-100 text-yellow-700 border-yellow-200',
  transporte_trabajadores: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  traslado_privado:        'bg-pink-100 text-pink-700 border-pink-200',
  aeropuerto:              'bg-violet-100 text-violet-700 border-violet-200',
  lanzadera:               'bg-teal-100 text-teal-700 border-teal-200',
  congreso_evento:         'bg-amber-100 text-amber-700 border-amber-200',
  servicio_deportivo:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  asociacion_grupo:        'bg-purple-100 text-purple-700 border-purple-200',
  otro:                    'bg-gray-100 text-gray-600 border-gray-200',
  // Valor heredado
  traslado_empresa:        'bg-cyan-100 text-cyan-700 border-cyan-200',
};

export type TipoServicio   = typeof TIPO_SERVICIO_OPTIONS[number]['value'];
export type ServicioEstado = typeof SERVICIO_ESTADOS[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TransportStop {
  // Legacy fields — always present in existing records
  nombre:    string;
  hora?:     string;       // "HH:MM"
  direccion?: string;      // Legacy simple address string
  // Extended fields — optional; absent in old records (backward compatible)
  tipo_operacion?: TipoOperacionParada;
  location?: TransportLocation;
  contacto?: TransportContact;
}

export interface TradeTransportService {
  id: string;
  org_id: string;
  quote_id?: string | null;
  client_id?: string | null;
  titulo: string;
  tipo_servicio: TipoServicio;
  estado: ServicioEstado;
  fecha_inicio: string;   // ISO 8601 timestamptz
  fecha_fin?: string | null;
  origen?: string | null;
  destino?: string | null;
  paradas: TransportStop[];
  num_viajeros?: number | null;
  vehicle_id?: string | null;
  conductor_id?: string | null;
  precio_acordado?: number | null;
  observaciones?: string | null;
  // ── Campos de ubicación estructurada (ROUTE-ADDRESS-1) ────────────────────
  origen_detalle?:          TransportLocation | null;
  destino_detalle?:         TransportLocation | null;
  contacto_principal?:      TransportContact  | null;
  instrucciones_conductor?: string | null;
  // ── Campos del parte de servicio (T1-C) ────────────────────────────────────
  hora_real_salida?: string | null;
  hora_real_llegada?: string | null;
  km_reales?: number | null;
  incidencias?: string | null;
  observaciones_cierre?: string | null;
  cerrado_at?: string | null;
  cerrado_por?: string | null;   // auth.uid()
  created_at: string;
  updated_at: string;
}

/** Input para cierre de servicio (parte real). */
export interface TradeTransportParteInput {
  hora_real_salida?: string | null;     // ISO timestamptz
  hora_real_llegada?: string | null;    // ISO timestamptz
  km_reales?: number | null;
  incidencias?: string | null;
  observaciones_cierre?: string | null;
}

export type TradeTransportServiceInput = Omit<
  TradeTransportService,
  'id' | 'org_id' | 'created_at' | 'updated_at'
>;

export interface ConflictInfo {
  tipo: 'vehiculo' | 'conductor' | 'conflicto_concurrente';
  id: string | null;
  titulo: string;
  fecha_inicio: string | null;
  fecha_fin?: string | null;
}

// ── Validación ────────────────────────────────────────────────────────────────

const STOP_HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Valida y normaliza el array de paradas. Lanza Error si el formato es inválido. */
export function validateStops(stops: TransportStop[]): TransportStop[] {
  return stops.map((s, i) => {
    if (!s.nombre || s.nombre.trim() === '') {
      throw new Error(`Parada ${i + 1}: el campo "nombre" es obligatorio`);
    }
    if (s.hora !== undefined && s.hora !== '' && !STOP_HORA_RE.test(s.hora)) {
      throw new Error(`Parada ${i + 1}: la hora debe estar en formato HH:MM (ej. "08:30")`);
    }
    return { ...s, nombre: s.nombre.trim() };
  });
}

/** Valida los campos de entrada de un servicio. Lanza Error si algo falla. */
export function validateServiceInput(input: TradeTransportServiceInput): void {
  if (!input.titulo || input.titulo.trim() === '') {
    throw new Error('El título del servicio es obligatorio');
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
  if (input.num_viajeros !== null && input.num_viajeros !== undefined) {
    if (!Number.isInteger(input.num_viajeros) || input.num_viajeros < 1) {
      throw new Error('El número de viajeros debe ser un entero positivo');
    }
  }
  if (input.precio_acordado !== null && input.precio_acordado !== undefined) {
    if (input.precio_acordado < 0) {
      throw new Error('El precio acordado no puede ser negativo');
    }
  }
  if (Array.isArray(input.paradas)) {
    validateStops(input.paradas);
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Crea un nuevo servicio de transporte para la organización. */
export async function createTransportService(
  orgId: string,
  input: TradeTransportServiceInput,
): Promise<TradeTransportService> {
  validateServiceInput(input);
  const paradas = Array.isArray(input.paradas) ? validateStops(input.paradas) : [];

  const { data, error } = await supabase
    .from('trade_transport_services')
    .insert([{
      ...input,
      org_id: orgId,
      titulo: input.titulo.trim(),
      paradas,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as TradeTransportService;
}

/** Actualiza un servicio existente. Solo puede tocarse si pertenece a la org. */
export async function updateTransportService(
  id: string,
  orgId: string,
  updates: Partial<TradeTransportServiceInput>,
): Promise<TradeTransportService> {
  const patch: Partial<TradeTransportServiceInput> = { ...updates };

  if (patch.titulo !== undefined) patch.titulo = patch.titulo!.trim();
  if (patch.paradas !== undefined) patch.paradas = validateStops(patch.paradas!);

  // Validación parcial de campos presentes
  if (patch.titulo !== undefined && patch.titulo === '') {
    throw new Error('El título del servicio es obligatorio');
  }
  if (patch.fecha_fin !== undefined && patch.fecha_fin !== null && patch.fecha_inicio !== undefined) {
    const ini = new Date(patch.fecha_inicio!);
    const fin = new Date(patch.fecha_fin);
    if (fin <= ini) throw new Error('La fecha de finalización debe ser posterior a la de inicio');
  }
  if (patch.num_viajeros !== undefined && patch.num_viajeros !== null) {
    if (!Number.isInteger(patch.num_viajeros) || patch.num_viajeros < 1) {
      throw new Error('El número de viajeros debe ser un entero positivo');
    }
  }
  if (patch.precio_acordado !== undefined && patch.precio_acordado !== null) {
    if (patch.precio_acordado < 0) throw new Error('El precio acordado no puede ser negativo');
  }

  const { data, error } = await supabase
    .from('trade_transport_services')
    .update(patch)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as TradeTransportService;
}

/** Cancela un servicio (transición de estado controlada, sin borrado físico). */
export async function cancelTransportService(
  id: string,
  orgId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_transport_services')
    .update({ estado: 'cancelado' })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

/**
 * Confirma un servicio de forma atómica, protegiendo contra asignaciones
 * concurrentes del mismo vehículo o conductor.
 * Retorna { ok: true } o { ok: false, conflictos: ConflictInfo[] }.
 */
export async function confirmTransportService(
  id: string,
  orgId: string,
): Promise<{ ok: boolean; conflictos?: ConflictInfo[] }> {
  const { data, error } = await supabase.rpc('confirm_transport_service', {
    p_service_id: id,
    p_org_id:     orgId,
  });
  if (error) throw error;
  return data as { ok: boolean; conflictos?: ConflictInfo[] };
}

/** Cambia el estado de un servicio (en_curso o completado). */
export async function updateTransportEstado(
  id: string,
  orgId: string,
  estado: ServicioEstado,
): Promise<void> {
  const { error } = await supabase
    .from('trade_transport_services')
    .update({ estado })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

/** Carga todos los servicios de la organización, más recientes primero. */
export async function loadTransportServices(
  orgId: string,
  opts: {
    desde?: string;    // ISO date
    hasta?: string;    // ISO date
    estado?: ServicioEstado;
  } = {},
): Promise<TradeTransportService[]> {
  let q = supabase
    .from('trade_transport_services')
    .select('*')
    .eq('org_id', orgId)
    .order('fecha_inicio', { ascending: false });

  if (opts.desde) q = q.gte('fecha_inicio', opts.desde);
  if (opts.hasta) q = q.lte('fecha_inicio', opts.hasta);
  if (opts.estado) q = q.eq('estado', opts.estado);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TradeTransportService[];
}

/** Carga los servicios del día indicado (por fecha_inicio). */
export async function loadServicesForDay(
  orgId: string,
  date: string,   // "YYYY-MM-DD"
): Promise<TradeTransportService[]> {
  const desde = `${date}T00:00:00`;
  const hasta = `${date}T23:59:59`;
  return loadTransportServices(orgId, { desde, hasta });
}

/**
 * Carga todos los servicios que se solapan con el día indicado.
 * Incluye servicios que empezaron antes y terminan ese día (viajes nocturnos).
 * Condición: fecha_inicio <= fin_del_día AND (fecha_fin >= inicio_del_día OR fecha_fin IS NULL)
 */
export async function loadServicesOverlappingDay(
  orgId: string,
  date: string,   // "YYYY-MM-DD"
): Promise<TradeTransportService[]> {
  const dayStart = `${date}T00:00:00`;
  const dayEnd   = `${date}T23:59:59`;
  const { data, error } = await supabase
    .from('trade_transport_services')
    .select('*')
    .eq('org_id', orgId)
    .lte('fecha_inicio', dayEnd)
    .or(`fecha_fin.gte.${dayStart},fecha_fin.is.null`)
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeTransportService[];
}

/**
 * Carga todos los servicios que se solapan con el rango indicado.
 * Incluye servicios nocturnos que cruzan los límites del rango.
 * Condición: fecha_inicio <= hasta AND (fecha_fin >= desde OR fecha_fin IS NULL)
 */
export async function loadServicesOverlappingRange(
  orgId: string,
  desde: string,   // ISO datetime, inicio del rango
  hasta: string,   // ISO datetime, fin del rango
): Promise<TradeTransportService[]> {
  const { data, error } = await supabase
    .from('trade_transport_services')
    .select('*')
    .eq('org_id', orgId)
    .lte('fecha_inicio', hasta)
    .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeTransportService[];
}

/**
 * Comprueba disponibilidad de vehículo y conductor para un intervalo dado.
 * Retorna la lista de servicios confirmados/en_curso que solapan.
 * Esta comprobación es informativa (capa de aplicación); la protección
 * de concurrencia real reside en confirm_transport_service (DB).
 */
export async function checkAvailability(
  orgId: string,
  opts: {
    vehicleId?:   string;
    conductorId?: string;
    fechaInicio:  string;
    fechaFin?:    string;
    excludeId?:   string;   // excluir el propio servicio al editar
  },
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];
  const effectiveFin = opts.fechaFin ?? new Date(new Date(opts.fechaInicio).getTime() + 4 * 3600 * 1000).toISOString();

  const checkResource = async (field: 'vehicle_id' | 'conductor_id', value: string, tipo: 'vehiculo' | 'conductor') => {
    let q = supabase
      .from('trade_transport_services')
      .select('id, titulo, fecha_inicio, fecha_fin')
      .eq('org_id', orgId)
      .eq(field, value)
      .in('estado', ['confirmado', 'en_curso'])
      .lt('fecha_inicio', effectiveFin)
      .gt('fecha_fin', opts.fechaInicio); // solapamiento: inicio_B < fin_A && fin_B > inicio_A

    if (opts.excludeId) q = q.neq('id', opts.excludeId);

    const { data } = await q;
    if (data?.length) {
      conflicts.push(...data.map((s: { id: string; titulo: string; fecha_inicio: string; fecha_fin?: string | null }) => ({
        tipo,
        id: s.id,
        titulo: s.titulo,
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
      })));
    }
  };

  await Promise.all([
    opts.vehicleId   ? checkResource('vehicle_id',   opts.vehicleId,   'vehiculo')  : Promise.resolve(),
    opts.conductorId ? checkResource('conductor_id', opts.conductorId, 'conductor') : Promise.resolve(),
  ]);

  return conflicts;
}

/**
 * Carga un servicio por ID. Verifica pertenencia a org (multitenancy).
 * Retorna null si no existe o no pertenece a la org.
 */
export async function loadServiceById(
  id: string,
  orgId: string,
): Promise<TradeTransportService | null> {
  const { data, error } = await supabase
    .from('trade_transport_services')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;   // no rows
    throw error;
  }
  return data as TradeTransportService;
}

/**
 * Cierra un servicio en_curso de forma atómica a través de la RPC segura.
 * Registra los datos reales del parte (horarios, kilómetros, incidencias).
 * Retorna { ok: true, cerrado_at: string } o lanza un error.
 */
export async function completeTransportService(
  id: string,
  orgId: string,
  parte: TradeTransportParteInput,
): Promise<{ ok: boolean; cerrado_at?: string }> {
  const { data, error } = await supabase.rpc('complete_transport_service', {
    p_service_id:           id,
    p_org_id:               orgId,
    p_hora_real_salida:     parte.hora_real_salida     ?? null,
    p_hora_real_llegada:    parte.hora_real_llegada    ?? null,
    p_km_reales:            parte.km_reales            ?? null,
    p_incidencias:          parte.incidencias          ?? null,
    p_observaciones_cierre: parte.observaciones_cierre ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; cerrado_at?: string };
}

// ── Histórico de partes ───────────────────────────────────────────────────────

export const PARTES_PAGE_SIZE = 200;

export interface PartesFilter {
  desde?: string;       // YYYY-MM-DD — filtra por fecha_inicio (fecha del servicio)
  hasta?: string;       // YYYY-MM-DD
  conductorId?: string;
  vehicleId?: string;
  search?: string;      // texto libre sobre titulo (client-side)
}

export interface PartesResult {
  partes: TradeTransportService[];
  hasMore: boolean;
}

/**
 * Carga todos los servicios de la org en estado completado (= tienen parte cerrado).
 * El filtro de fecha usa fecha_inicio (fecha del servicio), no cerrado_at.
 * Ordenados por cerrado_at desc. El filtro de texto se aplica en cliente.
 * Máximo PARTES_PAGE_SIZE resultados; hasMore=true indica que existen más.
 */
export async function loadPartesCompletados(
  orgId: string,
  filter: PartesFilter = {},
): Promise<PartesResult> {
  let q = supabase
    .from('trade_transport_services')
    .select('*')
    .eq('org_id', orgId)
    .eq('estado', 'completado')
    .order('cerrado_at', { ascending: false })
    .limit(PARTES_PAGE_SIZE + 1);

  if (filter.desde)       q = q.gte('fecha_inicio', filter.desde);
  if (filter.hasta)       q = q.lte('fecha_inicio', `${filter.hasta}T23:59:59`);
  if (filter.conductorId) q = q.eq('conductor_id', filter.conductorId);
  if (filter.vehicleId)   q = q.eq('vehicle_id', filter.vehicleId);

  const { data, error } = await q;
  if (error) throw error;
  let results = (data ?? []) as TradeTransportService[];

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    results = results.filter(s => s.titulo.toLowerCase().includes(needle));
  }

  const hasMore = results.length > PARTES_PAGE_SIZE;
  return { partes: results.slice(0, PARTES_PAGE_SIZE), hasMore };
}

/**
 * Carga servicios activos (no cancelados ni completados) cuya fecha_inicio
 * es estrictamente posterior a afterDate. Usado para el banner de servicios
 * futuros fuera del intervalo de filtro activo.
 */
export async function loadUpcomingServices(
  orgId: string,
  afterDate: string,
  limit = 10,
): Promise<TradeTransportService[]> {
  const { data, error } = await supabase
    .from('trade_transport_services')
    .select('*')
    .eq('org_id', orgId)
    .gt('fecha_inicio', afterDate)
    .neq('estado', 'cancelado')
    .neq('estado', 'completado')
    .order('fecha_inicio', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TradeTransportService[];
}
