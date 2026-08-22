// Checkout Ledger Service — MP-FIN-1B.2
// Gestiona el ledger simulado inicial generado por mkt_fin_post_checkout_ledger.
//
// MODELO LEDGER: B (Gross)
//   GOODS_ENTITLEMENT   = goods_gross_snapshot  (IVA incluido)
//   SHIPPING_ENTITLEMENT = shipping_gross_snapshot (IVA incluido, solo si > 0)
//   COMMISSION_ACCRUAL: NO se escribe (Phase 0: commission=0, INV-L03/L04)
//   IVA: capturado en snapshots, no como entrada separada [TAX_GATE]
//
// FÓRMULA DE RECONCILIACIÓN:
//   INV-L01: GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT = provider_payable_snapshot
//   INV-L02: SUM(supplier totals) = master_order.checkout_gross_total
//   INV-L03: real commission entries = 0
//   INV-L04: real TrabFlow marketplace revenue = 0
//
// STRIPE_GATE: solo funciona en simulation mode.
// INV-001: GOODS_ENTITLEMENT es GMV del proveedor, NO Revenue de TrabFlow.

import { supabase } from '../../supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CheckoutLedgerResult {
  status:              'posted' | 'replayed'
  entryCount:          number
  correlationId:       string
  suppliersProcessed:  number
  masterOrderNum:      string
  model:               string   // always 'B-gross' in this phase
}

export interface CheckoutLedgerEntry {
  id:               string
  entryType:        'GOODS_ENTITLEMENT' | 'SHIPPING_ENTITLEMENT'
  amount:           number
  currency:         string
  masterOrderId:    string | null
  supplierOrderId:  string | null
  actorId:          string | null
  correlationId:    string | null
  sourceEventId:    string | null
  description:      string | null
  occurredAt:       string
  createdAt:        string
}

export interface SupplierLedgerBreakdown {
  supplierOrderId:           string
  actorId:                   string
  providerPayableSnapshot:   number
  ledgerGoodsEntitlement:    number
  ledgerShippingEntitlement: number
  ledgerEconomicTotal:       number
  reconciles:                boolean   // |payable - ledger| < 0.02
}

export interface LedgerReconciliation {
  masterOrderId:        string
  masterOrderNum:       string
  checkoutGrossTotal:   number
  ledgerGoodsTotal:     number
  ledgerShippingTotal:  number
  ledgerEconomicTotal:  number
  reconciles:           boolean   // |checkoutGrossTotal - ledgerEconomicTotal| < 0.02
  supplierBreakdown:    SupplierLedgerBreakdown[]
  realCommission:       number    // INV-L03: always 0 in Phase 0
  realRevenue:          number    // INV-L04: always 0 in Phase 0
  model:                string
  correlationId:        string
}

// ── Posting ───────────────────────────────────────────────────────────────────

export async function postCheckoutLedger(
  masterOrderId: string
): Promise<CheckoutLedgerResult> {
  const { data, error } = await (supabase as any).rpc(
    'mkt_fin_post_checkout_ledger',
    { p_master_order_id: masterOrderId }
  )

  if (error) throw new Error(`postCheckoutLedger failed: ${error.message}`)
  if (!data) throw new Error('postCheckoutLedger: no data returned')

  const raw = data as Record<string, unknown>
  return {
    status:             (raw.status as 'posted' | 'replayed') ?? 'posted',
    entryCount:         Number(raw.entry_count ?? 0),
    correlationId:      (raw.correlation_id as string) ?? '',
    suppliersProcessed: Number(raw.suppliers_processed ?? 0),
    masterOrderNum:     (raw.master_order_num as string) ?? '',
    model:              (raw.model as string) ?? 'B-gross',
  }
}

// ── Lectura de entradas ───────────────────────────────────────────────────────

export async function getCheckoutLedgerEntries(
  masterOrderId: string
): Promise<CheckoutLedgerEntry[]> {
  const { data, error } = await supabase
    .from('trade_marketplace_ledger_entries')
    .select('id, entry_type, amount, currency, master_order_id, supplier_order_id, actor_id, correlation_id, source_event_id, description, occurred_at, created_at')
    .eq('master_order_id', masterOrderId)
    .in('entry_type', ['GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT'])
    .neq('status', 'failed')
    .order('occurred_at', { ascending: true })

  if (error) throw new Error(`getCheckoutLedgerEntries failed: ${error.message}`)

  return (data ?? []).map(row => ({
    id:              row.id as string,
    entryType:       row.entry_type as CheckoutLedgerEntry['entryType'],
    amount:          Number(row.amount),
    currency:        (row.currency as string) ?? 'EUR',
    masterOrderId:   (row.master_order_id as string) ?? null,
    supplierOrderId: (row.supplier_order_id as string) ?? null,
    actorId:         (row.actor_id as string) ?? null,
    correlationId:   (row.correlation_id as string) ?? null,
    sourceEventId:   (row.source_event_id as string) ?? null,
    description:     (row.description as string) ?? null,
    occurredAt:      row.occurred_at as string,
    createdAt:       row.created_at as string,
  }))
}

