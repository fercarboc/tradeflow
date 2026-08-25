/**
 * MP-FIN-3 — Admin Finance Service
 *
 * Fachada de lecturas para el panel Admin Marketplace Finance.
 * NO contiene lógica financiera — visualización y orquestación únicamente.
 * La fuente de verdad es el ledger; los balances son proyecciones rebuildables.
 *
 * Importa los servicios de dominio existentes para evitar duplicar RPCs.
 * Añade helpers de lectura específicos de Admin que requieren acceso a tablas.
 */

import { supabase } from '../../supabase'
import { getAdminBalancesOverview } from './balance.service'
import { getAdminRefundsOverview } from './refund.service'
import { getAdminDisputesOverview } from './dispute.service'
import { getAdminNegativeOverview } from './recovery.service'
import { getAdminSettlementsOverview } from './settlement.service'
import type { AdminBalancesOverview } from './balance.service'
import type { AdminRefundsOverview } from './refund.service'
import type { AdminDisputesOverview } from './dispute.service'
import type { AdminNegativeOverview } from './recovery.service'
import type { AdminSettlementsOverview } from './settlement.service'

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface AdminFinanceOverview {
  balances: AdminBalancesOverview | null
  refunds: AdminRefundsOverview | null
  disputes: AdminDisputesOverview | null
  negative: AdminNegativeOverview | null
  settlements: AdminSettlementsOverview | null
  // Totales agregados de master orders
  gmv_total: number
  master_orders_count: number
  supplier_orders_count: number
  providers_with_activity: number
  calculated_at: string
}

export interface AdminMasterOrderRow {
  id: string
  numero: string
  checkout_key: string
  org_id: string | null
  order_status: string
  payment_status: string
  goods_gross_total: number
  shipping_gross_total: number
  checkout_gross_total: number
  refund_gross_total: number
  currency: string
  supplier_orders_count: number
  created_at: string
  confirmed_at: string | null
}

export interface AdminMasterOrdersResult {
  items: AdminMasterOrderRow[]
  total: number
}

export interface AdminSupplierOrderRow {
  id: string
  numero: string
  master_order_id: string | null
  master_numero: string | null
  actor_id: string
  actor_nombre: string | null
  estado: string
  payment_status: string
  subtotal: number
  coste_envio: number
  total: number
  goods_gross_snapshot: number | null
  shipping_gross_snapshot: number | null
  currency: string
  created_at: string
}

export interface AdminSupplierOrdersResult {
  items: AdminSupplierOrderRow[]
  total: number
}

export interface AdminProviderRow {
  actor_id: string
  nombre: string
  slug: string
  estado: string
  verificado: boolean
  country: string | null
  pending_amount: number
  available_amount: number
  reserved_amount: number
  negative_amount: number
  historical_settled: number
  total_economic_balance: number
  has_balance: boolean
}

export interface AdminLedgerRow {
  id: string
  entry_type: string
  amount: number
  currency: string
  actor_id: string | null
  actor_nombre: string | null
  master_order_id: string | null
  supplier_order_id: string | null
  description: string | null
  status: string
  source_event_id: string | null
  correlation_id: string | null
  external_provider: string | null
  settlement_id: string | null
  refund_id: string | null
  dispute_id: string | null
  reserve_id: string | null
  recovery_id: string | null
  occurred_at: string
  created_at: string
}

export interface AdminLedgerResult {
  items: AdminLedgerRow[]
  total: number
}

export interface AdminDisputeRow {
  id: string
  dispute_number: string
  supplier_order_id: string
  master_order_id: string | null
  provider_actor_id: string
  actor_nombre: string | null
  currency: string
  amount: number
  reason: string | null
  status: string
  responsibility: string
  outcome: string | null
  chargeback_posted: boolean
  chargeback_amount: number | null
  simulation_only: boolean
  opened_at: string
  evidence_due_at: string | null
  resolved_at: string | null
}

export interface AdminDisputesResult {
  items: AdminDisputeRow[]
  total: number
}

