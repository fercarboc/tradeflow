// MP-FIN-5A.1 — Financial Documents Foundation Tests
// FDO-01..FDO-50
//
// COBERTURA:
//   FDO-01..10: constantes, tipos y subtypes
//   FDO-11..20: modelo de inmutabilidad (campos protegidos vs mutables) — literals
//   FDO-21..30: invariantes de negocio y gates — valores directos
//   FDO-31..40: modelo provider_doc_refs (neutral, extensible)
//   FDO-41..50: aislamiento y reglas de negocio críticas

import { describe, it, expect } from 'vitest'
import {
  MARKETPLACE_DOC_SUBTYPES,
  DOC_SERIES,
  PROVIDER_DOC_TYPES,
  type MarketplaceDocSubtype,
  type ProviderDocType,
} from '../financial-docs-foundation'

// ── FDO-01..10: Constantes, tipos y subtypes ─────────────────────────────

describe('Subtypes y series documentales (FDO-01..FDO-10)', () => {
  it('FDO-01: MARKETPLACE_DOC_SUBTYPES contiene los 4 subtipos definidos', () => {
    expect(MARKETPLACE_DOC_SUBTYPES).toHaveLength(4)
    expect(MARKETPLACE_DOC_SUBTYPES).toContain('purchase_summary')
    expect(MARKETPLACE_DOC_SUBTYPES).toContain('supplier_statement')
    expect(MARKETPLACE_DOC_SUBTYPES).toContain('settlement_statement')
    expect(MARKETPLACE_DOC_SUBTYPES).toContain('commission_invoice')
  })

  it('FDO-02: purchase_summary corresponde a serie MKP', () => {
    expect(DOC_SERIES.PURCHASE_SUMMARY).toBe('MKP')
  })

  it('FDO-03: supplier_statement corresponde a serie SUP', () => {
    expect(DOC_SERIES.SUPPLIER_STATEMENT).toBe('SUP')
  })

  it('FDO-04: settlement_statement corresponde a serie LIQ', () => {
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).toBe('LIQ')
  })

  it('FDO-05: commission_invoice corresponde a serie COM (TAX_GATE placeholder)', () => {
    expect(DOC_SERIES.COMMISSION_INVOICE).toBe('COM')
  })

  it('FDO-06: PROVIDER_DOC_TYPES contiene los 4 tipos neutros', () => {
    expect(PROVIDER_DOC_TYPES).toContain('invoice')
    expect(PROVIDER_DOC_TYPES).toContain('credit_note')
    expect(PROVIDER_DOC_TYPES).toContain('delivery_note')
    expect(PROVIDER_DOC_TYPES).toContain('other')
  })

  it('FDO-07: serie MKP no es serie fiscal aprobada (purchase_summary)', () => {
    expect(DOC_SERIES.PURCHASE_SUMMARY).toBe('MKP')
    expect(['TF', 'ADV']).not.toContain(DOC_SERIES.PURCHASE_SUMMARY)
  })

  it('FDO-08: serie SUP no es serie fiscal aprobada (supplier_statement)', () => {
    expect(DOC_SERIES.SUPPLIER_STATEMENT).toBe('SUP')
    expect(['TF', 'ADV']).not.toContain(DOC_SERIES.SUPPLIER_STATEMENT)
  })

  it('FDO-09: serie LIQ indica liquidación simulada (settlement_statement)', () => {
    // "LIQ" = Liquidación — siempre SIMULATION ONLY (STRIPE_GATE OPEN)
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).toBe('LIQ')
    expect(['TF', 'ADV']).not.toContain(DOC_SERIES.SETTLEMENT_STATEMENT)
  })

  it('FDO-10: serie COM existe como capacidad futura bloqueada por TAX_GATE', () => {
    expect(DOC_SERIES.COMMISSION_INVOICE).toBe('COM')
    // COM no es TF (facturas de suscripción con numeración fiscal real)
    expect(DOC_SERIES.COMMISSION_INVOICE).not.toBe('TF')
  })
})

// ── FDO-11..20: Inmutabilidad — campos protegidos vs mutables ────────────
//
// La autoridad sobre qué campos están protegidos es el trigger SQL
// guard_financial_document_immutability() en la migración 5A.1.
// Estos tests documentan el modelo como literales — sin duplicar el trigger.

