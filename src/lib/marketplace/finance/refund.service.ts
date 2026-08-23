/**
 * MP-FIN-2B — Refund Service
 *
 * REFUND = MOVIMIENTO COMPENSATORIO.
 * La venta original NUNCA se modifica.
 * SALE +100 / REFUND -30 — ambas entradas permanecen en el ledger.
 *
 * Ledger entries de refund tienen amount NEGATIVO:
 *   GOODS_REFUND_REVERSAL   → amount < 0
 *   SHIPPING_REFUND_REVERSAL → amount < 0
 *
 * commission_reversal = 0 (commission_real = 0, Phase 0).
 * simulation_only = true (STRIPE_GATE cerrado).
 * Atomicidad: entidad + líneas + ledger + balance o ROLLBACK total.
 */

import { supabase } from '../../supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type RefundType =
  | 'full_order'
  | 'partial_amount'
  | 'full_item'
  | 'partial_quantity'
  | 'shipping_only'
  | 'mixed'

export type RefundStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'processed'
  | 'rejected'
  | 'cancelled'
  | 'failed'

export type OrderRefundStatus =
  | 'not_refunded'
  | 'partially_refunded'
  | 'fully_refunded'

export interface RefundItem {
  order_item_id: string
  quantity_refunded?: number
}

export interface RefundableItem {
  order_item_id: string
  product_name: string
  quantity_original: number
  quantity_already_refunded: number
  quantity_remaining: number
  unit_price_gross: number
  unit_price_net: number
  line_gross_refundable: number
}

export interface RefundableSummary {
  supplier_order_id: string
  master_order_numero: string
  provider_actor_id: string
  currency: string
  refund_status: OrderRefundStatus
  original_goods_gross: number
  original_goods_net: number
  original_shipping_gross: number
  original_shipping_net: number
  original_total_gross: number
  refunded_goods_gross: number
  refunded_shipping_gross: number
  total_refunded_gross: number
  remaining_goods_refundable: number
  remaining_ship_refundable: number
  remaining_total_refundable: number
  items: RefundableItem[]
}

export interface RefundPreviewResult {
  preview: {
    items_gross: number
    items_net: number
    items_tax: number
    shipping_gross: number
    shipping_net: number
    shipping_tax: number
    total_refund_gross: number
    commission_reversal: number
  }
  balance_after: number
  commission_note: string
  stripe_gate: string
}

export interface CreateRefundResult {
  status: 'created' | 'replayed'
  refund_id: string
  refund_number: string
  supplier_order_id: string
  refund_type: RefundType
  items_gross: number
  items_net: number
  items_tax: number
  shipping_gross: number
  shipping_net: number
  shipping_tax: number
  total_refund_gross: number
  commission_reversal: number
  simulation_only: boolean
  correlation_id: string
  // solo en replayed:
  total_refund_amount?: number
}

export interface RefundDetail {
  refund_id: string
  refund_number: string
  master_order_id: string
  supplier_order_id: string
  provider_actor_id: string
  refund_type: RefundType
  status: RefundStatus
  simulation_only: boolean
  items_gross_amount: number
  items_net_amount: number
  items_tax_amount: number
  shipping_gross_amount: number
  shipping_net_amount: number
  shipping_tax_amount: number
  total_refund_amount: number
  correlation_id: string
  idempotency_key: string | null
  requested_at: string
  processed_at: string | null
  items: Array<{
    order_item_id: string | null
    quantity_original: number | null
    quantity_refunded: number | null
    gross_refund: number
    net_refund: number
    tax_refund: number
    is_shipping: boolean
    reason: string | null
  }>
}

export interface SupplierRefundListItem {
  refund_id: string
  refund_number: string
  refund_type: RefundType
  status: RefundStatus
  total_refund_amount: number
  requested_at: string
}

export interface AdminRefundsOverview {
  total_refunds: number
  total_refunded_gross: number
  total_goods_refunded: number
  total_shipping_refunded: number
  by_type: Record<RefundType, number>
  by_status: Record<RefundStatus, number>
  commission_reversal_total: number
  commission_note: string
  calculated_at: string
}