// ── Overview combinado ──────────────────────────────────────────────────────

export async function getAdminFinanceOverview(): Promise<AdminFinanceOverview> {
  const [balances, refunds, disputes, negative, settlements, ordersRes] = await Promise.allSettled([
    getAdminBalancesOverview(),
    getAdminRefundsOverview(),
    getAdminDisputesOverview(),
    getAdminNegativeOverview(),
    getAdminSettlementsOverview(),
    supabase
      .from('trade_marketplace_master_orders')
      .select('id, checkout_gross_total', { count: 'exact' })
      .limit(1000),
  ])

  const ordersData = ordersRes.status === 'fulfilled' ? ordersRes.value : null
  const orders = ordersData?.data ?? []
  const gmvTotal = orders.reduce((s: number, o: { checkout_gross_total: number }) => s + (o.checkout_gross_total ?? 0), 0)

  const { data: soCountData } = await supabase
    .from('trade_marketplace_orders')
    .select('id', { count: 'exact', head: true })

  const { data: actorsData } = await supabase
    .from('trade_marketplace_balances')
    .select('actor_id')

  return {
    balances:               balances.status === 'fulfilled' ? balances.value : null,
    refunds:                refunds.status === 'fulfilled' ? refunds.value : null,
    disputes:               disputes.status === 'fulfilled' ? disputes.value : null,
    negative:               negative.status === 'fulfilled' ? negative.value : null,
    settlements:            settlements.status === 'fulfilled' ? settlements.value : null,
    gmv_total:              gmvTotal,
    master_orders_count:    ordersData?.count ?? 0,
    supplier_orders_count:  (soCountData as unknown as { count?: number })?.count ?? 0,
    providers_with_activity: actorsData?.length ?? 0,
    calculated_at:          new Date().toISOString(),
  }
}

// ── Master Orders ──────────────────────────────────────────────────────────

export async function getAdminMasterOrders(params?: {
  limit?: number
  offset?: number
  search?: string
}): Promise<AdminMasterOrdersResult> {
  const limit = params?.limit ?? 25
  const offset = params?.offset ?? 0

  let q = supabase
    .from('trade_marketplace_master_orders')
    .select('id, numero, checkout_key, org_id, order_status, payment_status, goods_gross_total, shipping_gross_total, checkout_gross_total, refund_gross_total, currency, created_at, confirmed_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params?.search) {
    q = q.ilike('numero', `%${params.search}%`)
  }

  const { data, error, count } = await q
  if (error) throw new Error(`getAdminMasterOrders: ${error.message}`)

  const masterOrderIds = (data ?? []).map((r: { id: string }) => r.id)
  let soCountMap: Record<string, number> = {}

  if (masterOrderIds.length > 0) {
    const { data: soData } = await supabase
      .from('trade_marketplace_orders')
      .select('master_order_id')
      .in('master_order_id', masterOrderIds)

    if (soData) {
      for (const row of soData as { master_order_id: string }[]) {
        soCountMap[row.master_order_id] = (soCountMap[row.master_order_id] ?? 0) + 1
      }
    }
  }

  const items: AdminMasterOrderRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:                   r.id as string,
    numero:               r.numero as string,
    checkout_key:         r.checkout_key as string,
    org_id:               r.org_id as string | null,
    order_status:         r.order_status as string,
    payment_status:       r.payment_status as string,
    goods_gross_total:    Number(r.goods_gross_total ?? 0),
    shipping_gross_total: Number(r.shipping_gross_total ?? 0),
    checkout_gross_total: Number(r.checkout_gross_total ?? 0),
    refund_gross_total:   Number(r.refund_gross_total ?? 0),
    currency:             r.currency as string,
    supplier_orders_count: soCountMap[r.id as string] ?? 0,
    created_at:           r.created_at as string,
    confirmed_at:         r.confirmed_at as string | null,
  }))

  return { items, total: count ?? 0 }
}

// ── Supplier Orders ────────────────────────────────────────────────────────

