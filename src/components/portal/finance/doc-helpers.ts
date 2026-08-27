// MP-FIN-5B — Pure helper functions for financial document UI.
// All functions are side-effect-free for testability.
// No React imports — safe to import from .test.ts files.

// ─── Labels ──────────────────────────────────────────────────────────────────

export const DOC_SUBTYPE_LABELS: Record<string, string> = {
  supplier_statement:   'Extracto de proveedor',
  settlement_statement: 'Liquidación',
  purchase_summary:     'Resumen de compra',
}

export const DOC_REF_TYPE_LABELS: Record<string, string> = {
  invoice:       'Factura',
  credit_note:   'Factura rectificativa',
  delivery_note: 'Albarán',
  other:         'Otro',
}

const SETTLEMENT_LINE_LABELS: Record<string, string> = {
  GOODS_ENTITLEMENT:          'Venta confirmada',
  SHIPPING_ENTITLEMENT:       'Portes',
  COMMISSION_ACCRUAL:         'Comisión plataforma',
  COMMISSION_TAX_ACCRUAL:     'IVA comisión',
  COMMISSION_SIM_ACCRUAL:     'Comisión (simulada)',
  COMMISSION_SIM_TAX_ACCRUAL: 'IVA comisión (simulada)',
  REFUND_TO_BUYER:            'Devolución al comprador',
  GOODS_REFUND_REVERSAL:      'Ajuste por devolución (venta)',
  SHIPPING_REFUND_REVERSAL:   'Ajuste por devolución (portes)',
  COMMISSION_REVERSAL:        'Reversal comisión',
  CHARGEBACK_DEBIT:           'Disputa (débito)',
  CHARGEBACK_FEE:             'Tarifa de disputa',
  CHARGEBACK_CREDIT:          'Resolución disputa (crédito)',
  RESERVE_HOLD:               'Retención temporal',
  RESERVE_RELEASE:            'Liberación de retención',
  SETTLEMENT_ADJUSTMENT:      'Liquidación',
  NEGATIVE_BALANCE_RECORD:    'Saldo negativo registrado',
  BALANCE_RECOVERY:           'Recuperación de saldo',
  TRANSFER_INITIATED:         'Transferencia iniciada',
  TRANSFER_COMPLETED:         'Transferencia completada',
  TRANSFER_REVERSAL:          'Reversal transferencia',
}

export function getDocSubtypeLabel(subtype: string): string {
  return DOC_SUBTYPE_LABELS[subtype] ?? subtype.replace(/_/g, ' ')
}

export function getDocRefTypeLabel(type: string): string {
  return DOC_REF_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')
}

export function getSettlementLineLabel(entryType: string): string {
  return SETTLEMENT_LINE_LABELS[entryType] ?? entryType.replace(/_/g, ' ').toLowerCase()
}

// ─── Order selector ───────────────────────────────────────────────────────────

/** Computes display total for the order selector (goods + shipping gross snapshots). */
export function computeOrderTotal(
  goodsGross: number | null,
  shippingGross: number | null,
): number {
  return (goodsGross ?? 0) + (shippingGross ?? 0)
}

const FMT_ES = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatOrderSelectorLabel(
  numero: string,
  goodsGross: number | null,
  shippingGross: number | null,
  currency: string,
): string {
  const total = computeOrderTotal(goodsGross, shippingGross)
  return `${numero} — ${FMT_ES.format(total)} ${currency}`
}

// ─── Metadata types ──────────────────────────────────────────────────────────

export interface SupplierOrderSnapshot {
  id: string
  actor_id: string
  org_id: string | null
  numero: string
  estado: string
  notas: string | null
  goods_net_snapshot: number | null
  goods_tax_snapshot: number | null
  goods_gross_snapshot: number | null
  shipping_net_snapshot: number | null
  shipping_tax_snapshot: number | null
  shipping_gross_snapshot: number | null
  tax_rate_snapshot: number | null
  currency: string
  delivery_method: string | null
  financial_snapshot_at: string | null
  confirmed_at: string | null
  created_at: string
}

export interface OrderItemSnapshot {
  id: string
  referencia: string | null
  descripcion: string | null
  unidad: string | null
  cantidad: number
  precio_unitario: number
  precio_unitario_neto_snapshot: number | null
  descuento_tipo_snapshot: string | null
  descuento_importe_snapshot: number | null
  tax_rate_snapshot: number | null
  item_net_snapshot: number | null
  item_tax_snapshot: number | null
  item_gross_snapshot: number | null
  currency: string
}

