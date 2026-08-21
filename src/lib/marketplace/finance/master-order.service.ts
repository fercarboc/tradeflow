// Master Order Service — MP-FIN-1A
// LEGAL_GATE: crear un MasterOrder NO determina el rol jurídico de TrabFlow.
// INV-017: idempotencia garantizada por checkout_key.
// INV-003: checkoutGrossTotal = goodsGross + shippingGross.

import { supabase } from '../../supabase'
import type { MasterOrder, CreateMasterOrderParams, MasterOrderDetail } from './types/master-order.types'

// ── Crear Master Order (idempotente por checkout_key) ────────────────────────

export async function createMasterOrder(
  params: CreateMasterOrderParams
): Promise<MasterOrder> {
  const { data, error } = await supabase.rpc('mkt_fin_create_master_order', {
    p_checkout_key:         params.checkoutKey,
    p_org_id:               params.orgId ?? null,
    p_guest_customer_id:    params.guestCustomerId ?? null,
    p_cart_id:              params.cartId ?? null,
    p_buyer_snapshot:       params.buyerSnapshot ?? {},
    p_goods_net_total:      params.goodsNetTotal,
    p_goods_tax_total:      params.goodsTaxTotal,
    p_goods_gross_total:    params.goodsGrossTotal,
    p_shipping_net_total:   params.shippingNetTotal,
    p_shipping_tax_total:   params.shippingTaxTotal,
    p_shipping_gross_total: params.shippingGrossTotal,
    p_currency:             params.currency ?? 'EUR',
    p_delivery_address:     params.deliveryAddress ?? null,
  })

  if (error) throw new Error(`createMasterOrder failed: ${error.message}`)

  return mapMasterOrder(data)
}

// ── Obtener Master Order ───────────────────────────────────────────────────────

export async function getMasterOrderDetail(params: {
  masterOrderId?: string
  checkoutKey?: string
}): Promise<MasterOrderDetail | null> {
  const { data, error } = await supabase.rpc('mkt_fin_get_master_order', {
    p_master_order_id: params.masterOrderId ?? null,
    p_checkout_key:    params.checkoutKey ?? null,
  })

  if (error) throw new Error(`getMasterOrderDetail failed: ${error.message}`)
  if (!data) return null

  return {
    masterOrder:         mapMasterOrder(data.master_order),
    supplierOrders:      (data.supplier_orders ?? []).map(mapSupplierOrderSummary),
    supplierOrdersCount: data.supplier_orders_count ?? 0,
  }
}

// ── Verificar INV-001: GMV ≠ Revenue TrabFlow ──────────────────────────────────

export async function checkGmvRevenueSeparation(masterOrderId?: string) {
  const { data, error } = await supabase.rpc('mkt_fin_check_gmv_revenue_separation', {
    p_master_order_id: masterOrderId ?? null,
  })

  if (error) throw new Error(`checkGmvRevenueSeparation failed: ${error.message}`)

  return data as {
    gmv_goods_net: number
    gmv_goods_gross: number
    gmv_shipping_net: number
    trabflow_revenue_real: number     // 0 en Fase 0 (INV-005)
    trabflow_revenue_simulated: number
    inv_001_ok: boolean
    checkout_gross_total: number
    note: string
  }
}

// ── Admin Overview (solo platform_admin) ──────────────────────────────────────

export async function getAdminFinanceOverview() {
  const { data, error } = await supabase.rpc('mkt_fin_admin_overview')
  if (error) throw new Error(`getAdminFinanceOverview failed: ${error.message}`)
  return data
}

// ── Provider Financial Summary ────────────────────────────────────────────────

export async function getProviderFinancialSummary(actorId: string) {
  const { data, error } = await supabase.rpc('mkt_fin_get_provider_financial_summary', {
    p_actor_id: actorId,
  })
  if (error) throw new Error(`getProviderFinancialSummary failed: ${error.message}`)
  return data
}

// ── Mapeos ─────────────────────────────────────────────────────────────────────

function mapMasterOrder(row: Record<string, unknown>): MasterOrder {
  return {
    id:                    row.id as string,
    numero:                row.numero as string,
    checkoutKey:           row.checkout_key as string,
    orgId:                 (row.org_id as string) ?? null,
    guestCustomerId:       (row.guest_customer_id as string) ?? null,
    buyerSnapshot:         (row.buyer_snapshot as Record<string, unknown>) ?? {},
    cartId:                (row.cart_id as string) ?? null,
    orderStatus:           row.order_status as MasterOrder['orderStatus'],
    paymentStatus:         row.payment_status as MasterOrder['paymentStatus'],
    goodsNetTotal:         Number(row.goods_net_total ?? 0),
    goodsTaxTotal:         Number(row.goods_tax_total ?? 0),
    goodsGrossTotal:       Number(row.goods_gross_total ?? 0),
    shippingNetTotal:      Number(row.shipping_net_total ?? 0),
    shippingTaxTotal:      Number(row.shipping_tax_total ?? 0),
    shippingGrossTotal:    Number(row.shipping_gross_total ?? 0),
    checkoutGrossTotal:    Number(row.checkout_gross_total ?? 0),
    refundGrossTotal:      Number(row.refund_gross_total ?? 0),
    currency:              (row.currency as string) ?? 'EUR',
    gmvGoodsNet:           row.gmv_goods_net != null ? Number(row.gmv_goods_net) : null,
    gmvGoodsGross:         row.gmv_goods_gross != null ? Number(row.gmv_goods_gross) : null,
    gmvShippingNet:        row.gmv_shipping_net != null ? Number(row.gmv_shipping_net) : null,
    externalProvider:      (row.external_provider as string) ?? 'simulation',
    externalPaymentIntentId: (row.external_payment_intent_id as string) ?? null,
    pspFeeEstimated:       row.psp_fee_estimated != null ? Number(row.psp_fee_estimated) : null,
    confirmedAt:           (row.confirmed_at as string) ?? null,
    paidAt:                (row.paid_at as string) ?? null,
    fulfilledAt:           (row.fulfilled_at as string) ?? null,
    cancelledAt:           (row.cancelled_at as string) ?? null,
    cancelReason:          (row.cancel_reason as string) ?? null,
    createdAt:             row.created_at as string,
    updatedAt:             row.updated_at as string,
  }
}

function mapSupplierOrderSummary(row: Record<string, unknown>) {
  return {
    id:                    row.id as string,
    actorId:               row.actor_id as string,
    numero:                row.numero as string,
    estado:                row.estado as string,
    paymentStatus:         (row.payment_status as string) ?? 'unpaid',
    subtotal:              Number(row.subtotal ?? 0),
    costeEnvio:            Number(row.coste_envio ?? 0),
    total:                 Number(row.total ?? 0),
    goodsGrossSnapshot:    row.goods_gross_snapshot != null ? Number(row.goods_gross_snapshot) : null,
    shippingGrossSnapshot: row.shipping_gross_snapshot != null ? Number(row.shipping_gross_snapshot) : null,
    currency:              (row.currency as string) ?? 'EUR',
    createdAt:             row.created_at as string,
  }
}