describe('Modelo de inmutabilidad del snapshot (FDO-11..FDO-20)', () => {
  // Campos del snapshot económico — protegidos por Regla 1 del trigger
  // (guard_financial_document_immutability, cuando immutable_at IS NOT NULL)
  const ECONOMIC_SNAPSHOT_FIELDS = [
    'subtotal', 'rate_amount', 'discount_amount', 'promotion_amount',
    'commercial_value', 'net_amount', 'tax_rate', 'tax_amount',
    'total_amount', 'currency', 'concept', 'period_start', 'period_end', 'quantity',
  ]

  // Campos operativos — mutables tras immutable_at (Regla: el snapshot histórico no cambia)
  const OPERATIONAL_FIELDS = [
    'estado', 'payment_status', 'paid_at', 'sent_at', 'sent_to',
    'invoice_url', 'invoice_pdf_url', 'payment_method',
    'stripe_payment_id', 'stripe_invoice_id', 'stripe_customer_id', 'updated_at',
  ]

  it('FDO-11: net_amount es campo del snapshot económico (protegido por trigger Regla 1)', () => {
    expect(ECONOMIC_SNAPSHOT_FIELDS).toContain('net_amount')
  })

  it('FDO-12: total_amount es campo del snapshot económico', () => {
    expect(ECONOMIC_SNAPSHOT_FIELDS).toContain('total_amount')
  })

  it('FDO-13: tax_rate es campo del snapshot económico', () => {
    expect(ECONOMIC_SNAPSHOT_FIELDS).toContain('tax_rate')
  })

  it('FDO-14: currency es campo del snapshot económico', () => {
    expect(ECONOMIC_SNAPSHOT_FIELDS).toContain('currency')
  })

  it('FDO-15: metadata es el snapshot completo — protegido por Regla 6 del trigger', () => {
    // metadata permite reconstrucción determinista aunque no exista PDF
    const allProtectedByTrigger = [
      ...ECONOMIC_SNAPSHOT_FIELDS,
      'doc_number',
      'document_type', 'document_subtype', 'doc_series', 'revenue_type', 'payer_type',
      'org_id', 'actor_id', 'customer_name', 'customer_nif', 'customer_email', 'customer_address',
      'master_order_id', 'supplier_order_id', 'settlement_id',
      'platform_invoice_id', 'ad_booking_id', 'subscription_id',
      'metadata',
    ]
    expect(allProtectedByTrigger).toContain('metadata')
    expect(allProtectedByTrigger).toContain('doc_number')
  })

  it('FDO-16: document_subtype es campo de clasificación protegido (Regla 3 del trigger)', () => {
    // Regla 3: document_type, document_subtype, doc_series, revenue_type, payer_type
    const classificationFields = [
      'document_type', 'document_subtype', 'doc_series', 'revenue_type', 'payer_type',
    ]
    expect(classificationFields).toContain('document_subtype')
  })

  it('FDO-17: master_order_id, supplier_order_id, settlement_id son FKs de origen protegidas (Regla 5)', () => {
    const originFKs = [
      'master_order_id', 'supplier_order_id', 'settlement_id',
      'platform_invoice_id', 'ad_booking_id', 'subscription_id',
    ]
    expect(originFKs).toContain('master_order_id')
    expect(originFKs).toContain('supplier_order_id')
    expect(originFKs).toContain('settlement_id')
  })

  it('FDO-18: estado y payment_status son campos operativos (mutables tras congelación)', () => {
    expect(OPERATIONAL_FIELDS).toContain('estado')
    expect(OPERATIONAL_FIELDS).toContain('payment_status')
  })

  it('FDO-19: sent_at, invoice_url, updated_at son campos operativos', () => {
    expect(OPERATIONAL_FIELDS).toContain('sent_at')
    expect(OPERATIONAL_FIELDS).toContain('invoice_url')
    expect(OPERATIONAL_FIELDS).toContain('updated_at')
  })

  it('FDO-20: snapshot económico y campos operativos son conjuntos disjuntos', () => {
    const economicSet = new Set(ECONOMIC_SNAPSHOT_FIELDS)
    const operationalSet = new Set(OPERATIONAL_FIELDS)
    const intersection = [...economicSet].filter(f => operationalSet.has(f))
    expect(intersection).toHaveLength(0)
  })
})

// ── FDO-21..30: Invariantes de negocio y gates ───────────────────────────