export interface SupplierStatementMeta {
  supplier_order: SupplierOrderSnapshot
  items: OrderItemSnapshot[]
  generated_at: string
}

export interface SettlementSnapshot {
  id: string
  settlement_number: string
  provider_actor_id: string
  currency: string
  period_start: string
  period_end: string
  status: string
  sales_amount: number
  shipping_amount: number
  refund_amount: number
  chargeback_amount: number
  chargeback_reversal_amount: number
  recovery_amount: number
  reserve_amount: number
  reserve_release_amount: number
  commission_amount: number
  commission_tax_amount: number
  adjustment_amount: number
  gross_activity: number
  net_activity: number
  max_payable: number
  settlement_amount: number
  simulation_only: boolean
  calculated_at: string | null
  approved_at: string | null
  created_at: string
}

export interface SettlementLineSnapshot {
  id: string
  settlement_id: string
  supplier_order_id: string | null
  master_order_id: string | null
  entry_type: string
  gross_amount: number
  currency: string
  included_amount: number
  line_status: string
  created_at: string
}

export interface SettlementStatementMeta {
  settlement: SettlementSnapshot
  settlement_lines: SettlementLineSnapshot[] | null
  simulation_only: boolean
  generated_at: string
}

// ─── Metadata extractors ──────────────────────────────────────────────────────

/** Returns null if the supplier_order key is missing — signals malformed metadata. */
export function extractSupplierStatementMeta(
  metadata: Record<string, unknown>,
): SupplierStatementMeta | null {
  const so = metadata.supplier_order
  if (!so || typeof so !== 'object') return null
  return metadata as unknown as SupplierStatementMeta
}

/** Returns null if the settlement key is missing — signals malformed metadata. */
export function extractSettlementStatementMeta(
  metadata: Record<string, unknown>,
): SettlementStatementMeta | null {
  const s = metadata.settlement
  if (!s || typeof s !== 'object') return null
  return metadata as unknown as SettlementStatementMeta
}

/** True if the document metadata marks this as simulation-only. */
export function isSimulationOnly(metadata: Record<string, unknown>): boolean {
  if (metadata.simulation_only === true) return true
  const s = metadata.settlement
  if (s && typeof s === 'object') {
    return (s as Record<string, unknown>).simulation_only === true
  }
  return false
}

// ─── Purchase Summary types and extractor (MP-FIN-5C) ────────────────────────

export interface PurchaseSummaryItem {
  id: string
  referencia: string | null
  descripcion: string | null
  unidad: string | null
  cantidad: number
  precio_unitario: number | null
  precio_unitario_neto_snapshot: number | null
  tax_rate_snapshot: number | null
  item_net_snapshot: number | null
  item_tax_snapshot: number | null
  item_gross_snapshot: number | null
  currency: string
}

export interface PurchaseSummaryOrderSnap {
  id: string
  actor_id: string
  numero: string
  estado: string
  goods_gross_snapshot: number | null
  shipping_gross_snapshot: number | null
  tax_rate_snapshot: number | null
  currency: string
  delivery_method: string | null
  confirmed_at: string | null
  created_at: string
}

export interface PurchaseSummaryOrderBlock {
  order: PurchaseSummaryOrderSnap
  items: PurchaseSummaryItem[] | null
}

export interface PurchaseSummaryMasterSnap {
  id: string
  numero: string
  org_id: string
  order_status: string
  goods_net_total: number
  goods_tax_total: number
  goods_gross_total: number
  shipping_net_total: number
  shipping_tax_total: number
  shipping_gross_total: number
  checkout_gross_total: number
  currency: string
  confirmed_at: string | null
  created_at: string
  buyer_snapshot?: Record<string, unknown>
  delivery_address_snapshot?: Record<string, unknown> | null
}

export interface PurchaseSummaryMeta {
  master_order: PurchaseSummaryMasterSnap
  supplier_orders: PurchaseSummaryOrderBlock[] | null
  generated_at: string
}

/** Returns null if master_order key is missing — signals malformed metadata. */
export function extractPurchaseSummaryMeta(
  metadata: Record<string, unknown>,
): PurchaseSummaryMeta | null {
  const mo = metadata.master_order
  if (!mo || typeof mo !== 'object') return null
  return metadata as unknown as PurchaseSummaryMeta
}

/** Sum of goods_gross + shipping_gross for a supplier order block. */
export function computeSupplierOrderTotal(order: PurchaseSummaryOrderSnap): number {
  return (order.goods_gross_snapshot ?? 0) + (order.shipping_gross_snapshot ?? 0)
}
