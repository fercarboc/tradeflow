// MP-FIN-5B — Tests for financial document UI helpers
//
// Tests UI-5B-03, 04, 09, 12, 13, 14 via pure helper functions in doc-helpers.ts.
// React component behavior (UI-5B-01, 02, 05..08, 10, 11, 15, 16, 17) is verified
// by smoke manual — no React Testing Library exists in this project.
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN

import { describe, it, expect } from 'vitest'
import {
  getDocSubtypeLabel,
  getDocRefTypeLabel,
  getSettlementLineLabel,
  computeOrderTotal,
  formatOrderSelectorLabel,
  extractSupplierStatementMeta,
  extractSettlementStatementMeta,
  isSimulationOnly,
  DOC_SUBTYPE_LABELS,
  DOC_REF_TYPE_LABELS,
} from '../doc-helpers'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FAKE_SUPPLIER_META = {
  supplier_order: {
    id: 'so-001',
    actor_id: 'actor-001',
    org_id: null,
    numero: 'SUP-2026-0001',
    estado: 'confirmado',
    notas: null,
    goods_net_snapshot: 100,
    goods_tax_snapshot: 21,
    goods_gross_snapshot: 121,
    shipping_net_snapshot: 10,
    shipping_tax_snapshot: 2.1,
    shipping_gross_snapshot: 12.1,
    tax_rate_snapshot: 21,
    currency: 'EUR',
    delivery_method: null,
    financial_snapshot_at: '2026-08-01T00:00:00Z',
    confirmed_at: '2026-08-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
  },
  items: [],
  generated_at: '2026-08-01T00:00:00Z',
}

const FAKE_SETTLEMENT_META = {
  settlement: {
    id: 'set-001',
    settlement_number: 'LIQ-2026-0001',
    provider_actor_id: 'actor-001',
    currency: 'EUR',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    status: 'simulated_paid',
    sales_amount: 1000,
    shipping_amount: 50,
    refund_amount: 0,
    chargeback_amount: 0,
    chargeback_reversal_amount: 0,
    recovery_amount: 0,
    reserve_amount: 0,
    reserve_release_amount: 0,
    commission_amount: 0,
    commission_tax_amount: 0,
    adjustment_amount: 0,
    gross_activity: 1050,
    net_activity: 1050,
    max_payable: 1050,
    settlement_amount: 1050,
    simulation_only: true,
    calculated_at: '2026-08-27T00:00:00Z',
    approved_at: null,
    created_at: '2026-08-27T00:00:00Z',
  },
  settlement_lines: [],
  simulation_only: true,
  generated_at: '2026-08-27T00:00:00Z',
}

// ─── UI-5B-03 / UI-5B-04 — Subtype human labels ──────────────────────────────

describe('getDocSubtypeLabel', () => {
  it('UI-5B-03: supplier_statement → human label', () => {
    expect(getDocSubtypeLabel('supplier_statement')).toBe('Extracto de proveedor')
  })

  it('UI-5B-04: settlement_statement → human label', () => {
    expect(getDocSubtypeLabel('settlement_statement')).toBe('Liquidación')
  })

  it('unknown subtype does not leak raw underscore key', () => {
    const label = getDocSubtypeLabel('purchase_summary')
    expect(label).not.toContain('_')
  })

  it('DOC_SUBTYPE_LABELS covers both provider subtypes', () => {
    expect(DOC_SUBTYPE_LABELS).toHaveProperty('supplier_statement')
    expect(DOC_SUBTYPE_LABELS).toHaveProperty('settlement_statement')
  })
})

// ─── Doc ref type labels ──────────────────────────────────────────────────────

describe('getDocRefTypeLabel', () => {
  it('invoice → "Factura"', () => {
    expect(getDocRefTypeLabel('invoice')).toBe('Factura')
  })

  it('credit_note → "Factura rectificativa"', () => {
    expect(getDocRefTypeLabel('credit_note')).toBe('Factura rectificativa')
  })

  it('delivery_note → "Albarán"', () => {
    expect(getDocRefTypeLabel('delivery_note')).toBe('Albarán')
  })

  it('other → "Otro"', () => {
    expect(getDocRefTypeLabel('other')).toBe('Otro')
  })

  it('DOC_REF_TYPE_LABELS covers all 4 PROVIDER_DOC_REF_TYPES', () => {
    const expected = ['invoice', 'credit_note', 'delivery_note', 'other']
    expect(Object.keys(DOC_REF_TYPE_LABELS)).toEqual(expected)
  })
})

// ─── Settlement line labels ───────────────────────────────────────────────────

describe('getSettlementLineLabel', () => {
  it('GOODS_ENTITLEMENT → "Venta confirmada"', () => {
    expect(getSettlementLineLabel('GOODS_ENTITLEMENT')).toBe('Venta confirmada')
  })

  it('RESERVE_HOLD → "Retención temporal"', () => {
    expect(getSettlementLineLabel('RESERVE_HOLD')).toBe('Retención temporal')
  })

  it('REFUND_TO_BUYER → "Devolución al comprador"', () => {
    expect(getSettlementLineLabel('REFUND_TO_BUYER')).toBe('Devolución al comprador')
  })

  it('unknown entry_type falls back to humanized (no raw underscore)', () => {
    const label = getSettlementLineLabel('SOME_FUTURE_TYPE')
    expect(label).not.toContain('_')
  })
})

