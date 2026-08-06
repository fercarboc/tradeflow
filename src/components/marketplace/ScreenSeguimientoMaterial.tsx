import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  ActiveOrder, OrderHistoryRow, OrderFullDetail, OrderEvent,
  getOrgActiveOrders, getOrgOrderHistory, getOrderFullDetail, getOrderEvents,
  deliverMarketplaceOrder, cancelMarketplaceOrder,
  LIFECYCLE_ESTADO_COLORS, LIFECYCLE_TIMELINE,
  getLifecycleStep, EVENT_TYPE_LABELS,
} from '../../lib/api/marketplace-orders';
import { useSession } from '../../context/SessionContext';
import OrderStatusBadge, { INSTALLER_ESTADO_LABELS } from './shared/OrderStatusBadge';
import OrderTimeline from './shared/OrderTimeline';
import ConfirmModal from './shared/ConfirmModal';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

type Tab = 'activos' | 'historial';

const HIST_PAGE_SIZE = 20;

// ─── Helpers (nivel módulo) ───────────────────────────────────────────────────

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(d: string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── ActiveOrderCard ──────────────────────────────────────────────────────────

interface ActiveCardProps {
  order:          ActiveOrder;
  expanded:       boolean;
  detail:         OrderFullDetail | null;
  events:         OrderEvent[];
  detailLoading:  boolean;
  busy:           boolean;
  onToggle:       () => void;
  onRequestDeliver: () => void;
  onRequestCancel:  () => void;
}

function ActiveOrderCard({
  order, expanded, detail, events, detailLoading, busy,
  onToggle, onRequestDeliver, onRequestCancel,
}: ActiveCardProps) {
  const canDeliver = order.estado === 'shipped';
  const canCancel  = ['pending', 'confirmed', 'preparing'].includes(order.estado);
  const isCancelled = order.estado === 'cancelled';
  const isUrgent    = order.estado === 'shipped';

  const cancelReason = detail?.order.cancel_reason ?? null;

  return (
    <article
      className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden motion-safe:transition-all ${
        isUrgent ? 'border-teal-300 dark:border-teal-700' : 'border-slate-200 dark:border-slate-800'
      }`}
      aria-label={`Pedido ${order.numero}, ${INSTALLER_ESTADO_LABELS[order.estado]}`}
    >
      {/* ── Cabecera ─────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 px-4 py-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Contraer' : 'Expandir'} detalles del pedido ${order.numero}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
              {order.numero}
            </span>
            <OrderStatusBadge estado={order.estado} installerView />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            {order.actor_nombre}
            {order.actor_verificado && (
              <svg className="h-3.5 w-3.5 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-label="Proveedor verificado">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </p>
          {(order.cliente_nombre || order.obra_nombre || order.source_ref) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              {order.cliente_nombre && (
                <p className="text-xs text-slate-400">{order.cliente_nombre}</p>
              )}
              {order.obra_nombre && (
                <p className="text-xs text-slate-400 truncate max-w-[200px]">· {order.obra_nombre}</p>
              )}
              {order.source_ref && (
                <p className="text-xs text-slate-300">· {order.source_ref}</p>
              )}
            </div>
          )}
        </div>

        {/* Importe + expand */}
        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {order.total.toFixed(2)} €
            </p>
            <p className="text-xs text-slate-400">
              {order.items_count} artículo{order.items_count !== 1 ? 's' : ''}
            </p>
          </div>
          <svg
            className={`h-4 w-4 text-slate-400 mt-1 motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────── */}
      {!isCancelled && (
        <div className="px-4 pb-3">
          <OrderTimeline estado={order.estado} installerView cancelReason={cancelReason} />
        </div>
      )}

      {/* Cancelado: estado final */}
      {isCancelled && (
        <div className="px-4 pb-3">
          <OrderTimeline estado="cancelled" cancelReason={cancelReason} />
        </div>
      )}

      {/* ── Tracking ─────────────────────────────────────────── */}
      {order.tracking_ref && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">
              Ref: <span className="font-mono font-medium">{order.tracking_ref}</span>
            </span>
            {order.tracking_url && (
              <a
                href={order.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Seguir envío ${order.tracking_ref} en sitio del transportista (nueva ventana)`}
                className="text-xs text-teal-600 hover:text-teal-500 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                Seguir envío →
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── CTA principal visible sin expandir ───────────────── */}
      {canDeliver && (
        <div className="px-4 pb-4">
          <button
            onClick={(e) => { e.stopPropagation(); onRequestDeliver(); }}
            disabled={busy}
            aria-label={`Confirmar recepción del pedido ${order.numero}`}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {busy ? (
              <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Confirmar recepción
          </button>
        </div>
      )}

      {/* ── Panel expandido ───────────────────────────────────── */}
      {expanded && (
        <div
          className="border-t border-slate-100 dark:border-slate-800"
          aria-label="Detalle del pedido"
        >
          {detailLoading ? (
            <div className="p-5 space-y-2 motion-safe:animate-pulse">
              <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
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

              {/* Dirección de entrega */}
              {detail?.order.delivery_address && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Dirección de entrega</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{detail.order.delivery_address}</p>
                </div>
              )}

              {/* Artículos */}
              {detail?.items && detail.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Artículos</p>
                  <div className="space-y-1">
                    {detail.items.map((item) => (
                      <OrderItemLine key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {order.confirmed_at && (
                  <DateCell label="Confirmado" value={fmtDate(order.confirmed_at)} />
                )}
                {order.preparing_at && (
                  <DateCell label="En preparación" value={fmtDate(order.preparing_at)} />
                )}
                {order.shipped_at && (
                  <DateCell label="Enviado" value={fmtDate(order.shipped_at)} />
                )}
              </div>

              {/* Actividad */}
              {events.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Actividad</p>
                  <div className="space-y-2">
                    {events.slice(0, 5).map((ev) => (
                      <EventRow key={ev.id} event={ev} />
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones en expanded */}
              {(canCancel) && (
                <div className="flex gap-2 pt-2">
                  {canCancel && (
                    <button
                      onClick={onRequestCancel}
                      disabled={busy}
                      aria-label={`Cancelar pedido ${order.numero}`}
                      className="flex-1 sm:flex-none rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── OrderItemLine ────────────────────────────────────────────────────────────

interface OrderItemLineProps {
  item: { id: string; referencia: string | null; descripcion: string; cantidad: number; unidad: string; precio_total: number | null };
}

function OrderItemLine({ item }: OrderItemLineProps) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-slate-800 dark:text-slate-200 leading-snug">{item.descripcion}</p>
        {item.referencia && (
          <p className="text-xs text-slate-400 font-mono mt-0.5">{item.referencia}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-slate-600 dark:text-slate-400 tabular-nums">
          {item.cantidad} {item.unidad}
        </p>
        {item.precio_total != null && (
          <p className="text-xs text-slate-400 tabular-nums">{item.precio_total.toFixed(2)} €</p>
        )}
      </div>
    </div>
  );
}

// ─── DateCell ─────────────────────────────────────────────────────────────────

function DateCell({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
    </div>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

function EventRow({ event: ev }: { event: OrderEvent }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
        ev.actor_type === 'installer' ? 'bg-teal-400'
        : ev.actor_type === 'supplier' ? 'bg-blue-400'
        : 'bg-slate-300'
      }`} aria-hidden="true" />
      <div>
        <p className="text-slate-700 dark:text-slate-300">
          {EVENT_TYPE_LABELS[ev.tipo] ?? ev.tipo}
          {ev.to_estado && (
            <span className="ml-1 text-slate-400">
              → {(INSTALLER_ESTADO_LABELS as Record<string, string>)[ev.to_estado] ?? ev.to_estado}
            </span>
          )}
        </p>
        {ev.notas && (
          <p className="text-slate-400 italic mt-0.5">"{ev.notas}"</p>
        )}
        <p className="text-slate-400 mt-0.5">
          {new Date(ev.created_at).toLocaleString('es-ES', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ─── HistoryCard ──────────────────────────────────────────────────────────────

function HistoryCard({ order }: { order: OrderHistoryRow }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">{order.numero}</span>
          <OrderStatusBadge estado={order.estado} installerView />
        </div>
        <p className="text-sm text-slate-500 mt-0.5 truncate">{order.actor_nombre}</p>
        {(order.cliente_nombre || order.obra_nombre || order.source_ref) && (
          <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
            {order.cliente_nombre && (
              <span className="text-xs text-slate-400">{order.cliente_nombre}</span>
            )}
            {order.obra_nombre && (
              <span className="text-xs text-slate-400 truncate max-w-[160px]">· {order.obra_nombre}</span>
            )}
            {order.source_ref && (
              <span className="text-xs text-slate-300">· {order.source_ref}</span>
            )}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
          {order.total.toFixed(2)} €
        </p>
        <p className="text-xs text-slate-400">{fmtDateShort(order.created_at)}</p>
      </div>
    </div>
  );
}

// ─── OrdersSkeleton ───────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <div className="space-y-3 motion-safe:animate-pulse" aria-busy="true" aria-label="Cargando pedidos">
      {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="py-16 text-center" role="status">
      <p className="text-4xl mb-3" aria-hidden="true">{icon}</p>
      <p className="font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ScreenSeguimientoMaterial({ setCurrentPage, session }: Props) {
  const { org } = useSession();
  const orgId = org?.id ?? null;

  const [tab,             setTab]             = useState<Tab>('activos');
  const [activos,         setActivos]         = useState<ActiveOrder[]>([]);
  const [historial,       setHistorial]       = useState<OrderHistoryRow[]>([]);
  const [histTotal,       setHistTotal]       = useState(0);
  const [histPage,        setHistPage]        = useState(0);
  const [histLoadingMore, setHistLoadingMore] = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [detail,          setDetail]          = useState<OrderFullDetail | null>(null);
  const [events,          setEvents]          = useState<OrderEvent[]>([]);
  const [detailLoad,      setDetailLoad]      = useState(false);
  const [busy,            setBusy]            = useState<string | null>(null);

  // Modales
  const [deliverModal, setDeliverModal] = useState<{ orderId: string; numero: string; actorNombre: string } | null>(null);
  const [cancelModal,  setCancelModal]  = useState<{ orderId: string; numero: string; actorNombre: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Realtime
  const [realtimeOk,   setRealtimeOk]   = useState<boolean | null>(null);
  const [rtAnnounce,   setRtAnnounce]   = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!session) setCurrentPage(ActivePage.Login);
  }, [session, setCurrentPage]);

  // ── Carga silenciosa (sin spinner de loading) ───────────────
  const silentLoadActivos = useCallback(async () => {
    if (!orgId) return;
    try {
      const { items } = await getOrgActiveOrders({ orgId });
      setActivos(items);
    } catch { /* datos actuales permanecen */ }
  }, [orgId]);

  // ── Carga con loading ───────────────────────────────────────
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
      const { items, totalCount } = await getOrgOrderHistory({ orgId, limit: HIST_PAGE_SIZE, offset: 0 });
      setHistorial(items);
      setHistTotal(totalCount);
      setHistPage(0);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadMoreHistorial = async () => {
    if (!orgId || histLoadingMore) return;
    const nextOffset = (histPage + 1) * HIST_PAGE_SIZE;
    setHistLoadingMore(true);
    try {
      const { items } = await getOrgOrderHistory({ orgId, limit: HIST_PAGE_SIZE, offset: nextOffset });
      setHistorial((prev) => [...prev, ...items]);
      setHistPage((prev) => prev + 1);
    } finally {
      setHistLoadingMore(false);
    }
  };

  useEffect(() => {
    if (tab === 'activos') loadActivos();
    else                   loadHistorial();
  }, [tab, loadActivos, loadHistorial]);

  // ── Realtime subscription ───────────────────────────────────
  useEffect(() => {
    if (!orgId || !session) return;

    // Evitar canales duplicados
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`org-orders-${orgId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'trade_marketplace_orders',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          // Recargamos desde RPC para obtener datos enriquecidos (joins)
          silentLoadActivos();
          setRtAnnounce('El estado de un pedido ha cambiado.');
          setTimeout(() => setRtAnnounce(''), 4000);
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [orgId, session, silentLoadActivos]);

  // ── Expand detail ───────────────────────────────────────────
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

  // ── Confirmar recepción ─────────────────────────────────────
  const confirmDeliver = async () => {
    if (!deliverModal || busy) return;
    const { orderId } = deliverModal;
    setBusy(orderId);
    try {
      await deliverMarketplaceOrder(orderId, 'Recepción confirmada por el instalador');
      setDeliverModal(null);
      setExpanded(null);
      setDetail(null);
      await loadActivos();
      setRtAnnounce('Material marcado como recibido. El proveedor ha sido notificado.');
      setTimeout(() => setRtAnnounce(''), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la recepción');
      setDeliverModal(null);
    } finally {
      setBusy(null);
    }
  };

  // ── Cancelar pedido ─────────────────────────────────────────
  const confirmCancel = async () => {
    if (!cancelModal || busy) return;
    const { orderId } = cancelModal;
    setBusy(orderId);
    try {
      await cancelMarketplaceOrder(orderId, cancelReason.trim() || 'Cancelado por el instalador');
      setCancelModal(null);
      setCancelReason('');
      setExpanded(null);
      setDetail(null);
      await loadActivos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar el pedido');
      setCancelModal(null);
    } finally {
      setBusy(null);
    }
  };

  // ── Métricas de UI ──────────────────────────────────────────
  const pendingDelivery = activos.filter((o) => o.estado === 'shipped').length;
  const hasMore         = historial.length < histTotal;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shrink-0">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            aria-label="Volver al inicio"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>

          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Seguimiento de material
            </h1>
          </div>

          {/* Indicador Realtime */}
          {tab === 'activos' && (
            <span
              className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${
                realtimeOk === true  ? 'text-emerald-600 dark:text-emerald-400'
                : realtimeOk === false ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-400'
              }`}
              aria-label={realtimeOk === true ? 'Actualización en tiempo real activa' : 'Reconectando actualización en tiempo real'}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                realtimeOk === true  ? 'bg-emerald-500 motion-safe:animate-pulse'
                : realtimeOk === false ? 'bg-amber-400 motion-safe:animate-pulse'
                : 'bg-slate-300'
              }`} aria-hidden="true" />
              {realtimeOk === true ? 'En vivo' : realtimeOk === false ? 'Reconectando' : ''}
            </span>
          )}

          {/* Recarga manual */}
          <button
            onClick={() => tab === 'activos' ? loadActivos() : loadHistorial()}
            aria-label="Actualizar pedidos"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Badge "en tránsito" */}
          {pendingDelivery > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300" aria-live="polite">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" aria-hidden="true" />
              {pendingDelivery} en tránsito
            </span>
          )}
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0" role="tablist" aria-label="Vistas de pedidos">
        <div className="mx-auto max-w-4xl flex">
          {(['activos', 'historial'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              onClick={() => setTab(t)}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              id={`tab-${t}`}
              className={`px-5 py-3 text-sm font-medium border-b-2 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                tab === t
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'activos' ? 'Pedidos activos' : 'Historial'}
              {t === 'activos' && activos.length > 0 && (
                <span className="ml-2 rounded-full bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 text-xs text-teal-600 dark:text-teal-400" aria-label={`${activos.length} pedidos activos`}>
                  {activos.length}
                </span>
              )}
              {t === 'historial' && histTotal > 0 && (
                <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500" aria-label={`${histTotal} pedidos en historial`}>
                  {histTotal}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Anuncio Realtime para lectores de pantalla */}
      {rtAnnounce && (
        <div className="mx-4 mt-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 px-4 py-2.5 shrink-0" aria-live="polite" role="status">
          <p className="text-sm text-teal-700 dark:text-teal-300">{rtAnnounce}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mx-4 mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2.5 shrink-0"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div
          className="mx-auto max-w-4xl p-4 space-y-3"
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
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
                  detail={expanded === order.id ? detail : null}
                  events={expanded === order.id ? events : []}
                  detailLoading={detailLoad && expanded === order.id}
                  busy={busy === order.id}
                  onToggle={() => toggleExpand(order.id)}
                  onRequestDeliver={() => setDeliverModal({
                    orderId: order.id,
                    numero: order.numero,
                    actorNombre: order.actor_nombre,
                  })}
                  onRequestCancel={() => {
                    setCancelReason('');
                    setCancelModal({
                      orderId: order.id,
                      numero: order.numero,
                      actorNombre: order.actor_nombre,
                    });
                  }}
                />
              ))
            )
          ) : (
            <>
              {historial.length === 0 ? (
                <EmptyState
                  icon="📋"
                  title="Sin historial aún"
                  desc="Los pedidos completados o cancelados aparecerán aquí."
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {historial.map((order) => (
                      <HistoryCard key={order.id} order={order} />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={loadMoreHistorial}
                        disabled={histLoadingMore}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        aria-label="Cargar más pedidos del historial"
                      >
                        {histLoadingMore ? (
                          <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                        ) : null}
                        {histLoadingMore ? 'Cargando...' : `Cargar más (${histTotal - historial.length} restantes)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Modal: Confirmar recepción ──────────────────────────── */}
      <ConfirmModal
        open={deliverModal !== null}
        title="Confirmar recepción"
        description={deliverModal
          ? `¿Has recibido el material del pedido ${deliverModal.numero} de ${deliverModal.actorNombre}? Esta acción marcará el pedido como recibido y notificará al proveedor.`
          : ''}
        confirmLabel="Confirmar recepción"
        loading={!!(deliverModal && busy === deliverModal.orderId)}
        onConfirm={confirmDeliver}
        onClose={() => setDeliverModal(null)}
      />

      {/* ── Modal: Cancelar pedido ──────────────────────────────── */}
      <ConfirmModal
        open={cancelModal !== null}
        title="Cancelar pedido"
        description={cancelModal
          ? `¿Cancelar el pedido ${cancelModal.numero} de ${cancelModal.actorNombre}? Esta acción no se puede deshacer.`
          : ''}
        confirmLabel="Sí, cancelar pedido"
        confirmClassName="bg-red-600 hover:bg-red-500 text-white"
        loading={!!(cancelModal && busy === cancelModal.orderId)}
        onConfirm={confirmCancel}
        onClose={() => setCancelModal(null)}
      >
        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Motivo (opcional)
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ej: Material ya no necesario, cambio de presupuesto..."
            rows={2}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
