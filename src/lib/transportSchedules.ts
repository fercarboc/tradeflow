import { supabase } from './supabase';

// ── Tipos de excepción ───────────────────────────────────────────────────────

export type ScheduleExceptionTipo =
  | 'no_circula'
  | 'suspendido'
  | 'cambio_horario'
  | 'cambio_conductor'
  | 'cambio_vehiculo'
  | 'cambio_itinerario'
  | 'modificado';

export const SCHEDULE_EXCEPTION_TIPO_LABELS: Record<ScheduleExceptionTipo, string> = {
  no_circula:          'No circula',
  suspendido:          'Suspendido',
  cambio_horario:      'Cambio de horario',
  cambio_conductor:    'Cambio de conductor',
  cambio_vehiculo:     'Cambio de vehículo',
  cambio_itinerario:   'Cambio de itinerario',
  modificado:          'Modificado',
};

// ── Estado de la plantilla ───────────────────────────────────────────────────

export type ScheduleEstado = 'borrador' | 'activo' | 'pausado' | 'finalizado';

export const SCHEDULE_ESTADO_LABELS: Record<ScheduleEstado, string> = {
  borrador:   'Borrador',
  activo:     'Activo',
  pausado:    'Pausado',
  finalizado: 'Finalizado',
};

// ── Sentido ──────────────────────────────────────────────────────────────────

export type ScheduleSentido = 'ida' | 'vuelta' | 'unico';

// ── Tipos de horario de días ─────────────────────────────────────────────────

/** ISO-8601: 1 = lunes, 7 = domingo */
export type DiaSemanaISO = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIA_SEMANA_LABELS: Record<DiaSemanaISO, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

// ── Interfaces de entidades ──────────────────────────────────────────────────

