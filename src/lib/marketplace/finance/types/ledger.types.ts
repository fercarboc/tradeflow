// Tipos del Ledger — MP-FIN-1A
// INV-009: append-only, inmutable. Las correcciones son nuevas entradas compensatorias.
// INV-001: GOODS_ENTITLEMENT y SHIPPING_ENTITLEMENT son GMV del proveedor, NO Revenue TrabFlow.

/** Tipos de movimiento del ledger (catálogo extensible) */
export type LedgerEntryType =
  // Pago del comprador
  | 'BUYER_PAYMENT'
  // Derechos de mercancía y portes (por supplier_order)
  | 'GOODS_ENTITLEMENT'
  | 'SHIPPING_ENTITLEMENT'
  // Comisión real (accrual al momento del pedido)
  | 'COMMISSION_ACCRUAL'
  | 'COMMISSION_TAX_ACCRUAL'
  // Comisión simulada (INV-005: NO es Revenue real)
  | 'COMMISSION_SIM_ACCRUAL'
  | 'COMMISSION_SIM_TAX_ACCRUAL'
  // Transfers a proveedor (STRIPE_GATE)
  | 'TRANSFER_INITIATED'
  | 'TRANSFER_COMPLETED'
  | 'TRANSFER_REVERSAL'
  // Refunds (MP-FIN-2)
  | 'REFUND_TO_BUYER'
  | 'GOODS_REFUND_REVERSAL'
  | 'SHIPPING_REFUND_REVERSAL'
  | 'COMMISSION_REVERSAL'
  | 'COMMISSION_TAX_REVERSAL'
  // Chargebacks / disputes (MP-FIN-2)
  | 'CHARGEBACK_DEBIT'
  | 'CHARGEBACK_FEE'
  | 'CHARGEBACK_CREDIT'
  // PSP fees (STRIPE_GATE)
  | 'PSP_FEE_DEBIT'
  // Reservas / holds (MP-FIN-2)
  | 'RESERVE_HOLD'
  | 'RESERVE_RELEASE'
  // Ajustes
  | 'SETTLEMENT_ADJUSTMENT'
  | 'PROVIDER_ADJUSTMENT'
  | 'PLATFORM_ADJUSTMENT'
  // Saldos negativos y recuperación
  | 'NEGATIVE_BALANCE_RECORD'
  | 'BALANCE_RECOVERY'
  | 'FUTURE_SETOFF'

/** Estado de una entrada del ledger */
export type LedgerEntryStatus = 'pending' | 'confirmed' | 'reversed' | 'failed'

/** Entrada del ledger (inmutable) */
export interface LedgerEntry {
  id: string
  entryType: LedgerEntryType
  // Importe: perspectiva TrabFlow (+) = TrabFlow recibe, (-) = TrabFlow paga
  amount: number
  currency: string
  status: LedgerEntryStatus

  // Trazabilidad (INV-009)
  masterOrderId: string | null
  supplierOrderId: string | null
  actorId: string | null
  settlementId: string | null
  refundId: string | null
  disputeId: string | null

  description: string | null
  correlationId: string | null   // agrupa movimientos del mismo evento
  sourceEventId: string | null   // para idempotencia (INV-017)
  compensatesEntryId: string | null  // apunta a la entrada que compensa

  // PSP (STRIPE_GATE — null en simulación)
  externalProvider: string
  externalId: string | null
  externalType: string | null

  occurredAt: string
  createdAt: string
}

/** Parámetros para añadir una entrada al ledger */
export interface LedgerAppendParams {
  entryType: LedgerEntryType
  amount: number
  masterOrderId?: string
  supplierOrderId?: string
  actorId?: string
  description?: string
  correlationId?: string
  sourceEventId?: string
  compensatesEntryId?: string
  externalProvider?: string
  externalId?: string
  externalType?: string
  currency?: string
  status?: LedgerEntryStatus
  occurredAt?: string
}

/** Balance del ledger (resultado de mkt_fin_ledger_balance) */
export interface LedgerBalance {
  totalAmount: number
  byType: Partial<Record<LedgerEntryType, number>>
  entriesCount: number
  confirmedAmount: number
  pendingAmount: number
  // GMV (INV-001: NO es Revenue TrabFlow)
  gmvGoodsEntitlement: number
  gmvShippingEntitlement: number
  // Revenue TrabFlow (comisión)
  commissionAccrued: number
  simCommission: number
}

/** Movimientos agrupados por tipo (para reporting) */
export interface LedgerSummaryByType {
  entryType: LedgerEntryType
  totalAmount: number
  count: number
  note?: string
}
