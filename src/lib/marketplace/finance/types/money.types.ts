// Tipos monetarios — MP-FIN-1A
// INV-015: currency siempre explícita.
// INV-016: net/tax/gross siempre diferenciados.
// No usar floating point directamente para dinero: usar numeric en BD,
// y representar en TS como number sabiendo que viene redondeado de Postgres numeric(12,2).

export type Currency = 'EUR'  // Único soportado en Fase 0. Extender cuando sea necesario.

/** Importe simple con moneda explícita (INV-015) */
export interface Money {
  amount: number
  currency: Currency
}

/** Trío net/tax/gross para cualquier concepto con IVA (INV-016) */
export interface MoneyBreakdown {
  net: number
  tax: number
  gross: number
  taxRate: number  // porcentaje: 21.00, 10.00, etc.
  currency: Currency
}

/** Totales de un supplier order o master order */
export interface OrderTotals {
  goods: MoneyBreakdown
  shipping: MoneyBreakdown
  checkoutGross: number   // = goods.gross + shipping.gross (INV-003)
  currency: Currency
}

/** Snapshot de comisión (INV-007: inmutable tras checkout) */
export interface CommissionSnapshot {
  policyId: string | null
  rate: number             // 0.0000 en Fase 0 (INV-005)
  type: 'percentage' | 'fixed_per_order' | 'fixed_per_item'
  base: 'goods_net' | 'goods_gross' | 'goods_net_plus_shipping'
  commissionableBaseNet: number
  commissionNet: number    // 0 en Fase 0
  commissionTax: number    // 0 en Fase 0
  commissionGross: number  // 0 en Fase 0
  appliesToShipping: boolean  // false en Fase 0 (INV-006)
  isSimulation: boolean
  isReal: boolean          // false en Fase 0
}

/** Comisión simulada (INV-005: NO es Revenue TrabFlow real) */
export interface SimulatedCommission {
  simulatedNet: number
  simulatedTax: number
  simulatedGross: number
  simulatedRate: number
  note: 'SIMULATION_ONLY — NOT_TRABFLOW_REVENUE'
}

/** Resultado del cálculo de comisión desde la RPC */
export interface CommissionCalculationResult {
  commissionNet: number
  commissionTax: number
  commissionGross: number
  commissionRate: number
  commissionBase: string
  taxRate: number
  isSimulation: boolean
  isReal: boolean
  policyId: string | null
}

/** Payable del proveedor para un supplier order */
export interface ProviderPayable {
  grossEntitlement: number   // goods.gross + shipping.gross
  commissionDeducted: number // commission.gross (Opción A: [TAX_GATE])
  netPayable: number         // grossEntitlement - commissionDeducted
  currency: Currency
  note?: string
}

/** Estado financiero del pago (INV-012: separado del estado logístico) */
export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'failed'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'
  | 'chargeback_platform_won'
  | 'chargeback_platform_lost'
