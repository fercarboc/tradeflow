// MP-FIN-3 — Finance Settlements Tab
// Lista de settlements con state machine y líneas detalladas.
// Mutations: approve + simulate_payment con confirmación obligatoria.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, CheckCircle, CreditCard, Banknote } from 'lucide-react'
import {
  listAdminSettlements, getSettlement, getAdminSettlementsOverview,
  approveSimulationSettlement, simulateSettlementPayment,
  type AdminSettlementListItem, type SettlementDetail,
} from '../../../lib/marketplace/finance/settlement.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge, SimulationBadge,
  fmtDate, fmtDateTime, PaginationBar, Th, Td, LoadingRow, EmptyState, ConfirmModal,
} from './shared'

const LIMIT = 25

// ── Settlement Detail Panel ──────────────────────────────────────────────────

function SettlementDetailPanel({
  settlementId,
  onClose,
  onMutated,
}: {
  settlementId: string
  onClose: () => void
  onMutated: () => void
}) {
  const [detail, setDetail] = useState<SettlementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'approve' | 'pay' | null>(null)
  const [mutating, setMutating] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    getSettlement(settlementId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [settlementId])

  useEffect(() => { reload() }, [reload])

  const doApprove = async () => {
    setMutating(true)
    try {
      await approveSimulationSettlement(settlementId)
      onMutated()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setMutating(false)
      setConfirm(null)
    }
  }

  const doPay = async () => {
    setMutating(true)
    try {
      await simulateSettlementPayment(settlementId)
      onMutated()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setMutating(false)
      setConfirm(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-white font-mono">{detail?.settlement_number ?? '…'}</span>
              {detail && <FinancialStatusBadge status={detail.status} />}
              <SimulationBadge />
            </div>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div className="p-5">
            {loading && <div className="text-sm text-slate-500 py-4">Cargando…</div>}
            {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
            {detail && (
              <div className="space-y-4">
                {/* Period */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Periodo: </span><span className="text-slate-300">{fmtDate(detail.period_start)} – {fmtDate(detail.period_end)}</span></div>
                  <div><span className="text-slate-500">Currency: </span><span className="text-slate-300">{detail.currency}</span></div>
                  {detail.calculated_at && <div><span className="text-slate-500">Calculado: </span><span className="text-slate-300">{fmtDateTime(detail.calculated_at)}</span></div>}
                  {detail.approved_at && <div><span className="text-slate-500">Aprobado: </span><span className="text-emerald-300">{fmtDateTime(detail.approved_at)}</span></div>}
                  {detail.simulated_paid_at && <div><span className="text-slate-500">Pago sim.: </span><span className="text-emerald-300">{fmtDateTime(detail.simulated_paid_at)}</span></div>}
                </div>

                {/* Importe */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Resumen financiero</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ventas</span>
                    <CurrencyAmount amount={detail.sales_amount} currency={detail.currency} className="text-emerald-400" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Envíos</span>
                    <CurrencyAmount amount={detail.shipping_amount} currency={detail.currency} />
                  </div>
                  {detail.refund_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Devoluciones</span>
                      <CurrencyAmount amount={-detail.refund_amount} currency={detail.currency} className="text-orange-400" />
                    </div>
                  )}
                  {detail.chargeback_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chargebacks</span>
                      <CurrencyAmount amount={-detail.chargeback_amount} currency={detail.currency} className="text-red-400" />
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Comisión (simulada)</span>
                    <CurrencyAmount amount={-detail.commission_amount} currency={detail.currency} className="text-slate-400" />
                  </div>
                  <div className="border-t border-slate-700 pt-1.5 flex justify-between font-semibold">
                    <span className="text-white">Max pagable</span>
                    <CurrencyAmount amount={detail.max_payable} currency={detail.currency} className="text-white font-semibold" />
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-emerald-300">Importe settlement</span>
                    <CurrencyAmount amount={detail.settlement_amount} currency={detail.currency} className="text-emerald-300 font-bold" />
                  </div>
                </div>

                {/* Actions */}
                {detail.status === 'calculated' && (
                  <button onClick={() => setConfirm('approve')} disabled={mutating}
                    className="flex items-center gap-2 w-full justify-center py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Aprobar settlement
                  </button>
                )}
                {detail.status === 'approved' && (
                  <button onClick={() => setConfirm('pay')} disabled={mutating}
                    className="flex items-center gap-2 w-full justify-center py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50">
                    <CreditCard className="h-3.5 w-3.5" />
                    Simular pago (SIMULATION ONLY)
                  </button>
                )}

                <div className="text-[10px] text-slate-600 font-mono">ID: {detail.id} · Lines: {detail.lines_count}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirm === 'approve' && (
        <ConfirmModal
          title="Aprobar settlement"
          message={`Aprobar settlement ${detail?.settlement_number}. Importe: ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(detail?.settlement_amount ?? 0)} EUR. Operación simulada — no mueve dinero real.`}
          confirmLabel="Aprobar"
          onConfirm={doApprove}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'pay' && (
        <ConfirmModal
          title="Simular pago"
          message={`Simular pago de ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(detail?.settlement_amount ?? 0)} EUR para ${detail?.settlement_number}. SIMULATION ONLY — no se mueve dinero real.`}
          confirmLabel="Simular pago"
          onConfirm={doPay}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FinanceSettlements() {
  const [items, setItems] = useState<AdminSettlementListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminSettlementsOverview>> | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminSettlements({
        status: (filterStatus || undefined) as import('../../../lib/marketplace/finance/settlement.service').SettlementStatus | null | undefined,
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

  const loadOverview = () => getAdminSettlementsOverview().then(setOverview).catch(console.error)

  useEffect(() => { load(0); loadOverview() }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total settlements</div>
            <div className="text-xl font-bold text-slate-300">{overview.total_settlements}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Pago simulado</div>
            <div className="text-xl font-bold text-emerald-400">{overview.settlements_simulated_paid}</div>
            <div className="text-[10px] text-slate-600">SIMULATION ONLY</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Total sim. pagado</div>
            <div className="text-xl font-bold tabular-nums text-emerald-400">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_simulated_paid)} €
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Max pagable total</div>
            <div className="text-xl font-bold tabular-nums text-blue-300">
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(overview.total_max_payable)} €
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="draft">Draft</option>
          <option value="calculated">Calculated</option>
          <option value="approved">Approved</option>
          <option value="simulated_paid">Simulated Paid</option>
          <option value="closed">Closed</option>
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
        <span className="text-xs text-slate-500">{total} settlement{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Settlement</Th>
                <Th>Periodo</Th>
                <Th>Currency</Th>
                <Th>Max pagable</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8"><EmptyState icon={Banknote} message="Sin settlements" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.settlement_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{fmtDate(row.period_start)} – {fmtDate(row.period_end)}</Td>
                  <Td className="text-slate-500">{row.currency}</Td>
                  <Td><CurrencyAmount amount={row.max_payable} currency={row.currency} className="text-blue-300" /></Td>
                  <Td><CurrencyAmount amount={row.settlement_amount} currency={row.currency} className="text-emerald-400 font-semibold" /></Td>
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

      {selectedId && (
        <SettlementDetailPanel
          settlementId={selectedId}
          onClose={() => setSelectedId(null)}
          onMutated={() => { load(offset); loadOverview() }}
        />
      )}
    </div>
  )
}