export interface TradeTransportSchedule {
  id: string;
  org_id: string;
  nombre: string;
  tipo_servicio: string;
  estado: ScheduleEstado;
  client_id: string | null;
  periodo_inicio: string;         // date ISO
  periodo_fin: string | null;     // date ISO
  dias_semana: DiaSemanaISO[];
  timezone: string;
  hora_salida_ida: string;        // HH:MM:SS
  hora_llegada_ida: string | null;
  origen_ida: Record<string, unknown>;
  destino_ida: Record<string, unknown>;
  paradas_ida: unknown[];
  vuelta_habilitada: boolean;
  hora_salida_vuelta: string | null;
  hora_llegada_vuelta: string | null;
  paradas_vuelta: unknown[];
  num_viajeros: number | null;
  vehicle_id: string | null;
  conductor_id: string | null;
  precio_referencia: number | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeTransportScheduleException {
  id: string;
  org_id: string;
  schedule_id: string;
  fecha: string;                  // date ISO
  sentido: ScheduleSentido;
  tipo: ScheduleExceptionTipo;
  overrides: Record<string, unknown>;
  motivo: string | null;
  created_at: string;
}

export interface TradeTransportOccurrenceLink {
  id: string;
  org_id: string;
  schedule_id: string;
  service_id: string;
  fecha: string;                  // date ISO
  sentido: ScheduleSentido;
  created_at: string;
}

export interface TradeTransportStopFavorite {
  id: string;
  org_id: string;
  nombre: string;
  tipo_lugar: string | null;
  location: Record<string, unknown>;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ── Resultado de materialización ─────────────────────────────────────────────

export interface MaterializeResult {
  ok: boolean;
  idempotent?: boolean;
  service_id?: string;
  error?: string;
  /** Offset UTC en minutos del horario de verano (solo cuando error es TRANSPORT_DST_AMBIGUOUS) */
  dst_offset_summer_minutes?: number;
  /** Offset UTC en minutos del horario de invierno (solo cuando error es TRANSPORT_DST_AMBIGUOUS) */
  dst_offset_winter_minutes?: number;
}

// ── Constantes de validación ─────────────────────────────────────────────────

export const SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED: Record<ScheduleExceptionTipo, string[]> = {
  no_circula:        [],
  suspendido:        [],
  cambio_horario:    ['hora_salida', 'hora_llegada'],
  cambio_conductor:  ['conductor_id'],
  cambio_vehiculo:   ['vehicle_id'],
  cambio_itinerario: ['hora_salida', 'hora_llegada', 'paradas', 'origen', 'destino'],
  modificado:        ['conductor_id', 'vehicle_id', 'hora_salida', 'hora_llegada', 'paradas', 'origen', 'destino'],
};

export const SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN = [
  'org_id', 'id', 'schedule_id', 'fecha', 'sentido', 'tipo', 'created_at',
] as const;

// ── Funciones de cliente ─────────────────────────────────────────────────────

export async function loadSchedules(orgId: string): Promise<TradeTransportSchedule[]> {
  const { data, error } = await supabase
    .from('trade_transport_schedules')
    .select('*')
    .eq('org_id', orgId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeTransportSchedule[];
}

export async function loadSchedule(
  scheduleId: string,
  orgId: string,
): Promise<TradeTransportSchedule | null> {
  const { data, error } = await supabase
    .from('trade_transport_schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data as TradeTransportSchedule | null;
}

export async function createSchedule(
  orgId: string,
  input: Omit<TradeTransportSchedule, 'id' | 'org_id' | 'created_at' | 'updated_at'>,
): Promise<TradeTransportSchedule> {
  const { data, error } = await supabase
    .from('trade_transport_schedules')
    .insert({ ...input, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeTransportSchedule;
}

export async function updateSchedule(
  scheduleId: string,
  orgId: string,
  patch: Partial<TradeTransportSchedule>,
): Promise<TradeTransportSchedule> {
  const { data, error } = await supabase
    .from('trade_transport_schedules')
    .update(patch)
    .eq('id', scheduleId)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) throw error;
  return data as TradeTransportSchedule;
}

export async function loadExceptions(
  scheduleId: string,
  orgId: string,
): Promise<TradeTransportScheduleException[]> {
  const { data, error } = await supabase
    .from('trade_transport_schedule_exceptions')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('org_id', orgId)
    .order('fecha');
  if (error) throw error;
  return (data ?? []) as TradeTransportScheduleException[];
}

export async function loadOccurrenceLinks(
  scheduleId: string,
  orgId: string,
): Promise<TradeTransportOccurrenceLink[]> {
  const { data, error } = await supabase
    .from('trade_transport_occurrence_links')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('org_id', orgId)
    .order('fecha');
  if (error) throw error;
  return (data ?? []) as TradeTransportOccurrenceLink[];
}

export async function materializeOccurrence(
  orgId: string,
  scheduleId: string,
  fecha: string,
  sentido: ScheduleSentido,
  utcOffsetMinutes?: number,
): Promise<MaterializeResult> {
  const params: Record<string, unknown> = {
    p_org_id:      orgId,
    p_schedule_id: scheduleId,
    p_fecha:       fecha,
    p_sentido:     sentido,
  };
  if (utcOffsetMinutes !== undefined) {
    params.p_utc_offset_minutes = utcOffsetMinutes;
  }
  const { data, error } = await supabase.rpc('materialize_transport_occurrence', params);
  if (error) throw error;
  return data as MaterializeResult;
}

export async function loadStopFavorites(orgId: string): Promise<TradeTransportStopFavorite[]> {
  const { data, error } = await supabase
    .from('trade_transport_stop_favorites')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeTransportStopFavorite[];
}

// ── Helpers de cálculo de ocurrencias esperadas (cliente puro, sin side effects) ──

/**
 * Devuelve las fechas (ISO YYYY-MM-DD) en que circula una plantilla
 * dentro del rango [desde, hasta] (ambos inclusive).
 * No accede a la base de datos. No incluye excepciones.
 */
export function getExpectedOccurrences(
  schedule: Pick<TradeTransportSchedule, 'periodo_inicio' | 'periodo_fin' | 'dias_semana'>,
  desde: Date,
  hasta: Date,
): string[] {
  const periodoFin = schedule.periodo_fin ? new Date(schedule.periodo_fin + 'T00:00:00') : null;
  const periodoInicio = new Date(schedule.periodo_inicio + 'T00:00:00');

  const rangeStart = desde < periodoInicio ? periodoInicio : desde;
  const rangeEnd   = periodoFin && hasta > periodoFin ? periodoFin : hasta;

  if (rangeStart > rangeEnd) return [];

  const results: string[] = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= rangeEnd) {
    // getDay() devuelve 0=domingo…6=sábado; convertir a ISO (1=lunes…7=domingo)
    const dow = cursor.getDay();
    const isoDay = (dow === 0 ? 7 : dow) as DiaSemanaISO;

    if ((schedule.dias_semana as number[]).includes(isoDay)) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      results.push(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}

/**
 * Valida que los overrides JSONB sean coherentes con el tipo de excepción.
 * Retorna null si son válidos, o un mensaje de error en caso contrario.
 * Usado en el formulario antes de enviar al servidor.
 */
export function validateExceptionOverrides(
  tipo: ScheduleExceptionTipo,
  overrides: Record<string, unknown>,
): string | null {
  const forbidden = SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN as readonly string[];
  for (const key of forbidden) {
    if (key in overrides) {
      return `La clave "${key}" está prohibida en overrides`;
    }
  }

  const allowed = SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED[tipo];
  if (allowed.length === 0 && Object.keys(overrides).length > 0) {
    return `El tipo "${tipo}" no admite overrides`;
  }

  for (const key of Object.keys(overrides)) {
    if (!allowed.includes(key)) {
      return `La clave "${key}" no está permitida para tipo "${tipo}" (válidas: ${allowed.join(', ')})`;
    }
  }

  return null;
}
