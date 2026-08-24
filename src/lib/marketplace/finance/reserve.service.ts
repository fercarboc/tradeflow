/**
 * MP-FIN-2E — Reserve Service
 *
 * Gestiona reservas/holds de fondos de proveedores sobre el bucket available o pending.
 * SIMULATION_ONLY = true. Todas las operaciones son atómicas y auditadas.
 *
 * Invariante fundamental:
 *   reserve ≠ economic loss → TEB = pending + available + reserved − negative = CONSTANTE
 *   release ≠ revenue       → TEB no aumenta al liberar una reserva
 *
 * Gates abiertos (no implementados):
 *   STRIPE_GATE — no Stripe, no dinero real
 *   LEGAL_GATE  — pendiente revisión legal
 *   TAX_GATE    — pendiente revisión fiscal
 */

import { supabase } from '../../supabase'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ReserveType =
  | 'risk'
  | 'dispute'
  | 'chargeback_exposure'
  | 'new_provider'
  | 'delivery_window'
  | 'manual_review'
  | 'rolling'
  | 'fixed'
  | 'manual'
  | 'other'

export type ReserveStatus =
  | 'active'
  | 'partially_released'
  | 'released'
  | 'expired'
  | 'cancelled'

export type SourceBucket = 'available' | 'pending'

export interface ReservePreview {
  provider_actor_id: string
  currency: string
  reserve_type: string
  source_bucket: SourceBucket
  requested_amount: number
  can_reserve: boolean
  max_reservable: number
  before_pending: number
  before_available: number
  before_reserved: number
  before_teb: number
  after_pending: number
  after_available: number
  after_reserved: number
  after_teb: number
  teb_unchanged: boolean
  simulation_only: boolean
  preview_at: string
}

export interface CreateReserveResult {
  status: 'created' | 'replayed'
  reserve_id: string
  reserve_number: string
  provider_actor_id: string
  currency: string
  reserved_amount: number
  source_bucket: SourceBucket
  reserve_type: ReserveType
  reserve_status: ReserveStatus
  simulation_only: boolean
  ledger_entry_id: string | null
  new_available: number
  new_reserved: number
  new_teb: number
}

export interface ReleaseReserveResult {
  status: 'done' | 'replayed'
  reserve_id: string
  reserve_number: string
  reserve_status: ReserveStatus
  amount_released: number
  total_released: number
  remaining_amount: number
  ledger_entry_id: string | null
  new_available: number
  new_reserved: number
  new_teb: number
  simulation_only: boolean
}

export interface CancelReserveResult {
  status: 'cancelled'
  reserve_id: string
  reserve_number: string
  released_on_cancel: number
  new_available: number
  new_reserved: number
  simulation_only: boolean
  cancelled_at: string
}

export interface SimMakeAvailableResult {
  status: 'done'
  amount_moved: number
  ledger_entry_id: string
  simulation_only: boolean
  new_pending: number
  new_available: number
}

