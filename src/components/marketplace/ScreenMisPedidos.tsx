import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveOrder, OrderHistoryRow, OrderFullDetail,
  getOrgActiveOrders, getOrgOrderHistory, getOrderFullDetail,
  deliverMarketplaceOrder, cancelMarketplaceOrder,
  LIFECYCLE_ESTADO_LABELS, LIFECYCLE_TIMELINE, getLifecycleStep,
} from '../../lib/api/marketplace-orders';
import type { OrderLifecycleEstado } from '../../lib/api/marketplace-orders';
import { useSession } from '../../context/SessionContext';
import ConfirmModal from './shared/ConfirmModal';
import { getPurchaseSummaryByOrderId } from '../../lib/marketplace/finance/marketplace-purchase-summary.service';
import { downloadMarketplacePurchaseSummary } from '../../lib/printMarketplacePurchase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Estado badge ─────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<OrderLifecycleEstado, string> = {
  pending:   'bg-amber-100 text-amber-700 border border-amber-200',
  confirmed: 'bg-blue-100 text-blue-700 border border-blue-200',
  preparing: 'bg-violet-100 text-violet-700 border border-violet-200',
  shipped:   'bg-cyan-100 text-cyan-700 border border-cyan-200',
  delivered: 'bg-teal-100 text-teal-700 border border-teal-200',
  completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

