// Checkout Finance Service — MP-FIN-1B.1
// Proporciona acceso al contexto financiero de un checkout después de que el RPC
// checkout_cart_v2 haya creado el master_order y los snapshots.
// NO orquesta el checkout (lo hace el RPC SQL atómicamente).
// NO llama a MarketplacePaymentProvider.createPayment (→ MP-FIN-1B.2).
// INV-005: comisión real=0. INV-007: snapshots inmutables. INV-017: idempotencia.

import { supabase } from '../../supabase'
import type { MasterOrder } from './types/master-order.types'

// ── Tipos locales ──────────────────────────────────────────────────────────────

export interface CheckoutSupplierOrderSnapshot {
  supplierOrderId:       string
  actorId:               string
  numero:                string
  estado:                string
  subtotal:              number
  costeEnvio:            number
  total:                 number
  goodsNetSnapshot:      number | null
  goodsTaxSnapshot:      number | null
  goodsGrossSnapshot:    number | null
  shippingNetSnapshot:   number | null
  shippingTaxSnapshot:   number | null
  shippingGrossSnapshot: number | null
  commissionNetSnapshot: number | null
  providerPayable:       number | null
  simCommissionNet:      number | null
  financialSnapshotAt:   string | null
  paymentStatus:         string
  currency:              string
  masterOrderId:         string | null
}

export interface CheckoutFinancialSummary {
  checkoutKey:         string
  masterOrder:         MasterOrder | null
  supplierOrders:      CheckoutSupplierOrderSnapshot[]
  totals: {
    goodsGrossTotal:   number
    shippingGrossTotal: number
    checkoutGrossTotal: number
    supplierCount:     number
    currency:          string
  }
  invariants: {
    inv001_ok:         boolean   // GMV ≠ Revenue TrabFlow
    inv005_ok:         boolean   // commission_rate real = 0
    hasAllSnapshots:   boolean   // todos los supplier orders tienen snapshot
  }
}

// ── Validación de checkout_key ─────────────────────────────────────────────────
// DT-1A-2: la key debe ser no vacía. Si es '' o undefined, el RPC genera una nueva.
// Esta función es para validar en TS antes de llamar al RPC.

export function assertValidCheckoutKey(key: string | undefined | null): string {
  if (!key || key.trim() === '') {
    throw new Error(
      'checkout_key inválida o vacía. Debe generarse con crypto.randomUUID() ' +
      'en createPurchaseSession() antes de iniciar el checkout.'
    )
  }
  return key
}

// ── Obtener master_order por checkout_key ──────────────────────────────────────

export async function getMasterOrderForCheckout(
  checkoutKey: string
): Promise<MasterOrder | null> {
  const { data, error } = await supabase.rpc('mkt_fin_get_master_order', {
    p_master_order_id: null,
    p_checkout_key:    checkoutKey,
  })

  if (error) throw new Error(`getMasterOrderForCheckout failed: ${error.message}`)
  if (!data?.master_order) return null

  const row = data.master_order as Record<string, unknown>
  return mapMasterOrderRow(row)
}

// ── Obtener resumen financiero completo de un checkout ─────────────────────────

export async function getCheckoutFinancialSummary(
  checkoutKey: string
): Promise<CheckoutFinancialSummary | null> {
  // 1. Master order
  const { data: masterData, error: masterErr } = await supabase.rpc('mkt_fin_get_master_order', {
    p_master_order_id: null,
    p_checkout_key:    checkoutKey,
  })
  if (masterErr) throw new Error(`getCheckoutFinancialSummary(master) failed: ${masterErr.message}`)

  if (!masterData?.master_order) return null

  const masterRow    = masterData.master_order as Record<string, unknown>
  const masterOrder  = mapMasterOrderRow(masterRow)

  // 2. Supplier orders vinculados al master_order
  const { data: ordersData, error: ordersErr } = await supabase
    .from('trade_marketplace_orders')
    .select(`
      id, actor_id, numero, estado, subtotal, coste_envio, total,
      goods_net_snapshot, goods_tax_snapshot, goods_gross_snapshot,
      shipping_net_snapshot, shipping_tax_snapshot, shipping_gross_snapshot,
      commission_net_snapshot, provider_payable_snapshot,
      sim_commission_net, financial_snapshot_at,
      payment_status, currency, master_order_id
    `)
    .eq('master_order_id', masterOrder.id)
    .order('created_at', { ascending: true })

  if (ordersErr) throw new Error(`getCheckoutFinancialSummary(orders) failed: ${ordersErr.message}`)

  const supplierOrders: CheckoutSupplierOrderSnapshot[] = (ordersData ?? []).map(row => ({
    supplierOrderId:       row.id,
    actorId:               row.actor_id,
    numero:                row.numero,
    estado:                row.estado,
    subtotal:              Number(row.subtotal ?? 0),
    costeEnvio:            Number(row.coste_envio ?? 0),
    total:                 Number(row.total ?? 0),
    goodsNetSnapshot:      row.goods_net_snapshot != null ? Number(row.goods_net_snapshot) : null,
    goodsTaxSnapshot:      row.goods_tax_snapshot != null ? Number(row.goods_tax_snapshot) : null,
    goodsGrossSnapshot:    row.goods_gross_snapshot != null ? Number(row.goods_gross_snapshot) : null,
    shippingNetSnapshot:   row.shipping_net_snapshot != null ? Number(row.shipping_net_snapshot) : null,
    shippingTaxSnapshot:   row.shipping_tax_snapshot != null ? Number(row.shipping_tax_snapshot) : null,
    shippingGrossSnapshot: row.shipping_gross_snapshot != null ? Number(row.shipping_gross_snapshot) : null,
    commissionNetSnapshot: row.commission_net_snapshot != null ? Number(row.commission_net_snapshot) : null,
    providerPayable:       row.provider_payable_snapshot != null ? Number(row.provider_payable_snapshot) : null,
    simCommissionNet:      row.sim_commission_net != null ? Number(row.sim_commission_net) : null,
    financialSnapshotAt:   row.financial_snapshot_at as string | null,
    paymentStatus:         (row.payment_status as string) ?? 'unpaid',
    currency:              (row.currency as string) ?? 'EUR',
    masterOrderId:         row.master_order_id as string | null,
  }))

  // 3. Calcular totales e invariantes
  const checkoutGrossTotal = masterOrder.checkoutGrossTotal
  const supplierCount = supplierOrders.length
  const hasAllSnapshots = supplierOrders.every(o => o.financialSnapshotAt !== null)

  const totalCommissionReal = supplierOrders.reduce(
    (acc, o) => acc + (o.commissionNetSnapshot ?? 0), 0
  )

  return {
    checkoutKey,
    masterOrder,
    supplierOrders,
    totals: {
      goodsGrossTotal:    masterOrder.goodsGrossTotal,
      shippingGrossTotal: masterOrder.shippingGrossTotal,
      checkoutGrossTotal,
      supplierCount,
      currency:           masterOrder.currency,
    },
    invariants: {
      inv001_ok:       checkoutGrossTotal !== totalCommissionReal || totalCommissionReal === 0,
      inv005_ok:       totalCommissionReal === 0,   // INV-005: comisión real = 0 en Fase 0
      hasAllSnapshots,
    },
  }
}

