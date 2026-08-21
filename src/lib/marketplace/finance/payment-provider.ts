// Payment Provider Abstraction — MP-FIN-1A
// Separa la lógica de negocio de la implementación del PSP.
// Fase 0: SimulationMarketplacePaymentProvider (sin dinero real).
// Futuro MP-FIN-7 (STRIPE_GATE): StripeMarketplacePaymentProvider.

import type { Currency } from './types/money.types'

// ── Tipos de la interface ────────────────────────────────────────────────────

export interface CreatePaymentParams {
  masterOrderId: string
  checkoutKey: string        // idempotencia (INV-017)
  amount: number
  currency: Currency
  description?: string
  buyerEmail?: string
  metadata?: Record<string, string>
}

export interface PaymentResult {
  providerId: string         // 'sim_pi_...' en simulación; 'pi_...' en Stripe
  provider: string           // 'simulation' | 'stripe'
  status: 'requires_action' | 'processing' | 'succeeded' | 'failed'
  amount: number
  currency: Currency
  clientSecret?: string      // Solo en Stripe real
  isSimulation: boolean
}

export interface CreateTransferParams {
  supplierOrderId: string
  actorId: string
  amount: number
  currency: Currency
  idempotencyKey: string     // INV-017
  description?: string
  // STRIPE_GATE: stripeAccountId del proveedor
  destinationAccount?: string
}

export interface TransferResult {
  transferId: string         // 'sim_tr_...' en simulación
  provider: string
  status: 'processing' | 'paid' | 'failed'
  amount: number
  currency: Currency
  isSimulation: boolean
}

export interface CreateRefundParams {
  masterOrderId: string
  supplierOrderId: string
  amount: number
  currency: Currency
  reason?: string
  idempotencyKey: string     // INV-017
}

export interface RefundResult {
  refundId: string           // 'sim_re_...' en simulación
  provider: string
  status: 'pending' | 'succeeded' | 'failed'
  amount: number
  currency: Currency
  isSimulation: boolean
}

export interface PlatformBalance {
  available: number
  pending: number
  currency: Currency
  provider: string
  isSimulation: boolean
  asOf: string
}

// ── Interface del Payment Provider ───────────────────────────────────────────

export interface MarketplacePaymentProvider {
  readonly name: string
  readonly isSimulation: boolean

  createPayment(params: CreatePaymentParams): Promise<PaymentResult>
  getPayment(providerId: string): Promise<PaymentResult | null>

  // STRIPE_GATE: los siguientes métodos no tienen implementación real en Fase 0
  createTransfer(params: CreateTransferParams): Promise<TransferResult>
  reverseTransfer(transferId: string, reason?: string): Promise<TransferResult>

  createRefund(params: CreateRefundParams): Promise<RefundResult>

  getPlatformBalance(): Promise<PlatformBalance>
}

// ── Implementación de Simulación — Fase 0 ────────────────────────────────────

export class SimulationMarketplacePaymentProvider implements MarketplacePaymentProvider {
  readonly name = 'simulation'
  readonly isSimulation = true

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const simId = `sim_pi_${params.checkoutKey}_${Date.now()}`
    return {
      providerId: simId,
      provider: 'simulation',
      status: 'succeeded',  // en simulación el pago siempre tiene éxito inmediato
      amount: params.amount,
      currency: params.currency,
      isSimulation: true,
    }
  }

  async getPayment(providerId: string): Promise<PaymentResult | null> {
    if (!providerId.startsWith('sim_pi_')) return null
    return {
      providerId,
      provider: 'simulation',
      status: 'succeeded',
      amount: 0,
      currency: 'EUR',
      isSimulation: true,
    }
  }

  async createTransfer(params: CreateTransferParams): Promise<TransferResult> {
    const simId = `sim_tr_${params.supplierOrderId}_${Date.now()}`
    return {
      transferId: simId,
      provider: 'simulation',
      status: 'paid',
      amount: params.amount,
      currency: params.currency,
      isSimulation: true,
    }
  }

  async reverseTransfer(transferId: string): Promise<TransferResult> {
    return {
      transferId: `sim_rev_${transferId}`,
      provider: 'simulation',
      status: 'paid',
      amount: 0,
      currency: 'EUR',
      isSimulation: true,
    }
  }

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const simId = `sim_re_${params.masterOrderId}_${Date.now()}`
    return {
      refundId: simId,
      provider: 'simulation',
      status: 'succeeded',
      amount: params.amount,
      currency: params.currency,
      isSimulation: true,
    }
  }

  async getPlatformBalance(): Promise<PlatformBalance> {
    return {
      available: 0,
      pending: 0,
      currency: 'EUR',
      provider: 'simulation',
      isSimulation: true,
      asOf: new Date().toISOString(),
    }
  }
}

// ── Singleton del proveedor activo ────────────────────────────────────────────

// En Fase 0: siempre simulación.
// En MP-FIN-7 (STRIPE_GATE): cambiar por StripeMarketplacePaymentProvider.
export const marketplacePaymentProvider: MarketplacePaymentProvider =
  new SimulationMarketplacePaymentProvider()

export function getPaymentProvider(): MarketplacePaymentProvider {
  // Aquí se añadirá la lógica de selección por payment_mode en MP-FIN-7.
  // Por ahora: siempre simulación.
  return marketplacePaymentProvider
}
