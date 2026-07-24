import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../../types';
import {
  ActiveOrder, OrderHistoryRow, OrderFullDetail, OrderEvent,
  getOrgActiveOrders, getOrgOrderHistory, getOrderFullDetail, getOrderEvents,
  deliverMarketplaceOrder, cancelMarketplaceOrder,
  LIFECYCLE_ESTADO_LABELS, LIFECYCLE_ESTADO_COLORS, LIFECYCLE_TIMELINE,
  getLifecycleStep, EVENT_TYPE_LABELS,
} from '../../lib/api/marketplace-orders';
import { useSession } from '../../context/SessionContext';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

type Tab = 'activos' | 'historial';

export default function ScreenSeguimientoMaterial({ setCurrentPage, session }: Props) {
  const { org } = useSession();
  const orgId = org?.id ?? null;
  const [tab,         setTab]         = useState<Tab>('activos');
  const [activos,     setActivos]     = useState<ActiveOrder[]>([]);
  const [historial,   setHistorial]   = useState<OrderHistoryRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [detail,      setDetail]      = useState<OrderFullDetail | null>(null);
  const [events,      setEvents]      = useState<OrderEvent[]>([]);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [busy,        setBusy]        = useState<string | null>(null);

  useEffect(() => {
    if (!session) setCurrentPage(ActivePage.Login);
  }, [session, setCurrentPage]);

  const loadActivos = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { items } = await getOrgActiveOrders({ orgId });
      setActivos(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadHistorial = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { items } = await getOrgOrderHistory({ orgId });
      setHistorial(items);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (tab === 'activos')  loadActivos();
    else                    loadHistorial();
  }, [tab, loadActivos, loadHistorial]);

  const toggleExpand = async (orderId: string) => {
    if (expanded === orderId) {
      setExpanded(null);
      setDetail(null);
      setEvents([]);
      return;
    }
    setExpanded(orderId);
    setDetailLoad(true);
    try {
      const [d, ev] = await Promise.all([
        getOrderFullDetail(orderId),
        getOrderEvents(orderId),
      ]);
      setDetail(d);
      setEvents(ev);
    } catch {
      setDetail(null);
      setEvents([]);
    } finally {
      setDetailLoad(false);
    }
  };

  const handleDeliver = async (orderId: string) => {
    if (busy) return;
    setBusy(orderId);
    try {
      await deliverMarketplaceOrder(orderId, 'Recepción confirmada por el instalador');
      await loadActivos();
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar entrega');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (busy) return;
    if (!confirm('¿Cancelar este pedido? Esta acción no se puede deshacer.')) return;
    setBusy(orderId);
    try {
      await cancelMarketplaceOrder(orderId, 'Cancelado por el instalador');
      await loadActivos();
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar');
    } finally {
      setBusy(null);
    }
  };

  const pendingDelivery = activos.filter((o) => o.estado === 'shipped').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Seguimiento de material</h1>
          </div>
          {pendingDelivery > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {pendingDelivery} en tránsito
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-4xl flex">
          {(['activos', 'historial'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'activos' ? 'Pedidos activos' : 'Historial'}
              {t === 'activos' && activos.length > 0 && (
                <span className="ml-2 rounded-full bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 text-xs text-teal-600 dark:text-teal-400">
                  {activos.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2.5">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-4 space-y-3">
          {loading ? (
            <OrdersSkeleton />
          ) : tab === 'activos' ? (
            activos.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No hay pedidos activos"
                desc="Cuando realices una compra en el Marketplace, podrás hacer seguimiento aquí."
              />
            ) : (
              activos.map((order) => (
                <ActiveOrderCard
                  key={order.id}
                  order={order}
                  expanded={expanded === order.id}
                  detail={detail}
                  events={events}
                  detailLoading={detailLoad && expanded === order.id}
                  busy={busy === order.id}
                  onToggle={() => toggleExpand(order.id)}
                  onDeliver={() => handleDeliver(order.id)}
                  onCancel={() => handleCancel(order.id)}
                />
              ))
            )
          ) : (
            historial.length === 0 ? (
              <EmptyState
                icon="📋"
                title="Sin historial aún"
                desc="Los pedidos completados o cancelados aparecerán aquí."
              />
            ) : (
              historial.map((order) => (
                <HistoryCard key={order.id} order={order} />
              ))
            )
          )}
        </div>
      </main>
    </div>
  );
}

// ─── ActiveOrderCard ──────────────────────────────────────────────────────────

interface ActiveCardProps {
  order:         ActiveOrder;
  expanded:      boolean;
  detail:        OrderFullDetail | null;
  events:        OrderEvent[];
  detailLoading: boolean;
  busy:          boolean;
  onToggle:      () => void;
  onDeliver:     () => void;
  onCancel:      () => void;
}

function ActiveOrderCard({ order, expanded, detail, events, detailLoading, busy, onToggle, onDeliver, onCancel }: ActiveCardProps) {
  const stepIdx = getLifecycleStep(order.estado);
  const canDeliver = order.estado === 'shipped';
  const canCancel  = ['pending','confirmed','preparing'].includes(order.estado);

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const isUrgent = order.estado === 'shipped';

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-all ${
      isUrgent ? 'border-teal-300 dark:border-teal-700' : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{order.numero}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_ESTADO_COLORS[order.estado]}`}>
              {LIFECYCLE_ESTADO_LABELS[order.estado]}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {order.actor_nombre}
            {order.actor_verificado && (
              <svg className="inline ml-1 h-3.5 w-3.5 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </p>
          {order.source_ref && (
            <p className="text-xs text-slate-400 mt-0.5">Presupuesto: {order.source_ref}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {order.total.toFixed(2)} €
          </p>
          <p className="text-xs text-slate-400">
            {order.items_count} artículo{order.items_count !== 1 ? 's' : ''}
          </p>
        </div>
        <svg className={`h-4 w-4 text-slate-400 mt-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Timeline */}
      {order.estado !== 'cancelled' && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-0">
            {LIFECYCLE_TIMELINE.map((step, idx) => {
              const isActive = idx === stepIdx;
              const isPast   = idx < stepIdx;
              return (
                <React.Fragment key={step.estado}>
                  {idx > 0 && (
                    <div className={`h-0.5 flex-1 transition-colors ${
                      isPast ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`} />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                      isActive || isPast
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                    }`} />
                    <span className={`text-[9px] leading-none ${
                      isActive ? 'text-teal-600 dark:text-teal-400 font-semibold' : 'text-slate-400'
                    }`}>{step.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Tracking pill */}
      {order.tracking_ref && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Tracking: <span className="font-mono font-medium">{order.tracking_ref}</span>
            </span>
            {order.tracking_url && (
              <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                className="ml-auto text-xs text-teal-600 hover:text-teal-500 font-medium">
                Seguir →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {detailLoading ? (
            <div className="p-5 space-y-2 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Nota del proveedor */}
              {order.notas_proveedor && (
                <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Nota del proveedor</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">{order.notas_proveedor}</p>
                </div>
              )}

              {/* Items del pedido */}
              {detail?.items && detail.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Artículos</p>
                  <div className="space-y-1">
                    {detail.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 dark:text-slate-200 truncate">{item.descripcion}</p>
                          {item.referencia && (
                            <p className="text-xs text-slate-400 font-mono">{item.referencia}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="text-slate-600 dark:text-slate-400 tabular-nums">
                            {item.cantidad} {item.unidad}
                          </p>
                          {item.precio_total != null && (
                            <p className="text-xs text-slate-400 tabular-nums">{item.precio_total.toFixed(2)} €</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fechas clave */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {order.confirmed_at && (
                  <div>
                    <p className="text-xs text-slate-400">Confirmado</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {fmtDate(order.confirmed_at)}
                    </p>
                  </div>
                )}
                {order.preparing_at && (
                  <div>
                    <p className="text-xs text-slate-400">En preparación</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {fmtDate(order.preparing_at)}
                    </p>
                  </div>
                )}
                {order.shipped_at && (
                  <div>
                    <p className="text-xs text-slate-400">Enviado</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {fmtDate(order.shipped_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeline de eventos */}
              {events.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Actividad</p>
                  <div className="space-y-2">
                    {events.slice(0, 5).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                        <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                          ev.actor_type === 'installer' ? 'bg-teal-400'
                          : ev.actor_type === 'supplier' ? 'bg-blue-400'
                          : 'bg-slate-300'
                        }`} />
                        <div>
                          <p className="text-slate-700 dark:text-slate-300">
                            {EVENT_TYPE_LABELS[ev.tipo] ?? ev.tipo}
                            {ev.to_estado && (
                              <span className="ml-1 text-slate-400">→ {(LIFECYCLE_ESTADO_LABELS as Record<string, string>)[ev.to_estado!] ?? ev.to_estado}</span>
                            )}
                          </p>
                          {ev.notas && (
                            <p className="text-slate-400 italic mt-0.5">"{ev.notas}"</p>
                          )}
                          <p className="text-slate-400 mt-0.5">
                            {new Date(ev.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-2">
                {canDeliver && (
                  <button
                    onClick={onDeliver}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
                  >
                    {busy ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Confirmar recepción
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={onCancel}
                    disabled={busy}
                    className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HistoryCard ──────────────────────────────────────────────────────────────

function HistoryCard({ order }: { order: OrderHistoryRow }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">{order.numero}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_ESTADO_COLORS[order.estado]}`}>
            {LIFECYCLE_ESTADO_LABELS[order.estado]}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5 truncate">{order.actor_nombre}</p>
        {order.source_ref && (
          <p className="text-xs text-slate-400">{order.source_ref}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
          {order.total.toFixed(2)} €
        </p>
        <p className="text-xs text-slate-400">
          {new Date(order.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map((i) => <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}
