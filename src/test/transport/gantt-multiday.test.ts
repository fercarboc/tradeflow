/**
 * gantt-multiday.test.ts — TX-MC-PLANNING-2-P0
 *
 * Valida servicePosition() para viajes multi-día en el Gantt.
 * La lógica se replica aquí para evitar depender del módulo React.
 */

import { describe, it, expect } from 'vitest';

// ── Helpers (réplica exacta de la implementación en ScreenTransportePanel) ────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextDayISOStr(dayStr: string): string {
  const d = new Date(`${dayStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

function servicePosition(
  start: string,
  end: string | null | undefined,
  ganttDayStr: string,
): { left: number; width: number } {
  const svcStartMs = new Date(start).getTime();
  if (isNaN(svcStartMs)) return { left: 0, width: 0 };

  const svcEndMs = end
    ? new Date(end).getTime()
    : svcStartMs + 2 * 3600 * 1000;

  const dayStartMs = new Date(`${ganttDayStr}T00:00:00`).getTime();
  const dayEndMs   = new Date(`${nextDayISOStr(ganttDayStr)}T00:00:00`).getTime();
  const dayMs      = dayEndMs - dayStartMs;

  const visStartMs = Math.max(svcStartMs, dayStartMs);
  const visEndMs   = Math.min(svcEndMs,   dayEndMs);
  if (visEndMs <= visStartMs) return { left: 0, width: 0 };

  return {
    left:  Math.max(0, (visStartMs - dayStartMs) / dayMs * 100),
    width: Math.max(1.5, (visEndMs - visStartMs) / dayMs * 100),
  };
}

// ── GM-1: Viaje mismo día ─────────────────────────────────────────────────────
describe('GM-1 — Same-day service', () => {
  it('GM-1-1: left and width match local hours within the day', () => {
    const pos = servicePosition('2026-11-03T09:00:00', '2026-11-03T11:00:00', '2026-11-03');
    // 09:00 = 9/24 * 100 = 37.5%
    expect(pos.left).toBeCloseTo(37.5, 1);
    // 2h / 24h * 100 = 8.33%
    expect(pos.width).toBeCloseTo(8.33, 1);
  });

  it('GM-1-2: width 0 when service is fully outside the rendered day', () => {
    const pos = servicePosition('2026-11-02T09:00:00', '2026-11-02T11:00:00', '2026-11-03');
    expect(pos.width).toBe(0);
  });
});

// ── GM-2: Viaje que cruza medianoche (día 1 → día 2) ─────────────────────────
describe('GM-2 — Midnight-crossing service (day 1 of 2)', () => {
  it('GM-2-1: on start day, bar extends to end of Gantt (100%)', () => {
    // Santander→Cádiz: sale 2026-11-03 22:00, llega 2026-11-04 18:00
    const pos = servicePosition('2026-11-03T22:00:00', '2026-11-04T18:00:00', '2026-11-03');
    // visStart = 22:00, visEnd = 24:00 (clamped at next midnight)
    expect(pos.left).toBeCloseTo(22 / 24 * 100, 1); // 91.67%
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.left + pos.width).toBeCloseTo(100, 1);
  });

  it('GM-2-2: on arrival day, bar starts at 0% and ends at arrival time', () => {
    const pos = servicePosition('2026-11-03T22:00:00', '2026-11-04T18:00:00', '2026-11-04');
    // visStart = 00:00 → left = 0%
    expect(pos.left).toBe(0);
    // visEnd = 18:00 → width = 18/24 * 100 = 75%
    expect(pos.width).toBeCloseTo(75, 1);
  });
});

// ── GM-3: Viaje de 3 días (Santander→Cádiz extendido) ────────────────────────
describe('GM-3 — 3-day service (middle day)', () => {
  it('GM-3-1: middle day renders full width 0–100%', () => {
    // Día 1: 2026-11-03, Día 2 (intermedio): 2026-11-04, Día 3: 2026-11-05
    const pos = servicePosition('2026-11-03T10:00:00', '2026-11-05T08:00:00', '2026-11-04');
    expect(pos.left).toBe(0);
    expect(pos.left + pos.width).toBeCloseTo(100, 1);
  });

  it('GM-3-2: last day left=0, width proportional to arrival time', () => {
    const pos = servicePosition('2026-11-03T10:00:00', '2026-11-05T08:00:00', '2026-11-05');
    expect(pos.left).toBe(0);
    // 08:00 = 8/24 * 100 = 33.33%
    expect(pos.width).toBeCloseTo(33.33, 1);
  });
});

// ── GM-4: Fin exactamente a medianoche ────────────────────────────────────────
describe('GM-4 — Service ending exactly at midnight', () => {
  it('GM-4-1: end=T00:00:00 renders on the PREVIOUS day, not the next', () => {
    // Llega a las 00:00 del día 4 → no aparece en el día 4
    const posDay4 = servicePosition('2026-11-03T20:00:00', '2026-11-04T00:00:00', '2026-11-04');
    expect(posDay4.width).toBe(0);

    // Pero sí aparece en el día 3
    const posDay3 = servicePosition('2026-11-03T20:00:00', '2026-11-04T00:00:00', '2026-11-03');
    expect(posDay3.width).toBeGreaterThan(0);
    expect(posDay3.left + posDay3.width).toBeCloseTo(100, 1);
  });
});

// ── GM-5: Intervalo inválido / sin fin ────────────────────────────────────────
describe('GM-5 — Edge cases', () => {
  it('GM-5-1: invalid start date returns left=0, width=0', () => {
    const pos = servicePosition('not-a-date', null, '2026-11-03');
    expect(pos.left).toBe(0);
    expect(pos.width).toBe(0);
  });

  it('GM-5-2: null end defaults to +2h duration', () => {
    const pos = servicePosition('2026-11-03T10:00:00', null, '2026-11-03');
    // 10:00 → 12:00; width = 2/24*100 = 8.33%
    expect(pos.width).toBeCloseTo(8.33, 1);
  });
});

// ── GM-6: DST España — Cambio horario de verano (spring-forward 29-Mar-2026) ─
describe('GM-6 — DST spring-forward 2026-03-29 (Spain, 23h day)', () => {
  it('GM-6-1: nextDayISOStr returns 2026-03-30 for 2026-03-29', () => {
    expect(nextDayISOStr('2026-03-29')).toBe('2026-03-30');
  });

  it('GM-6-2: same-day service on spring-forward day has non-zero width', () => {
    const pos = servicePosition('2026-03-29T10:00:00', '2026-03-29T12:00:00', '2026-03-29');
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.left).toBeGreaterThan(0);
  });

  it('GM-6-3: multi-day service: day after spring-forward starts at left=0', () => {
    const pos = servicePosition('2026-03-29T23:00:00', '2026-03-30T10:00:00', '2026-03-30');
    expect(pos.left).toBe(0);
    expect(pos.width).toBeGreaterThan(0);
  });
});

// ── GM-7: DST España — Cambio horario de invierno (fall-back 25-Oct-2026) ───
describe('GM-7 — DST fall-back 2026-10-25 (Spain, 25h day)', () => {
  it('GM-7-1: nextDayISOStr returns 2026-10-26 for 2026-10-25', () => {
    expect(nextDayISOStr('2026-10-25')).toBe('2026-10-26');
  });

  it('GM-7-2: same-day service on fall-back day has non-zero width', () => {
    const pos = servicePosition('2026-10-25T10:00:00', '2026-10-25T12:00:00', '2026-10-25');
    expect(pos.width).toBeGreaterThan(0);
  });

  it('GM-7-3: multi-day service crossing fall-back midnight: arrival day left=0', () => {
    const pos = servicePosition('2026-10-25T22:00:00', '2026-10-26T09:00:00', '2026-10-26');
    expect(pos.left).toBe(0);
    expect(pos.width).toBeGreaterThan(0);
  });
});

// ── GM-8: Servicio de Viajeros (clase TradeTransportService) ─────────────────
describe('GM-8 — Viajeros service spanning 2 days', () => {
  it('GM-8-1: Madrid–Barcelona night bus: last segment visible on arrival day', () => {
    // Sale 2026-11-03T23:30:00, llega 2026-11-04T06:30:00
    const posDay1 = servicePosition('2026-11-03T23:30:00', '2026-11-04T06:30:00', '2026-11-03');
    const posDay2 = servicePosition('2026-11-03T23:30:00', '2026-11-04T06:30:00', '2026-11-04');

    // Día 1: bar arranca a las 23:30 y llega hasta el final
    expect(posDay1.left).toBeCloseTo(23.5 / 24 * 100, 1);
    expect(posDay1.left + posDay1.width).toBeCloseTo(100, 1);

    // Día 2: arranca al inicio (left=0) y llega hasta 06:30
    expect(posDay2.left).toBe(0);
    expect(posDay2.width).toBeCloseTo(6.5 / 24 * 100, 1);
  });
});

// ── GM-9: Límites exactos 00:00 / 24:00 ──────────────────────────────────────
describe('GM-9 — Boundary: service starts exactly at midnight', () => {
  it('GM-9-1: service starting at T00:00:00 has left=0 on that day', () => {
    const pos = servicePosition('2026-11-03T00:00:00', '2026-11-03T04:00:00', '2026-11-03');
    expect(pos.left).toBe(0);
    expect(pos.width).toBeCloseTo(4 / 24 * 100, 1);
  });

  it('GM-9-2: service ending exactly at T24:00 does NOT appear on the next day', () => {
    const pos = servicePosition('2026-11-03T20:00:00', '2026-11-04T00:00:00', '2026-11-04');
    expect(pos.width).toBe(0);
  });
});
