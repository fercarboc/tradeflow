// MP-FIN-4 — Provider Finance Service Facade
// Queries scoped to a single provider actor (actorId).
// All functions enforce explicit .eq('actor_id', actorId) in addition to RLS.
// ISOLATION: master order data limited to numero reference only — never exposes
// other suppliers' financial data within a multiproveedor purchase (INV-MPI-01).

import { supabase } from '../../supabase'
import type { LedgerEntry } from './types/ledger.types'
import type { LedgerEntryType } from './types/ledger.types'
import { getProviderBalance, type ProviderBalance } from './balance.service'

export type { ProviderBalance }

// ── Supplier Order types ────────────────────────────────────────────────────

export interface ProviderSupplierOrderListItem {
  id: string
  numero: string
  master_numero: string | null  // reference only — no master financials
  estado: string
  payment_status: string
  goods_gross_snapshot: number | null
  shipping_gross_snapshot: number | null
  currency: string
  created_at: string
}

export interface ProviderOrderItem {
  id: string
  producto_id: string | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  item_gross_snapshot: number | null
  currency: string
}

export interface ProviderSupplierOrderDetail extends ProviderSupplierOrderListItem {
  subtotal: number
  coste_envio: number
  total: number
  tax_rate_snapshot: number | null
  items: ProviderOrderItem[]
}

export interface ProviderSupplierOrdersResult {
  items: ProviderSupplierOrderListItem[]
  total: number
}

// ── Ledger types ─────────────────────────────────────────────────────────────

export interface ProviderLedgerResult {
  items: LedgerEntry[]
  total: number
}

// ── Humanized labels for ledger entry types (provider-facing) ─────────────────

const ENTRY_LABEL: Record<string, string> = {
  GOODS_ENTITLEMENT:          'Venta confirmada',
  SHIPPING_ENTITLEMENT:       'Portes',
  COMMISSION_ACCRUAL:         'Comisión plataforma',
  COMMISSION_TAX_ACCRUAL:     'IVA comisión',
  COMMISSION_SIM_ACCRUAL:     'Comisión (simulada)',
  COMMISSION_SIM_TAX_ACCRUAL: 'IVA comisión (simulada)',
  TRANSFER_INITIATED:         'Transferencia iniciada',
  TRANSFER_COMPLETED:         'Transferencia completada',
  TRANSFER_REVERSAL:          'Reversal transferencia',
  REFUND_TO_BUYER:            'Devolución al comprador',
  GOODS_REFUND_REVERSAL:      'Ajuste por devolución (venta)',
  SHIPPING_REFUND_REVERSAL:   'Ajuste por devolución (portes)',
  COMMISSION_REVERSAL:        'Reversal comisión',
  COMMISSION_TAX_REVERSAL:    'Reversal IVA comisión',
  CHARGEBACK_DEBIT:           'Disputa (débito)',
  CHARGEBACK_FEE:             'Tarifa de disputa',
  CHARGEBACK_CREDIT:          'Resolución disputa (crédito)',
  PSP_FEE_DEBIT:              'Tarifa pasarela',
  RESERVE_HOLD:               'Retención temporal',
  RESERVE_RELEASE:            'Liberación de retención',
  SETTLEMENT_ADJUSTMENT:      'Liquidación',
  PROVIDER_ADJUSTMENT:        'Ajuste manual',
  PLATFORM_ADJUSTMENT:        'Ajuste plataforma',
  NEGATIVE_BALANCE_RECORD:    'Saldo negativo registrado',
  BALANCE_RECOVERY:           'Recuperación de saldo',
  FUTURE_SETOFF:              'Compensación futura',
  BUYER_PAYMENT:              'Pago del comprador',
}

export function humanizeEntryType(type: LedgerEntryType | string): string {
  return ENTRY_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase()
}

// ── Supplier Orders ───────────────────────────────────────────────────────────

export async function getProviderSupplierOrders(
  actorId: string,
  limit = 20,
  offset = 0
): Promise<ProviderSupplierOrdersResult> {
  const { data, error, count } = await supabase
    .from('trade_marketplace_orders')
    .select(`
      id, numero, master_order_id, estado, payment_status,
      goods_gross_snapshot, shipping_gross_snapshot, currency, created_at,
      trade_marketplace_master_orders!master_order_id(numero)
    `, { count: 'exact' })
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`getProviderSupplierOrders: ${error.message}`)

  const items: ProviderSupplierOrderListItem[] = (data ?? []).map((r: Record<string, unknown>) => {
    const master = r.trade_marketplace_master_orders as Record<string, unknown> | null
    return {
      id:                      r.id as string,
      numero:                  r.numero as string,
      master_numero:           master ? (master.numero as string) : null,
      estado:                  r.estado as string,
      payment_status:          r.payment_status as string,
      goods_gross_snapshot:    r.goods_gross_snapshot != null ? Number(r.goods_gross_snapshot) : null,
      shipping_gross_snapshot: r.shipping_gross_snapshot != null ? Number(r.shipping_gross_snapshot) : null,
      currency:                (r.currency as string) ?? 'EUR',
      created_at:              r.created_at as string,
    }
  })

  return { items, total: count ?? 0 }
}

