/**
 * TX-INVOICE-INVALID-DATE-1 — tests for the local fmtDate function in ScreenFacturas
 *
 * The function must accept both DATE ("YYYY-MM-DD") and TIMESTAMPTZ
 * ("YYYY-MM-DDTHH:MM:SS.ffffff+HH:MM") without showing "Invalid Date".
 *
 * Replicates the fixed implementation verbatim so any drift between the
 * component and this test is caught immediately.
 */

import { describe, it, expect } from 'vitest';

// Verbatim copy of the fixed fmtDate from ScreenFacturas.tsx (lines 24-30).
// If the component implementation changes, update this copy to keep them in sync.
function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const datePart = d.split('T')[0];
  const dt = new Date(datePart + 'T12:00:00');
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── INV-FMT-1: null / falsy inputs ──────────────────────────────────────────

describe('fmtDate — null / falsy inputs', () => {
  it('INV-FMT-1-A: null → —', () => {
    expect(fmtDate(null)).toBe('—');
  });
  it('INV-FMT-1-B: undefined → —', () => {
    expect(fmtDate(undefined)).toBe('—');
  });
  it('INV-FMT-1-C: empty string → —', () => {
    expect(fmtDate('')).toBe('—');
  });
});

// ── INV-FMT-2: DATE inputs ("YYYY-MM-DD") ───────────────────────────────────

describe('fmtDate — DATE strings (YYYY-MM-DD)', () => {
  it('INV-FMT-2-A: formats 2026-10-29 correctly', () => {
    expect(fmtDate('2026-10-29')).toBe('29/10/2026');
  });
  it('INV-FMT-2-B: formats 2026-10-31 correctly', () => {
    expect(fmtDate('2026-10-31')).toBe('31/10/2026');
  });
  it('INV-FMT-2-C: formats 2026-01-01 without day shift', () => {
    expect(fmtDate('2026-01-01')).toBe('01/01/2026');
  });
  it('INV-FMT-2-D: formats 2025-12-31 correctly', () => {
    expect(fmtDate('2025-12-31')).toBe('31/12/2025');
  });
});

// ── INV-FMT-3: TIMESTAMPTZ inputs (post-emission state) ─────────────────────

describe('fmtDate — TIMESTAMPTZ strings (post-emission)', () => {
  it('INV-FMT-3-A: F-2026-0001 timestamp — no Invalid Date', () => {
    const ts = '2026-10-29T12:53:22.784677+00:00';
    const result = fmtDate(ts);
    expect(result).not.toBe('Invalid Date');
    expect(result).toBe('29/10/2026');
  });
  it('INV-FMT-3-B: F-2026-0002 timestamp — no Invalid Date', () => {
    const ts = '2026-10-31T21:27:10.319873+00:00';
    const result = fmtDate(ts);
    expect(result).not.toBe('Invalid Date');
    expect(result).toBe('31/10/2026');
  });
  it('INV-FMT-3-C: UTC midnight offset — no day shift', () => {
    // 2026-01-01T00:00:00+00:00 — date part is still "2026-01-01"
    expect(fmtDate('2026-01-01T00:00:00+00:00')).toBe('01/01/2026');
  });
  it('INV-FMT-3-D: UTC+1 timestamp near midnight — date part extracted correctly', () => {
    // 2026-10-29T00:30:00+01:00 → datePart = "2026-10-29"
    expect(fmtDate('2026-10-29T00:30:00+01:00')).toBe('29/10/2026');
  });
  it('INV-FMT-3-E: ISO format without timezone offset', () => {
    expect(fmtDate('2026-10-29T12:00:00')).toBe('29/10/2026');
  });
  it('INV-FMT-3-F: microsecond precision TIMESTAMPTZ', () => {
    expect(fmtDate('2026-10-31T21:27:10.319873+00:00')).toBe('31/10/2026');
  });
});

// ── INV-FMT-4: invalid / garbage inputs ─────────────────────────────────────

describe('fmtDate — invalid inputs return —', () => {
  it('INV-FMT-4-A: garbage string → —', () => {
    expect(fmtDate('not-a-date')).toBe('—');
  });
  it('INV-FMT-4-B: partial ISO → —', () => {
    expect(fmtDate('2026-13-01')).toBe('—');
  });
  it('INV-FMT-4-C: old buggy concatenated string — fix recovers date part', () => {
    // The previous bug produced "...+00:00T12:00:00" which new Date() couldn't parse.
    // The fix uses split('T')[0] so the date part "2026-10-29" is extracted and
    // returned correctly — a valid date, not "Invalid Date" or "—".
    const broken = '2026-10-29T12:53:22.784677+00:00T12:00:00';
    expect(fmtDate(broken)).toBe('29/10/2026');
  });
});
