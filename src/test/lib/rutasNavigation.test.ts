import { describe, it, expect } from 'vitest';
import { startOfWeek, addDays } from '../../components/ScreenTransporteMapaServicios';
import {
  buildCalendarProjection,
  getAvailableTransitions,
  applyTransition,
  fmtHora,
  filterSchedules,
} from '../../components/ScreenTransporteRutas';
import type {
  CalendarOccurrence,
  ScheduleTransition,
  ScheduleFilterOptions,
} from '../../components/ScreenTransporteRutas';

// ── RN-1: startOfWeek ─────────────────────────────────────────────────────────

describe('RN-1 startOfWeek', () => {
  it('returns Monday for a Wednesday', () => {
    const wed = new Date('2026-10-28T10:00:00'); // Wednesday
    const mon = startOfWeek(wed);
    expect(mon.getDay()).toBe(1); // Monday
    expect(mon.getDate()).toBe(26);
    expect(mon.getMonth()).toBe(9); // October
  });

  it('returns Monday for a Monday', () => {
    const mon = new Date('2026-10-26T08:00:00');
    const result = startOfWeek(mon);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(26);
  });

  it('returns Monday for a Sunday', () => {
    const sun = new Date('2026-10-25T12:00:00');
    const result = startOfWeek(sun);
    // Oct 25 2026 is Sunday → week starts Oct 19
    expect(result.getDate()).toBe(19);
    expect(result.getMonth()).toBe(9); // October = 9
  });

  it('sets time to 00:00:00', () => {
    const d = new Date('2026-10-28T15:30:45');
    const w = startOfWeek(d);
    expect(w.getHours()).toBe(0);
    expect(w.getMinutes()).toBe(0);
    expect(w.getSeconds()).toBe(0);
  });
});

// ── RN-2: addDays ─────────────────────────────────────────────────────────────

describe('RN-2 addDays', () => {
  it('adds positive days', () => {
    const d = new Date('2026-10-26T12:00:00');
    const r = addDays(d, 6);
    expect(r.getDate()).toBe(1);
    expect(r.getMonth()).toBe(10); // November = 10
  });

  it('adds zero days returns same date', () => {
    const d = new Date('2026-10-28T12:00:00');
    const r = addDays(d, 0);
    expect(r.getDate()).toBe(28);
    expect(r.getMonth()).toBe(9);
  });

  it('subtracts days with negative n', () => {
    const d = new Date('2026-10-28T12:00:00');
    const r = addDays(d, -7);
    expect(r.getDate()).toBe(21);
    expect(r.getMonth()).toBe(9);
  });

  it('does not mutate original', () => {
    const d = new Date('2026-10-28T12:00:00');
    addDays(d, 7);
    expect(d.getDate()).toBe(28);
  });
});

// ── RN-3: re-exports from ScreenTransporteRutas ───────────────────────────────

describe('RN-3 re-exports from wrapper', () => {
  it('buildCalendarProjection is a function', () => {
    expect(typeof buildCalendarProjection).toBe('function');
  });

  it('getAvailableTransitions is a function', () => {
    expect(typeof getAvailableTransitions).toBe('function');
  });

  it('applyTransition is a function', () => {
    expect(typeof applyTransition).toBe('function');
  });

  it('fmtHora is a function', () => {
    expect(typeof fmtHora).toBe('function');
  });

  it('filterSchedules is a function', () => {
    expect(typeof filterSchedules).toBe('function');
  });
});

// ── RN-4: wrapper re-exports produce correct results ─────────────────────────

describe('RN-4 wrapper re-exports behave correctly', () => {
  it('getAvailableTransitions borrador returns activar only', () => {
    const t = getAvailableTransitions('borrador');
    expect(t).toEqual(['activar']);
  });

  it('applyTransition borrador→activar', () => {
    expect(applyTransition('borrador', 'activar')).toBe('activo');
  });

  it('fmtHora strips seconds', () => {
    expect(fmtHora('08:30:00')).toBe('08:30');
  });

  it('fmtHora null returns em-dash', () => {
    expect(fmtHora(null)).toBe('—');
  });

  it('filterSchedules empty list returns empty', () => {
    const opts: ScheduleFilterOptions = { query: '', tipo: '', estado: '' };
    expect(filterSchedules([], opts, {})).toEqual([]);
  });
});

// ── RN-5: type exports compile ────────────────────────────────────────────────

describe('RN-5 type exports compile', () => {
  it('CalendarOccurrence type is usable', () => {
    const occ: CalendarOccurrence = {
      fecha: '2026-11-01',
      sentido: 'ida',
      status: 'pending',
      service_id: null,
      exception: null,
    };
    expect(occ.fecha).toBe('2026-11-01');
  });

  it('ScheduleTransition type is usable', () => {
    const t: ScheduleTransition = 'activar';
    expect(t).toBe('activar');
  });

  it('ScheduleFilterOptions type is usable', () => {
    const opts: ScheduleFilterOptions = { query: 'test', tipo: '', estado: 'activo' };
    expect(opts.estado).toBe('activo');
  });
});
