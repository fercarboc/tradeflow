/**
 * gantt-24h.test.ts — POSTDEPLOY-UX-FIX-1 / BLOQUE A
 *
 * Validates the 24-hour Gantt position logic extracted from ScreenTransportePanel.
 *
 * Tests cover:
 *   GH-1  Daytime event (09:00–11:00)
 *   GH-2  Late-evening event (22:00–23:59)
 *   GH-3  Cross-midnight event (23:00–01:00 next day)
 *   GH-4  All-night event fully before window visible start (never happens with 00:00 start)
 *   GH-5  Event starting exactly at 00:00
 *   GH-6  Event ending exactly at 24:00
 *   GH-7  Null / undefined end → defaults to start + 2 h
 *   GH-8  Invalid ISO → returns {left:0, width:0}
 *   GH-9  ganttTrips day filter — trip starts and ends on the same day
 *   GH-10 ganttTrips day filter — cross-midnight trip visible on both days
 *   GH-11 ganttTrips day filter — cancelled trip excluded
 *   GH-12 timeToPercent inside and outside 24 h
 */

import { describe, it, expect } from 'vitest';

// ── Constants (mirrors ScreenTransportePanel) ─────────────────────────────────

const GANTT_START_H  = 0;
const GANTT_END_H    = 24;
const GANTT_RANGE_H  = 24;

// ── Pure logic extracted from component ──────────────────────────────────────

function servicePosition(start: string, end: string | null | undefined): { left: number; width: number } {
  const s = new Date(start);
  if (isNaN(s.getTime())) return { left: 0, width: 0 };

  const startH = s.getHours() + s.getMinutes() / 60;
  const endDate = end ? new Date(end) : new Date(s.getTime() + 2 * 3600 * 1000);
  let endH = endDate.getHours() + endDate.getMinutes() / 60;
  if (endH < startH) endH += 24; // cross-midnight

  const visStart = Math.max(startH, GANTT_START_H);
  const visEnd   = Math.min(endH, GANTT_END_H);
  if (visEnd <= visStart) return { left: 0, width: 0 };

  return {
    left:  Math.max(0, (startH - GANTT_START_H) / GANTT_RANGE_H * 100),
    width: Math.max(1.5, (visEnd - visStart) / GANTT_RANGE_H * 100),
  };
}

function timeToPercent(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(100, (hours - GANTT_START_H) / GANTT_RANGE_H * 100));
}

