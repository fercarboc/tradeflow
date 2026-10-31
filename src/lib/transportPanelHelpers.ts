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

// ── Time-slot classification ──────────────────────────────────────────────────

export type TimeSlot = 'manana' | 'tarde' | 'noche';

/**
 * Clasifica un timestamp ISO en franja horaria:
 *  mañana  06:00–13:59
 *  tarde   14:00–21:59
 *  noche   22:00–05:59
 */
export function classifyTimeSlot(isoDatetime: string): TimeSlot {
  const h = new Date(isoDatetime).getHours();
  if (h >= 6  && h < 14) return 'manana';
  if (h >= 14 && h < 22) return 'tarde';
  return 'noche';
}

// ── Servicios por día ─────────────────────────────────────────────────────────

export function getServicesForDay<T extends Pick<ServiceLike, 'fecha_inicio' | 'fecha_fin'>>(
  services: T[],
  dayStr: string,
): T[] {
  return services.filter(s => serviceOverlapsDay(s, dayStr));
}

// ── Alertas de vehículos ──────────────────────────────────────────────────────

export interface VehicleAlertLike {
  id: string;
  nombre: string;
  matricula: string;
  estado: string;
  activo: boolean;
  itv_fecha_vencimiento?: string | null;
  seguro_vencimiento?: string | null;
}

export type AlertSeverity = 'error' | 'warning';

export type VehicleAlertType =
  | 'itv_vencida'
  | 'itv_proxima'
  | 'seguro_vencido'
  | 'seguro_proximo'
  | 'en_mantenimiento'
  | 'baja';

export interface VehicleAlertItem {
  vehicleId: string;
  vehicleName: string;
  matricula: string;
  type: VehicleAlertType;
  label: string;
  detail: string;
  fecha?: string;
  severity: AlertSeverity;
}

// ── Conductores asignados (servicios + rutas recurrentes) ─────────────────────

/**
 * Mínimo necesario de una ocurrencia para calcular asignaciones.
 * Evita importar el tipo completo desde el fichero de componente.
 */
export interface OccurrenceForKpi {
  fecha: string;
  effectiveConductorId: string | null;
  status?: string;
}

/**
 * Devuelve el conjunto de IDs de conductores con alguna asignación en `dayStr`.
 * Combina servicios puntuales y ocurrencias de rutas recurrentes sin duplicados.
 * Excluye servicios cancelados y ocurrencias suspendidas/no_circula.
 */
export function getAssignedConductorIds(
  services: Pick<ServiceLike, 'estado' | 'conductor_id'>[],
  occurrences: OccurrenceForKpi[],
  dayStr: string,
): Set<string> {
  const ids = new Set<string>();
  for (const s of services) {
    if (s.estado !== 'cancelado' && s.conductor_id) ids.add(s.conductor_id);
  }
  for (const o of occurrences) {
    if (
      o.fecha === dayStr &&
      o.effectiveConductorId &&
      o.status !== 'no_circula' &&
      o.status !== 'suspended'
    ) {
      ids.add(o.effectiveConductorId);
    }
  }
  return ids;
}

/**
 * Calcula alertas de vehículos: ITV/seguro próximos (≤ daysAhead días) o vencidos,
 * en mantenimiento y dados de baja.
 * Ordenadas: errores primero, luego warnings.
 */
export function computeVehicleAlerts(
  vehicles: VehicleAlertLike[],
  todayStr: string,
  daysAhead = 30,
): VehicleAlertItem[] {
  const today  = new Date(`${todayStr}T00:00:00`);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const alerts: VehicleAlertItem[] = [];

  for (const v of vehicles) {
    if (v.estado === 'baja') {
      alerts.push({
        vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
        type: 'baja', label: 'Dado de baja',
        detail: 'Vehículo fuera de servicio permanente', severity: 'error',
      });
      continue;
    }

    if (v.estado === 'en_mantenimiento') {
      alerts.push({
        vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
        type: 'en_mantenimiento', label: 'En mantenimiento',
        detail: 'No disponible hasta finalizar taller', severity: 'warning',
      });
    }

    if (v.itv_fecha_vencimiento) {
      const exp     = new Date(`${v.itv_fecha_vencimiento}T00:00:00`);
      const diffMs  = exp.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / 86400000);
      if (exp < today) {
        alerts.push({
          vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
          type: 'itv_vencida', label: 'ITV vencida',
          detail: `Venció el ${v.itv_fecha_vencimiento}`,
          fecha: v.itv_fecha_vencimiento, severity: 'error',
        });
      } else if (exp <= cutoff) {
        alerts.push({
          vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
          type: 'itv_proxima', label: `ITV vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`,
          detail: `Próxima ITV: ${v.itv_fecha_vencimiento}`,
          fecha: v.itv_fecha_vencimiento, severity: 'warning',
        });
      }
    }

    if (v.seguro_vencimiento) {
      const exp     = new Date(`${v.seguro_vencimiento}T00:00:00`);
      const diffMs  = exp.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / 86400000);
      if (exp < today) {
        alerts.push({
          vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
          type: 'seguro_vencido', label: 'Seguro vencido',
          detail: `Venció el ${v.seguro_vencimiento}`,
          fecha: v.seguro_vencimiento, severity: 'error',
        });
      } else if (exp <= cutoff) {
        alerts.push({
          vehicleId: v.id, vehicleName: v.nombre, matricula: v.matricula,
          type: 'seguro_proximo', label: `Seguro vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`,
          detail: `Vencimiento seguro: ${v.seguro_vencimiento}`,
          fecha: v.seguro_vencimiento, severity: 'warning',
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const rank = (s: AlertSeverity) => (s === 'error' ? 0 : 1);
    return rank(a.severity) - rank(b.severity);
  });
}
