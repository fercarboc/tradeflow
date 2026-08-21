// Financial Config Service — MP-FIN-1A
// Lee los feature flags financieros de trade_marketplace_financial_config.
// El acceso es de solo lectura para la capa de servicios (escribir = admin SQL directo).

import { supabase } from '../../supabase'
import type { FinancialConfig } from './types/commission.types'

// ── Leer un valor de configuración por clave ──────────────────────────────────

export async function getFinancialConfigValue(key: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('mkt_fin_get_config', {
    p_key: key,
  })

  if (error) throw new Error(`getFinancialConfigValue(${key}) failed: ${error.message}`)

  return data
}

// ── Leer un booleano de configuración con valor por defecto ───────────────────

export async function getFinancialConfigBool(key: string, defaultValue = false): Promise<boolean> {
  const { data, error } = await supabase.rpc('mkt_fin_config_bool', {
    p_key:     key,
    p_default: defaultValue,
  })

  if (error) throw new Error(`getFinancialConfigBool(${key}) failed: ${error.message}`)

  return Boolean(data)
}

// ── Obtener la configuración financiera completa ────────────────────────────────

export async function getFinancialConfig(): Promise<FinancialConfig> {
  const { data, error } = await supabase
    .from('trade_marketplace_financial_config')
    .select('config_key, config_value')

  if (error) throw new Error(`getFinancialConfig failed: ${error.message}`)

  const cfg = Object.fromEntries(
    (data ?? []).map((r: { config_key: string; config_value: unknown }) => [r.config_key, r.config_value])
  )

  return {
    paymentMode:              (cfg['payment.mode'] as FinancialConfig['paymentMode']) ?? 'simulation',
    simulationEnabled:        Boolean(cfg['payment.simulation_enabled'] ?? true),
    realPaymentsEnabled:      Boolean(cfg['payment.real_payments_enabled'] ?? false),
    stripeConnectEnabled:     Boolean(cfg['payment.stripe_connect_enabled'] ?? false),
    commissionEnabled:        Boolean(cfg['commission.enabled'] ?? false),
    commissionSimulationRate: Number(cfg['commission.simulation_rate'] ?? 0.02),
    commissionRealRate:       Number(cfg['commission.real_rate'] ?? 0),
    settlementsEnabled:       Boolean(cfg['settlement.enabled'] ?? false),
    settlementFrequency:      (cfg['settlement.frequency'] as FinancialConfig['settlementFrequency']) ?? 'monthly',
    settlementHoldDays:       Number(cfg['settlement.hold_days'] ?? 7),
    realPayoutsEnabled:       Boolean(cfg['settlement.real_payouts_enabled'] ?? false),
    reservesEnabled:          Boolean(cfg['reserve.enabled'] ?? false),
    refundsEnabled:           Boolean(cfg['refund.enabled'] ?? false),
    disputesEnabled:          Boolean(cfg['dispute.enabled'] ?? false),
  }
}

// ── Guard: lanzar error si el pago real está habilitado ───────────────────────
// Usar en código que nunca debe ejecutarse en Fase 0 con dinero real.

export async function assertSimulationMode(): Promise<void> {
  const realEnabled = await getFinancialConfigBool('payment.real_payments_enabled', false)
  if (realEnabled) {
    throw new Error(
      'STRIPE_GATE: payment.real_payments_enabled=true. ' +
      'Este código requiere dictamen legal/fiscal antes de operar con dinero real.'
    )
  }
}
