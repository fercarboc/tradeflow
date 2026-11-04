/**
 * weeklyFleetPlanner.test.ts — TX-TRANSPORT-WEEKLY-FLEET-1 Fase 1
 *
 * Pruebas de la función pura computeWeeklyBarSegments y de los filtros
 * de modalidad de vehículo.
 *
 * Semana de referencia: 2026-11-02 (lunes) → 2026-11-08 (domingo).
 */

import { describe, it, expect } from 'vitest';
import { computeWeeklyBarSegments } from '../../lib/weeklyFleetHelpers';
import { isVehiclePassenger, addDays, startOfWeek, isoDate } from '../../lib/transportPanelHelpers';

// ── Semana de referencia ──────────────────────────────────────────────────────

const BASE_MONDAY = new Date('2026-11-02T00:00:00'); // Lunes 2 nov 2026
const WEEK_DAYS   = Array.from({ length: 7 }, (_, i) => addDays(BASE_MONDAY, i));
// WEEK_DAYS[0] = Lun 2 nov
// WEEK_DAYS[1] = Mar 3 nov
// WEEK_DAYS[2] = Mié 4 nov
// WEEK_DAYS[3] = Jue 5 nov
// WEEK_DAYS[4] = Vie 6 nov
// WEEK_DAYS[5] = Sáb 7 nov
// WEEK_DAYS[6] = Dom 8 nov

// ── WFP-1: Operación en un mismo día ─────────────────────────────────────────

describe('WFP-1 — Operación dentro del mismo día', () => {
  it('WFP-1-1: servicio de 08:00 a 16:00 el miércoles — un segmento en columna 2', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-04T08:00:00',
      '2026-11-04T16:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(2); // Miércoles = índice 2
    expect(segs[0].leftPct).toBeCloseTo(8 / 24 * 100, 1);   // 33.33%
    expect(segs[0].widthPct).toBeCloseTo(8 / 24 * 100, 1);  // 33.33%
    expect(segs[0].isStart).toBe(true);
    expect(segs[0].isEnd).toBe(true);
    expect(segs[0].isOpenEnd).toBe(false);
  });

  it('WFP-1-2: borde redondeado en ambos extremos cuando isStart && isEnd', () => {
    const [seg] = computeWeeklyBarSegments(
      '2026-11-04T10:00:00',
      '2026-11-04T12:00:00',
      WEEK_DAYS,
    );
    expect(seg.isStart).toBe(true);
    expect(seg.isEnd).toBe(true);
  });

  it('WFP-1-3: medianoche exacta — 00:00→24:00 ocupa el 100% de la columna', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-04T00:00:00',
      '2026-11-05T00:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(2); // Miércoles
    expect(segs[0].leftPct).toBeCloseTo(0, 1);
    expect(segs[0].widthPct).toBeCloseTo(100, 0);
  });
});

// ── WFP-2: Viaje multidía ─────────────────────────────────────────────────────

describe('WFP-2 — Viaje multidía Mar 17:00 → Jue 10:00', () => {
  const segs = computeWeeklyBarSegments(
    '2026-11-03T17:00:00',
    '2026-11-05T10:00:00',
    WEEK_DAYS,
  );

  it('WFP-2-1: genera exactamente 3 segmentos', () => {
    expect(segs).toHaveLength(3);
  });

  it('WFP-2-2: martes — arranca en ~71%, llena hasta medianoche, isStart=true, isEnd=false', () => {
    const [seg] = segs;
    expect(seg.dayIndex).toBe(1); // Martes
    expect(seg.leftPct).toBeCloseTo(17 / 24 * 100, 0); // 70.83%
    // El viaje sale el martes y el rango visible termina en medianoche del martes
    expect(seg.leftPct + seg.widthPct).toBeCloseTo(100, 0);
    expect(seg.isStart).toBe(true);
    expect(seg.isEnd).toBe(false);
  });

  it('WFP-2-3: miércoles — fila completa (0%–100%), isStart=false, isEnd=false', () => {
    const seg = segs[1];
    expect(seg.dayIndex).toBe(2); // Miércoles
    expect(seg.leftPct).toBeCloseTo(0, 1);
    expect(seg.widthPct).toBeCloseTo(100, 0);
    expect(seg.isStart).toBe(false);
    expect(seg.isEnd).toBe(false);
  });

  it('WFP-2-4: jueves — arranca en 0%, termina en ~42%, isStart=false, isEnd=true', () => {
    const seg = segs[2];
    expect(seg.dayIndex).toBe(3); // Jueves
    expect(seg.leftPct).toBeCloseTo(0, 1);
    expect(seg.widthPct).toBeCloseTo(10 / 24 * 100, 0); // 41.67%
    expect(seg.isStart).toBe(false);
    expect(seg.isEnd).toBe(true);
  });
});