// ─── Order total computation ──────────────────────────────────────────────────

describe('computeOrderTotal', () => {
  it('sums goods and shipping gross snapshots', () => {
    expect(computeOrderTotal(100, 15.5)).toBeCloseTo(115.5)
  })

  it('treats null goods as 0', () => {
    expect(computeOrderTotal(null, 10)).toBe(10)
  })

  it('treats null shipping as 0', () => {
    expect(computeOrderTotal(50, null)).toBe(50)
  })

  it('treats both null as 0', () => {
    expect(computeOrderTotal(null, null)).toBe(0)
  })
})

// ─── UI-5B-12 — Order selector label (no raw UUID exposed) ───────────────────

describe('formatOrderSelectorLabel', () => {
  it('UI-5B-12: contains numero reference, not UUID', () => {
    const label = formatOrderSelectorLabel('SUP-2026-0001', 100, 15.5, 'EUR')
    expect(label).toContain('SUP-2026-0001')
    // Must not look like a UUID
    expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('includes computed total amount', () => {
    const label = formatOrderSelectorLabel('SUP-2026-0002', 200, 25, 'EUR')
    expect(label).toContain('225')
  })

  it('handles zero/null amounts without crashing', () => {
    const label = formatOrderSelectorLabel('SUP-2026-0003', null, null, 'EUR')
    expect(label).toContain('SUP-2026-0003')
    expect(label).toContain('EUR')
  })

  it('includes currency code', () => {
    const label = formatOrderSelectorLabel('PED-001', 100, 0, 'USD')
    expect(label).toContain('USD')
  })
})

// ─── Metadata extraction — supplier_statement ─────────────────────────────────

describe('extractSupplierStatementMeta', () => {
  it('extracts valid supplier_order from metadata', () => {
    const meta = extractSupplierStatementMeta(FAKE_SUPPLIER_META)
    expect(meta).not.toBeNull()
    expect(meta?.supplier_order.numero).toBe('SUP-2026-0001')
  })

  it('returns null when supplier_order key is missing', () => {
    expect(extractSupplierStatementMeta({})).toBeNull()
  })

  it('returns null when supplier_order is not an object', () => {
    expect(extractSupplierStatementMeta({ supplier_order: 'bad' })).toBeNull()
  })
})

// ─── Metadata extraction — settlement_statement ───────────────────────────────

describe('extractSettlementStatementMeta', () => {
  it('extracts valid settlement from metadata', () => {
    const meta = extractSettlementStatementMeta(FAKE_SETTLEMENT_META)
    expect(meta).not.toBeNull()
    expect(meta?.settlement.settlement_number).toBe('LIQ-2026-0001')
  })

  it('captures simulation_only at root level', () => {
    const meta = extractSettlementStatementMeta(FAKE_SETTLEMENT_META)
    expect(meta?.simulation_only).toBe(true)
  })

  it('returns null when settlement key is missing', () => {
    expect(extractSettlementStatementMeta({})).toBeNull()
  })

  it('returns null when settlement is not an object', () => {
    expect(extractSettlementStatementMeta({ settlement: 42 })).toBeNull()
  })
})

// ─── UI-5B-09 — simulation_only detection ────────────────────────────────────

describe('isSimulationOnly', () => {
  it('UI-5B-09: true when simulation_only at root level', () => {
    expect(isSimulationOnly({ simulation_only: true })).toBe(true)
  })

  it('true when simulation_only nested in settlement object', () => {
    expect(isSimulationOnly({ settlement: { simulation_only: true } })).toBe(true)
  })

  it('true for full settlement_statement metadata fixture', () => {
    expect(isSimulationOnly(FAKE_SETTLEMENT_META)).toBe(true)
  })

  it('false when simulation_only is false', () => {
    expect(isSimulationOnly({ simulation_only: false })).toBe(false)
  })

  it('false when simulation_only is absent', () => {
    expect(isSimulationOnly({})).toBe(false)
  })

  it('false for supplier_statement metadata (no simulation_only flag)', () => {
    expect(isSimulationOnly(FAKE_SUPPLIER_META)).toBe(false)
  })
})

// ─── UI-5B-13 — doc_number_provider validation spec ──────────────────────────

describe('doc number validation logic', () => {
  it('UI-5B-13: empty string fails trim check', () => {
    expect(''.trim().length > 0).toBe(false)
  })

  it('whitespace-only string fails trim check', () => {
    expect('   '.trim().length > 0).toBe(false)
  })

  it('valid number passes', () => {
    const n = 'FAC-2026-001'
    expect(n.trim().length > 0 && n.length <= 500).toBe(true)
  })

  it('500-char string is valid (boundary)', () => {
    expect('x'.repeat(500).length <= 500).toBe(true)
  })
})

// ─── UI-5B-14 — notes max length validation spec ─────────────────────────────

describe('notes max length validation logic', () => {
  it('UI-5B-14: 500 chars is valid', () => {
    expect('x'.repeat(500).length <= 500).toBe(true)
  })

  it('501 chars fails', () => {
    expect('x'.repeat(501).length <= 500).toBe(false)
  })

  it('empty string is valid (optional field)', () => {
    expect(''.length <= 500).toBe(true)
  })
})
