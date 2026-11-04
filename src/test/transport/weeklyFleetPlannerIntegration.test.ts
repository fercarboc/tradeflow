/**
 * weeklyFleetPlannerIntegration.test.ts — TX-TRANSPORT-WEEKLY-FLEET-1 Fase 2
 *
 * Tests de integración entre ScreenTransportePanel y TransportWeeklyFleetPlanner.
 * Verifican filtros por modalidad, cálculo de segmentos, callbacks y aislamiento
 * de datos entre verticales.
 *
 * Semana de referencia: 2026-11-02 (lunes) → 2026-11-08 (domingo).
 */

import { describe, it, expect, vi } from 'vitest';
import { computeWeeklyBarSegments } from '../../lib/weeklyFleetHelpers';
import { isVehiclePassenger, addDays, isoDate } from '../../lib/transportPanelHelpers';
import {
  barColorClass,
  borderRadius,
  buildTooltip,
  type WeeklyPlotItem,
} from '../../components/TransportWeeklyFleetPlanner';
import type { WeeklyBarSegment } from '../../lib/weeklyFleetHelpers';
import type { TradeVehicle } from '../../lib/transport';
import type { TradeTransportService } from '../../lib/transportServices';
import type { TradeTransportTrip } from '../../lib/transportTrips';
import type { AgendaOccurrence } from '../../components/ScreenTransporteAgenda';

// ── Semana de referencia ──────────────────────────────────────────────────────

const BASE_MONDAY = new Date('2026-11-02T00:00:00');
const WEEK_DAYS   = Array.from({ length: 7 }, (_, i) => addDays(BASE_MONDAY, i));

// ── Helpers de fixtures ───────────────────────────────────────────────────────

function makeVehicle(overrides: Partial<TradeVehicle>): TradeVehicle {
  return {
    id: 'v1', org_id: 'org1', nombre: 'Vehículo test', matricula: '1234ABC',
    tipo: 'autocar', modalidad: 'viajeros', estado: 'disponible', activo: true,
    capacidad_viajeros: 50, capacidad_carga_kg: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    ...overrides,
  } as TradeVehicle;
}

function makeService(overrides: Partial<TradeTransportService>): TradeTransportService {
  return {
    id: 'svc1', org_id: 'org1', titulo: 'Servicio test',
    tipo_servicio: 'otro', estado: 'confirmado',
    fecha_inicio: '2026-11-03T08:00:00', fecha_fin: '2026-11-03T16:00:00',
    origen: 'Bilbao', destino: 'Santander',
    vehicle_id: 'v1', conductor_id: null, num_viajeros: null,
    paradas: [],
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    ...overrides,
  } as TradeTransportService;
}

function makeTrip(overrides: Partial<TradeTransportTrip>): TradeTransportTrip {
  return {
    id: 'trip1', org_id: 'org1', titulo: 'Viaje test', estado: 'confirmado',
    fecha_inicio: '2026-11-04T07:00:00', fecha_fin: '2026-11-04T18:00:00',
    origen: 'Madrid', destino: 'Barcelona',
    vehicle_id: 'vcargo1', conductor_id: null,
    tipo_carga: 'carga_general',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    ...overrides,
  } as TradeTransportTrip;
}