export async function getAdminSupplierOrders(params?: {
  masterOrderId?: string
  actorId?: string
  limit?: number
  offset?: number
}): Promise<AdminSupplierOrdersResult> {
  const limit = params?.limit ?? 25
  const offset = params?.offset ?? 0

  let q = supabase
    .from('trade_marketplace_orders')
    .select(`
      id, numero, master_order_id, actor_id, estado, payment_status,
      subtotal, coste_envio, total, goods_gross_snapshot, shipping_gross_snapshot, currency, created_at,
      trade_marketplace_actors!actor_id(nombre),
      trade_marketplace_master_orders!master_order_id(numero)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params?.masterOrderId) q = q.eq('master_order_id', params.masterOrderId)
  if (params?.actorId) q = q.eq('actor_id', params.actorId)

  const { data, error, count } = await q
  if (error) throw new Error(`getAdminSupplierOrders: ${error.message}`)

  const items: AdminSupplierOrderRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const actor = (r.trade_marketplace_actors as Record<string, unknown> | null)
    const master = (r.trade_marketplace_master_orders as Record<string, unknown> | null)
    return {
      id:                   r.id as string,
      numero:               r.numero as string,
      master_order_id:      r.master_order_id as string | null,
      master_numero:        master ? (master.numero as string) : null,
      actor_id:             r.actor_id as string,
      actor_nombre:         actor ? (actor.nombre as string) : null,
      estado:               r.estado as string,
      payment_status:       r.payment_status as string,
      subtotal:             Number(r.subtotal ?? 0),
      coste_envio:          Number(r.coste_envio ?? 0),
      total:                Number(r.total ?? 0),
      goods_gross_snapshot: r.goods_gross_snapshot != null ? Number(r.goods_gross_snapshot) : null,
      shipping_gross_snapshot: r.shipping_gross_snapshot != null ? Number(r.shipping_gross_snapshot) : null,
      currency:             r.currency as string,
      created_at:           r.created_at as string,
    }
  })

  return { items, total: count ?? 0 }
}

// ── Providers ──────────────────────────────────────────────────────────────

export async function getAdminProvidersList(): Promise<AdminProviderRow[]> {
  const { data: actors, error: actorErr } = await supabase
    .from('trade_marketplace_actors')
    .select('id, nombre, slug, estado, verificado, country')
    .in('actor_type', ['provider', 'supplier'])
    .order('nombre')

  if (actorErr) throw new Error(`getAdminProvidersList actors: ${actorErr.message}`)

  const { data: balances } = await supabase
    .from('trade_marketplace_balances')
    .select('actor_id, currency, pending_amount, available_amount, reserved_amount, negative_amount, historical_settled, total_economic_balance')
    .eq('currency', 'EUR')

  const balanceMap = new Map<string, Record<string, number>>()
  for (const b of (balances ?? []) as Record<string, unknown>[]) {
    balanceMap.set(b.actor_id as string, {
      pending_amount: Number(b.pending_amount ?? 0),
      available_amount: Number(b.available_amount ?? 0),
      reserved_amount: Number(b.reserved_amount ?? 0),
      negative_amount: Number(b.negative_amount ?? 0),
      historical_settled: Number(b.historical_settled ?? 0),
      total_economic_balance: Number(b.total_economic_balance ?? 0),
    })
  }

  return (actors ?? []).map((a: Record<string, unknown>) => {
    const b = balanceMap.get(a.id as string)
    return {
      actor_id:               a.id as string,
      nombre:                 a.nombre as string,
      slug:                   a.slug as string,
      estado:                 a.estado as string,
      verificado:             Boolean(a.verificado),
      country:                a.country as string | null,
      pending_amount:         b?.pending_amount ?? 0,
      available_amount:       b?.available_amount ?? 0,
      reserved_amount:        b?.reserved_amount ?? 0,
      negative_amount:        b?.negative_amount ?? 0,
      historical_settled:     b?.historical_settled ?? 0,
      total_economic_balance: b?.total_economic_balance ?? 0,
      has_balance:            !!b,
    }
  })
}

// ── Global Ledger ──────────────────────────────────────────────────────────

export async function getAdminLedger(params?: {
  actorId?: string
  entryType?: string
  currency?: string
  limit?: number
  offset?: number
  search?: string
}): Promise<AdminLedgerResult> {
  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0

  let q = supabase
    .from('trade_marketplace_ledger_entries')
    .select(`
      id, entry_type, amount, currency, actor_id, master_order_id, supplier_order_id,
      description, status, source_event_id, correlation_id, external_provider,
      settlement_id, refund_id, dispute_id, reserve_id, recovery_id,
      occurred_at, created_at,
      trade_marketplace_actors!actor_id(nombre)
    `, { count: 'exact' })
    .neq('status', 'failed')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params?.actorId) q = q.eq('actor_id', params.actorId)
  if (params?.entryType) q = q.eq('entry_type', params.entryType)
  if (params?.currency) q = q.eq('currency', params.currency)

  const { data, error, count } = await q
  if (error) throw new Error(`getAdminLedger: ${error.message}`)

  const items: AdminLedgerRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const actor = r.trade_marketplace_actors as Record<string, unknown> | null
    return {
      id:                r.id as string,
      entry_type:        r.entry_type as string,
      amount:            Number(r.amount ?? 0),
      currency:          r.currency as string,
      actor_id:          r.actor_id as string | null,
      actor_nombre:      actor ? (actor.nombre as string) : null,
      master_order_id:   r.master_order_id as string | null,
      supplier_order_id: r.supplier_order_id as string | null,
      description:       r.description as string | null,
      status:            r.status as string,
      source_event_id:   r.source_event_id as string | null,
      correlation_id:    r.correlation_id as string | null,
      external_provider: r.external_provider as string | null,
      settlement_id:     r.settlement_id as string | null,
      refund_id:         r.refund_id as string | null,
      dispute_id:        r.dispute_id as string | null,
      reserve_id:        r.reserve_id as string | null,
      recovery_id:       r.recovery_id as string | null,
      occurred_at:       r.occurred_at as string,
      created_at:        r.created_at as string,
    }
  })

  return { items, total: count ?? 0 }
}

// ── Disputes (admin list) ──────────────────────────────────────────────────

export async function getAdminDisputes(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<AdminDisputesResult> {
  const limit = params?.limit ?? 25
  const offset = params?.offset ?? 0

  let q = supabase
    .from('trade_marketplace_disputes')
    .select(`
      id, dispute_number, supplier_order_id, master_order_id, provider_actor_id,
      currency, amount, reason, status, responsibility, outcome,
      chargeback_posted, chargeback_amount, simulation_only,
      opened_at, evidence_due_at, resolved_at,
      trade_marketplace_actors!provider_actor_id(nombre)
    `, { count: 'exact' })
    .order('opened_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params?.status) q = q.eq('status', params.status)

  const { data, error, count } = await q
  if (error) throw new Error(`getAdminDisputes: ${error.message}`)

  const items: AdminDisputeRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const actor = r.trade_marketplace_actors as Record<string, unknown> | null
    return {
      id:                  r.id as string,
      dispute_number:      r.dispute_number as string,
      supplier_order_id:   r.supplier_order_id as string,
      master_order_id:     r.master_order_id as string | null,
      provider_actor_id:   r.provider_actor_id as string,
      actor_nombre:        actor ? (actor.nombre as string) : null,
      currency:            r.currency as string,
      amount:              Number(r.amount ?? 0),
      reason:              r.reason as string | null,
      status:              r.status as string,
      responsibility:      r.responsibility as string,
      outcome:             r.outcome as string | null,
      chargeback_posted:   Boolean(r.chargeback_posted),
      chargeback_amount:   r.chargeback_amount != null ? Number(r.chargeback_amount) : null,
      simulation_only:     Boolean(r.simulation_only),
      opened_at:           r.opened_at as string,
      evidence_due_at:     r.evidence_due_at as string | null,
      resolved_at:         r.resolved_at as string | null,
    }
  })

  return { items, total: count ?? 0 }
}
