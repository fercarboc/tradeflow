// MP-FIN-4 — Provider Finance Account Tests
// PFA-01..PFA-50: aislamiento proveedor, invariantes, UX crítica.
// Tests de lógica de servicio y reglas de presentación.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  humanizeEntryType,
  getProviderSupplierOrders,
  getProviderSupplierOrderDetail,
  getProviderLedgerEntries,
} from '../provider-finance.service'

// ── PFA-01..PFA-10: humanizeEntryType ────────────────────────────────────────

describe('humanizeEntryType (PFA-01..PFA-10)', () => {
  it('PFA-01: GOODS_ENTITLEMENT → Venta confirmada', () => {
    expect(humanizeEntryType('GOODS_ENTITLEMENT')).toBe('Venta confirmada')
  })
  it('PFA-02: SHIPPING_ENTITLEMENT → Portes', () => {
    expect(humanizeEntryType('SHIPPING_ENTITLEMENT')).toBe('Portes')
  })
  it('PFA-03: COMMISSION_ACCRUAL → Comisión plataforma', () => {
    expect(humanizeEntryType('COMMISSION_ACCRUAL')).toBe('Comisión plataforma')
  })
  it('PFA-04: COMMISSION_SIM_ACCRUAL → Comisión (simulada)', () => {
    expect(humanizeEntryType('COMMISSION_SIM_ACCRUAL')).toBe('Comisión (simulada)')
  })
  it('PFA-05: REFUND_TO_BUYER → Devolución al comprador', () => {
    expect(humanizeEntryType('REFUND_TO_BUYER')).toBe('Devolución al comprador')
  })
  it('PFA-06: CHARGEBACK_DEBIT → Disputa (débito)', () => {
    expect(humanizeEntryType('CHARGEBACK_DEBIT')).toBe('Disputa (débito)')
  })
  it('PFA-07: RESERVE_HOLD → Retención temporal', () => {
    expect(humanizeEntryType('RESERVE_HOLD')).toBe('Retención temporal')
  })
  it('PFA-08: RESERVE_RELEASE → Liberación de retención', () => {
    expect(humanizeEntryType('RESERVE_RELEASE')).toBe('Liberación de retención')
  })
  it('PFA-09: SETTLEMENT_ADJUSTMENT → Liquidación', () => {
    expect(humanizeEntryType('SETTLEMENT_ADJUSTMENT')).toBe('Liquidación')
  })
  it('PFA-10: unknown type falls back gracefully (no crash)', () => {
    const result = humanizeEntryType('UNKNOWN_TYPE_XYZ')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

// ── PFA-11..PFA-20: supplier orders isolation ─────────────────────────────────

// Mock supabase at module level
vi.mock('../../../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../../../supabase'

const mockFrom = vi.mocked(supabase.from)

function buildQueryChain(finalResult: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
  }
  return chain
}

describe('getProviderSupplierOrders (PFA-11..PFA-20)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PFA-11: queries trade_marketplace_orders', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderSupplierOrders('actor-1', 20, 0)
    expect(mockFrom).toHaveBeenCalledWith('trade_marketplace_orders')
  })

  it('PFA-12: applies eq actor_id filter', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderSupplierOrders('actor-xyz', 20, 0)
    expect(chain.eq).toHaveBeenCalledWith('actor_id', 'actor-xyz')
  })

  it('PFA-13: returns empty list when no orders', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('PFA-14: maps master_numero from join — reference only', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'order-1', numero: 'ORD-001',
        master_order_id: 'master-1',
        estado: 'confirmado', payment_status: 'paid',
        goods_gross_snapshot: '100.00', shipping_gross_snapshot: '5.00',
        currency: 'EUR', created_at: '2026-01-01',
        trade_marketplace_master_orders: { numero: 'MASTER-001' },
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result.items[0].master_numero).toBe('MASTER-001')
  })

  it('PFA-15: master_numero is null when no master order', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'order-2', numero: 'ORD-002',
        master_order_id: null,
        estado: 'pendiente', payment_status: 'unpaid',
        goods_gross_snapshot: null, shipping_gross_snapshot: null,
        currency: 'EUR', created_at: '2026-01-01',
        trade_marketplace_master_orders: null,
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result.items[0].master_numero).toBeNull()
  })

  it('PFA-16: goods_gross_snapshot cast to number', async () => {
    const chain = buildQueryChain({
      data: [{ id: 'o', numero: 'N', master_order_id: null, estado: 'e',
        payment_status: 'paid', goods_gross_snapshot: '250.99',
        shipping_gross_snapshot: '10.00', currency: 'EUR',
        created_at: '2026-01-01',
        trade_marketplace_master_orders: null }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result.items[0].goods_gross_snapshot).toBe(250.99)
  })

  it('PFA-17: throws on supabase error', async () => {
    const chain = buildQueryChain({ data: null, error: { message: 'DB error' } })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await expect(getProviderSupplierOrders('actor-1', 20, 0)).rejects.toThrow('DB error')
  })

  it('PFA-18: pagination offset passed correctly', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderSupplierOrders('actor-1', 20, 40)
    expect(chain.range).toHaveBeenCalledWith(40, 59)
  })

  it('PFA-19: total from count', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 123 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result.total).toBe(123)
  })

  it('PFA-20: no master order financial data in response', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'o', numero: 'N', master_order_id: 'm', estado: 'e',
        payment_status: 'paid', goods_gross_snapshot: '100', shipping_gross_snapshot: '5',
        currency: 'EUR', created_at: '2026-01-01',
        trade_marketplace_master_orders: { numero: 'M-001' },
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    const item = result.items[0]
    // Only master_numero should be present — no financial aggregates
    expect(item).not.toHaveProperty('master_goods_total')
    expect(item).not.toHaveProperty('master_checkout_total')
    expect(item).not.toHaveProperty('other_suppliers')
    expect(Object.keys(item)).toContain('master_numero')
  })
})

