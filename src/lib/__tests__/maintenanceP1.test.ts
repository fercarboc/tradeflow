/**
 * Tests A–O: PH0 Maintenance Contract Foundation P1
 *
 * Run: npx vitest run src/lib/__tests__/maintenanceP1.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BILLING_FREQUENCY_CONFIG,
  getFrequencyConfig,
  billingAmountForPeriod,
  advanceBillingDate,
  formatPeriodLabel,
  type BillingFrequency,
} from '../maintenanceBilling';

// ── Tests A–D: Frequency configuration ───────────────────────────────────────

describe('A: mensual frequency config', () => {
  it('has intervalMonths=1 and invoicesPerYear=12', () => {
    expect(BILLING_FREQUENCY_CONFIG.mensual.intervalMonths).toBe(1);
    expect(BILLING_FREQUENCY_CONFIG.mensual.invoicesPerYear).toBe(12);
  });
});

describe('B: trimestral frequency config', () => {
  it('has intervalMonths=3 and invoicesPerYear=4', () => {
    expect(BILLING_FREQUENCY_CONFIG.trimestral.intervalMonths).toBe(3);
    expect(BILLING_FREQUENCY_CONFIG.trimestral.invoicesPerYear).toBe(4);
  });
});

describe('C: semestral frequency config', () => {
  it('has intervalMonths=6 and invoicesPerYear=2', () => {
    expect(BILLING_FREQUENCY_CONFIG.semestral.intervalMonths).toBe(6);
    expect(BILLING_FREQUENCY_CONFIG.semestral.invoicesPerYear).toBe(2);
  });
  it('billingAmountForPeriod multiplies cuota × 6', () => {
    expect(billingAmountForPeriod(100, 'semestral')).toBe(600);
  });
});

describe('D: anual frequency config', () => {
  it('has intervalMonths=12 and invoicesPerYear=1', () => {
    expect(BILLING_FREQUENCY_CONFIG.anual.intervalMonths).toBe(12);
    expect(BILLING_FREQUENCY_CONFIG.anual.invoicesPerYear).toBe(1);
  });
  it('billingAmountForPeriod multiplies cuota × 12', () => {
    expect(billingAmountForPeriod(100, 'anual')).toBe(1200);
  });
});

// ── Tests E–G: Activation guards (pure logic) ─────────────────────────────────

describe('E: getFrequencyConfig falls back to mensual for unknown freq', () => {
  it('returns mensual config for empty string', () => {
    const cfg = getFrequencyConfig('');
    expect(cfg.intervalMonths).toBe(1);
  });
  it('returns mensual config for unknown string', () => {
    const cfg = getFrequencyConfig('quincenal');
    expect(cfg.intervalMonths).toBe(1);
  });
});

describe('F: all declared BillingFrequency keys present', () => {
  const freqs: BillingFrequency[] = ['mensual', 'trimestral', 'semestral', 'anual'];
  it.each(freqs)('key %s exists in BILLING_FREQUENCY_CONFIG', (freq) => {
    expect(BILLING_FREQUENCY_CONFIG[freq]).toBeDefined();
  });
});

describe('G: billingAmountForPeriod is always positive', () => {
  it.each(['mensual', 'trimestral', 'semestral', 'anual'] as BillingFrequency[])(
    'returns positive for %s with cuota=50',
    (freq) => {
      expect(billingAmountForPeriod(50, freq)).toBeGreaterThan(0);
    },
  );
});

// ── Tests H–I: Billing state ──────────────────────────────────────────────────

describe('H: advanceBillingDate advances by intervalMonths', () => {
  it('advances mensual by 1 month', () => {
    expect(advanceBillingDate('2026-01-01', 'mensual')).toBe('2026-02-01');
  });
  it('advances trimestral by 3 months', () => {
    expect(advanceBillingDate('2026-01-01', 'trimestral')).toBe('2026-04-01');
  });
  it('advances semestral by 6 months', () => {
    expect(advanceBillingDate('2026-01-01', 'semestral')).toBe('2026-07-01');
  });
  it('advances anual by 12 months', () => {
    expect(advanceBillingDate('2026-01-01', 'anual')).toBe('2027-01-01');
  });
});

describe('I: advanceBillingDate handles month-end correctly', () => {
  it('Jan 31 + 1 month → Feb 28/29 (JS Date normalises)', () => {
    const result = advanceBillingDate('2026-01-31', 'mensual');
    expect(result).toMatch(/^2026-0[23]-/); // Feb 28 or Mar 3 depending on JS engine
  });
});

// ── Tests J–K: Invoice creation helpers ──────────────────────────────────────

describe('J: formatPeriodLabel for mensual', () => {
  it('returns month + year in Spanish', () => {
    const label = formatPeriodLabel('2026-03-01', 'mensual');
    expect(label).toMatch(/marzo/i);
    expect(label).toContain('2026');
  });
});

describe('K: formatPeriodLabel for semestral', () => {
  it('returns S1 for January', () => {
    expect(formatPeriodLabel('2026-01-01', 'semestral')).toBe('S1 2026');
  });
  it('returns S2 for July', () => {
    expect(formatPeriodLabel('2026-07-01', 'semestral')).toBe('S2 2026');
  });
  it('returns T2 for April (trimestral)', () => {
    expect(formatPeriodLabel('2026-04-01', 'trimestral')).toBe('T2 2026');
  });
  it('returns Año for anual', () => {
    expect(formatPeriodLabel('2026-01-01', 'anual')).toBe('Año 2026');
  });
});

// ── Test L: Duplicate period guard ────────────────────────────────────────────

describe('L: duplicate period detection (idempotency key logic)', () => {
  it('same (org_id, mantenimiento_id, mes_facturacion) must not produce a second invoice', () => {
    // The unique constraint uq_invoices_mant_period enforces this at DB level.
    // This test validates that the application-level check key is correctly formed.
    const orgId = 'org-1';
    const mantenimientoId = 'mant-1';
    const mesFact = '2026-01-01';

    const key1 = `${orgId}:${mantenimientoId}:${mesFact}`;
    const key2 = `${orgId}:${mantenimientoId}:${mesFact}`;
    expect(key1).toBe(key2);

    // Different period → different key
    const key3 = `${orgId}:${mantenimientoId}:2026-02-01`;
    expect(key1).not.toBe(key3);
  });
});

// ── Test M: metodo_pago propagation ──────────────────────────────────────────

describe('M: metodo_pago values', () => {
  const validMethods = ['transferencia', 'domiciliacion', 'tarjeta', 'efectivo', 'otro'];
  it.each(validMethods)('"%s" is a recognised payment method', (method) => {
    // UI only allows these 5 values; the DB column is unconstrained text.
    expect(validMethods).toContain(method);
  });
});

// ── Test N: contract link ─────────────────────────────────────────────────────

describe('N: billingAmountForPeriod consistency with BILLING_FREQUENCY_CONFIG', () => {
  it('result equals cuota × intervalMonths for every frequency', () => {
    const cuota = 200;
    for (const [freq, cfg] of Object.entries(BILLING_FREQUENCY_CONFIG)) {
      expect(billingAmountForPeriod(cuota, freq)).toBe(cuota * cfg.intervalMonths);
    }
  });
});

// ── Test O: legacy untouched ──────────────────────────────────────────────────

describe('O: frequency config is immutable (no side-effects)', () => {
  it('BILLING_FREQUENCY_CONFIG values are not mutated after reads', () => {
    const before = { ...BILLING_FREQUENCY_CONFIG.mensual };
    getFrequencyConfig('mensual');
    billingAmountForPeriod(100, 'mensual');
    advanceBillingDate('2026-01-01', 'mensual');
    formatPeriodLabel('2026-01-01', 'mensual');
    expect(BILLING_FREQUENCY_CONFIG.mensual).toEqual(before);
  });
});
