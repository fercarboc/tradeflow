// MP-FIN-3 — Finance Balances Tab
// Saldos de proveedores con reconciliación y rebuild.
// Saldos negativos destacados. TEB = pending + available + reserved - negative.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { getAdminProvidersList, type AdminProviderRow } from '../../../lib/marketplace/finance/admin-finance.service'
import { reconcileProviderBalance, rebuildProviderBalance, type BalanceReconciliation } from '../../../lib/marketplace/finance/balance.service'
import { getAdminBalancesOverview } from '../../../lib/marketplace/finance/balance.service'
import {
  SimulationBanner, CurrencyAmount, ReconciliationBadge, KpiCard,
  fmtDateTime, Th, Td, EmptyState, ConfirmModal,
} from './shared'

function ReconcileButton({ actorId, actorNombre, onResult }: {
  actorId: string
  actorNombre: string
  onResult: (r: BalanceReconciliation) => void
}) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const doRebuild = async () => {
    setLoading(true)
    try {
      await rebuildProviderBalance(actorId)
      const rec = await reconcileProviderBalance(actorId)
      onResult(rec)
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button onClick={() => setShowConfirm(true)} disabled={loading}
        className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[10px] text-slate-400 hover:text-white hover:border-slate-500 cursor-pointer transition-colors disabled:opacity-50">
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        Recalcular
      </button>
      {showConfirm && (
        <ConfirmModal
          title="Recalcular balance"
          message={`Reconstruir balance de "${actorNombre}" desde el ledger. Operación idempotente y segura.`}
          confirmLabel="Recalcular"
          onConfirm={doRebuild}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

function ReconcileStatus({ actorId, actorNombre }: { actorId: string; actorNombre: string }) {
  const [rec, setRec] = useState<BalanceReconciliation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reconcileProviderBalance(actorId)
      .then(r => setRec(r))
      .catch(() => setRec(null))
      .finally(() => setLoading(false))
  }, [actorId])

  if (loading) return <span className="text-[10px] text-slate-500">…</span>
  if (!rec) return <ReconciliationBadge status="unknown" />

  return (
    <div className="flex items-center gap-2">
      <ReconciliationBadge status={rec.status} />
      <ReconcileButton actorId={actorId} actorNombre={actorNombre} onResult={setRec} />
    </div>
  )
}

export default function FinanceBalances() {
  const [providers, setProviders] = useState<AdminProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminBalancesOverview>> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, ov] = await Promise.all([
        getAdminProvidersList(),
        getAdminBalancesOverview(),
      ])
      setProviders(rows)
      setOverview(ov)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const negativeProviders = providers.filter(p => p.negative_amount > 0)

  return (
    <div className="space-y-5">
      <SimulationBanner />

      {/* Overview KPIs */}
      {overview && (
        <div className="space-y-2">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Totales globales (EUR)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Pending total"
              value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_provider_pending)} €`}
              color="text-yellow-300" />
            <KpiCard label="Available total"
              value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_provider_available)} €`}
              color="text-emerald-400" />
            <KpiCard label="Reserved total"
              value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_provider_reserved)} €`}
              color="text-blue-300" />
            <KpiCard label="Negative total"
              value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_provider_negative)} €`}
              color={overview.total_provider_negative > 0 ? 'text-red-400' : 'text-slate-400'}
              warning={overview.total_provider_negative > 0} />
          </div>
        </div>
      )}

      {/* Saldos negativos destacados */}
      {negativeProviders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              {negativeProviders.length} proveedor{negativeProviders.length !== 1 ? 'es' : ''} con saldo negativo
            </span>
          </div>
          <div className="space-y-1">
            {negativeProviders.map(p => (
              <div key={p.actor_id}
                className="flex items-center gap-3 bg-red-950/20 border border-red-800/60 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <span className="text-slate-200 flex-1 font-semibold">{p.nombre}</span>
                <CurrencyAmount amount={p.negative_amount} currency="EUR" className="text-red-400 font-bold" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      {/* Tabla de saldos */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldos por proveedor</h3>
        <button onClick={load}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Proveedor</Th>
                <Th>Currency</Th>
                <Th>Pending</Th>
                <Th>Available</Th>
                <Th>Reserved</Th>
                <Th>Negative</Th>
                <Th>Hist. settled</Th>
                <Th>TEB</Th>
                <Th>Reconciliación</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              ) : providers.length === 0 ? (
                <tr><td colSpan={9} className="py-8"><EmptyState message="Sin proveedores" /></td></tr>
              ) : providers.map(p => (
                <tr key={p.actor_id}
                  className={`border-b border-slate-700/50 ${p.negative_amount > 0 ? 'bg-red-950/10' : ''}`}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {p.negative_amount > 0 && <AlertTriangle className="h-3 w-3 text-red-400" />}
                      <span className="text-slate-200">{p.nombre}</span>
                    </div>
                  </Td>
                  <Td className="text-slate-500">EUR</Td>
                  <Td><CurrencyAmount amount={p.pending_amount} currency="EUR" className="text-yellow-300" /></Td>
                  <Td><CurrencyAmount amount={p.available_amount} currency="EUR" className="text-emerald-400" /></Td>
                  <Td>
                    {p.reserved_amount > 0
                      ? <CurrencyAmount amount={p.reserved_amount} currency="EUR" className="text-blue-300" />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td>
                    {p.negative_amount > 0
                      ? <CurrencyAmount amount={p.negative_amount} currency="EUR" className="text-red-400 font-semibold" />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td><CurrencyAmount amount={p.historical_settled} currency="EUR" className="text-slate-400" /></Td>
                  <Td><CurrencyAmount amount={p.total_economic_balance} currency="EUR" className="text-white font-semibold" /></Td>
                  <Td>
                    {p.has_balance
                      ? <ReconcileStatus actorId={p.actor_id} actorNombre={p.nombre} />
                      : <span className="text-[10px] text-slate-600">Sin balance</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota */}
      <p className="text-[10px] text-slate-600">
        TEB = pending + available + reserved − negative (GENERATED ALWAYS en BD). Invariante INV-B03: historical_settled no forma parte del TEB.
      </p>
    </div>
  )
}