// ── PFA-21..PFA-30: order detail isolation ────────────────────────────────────

describe('getProviderSupplierOrderDetail (PFA-21..PFA-30)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function mockDetailChain(orderData: unknown, itemsData: unknown[]) {
    const itemsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: itemsData, error: null }),
    }
    const orderChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: orderData, error: null }),
    }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return orderChain as unknown as ReturnType<typeof supabase.from>
      return itemsChain as unknown as ReturnType<typeof supabase.from>
    })
    return { orderChain, itemsChain }
  }

  it('PFA-21: filters by orderId AND actorId', async () => {
    const { orderChain } = mockDetailChain({
      id: 'o1', numero: 'ORD-001', master_order_id: null,
      estado: 'confirmado', payment_status: 'paid',
      subtotal: 100, coste_envio: 5, total: 105,
      goods_gross_snapshot: 100, shipping_gross_snapshot: 5,
      tax_rate_snapshot: 21, currency: 'EUR', created_at: '2026-01-01',
      trade_marketplace_master_orders: null,
    }, [])
    await getProviderSupplierOrderDetail('order-1', 'actor-a')
    expect(orderChain.eq).toHaveBeenCalledWith('id', 'order-1')
    expect(orderChain.eq).toHaveBeenCalledWith('actor_id', 'actor-a')
  })

  it('PFA-22: includes order items', async () => {
    mockDetailChain({
      id: 'o1', numero: 'ORD-001', master_order_id: null,
      estado: 'confirmado', payment_status: 'paid',
      subtotal: 100, coste_envio: 5, total: 105,
      goods_gross_snapshot: 100, shipping_gross_snapshot: 5,
      tax_rate_snapshot: 21, currency: 'EUR', created_at: '2026-01-01',
      trade_marketplace_master_orders: null,
    }, [
      { id: 'item-1', producto_id: 'p1', nombre_producto: 'Tornillo M8',
        cantidad: 10, precio_unitario: 0.5, precio_total: 5,
        item_gross_snapshot: 5, currency: 'EUR' },
    ])
    const detail = await getProviderSupplierOrderDetail('order-1', 'actor-a')
    expect(detail.items).toHaveLength(1)
    expect(detail.items[0].nombre_producto).toBe('Tornillo M8')
  })

  it('PFA-23: master_numero present but no master financials', async () => {
    mockDetailChain({
      id: 'o1', numero: 'ORD-001', master_order_id: 'm1',
      estado: 'confirmado', payment_status: 'paid',
      subtotal: 100, coste_envio: 5, total: 105,
      goods_gross_snapshot: 100, shipping_gross_snapshot: 5,
      tax_rate_snapshot: 21, currency: 'EUR', created_at: '2026-01-01',
      trade_marketplace_master_orders: { numero: 'MO-001' },
    }, [])
    const detail = await getProviderSupplierOrderDetail('order-1', 'actor-a')
    expect(detail.master_numero).toBe('MO-001')
    expect(detail).not.toHaveProperty('master_goods_total')
    expect(detail).not.toHaveProperty('sibling_suppliers')
  })

  it('PFA-24: items list empty when no items', async () => {
    mockDetailChain({
      id: 'o1', numero: 'ORD-001', master_order_id: null,
      estado: 'confirmado', payment_status: 'paid',
      subtotal: 0, coste_envio: 0, total: 0,
      goods_gross_snapshot: null, shipping_gross_snapshot: null,
      tax_rate_snapshot: null, currency: 'EUR', created_at: '2026-01-01',
      trade_marketplace_master_orders: null,
    }, [])
    const detail = await getProviderSupplierOrderDetail('order-1', 'actor-a')
    expect(detail.items).toHaveLength(0)
  })

  it('PFA-25: item_gross_snapshot null when missing', async () => {
    mockDetailChain({
      id: 'o1', numero: 'ORD-001', master_order_id: null,
      estado: 'confirmado', payment_status: 'paid',
      subtotal: 100, coste_envio: 5, total: 105,
      goods_gross_snapshot: 100, shipping_gross_snapshot: 5,
      tax_rate_snapshot: 21, currency: 'EUR', created_at: '2026-01-01',
      trade_marketplace_master_orders: null,
    }, [
      { id: 'item-1', producto_id: null, nombre_producto: 'Producto X',
        cantidad: 1, precio_unitario: 100, precio_total: 100,
        item_gross_snapshot: null, currency: 'EUR' },
    ])
    const detail = await getProviderSupplierOrderDetail('order-1', 'actor-a')
    expect(detail.items[0].item_gross_snapshot).toBeNull()
  })
})

