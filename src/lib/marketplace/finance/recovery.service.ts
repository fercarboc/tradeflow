/**
 * MP-FIN-2D — Recovery Service
 *
 * Detecta saldos negativos por proveedor, registra el déficit y permite
 * simular estrategias de recuperación. SIMULATION_ONLY = true.
 *
 * Estrategias soportadas:
 *   future_sales_offset  — TrabFlow retiene earnings futuros (FUTURE_SETOFF, positivo)
 *   manual_simulation    — Pago manual del proveedor (BALANCE_RECOVERY, positivo)
 *
 * Invariantes:
 *   - La venta original (GOODS_ENTITLEMENT) NUNCA se modifica
 *   - FUTURE_SETOFF y BALANCE_RECOVERY son entradas POSITIVAS independientes
 *   - Aislamiento por proveedor y por moneda
 *   - STRIPE_GATE + LEGAL_GATE cerrados (simulation_only)
 */

import { supabase } from '../../supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type RecoveryType = 'future_sales_offset' | 'manual_simulation'

export type RecoveryStatus = 'pending' | 'partial' | 'completed' | 'cancelled'

export type AgingBucket = '0_7' | '8_30' | '31_60' | '61_90' | '90_plus'

export interface NegativeBalanceBreakdown {
  provider_actor_id: string
  currency: string
  in_deficit: boolean
  deficit_amount: number
  negative_since: string | null
  aging_days: number | null
  aging_bucket: AgingBucket | null
  recovery_in_progress: boolean
  risk_flags: Array<{ flag: string; description: string }>
  calculated_at: string
}

export interface RecoveryPreview {
  provider_actor_id: string
  currency: string
  current_deficit: number
  proposed_amount: number
  effective_recovery: number
  remaining_deficit_after: number
  full_recovery: boolean
  impact_pct: number
  recovery_type: RecoveryType
  ledger_entry_type: 'BALANCE_RECOVERY' | 'FUTURE_SETOFF'
  simulation_only: boolean
  preview_at: string
}

export interface CreateRecoveryResult {
  status: 'created' | 'replayed'
  recovery_id: string
  recovery_number: string
  provider_actor_id: string
  currency: string
  deficit_amount: number
  recovery_amount: number
  recovery_type: RecoveryType
  recovery_status: RecoveryStatus
  simulation_only: boolean
  idempotency_key: string | null
  correlation_id: string | null
}

export interface ProcessRecoveryResult {
  status: 'done' | 'replayed'
  recovery_id: string
  recovery_number: string
  recovery_status: RecoveryStatus
  entry_type: 'BALANCE_RECOVERY' | 'FUTURE_SETOFF'
  ledger_entry_id: string
  amount_processed: number
  recovered_amount_total: number
  remaining_amount: number
  new_negative_amount: number
  new_pending_amount: number
  simulation_only: boolean
}

export interface CancelRecoveryResult {
  status: 'cancelled'
  recovery_id: string
  recovery_number: string
  cancelled_at: string
}

export interface RecoveryListItem {
  id: string
  recovery_number: string
  currency: string
  deficit_amount: number
  recovered_amount: number
  recovery_type: RecoveryType
  status: RecoveryStatus
  simulation_only: boolean
  negative_since: string | null
  initiated_at: string
  completed_at: string | null
  cancelled_at: string | null
  notes: string | null
}

export interface RecoveryListResult {
  items: RecoveryListItem[]
  total: number
  limit: number
  offset: number
}

export interface AdminRecoveryListResult {
  items: RecoveryListItem[]
  total: number
  limit: number
  offset: number
  filters: { status: string | null; currency: string | null }
}

export interface AdminNegativeOverview {
  providers_in_deficit: number
  total_deficit: number
  average_deficit: number
  active_recoveries: number
  total_recovered_this_period: number
  by_aging: Record<AgingBucket, { count: number; total_deficit: number }>
  calculated_at: string
}

// ── Funciones principales ──────────────────────────────────────────────────

/**
 * Retorna el desglose del saldo negativo de un proveedor: aging, risk_flags,
 * recovery_in_progress. Si el proveedor no tiene déficit, in_deficit=false.
 */
export async function getNegativeBalanceBreakdown(
  providerActorId: string,
  currency = 'EUR'
): Promise<NegativeBalanceBreakdown> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_negative_balance_breakdown', {
    p_provider_actor_id: providerActorId,
    p_currency: currency,
  })
  if (error) throw new Error(`getNegativeBalanceBreakdown: ${error.message}`)
  return data as NegativeBalanceBreakdown
}

/**
 * Calcula el impacto de una recuperación sin persistir ningún cambio.
 * Devuelve: effective_recovery, remaining_deficit_after, impact_pct, ledger_entry_type.
 */
