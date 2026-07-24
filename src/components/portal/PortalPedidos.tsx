import React, { useCallback, useEffect, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOrder, PortalOrderPage,
  getSupplierOrdersUnified, confirmSupplierOrder, shipSupplierOrder,
  ORDER_ESTADO_LABELS, ORDER_TIMELINE, getOrderTimelineStep,
} from '../../lib/api/marketplace-portal';
import {
  prepareOrderFromPortal, shipMarketplaceOrderWithTracking,
} from '../../lib/api/marketplace-orders';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

const ESTADO_OPTS = [
  { value: '',          label: 'Todos' },
  { value: 'pending',   label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped',   label: 'Enviados' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

export default function PortalPedidos({ actorId, membership }: Props) {
  const [page,       setPage]      = useState<PortalOrderPage>({ items: [], totalCount: 0 });
  const [loading,    setLoading]   = useState(true);
  const [estadoFlt,  setEstadoFlt] = useState('');
  const [pageIdx,    setPageIdx]   = useState(0);
  const [error,      setError]     = useState<string | null>(null);
  const [expanded,   setExpanded]  = useState<string | null>(null);
  const [busy,       setBusy]      = useState<string | null>(null);
  // Estado del modal de envío (tracking)
  const [shipModal,  setShipModal]  = useState<string | null>(null);
  const [trackingRef, setTrackingRef] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const LIMIT = 15;

  const load = useCallback(async (estado: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplierOrdersUnified(actorId, {
        estado:  estado || undefined,
        limit:   LIMIT,
        offset:  p * LIMIT,
      });
      setPage(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(estadoFlt, pageIdx); }, [load, estadoFlt, pageIdx]);

  const canManage  = membership.permissions.includes('orders:manage');
  const canFulfill = membership.permissions.includes('orders:fulfillment');
  const totalPages = Math.ceil(page.totalCount / LIMIT);

  const handleConfirm = async (order: PortalOrder) => {
    if (!canManage || busy) return;
    setBusy(order.id);
    try {
      await confirmSupplierOrder(order.id, order.source);
      await load(estadoFlt, pageIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar');
    } finally {
      setBusy(null);
    }
  };

  const handlePrepare = async (order: PortalOrder) => {
    if (!canFulfill || busy) return;
    setBusy(order.id);
    try {
      if (order.source === 'marketplace') {
        await prepareOrderFromPortal(order.id);
      } else {
        // Legacy orders skip directly to ship — no separate preparation step
        await load(estadoFlt, pageIdx);
        return;
      }
      await load(estadoFlt, pageIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar preparación');
    } finally {
      setBusy(null);
    }
  };

  const handleShip = async (order: PortalOrder) => {
    if (!canFulfill || busy) return;
    setBusy(order.id);
    setShipModal(null);
    try {
      if (order.source === 'marketplace') {
        await shipMarketplaceOrderWithTracking({
          orderId:    order.id,
          trackingRef: trackingRef || undefined,
          trackingUrl: trackingUrl || undefined,
        });
      } else {
        await shipSupplierOrder(order.id, order.source, trackingRef || undefined);
      }
      await load(estadoFlt, pageIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al marcar enviado');
    } finally {
      setBusy(null);
      setTrackingRef('');
      setTrackingUrl('');
    }
  };

  const openShipModal = (order: PortalOrder) => {
    setShipModal(order.id);
    setTrackingRef('');
    setTrackingUrl('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center gap-3 flex-wrap">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pedidos</h1>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {ESTADO_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEstadoFlt(opt.value); setPageIdx(0); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                estadoFlt === opt.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {page.totalCount} pedido{page.totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <OrdersSkeleton />
        ) : page.items.length === 0 ? (
          <div className="flex flex-col h-40 items-center justify-center gap-2">
            <p className="text-sm text-slate-400">No hay pedidos en este estado.</p>
          </div>
        ) : (
          page.items.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded === order.id}
              busy={busy === order.id}
              canManage={canManage}
              canFulfill={canFulfill}
              onToggle={() => setExpanded((prev) => prev === order.id ? null : order.id)}
              onConfirm={() => handleConfirm(order)}
              onPrepare={() => handlePrepare(order)}
              onShip={() => openShipModal(order)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-400 tabular-nums">{pageIdx + 1} / {totalPages}</span>
          <button
            onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIdx >= totalPages - 1}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal de envío con tracking */}
      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Marcar como enviado</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Referencia de tracking (opcional)</label>
                <input
                  type="text"
                  value={trackingRef}
                  onChange={(e) => setTrackingRef(e.target.value)}
                  placeholder="Ej: ES123456789"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">URL de tracking (opcional)</label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://seguimiento.correos.es/..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShipModal(null)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const order = page.items.find((o) => o.id === shipModal);
                  if (order) handleShip(order);
                }}
                disabled={!!busy}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Enviando...' : 'Confirmar envío'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order:      PortalOrder;
  expanded:   boolean;
  busy:       boolean;
  canManage:  boolean;
  canFulfill: boolean;
  onToggle:   () => void;
  onConfirm:  () => void;
  onPrepare:  () => void;
  onShip:     () => void;
}

const ESTADO_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  shipped:   'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

function OrderCard({ order, expanded, busy, canManage, canFulfill, onToggle, onConfirm, onPrepare, onShip }: OrderCardProps) {
  const timelineStep = getOrderTimelineStep(order.estado);
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 transition-all ${
      order.estado === 'pending' ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{order.numero}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[order.estado] ?? ESTADO_BADGE.pending}`}>
              {ORDER_ESTADO_LABELS[order.estado] ?? order.estado}
            </span>
            {order.source === 'marketplace' && (
              <span className="rounded-full bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-400">
                Marketplace
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 truncate">{order.org_nombre}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtDate(order.created_at)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmt(order.total)}</p>
          <p className="text-xs text-slate-400">{order.items_count} línea{order.items_count !== 1 ? 's' : ''}</p>
        </div>
        <svg className={`h-4 w-4 text-slate-400 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Timeline visual */}
      {order.estado !== 'cancelled' && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-0">
            {ORDER_TIMELINE.map((step, idx) => {
              const isActive = idx === timelineStep;
              const isPast   = idx < timelineStep;
              return (
                <React.Fragment key={step.estado}>
                  {idx > 0 && (
                    <div className={`h-0.5 flex-1 transition-colors ${isPast ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                      isActive || isPast
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                    }`} />
                    <span className={`text-[9px] leading-none whitespace-nowrap ${
                      isActive ? 'text-teal-500 font-semibold' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          {order.notas && (
            <p className="text-xs text-slate-500 italic mb-3">"{order.notas}"</p>
          )}

          <div className="grid grid-cols-3 gap-3 text-xs mb-4">
            {order.confirmed_at && (
              <div>
                <p className="text-slate-400">Confirmado</p>
                <p className="text-slate-700 dark:text-slate-300">{fmtDate(order.confirmed_at)}</p>
              </div>
            )}
            {order.shipped_at && (
              <div>
                <p className="text-slate-400">Enviado</p>
                <p className="text-slate-700 dark:text-slate-300">{fmtDate(order.shipped_at)}</p>
              </div>
            )}
            {order.completed_at && (
              <div>
                <p className="text-slate-400">Completado</p>
                <p className="text-slate-700 dark:text-slate-300">{fmtDate(order.completed_at)}</p>
              </div>
            )}
          </div>

          {/* Actions — ciclo completo */}
          <div className="flex gap-2">
            {order.estado === 'pending' && canManage && (
              <button
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                disabled={busy}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Confirmando...' : 'Confirmar pedido'}
              </button>
            )}
            {order.estado === 'confirmed' && canFulfill && order.source === 'marketplace' && (
              <button
                onClick={(e) => { e.stopPropagation(); onPrepare(); }}
                disabled={busy}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Actualizando...' : 'Iniciar preparación'}
              </button>
            )}
            {(order.estado === 'confirmed' || order.estado === 'preparing') && canFulfill && (
              <button
                onClick={(e) => { e.stopPropagation(); onShip(); }}
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Actualizando...' : 'Marcar como enviado'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}