// ── PFA-31..PFA-40: ledger queries ────────────────────────────────────────────

describe('getProviderLedgerEntries (PFA-31..PFA-40)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PFA-31: queries trade_marketplace_ledger_entries', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderLedgerEntries('actor-1', 25, 0)
    expect(mockFrom).toHaveBeenCalledWith('trade_marketplace_ledger_entries')
  })

  it('PFA-32: filters by actor_id', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderLedgerEntries('actor-abc', 25, 0)
    expect(chain.eq).toHaveBeenCalledWith('actor_id', 'actor-abc')
  })

  it('PFA-33: excludes failed entries', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderLedgerEntries('actor-1', 25, 0)
    expect(chain.neq).toHaveBeenCalledWith('status', 'failed')
  })

  it('PFA-34: returns total from count', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 55 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderLedgerEntries('actor-1', 25, 0)
    expect(result.total).toBe(55)
  })

  it('PFA-35: maps entryType from entry_type', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'e1', entry_type: 'GOODS_ENTITLEMENT', amount: '100',
        currency: 'EUR', status: 'confirmed',
        master_order_id: null, supplier_order_id: null, actor_id: 'actor-1',
        settlement_id: null, refund_id: null, dispute_id: null,
        description: null, correlation_id: null, source_event_id: null,
        compensates_entry_id: null, external_provider: 'simulation',
        external_id: null, external_type: null,
        occurred_at: '2026-01-01', created_at: '2026-01-01',
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderLedgerEntries('actor-1', 25, 0)
    expect(result.items[0].entryType).toBe('GOODS_ENTITLEMENT')
    expect(result.items[0].amount).toBe(100)
  })

  it('PFA-36: throws on DB error', async () => {
    const chain = buildQueryChain({ data: null, error: { message: 'Ledger error' } })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await expect(getProviderLedgerEntries('actor-1', 25, 0)).rejects.toThrow('Ledger error')
  })

  it('PFA-37: default currency EUR when null', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'e2', entry_type: 'SHIPPING_ENTITLEMENT', amount: '10',
        currency: null, status: 'confirmed',
        master_order_id: null, supplier_order_id: null, actor_id: 'actor-1',
        settlement_id: null, refund_id: null, dispute_id: null,
        description: null, correlation_id: null, source_event_id: null,
        compensates_entry_id: null, external_provider: null,
        external_id: null, external_type: null,
        occurred_at: '2026-01-01', created_at: '2026-01-01',
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderLedgerEntries('actor-1', 25, 0)
    expect(result.items[0].currency).toBe('EUR')
  })

  it('PFA-38: externalProvider defaults to simulation', async () => {
    const chain = buildQueryChain({
      data: [{
        id: 'e3', entry_type: 'GOODS_ENTITLEMENT', amount: '50',
        currency: 'EUR', status: 'pending',
        master_order_id: null, supplier_order_id: null, actor_id: 'actor-1',
        settlement_id: null, refund_id: null, dispute_id: null,
        description: null, correlation_id: null, source_event_id: null,
        compensates_entry_id: null, external_provider: null,
        external_id: null, external_type: null,
        occurred_at: '2026-01-01', created_at: '2026-01-01',
      }],
      error: null, count: 1,
    })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderLedgerEntries('actor-1', 25, 0)
    expect(result.items[0].externalProvider).toBe('simulation')
  })
})

