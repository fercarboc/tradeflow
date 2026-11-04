/**
 * weeklyFleetPlannerDensity.test.ts — TX-TRANSPORT-WEEKLY-FLEET-1 Height & Density Fix
 *
 * Cubre: altura mínima de filas, 7 vehículos visibles, viewport dinámico,
 * scroll con 10 y 30 vehículos, varias operaciones por vehículo, barras multidía,
 * ausencia de operaciones ocultas, responsive y regresión de los tres modos.
 *
 * Semana de referencia: 2026-11-02 (lunes) → 2026-11-08 (domingo).
 */

import { describe, it, expect } from 'vitest';
import {
  BAR_H,
  BAR_GAP,
  ROW_PAD,
  MIN_ROW_H,
  VISIBLE_ROWS,
  HEADER_H,
} from '../../components/TransportWeeklyFleetPlanner';
import { computeWeeklyBarSegments } from '../../lib/weeklyFleetHelpers';
import { addDays, isoDate } from '../../lib/transportPanelHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEK_START = new Date('2026-11-02T00:00:00');
const weekDays = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

/** Replica la función rowHeightPx del componente para un número de lanes. */
function computeRowHeight(lanes: number): number {
  return Math.max(MIN_ROW_H, lanes * (BAR_H + BAR_GAP) + ROW_PAD * 2);
}

/** Replica computeBarTop para verificar posicionamiento. */
function computeBarTop(laneIdx: number): number {
  return ROW_PAD + laneIdx * (BAR_H + BAR_GAP);
}

/**
 * Replica viewportHeight del componente dada una lista de rowH por vehículo.
 * El componente usa filteredVehicles.slice(0, VISIBLE_ROWS) + rowHeightPx.
 */