// ── Funciones principales ──────────────────────────────────────────────────

/**
 * Devuelve el estado refundable de un supplier order.
 * Incluye items pendientes de devolver con sus cantidades.
 */
export async function getRefundableSummary(
  supplierOrderId: string
): Promise<RefundableSummary> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_refundable_summary', {
    p_supplier_order_id: supplierOrderId,
  })
  if (error) throw new Error(`getRefundableSummary: ${error.message}`)
  return data as RefundableSummary
}

/**
 * Calcula el importe que se devolvería sin crear el refund.
 * Útil para mostrar confirmación al operador antes de ejecutar.
 */
export async function previewRefund(
  supplierOrderId: string,
  refundType: RefundType,
  items: RefundItem[] = [],
  shippingRefundGross = 0,
  partialAmountGross = 0
): Promise<RefundPreviewResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_preview_refund', {
    p_supplier_order_id:    supplierOrderId,
    p_refund_type:          refundType,
    p_items:                items,
    p_shipping_refund_gross: shippingRefundGross,
    p_partial_amount_gross:  partialAmountGross,
  })
  if (error) throw new Error(`previewRefund: ${error.message}`)
  return data as RefundPreviewResult
}

/**
 * Crea un refund. Atómico: entidad + líneas + ledger + balance.
 * Idempotente si se pasa idempotencyKey — segunda llamada retorna status='replayed'.
 *
 * Tipos:
 *   full_order       — devuelve todo lo pendiente (goods + shipping)
 *   partial_amount   — devuelve una cantidad arbitraria de goods
 *   full_item        — devuelve todos los restantes de un item específico
 *   partial_quantity — devuelve N unidades de un item
 *   shipping_only    — devuelve sólo shipping
 *   mixed            — items + (opcionalmente) shipping
 */
export async function createRefund(params: {
  supplierOrderId: string
  refundType: RefundType
  reason?: string
  items?: RefundItem[]
  shippingRefundGross?: number
  partialAmountGross?: number
  idempotencyKey?: string
  correlationId?: string
}): Promise<CreateRefundResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_create_refund', {
    p_supplier_order_id:    params.supplierOrderId,
    p_refund_type:          params.refundType,
    p_reason:               params.reason ?? null,
    p_items:                params.items ?? [],
    p_shipping_refund_gross: params.shippingRefundGross ?? 0,
    p_partial_amount_gross:  params.partialAmountGross ?? 0,
    p_idempotency_key:       params.idempotencyKey ?? null,
    p_correlation_id:        params.correlationId ?? null,
  })
  if (error) throw new Error(`createRefund: ${error.message}`)
  return data as CreateRefundResult
}

/**
 * Devuelve el detalle de un refund con sus líneas.
 * RLS: proveedor ve solo sus refunds; admin ve todos.
 */
export async function getRefund(refundId: string): Promise<RefundDetail> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_refund', {
    p_refund_id: refundId,
  })
  if (error) throw new Error(`getRefund: ${error.message}`)
  return data as RefundDetail
}

/**
 * Lista los refunds de un proveedor con paginación.
 */
export async function listSupplierRefunds(
  providerActorId: string,
  limit = 20,
  offset = 0
): Promise<SupplierRefundListItem[]> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_supplier_refunds', {
    p_provider_actor_id: providerActorId,
    p_limit:             limit,
    p_offset:            offset,
  })
  if (error) throw new Error(`listSupplierRefunds: ${error.message}`)
  return (data ?? []) as SupplierRefundListItem[]
}

/**
 * KPIs de refunds globales. Solo platform_admin.
 */
export async function getAdminRefundsOverview(): Promise<AdminRefundsOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_admin_refunds_overview')
  if (error) throw new Error(`getAdminRefundsOverview: ${error.message}`)
  return data as AdminRefundsOverview
}