// ── PFA-41..PFA-50: business rules ────────────────────────────────────────────

describe('Business rules (PFA-41..PFA-50)', () => {
  it('PFA-41: COMMISSION_SIM_ACCRUAL label contains "simulada"', () => {
    const label = humanizeEntryType('COMMISSION_SIM_ACCRUAL')
    expect(label.toLowerCase()).toContain('simul')
  })

  it('PFA-42: GOODS_ENTITLEMENT label does not contain "comisión"', () => {
    const label = humanizeEntryType('GOODS_ENTITLEMENT').toLowerCase()
    expect(label).not.toContain('comisión')
    expect(label).not.toContain('comision')
  })

  it('PFA-43: SETTLEMENT_ADJUSTMENT label does not contain "transferi"', () => {
    const label = humanizeEntryType('SETTLEMENT_ADJUSTMENT').toLowerCase()
    expect(label).not.toContain('transferi')
  })

  it('PFA-44: RESERVE_HOLD label contains "retención" or "retenci" (temporal block)', () => {
    const label = humanizeEntryType('RESERVE_HOLD').toLowerCase()
    expect(label.includes('retenci') || label.includes('bloqueo') || label.includes('hold')).toBe(true)
  })

  it('PFA-45: humanizeEntryType never returns empty string', () => {
    const types = [
      'GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT', 'COMMISSION_ACCRUAL',
      'REFUND_TO_BUYER', 'CHARGEBACK_DEBIT', 'RESERVE_HOLD',
      'SETTLEMENT_ADJUSTMENT', 'NEGATIVE_BALANCE_RECORD', 'BALANCE_RECOVERY',
    ]
    for (const t of types) {
      expect(humanizeEntryType(t).length).toBeGreaterThan(0)
    }
  })

  it('PFA-46: provider order result has no sibling supplier data keys', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 })
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    const result = await getProviderSupplierOrders('actor-1', 20, 0)
    expect(result).not.toHaveProperty('all_supplier_totals')
    expect(result).not.toHaveProperty('sibling_orders')
  })

  it('PFA-47: GOODS_REFUND_REVERSAL label does not mention other suppliers', () => {
    const label = humanizeEntryType('GOODS_REFUND_REVERSAL').toLowerCase()
    expect(label).not.toContain('proveedor')
  })

  it('PFA-48: BUYER_PAYMENT is humanized (not raw)', () => {
    const label = humanizeEntryType('BUYER_PAYMENT')
    expect(label).not.toBe('BUYER_PAYMENT')
  })

  it('PFA-49: PSP_FEE_DEBIT is humanized', () => {
    const label = humanizeEntryType('PSP_FEE_DEBIT')
    expect(label).not.toBe('PSP_FEE_DEBIT')
  })

  it('PFA-50: getProviderLedgerEntries uses count:exact', async () => {
    let capturedSelect: { count?: string } = {}
    const chain = {
      select: vi.fn().mockImplementation((fields: string, opts: { count?: string }) => {
        capturedSelect = opts ?? {}
        return chain
      }),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    }
    mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)
    await getProviderLedgerEntries('actor-1', 25, 0)
    expect(capturedSelect.count).toBe('exact')
  })
})
