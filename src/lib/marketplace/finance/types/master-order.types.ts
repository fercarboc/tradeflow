// Tipos de Master Order — MP-FIN-1A
// LEGAL_GATE: MasterOrder no determina el rol jurídico de TrabFlow.
// INV-012: order_status y payment_status son ciclos independientes.

import type { PaymentStatus } from './money.types'

/** Estado del ciclo comercial del pedido (INV-012) */
export type OrderStatus =
  | 'created'
  | 'payment_pending'
  | 'paid'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'partially_cancelled'
  | 'cancelled'

/** Master Order — agrupa N supplier orders de un checkout */
export interface MasterOrder {
  id: string
  numero: string                 // MKP-2026-0001
  checkoutKey: string            // clave de idempotencia (INV-017)

  // Comprador
  orgId: string | null
  guestCustomerId: string | null
  buyerSnapshot: Record<string, unknown>

  // Origen
  cartId: string | null

  // Estados (INV-012: independientes)
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus

  // Totales (INV-016: net/tax/gross)
  goodsNetTotal: number
  goodsTaxTotal: number
  goodsGrossTotal: number
  shippingNetTotal: number
  shippingTaxTotal: number
  shippingGrossTotal: number
  checkoutGrossTotal: number   // INV-003: = goodsGross + shippingGross
  refundGrossTotal: number
  currency: string

  // GMV (INV-001: NO es Revenue TrabFlow)
  gmvGoodsNet: number | null
  gmvGoodsGross: number | null
  gmvShippingNet: number | null

  // PSP (STRIPE_GATE)
  externalProvider: string      // 'simulation' en Fase 0
  externalPaymentIntentId: string | null
  pspFeeEstimated: number | null

  // Timestamps
  confirmedAt: string | null
  paidAt: string | null
  fulfilledAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

/** Parámetros para crear un master order */
export interface CreateMasterOrderParams {
  checkoutKey: string
  orgId?: string
  guestCustomerId?: string
  cartId?: string
  buyerSnapshot?: Record<string, unknown>
  goodsNetTotal: number
  goodsTaxTotal: number
  goodsGrossTotal: number
  shippingNetTotal: number
  shippingTaxTotal: number
  shippingGrossTotal: number
  currency?: string
  deliveryAddress?: Record<string, unknown>
}

/** Detalle de master order con supplier orders hijos */
export interface MasterOrderDetail {
  masterOrder: MasterOrder
  supplierOrders: SupplierOrderSummary[]
  supplierOrdersCount: number
}

/** Resumen de un supplier order (dentro de master order detail) */
export interface SupplierOrderSummary {
  id: string
  actorId: string
  numero: string
  estado: string
  paymentStatus: string
  subtotal: number
  costeEnvio: number
  total: number
  goodsGrossSnapshot: number | null
  shippingGrossSnapshot: number | null
  currency: string
  createdAt: string
}
