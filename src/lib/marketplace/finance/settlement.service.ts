/**
 * MP-FIN-2F — Settlement Service
 *
 * Gestiona el ciclo de vida de liquidaciones de proveedores.
 * SETTLEMENT ≠ PAYOUT: calcula la obligación económica, no transfiere dinero.
 * SIMULATION_ONLY = true. LEDGER = SOURCE OF TRUTH.
 *
 * Fórmula max_payable: GREATEST(available - negative, 0)
 * TEB disminuye por settlement_amount (≠ reserve que no cambia TEB).
 *
 * State machine: draft → calculated → approved → payable → simulated_paid → closed/adjusted/cancelled
 *
 * Gates cerrados:
 *   COMMISSION_GATE — commission_amount = 0
 *   STRIPE_GATE     — no Stripe, no dinero real
 *   LEGAL_GATE      — pendiente revisión legal
 *   TAX_GATE        — pendiente revisión fiscal
 *
 * Invariante S-26: una ledger_entry no puede aparecer en dos settlements distintos.
 */

import { supabase } from '../../supabase'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type SettlementStatus =
  | 'draft'
  | 'calculated'
  | 'approved'
  | 'payable'
  | 'simulated_paid'
  | 'closed'
  | 'adjusted'
  | 'cancelled'

export interface SettlementPreview {
  provider_actor_id: string
  currency: string
  period_start: string
  period_end: string
  eligible_entries_in_period: number
  period_sales: number
  period_shipping: number
  period_refunds: number
  period_chargebacks: number
  period_chargeback_reversals: number
  period_recoveries: number
  period_p2a_transitions: number
  period_reserve_releases: number
  period_adjustments: number
  gross_activity: number
  net_activity: number
  current_available: number
  current_reserved: number
  current_negative: number
  current_historical_settled: number
  max_payable: number
  formula_max_payable: string
  requested_amount: number
  commission_real: number
  commission_sim_rate: string
  commission_note: string
  payment_fees: number
  projected_available_after: number
  projected_reserved_after: number
  projected_negative_after: number
  projected_historical_after: number
  simulation_only: boolean
  preview_at: string
}

export interface CreateSettlementResult {
  status: 'created' | 'replayed'
  settlement_id: string
  settlement_number: string
  settlement_status: SettlementStatus
  provider_actor_id: string
  currency: string
  period_start: string
  period_end: string
  max_payable: number
  settlement_amount: number
  lines_count: number
  auto_calculated: boolean
  simulation_only: boolean
}

export interface ApproveSettlementResult {
  status: 'approved'
  settlement_id: string
  settlement_number: string
  settlement_status: SettlementStatus
  max_payable: number
  settlement_amount: number
  approved_at: string
}

export interface SimulatePaymentResult {
  status: 'done' | 'replayed'
  settlement_id: string
  settlement_number: string
  settlement_status: string
  settlement_amount: number
  ledger_entry_id: string
  new_available: number
  new_historical_settled: number
  new_teb: number
  simulation_only: boolean
}

export interface CancelSettlementResult {
  status: 'cancelled'
  settlement_id: string
  settlement_number: string
  cancelled_at: string
  ledger_entries_freed: boolean
}

export interface RecalculateSettlementResult {
  status: 'recalculated'
  settlement_id: string
  settlement_number: string
  settlement_status: SettlementStatus
  max_payable: number
  settlement_amount: number
  lines_count: number
}

