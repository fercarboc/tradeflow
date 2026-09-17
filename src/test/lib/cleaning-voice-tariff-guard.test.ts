/**
 * Guard test: prevents re-introduction of a hardcoded cleaning labor rate.
 * Reads the edge function source directly to assert the invariant at build time.
 *
 * WHY: limpieza=20 was removed (PH0-VOICE-TARIFF-CLEANUP). Cleaning labor is
 * always price_unitario=0 + requiere_revision=true — the professional sets
 * their own rate. A hardcoded tariff overrides that contract silently.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const EDGE_FN_PATH = resolve(
  __dirname,
  '../../../supabase/functions/trade-voice-to-quote/index.ts',
);

const source = readFileSync(EDGE_FN_PATH, 'utf-8');

describe('voice-to-quote edge function — cleaning tariff guard', () => {
  it('no hardcoded limpieza rate in TARIFAS table (e.g. limpieza=N)', () => {
    // Pattern: "limpieza=" followed by digits (e.g. limpieza=20)
    expect(source).not.toMatch(/\blimpieza\s*=\s*\d+/);
  });

  it('"limpieza" still appears as a recognized oficio (REGLAS ESPECÍFICAS section)', () => {
    // The sector must still be recognized — just without a hardcoded price
    expect(source).toMatch(/limpieza/i);
  });

  it('REGLAS ESPECÍFICAS — SECTOR LIMPIEZA section is present', () => {
    expect(source).toMatch(/REGLAS ESPECÍFICAS.*SECTOR LIMPIEZA/i);
  });

  it('precio_unitario=0 rule for cleaning is present', () => {
    expect(source).toMatch(/precio_unitario.*0.*requiere_revision.*true/is);
  });
});
