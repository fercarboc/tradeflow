/**
 * MP-FIN-2A — Provider Balance Service
 *
 * LEDGER = SOURCE OF TRUTH.
 * trade_marketplace_balances es una proyección derivada del ledger.
 * Rebuild siempre posible e idempotente (INV-B04).
 *
 * Phase 2A:
 *   pending = SUM(GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT) where status!='failed'
 *   available = reserved = negative = settled = 0 (BUSINESS_RULE_GATE / MP-FIN-2E/2F)
 *   total_economic_balance = pending + available + reserved - negative
 *   historical_settled excluido del total (INV-B03: flujo histórico, no stock)
 *   COMMISSION_SIM_ACCRUAL no afecta ningún bucket (INV-B02)
 */

import { supabase } from '../../supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface ProviderBalance {
  actor_id: string
  currency: string
  pending_amount: number
  available_amount: number
  reserved_amount: number
  negative_amount: number
  historical_settled: number  // FLUJO HISTÓRICO — no forma parte del total (INV-B03)
  total_economic_balance: number
  last_ledger_entry_id: string | null
  last_recalculated_at: string | null
  projection_strategy: string
  projection_exists: boolean
}

export interface BalanceRebuildResult extends ProviderBalance {
  status: 'rebuilt'
  ledger_entries_read: number
  recalculated_at: string
}

export interface BalanceReconciliation {
  actor_id: string
  currency: string
  status: 'MATCH' | 'MISMATCH'
  expected_total: number
  stored_total: number
  difference: number
  ledger_entries_used: number
  projection_at: string | null
  checked_at: string
  reconciliation_note: string
}

export interface AdminBalancesOverview {
  total_provider_pending: number
  total_provider_available: number
  total_provider_reserved: number
  total_provider_negative: number
  total_historical_settled: number   // FLUJO — no incluir en total_economic (INV-B03)
  total_economic_balance: number
  providers_with_balance: number
  providers_with_pending: number
  providers_with_available: number
  providers_with_negative: number
  phase: string
  invariant_note: string
  commission_note: string
  calculated_at: string
}

// ── Funciones principales ──────────────────────────────────────────────────

/**
 * Reconstruye el balance de un proveedor desde el ledger.
 * Idempotente: múltiples llamadas producen el mismo resultado (INV-B04).
 * COMMISSION_SIM_ACCRUAL excluida de todos los buckets (INV-B02).
 */
export async function rebuildProviderBalance(
  actorId: string,
  currency = 'EUR'
): Promise<BalanceRebuildResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_rebuild_provider_balance', {
    p_actor_id: actorId,
    p_currency: currency,
  })

  if (error) throw new Error(`rebuildProviderBalance: ${error.message}`)
  return data as BalanceRebuildResult
}

/**
 * Lee el balance almacenado (proyección). No reconstruye.
 * Si no existe proyección, devuelve balance=0 con projection_exists=false.
 */
export async function getProviderBalance(
  actorId: string,
  currency = 'EUR'
): Promise<ProviderBalance> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_provider_balance', {
    p_actor_id: actorId,
    p_currency: currency,
  })

  if (error) throw new Error(`getProviderBalance: ${error.message}`)
  return data as ProviderBalance
}

/**
 * Compara la proyección almacenada vs el valor derivado del ledger.
 * Solo diagnóstico — no modifica la tabla.
 * Si status='MISMATCH', llamar rebuildProviderBalance para corregir.
 */
export async function reconcileProviderBalance(
  actorId: string,
  currency = 'EUR'
): Promise<BalanceReconciliation> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_reconcile_provider_balance', {
    p_actor_id: actorId,
    p_currency: currency,
  })

  if (error) throw new Error(`reconcileProviderBalance: ${error.message}`)
  return data as BalanceReconciliation
}

/**
 * KPIs de balances de todos los proveedores. Solo platform_admin.
 * INVARIANTE: total_historical_settled NO forma parte de total_economic_balance (INV-B03).
 */
export async function getAdminBalancesOverview(): Promise<AdminBalancesOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_admin_balances_overview')

  if (error) throw new Error(`getAdminBalancesOverview: ${error.message}`)
  return data as AdminBalancesOverview
}

/**
 * Rebuild + reconcile en una sola operación: reconstruye y verifica.
 * Útil para jobs de mantenimiento o tras detectar un MISMATCH.
 */
export async function rebuildAndVerifyBalance(
  actorId: string,
  currency = 'EUR'
): Promise<{ rebuild: BalanceRebuildResult; reconciliation: BalanceReconciliation }> {
  const rebuild = await rebuildProviderBalance(actorId, currency)
  const reconciliation = await reconcileProviderBalance(actorId, currency)

  if (reconciliation.status === 'MISMATCH') {
    console.error(
      `[balance.service] POST-REBUILD MISMATCH actor=${actorId} diff=${reconciliation.difference}`
    )
  }

  return { rebuild, reconciliation }
}