export interface SettlementDetail {
  id: string
  settlement_number: string
  provider_actor_id: string
  currency: string
  period_start: string
  period_end: string
  status: SettlementStatus
  opening_pending: number
  opening_available: number
  opening_reserved: number
  opening_negative: number
  opening_historical_settled: number
  sales_amount: number
  shipping_amount: number
  refund_amount: number
  chargeback_amount: number
  chargeback_reversal_amount: number
  recovery_amount: number
  reserve_release_amount: number
  commission_amount: number
  adjustment_amount: number
  gross_activity: number
  net_activity: number
  available_amount_at_calc: number
  reserved_amount_at_calc: number
  negative_amount_at_calc: number
  max_payable: number
  settlement_amount: number
  settlement_ledger_entry_id: string | null
  simulation_only: boolean
  lines_count: number
  calculated_at: string | null
  approved_at: string | null
  simulated_paid_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface SettlementListItem {
  id: string
  settlement_number: string
  currency: string
  period_start: string
  period_end: string
  status: SettlementStatus
  max_payable: number
  settlement_amount: number
  simulation_only: boolean
  calculated_at: string | null
  approved_at: string | null
  simulated_paid_at: string | null
  created_at: string
}

export interface SettlementListResult {
  items: SettlementListItem[]
  total: number
  limit: number
  offset: number
}

export interface AdminSettlementListItem extends SettlementListItem {
  provider_actor_id: string
}

export interface AdminSettlementListResult {
  items: AdminSettlementListItem[]
  total: number
  limit: number
  offset: number
  filters: {
    status: string | null
    currency: string | null
    actor_id: string | null
  }
}

export interface SettlementStatementData {
  settlement_id: string
  settlement_number: string
  provider_actor_id: string
  currency: string
  period_start: string
  period_end: string
  status: SettlementStatus
  period_summary: {
    sales: number
    shipping: number
    refunds: number
    chargebacks: number
    chargeback_reversals: number
    recoveries: number
    reserve_releases: number
    adjustments: number
    gross_activity: number
    net_activity: number
    commission_real: number
    commission_note: string
    payment_fees: number
    fees_note: string
  }
  balance_at_calculation: {
    available: number
    reserved: number
    negative: number
    max_payable: number
    formula: string
  }
  settlement_economics: {
    settlement_amount: number
    max_payable: number
    settlement_type: string
    simulation_only: boolean
  }
  closing_position: {
    opening_available: number
    settlement_amount: number
    projected_available_after: number
    projected_historical_after: number
    reserved_unchanged: number
    negative_unchanged: number
  }
  current_balance: {
    available: number
    reserved: number
    negative: number
    historical_settled: number
    teb: number
  } | null
  lines: Array<{
    line_id: string
    ledger_entry_id: string
    supplier_order_id: string | null
    master_order_id: string | null
    entry_type: string
    amount: number
    currency: string
    line_status: string
  }>
  lines_count: number
  ledger_entry_id: string | null
  gates: {
    STRIPE_GATE: string
    LEGAL_GATE: string
    TAX_GATE: string
    note: string
  }
  generated_at: string
}

export interface AdminSettlementsOverview {
  total_settlements: number
  settlements_draft: number
  settlements_calculated: number
  settlements_approved: number
  settlements_payable: number
  settlements_simulated_paid: number
  settlements_closed: number
  settlements_cancelled: number
  total_max_payable: number
  total_simulated_paid: number
  avg_settlement_amount: number
  providers_with_settlements: number
  simulation_only: boolean
  by_currency: Record<string, {
    total_settled: number
    total_max_payable: number
    settlements_count: number
    simulated_paid_count: number
  }>
  top_providers_by_settled: Array<{
    provider_actor_id: string
    settlements_count: number
    total_settled: number
    total_max_payable: number
  }>
  calculated_at: string
}

// ── Funciones ────────────────────────────────────────────────────────────────

/**
 * Dry-run de un settlement. No persiste nada.
 * Retorna max_payable = GREATEST(available - negative, 0).
 * commission_real = 0 (COMMISSION_GATE cerrado).
 */
export async function previewSettlement(params: {
  actorId: string
  currency?: string
  periodStart?: string | null
  periodEnd?: string | null
  amount?: number | null
}): Promise<SettlementPreview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_preview_settlement', {
    p_actor_id:     params.actorId,
    p_currency:     params.currency    ?? 'EUR',
    p_period_start: params.periodStart ?? '-infinity',
    p_period_end:   params.periodEnd   ?? new Date().toISOString(),
    p_amount:       params.amount      ?? null,
  })
  if (error) throw new Error(`previewSettlement: ${error.message}`)
  return data as SettlementPreview
}

/**
 * Crea un settlement de simulación. Solo admin.
 * Idempotente por idempotency_key.
 * p_auto_calculate=true (default) → status='calculated'.
 * settlement_amount = MIN(p_amount ?? max_payable, max_payable).
 *
 * Lanza ACTOR_NOT_FOUND si el actor no existe.
 * Lanza UNAUTHORIZED si no es platform_admin.
 */
export async function createSimulationSettlement(params: {
  actorId: string
  currency?: string
  periodStart?: string | null
  periodEnd?: string | null
  amount?: number | null
  idempotencyKey?: string | null
  notes?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown> | null
  autoCalculate?: boolean
}): Promise<CreateSettlementResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_create_simulation_settlement', {
    p_actor_id:        params.actorId,
    p_currency:        params.currency       ?? 'EUR',
    p_period_start:    params.periodStart    ?? '-infinity',
    p_period_end:      params.periodEnd      ?? new Date().toISOString(),
    p_amount:          params.amount         ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
    p_notes:           params.notes          ?? null,
    p_correlation_id:  params.correlationId  ?? null,
    p_metadata:        params.metadata       ?? null,
    p_auto_calculate:  params.autoCalculate  ?? true,
  })
  if (error) throw new Error(`createSimulationSettlement: ${error.message}`)
  return data as CreateSettlementResult
}

/**
 * Retorna los datos completos de un settlement.
 * Proveedor solo puede ver sus propios settlements.
 * Lanza SETTLEMENT_NOT_FOUND / ACCESS_DENIED.
 */
export async function getSettlement(settlementId: string): Promise<SettlementDetail> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_settlement', {
    p_settlement_id: settlementId,
  })
  if (error) throw new Error(`getSettlement: ${error.message}`)
  return data as SettlementDetail
}

/**
 * Lista los settlements de un proveedor con paginación.
 */
