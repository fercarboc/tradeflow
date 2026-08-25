// MP-FIN-3 — Finance Providers Tab
// Lista financiera de proveedores con drill-down a detalle completo.
// Muestra balances por proveedor: pending/available/reserved/negative/TEB.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, Users, AlertTriangle } from 'lucide-react'
import {
  getAdminProvidersList, getAdminSupplierOrders, getAdminLedger,
  type AdminProviderRow, type AdminSupplierOrderRow, type AdminLedgerRow,
} from '../../../lib/marketplace/finance/admin-finance.service'
import { listAdminSettlements, type SettlementListResult } from '../../../lib/marketplace/finance/settlement.service'
import { reconcileProviderBalance, rebuildProviderBalance } from '../../../lib/marketplace/finance/balance.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge, ReconciliationBadge,
  KpiCard, GateBadge, fmtDate, fmtDateTime, Th, Td, EmptyState, ConfirmModal,
} from './shared'

// ── Provider Detail Panel ───────────────────────────────────────────────────

function ProviderDetailPanel({
  provider,
  onClose,
}: {
  provider: AdminProviderRow
  onClose: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'orders' | 'ledger' | 'settlements'>('overview')
  const [orders, setOrders] = useState<AdminSupplierOrderRow[]>([])
  const [ledger, setLedger] = useState<AdminLedgerRow[]>([])
  const [settlements, setSettlements] = useState<SettlementListResult | null>(null)
  const [reconciliation, setReconciliation] = useState<{ status: 'MATCH' | 'MISMATCH' | 'unknown'; diff?: number } | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [loadingSettlements, setLoadingSettlements] = useState(false)
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)

  useEffect(() => {
    reconcileProviderBalance(provider.actor_id)
      .then(r => setReconciliation({ status: r.status, diff: r.difference }))
      .catch(() => setReconciliation({ status: 'unknown' }))
  }, [provider.actor_id])

  useEffect(() => {
    if (tab === 'orders' && orders.length === 0) {
      setLoadingOrders(true)
      getAdminSupplierOrders({ actorId: provider.actor_id, limit: 50 })
        .then(r => setOrders(r.items))
        .catch(console.error)
        .finally(() => setLoadingOrders(false))
    }
    if (tab === 'ledger' && ledger.length === 0) {
      setLoadingLedger(true)
      getAdminLedger({ actorId: provider.actor_id, limit: 50 })
        .then(r => setLedger(r.items))
        .catch(console.error)
        .finally(() => setLoadingLedger(false))
    }
    if (tab === 'settlements' && !settlements) {
      setLoadingSettlements(true)
      listAdminSettlements({ actorId: provider.actor_id, limit: 20, offset: 0 })
        .then(r => setSettlements(r))
        .catch(console.error)
        .finally(() => setLoadingSettlements(false))
    }
  }, [tab, provider.actor_id])

  const handleRebuild = async () => {
    const result = await rebuildProviderBalance(provider.actor_id)
    setRebuildResult(`Rebuild exitoso: TEB = ${result.total_economic_balance} ${result.currency}`)
    const rec = await reconcileProviderBalance(provider.actor_id)
    setReconciliation({ status: rec.status, diff: rec.difference })
  }

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'orders' as const, label: 'Pedidos' },
    { id: 'ledger' as const, label: 'Ledger' },
    { id: 'settlements' as const, label: 'Settlements' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{provider.nombre}</span>
                <FinancialStatusBadge status={provider.estado} />
                {provider.verificado && <span className="text-[9px] text-emerald-400 font-bold border border-emerald-800 rounded px-1">✓ VERIFICADO</span>}
              </div>
              <div className="text-[10px] text-slate-400">{provider.slug} · {provider.country ?? '—'}</div>
            </div>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-t text-xs font-semibold cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-4">
                {/* Alerta saldo negativo */}
                {provider.negative_amount > 0 && (
                  <div className="flex items-center gap-2 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400">
                      Saldo negativo: <strong>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.negative_amount)} EUR</strong>
                    </span>
                  </div>
                )}

                {/* Balance buckets */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard label="Pending" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.pending_amount)} EUR`} color="text-yellow-300" />
                  <KpiCard label="Available" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.available_amount)} EUR`} color="text-emerald-400" />
                  <KpiCard label="Reserved" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.reserved_amount)} EUR`} color="text-blue-300" />
                  <KpiCard label="Negative" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.negative_amount)} EUR`}
                    color={provider.negative_amount > 0 ? 'text-red-400' : 'text-slate-400'} warning={provider.negative_amount > 0} />
                  <KpiCard label="Historical settled" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.historical_settled)} EUR`}
                    color="text-slate-300" sub="Flujo acumulado" />
                  <KpiCard label="TEB" value={`${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(provider.total_economic_balance)} EUR`}
                    color="text-white" sub="pending+avail+reserved-neg" />
                </div>

                {/* Reserve visual */}
                {provider.reserved_amount > 0 && (
                  <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-xs">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Posición económica (reserva ≠ pérdida)</div>
                    <div className="flex gap-3">
                      <div><span className="text-slate-400">Disponible: </span>
                        <CurrencyAmount amount={provider.available_amount} currency="EUR" className="text-emerald-400 font-semibold" />
                      </div>
                      <div><span className="text-slate-400">Reservado: </span>
                        <CurrencyAmount amount={provider.reserved_amount} currency="EUR" className="text-blue-300 font-semibold" />
                      </div>
                      <div><span className="text-slate-400">Posición: </span>
                        <CurrencyAmount amount={provider.available_amount + provider.reserved_amount} currency="EUR" className="text-white font-semibold" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Reconciliación */}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Reconciliación</div>
                    <ReconciliationBadge status={reconciliation?.status ?? 'unknown'} />
                    {reconciliation?.status === 'MISMATCH' && reconciliation.diff !== undefined && (
                      <span className="text-[10px] text-red-400 ml-2">Diff: {reconciliation.diff}</span>
                    )}
                  </div>
                  <button onClick={() => setShowRebuildConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors">
                    <RefreshCw className="h-3 w-3" /> Recalcular desde ledger
                  </button>
                </div>
                {rebuildResult && <p className="text-xs text-emerald-400">{rebuildResult}</p>}

                <div className="text-[10px] text-slate-600 font-mono">actor_id: {provider.actor_id}</div>
              </div>
            )}

            {/* Orders */}
            {tab === 'orders' && (
              <div className="overflow-x-auto">
                {loadingOrders ? <div className="text-xs text-slate-500 py-4">Cargando…</div> :
                  orders.length === 0 ? <EmptyState icon={Users} message="Sin supplier orders" /> : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-700">
                        <Th>Número</Th><Th>Master</Th><Th>Estado</Th><Th>Total</Th><Th>Fecha</Th>
                      </tr></thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id} className="border-b border-slate-700/50">
                            <Td mono className="text-slate-200">{o.numero}</Td>
                            <Td mono className="text-slate-500">{o.master_numero ?? '—'}</Td>
                            <Td><FinancialStatusBadge status={o.estado} /></Td>
                            <Td><CurrencyAmount amount={o.total} currency={o.currency} /></Td>
                            <Td className="text-slate-400">{fmtDate(o.created_at)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            )}

            {/* Ledger */}
            {tab === 'ledger' && (
              <div className="overflow-x-auto">
                {loadingLedger ? <div className="text-xs text-slate-500 py-4">Cargando…</div> :
                  ledger.length === 0 ? <EmptyState message="Sin movimientos en ledger" /> : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-700">
                        <Th>Fecha</Th><Th>Tipo</Th><Th>Importe</Th><Th>Estado</Th>
                      </tr></thead>
                      <tbody>
                        {ledger.map(e => (
                          <tr key={e.id} className="border-b border-slate-700/50">
                            <Td className="text-slate-400 whitespace-nowrap">{fmtDateTime(e.occurred_at)}</Td>
                            <Td mono className="text-slate-300 text-[10px]">{e.entry_type}</Td>
                            <Td>
                              <CurrencyAmount amount={e.amount} currency={e.currency}
                                className={e.amount >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                            </Td>
                            <Td><FinancialStatusBadge status={e.status} /></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            )}

            {/* Settlements */}
            {tab === 'settlements' && (
              <div className="overflow-x-auto">
                {loadingSettlements ? <div className="text-xs text-slate-500 py-4">Cargando…</div> :
                  !settlements || settlements.items.length === 0 ? <EmptyState message="Sin settlements" /> : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-700">
                        <Th>Número</Th><Th>Periodo</Th><Th>Estado</Th><Th>Payable</Th>
                      </tr></thead>
                      <tbody>
                        {settlements.items.map(s => (
                          <tr key={s.id} className="border-b border-slate-700/50">
                            <Td mono className="text-slate-200">{s.settlement_number}</Td>
                            <Td className="text-slate-400 text-[10px]">
                              {fmtDate(s.period_start)} – {fmtDate(s.period_end)}
                            </Td>
                            <Td><FinancialStatusBadge status={s.status} /></Td>
                            <Td>
                              <CurrencyAmount amount={s.max_payable} currency={s.currency} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRebuildConfirm && (
        <ConfirmModal
          title="Recalcular balance desde ledger"
          message={`Se reconstruirá el balance de "${provider.nombre}" leyendo todas las entradas del ledger. La operación es idempotente y segura.`}
          confirmLabel="Recalcular"
          onConfirm={async () => { await handleRebuild(); setShowRebuildConfirm(false) }}
          onClose={() => setShowRebuildConfirm(false)}
        />
      )}
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function FinanceProviders() {
  const [providers, setProviders] = useState<AdminProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminProviderRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAdminProvidersList()
      setProviders(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <SimulationBanner />

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{providers.length} proveedor{providers.length !== 1 ? 'es' : ''}</span>
        <button onClick={load}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
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
                <Th>Estado</Th>
                <Th>Pending</Th>
                <Th>Available</Th>
                <Th>Reserved</Th>
                <Th>Negative</Th>
                <Th>Historical settled</Th>
                <Th>TEB</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              ) : providers.length === 0 ? (
                <tr><td colSpan={8} className="py-8"><EmptyState icon={Users} message="Sin proveedores" /></td></tr>
              ) : providers.map(p => (
                <tr key={p.actor_id}
                  className={`border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer ${p.negative_amount > 0 ? 'bg-red-950/10' : ''}`}
                  onClick={() => setSelected(p)}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {p.negative_amount > 0 && <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />}
                      <span className="text-slate-200 font-semibold">{p.nombre}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{p.slug}</div>
                  </Td>
                  <Td><FinancialStatusBadge status={p.estado} /></Td>
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
                  <Td className="text-slate-400">
                    <CurrencyAmount amount={p.historical_settled} currency="EUR" className="text-slate-400" />
                  </Td>
                  <Td>
                    <CurrencyAmount amount={p.total_economic_balance} currency="EUR" className="text-white font-semibold" />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ProviderDetailPanel provider={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
