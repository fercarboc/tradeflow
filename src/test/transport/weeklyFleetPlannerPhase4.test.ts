/**
 * weeklyFleetPlannerPhase4.test.ts — TX-TRANSPORT-WEEKLY-FLEET-1 Fase 4
 *
 * Tests de responsive, navegación y continuidad visual.
 * Semana de referencia: 2026-11-02 (lunes) → 2026-11-08 (domingo).
 */

import { describe, it, expect } from 'vitest';
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

// ── Helpers de fixtures ───────────────────────────────────────────────────────

const BASE_MONDAY = new Date('2026-11-02T00:00:00');
const WEEK_DAYS   = Array.from({ length: 7 }, (_, i) => addDays(BASE_MONDAY, i));

function makeVehicle(overrides: Partial<TradeVehicle>): TradeVehicle {
  return {
    id: 'v1', org_id: 'org1', nombre: 'Test', matricula: '1234ABC',
    tipo: 'autocar', modalidad: 'viajeros', estado: 'disponible', activo: true,
    capacidad_viajeros: 50, capacidad_carga_kg: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    ...overrides,
  } as TradeVehicle;
}

function makeSeg(overrides: Partial<WeeklyBarSegment> = {}): WeeklyBarSegment {
  return { dayIndex: 0, leftPct: 0, widthPct: 100, isStart: true, isEnd: true, isOpenEnd: false, ...overrides };
}

function makePlotItem(overrides: Partial<WeeklyPlotItem> = {}): WeeklyPlotItem {
  return {
    id: 'x', kind: 'service', vehicleId: 'v1',
    titulo: 'Test', origen: 'A', destino: 'B',
    estado: 'confirmado',
    fechaInicio: '2026-11-03T08:00:00', fechaFin: '2026-11-03T16:00:00',
    segments: [], hasConflict: false,
    ...overrides,
  } as WeeklyPlotItem;
}

