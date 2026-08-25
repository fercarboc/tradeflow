// MP-FIN-3 — Finance Orders Tab
// Lista de Master Orders con drill-down a Supplier Orders.
// GMV = checkout_gross_total (no revenue TrabFlow).

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, ChevronRight, X } from 'lucide-react'
import {
  getAdminMasterOrders, getAdminSupplierOrders,
  type AdminMasterOrderRow, type AdminSupplierOrderRow,
} from '../../../lib/marketplace/finance/admin-finance.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge,
  fmtDate, fmtShortId, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'
import { ShoppingCart } from 'lucide-react'

const LIMIT = 25

// ── Supplier Order Detail Panel ─────────────────────────────────────────────

function SupplierOrderPanel({
  order,
  onClose,
}: {
  order: AdminSupplierOrderRow
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <div className="text-sm font-bold text-white font-mono">{order.numero}</div>
            <div className="text-[10px] text-slate-400">Supplier Order</div>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-500">Proveedor: </span><span className="text-slate-200">{order.actor_nombre ?? '—'}</span></div>
            <div><span className="text-slate-500">Master Order: </span><span className="text-slate-200 font-mono">{order.master_numero ?? '—'}</span></div>
            <div><span className="text-slate-500">Estado: </span><FinancialStatusBadge status={order.estado} /></div>
            <div><span className="text-slate-500">Pago: </span><FinancialStatusBadge status={order.payment_status} /></div>
            <div><span className="text-slate-500">Fecha: </span><span className="text-slate-200">{fmtDate(order.created_at)}</span></div>
            <div><span className="text-slate-500">Currency: </span><span className="text-slate-200">{order.currency}</span></div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Importe</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Subtotal (goods)</span>
              <CurrencyAmount amount={order.subtotal} currency={order.currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Envío</span>
              <CurrencyAmount amount={order.coste_envio} currency={order.currency} />
            </div>
            <div className="border-t border-slate-700 pt-1.5 flex justify-between font-semibold">
              <span className="text-white">Total</span>
              <CurrencyAmount amount={order.total} currency={order.currency} className="text-white font-semibold" />
            </div>
          </div>

          {(order.goods_gross_snapshot != null || order.shipping_gross_snapshot != null) && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-1 text-xs">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Snapshots financieros</div>
              {order.goods_gross_snapshot != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">goods_gross_snapshot</span>
                  <CurrencyAmount amount={order.goods_gross_snapshot} currency={order.currency} className="text-slate-400" />
                </div>
              )}
              {order.shipping_gross_snapshot != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">shipping_gross_snapshot</span>
                  <CurrencyAmount amount={order.shipping_gross_snapshot} currency={order.currency} className="text-slate-400" />
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-600 font-mono">ID: {order.id}</div>
        </div>
      </div>
    </div>
  )
}

// ── Master Order Detail Panel ───────────────────────────────────────────────

function MasterOrderPanel({
  order,
  onClose,
}: {
  order: AdminMasterOrderRow
  onClose: () => void
}) {
  const [supplierOrders, setSupplierOrders] = useState<AdminSupplierOrderRow[]>([])
  const [loadingSO, setLoadingSO] = useState(true)
  const [selectedSO, setSelectedSO] = useState<AdminSupplierOrderRow | null>(null)

  useEffect(() => {
    getAdminSupplierOrders({ masterOrderId: order.id, limit: 50 })
      .then(r => setSupplierOrders(r.items))
      .catch(console.error)
      .finally(() => setLoadingSO(false))
  }, [order.id])

  const netPos = order.checkout_gross_total - order.refund_gross_total

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div>
              <div className="text-sm font-bold text-white font-mono">{order.numero}</div>
              <div className="text-[10px] text-slate-400">Master Order · {order.supplier_orders_count} proveedor{order.supplier_orders_count !== 1 ? 'es' : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <FinancialStatusBadge status={order.order_status} />
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Resumen económico */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Fecha: </span><span className="text-slate-200">{fmtDate(order.created_at)}</span></div>
              <div><span className="text-slate-500">Currency: </span><span className="text-slate-200">{order.currency}</span></div>
              <div><span className="text-slate-500">Pago: </span><FinancialStatusBadge status={order.payment_status} /></div>
              <div><span className="text-slate-500">Checkout key: </span><span className="text-slate-500 font-mono text-[10px]">{fmtShortId(order.checkout_key)}</span></div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Resumen económico</div>
              <div className="flex justify-between">
                <span className="text-slate-400">Items (goods)</span>
                <CurrencyAmount amount={order.goods_gross_total} currency={order.currency} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Envío</span>
                <CurrencyAmount amount={order.shipping_gross_total} currency={order.currency} />
              </div>
              <div className="border-t border-slate-700 pt-1.5 flex justify-between font-semibold">
                <span className="text-white">Total original</span>
                <CurrencyAmount amount={order.checkout_gross_total} currency={order.currency} className="text-white font-semibold" />
              </div>
              {order.refund_gross_total > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-orange-400">Refunds</span>
                    <CurrencyAmount amount={-order.refund_gross_total} currency={order.currency} className="text-orange-400" />
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-300">
                    <span>Posición neta</span>
                    <CurrencyAmount amount={netPos} currency={order.currency} className="text-emerald-300 font-semibold" />
                  </div>
                </>
              )}
            </div>

            {/* Supplier Orders */}
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Supplier Orders</div>
              {loadingSO ? (
                <div className="text-xs text-slate-500 py-2">Cargando…</div>
              ) : supplierOrders.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">Sin supplier orders</div>
              ) : (
                <div className="space-y-1">
                  {supplierOrders.map(so => (
                    <button key={so.id} onClick={() => setSelectedSO(so)}
                      className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2 transition-colors cursor-pointer">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-200">{so.numero}</span>
                          <FinancialStatusBadge status={so.estado} />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{so.actor_nombre ?? so.actor_id.slice(0, 8)}</div>
                      </div>
                      <div className="text-right">
                        <CurrencyAmount amount={so.total} currency={so.currency} className="text-sm text-white font-semibold" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-600 font-mono">ID: {order.id}</div>
          </div>
        </div>
      </div>
      {selectedSO && <SupplierOrderPanel order={selectedSO} onClose={() => setSelectedSO(null)} />}
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function FinanceOrders() {
  const [items, setItems] = useState<AdminMasterOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminMasterOrderRow | null>(null)

  const load = useCallback(async (off = offset, q = search) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminMasterOrders({ limit: LIMIT, offset: off, search: q || undefined })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [offset, search])

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setOffset(0); load(0, search) }
  const handlePrev = () => { const o = Math.max(0, offset - LIMIT); setOffset(o); load(o) }
  const handleNext = () => { const o = offset + LIMIT; setOffset(o); load(o) }

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Filtros */}
      <form onSubmit={handleSearch} className="flex gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <input type="text" placeholder="Buscar número…" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:border-blue-500 placeholder-slate-600" />
        </div>
        <button type="submit" className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors">
          Buscar
        </button>
        <button type="button" onClick={() => { load() }}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500 ml-1">{total} pedido{total !== 1 ? 's' : ''}</span>
      </form>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      {/* Tabla */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Master Order</Th>
                <Th>Fecha</Th>
                <Th>Proveedores</Th>
                <Th>GMV</Th>
                <Th>Refunds</Th>
                <Th>Posición neta</Th>
                <Th>Estado</Th>
                <Th>Pago</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8">
                    <EmptyState icon={ShoppingCart} message="Sin pedidos financieros" />
                  </td>
                </tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelected(row)}>
                  <Td mono className="text-slate-200 font-semibold">{row.numero}</Td>
                  <Td className="text-slate-400">{fmtDate(row.created_at)}</Td>
                  <Td className="text-slate-300">{row.supplier_orders_count}</Td>
                  <Td>
                    <CurrencyAmount amount={row.checkout_gross_total} currency={row.currency} className="text-blue-300" />
                  </Td>
                  <Td>
                    {row.refund_gross_total > 0
                      ? <CurrencyAmount amount={-row.refund_gross_total} currency={row.currency} className="text-orange-400" />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td>
                    <CurrencyAmount
                      amount={row.checkout_gross_total - row.refund_gross_total}
                      currency={row.currency}
                      className="text-white font-semibold"
                    />
                  </Td>
                  <Td><FinancialStatusBadge status={row.order_status} /></Td>
                  <Td><FinancialStatusBadge status={row.payment_status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar total={total} limit={LIMIT} offset={offset} onPrev={handlePrev} onNext={handleNext} />
        )}
      </div>

      {selected && <MasterOrderPanel order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