export interface ReserveDetail {
  id: string
  reserve_number: string
  provider_actor_id: string
  currency: string
  reserve_type: ReserveType
  status: ReserveStatus
  requested_amount: number
  reserved_amount: number
  released_amount: number
  remaining_amount: number
  source_bucket: SourceBucket
  reason: string
  reason_code: string | null
  dispute_id: string | null
  master_order_id: string | null
  supplier_order_id: string | null
  starts_at: string
  release_at: string | null
  expires_at: string | null
  released_at: string | null
  cancelled_at: string | null
  expired_at: string | null
  simulation_only: boolean
  correlation_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReserveListResult {
  items: ReserveDetail[]
  total: number
  limit: number
  offset: number
}

export interface AdminReserveListResult {
  items: ReserveDetail[]
  total: number
  limit: number
  offset: number
  filters: { status: string | null; currency: string | null }
}

export interface AgingBucket {
  count: number
  amount: number
}

export interface ReserveAgingSummary {
  provider_actor_id: string
  currency: string
  active_count: number
  total_reserved: number
  oldest_reserve_at: string | null
  by_aging: {
    '0_7': AgingBucket
    '8_30': AgingBucket
    '31_60': AgingBucket
    '61_90': AgingBucket
    '90_plus': AgingBucket
  }
  near_expiry_count: number
  calculated_at: string
}

export interface AdminReservesOverview {
  total_reserved: number
  providers_with_reserves: number
  active_reserves: number
  partially_released: number
  expired_reserves: number
  cancelled_reserves: number
  released_reserves: number
  reserves_near_expiry: number
  total_ever_reserved: number
  total_ever_released: number
  by_currency: Record<string, { total_reserved: number; active_count: number }>
  simulation_only: boolean
  calculated_at: string
}

// ── Funciones ────────────────────────────────────────────────────────────────

/**
 * Simula el movimiento de pending → available sin dinero real.
 * Solo admin. Usado para setup de tests y demos.
 */
export async function simMakeAvailable(
  actorId: string,
  currency = 'EUR',
  amount: number | null = null,
  correlationId: string | null = null
): Promise<SimMakeAvailableResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_sim_make_available', {
    p_actor_id:      actorId,
    p_currency:      currency,
    p_amount:        amount,
    p_correlation:   correlationId,
  })
  if (error) throw new Error(`simMakeAvailable: ${error.message}`)
  return data as SimMakeAvailableResult
}

/**
 * Dry-run de una reserva. No persiste nada.
 * Retorna teb_unchanged=true si el invariante se cumple (siempre debería).
 */
export async function previewReserve(params: {
  actorId: string
  currency?: string
  amount?: number | null
  reserveType?: ReserveType
  sourceBucket?: SourceBucket
}): Promise<ReservePreview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_preview_reserve', {
    p_actor_id:     params.actorId,
    p_currency:     params.currency     ?? 'EUR',
    p_amount:       params.amount       ?? null,
    p_reserve_type: params.reserveType  ?? 'manual',
    p_source_bucket: params.sourceBucket ?? 'available',
  })
  if (error) throw new Error(`previewReserve: ${error.message}`)
  return data as ReservePreview
}

/**
 * Crea una reserva de simulación. Solo admin.
 * Idempotente por idempotency_key.
 * Lanza NO_FUNDS_IN_SOURCE_BUCKET si el bucket no tiene fondos.
 * Lanza AMOUNT_EXCEEDS_SOURCE si el monto supera el bucket.
 */
export async function createSimulationReserve(params: {
  actorId: string
  currency?: string
  amount?: number | null
  reserveType?: ReserveType
  reason?: string
  reasonCode?: string | null
  sourceBucket?: SourceBucket
  masterOrderId?: string | null
  supplierOrderId?: string | null
  disputeId?: string | null
  expiresAt?: string | null
  releaseAt?: string | null
  releaseConditions?: string[] | null
  idempotencyKey?: string | null
  sourceEventId?: string | null
  correlationId?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<CreateReserveResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_create_simulation_reserve', {
    p_actor_id:          params.actorId,
    p_currency:          params.currency          ?? 'EUR',
    p_amount:            params.amount            ?? null,
    p_reserve_type:      params.reserveType       ?? 'manual',
    p_reason:            params.reason            ?? null,
    p_reason_code:       params.reasonCode        ?? null,
    p_source_bucket:     params.sourceBucket      ?? 'available',
    p_master_order_id:   params.masterOrderId     ?? null,
    p_supplier_order_id: params.supplierOrderId   ?? null,
    p_dispute_id:        params.disputeId         ?? null,
    p_expires_at:        params.expiresAt         ?? null,
    p_release_at:        params.releaseAt         ?? null,
    p_release_conditions: params.releaseConditions ?? null,
    p_idempotency_key:   params.idempotencyKey    ?? null,
    p_source_event_id:   params.sourceEventId     ?? null,
    p_correlation_id:    params.correlationId     ?? null,
    p_notes:             params.notes             ?? null,
    p_metadata:          params.metadata          ?? null,
  })
  if (error) throw new Error(`createSimulationReserve: ${error.message}`)
  return data as CreateReserveResult
}

/**
 * Libera parcial o totalmente una reserva. Solo admin.
 * Idempotente por source_event_id.
 * Lanza RESERVE_TERMINAL si la reserva ya está en estado terminal.
 * Lanza AMOUNT_EXCEEDS_REMAINING si el monto supera el remaining.
 */