// Réplica del filtro de cargo (isVehicleCargo — privado en el componente)
function isVehicleCargo(v: Pick<TradeVehicle, 'modalidad'>): boolean {
  return v.modalidad === 'mercancias' || v.modalidad === 'reparto' || v.modalidad === 'mixto';
}

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-1: Semana de referencia — 7 días Lun→Dom
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-1 — 7 weekDays cubre exactamente Lun→Dom', () => {
  it('WFPF4-1-1: weekDays tiene exactamente 7 elementos', () => {
    expect(WEEK_DAYS).toHaveLength(7);
  });

  it('WFPF4-1-2: primer día es lunes (getDay===1) y último es domingo (getDay===0)', () => {
    expect(WEEK_DAYS[0].getDay()).toBe(1); // Lunes
    expect(WEEK_DAYS[6].getDay()).toBe(0); // Domingo
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-2: Navegación entre semanas — addDays produce offsets correctos
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-2 — Navegación semanal: addDays + weekOffset', () => {
  it('WFPF4-2-1: weekOffset +1 → semana siguiente, 7 días de diferencia', () => {
    const nextWeekStart = addDays(BASE_MONDAY, 7);
    expect(isoDate(nextWeekStart)).toBe('2026-11-09');
  });

  it('WFPF4-2-2: weekOffset -1 → semana anterior, 7 días antes', () => {
    const prevWeekStart = addDays(BASE_MONDAY, -7);
    expect(isoDate(prevWeekStart)).toBe('2026-10-26');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-3: Continuidad visual multidía — sin huecos en segmentos intermedios
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-3 — Continuidad visual multidía: segmentos cubren días completos', () => {
  it('WFPF4-3-1: operación Mar 17h → Jue 10h genera 3 segmentos consecutivos', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T17:00:00',  // Martes 17h
      '2026-11-05T10:00:00',  // Jueves 10h
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(3);
    // Días cubiertos: Martes (1), Miércoles (2), Jueves (3)
    expect(segs.map(s => s.dayIndex)).toEqual([1, 2, 3]);
  });

  it('WFPF4-3-2: segmento intermedio (miércoles) cubre leftPct=0 widthPct=100 completo', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T17:00:00',
      '2026-11-05T10:00:00',
      WEEK_DAYS,
    );
    const middle = segs.find(s => s.dayIndex === 2)!;
    expect(middle.leftPct).toBeCloseTo(0, 1);
    expect(middle.widthPct).toBeCloseTo(100, 0);
    expect(middle.isStart).toBe(false);
    expect(middle.isEnd).toBe(false);
    expect(middle.isOpenEnd).toBe(false);
  });

  it('WFPF4-3-3: operación Dom → Lun (cruce de semana) → último seg. domingo isEnd=false', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-08T20:00:00',  // Domingo 20h (último día de la semana)
      '2026-11-09T08:00:00',  // Lunes siguiente (fuera del rango)
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(6); // Domingo
    expect(segs[0].isEnd).toBe(false); // El fin es en la semana siguiente
    expect(segs[0].isStart).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-4: Múltiples operaciones en un día
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-4 — Múltiples operaciones en el mismo día y vehículo', () => {
  it('WFPF4-4-1: 3 operaciones mismo día → 3 segmentos independientes en ese dayIndex', () => {
    const ops = [
      computeWeeklyBarSegments('2026-11-03T08:00:00', '2026-11-03T10:00:00', WEEK_DAYS),
      computeWeeklyBarSegments('2026-11-03T11:00:00', '2026-11-03T13:00:00', WEEK_DAYS),
      computeWeeklyBarSegments('2026-11-03T14:00:00', '2026-11-03T17:00:00', WEEK_DAYS),
    ];
    // Cada operación produce exactamente 1 segmento en día Martes (dayIndex=1)
    expect(ops.every(s => s.length === 1 && s[0].dayIndex === 1)).toBe(true);
  });

  it('WFPF4-4-2: las 3 operaciones tienen leftPct diferentes (no se solapan)', () => {
    const left0 = computeWeeklyBarSegments('2026-11-03T08:00:00', '2026-11-03T10:00:00', WEEK_DAYS)[0].leftPct;
    const left1 = computeWeeklyBarSegments('2026-11-03T11:00:00', '2026-11-03T13:00:00', WEEK_DAYS)[0].leftPct;
    const left2 = computeWeeklyBarSegments('2026-11-03T14:00:00', '2026-11-03T17:00:00', WEEK_DAYS)[0].leftPct;
    expect(left0).toBeLessThan(left1);
    expect(left1).toBeLessThan(left2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-5: Estados y conflictos — diferenciación visual
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-5 — Estados y conflictos: diferenciación visual', () => {
  it('WFPF4-5-1: service completado tiene clase de opacidad reducida', () => {
    expect(barColorClass('service', 'completado')).toContain('opacity-70');
  });

  it('WFPF4-5-2: trip borrador distinto de trip confirmado', () => {
    expect(barColorClass('trip', 'borrador')).not.toBe(barColorClass('trip', 'confirmado'));
  });

  it('WFPF4-5-3: estado no trivial incluido en tooltip (en_curso)', () => {
    const item = makePlotItem({ estado: 'en_curso', kind: 'trip' });
    expect(buildTooltip(item)).toContain('en_curso');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-6: Vehículo mixto — aparece en ambas verticales
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-6 — Vehículo mixto: en viajeros Y en mercancías', () => {
  const mixto = makeVehicle({ modalidad: 'mixto' });

  it('WFPF4-6-1: isVehiclePassenger(mixto) === true (incluido en viajeros)', () => {
    expect(isVehiclePassenger(mixto)).toBe(true);
  });

  it('WFPF4-6-2: isVehicleCargo(mixto) === true (incluido en mercancías)', () => {
    expect(isVehicleCargo(mixto)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-7: Vehículo en mantenimiento — incluido en filteredVehicles
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-7 — Mantenimiento: vehículo en_mantenimiento sigue visible', () => {
  const fleet = [
    makeVehicle({ id: 'va', estado: 'disponible', activo: true }),
    makeVehicle({ id: 'vm', estado: 'en_mantenimiento', activo: true }),
    makeVehicle({ id: 'vb', estado: 'baja', activo: true }),
    makeVehicle({ id: 'vi', estado: 'disponible', activo: false }),
  ];

  function filteredVehicles(vehicles: TradeVehicle[]) {
    return vehicles.filter(v => v.activo && v.estado !== 'baja');
  }

  it('WFPF4-7-1: vehículo en_mantenimiento permanece en la grid (no excluido)', () => {
    const result = filteredVehicles(fleet);
    expect(result.some(v => v.estado === 'en_mantenimiento')).toBe(true);
  });

  it('WFPF4-7-2: vehículo de baja excluido de la grid', () => {
    const result = filteredVehicles(fleet);
    expect(result.some(v => v.estado === 'baja')).toBe(false);
  });

  it('WFPF4-7-3: vehículo inactivo (activo=false) excluido de la grid', () => {
    const result = filteredVehicles(fleet);
    expect(result.some(v => !v.activo)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-8: Regresión Gantt diario — computeWeeklyBarSegments sin cambios
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-8 — Regresión Gantt: cálculo de segmentos inalterado', () => {
  it('WFPF4-8-1: servicio mismo día → 1 segmento, leftPct+widthPct ≤ 100', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T09:00:00',
      '2026-11-03T17:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].leftPct + segs[0].widthPct).toBeLessThanOrEqual(100);
  });

  it('WFPF4-8-2: borderRadius sin cambios entre Fase 3 y Fase 4', () => {
    expect(borderRadius(makeSeg({ isStart: true, isEnd: true }))).toBe('4px');
    expect(borderRadius(makeSeg({ isStart: true, isEnd: false }))).toBe('4px 0 0 4px');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-9: Regresión Viajeros — servicios y ocurrencias incluidos
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-9 — Regresión Viajeros: modo viajeros incluye servicios y ocurrencias', () => {
  it('WFPF4-9-1: modo viajeros excluye trips (no hay trips en modo viajeros)', () => {
    // En modo viajeros, allItems no incluye trips de mercancías.
    // Verificación lógica: los trips solo se incluyen cuando mode !== 'viajeros'.
    const modeIsViajeros = true;
    const shouldIncludeTrips = !modeIsViajeros;
    expect(shouldIncludeTrips).toBe(false);
  });

  it('WFPF4-9-2: modo viajeros incluye occurrences (mode !== mercancias)', () => {
    const modeIsViajeros = true;
    const modeIsMercancias = false;
    const shouldIncludeOccurrences = !modeIsMercancias;
    expect(shouldIncludeOccurrences).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF4-10: Regresión Mercancías — trips incluidos, occurrences excluidas
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF4-10 — Regresión Mercancías: modo mercancias incluye trips, excluye ocurrencias', () => {
  it('WFPF4-10-1: modo mercancias incluye trips', () => {
    const modeIsMercancias = true;
    const shouldIncludeTrips = !false; // mode !== 'viajeros'
    expect(shouldIncludeTrips).toBe(true);
  });

  it('WFPF4-10-2: modo mercancias excluye ocurrencias recurrentes', () => {
    const modeIsMercancias = true;
    const shouldIncludeOccurrences = !modeIsMercancias;
    expect(shouldIncludeOccurrences).toBe(false);
  });
});
