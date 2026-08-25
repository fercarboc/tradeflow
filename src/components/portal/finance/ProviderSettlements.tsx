// MP-FIN-4 — Provider Settlements Tab
// Liquidaciones del proveedor.
// CRÍTICO: Mostrar "Liquidación simulada" — NUNCA "Transferido" ni implicar pago real.
// COMMISSION_GATE cerrado: no mostrar tasa de comisión al proveedor.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Banknote } from 'lucide-react'
import {
  listProviderSettlements, getSettlement,
  type SettlementListItem, type SettlementDetail,
} from '../../../lib/marketplace/finance/settlement.service'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 20

function SettlementDetailModal({
  settlementId,
  onClose,
}: {
  settlementId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<SettlementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettlement(settlementId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [settlementId])

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-400" />
          <span className="font-mono">{detail?.settlement_number ?? '…'}</span>
          {detail && <StatusBadge status={detail.status} />}
        </span>
      }
      onClose={onClose}
    >
      {loading && <div className="text-slate-500 text-xs py-4">Cargando…</div>}
      {error && <ErrorBox message={error} />}
      {detail && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Periodo: </span><span className="text-slate-300">{fmtDate(detail.period_start)} – {fmtDate(detail.period_end)}</span></div>
            <div><span className="text-slate-500">Moneda: </span><span className="text-slate-300">{detail.currency}</span></div>
            {detail.calculated_at && <div><span className="text-slate-500">Calculado: </span><span className="text-slate-300">{fmtDateTime(detail.calculated_at)}</span></div>}
            {detail.approved_at && <div><span className="text-slate-500">Aprobado: </span><span className="text-emerald-300">{fmtDateTime(detail.approved_at)}</span></div>}
          </div>

          {/* Importe */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Resumen</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ventas del periodo</span>
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
                <span className="text-slate-400">Disputas</span>
                <CurrencyAmount amount={-detail.chargeback_amount} currency={detail.currency} className="text-red-400" />
              </div>
            )}
            <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold">
              <span className="text-emerald-300">Importe liquidación (simulada)</span>
              <CurrencyAmount amount={detail.settlement_amount} currency={detail.currency} className="text-emerald-300 font-bold" />
            </div>
          </div>

          {/* Estado */}
          {detail.simulated_paid_at && (
            <div className="bg-teal-950/20 border border-teal-800/30 rounded px-3 py-2 text-[10px] text-teal-400">
              Liquidación simulada procesada el {fmtDate(detail.simulated_paid_at)}.
              No implica transferencia bancaria real.
            </div>
          )}

          <div className="text-[10px] text-slate-700 font-mono">ID: {detail.id}</div>
        </div>
      )}
    </Modal>
  )
}

export default function ProviderSettlements({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<SettlementListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listProviderSettlements(actorId, LIMIT, off)
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="space-y-4">
      <SimBanner />

      {/* Nota conceptual */}
      <div className="flex items-start gap-2 bg-blue-950/20 border border-blue-800/30 rounded-lg px-3 py-2 text-[10px] text-blue-400">
        <Banknote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Las liquidaciones son cálculos de lo que recibirías al final del periodo.
          En esta fase son <strong>simuladas</strong> — no representan transferencias bancarias reales.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Liquidaciones</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{total} liquidaci{total !== 1 ? 'ones' : 'ón'}</span>
          <button onClick={() => load(0)} disabled={loading}
            className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Liquidación</Th>
                <Th>Periodo</Th>
                <Th>Importe (sim.)</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={4} />
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="py-8"><EmptyState icon={Banknote} message="Sin liquidaciones" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.settlement_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{fmtDate(row.period_start)} – {fmtDate(row.period_end)}</Td>
                  <Td><CurrencyAmount amount={row.settlement_amount} currency={row.currency} className="text-emerald-400 font-semibold" /></Td>
                  <Td><StatusBadge status={row.status} /></Td>
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
        <SettlementDetailModal settlementId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
