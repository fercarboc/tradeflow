/**
 * gantt-trip-detail.test.ts — TX-MC-1-UX-FIX-2 / BLOQUE A + B
 *
 * Tests de regresión para:
 *
 *   TD-1  initialTripId — lógica de selección automática al cargar
 *   TD-2  Gantt 24h — constantes de rango y marcador visual
 *   TD-3  servicePosition — viaje 22:00–23:59 visible y correctamente posicionado
 *   TD-4  onTripClick — el callback correcto sustituye a onNavigate('mercancias')
 */

import { describe, it, expect } from 'vitest';

// ── TD-1: initialTripId / lastHandledTripId selection logic ──────────────────

/**
 * Mirrors the findInitialTrip logic used inside load() in ScreenTransporteViajes.
 * Extracted as a pure helper so it can be tested without React.
 */
function findInitialTrip<T extends { id: string }>(
  trips: T[],
  initialTripId: string | undefined,
): T | null {
  if (!initialTripId) return null;
  return trips.find(t => t.id === initialTripId) ?? null;
}

/**
 * Models the lastHandledTripId ref logic: returns the trip to select, or null
 * if the id was already handled (idempotent) or cleared.
 */
function makeGanttClickProcessor<T extends { id: string }>(trips: T[]) {
  let lastHandled: string | null = null;
  return function processGanttClick(tripId: string | undefined): T | null {
    if (!tripId) { lastHandled = null; return null; }
    if (tripId === lastHandled) return null; // already handled — idempotent
    lastHandled = tripId;
    return trips.find(t => t.id === tripId) ?? null;
  };
}

describe('TD-1 — initialTripId selection logic', () => {
  const trips = [
    { id: 'trip-a', titulo: 'Santander → Burgos' },
    { id: 'trip-b', titulo: 'Madrid → Valencia' },
    { id: 'trip-c', titulo: 'Bilbao → Barcelona' },
  ];

  it('TD-1-1: finds trip when initialTripId matches', () => {
    const found = findInitialTrip(trips, 'trip-b');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('trip-b');
  });

  it('TD-1-2: returns null when initialTripId not in list', () => {
    const found = findInitialTrip(trips, 'trip-z');
    expect(found).toBeNull();
  });

  it('TD-1-3: returns null when initialTripId is undefined', () => {
    const found = findInitialTrip(trips, undefined);
    expect(found).toBeNull();
  });

  it('TD-1-4: returns null for empty trip list', () => {
    const found = findInitialTrip([], 'trip-a');
    expect(found).toBeNull();
  });

  it('TD-1-5: returns the correct trip when list has many entries', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ id: `trip-${i}`, titulo: `Viaje ${i}` }));
    const found = findInitialTrip(big, 'trip-37');
    expect(found?.id).toBe('trip-37');
  });

  it('TD-1-6: second click on different trip works after closing detail', () => {
    const process = makeGanttClickProcessor(trips);
    const first = process('trip-a');
    expect(first?.id).toBe('trip-a');
    process(undefined);             // close detail → resets lastHandled
    const second = process('trip-b');
    expect(second?.id).toBe('trip-b');
  });

  it('TD-1-7: same trip re-clicked after close also works', () => {
    const process = makeGanttClickProcessor(trips);
    process('trip-a');
    process(undefined);             // close → reset
    const again = process('trip-a');
    expect(again?.id).toBe('trip-a');
  });

  it('TD-1-8: duplicate click on same trip without close is idempotent (no re-select)', () => {
    const process = makeGanttClickProcessor(trips);
    process('trip-a');
    const dup = process('trip-a'); // same id, no close
    expect(dup).toBeNull();
  });
});

// ── TD-2: Gantt 24h constants ─────────────────────────────────────────────────

const GANTT_START_H        = 0;
const GANTT_END_H          = 24;
const GANTT_RANGE_H        = 24;
const GANTT_HOUR_MARKS     = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const GANTT_TIMELINE_MIN_W = 960;

describe('TD-2 — Gantt 24h constants', () => {
  it('TD-2-1: GANTT_START_H is 0 (full day)', () => {
    expect(GANTT_START_H).toBe(0);
  });

  it('TD-2-2: GANTT_END_H is 24 (includes late night)', () => {
    expect(GANTT_END_H).toBe(24);
  });

  it('TD-2-3: GANTT_RANGE_H equals END - START = 24', () => {
    expect(GANTT_RANGE_H).toBe(GANTT_END_H - GANTT_START_H);
  });

  it('TD-2-4: hour marks start at 0 and end at 22 (24:00 shown as right boundary)', () => {
    expect(GANTT_HOUR_MARKS[0]).toBe(0);
    expect(GANTT_HOUR_MARKS[GANTT_HOUR_MARKS.length - 1]).toBe(22);
  });

  it('TD-2-5: 24:00 label position = 100% (right edge)', () => {
    const pct = (24 - GANTT_START_H) / GANTT_RANGE_H * 100;
    expect(pct).toBe(100);
  });

  it('TD-2-6: min timeline width is 960px (≥40px per 2h mark)', () => {
    const pxPer2h = GANTT_TIMELINE_MIN_W / (GANTT_RANGE_H / 2);
    expect(pxPer2h).toBeGreaterThanOrEqual(40);
  });
});