// ── Verificar integridad de totales (INV-003) ──────────────────────────────────
// masterOrder.checkoutGrossTotal debe ser = SUM(supplier.goods_gross + supplier.shipping_gross)

export function verifyCheckoutTotalsIntegrity(summary: CheckoutFinancialSummary): boolean {
  if (!summary.masterOrder) return false

  const sumFromSuppliers = summary.supplierOrders.reduce((acc, o) => {
    return acc
      + (o.goodsGrossSnapshot ?? o.subtotal)
      + (o.shippingGrossSnapshot ?? o.costeEnvio)
  }, 0)

  const masterTotal = summary.masterOrder.checkoutGrossTotal
  const diff = Math.abs(sumFromSuppliers - masterTotal)

  return diff < 0.02  // tolerancia de 2 céntimos por redondeo
}

// ── Mapeo BD → MasterOrder ─────────────────────────────────────────────────────

function mapMasterOrderRow(row: Record<string, unknown>): MasterOrder {
  return {
    id:                       row.id as string,
    numero:                   row.numero as string,
    checkoutKey:              row.checkout_key as string,
    orgId:                    (row.org_id as string) ?? null,
    guestCustomerId:          (row.guest_customer_id as string) ?? null,
    buyerSnapshot:            (row.buyer_snapshot as Record<string, unknown>) ?? {},
    cartId:                   (row.cart_id as string) ?? null,
    orderStatus:              (row.order_status as MasterOrder['orderStatus']) ?? 'created',
    paymentStatus:            (row.payment_status as MasterOrder['paymentStatus']) ?? 'unpaid',
    goodsNetTotal:            Number(row.goods_net_total ?? 0),
    goodsTaxTotal:            Number(row.goods_tax_total ?? 0),
    goodsGrossTotal:          Number(row.goods_gross_total ?? 0),
    shippingNetTotal:         Number(row.shipping_net_total ?? 0),
    shippingTaxTotal:         Number(row.shipping_tax_total ?? 0),
    shippingGrossTotal:       Number(row.shipping_gross_total ?? 0),
    checkoutGrossTotal:       Number(row.checkout_gross_total ?? 0),
    refundGrossTotal:         Number(row.refund_gross_total ?? 0),
    currency:                 (row.currency as string) ?? 'EUR',
    gmvGoodsNet:              row.gmv_goods_net != null ? Number(row.gmv_goods_net) : null,
    gmvGoodsGross:            row.gmv_goods_gross != null ? Number(row.gmv_goods_gross) : null,
    gmvShippingNet:           row.gmv_shipping_net != null ? Number(row.gmv_shipping_net) : null,
    externalProvider:         (row.external_provider as string) ?? 'simulation',
    externalPaymentIntentId:  (row.external_payment_intent_id as string) ?? null,
    pspFeeEstimated:          row.psp_fee_estimated != null ? Number(row.psp_fee_estimated) : null,
    confirmedAt:              (row.confirmed_at as string) ?? null,
    paidAt:                   (row.paid_at as string) ?? null,
    fulfilledAt:              (row.fulfilled_at as string) ?? null,
    cancelledAt:              (row.cancelled_at as string) ?? null,
    cancelReason:             (row.cancel_reason as string) ?? null,
    createdAt:                row.created_at as string,
    updatedAt:                row.updated_at as string,
  }
}