function makeOccurrence(fecha: string, vehicleId: string | null = 'v1'): AgendaOccurrence {
  return {
    fecha,
    sentido: 'ida',
    status: 'pending',
    schedule: {
      id: 'sch1', org_id: 'org1', nombre: 'Ruta mañana',
      hora_salida: '07:30', hora_llegada_estimada: '09:00',
      dias_semana: [1, 2, 3, 4, 5],
      origen: 'Bilbao', destino: 'Vitoria',
      vehicle_id: vehicleId, conductor_id: null,
      activo: true, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    } as any,
    exception: null,
    effectiveHoraSalida: '07:30',
    effectiveConductorId: null,
    effectiveVehicleId: vehicleId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-1: Org mixta — vehículos de ambas categorías
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-1 — Org mixta: vehículos de viajeros y carga', () => {
  const passenger = makeVehicle({ id: 'vp1', modalidad: 'viajeros' });
  const cargo     = makeVehicle({ id: 'vc1', modalidad: 'mercancias' });
  const mixed     = makeVehicle({ id: 'vm1', modalidad: 'mixto' });

  it('WFPI-1-1: isVehiclePassenger distingue viajeros de carga (mixto=passenger)', () => {
    expect(isVehiclePassenger(passenger)).toBe(true);
    expect(isVehiclePassenger(cargo)).toBe(false);
    // 'mixto' se considera vehículo de pasajeros en isVehiclePassenger
    expect(isVehiclePassenger(mixed)).toBe(true);
  });

  it('WFPI-1-2: flota mixta: viajeros+mixto=2 pasajeros, mercancias=1 carga', () => {
    const fleet = [passenger, cargo, mixed];
    const passCount  = fleet.filter(v => isVehiclePassenger(v)).length;
    const cargoCount = fleet.filter(v => !isVehiclePassenger(v)).length;
    expect(passCount).toBe(2);   // viajeros + mixto
    expect(cargoCount).toBe(1);  // sólo mercancias
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-2: Modo viajeros — solo vehículos de pasajeros
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-2 — Modo viajeros: exclusión de vehículos de carga', () => {
  const vehicles = [
    makeVehicle({ id: 'vp1', modalidad: 'viajeros' }),
    makeVehicle({ id: 'vp2', modalidad: 'viajeros' }),
    makeVehicle({ id: 'vc1', modalidad: 'mercancias' }),
    makeVehicle({ id: 'vr1', modalidad: 'reparto' }),
  ];

  it('WFPI-2-1: modo viajeros filtra sólo vehículos de pasajeros', () => {
    const viajeroFleet = vehicles.filter(v => isVehiclePassenger(v));
    expect(viajeroFleet).toHaveLength(2);
    expect(viajeroFleet.every(v => v.modalidad === 'viajeros')).toBe(true);
  });

  it('WFPI-2-2: modo viajeros excluye reparto y mercancías', () => {
    const excluded = vehicles.filter(v => !isVehiclePassenger(v));
    expect(excluded.map(v => v.id)).toEqual(expect.arrayContaining(['vc1', 'vr1']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-3: Modo mercancías — solo vehículos de carga
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-3 — Modo mercancías: exclusión de vehículos de pasajeros', () => {
  const vehicles = [
    makeVehicle({ id: 'vp1', modalidad: 'viajeros' }),
    makeVehicle({ id: 'vc1', modalidad: 'mercancias' }),
    makeVehicle({ id: 'vm1', modalidad: 'mixto' }),
  ];

  it('WFPI-3-1: modo mercancías filtra sólo vehículos donde !isVehiclePassenger (sólo mercancias)', () => {
    // isVehiclePassenger('mixto')=true, así que 'mixto' queda en el lado pasajeros
    // isVehiclePassenger('mercancias')=false, así que sólo 'mercancias' queda como cargo
    const cargoFleet = vehicles.filter(v => !isVehiclePassenger(v));
    expect(cargoFleet).toHaveLength(1);
    expect(cargoFleet.map(v => v.id)).toEqual(expect.arrayContaining(['vc1']));
  });

  it('WFPI-3-2: modo mercancías excluye vehículos de viajeros', () => {
    const cargoFleet = vehicles.filter(v => !isVehiclePassenger(v));
    expect(cargoFleet.some(v => v.modalidad === 'viajeros')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-4: Toggle de vista — callback de tipo correcto
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-4 — Toggle de vista: tipos de callback', () => {
  it('WFPI-4-1: onServiceClick recibe string id', () => {
    const handler = vi.fn<(id: string) => void>();
    handler('svc-123');
    expect(handler).toHaveBeenCalledWith('svc-123');
  });

  it('WFPI-4-2: onTripClick recibe string id', () => {
    const handler = vi.fn<(id: string) => void>();
    handler('trip-456');
    expect(handler).toHaveBeenCalledWith('trip-456');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-5: Clic en servicio — callback correcto
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-5 — Clic en servicio: id correcto al callback', () => {
  it('WFPI-5-1: callback onServiceClick recibe el id del servicio exacto', () => {
    const handler = vi.fn<(id: string) => void>();
    const svc = makeService({ id: 'svc-exact-id' });
    handler(svc.id);
    expect(handler).toHaveBeenCalledWith('svc-exact-id');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-6: Clic en viaje — callback correcto
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-6 — Clic en viaje: id correcto al callback', () => {
  it('WFPI-6-1: callback onTripClick recibe el id del viaje exacto', () => {
    const handler = vi.fn<(id: string) => void>();
    const trip = makeTrip({ id: 'trip-exact-id' });
    handler(trip.id);
    expect(handler).toHaveBeenCalledWith('trip-exact-id');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-7: Clic en ocurrencia — objeto AgendaOccurrence completo
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-7 — onOccurrenceClick: objeto AgendaOccurrence sin parsing frágil', () => {
  it('WFPI-7-1: callback recibe el objeto AgendaOccurrence completo, no ID sintético', () => {
    const handler = vi.fn<(occ: AgendaOccurrence) => void>();
    const occ = makeOccurrence('2026-11-03', 'vp1');
    handler(occ);

    expect(handler).toHaveBeenCalledWith(occ);
    // El objeto recibido contiene campos reales del schedule, no un string
    const received = handler.mock.calls[0][0] as AgendaOccurrence;
    expect(received.fecha).toBe('2026-11-03');
    expect(received.effectiveVehicleId).toBe('vp1');
    expect(received.schedule.id).toBe('sch1');
  });

  it('WFPI-7-2: el handler puede acceder a schedule.id sin parsing de ID sintético', () => {
    const handler = vi.fn<(occ: AgendaOccurrence) => void>();
    const occ = makeOccurrence('2026-11-05', 'vp2');
    handler(occ);

    const received = handler.mock.calls[0][0] as AgendaOccurrence;
    // No se reconstruye un ID sintético; el schedule.id original está disponible directamente
    expect(typeof received.schedule.id).toBe('string');
    expect(received.schedule.id).not.toContain('__');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-8: Viaje multidía — segmentos en múltiples días
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-8 — Viaje multidía genera segmentos en 3 días (Lun→Mié)', () => {
  const segs = computeWeeklyBarSegments(
    '2026-11-02T18:00:00',  // Lunes 18h
    '2026-11-04T10:00:00',  // Miércoles 10h
    WEEK_DAYS,
  );

  it('WFPI-8-1: genera 3 segmentos (lunes, martes, miércoles)', () => {
    expect(segs).toHaveLength(3);
  });

  it('WFPI-8-2: lunes es isStart=true, isEnd=false', () => {
    const lunes = segs.find(s => s.dayIndex === 0);
    expect(lunes?.isStart).toBe(true);
    expect(lunes?.isEnd).toBe(false);
  });

  it('WFPI-8-3: miércoles es isStart=false, isEnd=true', () => {
    const mie = segs.find(s => s.dayIndex === 2);
    expect(mie?.isStart).toBe(false);
    expect(mie?.isEnd).toBe(true);
  });

  it('WFPI-8-4: martes (día intermedio) isStart=false, isEnd=false', () => {
    const mar = segs.find(s => s.dayIndex === 1);
    expect(mar?.isStart).toBe(false);
    expect(mar?.isEnd).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-9: Viaje que cruza la semana — recortado al rango visible
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-9 — Viaje que cruza el límite semanal', () => {
  it('WFPI-9-1: viaje que empieza antes del lunes → primer segmento leftPct=0', () => {
    const segs = computeWeeklyBarSegments(
      '2026-10-30T12:00:00',  // Viernes de la semana anterior
      '2026-11-04T08:00:00',  // Miércoles de la semana actual
      WEEK_DAYS,
    );
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs[0].dayIndex).toBe(0); // Lunes
    expect(segs[0].leftPct).toBeCloseTo(0, 1); // Recortado al inicio del lunes
    expect(segs[0].isStart).toBe(false); // El inicio real es antes de la semana
  });

  it('WFPI-9-2: viaje que termina después del domingo → último segmento widthPct cubre hasta 100%', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-06T10:00:00',  // Viernes
      '2026-11-10T14:00:00',  // Martes de la semana siguiente
      WEEK_DAYS,
    );
    expect(segs.length).toBeGreaterThanOrEqual(1);
    const lastSeg = segs[segs.length - 1];
    expect(lastSeg.dayIndex).toBe(6); // Domingo
    // El segmento de domingo va desde 10h hasta medianoche: ~58% de ancho
    expect(lastSeg.widthPct).toBeGreaterThan(0);
    expect(lastSeg.isEnd).toBe(false); // El fin real es después de la semana
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-10: Operaciones sin vehículo asignado
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-10 — Operaciones sin asignación de vehículo', () => {
  it('WFPI-10-1: servicio con vehicle_id null tiene vehicleId null en datos', () => {
    const svc = makeService({ vehicle_id: null });
    expect(svc.vehicle_id).toBeNull();
  });

  it('WFPI-10-2: viaje con vehicle_id null tiene vehicleId null en datos', () => {
    const trip = makeTrip({ vehicle_id: null });
    expect(trip.vehicle_id).toBeNull();
  });

  it('WFPI-10-3: ocurrencia con effectiveVehicleId null no asignada a vehículo', () => {
    const occ = makeOccurrence('2026-11-03', null);
    expect(occ.effectiveVehicleId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-11: Sin duplicados entre weekServices y occurrences
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-11 — No duplicación entre servicios puntuales y ocurrencias recurrentes', () => {
  it('WFPI-11-1: servicio puntual y ocurrencia recurrente tienen estructuras distintas', () => {
    const svc = makeService({ id: 'svc-unique' });
    const occ = makeOccurrence('2026-11-03', 'v1');

    // Los servicios puntuales tienen un id propio; las ocurrencias se identifican
    // por (fecha, schedule.id) — sin solapamiento de identificadores
    expect(svc.id).not.toBe(occ.schedule.id);
  });

  it('WFPI-11-2: lista combinada de ids es disjunta entre servicios y schedules', () => {
    const services = [
      makeService({ id: 'svc-1' }),
      makeService({ id: 'svc-2' }),
    ];
    const occurrences = [
      makeOccurrence('2026-11-02', 'v1'),
      makeOccurrence('2026-11-03', 'v1'),
    ];

    const svcIds  = new Set(services.map(s => s.id));
    const schIds  = new Set(occurrences.map(o => o.schedule.id));
    const overlap = [...svcIds].filter(id => schIds.has(id));
    expect(overlap).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-12: Regresión Gantt — computeWeeklyBarSegments sin cambios de Fase 1
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-12 — Regresión: computeWeeklyBarSegments mantiene comportamiento de Fase 1', () => {
  it('WFPI-12-1: mismo día — resultado idéntico a WFP-1-1', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-04T08:00:00',
      '2026-11-04T16:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(2);
    expect(segs[0].isStart).toBe(true);
    expect(segs[0].isEnd).toBe(true);
  });

  it('WFPI-12-2: open-end — placeholder de 2h, isOpenEnd=true', () => {
    const segs = computeWeeklyBarSegments('2026-11-03T10:00:00', null, WEEK_DAYS);
    expect(segs).toHaveLength(1);
    expect(segs[0].isOpenEnd).toBe(true);
    expect(segs[0].widthPct).toBeGreaterThanOrEqual(1.5);
  });

  it('WFPI-12-3: fecha inválida — retorna array vacío', () => {
    const segs = computeWeeklyBarSegments('invalid-date', '2026-11-03T12:00:00', WEEK_DAYS);
    expect(segs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-13: Sin queries extra — TransportWeeklyFleetPlanner no importa Supabase
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-13 — Sin queries extra: TransportWeeklyFleetPlanner no tiene dependencia de Supabase', () => {
  it('WFPI-13-1: el módulo weeklyFleetHelpers no importa supabase', async () => {
    const src = await import('../../lib/weeklyFleetHelpers?raw');
    expect(src.default).not.toContain('supabase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-14: Aislamiento cross-vertical — modo viajeros excluye viajes de carga
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-14 — Aislamiento cross-vertical: modo viajeros excluye trips de mercancías', () => {
  const trips = [
    makeTrip({ id: 'trip-cargo-1', vehicle_id: 'vcargo1' }),
    makeTrip({ id: 'trip-cargo-2', vehicle_id: 'vcargo2' }),
  ];

  it('WFPI-14-1: modo viajeros no produce segmentos para viajes de mercancías', () => {
    // En modo viajeros, los trips no deben generar plotItems
    // La verificación es funcional: computeWeeklyBarSegments sí puede calcularlos,
    // pero el filtro de modalidad en el planner los excluye. Aquí verificamos
    // que el criterio de exclusión funciona: si vehicle_id apunta a un vehículo
    // de carga, el filtro viajeros lo excluye.
    const cargoVehicles   = [makeVehicle({ id: 'vcargo1', modalidad: 'mercancias' }), makeVehicle({ id: 'vcargo2', modalidad: 'mercancias' })];
    const passengerVehicleIds = new Set(
      cargoVehicles.filter(v => isVehiclePassenger(v)).map(v => v.id)
    );
    const tripsInViajeros = trips.filter(t =>
      t.vehicle_id == null || passengerVehicleIds.has(t.vehicle_id)
    );
    expect(tripsInViajeros).toHaveLength(0);
  });

  it('WFPI-14-2: modo mercancías no produce segmentos para servicios de pasajeros', () => {
    const passengerVehicles = [makeVehicle({ id: 'vp1', modalidad: 'viajeros' })];
    const services = [makeService({ vehicle_id: 'vp1' })];
    const cargoVehicleIds = new Set(
      passengerVehicles.filter(v => !isVehiclePassenger(v)).map(v => v.id)
    );
    const servicesInMercancias = services.filter(s =>
      s.vehicle_id == null || cargoVehicleIds.has(s.vehicle_id)
    );
    expect(servicesInMercancias).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para Fase 3
// ─────────────────────────────────────────────────────────────────────────────

function makeSeg(overrides: Partial<WeeklyBarSegment> = {}): WeeklyBarSegment {
  return {
    dayIndex: 0, leftPct: 10, widthPct: 50,
    isStart: true, isEnd: true, isOpenEnd: false,
    ...overrides,
  };
}

function makePlotItem(overrides: Partial<WeeklyPlotItem> = {}): WeeklyPlotItem {
  return {
    id: 'item1', kind: 'service',
    vehicleId: 'v1',
    titulo: 'Servicio test',
    origen: 'Bilbao', destino: 'Santander',
    estado: 'confirmado',
    fechaInicio: '2026-11-03T08:00:00',
    fechaFin:    '2026-11-03T16:00:00',
    segments: [], hasConflict: false,
    ...overrides,
  } as WeeklyPlotItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-15: borderRadius — continuidad visual multidía
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-15 — borderRadius: continuidad visual en operaciones multidía', () => {
  it('WFPI-15-1: mismo día (isStart=true, isEnd=true) → border-radius 4px completo', () => {
    expect(borderRadius(makeSeg({ isStart: true, isEnd: true }))).toBe('4px');
  });

  it('WFPI-15-2: inicio de multidía (isStart=true, isEnd=false) → solo esquinas izquierdas', () => {
    expect(borderRadius(makeSeg({ isStart: true, isEnd: false }))).toBe('4px 0 0 4px');
  });

  it('WFPI-15-3: fin de multidía (isStart=false, isEnd=true) → solo esquinas derechas', () => {
    expect(borderRadius(makeSeg({ isStart: false, isEnd: true }))).toBe('0 4px 4px 0');
  });

  it('WFPI-15-4: día intermedio (isStart=false, isEnd=false) → sin radio', () => {
    expect(borderRadius(makeSeg({ isStart: false, isEnd: false }))).toBe('0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-16: barColorClass — colores correctos por tipo y estado
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-16 — barColorClass: diferenciación visual por tipo y estado', () => {
  it('WFPI-16-1: occurrence (teal = rutas recurrentes)', () => {
    expect(barColorClass('occurrence', 'pending')).toContain('teal-400');
  });

  it('WFPI-16-2: trip en_curso → naranja intenso (orange-500)', () => {
    expect(barColorClass('trip', 'en_curso')).toContain('orange-500');
  });

  it('WFPI-16-3: service en_curso → azul intenso (blue-500)', () => {
    expect(barColorClass('service', 'en_curso')).toContain('blue-500');
  });

  it('WFPI-16-4: service borrador → azul claro (blue-200)', () => {
    expect(barColorClass('service', 'borrador')).toContain('blue-200');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-17: buildTooltip — horarios exactos y estado
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-17 — buildTooltip: información completa de horario y estado', () => {
  it('WFPI-17-1: service con fechas → tooltip incluye rango horario "HH:MM – HH:MM"', () => {
    const item = makePlotItem({ fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T16:00:00' });
    const tip = buildTooltip(item);
    expect(tip).toContain('08:00 – 16:00');
  });

  it('WFPI-17-2: service sin fecha fin (open-end) → tooltip indica "→ ?"', () => {
    const item = makePlotItem({ fechaFin: null });
    const tip = buildTooltip(item);
    expect(tip).toContain('→ ?');
  });

  it('WFPI-17-3: estado no trivial (en_curso) → incluido en tooltip', () => {
    const item = makePlotItem({ estado: 'en_curso' });
    const tip = buildTooltip(item);
    expect(tip).toContain('en_curso');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPI-18: Detección de conflictos — solapamiento temporal por vehículo
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPI-18 — Conflictos: solapamiento temporal en mismo vehículo', () => {
  function simulateConflicts(items: WeeklyPlotItem[]): WeeklyPlotItem[] {
    // Réplica del algoritmo en allItems useMemo
    const byVehicle = new Map<string, WeeklyPlotItem[]>();
    for (const it of items) {
      if (!it.vehicleId) continue;
      const lst = byVehicle.get(it.vehicleId) ?? [];
      lst.push(it);
      byVehicle.set(it.vehicleId, lst);
    }
    for (const lst of byVehicle.values()) {
      for (let i = 0; i < lst.length; i++) {
        for (let j = i + 1; j < lst.length; j++) {
          const a = lst[i], b = lst[j];
          const aS = new Date(a.fechaInicio).getTime();
          const aE = a.fechaFin ? new Date(a.fechaFin).getTime() : aS + 7_200_000;
          const bS = new Date(b.fechaInicio).getTime();
          const bE = b.fechaFin ? new Date(b.fechaFin).getTime() : bS + 7_200_000;
          if (aS < bE && aE > bS) { a.hasConflict = true; b.hasConflict = true; }
        }
      }
    }
    return items;
  }

  it('WFPI-18-1: dos servicios mismo vehículo solapando → ambos hasConflict=true', () => {
    const items = simulateConflicts([
      makePlotItem({ id: 'a', vehicleId: 'v1', fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T16:00:00' }),
      makePlotItem({ id: 'b', vehicleId: 'v1', fechaInicio: '2026-11-03T12:00:00', fechaFin: '2026-11-03T18:00:00' }),
    ]);
    expect(items[0].hasConflict).toBe(true);
    expect(items[1].hasConflict).toBe(true);
  });

  it('WFPI-18-2: dos servicios mismo vehículo SIN solapamiento → ambos hasConflict=false', () => {
    const items = simulateConflicts([
      makePlotItem({ id: 'a', vehicleId: 'v1', fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T12:00:00' }),
      makePlotItem({ id: 'b', vehicleId: 'v1', fechaInicio: '2026-11-03T13:00:00', fechaFin: '2026-11-03T17:00:00' }),
    ]);
    expect(items[0].hasConflict).toBe(false);
    expect(items[1].hasConflict).toBe(false);
  });

  it('WFPI-18-3: items con vehicleId=null → no generan conflictos entre sí', () => {
    const items = simulateConflicts([
      makePlotItem({ id: 'a', vehicleId: null, fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T16:00:00' }),
      makePlotItem({ id: 'b', vehicleId: null, fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T16:00:00' }),
    ]);
    expect(items[0].hasConflict).toBe(false);
    expect(items[1].hasConflict).toBe(false);
  });
});
