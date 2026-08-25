// MP-FIN-3 — Finance Disputes Tab
// Lista global de disputas + detalle con evidencia y outcome simulado.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, AlertOctagon, ShieldAlert } from 'lucide-react'
import { getAdminDisputes, type AdminDisputeRow } from '../../../lib/marketplace/finance/admin-finance.service'
import { getDispute, getAdminDisputesOverview, type DisputeDetail } from '../../../lib/marketplace/finance/dispute.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge, SimulationBadge,
  fmtDate, fmtDateTime, fmtShortId, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'

const LIMIT = 25

function DisputeDetailPanel({ disputeId, onClose }: { disputeId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDispute(disputeId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [disputeId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <span className="text-sm font-bold text-white font-mono">{detail?.dispute_number ?? '…'}</span>
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
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Supplier Order: </span><span className="text-slate-200 font-mono">{fmtShortId(detail.supplier_order_id)}</span></div>
                <div><span className="text-slate-500">Responsabilidad: </span><span className="text-slate-300">{detail.responsibility}</span></div>
                <div><span className="text-slate-500">Abierto: </span><span className="text-slate-300">{fmtDateTime(detail.opened_at)}</span></div>
                {detail.resolved_at && <div><span className="text-slate-500">Resuelto: </span><span className="text-slate-300">{fmtDateTime(detail.resolved_at)}</span></div>}
                {detail.evidence_due_at && <div><span className="text-slate-500">Vence evidencia: </span><span className="text-orange-300">{fmtDate(detail.evidence_due_at)}</span></div>}
                <div><span className="text-slate-500">Outcome: </span><span className="text-slate-300">{detail.outcome ?? '—'}</span></div>
              </div>

              {/* Importe */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importe</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disputa</span>
                  <CurrencyAmount amount={detail.amount} currency={detail.currency} className="text-red-300" />
                </div>
                {detail.chargeback_posted && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chargeback</span>
                      <CurrencyAmount amount={detail.chargeback_amount ?? 0} currency={detail.currency} className="text-red-400" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fee chargeback</span>
                      <CurrencyAmount amount={detail.chargeback_fee} currency={detail.currency} className="text-red-400" />
                    </div>
                  </>
                )}
              </div>

              {/* Motivo */}
              {detail.reason && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-xs">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Motivo</div>
                  <p className="text-slate-300">{detail.reason}</p>
                  {detail.reason_code && <p className="text-[10px] text-slate-500 mt-1">Código: {detail.reason_code}</p>}
                </div>
              )}

              {/* Evidencia */}
              {detail.evidence.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Evidencia ({detail.evidence.length})</div>
                  {detail.evidence.map((ev, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 font-semibold">{ev.evidence_type}</span>
                        <span className="text-slate-500">{fmtDate(ev.submitted_at)}</span>
                      </div>
                      {ev.description && <p className="text-slate-500 text-[10px] mt-0.5">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[10px] text-slate-600 font-mono">ID: {detail.dispute_id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FinanceDisputes() {
  const [items, setItems] = useState<AdminDisputeRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminDisputesOverview>> | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminDisputes({
        status: filterStatus || undefined,
        limit: LIMIT,
        offset: off,
      })
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    load(0)
    getAdminDisputesOverview().then(setOverview).catch(console.error)
  }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total disputas</div>
            <div className="text-xl font-bold text-red-300">{overview.total_disputes}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Abiertas</div>
            <div className={`text-xl font-bold ${overview.open_disputes > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {overview.open_disputes}
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Importe disputado</div>
            <div className="text-xl font-bold tabular-nums text-red-400">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_disputed_amount)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Impacto chargebacks</div>
            <div className="text-xl font-bold tabular-nums text-red-500">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.chargebacks_net_impact)} €
            </div>
          </div>
        </div>
      )}

      {/* Alert si hay disputas abiertas */}
      {overview && overview.open_disputes > 0 && (
        <div className="flex items-center gap-2 bg-red-950/20 border border-red-800/60 rounded-lg px-3 py-2 text-xs">
          <AlertOctagon className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 font-semibold">{overview.open_disputes} disputa{overview.open_disputes !== 1 ? 's' : ''} requiere{overview.open_disputes !== 1 ? 'n' : ''} atención</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="opened">Opened</option>
          <option value="needs_response">Needs Response</option>
          <option value="evidence_submitted">Evidence Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="accepted">Accepted</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => load(0)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors">
          Filtrar
        </button>
        <button onClick={() => load(0)}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500">{total} disputa{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Disputa</Th>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Importe</Th>
                <Th>Responsabilidad</Th>
                <Th>Outcome</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={7} />
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-8"><EmptyState icon={ShieldAlert} message="Sin disputas" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.dispute_number}</Td>
                  <Td className="text-slate-400">{fmtDate(row.opened_at)}</Td>
                  <Td className="text-slate-300">{row.actor_nombre ?? '—'}</Td>
                  <Td>
                    <CurrencyAmount amount={row.amount} currency={row.currency} className="text-red-300" />
                  </Td>
                  <Td className="text-slate-400 text-[10px]">{row.responsibility}</Td>
                  <Td>
                    {row.outcome
                      ? <FinancialStatusBadge status={row.outcome} />
                      : <span className="text-slate-600">—</span>}
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

      {selectedId && <DisputeDetailPanel disputeId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
