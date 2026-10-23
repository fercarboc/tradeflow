import { describe, it, expect } from 'vitest';
import {
  startOfWeek,
  addDays,
  isoDate,
  serviceOverlapsDay,
  getServiceDays,
  computeKpis,
  getVehicleFleetStatus,
  isVehiclePassenger,
  isVehicleOutOfService,
} from '../../lib/transportPanelHelpers';
import type { ServiceLike, VehicleLike } from '../../lib/transportPanelHelpers';

// ── Helpers de test ───────────────────────────────────────────────────────────

function svc(overrides: Partial<ServiceLike> & { id: string }): ServiceLike {
  return {
    estado: 'confirmado',
    fecha_inicio: '2026-10-23T09:00:00',
    fecha_fin:    '2026-10-23T17:00:00',
    num_viajeros: null,
    vehicle_id: null,
    conductor_id: null,
    ...overrides,
  };
}

function vehicle(overrides: Partial<VehicleLike> & { id: string }): VehicleLike {
  return {
    activo: true,
    estado: 'disponible',
    modalidad: 'viajeros',
    ...overrides,
  };
}

// ── 1. KPIs con servicios reales ──────────────────────────────────────────────

describe('computeKpis', () => {
  it('cuenta correctamente servicios activos, viajeros y asignados', () => {
    const services: ServiceLike[] = [
      svc({ id: 's1', estado: 'confirmado', num_viajeros: 30, vehicle_id: 'v1', conductor_id: 'c1' }),
      svc({ id: 's2', estado: 'en_curso',   num_viajeros: 45, vehicle_id: 'v2', conductor_id: 'c2' }),
      svc({ id: 's3', estado: 'borrador',   num_viajeros: 10, vehicle_id: 'v3', conductor_id: null }),
    ];
    const k = computeKpis(services);
    expect(k.totalActiveServices).toBe(3);
    expect(k.totalViajeros).toBe(85);
    expect(k.serviciosEnCurso).toBe(1);
    expect(k.serviciosConfirmados).toBe(1);
    expect(k.assignedVehicleIds.size).toBe(3);
    expect(k.assignedConductorIds.size).toBe(2);
  });

  // 2. Exclusión de cancelados
  it('excluye servicios cancelados de todos los KPIs', () => {
    const services: ServiceLike[] = [
      svc({ id: 's1', estado: 'confirmado', num_viajeros: 20, vehicle_id: 'v1', conductor_id: 'c1' }),
      svc({ id: 's2', estado: 'cancelado',  num_viajeros: 50, vehicle_id: 'v2', conductor_id: 'c2' }),
    ];
    const k = computeKpis(services);
    expect(k.totalActiveServices).toBe(1);
    expect(k.totalViajeros).toBe(20);
    expect(k.assignedVehicleIds.has('v2')).toBe(false);
    expect(k.assignedConductorIds.has('c2')).toBe(false);
  });

  // 11. Agenda sin servicios
  it('devuelve ceros cuando no hay servicios', () => {
    const k = computeKpis([]);
    expect(k.totalActiveServices).toBe(0);
    expect(k.totalViajeros).toBe(0);
    expect(k.serviciosEnCurso).toBe(0);
    expect(k.assignedVehicleIds.size).toBe(0);
  });

  // 5. Vehículo con dos servicios separados el mismo día — cuenta una vez
  it('cuenta cada vehicle_id una sola vez aunque tenga dos servicios', () => {
    const services: ServiceLike[] = [
      svc({ id: 's1', vehicle_id: 'v1', fecha_inicio: '2026-10-23T08:00:00', fecha_fin: '2026-10-23T10:00:00' }),
      svc({ id: 's2', vehicle_id: 'v1', fecha_inicio: '2026-10-23T14:00:00', fecha_fin: '2026-10-23T16:00:00' }),
    ];
    const k = computeKpis(services);
    expect(k.assignedVehicleIds.size).toBe(1);
    expect(k.totalActiveServices).toBe(2);
  });
});

// ── serviceOverlapsDay ────────────────────────────────────────────────────────