export async function listProviderSettlements(
  actorId: string,
  limit = 20,
  offset = 0
): Promise<SettlementListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_provider_settlements', {
    p_actor_id: actorId,
    p_limit:    limit,
    p_offset:   offset,
  })
  if (error) throw new Error(`listProviderSettlements: ${error.message}`)
  return data as SettlementListResult
}

/**
 * Lista todos los settlements del sistema. Solo admin.
 * Filtrable por status, currency y actor_id.
 */
export async function listAdminSettlements(params?: {
  status?: SettlementStatus | null
  currency?: string | null
  actorId?: string | null
  limit?: number
  offset?: number
}): Promise<AdminSettlementListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_admin_settlements', {
    p_status:   params?.status   ?? null,
    p_currency: params?.currency ?? null,
    p_actor_id: params?.actorId  ?? null,
    p_limit:    params?.limit    ?? 50,
    p_offset:   params?.offset   ?? 0,
  })
  if (error) throw new Error(`listAdminSettlements: ${error.message}`)
  return data as AdminSettlementListResult
}

/**
 * Recalcula un settlement en estado draft.
 * Elimina las líneas anteriores y las recalcula desde el ledger.
 * Permite ajustar settlement_amount antes de calcular.
 *
 * Lanza SETTLEMENT_NOT_DRAFT si el estado no es draft.
 */
export async function recalculateDraftSettlement(
  settlementId: string,
  amount?: number | null
): Promise<RecalculateSettlementResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_recalculate_draft_settlement', {
    p_settlement_id: settlementId,
    p_amount:        amount ?? null,
  })
  if (error) throw new Error(`recalculateDraftSettlement: ${error.message}`)
  return data as RecalculateSettlementResult
}

/**
 * Aprueba un settlement. Solo admin.
 * Transiciona draft/calculated → approved.
 * Si el estado es draft, recalcula automáticamente antes de aprobar.
 *
 * Lanza SETTLEMENT_INVALID_STATE si ya está approved/simulated_paid/etc.
 */
export async function approveSimulationSettlement(
  settlementId: string,
  notes?: string | null
): Promise<ApproveSettlementResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_approve_simulation_settlement', {
    p_settlement_id: settlementId,
    p_notes:         notes ?? null,
  })
  if (error) throw new Error(`approveSimulationSettlement: ${error.message}`)
  return data as ApproveSettlementResult
}

/**
 * Simula el pago de un settlement aprobado. Solo admin.
 * Escribe SETTLEMENT_PAID_SIMULATION (negativa) en el ledger.
 * Reduce available, aumenta historical_settled, TEB disminuye.
 * Idempotente: segunda llamada retorna status='replayed'.
 *
 * SIMULATION_ONLY — no hay transferencia real.
 * STRIPE_GATE cerrado — no se llama a Stripe.
 *
 * Lanza SETTLEMENT_INVALID_STATE si no es approved/payable.
 * Lanza SETTLEMENT_ZERO_AMOUNT si settlement_amount=0.
 */
export async function simulateSettlementPayment(
  settlementId: string,
  correlationId?: string | null
): Promise<SimulatePaymentResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_simulate_settlement_payment', {
    p_settlement_id:  settlementId,
    p_correlation_id: correlationId ?? null,
  })
  if (error) throw new Error(`simulateSettlementPayment: ${error.message}`)
  return data as SimulatePaymentResult
}

/**
 * Cancela un settlement en estado draft o calculated.
 * ON DELETE CASCADE elimina todas las settlement_lines.
 * Las ledger_entries quedan libres para futuros settlements.
 *
 * Lanza SETTLEMENT_CANNOT_CANCEL si el estado es approved/simulated_paid/etc.
 */
export async function cancelDraftSettlement(
  settlementId: string,
  reason?: string | null
): Promise<CancelSettlementResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_cancel_draft_settlement', {
    p_settlement_id: settlementId,
    p_reason:        reason ?? null,
  })
  if (error) throw new Error(`cancelDraftSettlement: ${error.message}`)
  return data as CancelSettlementResult
}

/**
 * Retorna los datos completos del estado de cuenta de un settlement.
 * Incluye líneas de detalle, resumen de periodo, balances, y gates.
 * Útil para generar PDF/DOCX o mostrar en portal de proveedor.
 *
 * commission_real = 0 (COMMISSION_GATE cerrado).
 * payment_fees = 0 (STRIPE_GATE cerrado).
 * Note: Settlement ≠ Factura Fiscal — no genera documento tributario.
 */
export async function getSettlementStatementData(
  settlementId: string
): Promise<SettlementStatementData> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_settlement_statement_data', {
    p_settlement_id: settlementId,
  })
  if (error) throw new Error(`getSettlementStatementData: ${error.message}`)
  return data as SettlementStatementData
}

/**
 * KPIs globales de settlements para el panel admin.
 * Desglose por status, currency y top providers.
 * simulation_only=true siempre en Phase 0.
 */
export async function getAdminSettlementsOverview(): Promise<AdminSettlementsOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_admin_settlements_overview')
  if (error) throw new Error(`getAdminSettlementsOverview: ${error.message}`)
  return data as AdminSettlementsOverview
}