/** Filters trips for a given Gantt day (mirrors component useMemo). */
function filterTripsForDay(
  trips: Array<{ estado: string; fecha_inicio: string; fecha_fin?: string | null }>,
  ganttDayStr: string,
): typeof trips {
  return trips.filter(t => {
    if (t.estado === 'cancelado') return false;
    const tStart = t.fecha_inicio.slice(0, 10);
    const tEnd   = t.fecha_fin ? t.fecha_fin.slice(0, 10) : tStart;
    return tStart <= ganttDayStr && tEnd >= ganttDayStr;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp for a given hour on 2026-11-03 (UTC). */
function ts(hour: number, minute = 0): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `2026-11-03T${h}:${m}:00`;
}

/** Next-day timestamp (for cross-midnight end). */
function tsNext(hour: number, minute = 0): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `2026-11-04T${h}:${m}:00`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── GH-1: Daytime ─────────────────────────────────────────────────────────────

describe('GH-1 — daytime event 09:00–11:00', () => {
  const pos = servicePosition(ts(9), ts(11));

  it('GH-1-1 left is 37.5% (9h out of 24h)', () => {
    expect(round1(pos.left)).toBe(37.5);
  });

  it('GH-1-2 width is 8.3% (2h out of 24h)', () => {
    expect(round1(pos.width)).toBe(8.3);
  });

  it('GH-1-3 visible (width > 0)', () => {
    expect(pos.width).toBeGreaterThan(0);
  });
});

// ── GH-2: Late evening ────────────────────────────────────────────────────────

describe('GH-2 — late-evening event 22:00–23:59', () => {
  const pos = servicePosition(ts(22), ts(23, 59));

  it('GH-2-1 left is 91.7% (22h out of 24h)', () => {
    expect(round1(pos.left)).toBe(91.7);
  });

  it('GH-2-2 width > 0 (no longer clipped at 21:00)', () => {
    expect(pos.width).toBeGreaterThan(0);
  });

  it('GH-2-3 width ~8.3% (approximately 2 h)', () => {
    // 22:00–23:59 = 1h59m ≈ 8.3%
    expect(pos.width).toBeGreaterThan(7);
    expect(pos.width).toBeLessThan(10);
  });
});

// ── GH-3: Cross-midnight ──────────────────────────────────────────────────────

describe('GH-3 — cross-midnight event 23:00–01:00 (next day)', () => {
  const pos = servicePosition(ts(23), tsNext(1));

  it('GH-3-1 left is 95.8% (23h out of 24h)', () => {
    expect(round1(pos.left)).toBe(95.8);
  });

  it('GH-3-2 width clipped at 24h boundary → 1h = 4.2%', () => {
    // endH = 1 + 24 = 25, visEnd = min(25, 24) = 24, width = (24-23)/24 * 100 = 4.17
    expect(round1(pos.width)).toBeGreaterThanOrEqual(1.5); // min 1.5
    expect(pos.width).toBeLessThanOrEqual(5);
  });

  it('GH-3-3 visible (not clipped to zero)', () => {
    expect(pos.width).toBeGreaterThan(0);
  });
});

// ── GH-4: Event starting at 00:00 ────────────────────────────────────────────

describe('GH-4 — event starting at 00:00', () => {
  const pos = servicePosition(ts(0), ts(2));

  it('GH-4-1 left is 0%', () => {
    expect(pos.left).toBe(0);
  });

  it('GH-4-2 width is 8.3% (2h)', () => {
    expect(round1(pos.width)).toBe(8.3);
  });
});

// ── GH-5: Event ending at exactly 24:00 ──────────────────────────────────────

describe('GH-5 — event ending at 24:00 (next-day 00:00)', () => {
  const pos = servicePosition(ts(22), tsNext(0));

  it('GH-5-1 endH detected as cross-midnight → treated as 24h', () => {
    // endH=0 < startH=22 → endH becomes 24
    // visEnd = min(24, 24) = 24 → width = (24-22)/24*100 = 8.33
    expect(round1(pos.width)).toBe(8.3);
  });

  it('GH-5-2 visible', () => {
    expect(pos.width).toBeGreaterThan(0);
  });
});

// ── GH-6: Null end → defaults to start + 2h ──────────────────────────────────

describe('GH-6 — null end defaults to +2h', () => {
  const pos = servicePosition(ts(10), null);

  it('GH-6-1 left is 41.7% (10h)', () => {
    expect(round1(pos.left)).toBe(41.7);
  });

  it('GH-6-2 width is 8.3% (2h default)', () => {
    expect(round1(pos.width)).toBe(8.3);
  });
});

// ── GH-7: Undefined end ───────────────────────────────────────────────────────

describe('GH-7 — undefined end defaults to +2h', () => {
  const pos = servicePosition(ts(14), undefined);

  it('GH-7-1 left is 58.3% (14h)', () => {
    expect(round1(pos.left)).toBe(58.3);
  });

  it('GH-7-2 width is 8.3% (2h)', () => {
    expect(round1(pos.width)).toBe(8.3);
  });
});

// ── GH-8: Invalid ISO ─────────────────────────────────────────────────────────

describe('GH-8 — invalid ISO timestamp', () => {
  it('GH-8-1 returns {left:0, width:0}', () => {
    const pos = servicePosition('not-a-date', null);
    expect(pos).toEqual({ left: 0, width: 0 });
  });
});

// ── GH-9: ganttTrips filter — same-day trip ───────────────────────────────────

describe('GH-9 — ganttTrips filter: same-day trip', () => {
  const trips = [
    { estado: 'confirmado', fecha_inicio: '2026-11-03T09:00:00', fecha_fin: '2026-11-03T17:00:00' },
    { estado: 'confirmado', fecha_inicio: '2026-11-04T09:00:00', fecha_fin: '2026-11-04T17:00:00' },
  ];

  it('GH-9-1 only the 03-Nov trip is visible on 03-Nov', () => {
    const result = filterTripsForDay(trips, '2026-11-03');
    expect(result).toHaveLength(1);
    expect(result[0].fecha_inicio.startsWith('2026-11-03')).toBe(true);
  });

  it('GH-9-2 only the 04-Nov trip is visible on 04-Nov', () => {
    const result = filterTripsForDay(trips, '2026-11-04');
    expect(result).toHaveLength(1);
    expect(result[0].fecha_inicio.startsWith('2026-11-04')).toBe(true);
  });
});

// ── GH-10: ganttTrips filter — cross-midnight trip ────────────────────────────

describe('GH-10 — ganttTrips filter: cross-midnight trip visible on both days', () => {
  const trips = [
    { estado: 'confirmado', fecha_inicio: '2026-11-03T23:00:00', fecha_fin: '2026-11-04T01:00:00' },
  ];

  it('GH-10-1 visible on 03-Nov (start day)', () => {
    expect(filterTripsForDay(trips, '2026-11-03')).toHaveLength(1);
  });

  it('GH-10-2 visible on 04-Nov (end day)', () => {
    expect(filterTripsForDay(trips, '2026-11-04')).toHaveLength(1);
  });

  it('GH-10-3 not visible on 05-Nov', () => {
    expect(filterTripsForDay(trips, '2026-11-05')).toHaveLength(0);
  });
});

// ── GH-11: ganttTrips filter — cancelled trip excluded ────────────────────────

describe('GH-11 — ganttTrips filter: cancelled trips excluded', () => {
  const trips = [
    { estado: 'cancelado', fecha_inicio: '2026-11-03T09:00:00', fecha_fin: '2026-11-03T17:00:00' },
    { estado: 'confirmado', fecha_inicio: '2026-11-03T10:00:00', fecha_fin: '2026-11-03T12:00:00' },
  ];

  it('GH-11-1 only non-cancelled trip appears', () => {
    const result = filterTripsForDay(trips, '2026-11-03');
    expect(result).toHaveLength(1);
    expect(result[0].estado).toBe('confirmado');
  });
});

// ── GH-12: timeToPercent ──────────────────────────────────────────────────────

describe('GH-12 — timeToPercent', () => {
  it('GH-12-1 midnight = 0%', () => {
    expect(timeToPercent(ts(0))).toBe(0);
  });

  it('GH-12-2 noon = 50%', () => {
    expect(round1(timeToPercent(ts(12)))).toBe(50);
  });

  it('GH-12-3 22:00 = 91.7%', () => {
    expect(round1(timeToPercent(ts(22)))).toBe(91.7);
  });

  it('GH-12-4 23:59 is within 0–100 range', () => {
    const pct = timeToPercent(ts(23, 59));
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