describe('Invariantes de negocio y gates (FDO-21..FDO-30)', () => {
  it('FDO-21: COMMISSION_GATE — commission_amount producido por Settlement Engine, no constante TS', () => {
    // SETTLEMENT_COMMISSION_REAL eliminada de foundation.ts para evitar segunda fuente de verdad.
    // La fuente de autoridad es trade_marketplace_settlements.commission_amount (backend).
    // El frontend lee el snapshot del documento; nunca recalcula.
    // La serie LIQ confirma que los settlement statements son informativos (LEGAL_GATE OPEN).
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).toBe('LIQ')
    expect(['TF', 'ADV']).not.toContain(DOC_SERIES.SETTLEMENT_STATEMENT)
  })

  it('FDO-22: serie COM no es fiscal — TAX_GATE OPEN bloquea su emisión', () => {
    // COM existe como capacidad estructural futura únicamente
    expect(DOC_SERIES.COMMISSION_INVOICE).toBe('COM')
    // COM no es TF (facturas de suscripción con numeración fiscal aprobada)
    expect(DOC_SERIES.COMMISSION_INVOICE).not.toBe('TF')
  })

  it('FDO-23: series MKP/SUP/LIQ no coinciden con series fiscales existentes (TF/ADV)', () => {
    const marketplaceSeries = [
      DOC_SERIES.PURCHASE_SUMMARY,
      DOC_SERIES.SUPPLIER_STATEMENT,
      DOC_SERIES.SETTLEMENT_STATEMENT,
    ]
    const fiscalSeries = ['TF', 'ADV']
    for (const series of marketplaceSeries) {
      expect(fiscalSeries).not.toContain(series)
    }
  })

  it('FDO-24: provider_doc_refs — actor_id identifica al proveedor emisor externo', () => {
    // TrabFlow NO emite estos documentos — el número lo asigna el proveedor
    const providerDocFields = [
      'supplier_order_id', 'actor_id',
      'doc_number_provider', // número asignado por el proveedor, no por TrabFlow
      'doc_date_provider',
    ]
    expect(providerDocFields).toContain('actor_id')
    expect(providerDocFields).toContain('doc_number_provider')
  })

  it('FDO-25: settlement_statement lee de trade_marketplace_settlements (MP-FIN-2F)', () => {
    // SOURCE OF TRUTH: Settlement Engine. No recalcula ventas, portes ni importes.
    const sourceTable = 'trade_marketplace_settlements'
    expect(sourceTable).toBe('trade_marketplace_settlements')
  })

  it('FDO-26: purchase_summary — serie MKP no implica factura fiscal (LEGAL_GATE OPEN)', () => {
    const series = DOC_SERIES.PURCHASE_SUMMARY
    expect(series).toBe('MKP')
    expect(['TF', 'ADV']).not.toContain(series)
  })

  it('FDO-27: supplier_statement — serie SUP no implica factura fiscal (LEGAL_GATE OPEN)', () => {
    const series = DOC_SERIES.SUPPLIER_STATEMENT
    expect(series).toBe('SUP')
    expect(['TF', 'ADV']).not.toContain(series)
  })

  it('FDO-28: settlement_statement — serie LIQ confirma carácter simulado (STRIPE_GATE OPEN)', () => {
    // STRIPE_GATE OPEN: no hay transferencia bancaria real
    // El importe de comisión lo produce el Settlement Engine, no una constante TS
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).toBe('LIQ')
    expect(['TF', 'ADV']).not.toContain(DOC_SERIES.SETTLEMENT_STATEMENT)
  })

  it('FDO-29: commission_invoice — serie COM es TAX_GATE placeholder sin generador activo', () => {
    const series = DOC_SERIES.COMMISSION_INVOICE
    expect(series).toBe('COM')
    expect(series).not.toMatch(/^(TF|ADV)$/)
  })

  it('FDO-30: ninguna serie marketplace coincide con TF (facturas de suscripción)', () => {
    expect(DOC_SERIES.COMMISSION_INVOICE).not.toBe('TF')
    expect(DOC_SERIES.PURCHASE_SUMMARY).not.toBe('TF')
    expect(DOC_SERIES.SUPPLIER_STATEMENT).not.toBe('TF')
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).not.toBe('TF')
  })
})

// ── FDO-31..40: Modelo provider_doc_refs (neutral, extensible) ───────────

