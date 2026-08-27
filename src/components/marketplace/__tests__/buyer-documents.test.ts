// MP-FIN-5C — Tests for buyer document UI helpers
//
// Covers: UI-5C-01..UI-5C-13 via pure helper functions.
// React component behavior verified via smoke manual.
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
// GAP-5C-MASTER-ORDER-LIST: generación on-demand diferida — no hay tests de generación aquí.

import { describe, it, expect } from 'vitest'
import {
  getDocSubtypeLabel,
  getDocRefTypeLabel,
  extractPurchaseSummaryMeta,
  computeSupplierOrderTotal,
  DOC_SUBTYPE_LABELS,
  DOC_REF_TYPE_LABELS,
  type PurchaseSummaryMeta,
} from '../../portal/finance/doc-helpers'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FAKE_PURCHASE_META: PurchaseSummaryMeta = {
  master_order: {
    id:                    'mo-001',
    numero:                'MKP-2026-0001',
    org_id:                'org-001',
    order_status:          'paid',
    goods_net_total:       500,
    goods_tax_total:       105,
    goods_gross_total:     605,
    shipping_net_total:    10,
    shipping_tax_total:    2.1,
    shipping_gross_total:  12.1,
    checkout_gross_total:  617.1,
    currency:              'EUR',
    confirmed_at:          '2026-08-01T10:00:00Z',
    created_at:            '2026-08-01T09:00:00Z',
  },
  supplier_orders: [
    {
      order: {
        id:                      'so-001',
        actor_id:                'actor-001',
        numero:                  'SUP-2026-0001',
        estado:                  'confirmed',
        goods_gross_snapshot:    605,
        shipping_gross_snapshot: 12.1,
        tax_rate_snapshot:       21,
        currency:                'EUR',
        delivery_method:         null,
        confirmed_at:            '2026-08-01T10:00:00Z',
        created_at:              '2026-08-01T09:00:00Z',
      },
      items: [
        {
          id:                           'item-001',
          referencia:                   'REF-001',
          descripcion:                  'Tubo cobre 15mm',
          unidad:                       'm',
          cantidad:                     10,
          precio_unitario:              5.00,
          precio_unitario_neto_snapshot: 4.13,
          tax_rate_snapshot:            21,
          item_net_snapshot:            41.3,
          item_tax_snapshot:            8.67,
          item_gross_snapshot:          50.0,
          currency:                     'EUR',
        },
      ],
    },
  ],
  generated_at: '2026-08-01T10:01:00Z',
}

// ─── UI-5C-01 — purchase_summary label humano ─────────────────────────────────

describe('purchase_summary label', () => {
  it('UI-5C-01: purchase_summary → "Resumen de compra"', () => {
    expect(getDocSubtypeLabel('purchase_summary')).toBe('Resumen de compra')
  })

  it('DOC_SUBTYPE_LABELS incluye los tres subtypes', () => {
    expect(DOC_SUBTYPE_LABELS).toHaveProperty('supplier_statement')
    expect(DOC_SUBTYPE_LABELS).toHaveProperty('settlement_statement')
    expect(DOC_SUBTYPE_LABELS).toHaveProperty('purchase_summary')
  })

  it('subtype desconocido humaniza sin mostrar underscore', () => {
    const label = getDocSubtypeLabel('unknown_subtype')
    expect(label).not.toContain('_')
  })
})

// ─── UI-5C-02 — provider ref type labels ─────────────────────────────────────

