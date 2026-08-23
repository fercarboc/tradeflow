/**
 * MP-FIN-2C — Dispute Service
 *
 * DISPUTE ≠ REFUND. Entidad separada con estado propio.
 * Aislamiento por proveedor: chargeback en A no afecta B ni C.
 * simulation_only = true (STRIPE_GATE cerrado).
 *
 * Ledger entries de chargebacks:
 *   CHARGEBACK_DEBIT  (neg) — lost / accepted
 *   CHARGEBACK_FEE    (neg) — fee opcional (STRIPE_GATE configurable)
 *   CHARGEBACK_CREDIT (pos) — won tras previo LOST (reversal)
 *
 * State machine:
 *   opened → needs_response | under_review | won | lost | accepted | cancelled
 *   needs_response → evidence_submitted → under_review → won | lost | cancelled
 *   lost → won (reversal post-chargeback) | closed
 *   won | accepted | cancelled → closed
 *
 * LEGAL_GATE: responsibility configurable, nunca hardcodeado.
 */

import { supabase } from '../../supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────

export type DisputeStatus =
  | 'opened'
  | 'needs_response'
  | 'evidence_submitted'
  | 'under_review'
  | 'won'
  | 'lost'
  | 'accepted'
  | 'cancelled'
  | 'closed'

export type DisputeOutcome = 'won' | 'lost' | 'accepted' | 'cancelled'

export type DisputeResponsibility =
  | 'provider'
  | 'platform'
  | 'buyer'
  | 'undetermined'
  | 'shared'

export type EvidenceType =
  | 'invoice'
  | 'delivery_proof'
  | 'tracking'
  | 'conversation'
  | 'acceptance'
  | 'pod'
  | 'photo'
  | 'conditions'
  | 'other'

export interface CreateDisputeResult {
  status: 'created' | 'replayed'
  dispute_id: string
  dispute_number: string
  supplier_order_id: string
  master_order_id: string
  provider_actor_id: string
  amount: number
  responsibility: DisputeResponsibility
  dispute_status: DisputeStatus
  exposure_at_open: number
  simulation_only: boolean
  correlation_id: string
}

export interface DisputeExposure {
  supplier_order_id: string
  currency: string
  original_goods_gross: number
  original_shipping_gross: number
  original_total_gross: number
  refunded_gross: number
  chargebacks_debit_gross: number
  chargebacks_credit_gross: number
  chargebacks_net_impact: number
  open_disputes_amount: number
  disputable_exposure: number
  current_economic_position: number
}

export interface DisputeOutcomePreview {
  dispute_id: string
  dispute_number: string
  current_status: DisputeStatus
  simulated_outcome: string
  dispute_amount: number
  disputable_exposure: number
  chargeback_debit: number
  chargeback_fee: number
  chargeback_credit: number
  net_economic_impact: number
  chargeback_was_posted: boolean
  simulation_only: boolean
  stripe_gate: string
}

export interface AddEvidenceResult {
  evidence_id: string
  dispute_id: string
  evidence_type: EvidenceType
  dispute_status: DisputeStatus
}

export interface SimulateOutcomeResult {
  status: 'done' | 'replayed'
  dispute_id: string
  dispute_number?: string
  dispute_status: DisputeStatus
  outcome: DisputeOutcome | null
  chargeback_posted?: boolean
  chargeback_reversed?: boolean
  chargeback_amount?: number | null
  chargeback_fee_amount?: number
  simulation_only?: boolean
}

export interface DisputeEvidence {
  id: string
  evidence_type: EvidenceType
  description: string | null
  storage_path: string | null
  document_reference: string | null
  submitted_at: string
}

export interface DisputeDetail {
  dispute_id: string
  dispute_number: string
  master_order_id: string
  supplier_order_id: string
  provider_actor_id: string
  currency: string
  amount: number
  reason: string | null
  reason_code: string | null
  status: DisputeStatus
  responsibility: DisputeResponsibility
  outcome: DisputeOutcome | null
  chargeback_posted: boolean
  chargeback_amount: number | null
  chargeback_fee: number
  chargeback_reversed: boolean
  simulation_only: boolean
  opened_at: string
  evidence_due_at: string | null
  submitted_at: string | null
  resolved_at: string | null
  closed_at: string | null
  correlation_id: string | null
  evidence: DisputeEvidence[]
}

export interface SupplierDisputeListItem {
  dispute_id: string
  dispute_number: string
  supplier_order_id: string
  amount: number
  currency: string
  status: DisputeStatus
  responsibility: DisputeResponsibility
  outcome: DisputeOutcome | null
  chargeback_posted: boolean
  opened_at: string
  resolved_at: string | null
}

export interface AdminDisputesOverview {
  total_disputes: number
  open_disputes: number
  total_disputed_amount: number
  chargebacks_net_impact: number
  by_status: Record<DisputeStatus, number>
  by_responsibility: Record<DisputeResponsibility, number>
  calculated_at: string
}

// ── Funciones principales ──────────────────────────────────────────────────

/**
 * Devuelve la exposición disputable restante para un supplier order.
 * original − refunds − chargebacks_netos − disputes_abiertos_sin_CB
 */