describe('serviceOverlapsDay', () => {
  const DAY = '2026-10-23';

  // 3. Servicio empieza hoy y termina mañana
  it('incluye servicio que empieza hoy y termina mañana', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-23T22:00:00', fecha_fin: '2026-10-24T06:00:00' });
    expect(serviceOverlapsDay(s, DAY)).toBe(true);
    // Para el día siguiente también debe solapar
    expect(serviceOverlapsDay(s, '2026-10-24')).toBe(true);
  });

  // 4. Servicio empezó ayer y termina hoy
  it('incluye servicio que empezó ayer y termina hoy', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-22T20:00:00', fecha_fin: '2026-10-23T08:00:00' });
    expect(serviceOverlapsDay(s, DAY)).toBe(true);
    expect(serviceOverlapsDay(s, '2026-10-22')).toBe(true);
  });

  it('no incluye servicio que termina antes de que empiece el día', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-22T08:00:00', fecha_fin: '2026-10-22T23:30:00' });
    expect(serviceOverlapsDay(s, DAY)).toBe(false);
  });

  it('no incluye servicio que empieza después de que termine el día', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-24T00:30:00', fecha_fin: '2026-10-24T10:00:00' });
    expect(serviceOverlapsDay(s, DAY)).toBe(false);
  });

  it('incluye servicio sin fecha_fin que empieza hoy', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-23T10:00:00', fecha_fin: null });
    expect(serviceOverlapsDay(s, DAY)).toBe(true);
  });
});

// ── getServiceDays ────────────────────────────────────────────────────────────

describe('getServiceDays', () => {
  it('servicio de un día: devuelve solo ese día', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-23T09:00:00', fecha_fin: '2026-10-23T17:00:00' });
    const days = getServiceDays(s);
    expect(days.size).toBe(1);
    expect(days.has('2026-10-23')).toBe(true);
  });

  it('servicio nocturno: devuelve ambos días', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-10-23T22:00:00', fecha_fin: '2026-10-24T06:00:00' });
    const days = getServiceDays(s);
    expect(days.has('2026-10-23')).toBe(true);
    expect(days.has('2026-10-24')).toBe(true);
    expect(days.size).toBe(2);
  });

  it('limita a 31 días para datos corruptos (fecha_fin muy lejana)', () => {
    const s = svc({ id: 's1', fecha_inicio: '2026-01-01T00:00:00', fecha_fin: '2027-01-01T00:00:00' });
    const days = getServiceDays(s);
    expect(days.size).toBeLessThanOrEqual(31);
  });
});

// ── Estado de flota ───────────────────────────────────────────────────────────

describe('getVehicleFleetStatus', () => {
  // 6. Vehículo en mantenimiento
  it('clasifica vehículo en mantenimiento como fuera_de_servicio', () => {
    const v = vehicle({ id: 'v1', estado: 'en_mantenimiento' });
    expect(getVehicleFleetStatus(v, [])).toBe('fuera_de_servicio');
  });

  // 7. Vehículo inactivo
  it('clasifica vehículo con activo=false como fuera_de_servicio', () => {
    const v = vehicle({ id: 'v1', activo: false });
    expect(getVehicleFleetStatus(v, [])).toBe('fuera_de_servicio');
  });

  it('clasifica vehículo en baja como fuera_de_servicio', () => {
    const v = vehicle({ id: 'v1', estado: 'baja' });
    expect(getVehicleFleetStatus(v, [])).toBe('fuera_de_servicio');
  });

  it('vehículo sin servicios hoy → sin_asignacion', () => {
    const v = vehicle({ id: 'v1' });
    const services: ServiceLike[] = [
      svc({ id: 's1', vehicle_id: 'v2', estado: 'confirmado' }),
    ];
    expect(getVehicleFleetStatus(v, services)).toBe('sin_asignacion');
  });

  it('vehículo con servicio en_curso → en_servicio', () => {
    const v = vehicle({ id: 'v1' });
    const services: ServiceLike[] = [
      svc({ id: 's1', vehicle_id: 'v1', estado: 'en_curso' }),
    ];
    expect(getVehicleFleetStatus(v, services)).toBe('en_servicio');
  });

  it('vehículo con servicio confirmado (no en_curso) → programado', () => {
    const v = vehicle({ id: 'v1' });
    const services: ServiceLike[] = [
      svc({ id: 's1', vehicle_id: 'v1', estado: 'confirmado' }),
    ];
    expect(getVehicleFleetStatus(v, services)).toBe('programado');
  });

  it('vehículo con servicio cancelado solamente → sin_asignacion', () => {
    const v = vehicle({ id: 'v1' });
    const services: ServiceLike[] = [
      svc({ id: 's1', vehicle_id: 'v1', estado: 'cancelado' }),
    ];
    expect(getVehicleFleetStatus(v, services)).toBe('sin_asignacion');
  });
});

// ── Helpers de flota ──────────────────────────────────────────────────────────