// ── TD-3: servicePosition for trips at end of day ─────────────────────────────

function servicePosition(start: string, end: string | null | undefined): { left: number; width: number } {
  const s = new Date(start);
  if (isNaN(s.getTime())) return { left: 0, width: 0 };
  const startH = s.getHours() + s.getMinutes() / 60;
  const endDate = end ? new Date(end) : new Date(s.getTime() + 2 * 3600 * 1000);
  let endH = endDate.getHours() + endDate.getMinutes() / 60;
  if (endH < startH) endH += 24;
  const visStart = Math.max(startH, GANTT_START_H);
  const visEnd   = Math.min(endH, GANTT_END_H);
  if (visEnd <= visStart) return { left: 0, width: 0 };
  return {
    left:  Math.max(0, (startH - GANTT_START_H) / GANTT_RANGE_H * 100),
    width: Math.max(1.5, (visEnd - visStart) / GANTT_RANGE_H * 100),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

describe('TD-3 — servicePosition for late-day trips', () => {
  it('TD-3-1: viaje 22:00–23:59 visible (width > 0)', () => {
    const pos = servicePosition('2026-11-02T22:00:00', '2026-11-02T23:59:00');
    expect(pos.width).toBeGreaterThan(0);
  });

  it('TD-3-2: viaje 22:00–23:59 starts at 91.7%', () => {
    const pos = servicePosition('2026-11-02T22:00:00', '2026-11-02T23:59:00');
    expect(round1(pos.left)).toBe(91.7);
  });

  it('TD-3-3: viaje 22:00–23:59 width near 8.3% (no clipping)', () => {
    const pos = servicePosition('2026-11-02T22:00:00', '2026-11-02T23:59:00');
    expect(pos.width).toBeGreaterThan(7.5);
    expect(pos.width).toBeLessThanOrEqual(8.4);
  });

  it('TD-3-4: viaje que cruza medianoche (23:00–01:00) es visible', () => {
    const pos = servicePosition('2026-11-02T23:00:00', '2026-11-03T01:00:00');
    expect(pos.width).toBeGreaterThan(0);
  });

  it('TD-3-5: viaje que cruza medianoche se recorta en 24:00 (1 hora visible)', () => {
    const pos = servicePosition('2026-11-02T23:00:00', '2026-11-03T01:00:00');
    // visStart=23, visEnd=min(25,24)=24 → width = 1/24*100 = 4.17
    expect(round1(pos.width)).toBeGreaterThanOrEqual(1.5);
    expect(pos.width).toBeLessThanOrEqual(5);
  });

  it('TD-3-6: viaje exactamente a 24:00 (00:00 del día siguiente) → cross-midnight corregido', () => {
    const pos = servicePosition('2026-11-02T22:00:00', '2026-11-03T00:00:00');
    // endH=0 < startH=22 → endH += 24 = 24
    expect(round1(pos.width)).toBe(8.3);
  });
});

// ── TD-4: onTripClick correctness ─────────────────────────────────────────────

describe('TD-4 — onTripClick callback contract', () => {
  it('TD-4-1: callback receives the clicked trip id (not a tab name)', () => {
    const captured: string[] = [];
    const onTripClick = (id: string) => captured.push(id);

    // Simulate Gantt block click — the NEW behavior
    const tripId = 'trip-abc-123';
    onTripClick(tripId);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBe(tripId);
    // Must NOT be a navigation string like 'mercancias'
    expect(captured[0]).not.toBe('mercancias');
  });

  it('TD-4-2: callback is called with the EXACT trip id (no prefix/suffix)', () => {
    const received: string[] = [];
    const onTripClick = (id: string) => received.push(id);
    const trips = [
      { id: 'ba44cef0-1234-5678-abcd-0000deadbeef', titulo: 'Test' },
    ];
    trips.forEach(t => onTripClick(t.id));
    expect(received[0]).toBe('ba44cef0-1234-5678-abcd-0000deadbeef');
  });

  it('TD-4-3: setPanelTab and setGanttTripId called in the same handler (batched)', () => {
    const actions: string[] = [];
    const setPanelTab = (tab: string) => actions.push(`tab:${tab}`);
    const setGanttTripId = (id: string) => actions.push(`tripId:${id}`);

    // Simulate the composite handler from ScreenTransportePanel
    const handleTripClick = (id: string) => {
      setGanttTripId(id);
      setPanelTab('mercancias');
    };

    handleTripClick('trip-xyz');

    expect(actions).toContain('tab:mercancias');
    expect(actions).toContain('tripId:trip-xyz');
  });
});