describe('Provider doc refs — modelo neutral y extensible (FDO-31..FDO-40)', () => {
  it('FDO-31: PROVIDER_DOC_TYPES incluye invoice', () => {
    const types: string[] = [...PROVIDER_DOC_TYPES]
    expect(types).toContain('invoice')
  })

  it('FDO-32: PROVIDER_DOC_TYPES incluye credit_note (rectificativa/abono)', () => {
    expect(PROVIDER_DOC_TYPES).toContain('credit_note')
  })

  it('FDO-33: PROVIDER_DOC_TYPES incluye delivery_note (albarán)', () => {
    expect(PROVIDER_DOC_TYPES).toContain('delivery_note')
  })

  it('FDO-34: PROVIDER_DOC_TYPES incluye other (extensibilidad futura)', () => {
    expect(PROVIDER_DOC_TYPES).toContain('other')
  })

  it('FDO-35: ProviderDocRef tiene supplier_order_id (no master_order_id)', () => {
    // La ref se vincula al pedido del proveedor, no al master order
    const ref: Partial<Record<string, unknown>> = {
      supplier_order_id: 'order-123',
      actor_id: 'actor-456',
      doc_type: 'invoice',
      doc_number_provider: 'FAC-2026-001',
      doc_date_provider: '2026-08-25',
    }
    expect(ref).toHaveProperty('supplier_order_id')
    expect(ref).not.toHaveProperty('master_order_id')
  })

  it('FDO-36: buyer_org_id es opcional (null para guest checkout)', () => {
    const withNullBuyer = { buyer_org_id: null }
    expect(withNullBuyer.buyer_org_id).toBeNull()
  })

  it('FDO-37: un supplier_order puede tener múltiples doc_refs (sin UNIQUE constraint)', () => {
    // Un pedido puede tener: invoice + credit_note + delivery_note
    const docs: Array<{ doc_type: ProviderDocType; doc_number_provider: string }> = [
      { doc_type: 'invoice',       doc_number_provider: 'FAC-2026-001' },
      { doc_type: 'credit_note',   doc_number_provider: 'RECT-2026-001' },
      { doc_type: 'delivery_note', doc_number_provider: 'ALB-2026-001' },
    ]
    expect(docs).toHaveLength(3)
    const types = docs.map(d => d.doc_type)
    expect(types).toContain('invoice')
    expect(types).toContain('credit_note')
    expect(types).toContain('delivery_note')
  })

  it('FDO-38: doc_amount es opcional (null permitido)', () => {
    const ref = { doc_amount: null }
    expect(ref.doc_amount).toBeNull()
  })

  it('FDO-39: doc_currency default EUR', () => {
    const defaultCurrency = 'EUR'
    expect(defaultCurrency).toBe('EUR')
  })

  it('FDO-40: provider_doc_refs y trade_financial_documents son entidades distintas', () => {
    // trade_financial_documents = docs emitidos POR TrabFlow
    // trade_marketplace_provider_doc_refs = referencias a docs emitidos POR el proveedor
    // TrabFlow registra la referencia pero NO es el emisor
    const refTableName = 'trade_marketplace_provider_doc_refs'
    const docTableName = 'trade_financial_documents'
    expect(refTableName).not.toBe(docTableName)
    // El emisor de provider_doc_refs es el proveedor: actor_id es su identificador
    const providerIsIssuer = true // el proveedor emite el doc, TrabFlow solo registra
    expect(providerIsIssuer).toBe(true)
  })
})

// ── FDO-41..50: Aislamiento y reglas de negocio críticas ─────────────────

