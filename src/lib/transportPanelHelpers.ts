/**
 * transportPanelHelpers.ts — Helpers puros para Panel y Agenda de Transporte.
 * Sin dependencias de Supabase ni de React; totalmente testables.
 */

// ── Tipos base mínimos (evitar importar tipos completos) ──────────────────────

export interface ServiceLike {
  id: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  num_viajeros?: number | null;
  vehicle_id?: string | null;
  conductor_id?: string | null;
  origen?: string | null;
  destino?: string | null;
}

export interface VehicleLike {
  id: string;
  activo: boolean;
  estado: string;   // 'disponible' | 'en_servicio' | 'en_mantenimiento' | 'baja'
  modalidad: string; // 'viajeros' | 'mercancias' | 'reparto' | 'mixto'
}

export interface WorkerLike {
  id: string;
  es_conductor?: boolean;
}

// ── Estado de flota ───────────────────────────────────────────────────────────

export type FleetStatus =
  | 'en_servicio'   // tiene un servicio en_curso hoy
  | 'programado'    // tiene un servicio activo hoy (no en_curso)
  | 'sin_asignacion' // activo + apto, sin servicios hoy
  | 'fuera_de_servicio'; // activo=false, en_mantenimiento o baja

export function isVehiclePassenger(v: Pick<VehicleLike, 'modalidad'>): boolean {
  return v.modalidad === 'viajeros' || v.modalidad === 'mixto';
}

export function isVehicleOutOfService(v: Pick<VehicleLike, 'activo' | 'estado'>): boolean {
  return !v.activo || v.estado === 'en_mantenimiento' || v.estado === 'baja';
}

/**
 * Clasifica un vehículo en uno de los 4 estados operativos para el Panel.
 * todayServices debe contener solo servicios que se solapan con el día consultado.
 */
export function getVehicleFleetStatus(
  vehicle: VehicleLike,
  todayServices: ServiceLike[],
): FleetStatus {
  if (isVehicleOutOfService(vehicle)) return 'fuera_de_servicio';

  const myServices = todayServices.filter(
    s => s.vehicle_id === vehicle.id && s.estado !== 'cancelado',
  );
  if (myServices.length === 0)              return 'sin_asignacion';
  if (myServices.some(s => s.estado === 'en_curso')) return 'en_servicio';
  return 'programado';
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface TransportKpis {
  totalActiveServices: number;      // servicios activos (no cancelados) que solapan hoy
  serviciosEnCurso: number;
  serviciosConfirmados: number;
  totalViajeros: number;
  assignedVehicleIds: Set<string>;
  assignedConductorIds: Set<string>;
}

/**
 * Calcula KPIs del día a partir de los servicios que solapan hoy (ya filtrados).
 * No cancela duplicados de servicios — el caller debe garantizar que la lista
 * no tiene repetidos (cada servicio aparece una vez aunque cruce medianoche).
 */
export function computeKpis(services: ServiceLike[]): TransportKpis {
  const active = services.filter(s => s.estado !== 'cancelado');
  const vehicleIds   = new Set<string>();
  const conductorIds = new Set<string>();
  let totalViajeros  = 0;
  let enCurso        = 0;
  let confirmados    = 0;

  for (const s of active) {
    if (s.vehicle_id)   vehicleIds.add(s.vehicle_id);
    if (s.conductor_id) conductorIds.add(s.conductor_id);
    if (s.num_viajeros) totalViajeros += s.num_viajeros;
    if (s.estado === 'en_curso')   enCurso++;
    if (s.estado === 'confirmado') confirmados++;
  }

  return {
    totalActiveServices:   active.length,
    serviciosEnCurso:      enCurso,
    serviciosConfirmados:  confirmados,
    totalViajeros,
    assignedVehicleIds:    vehicleIds,
    assignedConductorIds:  conductorIds,
  };
}

// ── Intersección servicio–día ─────────────────────────────────────────────────

/**
 * True si el servicio se solapa con el día indicado.
 * Un servicio sin fecha_fin se trata como si terminara en el mismo instante de inicio.
 */
export function serviceOverlapsDay(
  svc: Pick<ServiceLike, 'fecha_inicio' | 'fecha_fin'>,
  dayStr: string,   // "YYYY-MM-DD"
): boolean {
  const dayStart = new Date(`${dayStr}T00:00:00`);
  const dayEnd   = new Date(`${dayStr}T23:59:59.999`);
  const start    = new Date(svc.fecha_inicio);
  const end      = svc.fecha_fin ? new Date(svc.fecha_fin) : start;
  return start <= dayEnd && end >= dayStart;
}

/**
 * Devuelve el conjunto de fechas (YYYY-MM-DD) que cubre el servicio.
 * Limitado a 31 días para evitar expansiones infinitas por datos corruptos.
 */
export function getServiceDays(
  svc: Pick<ServiceLike, 'fecha_inicio' | 'fecha_fin'>,
): Set<string> {
  const days  = new Set<string>();
  const start = new Date(svc.fecha_inicio);
  const end   = svc.fecha_fin ? new Date(svc.fecha_fin) : start;
  const cur   = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  let iterations = 0;
  while (cur <= endDay && iterations < 31) {
    days.add(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
    iterations++;
  }
  return days;
}

// ── Panel derived lists ────────────────────────────────────────────────────────

/**
 * Services that haven't started yet: active, not en_curso, fecha_inicio > now.
 * Returned sorted by fecha_inicio ascending (nearest first).
 */
export function getProximasSalidas<T extends ServiceLike>(services: T[], now: Date): T[] {
  return services
    .filter(
      s =>
        s.estado !== 'cancelado' &&
        s.estado !== 'completado' &&
        s.estado !== 'en_curso' &&
        new Date(s.fecha_inicio) > now,
    )
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
}

/**
 * Active services that are missing origen or destino.
 * Excludes cancelado and completado.
 */
export function getSinItinerario<T extends ServiceLike>(services: T[]): T[] {
  return services.filter(
    s =>
      s.estado !== 'cancelado' &&
      s.estado !== 'completado' &&
      (!s.origen || !s.destino),
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Lunes de la semana que contiene `date`. */
export function startOfWeek(date: Date): Date {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