export async function getDisputeExposure(
  supplierOrderId: string
): Promise<DisputeExposure> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_dispute_exposure', {
    p_supplier_order_id: supplierOrderId,
  })
  if (error) throw new Error(`getDisputeExposure: ${error.message}`)
  return data as DisputeExposure
}

/**
 * Calcula el impacto económico de un outcome sin crear el dispute.
 */
export async function previewDisputeOutcome(
  disputeId: string,
  outcome: string,
  chargebackFee = 0
): Promise<DisputeOutcomePreview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_preview_dispute_outcome', {
    p_dispute_id:     disputeId,
    p_outcome:        outcome,
    p_chargeback_fee: chargebackFee,
  })
  if (error) throw new Error(`previewDisputeOutcome: ${error.message}`)
  return data as DisputeOutcomePreview
}

/**
 * Crea un dispute. Sin entrada ledger en apertura (solo al resolver).
 * Idempotente por idempotency_key o source_event_id.
 * Aislamiento por proveedor: la exposición se calcula solo para el supplier_order indicado.
 */
export async function createDispute(params: {
  supplierOrderId: string
  amount: number
  reason?: string
  reasonCode?: string
  responsibility?: DisputeResponsibility
  evidenceDueAt?: string
  externalDisputeId?: string
  externalPaymentId?: string
  idempotencyKey?: string
  sourceEventId?: string
  correlationId?: string
  metadata?: Record<string, unknown>
}): Promise<CreateDisputeResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_create_dispute', {
    p_supplier_order_id:   params.supplierOrderId,
    p_amount:              params.amount,
    p_reason:              params.reason              ?? null,
    p_reason_code:         params.reasonCode          ?? null,
    p_responsibility:      params.responsibility      ?? 'undetermined',
    p_evidence_due_at:     params.evidenceDueAt       ?? null,
    p_external_dispute_id: params.externalDisputeId   ?? null,
    p_external_payment_id: params.externalPaymentId   ?? null,
    p_idempotency_key:     params.idempotencyKey      ?? null,
    p_source_event_id:     params.sourceEventId       ?? null,
    p_correlation_id:      params.correlationId       ?? null,
    p_metadata:            params.metadata            ?? null,
  })
  if (error) throw new Error(`createDispute: ${error.message}`)
  return data as CreateDisputeResult
}

/**
 * Añade evidencia a un dispute. Avanza a evidence_submitted si aplica.
 * Rechaza si el dispute está en estado terminal.
 */
export async function addDisputeEvidence(params: {
  disputeId: string
  evidenceType: EvidenceType
  description?: string
  storagePath?: string
  documentReference?: string
}): Promise<AddEvidenceResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_add_dispute_evidence', {
    p_dispute_id:         params.disputeId,
    p_evidence_type:      params.evidenceType,
    p_description:        params.description        ?? null,
    p_storage_path:       params.storagePath        ?? null,
    p_document_reference: params.documentReference  ?? null,
  })
  if (error) throw new Error(`addDisputeEvidence: ${error.message}`)
  return data as AddEvidenceResult
}

/**
 * Transiciona el estado del dispute y posta entradas ledger según outcome.
 * LOST/ACCEPTED → CHARGEBACK_DEBIT + opcional CHARGEBACK_FEE
 * WON (post-LOST) → CHARGEBACK_CREDIT (reversal del DEBIT previo)
 * WON (sin LOST) | CANCELLED | CLOSED → sin entrada ledger
 * Idempotente por source_event_id.
 */
export async function simulateDisputeOutcome(params: {
  disputeId: string
  outcome: string
  chargebackFee?: number
  sourceEventId?: string
  correlationId?: string
}): Promise<SimulateOutcomeResult> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_simulate_dispute_outcome', {
    p_dispute_id:      params.disputeId,
    p_outcome:         params.outcome,
    p_chargeback_fee:  params.chargebackFee  ?? 0,
    p_source_event_id: params.sourceEventId  ?? null,
    p_correlation_id:  params.correlationId  ?? null,
  })
  if (error) throw new Error(`simulateDisputeOutcome: ${error.message}`)
  return data as SimulateOutcomeResult
}

/**
 * Devuelve el detalle de un dispute con sus evidencias.
 * RLS: proveedor ve solo sus disputes; admin ve todos.
 */
export async function getDispute(disputeId: string): Promise<DisputeDetail> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_dispute', {
    p_dispute_id: disputeId,
  })
  if (error) throw new Error(`getDispute: ${error.message}`)
  return data as DisputeDetail
}

/**
 * Lista los disputes de un proveedor con paginación.
 */
export async function listSupplierDisputes(
  providerActorId: string,
  limit = 20,
  offset = 0
): Promise<SupplierDisputeListItem[]> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_list_supplier_disputes', {
    p_provider_actor_id: providerActorId,
    p_limit:             limit,
    p_offset:            offset,
  })
  if (error) throw new Error(`listSupplierDisputes: ${error.message}`)
  return (data ?? []) as SupplierDisputeListItem[]
}

/**
 * KPIs de disputes globales. Solo platform_admin.
 */
export async function getAdminDisputesOverview(): Promise<AdminDisputesOverview> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_admin_disputes_overview')
  if (error) throw new Error(`getAdminDisputesOverview: ${error.message}`)
  return data as AdminDisputesOverview
}