// ── WFP-3: Operación que empieza antes de la semana ──────────────────────────

describe('WFP-3 — Operación que empieza antes del lunes', () => {
  it('WFP-3-1: viaje Dom 20:00 → Lun 10:00 — solo un segmento en lunes, leftPct=0', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-01T20:00:00', // Domingo semana anterior
      '2026-11-02T10:00:00', // Lunes inicio de semana
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(0); // Lunes
    expect(segs[0].leftPct).toBeCloseTo(0, 1);
    expect(segs[0].widthPct).toBeCloseTo(10 / 24 * 100, 0); // hasta las 10:00
    expect(segs[0].isStart).toBe(false); // el inicio no cae en este día
    expect(segs[0].isEnd).toBe(true);
  });
});

// ── WFP-4: Operación que termina después de la semana ────────────────────────

describe('WFP-4 — Operación que termina después del domingo', () => {
  it('WFP-4-1: viaje Sáb 18:00 → Lun siguiente 09:00 — 2 segmentos (Sáb+Dom)', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-07T18:00:00', // Sábado
      '2026-11-09T09:00:00', // Lunes de semana siguiente
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(2);
    expect(segs[0].dayIndex).toBe(5); // Sábado
    expect(segs[0].isStart).toBe(true);
    expect(segs[0].isEnd).toBe(false);

    expect(segs[1].dayIndex).toBe(6); // Domingo
    expect(segs[1].leftPct).toBeCloseTo(0, 1);
    // El viaje continúa el lunes: el domingo se rellena hasta medianoche
    expect(segs[1].widthPct).toBeCloseTo(100, 0);
    expect(segs[1].isEnd).toBe(false); // el fin real no está en este día
  });
});

// ── WFP-5: Operación con fecha_fin null (open-ended) ─────────────────────────

describe('WFP-5 — Operación sin hora de fin (fecha_fin null)', () => {
  it('WFP-5-1: genera un segmento con isOpenEnd=true y ancho ≈ 2h', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T10:00:00',
      null,
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].isOpenEnd).toBe(true);
    expect(segs[0].isEnd).toBe(false); // no hay fin real
    expect(segs[0].widthPct).toBeCloseTo(2 / 24 * 100, 0); // ≈ 8.33%
  });

  it('WFP-5-2: undefined fecha_fin tratado igual que null', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T10:00:00',
      undefined,
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].isOpenEnd).toBe(true);
  });
});

// ── WFP-6: Operación completamente fuera de la semana ────────────────────────

describe('WFP-6 — Operación fuera del rango semanal', () => {
  it('WFP-6-1: viaje del 10 al 12 nov — devuelve [] (semana es 2-8 nov)', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-10T08:00:00',
      '2026-11-12T18:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(0);
  });

  it('WFP-6-2: viaje del 25 al 30 oct (semana anterior) — devuelve []', () => {
    const segs = computeWeeklyBarSegments(
      '2026-10-25T08:00:00',
      '2026-10-30T18:00:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(0);
  });
});

// ── WFP-7: Fecha inválida ─────────────────────────────────────────────────────

describe('WFP-7 — fecha_inicio inválida', () => {
  it('WFP-7-1: devuelve [] sin lanzar excepción', () => {
    const segs = computeWeeklyBarSegments('not-a-date', '2026-11-05T10:00:00', WEEK_DAYS);
    expect(segs).toHaveLength(0);
  });

  it('WFP-7-2: string vacío devuelve []', () => {
    const segs = computeWeeklyBarSegments('', '2026-11-05T10:00:00', WEEK_DAYS);
    expect(segs).toHaveLength(0);
  });
});

// ── WFP-8: Operación que cubre toda la semana ─────────────────────────────────

describe('WFP-8 — Operación que abarca la semana entera', () => {
  it('WFP-8-1: 7 segmentos, todos leftPct≈0 y widthPct≈100', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-01T00:00:00', // antes de la semana
      '2026-11-09T00:00:00', // después de la semana
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(7);
    for (const seg of segs) {
      expect(seg.leftPct).toBeCloseTo(0, 1);
      expect(seg.widthPct).toBeCloseTo(100, 0);
    }
  });
});

// ── WFP-9: Cruce de semana (viaje empieza domingo y termina siguiente lunes) ──

