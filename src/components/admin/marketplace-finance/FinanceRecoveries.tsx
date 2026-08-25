// MP-FIN-3 — Finance Recoveries Tab
// Lista global de recuperaciones de saldo negativo.
// Vista Admin. No permite crear/cancelar desde aquí (control en Saldos/Proveedor).

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import {
  listAdminRecoveries, getAdminNegativeOverview,
  type RecoveryListItem,
} from '../../../lib/marketplace/finance/recovery.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge,
  fmtDate, fmtDateTime, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'

const LIMIT = 25

export default function FinanceRecoveries() {
  const [items, setItems] = useState<RecoveryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminNegativeOverview>> | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminRecoveries({
        status: (filterStatus || undefined) as import('../../../lib/marketplace/finance/recovery.service').RecoveryStatus | undefined,
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
    getAdminNegativeOverview().then(setOverview).catch(console.error)
  }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Proveedores en déficit</div>
            <div className={`text-xl font-bold ${overview.providers_in_deficit > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {overview.providers_in_deficit}
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Déficit total</div>
            <div className="text-xl font-bold tabular-nums text-red-400">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_deficit)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Recuperaciones activas</div>
            <div className="text-xl font-bold text-yellow-400">{overview.active_recoveries}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Recuperado (período)</div>
            <div className="text-xl font-bold tabular-nums text-emerald-400">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_recovered_this_period)} €
            </div>
          </div>
        </div>
      )}

      {/* Aging */}
      {overview && Object.keys(overview.by_aging).length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Aging del déficit</div>
          <div className="grid grid-cols-5 gap-2 text-[10px]">
            {Object.entries(overview.by_aging).map(([bucket, data]) => (
              <div key={bucket} className="text-center">
                <div className="text-slate-500 mb-1">{bucket.replace('_', '-')} días</div>
                <div className="font-semibold text-slate-300">{(data as { count: number; total_deficit: number }).count}</div>
                <div className="tabular-nums text-red-400">
                  {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format((data as { count: number; total_deficit: number }).total_deficit)}€
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
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
        <span className="text-xs text-slate-500">{total} recuperaci{total !== 1 ? 'ones' : 'ón'}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Recuperación</Th>
                <Th>Tipo</Th>
                <Th>Déficit</Th>
                <Th>Recuperado</Th>
                <Th>Iniciado</Th>
                <Th>Completado</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={7} />
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-8"><EmptyState icon={TrendingUp} message="Sin recuperaciones" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id} className="border-b border-slate-700/50">
                  <Td mono className="text-slate-200">{row.recovery_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{row.recovery_type.replace(/_/g, ' ')}</Td>
                  <Td><CurrencyAmount amount={row.deficit_amount} currency={row.currency} className="text-red-400" /></Td>
                  <Td><CurrencyAmount amount={row.recovered_amount} currency={row.currency} className="text-emerald-400" /></Td>
                  <Td className="text-slate-400">{fmtDate(row.initiated_at)}</Td>
                  <Td className={row.completed_at ? 'text-emerald-300' : 'text-slate-600'}>
                    {row.completed_at ? fmtDate(row.completed_at) : '—'}
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
    </div>
  )
}
