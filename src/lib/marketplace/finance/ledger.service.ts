// Ledger Service — MP-FIN-1A
// INV-009: solo append. NUNCA update/delete.
// La lógica de negocio del ledger no vive en componentes UI.

import { supabase } from '../../supabase'
import type { LedgerEntry, LedgerAppendParams, LedgerBalance } from './types/ledger.types'

// ── Append (única operación de escritura permitida) ──────────────────────────

export async function ledgerAppend(params: LedgerAppendParams): Promise<LedgerEntry> {
  const { data, error } = await supabase.rpc('mkt_fin_ledger_append', {
    p_entry_type:        params.entryType,
    p_amount:            params.amount,
    p_master_order_id:   params.masterOrderId ?? null,
    p_supplier_order_id: params.supplierOrderId ?? null,
    p_actor_id:          params.actorId ?? null,
    p_description:       params.description ?? null,
    p_correlation_id:    params.correlationId ?? null,
    p_source_event_id:   params.sourceEventId ?? null,
    p_compensates_id:    params.compensatesEntryId ?? null,
    p_external_provider: params.externalProvider ?? 'simulation',
    p_external_id:       params.externalId ?? null,
    p_external_type:     params.externalType ?? null,
    p_currency:          params.currency ?? 'EUR',
    p_status:            params.status ?? 'confirmed',
    p_occurred_at:       params.occurredAt ?? null,
  })

  if (error) throw new Error(`ledger_append failed: ${error.message}`)

  return mapLedgerEntry(data)
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function getLedgerBalance(params: {
  masterOrderId?: string
  actorId?: string
}): Promise<LedgerBalance> {
  const { data, error } = await supabase.rpc('mkt_fin_ledger_balance', {
    p_master_order_id: params.masterOrderId ?? null,
    p_actor_id:        params.actorId ?? null,
  })

  if (error) throw new Error(`ledger_balance failed: ${error.message}`)

  return {
    totalAmount:             data.total_amount ?? 0,
    byType:                  data.by_type ?? {},
    entriesCount:            data.entries_count ?? 0,
    confirmedAmount:         data.confirmed_amount ?? 0,
    pendingAmount:           data.pending_amount ?? 0,
    gmvGoodsEntitlement:     data.gmv_goods_entitlement ?? 0,
    gmvShippingEntitlement:  data.gmv_shipping_entitlement ?? 0,
    commissionAccrued:       data.commission_accrued ?? 0,
    simCommission:           data.sim_commission ?? 0,
  }
}

export async function getLedgerEntriesForActor(
  actorId: string,
  limit = 50,
  offset = 0
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('trade_marketplace_ledger_entries')
    .select('*')
    .eq('actor_id', actorId)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`getLedgerEntriesForActor failed: ${error.message}`)

  return (data ?? []).map(mapLedgerEntry)
}

export async function getLedgerEntriesForMasterOrder(
  masterOrderId: string
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('trade_marketplace_ledger_entries')
    .select('*')
    .eq('master_order_id', masterOrderId)
    .order('occurred_at', { ascending: true })

  if (error) throw new Error(`getLedgerEntriesForMasterOrder failed: ${error.message}`)

  return (data ?? []).map(mapLedgerEntry)
}

// ── Mapeo BD → TS ─────────────────────────────────────────────────────────────

function mapLedgerEntry(row: Record<string, unknown>): LedgerEntry {
  return {
    id:                   row.id as string,
    entryType:            row.entry_type as LedgerEntry['entryType'],
    amount:               Number(row.amount),
    currency:             (row.currency as string) ?? 'EUR',
    status:               (row.status as LedgerEntry['status']) ?? 'confirmed',
    masterOrderId:        (row.master_order_id as string) ?? null,
    supplierOrderId:      (row.supplier_order_id as string) ?? null,
    actorId:              (row.actor_id as string) ?? null,
    settlementId:         (row.settlement_id as string) ?? null,
    refundId:             (row.refund_id as string) ?? null,
    disputeId:            (row.dispute_id as string) ?? null,
    description:          (row.description as string) ?? null,
    correlationId:        (row.correlation_id as string) ?? null,
    sourceEventId:        (row.source_event_id as string) ?? null,
    compensatesEntryId:   (row.compensates_entry_id as string) ?? null,
    externalProvider:     (row.external_provider as string) ?? 'simulation',
    externalId:           (row.external_id as string) ?? null,
    externalType:         (row.external_type as string) ?? null,
    occurredAt:           row.occurred_at as string,
    createdAt:            row.created_at as string,
  }
}