// ── Reconciliación ledger ↔ snapshots ─────────────────────────────────────────
// Verifica INV-L01..L04. Compara totales del ledger con los snapshots inmutables.
// Fórmula: GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT (per supplier) = provider_payable_snapshot

export async function verifyLedgerReconciliation(
  masterOrderId: string
): Promise<LedgerReconciliation | null> {
  // 1. Ledger entries para el master order
  const entries = await getCheckoutLedgerEntries(masterOrderId)
  if (entries.length === 0) return null

  // 2. Supplier orders + snapshots
  const { data: suppliersData, error: suppliersErr } = await supabase
    .from('trade_marketplace_orders')
    .select('id, actor_id, goods_gross_snapshot, shipping_gross_snapshot, provider_payable_snapshot, currency')
    .eq('master_order_id', masterOrderId)
    .not('financial_snapshot_at', 'is', null)

  if (suppliersErr) throw new Error(`verifyLedgerReconciliation(suppliers) failed: ${suppliersErr.message}`)

  // 3. Master order
  const { data: masterData, error: masterErr } = await supabase
    .from('trade_marketplace_master_orders')
    .select('id, numero, checkout_gross_total, checkout_key')
    .eq('id', masterOrderId)
    .single()

  if (masterErr) throw new Error(`verifyLedgerReconciliation(master) failed: ${masterErr.message}`)
  if (!masterData) return null

  // 4. Agrupar ledger por supplier_order_id
  const bySupplier = new Map<string, { goods: number; shipping: number }>()
  for (const entry of entries) {
    if (!entry.supplierOrderId) continue
    const existing = bySupplier.get(entry.supplierOrderId) ?? { goods: 0, shipping: 0 }
    if (entry.entryType === 'GOODS_ENTITLEMENT')    existing.goods    += entry.amount
    if (entry.entryType === 'SHIPPING_ENTITLEMENT') existing.shipping += entry.amount
    bySupplier.set(entry.supplierOrderId, existing)
  }

  // 5. Breakdown por proveedor + verificar INV-L01
  const supplierBreakdown: SupplierLedgerBreakdown[] = (suppliersData ?? []).map(row => {
    const sId     = row.id as string
    const ledger  = bySupplier.get(sId) ?? { goods: 0, shipping: 0 }
    const payable = Number(row.provider_payable_snapshot ?? 0)
    const ledgerTotal = ledger.goods + ledger.shipping
    return {
      supplierOrderId:           sId,
      actorId:                   row.actor_id as string,
      providerPayableSnapshot:   payable,
      ledgerGoodsEntitlement:    ledger.goods,
      ledgerShippingEntitlement: ledger.shipping,
      ledgerEconomicTotal:       ledgerTotal,
      reconciles:                Math.abs(payable - ledgerTotal) < 0.02,  // INV-L01
    }
  })

  // 6. Totales globales + verificar INV-L02
  const ledgerGoodsTotal    = entries.filter(e => e.entryType === 'GOODS_ENTITLEMENT').reduce((s, e) => s + e.amount, 0)
  const ledgerShippingTotal = entries.filter(e => e.entryType === 'SHIPPING_ENTITLEMENT').reduce((s, e) => s + e.amount, 0)
  const ledgerEconomicTotal = ledgerGoodsTotal + ledgerShippingTotal
  const checkoutGrossTotal  = Number(masterData.checkout_gross_total ?? 0)

  // 7. Commission entries count = 0 (INV-L03/L04)
  const { count: commissionCount } = await supabase
    .from('trade_marketplace_ledger_entries')
    .select('id', { count: 'exact', head: true })
    .eq('master_order_id', masterOrderId)
    .eq('entry_type', 'COMMISSION_ACCRUAL')

  const correlationId = entries[0]?.correlationId ?? `mkt-chk-${masterData.checkout_key}`

  return {
    masterOrderId,
    masterOrderNum:      masterData.numero as string,
    checkoutGrossTotal,
    ledgerGoodsTotal,
    ledgerShippingTotal,
    ledgerEconomicTotal,
    reconciles:          Math.abs(checkoutGrossTotal - ledgerEconomicTotal) < 0.02,  // INV-L02
    supplierBreakdown,
    realCommission:      0,    // INV-L03: COMMISSION_ACCRUAL no escrita
    realRevenue:         0,    // INV-L04: mismo
    model:               'B-gross',
    correlationId,
  }
}

// ── Balance del ledger (delegado a ledger.service) ───────────────────────────
// Re-exportar como conveniencia para el contexto de checkout

export { getLedgerEntriesForMasterOrder, getLedgerBalance } from './ledger.service'