describe('WFP-9 — Viaje que cruza el límite Dom→Lun de la semana visible', () => {
  it('WFP-9-1: Dom 22:00 → siguiente semana Lun 08:00 — solo segmento en Dom', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-08T22:00:00', // Domingo de la semana
      '2026-11-09T08:00:00', // Lunes siguiente — fuera de esta semana
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].dayIndex).toBe(6); // Domingo
    expect(segs[0].isStart).toBe(true);
    expect(segs[0].isEnd).toBe(false); // fin está el lunes (fuera del rango)
    expect(segs[0].leftPct).toBeCloseTo(22 / 24 * 100, 0);
  });
});

// ── WFP-10: Operaciones consecutivas mismo vehículo (no conflicto) ────────────

describe('WFP-10 — Dos servicios consecutivos en el mismo día', () => {
  it('WFP-10-1: mañana 08:00–12:00 y tarde 14:00–18:00 no se solapan', () => {
    const segs1 = computeWeeklyBarSegments('2026-11-02T08:00:00', '2026-11-02T12:00:00', WEEK_DAYS);
    const segs2 = computeWeeklyBarSegments('2026-11-02T14:00:00', '2026-11-02T18:00:00', WEEK_DAYS);
    expect(segs1).toHaveLength(1);
    expect(segs2).toHaveLength(1);
    const end1   = segs1[0].leftPct + segs1[0].widthPct;
    const start2 = segs2[0].leftPct;
    // Los segmentos no se solapan: end1 <= start2
    expect(end1).toBeLessThanOrEqual(start2 + 0.1); // 0.1 de tolerancia por float
  });
});

// ── WFP-11: widthPct siempre ≥ 1.5 (siempre visible) ────────────────────────

describe('WFP-11 — Anchura mínima garantizada', () => {
  it('WFP-11-1: operación de 1 minuto tiene widthPct >= 1.5', () => {
    const segs = computeWeeklyBarSegments(
      '2026-11-03T10:00:00',
      '2026-11-03T10:01:00',
      WEEK_DAYS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].widthPct).toBeGreaterThanOrEqual(1.5);
  });
});

// ── WFP-12: Filtros de modalidad de vehículo ─────────────────────────────────

describe('WFP-12 — Filtros de modalidad de vehículo', () => {
  function isCargo(v: { modalidad: string }): boolean {
    return v.modalidad === 'mercancias' || v.modalidad === 'reparto' || v.modalidad === 'mixto';
  }

  const bus    = { modalidad: 'viajeros'   };
  const truck  = { modalidad: 'mercancias' };
  const mixed  = { modalidad: 'mixto'      };
  const van    = { modalidad: 'reparto'    };

  it('WFP-12-1: isVehiclePassenger — viajeros y mixto devuelven true', () => {
    expect(isVehiclePassenger(bus)).toBe(true);
    expect(isVehiclePassenger(mixed)).toBe(true);
    expect(isVehiclePassenger(truck)).toBe(false);
    expect(isVehiclePassenger(van)).toBe(false);
  });

  it('WFP-12-2: isCargo — mercancias, reparto y mixto devuelven true', () => {
    expect(isCargo(truck)).toBe(true);
    expect(isCargo(van)).toBe(true);
    expect(isCargo(mixed)).toBe(true);
    expect(isCargo(bus)).toBe(false);
  });

  it('WFP-12-3: vehículo mixto aparece en ambas categorías', () => {
    expect(isVehiclePassenger(mixed)).toBe(true);
    expect(isCargo(mixed)).toBe(true);
  });

  it('WFP-12-4: vehículo viajeros no es cargo', () => {
    expect(isCargo(bus)).toBe(false);
  });
});

// ── WFP-13: startOfWeek y addDays producen la semana correcta ────────────────

describe('WFP-13 — Helpers de semana', () => {
  it('WFP-13-1: startOfWeek de un miércoles devuelve el lunes de la misma semana', () => {
    const wed = new Date('2026-11-04T12:00:00'); // Miércoles
    const mon = startOfWeek(wed);
    expect(isoDate(mon)).toBe('2026-11-02');
  });

  it('WFP-13-2: startOfWeek de un lunes devuelve ese mismo lunes', () => {
    const mon = startOfWeek(new Date('2026-11-02T08:00:00'));
    expect(isoDate(mon)).toBe('2026-11-02');
  });

  it('WFP-13-3: addDays(lunes, 6) devuelve el domingo de la misma semana', () => {
    expect(isoDate(addDays(BASE_MONDAY, 6))).toBe('2026-11-08');
  });
});
