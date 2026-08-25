// MP-FIN-4 — Provider Orders Tab
// Lista de supplier orders del proveedor con detalle de ítems.
// ISOLATION: Master Order mostrado solo como referencia (numero).
// Nunca se exponen datos financieros de otros proveedores de la misma compra.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ShoppingCart } from 'lucide-react'
import {
  getProviderSupplierOrders, getProviderSupplierOrderDetail,
  type ProviderSupplierOrderListItem, type ProviderSupplierOrderDetail,
} from '../../../lib/marketplace/finance/provider-finance.service'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 20

function OrderDetailModal({
  orderId,
  actorId,
  onClose,
}: {
  orderId: string
  actorId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ProviderSupplierOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProviderSupplierOrderDetail(orderId, actorId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [orderId, actorId])

  const d = detail

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-teal-400" />
          <span className="font-mono">{d?.numero ?? '…'}</span>
          {d && <StatusBadge status={d.estado} />}
        </span>
      }
      onClose={onClose}
    >
      {loading && <div className="text-slate-500 text-xs py-4">Cargando…</div>}
      {error && <ErrorBox message={error} />}
      {d && (
        <div className="space-y-4 text-xs">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Pedido: </span><span className="text-slate-300 font-mono">{d.numero}</span></div>
            {d.master_numero && (
              <div>
                <span className="text-slate-500">Compra ref.: </span>
                <span className="text-slate-400 font-mono">{d.master_numero}</span>
                <span className="ml-1 text-[9px] text-slate-600">(solo referencia)</span>
              </div>
            )}
            <div><span className="text-slate-500">Pago: </span><StatusBadge status={d.payment_status} /></div>
            <div><span className="text-slate-500">Fecha: </span><span className="text-slate-300">{fmtDateTime(d.created_at)}</span></div>
          </div>

          {/* Importe */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importes</div>
            {d.goods_gross_snapshot != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Mercancía (gross)</span>
                <CurrencyAmount amount={d.goods_gross_snapshot} currency={d.currency} className="text-emerald-400" />
              </div>
            )}
            {d.shipping_gross_snapshot != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Envío (gross)</span>
                <CurrencyAmount amount={d.shipping_gross_snapshot} currency={d.currency} />
              </div>
            )}
            <div className="border-t border-slate-700 pt-1 flex justify-between font-semibold">
              <span className="text-white">Total</span>
              <CurrencyAmount amount={d.total} currency={d.currency} className="text-white" />
            </div>
          </div>

          {/* Nota multiproveedor */}
          {d.master_numero && (
            <div className="bg-blue-950/20 border border-blue-800/30 rounded px-3 py-2 text-[10px] text-blue-400">
              Esta compra incluye productos de varios proveedores. Solo ves los datos de tu pedido.
            </div>
          )}

          {/* Líneas */}
          {d.items.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Líneas del pedido</div>
              <div className="divide-y divide-slate-700/50">
                {d.items.map(item => (
                  <div key={item.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="text-slate-200">{item.nombre_producto}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {item.cantidad} × {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(item.precio_unitario)} {item.currency}
                      </div>
                    </div>
                    <CurrencyAmount
                      amount={item.item_gross_snapshot ?? item.precio_total}
                      currency={item.currency}
                      className="text-slate-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-700 font-mono">ID: {d.id}</div>
        </div>
      )}
    </Modal>
  )
}

export default function ProviderOrders({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<ProviderSupplierOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProviderSupplierOrders(actorId, LIMIT, off)
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

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Mis pedidos</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{total} pedido{total !== 1 ? 's' : ''}</span>
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
                <Th>Pedido</Th>
                <Th>Compra ref.</Th>
                <Th>Mercancía</Th>
                <Th>Envío</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8"><EmptyState icon={ShoppingCart} message="Sin pedidos" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.numero}</Td>
                  <Td className="text-slate-500 text-[10px]">
                    {row.master_numero
                      ? <span title="Referencia de compra multiproveedor">{row.master_numero}</span>
                      : '—'}
                  </Td>
                  <Td>
                    {row.goods_gross_snapshot != null
                      ? <CurrencyAmount amount={row.goods_gross_snapshot} currency={row.currency} className="text-emerald-400" />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td>
                    {row.shipping_gross_snapshot != null
                      ? <CurrencyAmount amount={row.shipping_gross_snapshot} currency={row.currency} />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td><StatusBadge status={row.estado} /></Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(row.created_at)}</Td>
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
        <OrderDetailModal
          orderId={selectedId}
          actorId={actorId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