export async function previewRecovery(
  providerActorId: string,
  currency = 'EUR',
  amount: number | null,
  recoveryType: RecoveryType
): Promise<RecoveryPreview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_preview_recovery', {
    p_provider_actor_id: providerActorId,
    p_currency: currency,
    p_amount: amount ?? null,
    p_recovery_type: recoveryType,
  })
  if (error) throw new Error(`previewRecovery: ${error.message}`)
  return data as RecoveryPreview
}

/**
 * Crea un plan de recuperación. Admin-only.
 * Idempotente por idempotency_key.
 * Lanza NO_DEFICIT si el proveedor no tiene saldo negativo.
 * Lanza AMOUNT_EXCEEDS_DEFICIT si el monto supera el déficit actual.
 */
export async function createRecovery(params: {
  providerActorId: string
  currency?: string
  amount: number
  recoveryType: RecoveryType
  notes?: string
  idempotencyKey?: string
  correlationId?: string
  metadata?: Record<string, unknown>
}): Promise<CreateRecoveryResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_create_recovery', {
    p_provider_actor_id: params.providerActorId,
    p_currency:          params.currency         ?? 'EUR',
    p_amount:            params.amount,
    p_recovery_type:     params.recoveryType,
    p_notes:             params.notes            ?? null,
    p_idempotency_key:   params.idempotencyKey   ?? null,
    p_correlation_id:    params.correlationId    ?? null,
    p_metadata:          params.metadata         ?? null,
  })
  if (error) throw new Error(`createRecovery: ${error.message}`)
  return data as CreateRecoveryResult
}

/**
 * Procesa un pago parcial o total de una recovery activa.
 * - manual_simulation → BALANCE_RECOVERY (positivo) en ledger
 * - future_sales_offset → FUTURE_SETOFF (positivo) en ledger
 * Idempotente por source_event_id.
 * Lanza RECOVERY_TERMINAL si la recovery ya está completed/cancelled.
 * Lanza AMOUNT_EXCEEDS_REMAINING si el monto supera el saldo pendiente.
 */
export async function processRecovery(params: {
  recoveryId: string
  amount: number
  sourceEventId?: string
  correlationId?: string
}): Promise<ProcessRecoveryResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_process_recovery', {
    p_recovery_id:     params.recoveryId,
    p_amount:          params.amount,
    p_source_event_id: params.sourceEventId ?? null,
    p_correlation_id:  params.correlationId ?? null,
  })
  if (error) throw new Error(`processRecovery: ${error.message}`)
  return data as ProcessRecoveryResult
}

/**
 * Cancela una recovery en estado pending o partial.
 * Lanza RECOVERY_TERMINAL si ya está completed/cancelled.
 */
export async function cancelRecovery(params: {
  recoveryId: string
  reason?: string
  correlationId?: string
}): Promise<CancelRecoveryResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_cancel_recovery', {
    p_recovery_id:    params.recoveryId,
    p_reason:         params.reason        ?? null,
    p_correlation_id: params.correlationId ?? null,
  })
  if (error) throw new Error(`cancelRecovery: ${error.message}`)
  return data as CancelRecoveryResult
}

/**
 * Lista las recoveries de un proveedor con paginación.
 */
export async function listProviderRecoveries(
  providerActorId: string,
  limit = 20,
  offset = 0
): Promise<RecoveryListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_provider_recoveries', {
    p_provider_actor_id: providerActorId,
    p_limit:             limit,
    p_offset:            offset,
  })
  if (error) throw new Error(`listProviderRecoveries: ${error.message}`)
  return data as RecoveryListResult
}

/**
 * Lista todas las recoveries del sistema. Admin-only.
 * Filtrable por status y currency.
 */
export async function listAdminRecoveries(params?: {
  status?: RecoveryStatus
  currency?: string
  limit?: number
  offset?: number
}): Promise<AdminRecoveryListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_admin_recoveries', {
    p_status:   params?.status   ?? null,
    p_currency: params?.currency ?? null,
    p_limit:    params?.limit    ?? 50,
    p_offset:   params?.offset   ?? 0,
  })
  if (error) throw new Error(`listAdminRecoveries: ${error.message}`)
  return data as AdminRecoveryListResult
}

/**
 * KPIs globales de saldos negativos y recoveries. Admin-only.
 * Devuelve providers_in_deficit, total_deficit, distribución por aging bucket
 * y count de recoveries activas.
 */
export async function getAdminNegativeOverview(): Promise<AdminNegativeOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_admin_negative_overview')
  if (error) throw new Error(`getAdminNegativeOverview: ${error.message}`)
  return data as AdminNegativeOverview
}
