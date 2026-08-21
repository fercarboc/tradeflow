// Tipos de política de comisión — MP-FIN-1A
// INV-005: commission_rate real = 0 en Fase 0. 2% es solo simulation_rate.
// INV-006: shipping no commissionable en Fase 0.
// TAX_GATE: tipo IVA de comisión pendiente de dictamen fiscal.

/** Política de comisión */
export interface CommissionPolicy {
  id: string
  nombre: string

  // Activación
  commissionEnabled: boolean   // false en Fase 0 (INV-005)
  simulationOnly: boolean      // true en Fase 0

  // Tasa
  commissionRate: number       // 0.0000 en Fase 0
  commissionType: 'percentage' | 'fixed_per_order' | 'fixed_per_item'

  // Base (TAX_GATE: base imponible definitiva pendiente de dictamen)
  commissionBase: 'goods_net' | 'goods_gross' | 'goods_net_plus_shipping'
  commissionTaxRate: number    // 21.00 asumido para simulación (TAX_GATE)

  // Portes (INV-006: false en Fase 0)
  appliesToShipping: boolean

  // Vigencia
  effectiveFrom: string | null
  effectiveTo: string | null

  // Override de proveedor
  providerActorId: string | null

  isActive: boolean
  notas: string | null
  createdAt: string
  updatedAt: string
}

/** Resultado del cálculo de comisión */
export interface CommissionResult {
  commissionNet: number
  commissionTax: number
  commissionGross: number
  commissionRate: number
  commissionBase: string
  taxRate: number
  isSimulation: boolean
  isReal: boolean         // false en Fase 0 siempre
  policyId: string | null
}

/** Snapshot de comisión guardado en el supplier order */
export interface CommissionPolicySnapshot {
  policyId: string | null
  rate: number            // 0.0000 en Fase 0
  type: string
  base: string
  commissionableBaseNet: number
  commissionNet: number   // 0 en Fase 0
  commissionTax: number   // 0 en Fase 0
  commissionGross: number // 0 en Fase 0
  appliesToShipping: boolean
  // Simulación (INV-005: NO es Revenue real)
  simRate: number
  simNet: number
  simTax: number
  simGross: number
}

/** Configuración de feature flags financieros */
export interface FinancialConfig {
  paymentMode: 'simulation' | 'stripe_sandbox' | 'stripe_live'
  simulationEnabled: boolean
  realPaymentsEnabled: boolean         // false en Fase 0
  stripeConnectEnabled: boolean        // false (STRIPE_GATE)
  commissionEnabled: boolean           // false en Fase 0 (INV-005)
  commissionSimulationRate: number     // 0.02 (hipótesis simulación)
  commissionRealRate: number           // 0.00 en Fase 0
  settlementsEnabled: boolean
  settlementFrequency: 'monthly' | 'biweekly' | 'weekly'
  settlementHoldDays: number
  realPayoutsEnabled: boolean          // false (STRIPE_GATE)
  reservesEnabled: boolean
  refundsEnabled: boolean
  disputesEnabled: boolean
}