function EstadoBadge({ estado }: { estado: OrderLifecycleEstado }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[estado]}`}>
      {LIFECYCLE_ESTADO_LABELS[estado]}
    </span>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ estado }: { estado: OrderLifecycleEstado }) {
  const currentStep = getLifecycleStep(estado);
  const isCancelled = estado === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-red-500 text-xs font-medium py-2">
        <div className="w-5 h-5 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-[10px]">✕</div>
        Pedido cancelado
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto pb-1">
      {LIFECYCLE_TIMELINE.map((step, idx) => {
        const past    = idx < currentStep;
        const current = idx === currentStep;
        return (
          <div key={step.estado} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-colors ${
                past    ? 'bg-emerald-500 border-emerald-500 text-white'
                : current ? 'bg-[#1A5A96] border-[#1A5A96] text-white'
                : 'bg-white border-gray-200 text-gray-400'
              }`}>
                {past ? '✓' : idx + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium leading-tight text-center max-w-[52px] ${
                current ? 'text-[#1A5A96]' : past ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < LIFECYCLE_TIMELINE.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${past ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

interface OrderCardProps {
  order:   ActiveOrder | OrderHistoryRow;
  onClick: () => void;
}

function OrderCard({ order, onClick }: OrderCardProps) {
  const isShipped = order.estado === 'shipped';

  return (
    <article
      onClick={onClick}
      className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all group ${
        isShipped ? 'border-cyan-300 ring-1 ring-cyan-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{order.numero}</span>
            <EstadoBadge estado={order.estado} />
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-gray-900 text-sm tabular-nums">{fmtEur(order.total)}</p>
            <p className="text-[10px] text-gray-400 tabular-nums">
              {order.items_count} artículo{order.items_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="space-y-0.5 text-xs text-gray-500 mb-3">
          <p className="text-[11px] text-gray-400">{fmtDate(order.created_at)}</p>
          <p className="font-medium text-gray-700">{order.actor_nombre}</p>
          {order.cliente_nombre && <p>Cliente: {order.cliente_nombre}</p>}
          {order.source_ref && (
            <p className="font-mono text-[10px] text-gray-400">{order.source_ref}</p>
          )}
          {order.obra_nombre && <p className="text-gray-400 italic text-[10px]">{order.obra_nombre}</p>}
        </div>

        {'tracking_ref' in order && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Timeline estado={order.estado} />
          </div>
        )}

        <div className="flex justify-end mt-2">
          <span className="text-[11px] text-[#1A5A96] font-semibold group-hover:underline">
            Ver detalle →
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Panel de detalle ─────────────────────────────────────────────────────────

interface DetailPanelProps {
  orderId:   string | null;
  onClose:   () => void;
  onDeliver: (id: string) => void;
  onCancel:  (id: string) => void;
}

function DetailPanel({ orderId, onClose, onDeliver, onCancel }: DetailPanelProps) {
  const [detail,  setDetail]  = useState<OrderFullDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) { setDetail(null); return; }
    setLoading(true);
    getOrderFullDetail(orderId)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (!orderId) return null;

  const order  = detail?.order;
  const items  = detail?.items ?? [];
  const estado = order?.estado as OrderLifecycleEstado | undefined;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Pedido</p>
            <h2 className="text-gray-900 font-bold text-base">{order?.numero ?? '...'}</h2>
          </div>
          <div className="flex items-center gap-3">
            {estado && <EstadoBadge estado={estado} />}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Cerrar">
              ×
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1A5A96] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && detail && order && (
          <div className="flex-1 overflow-y-auto">
            {/* Resumen */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Resumen</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Proveedor</dt>
                  <dd className="font-medium text-gray-900 text-right">{order.actor_nombre}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fecha</dt>
                  <dd className="text-gray-700">{fmtDate(order.created_at)}</dd>
                </div>
                {order.notas_proveedor && (
                  <div>
                    <dt className="text-gray-500 mb-1">Nota del proveedor</dt>
                    <dd className="text-gray-700 text-xs bg-gray-50 rounded-lg p-2">{order.notas_proveedor}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Productos */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
                Productos ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.descripcion}</p>
                      {item.referencia && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">Ref: {item.referencia}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.cantidad} {item.unidad}
                        {item.precio_unitario != null && ` · ${fmtEur(item.precio_unitario)}/ud`}
                      </p>
                    </div>
                    {item.precio_total != null && (
                      <p className="font-bold text-sm text-gray-900 tabular-nums shrink-0">{fmtEur(item.precio_total)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Entrega */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Entrega</h3>
              <dl className="space-y-2 text-sm">
                {order.delivery_address && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">Dirección</dt>
                    <dd className="text-gray-700">{order.delivery_address}</dd>
                  </div>
                )}
                {order.tracking_ref && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">Nº seguimiento</dt>
                    <dd className="font-mono text-xs text-gray-700">
                      {order.tracking_url ? (
                        <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-[#1A5A96] underline">
                          {order.tracking_ref}
                        </a>
                      ) : order.tracking_ref}
                    </dd>
                  </div>
                )}
                {!order.delivery_address && !order.tracking_ref && (
                  <p className="text-gray-400 text-sm">Información de entrega no disponible aún</p>
                )}
              </dl>
            </section>

            {/* Importe */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Importe</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="tabular-nums text-gray-700">{fmtEur(order.subtotal)}</dd>
                </div>
                {order.coste_envio > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Portes</dt>
                    <dd className="tabular-nums text-gray-700">{fmtEur(order.coste_envio)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <dt className="font-semibold text-gray-900">Total</dt>
                  <dd className="font-bold text-gray-900 tabular-nums">{fmtEur(order.total)}</dd>
                </div>
              </dl>
            </section>

            {/* Documentos */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Documentos</h3>
              <button
                onClick={async () => {
                  if (!orderId) return;
                  try {
                    const summary = await getPurchaseSummaryByOrderId(orderId);
                    if (summary) downloadMarketplacePurchaseSummary(summary);
                  } catch { /* si falla, no bloquear UI */ }
                }}
                className="flex items-center gap-2 text-sm text-[#1A5A96] hover:text-[#154d82] font-medium transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Resumen de compra (PDF)
              </button>
            </section>

            {/* Seguimiento */}
            <section className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Seguimiento</h3>
              {estado && <Timeline estado={estado} />}
              <dl className="mt-3 space-y-1 text-xs text-gray-500">
                {order.confirmed_at  && <div className="flex gap-2"><dt className="w-28 shrink-0">Confirmado</dt><dd>{fmtDateTime(order.confirmed_at)}</dd></div>}
                {order.preparing_at  && <div className="flex gap-2"><dt className="w-28 shrink-0">En preparación</dt><dd>{fmtDateTime(order.preparing_at)}</dd></div>}
                {order.shipped_at    && <div className="flex gap-2"><dt className="w-28 shrink-0">Enviado</dt><dd>{fmtDateTime(order.shipped_at)}</dd></div>}
                {order.delivered_at  && <div className="flex gap-2"><dt className="w-28 shrink-0">Entregado</dt><dd>{fmtDateTime(order.delivered_at)}</dd></div>}
                {order.cancelled_at  && <div className="flex gap-2"><dt className="w-28 shrink-0">Cancelado</dt><dd>{fmtDateTime(order.cancelled_at)}</dd></div>}
              </dl>
            </section>

            {/* Acciones */}
            {(estado === 'shipped' || ['pending','confirmed','preparing'].includes(estado ?? '')) && (
              <section className="px-5 py-4">
                <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Acciones</h3>
                <div className="flex flex-wrap gap-2">
                  {estado === 'shipped' && (
                    <button
                      onClick={() => onDeliver(order.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Confirmar recepción
                    </button>
                  )}
                  {['pending','confirmed','preparing'].includes(estado ?? '') && (
                    <button
                      onClick={() => onCancel(order.id)}
                      className="bg-white border border-red-200 hover:border-red-400 text-red-500 hover:text-red-600 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type TabKey = 'activos' | 'historial';

const HIST_PAGE_SIZE = 20;

export default function ScreenMisPedidos() {
  const { org } = useSession();

  const [activeOrders,  setActiveOrders]  = useState<ActiveOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderHistoryRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [histPage,      setHistPage]      = useState(0);
  const [histTotal,     setHistTotal]     = useState(0);

  const [tab,          setTab]          = useState<TabKey>('activos');
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [confirmModal, setConfirmModal] = useState<{ id: string; action: 'deliver' | 'cancel' } | null>(null);
  const [busy,         setBusy]         = useState(false);

  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const [activeRes, histRes] = await Promise.all([
        getOrgActiveOrders({ orgId: org.id, limit: 50, offset: 0 }),
        getOrgOrderHistory({ orgId: org.id, limit: HIST_PAGE_SIZE, offset: 0 }),
      ]);
      setActiveOrders(activeRes.items);
      setHistoryOrders(histRes.items);
      setHistTotal(histRes.totalCount);
      setHistPage(0);
    } catch { /* noop */ } finally {
      setLoading(false);
      loadedRef.current = true;
    }
  }, [org?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadMoreHistory = useCallback(async () => {
    if (!org?.id) return;
    const next = histPage + 1;
    const res = await getOrgOrderHistory({
      orgId:  org.id,
      limit:  HIST_PAGE_SIZE,
      offset: next * HIST_PAGE_SIZE,
    });
    setHistoryOrders(prev => [...prev, ...res.items]);
    setHistPage(next);
  }, [org?.id, histPage]);

  function matchSearch(q: string, o: ActiveOrder | OrderHistoryRow): boolean {
    if (!q.trim()) return true;
    const lq = q.toLowerCase();
    return (
      o.numero.toLowerCase().includes(lq) ||
      o.actor_nombre.toLowerCase().includes(lq) ||
      (o.cliente_nombre ?? '').toLowerCase().includes(lq) ||
      (o.source_ref ?? '').toLowerCase().includes(lq)
    );
  }

  function matchFecha(d: string, from: string, to: string): boolean {
    if (!from && !to) return true;
    const dt = new Date(d).getTime();
    if (from && dt < new Date(from).getTime()) return false;
    if (to   && dt > new Date(to + 'T23:59:59').getTime()) return false;
    return true;
  }

  const filteredActive = activeOrders.filter(o =>
    matchSearch(searchQuery, o) &&
    (estadoFilter === 'all' || o.estado === estadoFilter) &&
    matchFecha(o.created_at, dateFrom, dateTo),
  );

  const filteredHistory = historyOrders.filter(o =>
    matchSearch(searchQuery, o) &&
    (estadoFilter === 'all' || o.estado === estadoFilter) &&
    matchFecha(o.created_at, dateFrom, dateTo),
  );

  const hasFilters = Boolean(searchQuery || estadoFilter !== 'all' || dateFrom || dateTo);
  const kpiEnCurso = activeOrders.filter(o => !['completed','cancelled'].includes(o.estado)).length;

  const handleDeliver = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await deliverMarketplaceOrder(id);
      await loadData();
    } catch { /* noop */ } finally {
      setBusy(false);
      setConfirmModal(null);
      setSelectedId(null);
    }
  }, [loadData]);

  const handleCancel = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await cancelMarketplaceOrder(id);
      await loadData();
    } catch { /* noop */ } finally {
      setBusy(false);
      setConfirmModal(null);
      setSelectedId(null);
    }
  }, [loadData]);

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-0">
      {/* Cabecera */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis pedidos</h1>
            <p className="text-sm text-gray-400 mt-0.5">Consulta y gestiona tus compras de material</p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            ↺ Actualizar
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
          <button
            onClick={() => setTab('activos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium transition-colors ${
              tab === 'activos'
                ? 'bg-[#1A5A96] text-white border-[#1A5A96]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            En curso
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === 'activos' ? 'bg-white/20' : 'bg-gray-100'}`}>
              {kpiEnCurso}
            </span>
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium transition-colors ${
              tab === 'historial'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Historial
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === 'historial' ? 'bg-white/20' : 'bg-gray-100'}`}>
              {histTotal}
            </span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[180px] max-w-xs">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar pedido, proveedor, cliente..."
              className="bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none flex-1"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:border-[#1A5A96]"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente de confirmar</option>
            <option value="confirmed">Confirmado</option>
            <option value="preparing">En preparación</option>
            <option value="shipped">Enviado</option>
            <option value="delivered">Entregado</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A5A96]"
            />
            <span>hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A5A96]"
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(''); setEstadoFilter('all'); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Listado */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1A5A96] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && tab === 'activos' && (
          filteredActive.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">
                {hasFilters ? 'Sin pedidos que coincidan con los filtros' : 'No hay pedidos en curso'}
              </p>
              {!hasFilters && (
                <p className="text-gray-400 text-xs mt-1">
                  Los pedidos aparecerán aquí cuando compres materiales desde un presupuesto
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActive.map(o => (
                <OrderCard key={o.id} order={o} onClick={() => setSelectedId(o.id)} />
              ))}
            </div>
          )
        )}

        {!loading && tab === 'historial' && (
          filteredHistory.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm font-medium">
                {hasFilters ? 'Sin pedidos que coincidan con los filtros' : 'Sin historial de pedidos'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredHistory.map(o => (
                  <OrderCard key={o.id} order={o} onClick={() => setSelectedId(o.id)} />
                ))}
              </div>
              {historyOrders.length < histTotal && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreHistory}
                    className="text-sm text-[#1A5A96] border border-[#1A5A96]/30 hover:border-[#1A5A96] px-6 py-2 rounded-lg transition-colors"
                  >
                    Cargar más pedidos
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* SlideOver detalle */}
      {selectedId && (
        <DetailPanel
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeliver={id => setConfirmModal({ id, action: 'deliver' })}
          onCancel={id  => setConfirmModal({ id, action: 'cancel'  })}
        />
      )}

      {/* Modal confirmación */}
      {confirmModal && (
        <ConfirmModal
          open
          title={confirmModal.action === 'deliver' ? 'Confirmar recepción' : 'Cancelar pedido'}
          description={
            confirmModal.action === 'deliver'
              ? '¿Has recibido este pedido? Esta acción marcará el pedido como entregado y notificará al proveedor.'
              : '¿Seguro que quieres cancelar este pedido? Se notificará al proveedor del material.'
          }
          confirmLabel={confirmModal.action === 'deliver' ? 'Confirmar recepción' : 'Sí, cancelar'}
          confirmClassName={
            confirmModal.action === 'deliver'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }
          loading={busy}
          onConfirm={() => {
            if (confirmModal.action === 'deliver') handleDeliver(confirmModal.id);
            else handleCancel(confirmModal.id);
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
