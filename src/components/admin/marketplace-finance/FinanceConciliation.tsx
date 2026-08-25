// MP-FIN-3 — Finance Conciliation Tab
// Vista global de reconciliación: MATCH vs MISMATCH por proveedor.
// Reconstruir balance desde ledger es idempotente y seguro.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, List } from 'lucide-react'
import { getAdminProvidersList, type AdminProviderRow } from '../../../lib/marketplace/finance/admin-finance.service'
import { reconcileProviderBalance, rebuildProviderBalance, type BalanceReconciliation } from '../../../lib/marketplace/finance/balance.service'
import { SimulationBanner, ReconciliationBadge, CurrencyAmount, ConfirmModal, Th, Td, EmptyState } from './shared'

interface RowState {
  provider: AdminProviderRow
  rec: BalanceReconciliation | null
  loading: boolean
  error: string | null
}

function ProviderConcileRow({ state, onRecalculate }: {
  state: RowState
  onRecalculate: (actorId: string) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [working, setWorking] = useState(false)

  const doRebuild = async () => {
    setWorking(true)
    try {
      await rebuildProviderBalance(state.provider.actor_id)
      onRecalculate(state.provider.actor_id)
    } finally {
      setWorking(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <tr className={`border-b border-slate-700/50 ${state.rec?.status === 'MISMATCH' ? 'bg-red-950/10' : ''}`}>
        <Td className="text-slate-200">{state.provider.nombre}</Td>
        <Td>
          <CurrencyAmount amount={state.provider.total_economic_balance} currency="EUR" className="text-white" />
        </Td>
        <Td>
          {state.loading
            ? <span className="text-[10px] text-slate-500">…</span>
            : state.rec
              ? <ReconciliationBadge status={state.rec.status} />
              : <ReconciliationBadge status="unknown" />}
        </Td>
        <Td className="text-[10px] text-slate-500">
          {state.loading ? '…' : state.rec
            ? `esperado: ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(state.rec.expected_total)} € / stored: ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(state.rec.stored_total)} €`
            : state.error ?? '—'}
        </Td>
        <Td>
          {state.provider.has_balance && (
            <button onClick={() => setShowConfirm(true)} disabled={working || state.loading}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[10px] text-slate-400 hover:text-white hover:border-slate-500 cursor-pointer transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${working ? 'animate-spin' : ''}`} />
              Recalcular
            </button>
          )}
        </Td>
      </tr>
      {showConfirm && (
        <ConfirmModal
          title="Recalcular balance"
          message={`Reconstruir balance de "${state.provider.nombre}" desde el ledger. Operación idempotente y segura.`}
          confirmLabel="Recalcular"
          onConfirm={doRebuild}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

export default function FinanceConciliation() {
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const providers = await getAdminProvidersList()
      const initial: RowState[] = providers.map(p => ({ provider: p, rec: null, loading: p.has_balance, error: null }))
      setRows(initial)

      // Load reconciliation for each provider that has a balance
      providers.forEach(p => {
        if (!p.has_balance) return
        reconcileProviderBalance(p.actor_id)
          .then(rec => {
            setRows(prev => prev.map(r => r.provider.actor_id === p.actor_id ? { ...r, rec, loading: false } : r))
          })
          .catch(e => {
            setRows(prev => prev.map(r => r.provider.actor_id === p.actor_id
              ? { ...r, loading: false, error: e instanceof Error ? e.message : String(e) }
              : r))
          })
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const recalculate = useCallback((actorId: string) => {
    setRows(prev => prev.map(r => r.provider.actor_id === actorId ? { ...r, loading: true, error: null } : r))
    reconcileProviderBalance(actorId)
      .then(rec => {
        setRows(prev => prev.map(r => r.provider.actor_id === actorId ? { ...r, rec, loading: false } : r))
      })
      .catch(e => {
        setRows(prev => prev.map(r => r.provider.actor_id === actorId
          ? { ...r, loading: false, error: e instanceof Error ? e.message : String(e) }
          : r))
      })
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

  const mismatches = rows.filter(r => r.rec?.status === 'MISMATCH').length
  const matches = rows.filter(r => r.rec?.status === 'MATCH').length
  const unknown = rows.filter(r => !r.loading && r.rec === null).length

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Nota */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-400">
        Reconciliación compara el balance almacenado con la suma del ledger (source of truth).
        La reconstrucción es idempotente — puede ejecutarse en cualquier momento sin riesgo de pérdida de datos.
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-emerald-400">{matches}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">MATCH</div>
        </div>
        <div className={`bg-slate-800/50 border rounded-lg p-3 text-center ${mismatches > 0 ? 'border-red-800/60' : 'border-slate-700'}`}>
          <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${mismatches > 0 ? 'text-red-400' : 'text-slate-600'}`} />
          <div className={`text-xl font-bold ${mismatches > 0 ? 'text-red-400' : 'text-slate-600'}`}>{mismatches}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">MISMATCH</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-slate-500 mt-2">{unknown}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">Sin balance</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Estado por proveedor</h3>
        <button onClick={loadProviders} disabled={loading}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Proveedor</Th>
                <Th>TEB (stored)</Th>
                <Th>Estado</Th>
                <Th>Detalle</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-8"><EmptyState icon={List} message="Sin proveedores" /></td></tr>
              ) : rows.map(row => (
                <ProviderConcileRow key={row.provider.actor_id} state={row} onRecalculate={recalculate} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