function computeViewportHeight(rowHeights: number[]): number {
  const topN  = rowHeights.slice(0, VISIBLE_ROWS);
  const rowsH = topN.reduce((sum, h) => sum + h, 0);
  return rowsH + HEADER_H;
}

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-1: Constantes de densidad dentro de rango objetivo
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-1 — Constantes de densidad en rango objetivo', () => {
  it('WFPD-1-1: MIN_ROW_H >= 58 px', () => {
    expect(MIN_ROW_H).toBeGreaterThanOrEqual(58);
  });

  it('WFPD-1-2: MIN_ROW_H <= 70 px', () => {
    expect(MIN_ROW_H).toBeLessThanOrEqual(70);
  });

  it('WFPD-1-3: BAR_H >= 16 px (legible en táctil)', () => {
    expect(BAR_H).toBeGreaterThanOrEqual(16);
  });

  it('WFPD-1-4: HEADER_H > 0', () => {
    expect(HEADER_H).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-2: 7 vehículos visibles
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-2 — VISIBLE_ROWS = 7', () => {
  it('WFPD-2-1: VISIBLE_ROWS === 7', () => {
    expect(VISIBLE_ROWS).toBe(7);
  });

  it('WFPD-2-2: 7 vehículos sin operaciones — viewport = 7×MIN_ROW_H + HEADER_H', () => {
    const rows = Array(7).fill(MIN_ROW_H);
    expect(computeViewportHeight(rows)).toBe(7 * MIN_ROW_H + HEADER_H);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-3: Viewport dinámico — 7 vehículos con 2 operaciones cada uno
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-3 — Viewport dinámico: 7 vehículos con 2 operaciones', () => {
  const rowH2ops = computeRowHeight(2); // > MIN_ROW_H

  it('WFPD-3-1: rowH con 2 operaciones es mayor que MIN_ROW_H', () => {
    expect(rowH2ops).toBeGreaterThan(MIN_ROW_H);
  });

  it('WFPD-3-2: viewport = 7×rowH2ops + HEADER_H cuando todos tienen 2 ops', () => {
    const rows  = Array(7).fill(rowH2ops);
    expect(computeViewportHeight(rows)).toBe(7 * rowH2ops + HEADER_H);
  });

  it('WFPD-3-3: viewport dinámico > viewport estático (7×MIN_ROW_H + HEADER_H)', () => {
    const rows      = Array(7).fill(rowH2ops);
    const dynamic   = computeViewportHeight(rows);
    const staticVH  = 7 * MIN_ROW_H + HEADER_H;
    expect(dynamic).toBeGreaterThan(staticVH);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-4: 7 vehículos con alturas variables — el viewport las suma todas
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-4 — Viewport con 7 filas de alturas variables', () => {
  it('WFPD-4-1: sum exacta de las primeras 7 alturas + HEADER_H', () => {
    const rows = [64, 74, 99, 64, 74, 64, 99]; // 7 alturas mixtas
    const expected = rows.reduce((s, h) => s + h, 0) + HEADER_H;
    expect(computeViewportHeight(rows)).toBe(expected);
  });

  it('WFPD-4-2: solo se suman las primeras 7 filas aunque haya más', () => {
    const rows = [64, 64, 64, 64, 64, 64, 64, 99, 99, 99]; // 10 vehículos
    const expected = 7 * 64 + HEADER_H;
    expect(computeViewportHeight(rows)).toBe(expected);
  });

  it('WFPD-4-3: si hay menos de 7, se suman las que hay', () => {
    const rows = [64, 74, 64]; // solo 3 vehículos
    const expected = 64 + 74 + 64 + HEADER_H;
    expect(computeViewportHeight(rows)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-5: Scroll con 10 y 30 vehículos
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-5 — Scroll interno con 10 y 30 vehículos', () => {
  it('WFPD-5-1: 10 vehículos a MIN_ROW_H — total contenido > viewport', () => {
    const viewport     = computeViewportHeight(Array(10).fill(MIN_ROW_H));
    const totalContent = 10 * MIN_ROW_H + HEADER_H;
    expect(totalContent).toBeGreaterThan(viewport);
  });

  it('WFPD-5-2: 30 vehículos a MIN_ROW_H — total contenido > viewport', () => {
    const viewport     = computeViewportHeight(Array(30).fill(MIN_ROW_H));
    const totalContent = 30 * MIN_ROW_H + HEADER_H;
    expect(totalContent).toBeGreaterThan(viewport);
  });

  it('WFPD-5-3: 7 vehículos a MIN_ROW_H — total contenido == viewport (sin scroll)', () => {
    const viewport     = computeViewportHeight(Array(7).fill(MIN_ROW_H));
    const totalContent = 7 * MIN_ROW_H + HEADER_H;
    expect(totalContent).toBe(viewport);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-6: Posicionamiento vertical de barras sin desbordamiento
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-6 — Las barras no desbordan la altura de la fila', () => {
  it('WFPD-6-1: 1 banda: bottom <= rowHeight(1)', () => {
    const bottom = computeBarTop(0) + BAR_H;
    expect(bottom).toBeLessThanOrEqual(computeRowHeight(1));
  });

  it('WFPD-6-2: 2 bandas: bottom de la última <= rowHeight(2)', () => {
    const bottom = computeBarTop(1) + BAR_H;
    expect(bottom).toBeLessThanOrEqual(computeRowHeight(2));
  });

  it('WFPD-6-3: posición top de la primera banda = ROW_PAD', () => {
    expect(computeBarTop(0)).toBe(ROW_PAD);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-7: Barras multidía — continuidad de segmentos
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-7 — Barras multidía producen segmentos en cada columna', () => {
  it('WFPD-7-1: servicio Lun→Jue produce 4 segmentos', () => {
    const segs = computeWeeklyBarSegments('2026-11-02T08:00:00', '2026-11-05T18:00:00', weekDays);
    expect(segs).toHaveLength(4);
  });

  it('WFPD-7-2: primer segmento isStart=true, último isEnd=true', () => {
    const segs = computeWeeklyBarSegments('2026-11-03T08:00:00', '2026-11-07T18:00:00', weekDays);
    expect(segs[0].isStart).toBe(true);
    expect(segs[segs.length - 1].isEnd).toBe(true);
  });

  it('WFPD-7-3: segmentos toda la semana — dayIndex consecutivos 0→6', () => {
    const segs = computeWeeklyBarSegments('2026-11-02T08:00:00', '2026-11-08T18:00:00', weekDays);
    expect(segs).toHaveLength(7);
    for (let i = 0; i < segs.length; i++) {
      expect(segs[i].dayIndex).toBe(i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-8: Responsive — constantes razonables para móvil
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-8 — Constantes razonables para móvil', () => {
  it('WFPD-8-1: MIN_ROW_H <= 80 px (no excesivo en pantalla pequeña)', () => {
    expect(MIN_ROW_H).toBeLessThanOrEqual(80);
  });

  it('WFPD-8-2: Viewport de 7 filas min cabe en una pantalla tablet (768px)', () => {
    const viewport = computeViewportHeight(Array(7).fill(MIN_ROW_H));
    // Con 80vh en tablet 768px: 0.8 * 768 = 614px — el viewport mínimo debe ser ≤ esto
    expect(viewport).toBeLessThanOrEqual(614);
  });

  it('WFPD-8-3: Viewport de 7 filas con 2 ops cabe en pantalla de 900px (80vh)', () => {
    const rowH2 = computeRowHeight(2);
    const viewport = computeViewportHeight(Array(7).fill(rowH2));
    // 80vh en 900px: 720px
    expect(viewport).toBeLessThanOrEqual(720);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-9: Ausencia de operaciones ocultas
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-9 — computeWeeklyBarSegments incluye todos los días cubiertos', () => {
  it('WFPD-9-1: servicio toda la semana → 7 segmentos', () => {
    const segs = computeWeeklyBarSegments('2026-11-02T00:00:00', '2026-11-08T23:59:00', weekDays);
    expect(segs).toHaveLength(7);
  });

  it('WFPD-9-2: servicio 1 día → 1 segmento', () => {
    const segs = computeWeeklyBarSegments('2026-11-04T08:00:00', '2026-11-04T18:00:00', weekDays);
    expect(segs).toHaveLength(1);
  });

  it('WFPD-9-3: open-end (sin fecha fin) → al menos 1 segmento', () => {
    const segs = computeWeeklyBarSegments('2026-11-04T08:00:00', null, weekDays);
    expect(segs.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPD-10: Regresión modos General, Viajeros y Mercancías
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPD-10 — Regresión modos General, Viajeros y Mercancías', () => {
  it('WFPD-10-1: segmentos en rango [0, 6] para los tres tipos de operación', () => {
    const svc  = computeWeeklyBarSegments('2026-11-03T08:00:00', '2026-11-03T18:00:00', weekDays);
    const occ  = computeWeeklyBarSegments('2026-11-04T08:00:00', null, weekDays);
    const trip = computeWeeklyBarSegments('2026-11-05T08:00:00', '2026-11-07T20:00:00', weekDays);
    for (const seg of [...svc, ...occ, ...trip]) {
      expect(seg.dayIndex).toBeGreaterThanOrEqual(0);
      expect(seg.dayIndex).toBeLessThanOrEqual(6);
    }
  });

  it('WFPD-10-2: Mercancías multidía — segmentos ordenados por dayIndex', () => {
    const segs = computeWeeklyBarSegments('2026-11-03T06:00:00', '2026-11-07T22:00:00', weekDays);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].dayIndex).toBeGreaterThan(segs[i - 1].dayIndex);
    }
  });

  it('WFPD-10-3: altura de fila crece con operaciones adicionales (invariante de densidad)', () => {
    expect(computeRowHeight(0)).toBe(MIN_ROW_H);   // sin ops → clamp
    expect(computeRowHeight(1)).toBe(MIN_ROW_H);   // 1 op → clamp
    expect(computeRowHeight(2)).toBeGreaterThan(MIN_ROW_H); // 2 ops → crece
    expect(computeRowHeight(3)).toBeGreaterThan(computeRowHeight(2));
  });
});
