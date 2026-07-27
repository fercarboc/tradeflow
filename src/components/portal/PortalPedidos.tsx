import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOrder, PortalOrderPage,
  getSupplierOrdersUnified, confirmSupplierOrder, shipSupplierOrder,
} from '../../lib/api/marketplace-portal';
import {
  OrderLifecycleEstado,
  prepareOrderFromPortal, shipMarketplaceOrderWithTracking,
} from '../../lib/api/marketplace-orders';
import ConfirmModal from '../marketplace/shared/ConfirmModal';
import OrderStatusBadge from '../marketplace/shared/OrderStatusBadge';
import OrderTimeline from '../marketplace/shared/OrderTimeline';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

const LIMIT = 15;

const ESTADO_OPTS = [
  { value: '',          label: 'Todos'      },
  { value: 'pending',   label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped',   label: 'Enviados'   },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

export default function PortalPedidos({ actorId, membership }: Props) {
  const [page,        setPage]        = useState<PortalOrderPage>({ items: [], totalCount: 0 });
  const [loading,     setLoading]     = useState(true);
  const [estadoFlt,   setEstadoFlt]   = useState('');
  const [pageIdx,     setPageIdx]     = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [busy,        setBusy]        = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [sortOldFirst, setSortOldFirst] = useState(true);
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});

  // Modal confirmar
  const [confirmModal,   setConfirmModal]   = useState<PortalOrder | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Modal envío
  const [shipModal,   setShipModal]   = useState<PortalOrder | null>(null);
  const [shipRef,     setShipRef]     = useState('');
  const [shipUrl,     setShipUrl]     = useState('');
  const [shipUrlErr,  setShipUrlErr]  = useState('');
  const [shipLoading, setShipLoading] = useState(false);

  const canManage  = membership.permissions.includes('orders:manage');
  const canFulfill = membership.permissions.includes('orders:fulfillment');
  const totalPages = Math.ceil(page.totalCount / LIMIT);

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
      const msg = e instanceof Error
        ? e.message
        : (typeof e === 'object' && e !== null && 'message' in e)
          ? String((e as { message: unknown }).message)
          : 'Error al cargar pedidos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(estadoFlt, pageIdx); }, [load, estadoFlt, pageIdx]);

  // Contadores por estado activo
  useEffect(() => {
    ['pending', 'confirmed', 'preparing'].forEach(async (estado) => {
      try {
        const r = await getSupplierOrdersUnified(actorId, { estado, limit: 1, offset: 0 });
        setStateCounts((prev) => ({ ...prev, [estado]: r.totalCount }));
      } catch { /* silencioso */ }
    });
  }, [actorId]);

  const filteredItems = useMemo(() => {
    let items = [...page.items];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (o) => o.numero.toLowerCase().includes(q) || o.org_nombre.toLowerCase().includes(q),
      );
    }
    if (sortOldFirst) {
      items = items.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return items;
  }, [page.items, search, sortOldFirst]);

  const handleConfirmSubmit = async () => {
    if (!confirmModal || !canManage || confirmLoading) return;
    setConfirmLoading(true);
    try {
      await confirmSupplierOrder(confirmModal.id, confirmModal.source);
      setConfirmModal(null);
      await load(estadoFlt, pageIdx);
      setStateCounts((prev) => ({
        ...prev,
        pending:   Math.max(0, (prev.pending   ?? 0) - 1),
        confirmed: (prev.confirmed ?? 0) + 1,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar');
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handlePrepare = async (order: PortalOrder) => {
    if (!canFulfill || busy) return;
    setBusy(order.id);
    try {
      if (order.source === 'marketplace') {
        await prepareOrderFromPortal(order.id);
        await load(estadoFlt, pageIdx);
        setStateCounts((prev) => ({
          ...prev,
          confirmed: Math.max(0, (prev.confirmed ?? 0) - 1),
          preparing: (prev.preparing ?? 0) + 1,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar preparación');
    } finally {
      setBusy(null);
    }
  };

  const handleShipSubmit = async () => {
    if (!shipModal || !canFulfill || shipLoading) return;
    if (shipUrl) {
      try { new URL(shipUrl); }
      catch { setShipUrlErr('La URL no es válida (ej: https://...)'); return; }
    }
    setShipLoading(true);
    try {
      if (shipModal.source === 'marketplace') {
        await shipMarketplaceOrderWithTracking({
          orderId:     shipModal.id,
          trackingRef: shipRef || undefined,
          trackingUrl: shipUrl || undefined,
        });
      } else {
        await shipSupplierOrder(shipModal.id, shipModal.source, shipRef || undefined);
      }
      setShipModal(null);
      await load(estadoFlt, pageIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al marcar enviado');
      setShipModal(null);
    } finally {
      setShipLoading(false);
      setShipRef('');
      setShipUrl('');
      setShipUrlErr('');
    }
  };

  const openShipModal = (order: PortalOrder) => {
    setShipModal(order);
    setShipRef('');
    setShipUrl('');
    setShipUrlErr('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Cabecera: búsqueda + orden */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 shrink-0">Pedidos</h1>
          <div className="flex-1 min-w-[160px]">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número u organización..."
                aria-label="Buscar pedidos"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <button
            onClick={() => setSortOldFirst((v) => !v)}
            aria-label={sortOldFirst ? 'Ordenar más recientes primero' : 'Ordenar más antiguos primero'}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m11-1v8m0 0l-3-3m3 3l3-3" />
            </svg>
            {sortOldFirst ? 'Más antiguos' : 'Más recientes'}
          </button>
        </div>

        {/* Filtros por estado */}
        <div
          className="px-6 pb-3 flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label="Filtrar por estado"
        >
          {ESTADO_OPTS.map((opt) => {
            const count = stateCounts[opt.value];
            const active = estadoFlt === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setEstadoFlt(opt.value); setPageIdx(0); setSearch(''); }}
                aria-pressed={active}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
                {opt.value && count !== undefined && count > 0 && (
                  <span className={`tabular-nums font-semibold ${active ? 'text-white/80' : 'text-teal-600 dark:text-teal-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <span
            className="ml-auto text-xs text-slate-400 tabular-nums shrink-0"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {page.totalCount} pedido{page.totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-4 mt-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2"
        >
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <OrdersSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col h-40 items-center justify-center gap-2">
            <p className="text-sm text-slate-400">
              {search.trim() ? 'Sin resultados para tu búsqueda.' : 'No hay pedidos en este estado.'}
            </p>
          </div>
        ) : (
          filteredItems.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded === order.id}
              busy={busy === order.id}
              canManage={canManage}
              canFulfill={canFulfill}
              onToggle={() => setExpanded((prev) => (prev === order.id ? null : order.id))}
              onConfirm={() => setConfirmModal(order)}
              onPrepare={() => handlePrepare(order)}
              onShip={() => openShipModal(order)}
            />
          ))
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-400 tabular-nums">{pageIdx + 1} / {totalPages}</span>
          <button
            onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIdx >= totalPages - 1}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal: confirmar pedido */}
      <ConfirmModal
        open={!!confirmModal}
        title="Confirmar pedido"
        description={
          confirmModal
            ? `Pedido ${confirmModal.numero} de ${confirmModal.org_nombre} · ${fmt(confirmModal.total)}`
            : ''
        }
        confirmLabel="Confirmar pedido"
        confirmClassName="bg-teal-600 hover:bg-teal-500 text-white"
        loading={confirmLoading}
        onConfirm={handleConfirmSubmit}
        onClose={() => setConfirmModal(null)}
      />

      {/* Modal: marcar como enviado */}
      <ConfirmModal
        open={!!shipModal}
        title="Marcar como enviado"
        description={shipModal ? `${shipModal.numero} · ${shipModal.org_nombre}` : ''}
        confirmLabel="Confirmar envío"
        confirmClassName="bg-blue-600 hover:bg-blue-500 text-white"
        loading={shipLoading}
        onConfirm={handleShipSubmit}
        onClose={() => { if (!shipLoading) { setShipModal(null); setShipUrlErr(''); } }}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="ship-ref" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Referencia de tracking <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="ship-ref"
              type="text"
              value={shipRef}
              onChange={(e) => setShipRef(e.target.value)}
              placeholder="Ej: ES123456789"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label htmlFor="ship-url" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              URL de seguimiento <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="ship-url"
              type="url"
              value={shipUrl}
              onChange={(e) => { setShipUrl(e.target.value); setShipUrlErr(''); }}
              placeholder="https://seguimiento.correos.es/..."
              aria-invalid={!!shipUrlErr}
              aria-describedby={shipUrlErr ? 'ship-url-error' : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 ${
                shipUrlErr ? 'border-red-400 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {shipUrlErr && (
              <p id="ship-url-error" className="mt-1 text-xs text-red-500" role="alert">{shipUrlErr}</p>
            )}
          </div>
        </div>
      </ConfirmModal>
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

function OrderCard({
  order, expanded, busy, canManage, canFulfill,
  onToggle, onConfirm, onPrepare, onShip,
}: OrderCardProps) {
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }) : null;

  const estado = order.estado as OrderLifecycleEstado;

  const hasPendingCTA  = order.estado === 'pending' && canManage;
  const hasPrepareCTA  = order.estado === 'confirmed' && canFulfill && order.source === 'marketplace';
  const hasShipCTA     = (order.estado === 'confirmed' || order.estado === 'preparing') && canFulfill;
  const hasCTA         = hasPendingCTA || hasPrepareCTA || hasShipCTA;

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 ${
      order.estado === 'pending'
        ? 'border-amber-300 dark:border-amber-700'
        : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* Cabecera — click abre/cierra el detalle */}
      <button
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 rounded-t-xl"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`Pedido ${order.numero} de ${order.org_nombre}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{order.numero}</span>
            <OrderStatusBadge estado={estado} size="sm" />
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
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {fmt(order.total)}
          </p>
          <p className="text-xs text-slate-400">{order.items_count} línea{order.items_count !== 1 ? 's' : ''}</p>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 mt-1 shrink-0 motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Timeline */}
      <div className="px-5 pb-2">
        <OrderTimeline estado={estado} installerView={false} />
      </div>

      {/* CTAs — visibles sin expandir */}
      {hasCTA && (
        <div className="px-5 pb-4 flex gap-2 flex-wrap" aria-label="Acciones disponibles">
          {hasPendingCTA && (
            <button
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {busy
                ? <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                : <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              }
              {busy ? 'Confirmando...' : 'Confirmar pedido'}
            </button>
          )}
          {hasPrepareCTA && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrepare(); }}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {busy ? 'Actualizando...' : 'Iniciar preparación'}
            </button>
          )}
          {hasShipCTA && (
            <button
              onClick={(e) => { e.stopPropagation(); onShip(); }}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {busy
                ? <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                : <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
              }
              {busy ? 'Actualizando...' : 'Marcar como enviado'}
            </button>
          )}
        </div>
      )}

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          {order.notas && (
            <p className="text-xs text-slate-500 italic mb-3">"{order.notas}"</p>
          )}
          <div className="grid grid-cols-3 gap-3 text-xs">
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
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <div className="motion-safe:animate-pulse space-y-3" aria-busy="true" aria-label="Cargando pedidos">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}