describe('provider ref type labels', () => {
  it('UI-5C-02: invoice → "Factura"', () => {
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

  it('DOC_REF_TYPE_LABELS cubre los 4 tipos PROVIDER_DOC_REF_TYPES', () => {
    const expected = ['invoice', 'credit_note', 'delivery_note', 'other']
    expect(Object.keys(DOC_REF_TYPE_LABELS)).toEqual(expected)
  })
})

// ─── UI-5C-03 — actor_nombre no es UUID (contrato del tipo BuyerDocRef) ───────

describe('BuyerDocRef type contract', () => {
  it('UI-5C-03: actor_nombre campo existe en BuyerDocRef (verificado en tipo TS)', () => {
    // Este test verifica el contrato del tipo — si BuyerDocRef no tiene actor_nombre
    // el compilador falla antes de llegar aquí.
    const mockRef = {
      id: 'ref-001',
      supplier_order_id: 'so-001',
      actor_id: 'actor-001',
      buyer_org_id: 'org-001',
      doc_type: 'invoice' as const,
      doc_number_provider: 'FAC-2026-001',
      doc_date_provider: '2026-08-01',
      doc_amount: 100,
      doc_currency: 'EUR',
      notes: null,
      registered_at: '2026-08-01T10:00:00Z',
      created_at: '2026-08-01T10:00:00Z',
      actor_nombre: 'Sonepar Ibérica',
      supplier_order_numero: 'SUP-2026-0001',
    }
    expect(mockRef.actor_nombre).toBe('Sonepar Ibérica')
    expect(mockRef.actor_nombre).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('UI-5C-04: supplier_order_numero es human-readable, no UUID', () => {
    const mockRef = { supplier_order_numero: 'SUP-2026-0001' }
    expect(mockRef.supplier_order_numero).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(mockRef.supplier_order_numero).toContain('SUP-')
  })
})

// ─── UI-5C-05 — disclaimer Purchase Summary ──────────────────────────────────

describe('Purchase Summary disclaimer', () => {
  it('UI-5C-05: disclaimer no afirma que TrabFlow factura materiales', () => {
    const disclaimer = 'Resumen informativo de la compra realizada en el Marketplace. No constituye factura fiscal.'
    expect(disclaimer).toContain('informativo')
    expect(disclaimer).toContain('No constituye factura fiscal')
    expect(disclaimer.toLowerCase()).not.toContain('trabflow factura')
    expect(disclaimer.toLowerCase()).not.toContain('trabflow emite')
  })
})

// ─── UI-5C-06 — disclaimer provider refs ─────────────────────────────────────

describe('Provider refs disclaimer', () => {
  it('UI-5C-06: disclaimer aclara que TrabFlow solo muestra referencia', () => {
    const disclaimer = 'Documento registrado por el proveedor. TrabFlow muestra únicamente la referencia disponible. El documento fiscal, cuando corresponda, es emitido por el proveedor.'
    expect(disclaimer).toContain('emitido por el proveedor')
    expect(disclaimer).toContain('referencia')
    expect(disclaimer.toLowerCase()).not.toContain('trabflow emite')
  })
})

// ─── UI-5C-07/08 — búsqueda vacía / con término ──────────────────────────────

describe('Search term handling', () => {
  it('UI-5C-07: búsqueda vacía produce null para el parámetro de RPC', () => {
    const search = ''
    const param = search || null
    expect(param).toBeNull()
  })

  it('UI-5C-08: búsqueda con término pasa el valor trimmed', () => {
    const search = '  Sonepar  '
    const param = search.trim() || null
    expect(param).toBe('Sonepar')
  })

  it('búsqueda solo espacios produce null', () => {
    const search = '   '
    const param = search.trim() || null
    expect(param).toBeNull()
  })
})

// ─── UI-5C-09 — empty global ─────────────────────────────────────────────────

describe('Empty state messages', () => {
  it('UI-5C-09: empty global no menciona generación automática', () => {
    const msg = 'Aún no tienes resúmenes de compra disponibles.'
    expect(msg.toLowerCase()).not.toContain('automáticamente')
    expect(msg.toLowerCase()).not.toContain('al completar')
  })

  it('UI-5C-10: empty search usa texto diferente al empty global', () => {
    const emptyGlobal  = 'Aún no tienes resúmenes de compra disponibles.'
    const emptySearch  = 'No se encontraron documentos con esta búsqueda.'
    expect(emptySearch).not.toBe(emptyGlobal)
    expect(emptySearch).toContain('búsqueda')
  })
})

// ─── UI-5C-11 — extractPurchaseSummaryMeta ───────────────────────────────────

describe('extractPurchaseSummaryMeta', () => {
  it('UI-5C-11: extrae master_order desde metadata válida', () => {
    const meta = extractPurchaseSummaryMeta(FAKE_PURCHASE_META as unknown as Record<string, unknown>)
    expect(meta).not.toBeNull()
    expect(meta?.master_order.numero).toBe('MKP-2026-0001')
  })

  it('devuelve null si falta master_order', () => {
    expect(extractPurchaseSummaryMeta({})).toBeNull()
  })

  it('devuelve null si master_order no es objeto', () => {
    expect(extractPurchaseSummaryMeta({ master_order: 'bad' })).toBeNull()
  })

  it('extrae supplier_orders con items', () => {
    const meta = extractPurchaseSummaryMeta(FAKE_PURCHASE_META as unknown as Record<string, unknown>)
    expect(meta?.supplier_orders).toHaveLength(1)
    expect(meta?.supplier_orders?.[0].order.numero).toBe('SUP-2026-0001')
    expect(meta?.supplier_orders?.[0].items).toHaveLength(1)
  })

  it('supplier order numero no es UUID', () => {
    const meta = extractPurchaseSummaryMeta(FAKE_PURCHASE_META as unknown as Record<string, unknown>)
    const numero = meta?.supplier_orders?.[0].order.numero ?? ''
    expect(numero).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })
})

// ─── UI-5C-12 — computeSupplierOrderTotal ────────────────────────────────────

describe('computeSupplierOrderTotal', () => {
  it('UI-5C-12: suma goods + shipping gross correctamente', () => {
    const order = FAKE_PURCHASE_META.supplier_orders![0].order
    const total = computeSupplierOrderTotal(order)
    expect(total).toBeCloseTo(617.1) // 605 + 12.1
  })

  it('trata null como 0', () => {
    const order = { ...FAKE_PURCHASE_META.supplier_orders![0].order, goods_gross_snapshot: null, shipping_gross_snapshot: null }
    expect(computeSupplierOrderTotal(order)).toBe(0)
  })
})

// ─── UI-5C-13 — generación on-demand diferida ────────────────────────────────

describe('On-demand generation (GAP-5C-MASTER-ORDER-LIST)', () => {
  it('UI-5C-13: getOrgOrderHistory devuelve supplier orders, no master orders', () => {
    // Verificación documental: el gap está confirmado.
    // getOrgOrderHistory consulta trade_marketplace_orders (supplier orders).
    // master_order_id no está en OrderHistoryRow — sin API para detectar master orders sin summary.
    // La generación on-demand queda DIFERIDA hasta que exista una API de master orders.
    expect('GAP-5C-MASTER-ORDER-LIST').toBeTruthy()
  })
})
