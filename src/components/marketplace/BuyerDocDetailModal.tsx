// MP-FIN-5C — Detalle semántico de purchase_summary. Light UI.
// No raw JSON. Renderiza master_order + supplier_orders + items desde metadata allowlisted.
// NOTE: purchase_summary metadata no almacena actor_nombre en el snapshot
//       (solo actor_id). Se muestra supplier_order.numero como referencia del proveedor.
// No inner components — todos definidos a nivel de módulo.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getDocumentDetail, type FinDocDetail } from '../../lib/marketplace/finance/financial-documents.service'
import { fmtDate, CurrencyAmount } from '../portal/finance/shared'
import { LightErrorBox } from './BuyerDocShared'
import {
  extractPurchaseSummaryMeta,
  computeSupplierOrderTotal,
  isSimulationOnly,
  type PurchaseSummaryItem,
  type PurchaseSummaryOrderBlock,
} from '../portal/finance/doc-helpers'

// ── Wide modal wrapper (module-level) ─────────────────────────────────────────

function BuyerModal({ title, onClose, children }: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
      <div className="bg-white border border-gray-200 rounded-t-xl sm:rounded-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="h-7 w-7 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Item row (module-level) ───────────────────────────────────────────────────

function ItemRow({ item }: { item: PurchaseSummaryItem }) {
  const gross = item.item_gross_snapshot ?? (item.precio_unitario ?? 0) * item.cantidad
  return (
    <tr className="border-b border-gray-100 text-xs">
      <td className="py-1.5 pr-2 text-gray-400 text-[10px] font-mono">{item.referencia ?? '—'}</td>
      <td className="py-1.5 pr-2 text-gray-900">{item.descripcion ?? '—'}</td>
      <td className="py-1.5 pr-2 text-gray-400 text-center">{item.cantidad} {item.unidad ?? ''}</td>
      <td className="py-1.5 text-right">
        <CurrencyAmount amount={gross} currency={item.currency} className="text-gray-900" />
      </td>
    </tr>
  )
}

// ── Supplier order block (module-level) ───────────────────────────────────────

function SupplierOrderBlock({ block, currency }: { block: PurchaseSummaryOrderBlock; currency: string }) {
  const { order, items } = block
  const total = computeSupplierOrderTotal(order)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-700 font-mono">{order.numero}</span>
        <CurrencyAmount
          amount={total}
          currency={order.currency || currency}
          className="text-[11px] font-semibold text-gray-900"
        />
      </div>
      {items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full px-3">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="py-1.5 px-3 text-left">Ref.</th>
                <th className="py-1.5 pr-2 text-left">Descripción</th>
                <th className="py-1.5 pr-2 text-center">Cant.</th>
                <th className="py-1.5 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="px-3">
              {items.map(item => <ItemRow key={item.id} item={item} />)}
            </tbody>
          </table>
        </div>
      )}
      {order.shipping_gross_snapshot != null && order.shipping_gross_snapshot > 0 && (
        <div className="flex justify-between px-3 py-1.5 text-[11px] border-t border-gray-100 text-gray-400">
          <span>Gastos de envío</span>
          <CurrencyAmount amount={order.shipping_gross_snapshot} currency={order.currency || currency} />
        </div>
      )}
    </div>
  )
}

// ── Simulation banner (module-level) ─────────────────────────────────────────

function SimAlert() {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[10px] text-amber-700">
      <span className="font-bold uppercase tracking-wider">Modo simulación</span>
      <span className="text-amber-400">·</span>
      <span className="text-amber-600">Los importes son datos de simulación interna, no transferencias reales.</span>
    </div>
  )
}

// ── Loading skeleton (module-level) ──────────────────────────────────────────

function ModalLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

// ── Main modal component ──────────────────────────────────────────────────────

interface Props {
  documentId: string
  onClose: () => void
}

export default function BuyerDocDetailModal({ documentId, onClose }: Props) {
  const [detail, setDetail]   = useState<FinDocDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDocumentDetail(supabase, documentId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [documentId])

  const meta    = detail ? extractPurchaseSummaryMeta(detail.metadata) : null
  const simOnly = detail ? isSimulationOnly(detail.metadata) : false
  const currency = meta?.master_order.currency ?? detail?.currency ?? 'EUR'

  return (
    <BuyerModal title={detail?.doc_number ?? 'Resumen de compra'} onClose={onClose}>
      {loading && <ModalLoading />}
      {error   && <LightErrorBox message={error} />}

      {detail && !loading && (
        <div className="space-y-4">
          {simOnly && <SimAlert />}

          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Nº pedido</p>
              <p className="font-mono text-gray-900">{detail.doc_number}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Fecha emisión</p>
              <p className="text-gray-700">{fmtDate(detail.issued_at)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Estado</p>
              <p className="text-gray-700 capitalize">{detail.estado.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Total</p>
              <CurrencyAmount
                amount={detail.total_amount}
                currency={detail.currency}
                className="text-gray-900 font-semibold text-sm"
              />
            </div>
          </div>

          {/* Bloques por proveedor */}
          {meta && meta.supplier_orders && meta.supplier_orders.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Pedidos incluidos
              </p>
              {meta.supplier_orders.map(block => (
                <SupplierOrderBlock key={block.order.id} block={block} currency={currency} />
              ))}
            </div>
          )}

          {/* Total checkout */}
          {meta && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-gray-700">Total checkout</span>
              <CurrencyAmount
                amount={meta.master_order.checkout_gross_total}
                currency={currency}
                className="text-gray-900 font-bold text-sm"
              />
            </div>
          )}

          {/* Datos del comprador — si disponibles en buyer_snapshot */}
          {meta?.master_order.buyer_snapshot && Object.keys(meta.master_order.buyer_snapshot).length > 0 && (
            <div className="text-[10px] text-gray-400 space-y-0.5">
              {typeof meta.master_order.buyer_snapshot.nombre === 'string' && meta.master_order.buyer_snapshot.nombre && (
                <p>Comprador: {meta.master_order.buyer_snapshot.nombre}</p>
              )}
              {typeof meta.master_order.buyer_snapshot.nif === 'string' && meta.master_order.buyer_snapshot.nif && (
                <p>NIF: {meta.master_order.buyer_snapshot.nif}</p>
              )}
            </div>
          )}

          {/* Disclaimer — siempre visible */}
          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-3">
            Resumen informativo de la compra realizada en el Marketplace. No constituye factura fiscal.
          </p>
        </div>
      )}
    </BuyerModal>
  )
}
