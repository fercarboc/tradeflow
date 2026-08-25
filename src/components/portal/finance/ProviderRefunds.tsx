// MP-FIN-4 — Provider Refunds Tab
// Devoluciones que afectan al proveedor.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import {
  listSupplierRefunds, getRefund,
  type SupplierRefundListItem, type RefundDetail,
} from '../../../lib/marketplace/finance/refund.service'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 20

function RefundDetailModal({ refundId, onClose }: { refundId: string; onClose: () => void }) {
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
    <Modal
      title={
        <span className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-orange-400" />
          <span className="font-mono">{detail?.refund_number ?? '…'}</span>
          {detail && <StatusBadge status={detail.status} />}
        </span>
      }
      onClose={onClose}
    >
      {loading && <div className="text-slate-500 text-xs py-4">Cargando…</div>}
      {error && <ErrorBox message={error} />}
      {detail && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Tipo: </span><span className="text-slate-300">{detail.refund_type.replace(/_/g, ' ')}</span></div>
            <div><span className="text-slate-500">Estado: </span><StatusBadge status={detail.status} /></div>
            <div><span className="text-slate-500">Solicitado: </span><span className="text-slate-300">{fmtDateTime(detail.requested_at)}</span></div>
            {detail.processed_at && <div><span className="text-slate-500">Procesado: </span><span className="text-emerald-300">{fmtDateTime(detail.processed_at)}</span></div>}
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importes</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mercancía (gross)</span>
              <CurrencyAmount amount={detail.items_gross_amount} currency="EUR" className="text-orange-400" />
            </div>
            {detail.shipping_gross_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Envío (gross)</span>
                <CurrencyAmount amount={detail.shipping_gross_amount} currency="EUR" />
              </div>
            )}
            <div className="border-t border-slate-700 pt-1 flex justify-between font-semibold">
              <span className="text-white">Total devolución</span>
              <CurrencyAmount amount={detail.total_refund_amount} currency="EUR" className="text-orange-300 font-bold" />
            </div>
          </div>

          <div className="text-[10px] text-slate-700 font-mono">ID: {detail.refund_id}</div>
        </div>
      )}
    </Modal>
  )
}

export default function ProviderRefunds({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<SupplierRefundListItem[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listSupplierRefunds(actorId, LIMIT, off)
      setItems(res)
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

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Devoluciones</h2>
        <div className="flex items-center gap-2">
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
                <Th>Devolución</Th>
                <Th>Tipo</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={5} />
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-8"><EmptyState icon={RotateCcw} message="Sin devoluciones" /></td></tr>
              ) : items.map(row => (
                <tr key={row.refund_id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.refund_id)}>
                  <Td mono className="text-slate-200">{row.refund_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{row.refund_type.replace(/_/g, ' ')}</Td>
                  <Td><CurrencyAmount amount={row.total_refund_amount} currency="EUR" className="text-orange-400" /></Td>
                  <Td><StatusBadge status={row.status} /></Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(row.requested_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === LIMIT && (
          <div className="flex justify-end px-4 py-2.5 border-t border-slate-700">
            <button onClick={() => load(offset + LIMIT)}
              className="px-3 py-1 rounded border border-slate-700 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">
              Cargar más
            </button>
          </div>
        )}
      </div>

      {selectedId && (
        <RefundDetailModal refundId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