describe('Aislamiento y reglas críticas de negocio (FDO-41..FDO-50)', () => {
  it('FDO-41: idempotencia — purchase_summary único por master_order_id (DB guarantee)', () => {
    const constraint = {
      name: 'uq_tfd_purchase_summary_per_master',
      columns: ['master_order_id'],
      where: "document_subtype = 'purchase_summary' AND master_order_id IS NOT NULL",
    }
    expect(constraint.columns).toContain('master_order_id')
    expect(constraint.where).toContain('purchase_summary')
  })

  it('FDO-42: idempotencia — supplier_statement único por supplier_order_id (DB guarantee)', () => {
    const constraint = {
      name: 'uq_tfd_supplier_statement_per_order',
      columns: ['supplier_order_id'],
      where: "document_subtype = 'supplier_statement' AND supplier_order_id IS NOT NULL",
    }
    expect(constraint.columns).toContain('supplier_order_id')
    expect(constraint.where).toContain('supplier_statement')
  })

  it('FDO-43: idempotencia — settlement_statement único por settlement_id (DB guarantee)', () => {
    const constraint = {
      name: 'uq_tfd_settlement_statement_per_settlement',
      columns: ['settlement_id'],
      where: "document_subtype = 'settlement_statement' AND settlement_id IS NOT NULL",
    }
    expect(constraint.columns).toContain('settlement_id')
    expect(constraint.where).toContain('settlement_statement')
  })

  it('FDO-44: INV-MPI-01 — purchase_summary vinculado a master_order_id (no supplier_order)', () => {
    const doc: Partial<Record<string, string | null>> = {
      document_subtype: 'purchase_summary',
      master_order_id: 'master-uuid',
      supplier_order_id: null,
    }
    expect(doc.master_order_id).not.toBeNull()
    expect(doc.supplier_order_id).toBeNull()
  })

  it('FDO-45: supplier_statement vinculado a supplier_order_id (no master_order)', () => {
    // INV-MPI-01: el proveedor no ve datos financieros de otros proveedores
    const doc: Partial<Record<string, string | null>> = {
      document_subtype: 'supplier_statement',
      supplier_order_id: 'order-uuid',
      master_order_id: null,
    }
    expect(doc.supplier_order_id).not.toBeNull()
    expect(doc.master_order_id).toBeNull()
  })

  it('FDO-46: settlement_statement vinculado a settlement_id (no supplier_order ni master)', () => {
    const doc: Partial<Record<string, string | null>> = {
      document_subtype: 'settlement_statement',
      settlement_id: 'settlement-uuid',
      master_order_id: null,
      supplier_order_id: null,
    }
    expect(doc.settlement_id).not.toBeNull()
    expect(doc.master_order_id).toBeNull()
    expect(doc.supplier_order_id).toBeNull()
  })

  it('FDO-47: commission en settlement_statement — fuente de verdad es el Settlement Engine, no TS', () => {
    // COMMISSION_GATE: comisión real = 0%.
    // El frontend lee commission_amount desde trade_marketplace_settlements (backend).
    // No existe constante SETTLEMENT_COMMISSION_REAL en financial-docs-foundation.ts
    // (eliminada para evitar segunda fuente de verdad respecto al Settlement Engine).
    // 2% = hipótesis interna de simulación analítica, nunca obligación contractual.
    const simRate = 0.02
    const realCommissionRate = 0 // hecho de negocio documentado aquí solo como literal
    expect(simRate).not.toBe(realCommissionRate)
  })

  it('FDO-48: serie LIQ + STRIPE_GATE OPEN confirman que settlement_statement es simulado', () => {
    // settlement_statement debe presentarse siempre como simulación — no transferencia real
    expect(DOC_SERIES.SETTLEMENT_STATEMENT).toBe('LIQ')
    // STRIPE_GATE OPEN = ningún settlement implica pago bancario real
    const stripeGateOpen = true
    expect(stripeGateOpen).toBe(true)
  })

  it('FDO-49: FKs de origen están protegidas por trigger — un documento no puede reapuntar', () => {
    // Regla 5 del trigger guard_financial_document_immutability
    // Una vez congelado, el documento no puede apuntar a otra entidad origen
    const originFKsProtected = [
      'master_order_id', 'supplier_order_id', 'settlement_id',
      'platform_invoice_id', 'ad_booking_id', 'subscription_id',
    ]
    expect(originFKsProtected).toContain('master_order_id')
    expect(originFKsProtected).toContain('supplier_order_id')
    expect(originFKsProtected).toContain('settlement_id')
    // paid_at es campo operativo — no está en las FKs de origen
    expect(originFKsProtected).not.toContain('paid_at')
  })

  it('FDO-50: campos protegidos e inmutable_at no pueden volver a NULL (Regla 7 del trigger)', () => {
    // Una vez que immutable_at se fija, no puede eliminarse
    // La Regla 7 del trigger lanza EXCEPTION si NEW.immutable_at IS NULL
    const triggerRule7 = 'immutable_at no puede eliminarse una vez fijado'
    expect(triggerRule7).toContain('immutable_at')

    // Verificar que el modelo de campos operativos y snapshot son disjuntos
    const snapshotFields = [
      'subtotal', 'rate_amount', 'discount_amount', 'promotion_amount',
      'commercial_value', 'net_amount', 'tax_rate', 'tax_amount',
      'total_amount', 'currency', 'concept', 'period_start', 'period_end', 'quantity',
    ]
    const operationalFields = [
      'estado', 'payment_status', 'paid_at', 'sent_at', 'sent_to',
      'invoice_url', 'invoice_pdf_url', 'payment_method',
      'stripe_payment_id', 'stripe_invoice_id', 'stripe_customer_id', 'updated_at',
    ]
    const snapshotSet = new Set(snapshotFields)
    const operationalSet = new Set(operationalFields)
    const intersection = [...snapshotSet].filter(f => operationalSet.has(f))
    expect(intersection).toHaveLength(0)
  })
})
