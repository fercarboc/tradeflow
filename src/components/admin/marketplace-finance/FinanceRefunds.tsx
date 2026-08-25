// MP-FIN-3 — Finance Refunds Tab
// Lista global de refunds con detalle. Venta original nunca se modifica.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, RotateCcw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { getRefund, type RefundDetail } from '../../../lib/marketplace/finance/refund.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge, SimulationBadge,
  fmtDate, fmtDateTime, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'
import { getAdminRefundsOverview } from '../../../lib/marketplace/finance/refund.service'

const LIMIT = 25

interface AdminRefundRow {
  id: string
  refund_number: string
  supplier_order_id: string
  provider_actor_id: string
  actor_nombre: string | null
  refund_type: string
  status: string
  total_refund_amount: number
  currency: string
  simulation_only: boolean
  requested_at: string
  processed_at: string | null
}

function RefundDetailPanel({ refundId, onClose }: { refundId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RefundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRefund(refundId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [refundId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-mono">{detail?.refund_number ?? '…'}</span>
            {detail && <FinancialStatusBadge status={detail.status} />}
            <SimulationBadge />
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5">
          {loading && <div className="text-sm text-slate-500 py-4">Cargando…</div>}
          {error && <div className="text-xs text-red-400">{error}</div>}
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Supplier Order: </span><span className="text-slate-200 font-mono">{detail.supplier_order_id.slice(0, 8)}…</span></div>
                <div><span className="text-slate-500">Tipo: </span><span className="text-slate-300">{detail.refund_type}</span></div>
                <div><span className="text-slate-500">Solicitado: </span><span className="text-slate-300">{fmtDateTime(detail.requested_at)}</span></div>
                <div><span className="text-slate-500">Procesado: </span><span className="text-slate-300">{fmtDateTime(detail.processed_at)}</span></div>
              </div>

              {/* Importe */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importe devuelto</div>
                {detail.items_gross_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Items</span>
                    <CurrencyAmount amount={detail.items_gross_amount} currency="EUR" className="text-orange-400" />
                  </div>
                )}
                {detail.shipping_gross_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Envío</span>
                    <CurrencyAmount amount={detail.shipping_gross_amount} currency="EUR" className="text-orange-400" />
                  </div>
                )}
                <div className="border-t border-slate-700 pt-1 flex justify-between font-semibold">
                  <span className="text-white">Total refund</span>
                  <CurrencyAmount amount={detail.total_refund_amount} currency="EUR" className="text-orange-300 font-semibold" />
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-1 text-xs">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Timeline</div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                  <span>Solicitado: {fmtDateTime(detail.requested_at)}</span>
                </div>
                {detail.processed_at && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span>Procesado: {fmtDateTime(detail.processed_at)}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-600 font-mono">ID: {detail.refund_id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FinanceRefunds() {
  const [items, setItems] = useState<AdminRefundRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminRefundsOverview>> | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('trade_marketplace_refunds')
        .select(`
          id, refund_number, supplier_order_id, provider_actor_id,
          refund_type, status, total_refund_amount, currency, simulation_only,
          requested_at, processed_at,
          trade_marketplace_actors!provider_actor_id(nombre)
        `, { count: 'exact' })
        .order('requested_at', { ascending: false })
        .range(off, off + LIMIT - 1)

      if (filterStatus) q = q.eq('status', filterStatus) as typeof q

      const { data, error: qErr, count } = await q
      if (qErr) throw new Error(qErr.message)

      const rows: AdminRefundRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const actor = r.trade_marketplace_actors as Record<string, unknown> | null
        return {
          id: r.id as string,
          refund_number: r.refund_number as string,
          supplier_order_id: r.supplier_order_id as string,
          provider_actor_id: r.provider_actor_id as string,
          actor_nombre: actor ? (actor.nombre as string) : null,
          refund_type: r.refund_type as string,
          status: r.status as string,
          total_refund_amount: Number(r.total_refund_amount ?? 0),
          currency: r.currency as string,
          simulation_only: Boolean(r.simulation_only),
          requested_at: r.requested_at as string,
          processed_at: r.processed_at as string | null,
        }
      })

      setItems(rows)
      setTotal(count ?? 0)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    load(0)
    getAdminRefundsOverview().then(setOverview).catch(console.error)
  }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total refunds</div>
            <div className="text-xl font-bold text-orange-300">{overview.total_refunds}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total devuelto</div>
            <div className="text-xl font-bold tabular-nums text-orange-400">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_refunded_gross)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Goods devuelto</div>
            <div className="text-xl font-bold tabular-nums text-slate-300">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_goods_refunded)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Comisión reversada</div>
            <div className="text-xl font-bold tabular-nums text-slate-400">0,00 €</div>
            <div className="text-[10px] text-slate-600">COMMISSION_GATE cerrado</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="requested">Solicitado</option>
          <option value="approved">Aprobado</option>
          <option value="processing">Procesando</option>
          <option value="processed">Procesado</option>
          <option value="rejected">Rechazado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <button onClick={() => load(0)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors">
          Filtrar
        </button>
        <button onClick={() => load(0)}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500">{total} devoluc{total !== 1 ? 'iones' : 'ión'}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Refund</Th>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Tipo</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8"><EmptyState icon={RotateCcw} message="Sin devoluciones" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.refund_number}</Td>
                  <Td className="text-slate-400">{fmtDate(row.requested_at)}</Td>
                  <Td className="text-slate-300">{row.actor_nombre ?? '—'}</Td>
                  <Td className="text-slate-400 text-[10px]">{row.refund_type.replace(/_/g, ' ')}</Td>
                  <Td>
                    <CurrencyAmount amount={row.total_refund_amount} currency={row.currency} className="text-orange-300" />
                  </Td>
                  <Td><FinancialStatusBadge status={row.status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar total={total} limit={LIMIT} offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)} />
        )}
      </div>

      {selectedId && <RefundDetailPanel refundId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
