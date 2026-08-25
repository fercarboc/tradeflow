// MP-FIN-5A.1 — Financial Documents Foundation
// Tipos y constantes del modelo documental.
//
// GATES (todos OPEN):
//   LEGAL_GATE  = OPEN — documentos informativos, no fiscales
//   TAX_GATE    = OPEN — sin IVA real, sin Commission Invoice activo
//   STRIPE_GATE = OPEN — sin movimiento de dinero real
//
// COMMISSION: real = 0%. 2% = simulación analítica interna.
// SOURCE OF TRUTH: Settlement Engine (MP-FIN-2F). No recalcular aquí.

// ─── Subtipos de documento de marketplace ───────────────────────────────

export const MARKETPLACE_DOC_SUBTYPES = [
  'purchase_summary',    // MKP: resumen de compra para el comprador
  'supplier_statement',  // SUP: extracto de pedido para el proveedor
  'settlement_statement',// LIQ: liquidación simulada (SIMULATION ONLY)
  'commission_invoice',  // COM: [TAX_GATE OPEN] capacidad futura — sin generador activo
] as const

export type MarketplaceDocSubtype = typeof MARKETPLACE_DOC_SUBTYPES[number]

// Series documentales internas (NO numeración fiscal)
// MKP/SUP/LIQ = referencias operativas de TrabFlow, no facturas legales
// COM = TAX_GATE OPEN — sin numeración fiscal aprobada
export const DOC_SERIES = {
  PURCHASE_SUMMARY:    'MKP',
  SUPPLIER_STATEMENT:  'SUP',
  SETTLEMENT_STATEMENT:'LIQ',
  COMMISSION_INVOICE:  'COM', // TAX_GATE: no reservar ni generar sin autorización
} as const

export type DocSeries = typeof DOC_SERIES[keyof typeof DOC_SERIES]

// ─── Tipos de documento externo de proveedor (provider_doc_refs) ─────────
// Clasificación neutra — no asume fiscalidad (TAX_GATE OPEN)

export const PROVIDER_DOC_TYPES = [
  'invoice',       // factura ordinaria del proveedor
  'credit_note',   // factura rectificativa / abono
  'delivery_note', // albarán de entrega
  'other',         // otros documentos operativos
] as const

export type ProviderDocType = typeof PROVIDER_DOC_TYPES[number]

// ─── Interfaces de las entidades del modelo documental ──────────────────

export interface MarketplaceFinancialDoc {
  id: string
  doc_number: string
  doc_series: DocSeries
  document_type: 'invoice' | 'commercial_summary' | 'proforma' | 'credit_note'
  document_subtype: MarketplaceDocSubtype | null
  revenue_type: string
  payer_type: string
  org_id: string
  actor_id: string | null
  customer_name: string | null
  customer_nif: string | null
  customer_email: string | null
  customer_address: string | null
  estado: string
  payment_status: string
  issued_at: string | null
  // FKs de origen (solo una rellenada por tipo de documento)
  master_order_id: string | null
  supplier_order_id: string | null
  settlement_id: string | null
  // Snapshot económico
  subtotal: number
  concept: string | null
  period_start: string | null
  period_end: string | null
  quantity: number | null
  net_amount: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  currency: string
  metadata: Record<string, unknown>
  // Congelación
  immutable_at: string | null
  created_at: string
  updated_at: string
}

export interface ProviderDocRef {
  id: string
  supplier_order_id: string
  actor_id: string
  buyer_org_id: string | null
  doc_type: ProviderDocType
  doc_number_provider: string
  doc_date_provider: string
  doc_amount: number | null
  doc_currency: string
  notes: string | null
  registered_at: string
  registered_by: string | null
  created_at: string
  updated_at: string
}

// COMMISSION_GATE: comisión real = 0%.
// El importe real lo produce el Settlement Engine (trade_marketplace_settlements).
// El frontend lee commission_amount desde el snapshot del documento — no desde aquí.