describe('isVehiclePassenger / isVehicleOutOfService', () => {
  it('viajeros y mixto son vehículos de pasajeros', () => {
    expect(isVehiclePassenger({ modalidad: 'viajeros' })).toBe(true);
    expect(isVehiclePassenger({ modalidad: 'mixto' })).toBe(true);
    expect(isVehiclePassenger({ modalidad: 'mercancias' })).toBe(false);
    expect(isVehiclePassenger({ modalidad: 'reparto' })).toBe(false);
  });

  it('activo=false, en_mantenimiento o baja → fuera_de_servicio', () => {
    expect(isVehicleOutOfService({ activo: false, estado: 'disponible' })).toBe(true);
    expect(isVehicleOutOfService({ activo: true,  estado: 'en_mantenimiento' })).toBe(true);
    expect(isVehicleOutOfService({ activo: true,  estado: 'baja' })).toBe(true);
    expect(isVehicleOutOfService({ activo: true,  estado: 'disponible' })).toBe(false);
    expect(isVehicleOutOfService({ activo: true,  estado: 'en_servicio' })).toBe(false);
  });
});

// ── Date helpers ──────────────────────────────────────────────────────────────

describe('startOfWeek', () => {
  // 9. Navegación entre semanas
  it('devuelve lunes de la semana para un miércoles', () => {
    const wed = new Date('2026-10-21T12:00:00');  // miércoles
    const mon = startOfWeek(wed);
    expect(isoDate(mon)).toBe('2026-10-19');
  });

  it('devuelve el mismo lunes si la fecha ya es lunes', () => {
    const mon = new Date('2026-10-19T08:00:00');
    expect(isoDate(startOfWeek(mon))).toBe('2026-10-19');
  });

  it('trata el domingo como último día de la semana anterior', () => {
    const sun = new Date('2026-10-25T10:00:00');  // domingo
    expect(isoDate(startOfWeek(sun))).toBe('2026-10-19');
  });

  // 10. Cambio de año
  it('navega correctamente en el cambio de año (dic→ene)', () => {
    const dec31 = new Date('2026-12-31T10:00:00');  // jueves
    const weekStart = startOfWeek(dec31);
    expect(isoDate(weekStart)).toBe('2026-12-28');
    const nextWeek = startOfWeek(addDays(dec31, 7));
    expect(isoDate(nextWeek)).toBe('2027-01-04');
  });
});

// ── 8. Filtro de agenda por conductor y vehículo ──────────────────────────────

describe('filtro de agenda', () => {
  const allServices: ServiceLike[] = [
    svc({ id: 's1', vehicle_id: 'v1', conductor_id: 'c1' }),
    svc({ id: 's2', vehicle_id: 'v1', conductor_id: 'c2' }),
    svc({ id: 's3', vehicle_id: 'v2', conductor_id: 'c1' }),
    svc({ id: 's4', vehicle_id: 'v2', conductor_id: 'c2' }),
  ];

  it('filtra por vehículo', () => {
    const result = allServices.filter(s => s.vehicle_id === 'v1');
    expect(result.map(s => s.id)).toEqual(['s1', 's2']);
  });

  it('filtra por conductor', () => {
    const result = allServices.filter(s => s.conductor_id === 'c1');
    expect(result.map(s => s.id)).toEqual(['s1', 's3']);
  });

  it('filtra por vehículo y conductor combinados', () => {
    const result = allServices.filter(s => s.vehicle_id === 'v2' && s.conductor_id === 'c2');
    expect(result.map(s => s.id)).toEqual(['s4']);
  });

  it('sin filtros devuelve todos', () => {
    const result = allServices.filter(() => true);
    expect(result.length).toBe(4);
  });
});

// ── 12. Transport_enabled=false (sin servicios ni flota) ─────────────────────

describe('estado sin módulo de transporte activo', () => {
  it('KPIs vacíos cuando no hay servicios (org sin transporte)', () => {
    const k = computeKpis([]);
    expect(k.totalActiveServices).toBe(0);
    expect(k.totalViajeros).toBe(0);
    expect(k.serviciosEnCurso).toBe(0);
    expect(k.serviciosConfirmados).toBe(0);
    expect(k.assignedVehicleIds.size).toBe(0);
    expect(k.assignedConductorIds.size).toBe(0);
  });

  it('todos los vehículos sin_asignacion cuando no hay servicios', () => {
    const vehicles: VehicleLike[] = [
      vehicle({ id: 'v1' }),
      vehicle({ id: 'v2', modalidad: 'mixto' }),
    ];
    for (const v of vehicles) {
      expect(getVehicleFleetStatus(v, [])).toBe('sin_asignacion');
    }
  });
});