export async function releaseSimulationReserve(params: {
  reserveId: string
  amount?: number | null
  sourceEventId?: string | null
  correlationId?: string | null
}): Promise<ReleaseReserveResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_release_simulation_reserve', {
    p_reserve_id:      params.reserveId,
    p_amount:          params.amount          ?? null,
    p_source_event_id: params.sourceEventId   ?? null,
    p_correlation_id:  params.correlationId   ?? null,
  })
  if (error) throw new Error(`releaseSimulationReserve: ${error.message}`)
  return data as ReleaseReserveResult
}

/**
 * Cancela una reserva activa o parcialmente liberada. Solo admin.
 * Emite RESERVE_RELEASE por el remaining en el ledger.
 * Lanza RESERVE_TERMINAL si ya está en estado terminal.
 */
export async function cancelSimulationReserve(params: {
  reserveId: string
  reason?: string | null
  correlationId?: string | null
}): Promise<CancelReserveResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_cancel_simulation_reserve', {
    p_reserve_id:     params.reserveId,
    p_reason:         params.reason         ?? null,
    p_correlation_id: params.correlationId  ?? null,
  })
  if (error) throw new Error(`cancelSimulationReserve: ${error.message}`)
  return data as CancelReserveResult
}

/**
 * Procesa en batch todas las reservas expiradas (expires_at <= now()).
 * Solo admin. Idempotente (SKIP LOCKED).
 */
export async function processExpiredSimulationReserves(
  currency: string | null = null
): Promise<{ processed: number; reserve_ids: string[]; processed_at: string }> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_process_expired_simulation_reserves', {
    p_currency: currency,
  })
  if (error) throw new Error(`processExpiredSimulationReserves: ${error.message}`)
  return data
}

/**
 * Retorna los datos completos de una reserva por ID.
 * El proveedor solo puede ver sus propias reservas (RLS).
 */
export async function getReserve(reserveId: string): Promise<ReserveDetail> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_reserve', {
    p_reserve_id: reserveId,
  })
  if (error) throw new Error(`getReserve: ${error.message}`)
  return data as ReserveDetail
}

/**
 * Lista las reservas de un proveedor con paginación.
 */
export async function listProviderReserves(
  actorId: string,
  limit = 20,
  offset = 0
): Promise<ReserveListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_provider_reserves', {
    p_actor_id: actorId,
    p_limit:    limit,
    p_offset:   offset,
  })
  if (error) throw new Error(`listProviderReserves: ${error.message}`)
  return data as ReserveListResult
}

/**
 * Lista todas las reservas del sistema. Solo admin.
 * Filtrable por status y currency.
 */
export async function listAdminReserves(params?: {
  status?: ReserveStatus | null
  currency?: string | null
  limit?: number
  offset?: number
}): Promise<AdminReserveListResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_admin_reserves', {
    p_status:   params?.status   ?? null,
    p_currency: params?.currency ?? null,
    p_limit:    params?.limit    ?? 50,
    p_offset:   params?.offset   ?? 0,
  })
  if (error) throw new Error(`listAdminReserves: ${error.message}`)
  return data as AdminReserveListResult
}

/**
 * Resumen de aging de reservas activas de un proveedor.
 * Agrupa por antigüedad: 0-7, 8-30, 31-60, 61-90, 90+ días.
 */
export async function getReserveAgingSummary(
  actorId: string,
  currency = 'EUR'
): Promise<ReserveAgingSummary> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_reserve_aging_summary', {
    p_actor_id: actorId,
    p_currency: currency,
  })
  if (error) throw new Error(`getReserveAgingSummary: ${error.message}`)
  return data as ReserveAgingSummary
}

/**
 * KPIs globales de reservas para el panel admin.
 * Desglose por currency, estado y conteo near-expiry.
 */
export async function getAdminReservesOverview(): Promise<AdminReservesOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_admin_reserves_overview')
  if (error) throw new Error(`getAdminReservesOverview: ${error.message}`)
  return data as AdminReservesOverview
}
