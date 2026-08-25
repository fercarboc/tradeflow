// MP-FIN-3 — Finance Reserves Tab
// Lista de reservas activas + detalle con timeline de releases.
// "Reserva no es pérdida económica" — solo bloqueo temporal de fondos.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, Lock, AlertTriangle } from 'lucide-react'
import {
  listAdminReserves, getReserve, getAdminReservesOverview,
  type ReserveDetail,
} from '../../../lib/marketplace/finance/reserve.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge, SimulationBadge,
  fmtDate, fmtDateTime, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'

const LIMIT = 25

function ReserveDetailPanel({ reserveId, onClose }: { reserveId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ReserveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReserve(reserveId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [reserveId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white font-mono">{detail?.reserve_number ?? '…'}</span>
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
              {/* Nota conceptual */}
              <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg px-3 py-2 text-[10px] text-blue-300">
                Reserva = bloqueo temporal de fondos disponibles. No es pérdida económica — el importe vuelve al disponible al liberar.
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Tipo: </span><span className="text-slate-300">{detail.reserve_type}</span></div>
                <div><span className="text-slate-500">Bucket: </span><span className="text-slate-300">{detail.source_bucket}</span></div>
                <div><span className="text-slate-500">Inicio: </span><span className="text-slate-300">{fmtDateTime(detail.starts_at)}</span></div>
                {detail.release_at && <div><span className="text-slate-500">Liberar el: </span><span className="text-orange-300">{fmtDate(detail.release_at)}</span></div>}
                {detail.expires_at && <div><span className="text-slate-500">Expira: </span><span className="text-slate-400">{fmtDate(detail.expires_at)}</span></div>}
                {detail.released_at && <div><span className="text-slate-500">Liberado: </span><span className="text-emerald-400">{fmtDateTime(detail.released_at)}</span></div>}
              </div>

              {/* Importe */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importes</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Solicitado</span>
                  <CurrencyAmount amount={detail.requested_amount} currency={detail.currency} className="text-blue-300" />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reservado</span>
                  <CurrencyAmount amount={detail.reserved_amount} currency={detail.currency} className="text-blue-400" />
                </div>
                {detail.released_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Liberado</span>
                    <CurrencyAmount amount={detail.released_amount} currency={detail.currency} className="text-emerald-400" />
                  </div>
                )}
                <div className="border-t border-slate-700 pt-1 flex justify-between font-semibold">
                  <span className="text-white">Restante</span>
                  <CurrencyAmount amount={detail.remaining_amount} currency={detail.currency} className="text-white font-semibold" />
                </div>
              </div>

              {/* Motivo */}
              {detail.reason && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-xs">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Motivo</div>
                  <p className="text-slate-300">{detail.reason}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-1 text-xs">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Timeline</div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span>Reservado: {fmtDateTime(detail.starts_at)}</span>
                </div>
                {detail.released_at && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span>Liberado: {fmtDateTime(detail.released_at)}</span>
                  </div>
                )}
                {detail.cancelled_at && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
                    <span>Cancelado: {fmtDateTime(detail.cancelled_at)}</span>
                  </div>
                )}
                {detail.expired_at && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-600 flex-shrink-0" />
                    <span>Expirado: {fmtDateTime(detail.expired_at)}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-600 font-mono">ID: {detail.id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FinanceReserves() {
  const [items, setItems] = useState<ReserveDetail[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminReservesOverview>> | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminReserves({
        status: (filterStatus || undefined) as import('../../../lib/marketplace/finance/reserve.service').ReserveStatus | null | undefined,
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
    getAdminReservesOverview().then(setOverview).catch(console.error)
  }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Nota conceptual */}
      <div className="flex items-start gap-2 bg-blue-950/20 border border-blue-800/40 rounded-lg px-3 py-2 text-xs">
        <Lock className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
        <span className="text-blue-300">Las reservas bloquean fondos temporalmente. No reducen el TEB — son parte del balance reservado que se libera automáticamente.</span>
      </div>

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total reservado</div>
            <div className="text-xl font-bold tabular-nums text-blue-300">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_reserved)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Proveedores</div>
            <div className="text-xl font-bold text-slate-300">{overview.providers_with_reserves}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Activas</div>
            <div className="text-xl font-bold text-blue-400">{overview.active_reserves}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Próx. expiración</div>
            <div className={`text-xl font-bold ${overview.reserves_near_expiry > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
              {overview.reserves_near_expiry}
            </div>
            {overview.reserves_near_expiry > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-2.5 w-2.5 text-yellow-500" />
                <span className="text-[9px] text-yellow-500">revisar</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="active">Active</option>
          <option value="partially_released">Partially Released</option>
          <option value="released">Released</option>
          <option value="expired">Expired</option>
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
        <span className="text-xs text-slate-500">{total} reserva{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Reserva</Th>
                <Th>Tipo</Th>
                <Th>Reservado</Th>
                <Th>Restante</Th>
                <Th>Liberar</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8"><EmptyState icon={Lock} message="Sin reservas" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.reserve_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{row.reserve_type.replace(/_/g, ' ')}</Td>
                  <Td><CurrencyAmount amount={row.reserved_amount} currency={row.currency} className="text-blue-300" /></Td>
                  <Td><CurrencyAmount amount={row.remaining_amount} currency={row.currency} className="text-blue-400" /></Td>
                  <Td className={`text-[10px] ${row.release_at ? 'text-orange-300' : 'text-slate-600'}`}>
                    {row.release_at ? fmtDate(row.release_at) : '—'}
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

      {selectedId && <ReserveDetailPanel reserveId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