export async function getProviderSupplierOrderDetail(
  orderId: string,
  actorId: string
): Promise<ProviderSupplierOrderDetail> {
  // Explicit actorId filter for defense-in-depth (RLS also enforces this)
  const { data: row, error } = await supabase
    .from('trade_marketplace_orders')
    .select(`
      id, numero, master_order_id, estado, payment_status,
      subtotal, coste_envio, total,
      goods_gross_snapshot, shipping_gross_snapshot, tax_rate_snapshot,
      currency, created_at,
      trade_marketplace_master_orders!master_order_id(numero)
    `)
    .eq('id', orderId)
    .eq('actor_id', actorId)
    .single()

  if (error) throw new Error(`getProviderSupplierOrderDetail: ${error.message}`)
  if (!row) throw new Error('Order not found or access denied')

  const master = (row as Record<string, unknown>).trade_marketplace_master_orders as Record<string, unknown> | null

  // Load items — actor_id check via order FK is sufficient
  const { data: itemsData, error: itemsError } = await supabase
    .from('trade_marketplace_order_items')
    .select('id, producto_id, nombre_producto, cantidad, precio_unitario, precio_total, item_gross_snapshot, currency')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (itemsError) throw new Error(`getProviderSupplierOrderDetail items: ${itemsError.message}`)

  const items: ProviderOrderItem[] = (itemsData ?? []).map((it: Record<string, unknown>) => ({
    id:                  it.id as string,
    producto_id:         (it.producto_id as string) ?? null,
    nombre_producto:     (it.nombre_producto as string) ?? '—',
    cantidad:            Number(it.cantidad ?? 0),
    precio_unitario:     Number(it.precio_unitario ?? 0),
    precio_total:        Number(it.precio_total ?? 0),
    item_gross_snapshot: it.item_gross_snapshot != null ? Number(it.item_gross_snapshot) : null,
    currency:            (it.currency as string) ?? 'EUR',
  }))

  return {
    id:                      (row as Record<string, unknown>).id as string,
    numero:                  (row as Record<string, unknown>).numero as string,
    master_numero:           master ? (master.numero as string) : null,
    estado:                  (row as Record<string, unknown>).estado as string,
    payment_status:          (row as Record<string, unknown>).payment_status as string,
    subtotal:                Number((row as Record<string, unknown>).subtotal ?? 0),
    coste_envio:             Number((row as Record<string, unknown>).coste_envio ?? 0),
    total:                   Number((row as Record<string, unknown>).total ?? 0),
    goods_gross_snapshot:    (row as Record<string, unknown>).goods_gross_snapshot != null ? Number((row as Record<string, unknown>).goods_gross_snapshot) : null,
    shipping_gross_snapshot: (row as Record<string, unknown>).shipping_gross_snapshot != null ? Number((row as Record<string, unknown>).shipping_gross_snapshot) : null,
    tax_rate_snapshot:       (row as Record<string, unknown>).tax_rate_snapshot != null ? Number((row as Record<string, unknown>).tax_rate_snapshot) : null,
    currency:                ((row as Record<string, unknown>).currency as string) ?? 'EUR',
    created_at:              (row as Record<string, unknown>).created_at as string,
    items,
  }
}

// ── Ledger (with total count) ─────────────────────────────────────────────────

export async function getProviderLedgerEntries(
  actorId: string,
  limit = 25,
  offset = 0
): Promise<ProviderLedgerResult> {
  const { data, error, count } = await supabase
    .from('trade_marketplace_ledger_entries')
    .select('*', { count: 'exact' })
    .eq('actor_id', actorId)
    .neq('status', 'failed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`getProviderLedgerEntries: ${error.message}`)

  // Re-use the same field mapping as ledger.service.ts
  const mapEntry = (r: Record<string, unknown>) => ({
    id:                   r.id as string,
    entryType:            r.entry_type as LedgerEntryType,
    amount:               Number(r.amount ?? 0),
    currency:             (r.currency as string) ?? 'EUR',
    status:               r.status as 'pending' | 'confirmed' | 'reversed' | 'failed',
    masterOrderId:        (r.master_order_id as string) ?? null,
    supplierOrderId:      (r.supplier_order_id as string) ?? null,
    actorId:              (r.actor_id as string) ?? null,
    settlementId:         (r.settlement_id as string) ?? null,
    refundId:             (r.refund_id as string) ?? null,
    disputeId:            (r.dispute_id as string) ?? null,
    description:          (r.description as string) ?? null,
    correlationId:        (r.correlation_id as string) ?? null,
    sourceEventId:        (r.source_event_id as string) ?? null,
    compensatesEntryId:   (r.compensates_entry_id as string) ?? null,
    externalProvider:     (r.external_provider as string) ?? 'simulation',
    externalId:           (r.external_id as string) ?? null,
    externalType:         (r.external_type as string) ?? null,
    occurredAt:           r.occurred_at as string,
    createdAt:            r.created_at as string,
  })

  return {
    items: (data ?? []).map(mapEntry),
    total: count ?? 0,
  }
}

// ── Balance ─────────────────────────────────────────────────────────────────

export { getProviderBalance }
