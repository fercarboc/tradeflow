import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOrder, PortalOrderPage, SupplierOrderAlerts,
  SimpleSupplierLocation,
  getSupplierOrdersUnified, getSupplierOrderAlerts,
  getSupplierLocations,
  bulkConfirmSupplierOrders, bulkShipSupplierOrders,
  getSupplierNotifications, markNotificationsRead,
} from '../../lib/api/marketplace-portal';
import { usePortal } from './PortalContext';
import OrderStatusBadge from '../marketplace/shared/OrderStatusBadge';
import { OrderLifecycleEstado } from '../../lib/api/marketplace-orders';
import PortalPedidoSlideOver from './PortalPedidoSlideOver';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

const LIMIT = 20;

const ESTADO_OPTS = [
  { value: '',          label: 'Todos'       },
  { value: 'pending',   label: 'Pendientes'  },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'Preparando'  },
  { value: 'shipped',   label: 'Enviados'    },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados'  },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Client-side alert derivation
const isAtrasado  = (o: PortalOrder) =>
  ['confirmed','preparing'].includes(o.estado) &&
  new Date(o.created_at).getTime() < Date.now() - 72 * 3_600_000;

const isUrgentPending = (o: PortalOrder) =>
  o.estado === 'pending' &&
  new Date(o.created_at).getTime() < Date.now() - 4 * 3_600_000;

// ── Main component ────────────────────────────────────────────────────────────

export default function PortalPedidos({ actorId, membership }: Props) {
  const [page,       setPage]       = useState<PortalOrderPage>({ items: [], totalCount: 0 });
  const [loading,    setLoading]    = useState(true);
  const [estadoFlt,  setEstadoFlt]  = useState('');
  const [search,     setSearch]     = useState('');
  const [sortNew,    setSortNew]    = useState(true);
  const [pageIdx,    setPageIdx]    = useState(0);
  const [error,      setError]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [slideOrder, setSlideOrder] = useState<PortalOrder | null>(null);
  const [alerts,     setAlerts]     = useState<SupplierOrderAlerts | null>(null);
  const [bulkBusy,   setBulkBusy]   = useState(false);
  const [locationFlt, setLocationFlt] = useState<string | null>(() => pedidosLocationFilter || null);
  const [locations,   setLocations]   = useState<SimpleSupplierLocation[]>([]);

  const canManage  = membership.permissions.includes('orders:manage');
  const canFulfill = membership.permissions.includes('orders:fulfillment');
  const totalPages = Math.ceil(page.totalCount / LIMIT);

  const { refreshUnread, pedidosLocationFilter, setPedidosLocationFilter } = usePortal();

  // Consumir filtro de tienda proveniente del contexto (CTA desde PortalTiendas)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (pedidosLocationFilter) setPedidosLocationFilter(null); }, []);

  // Cargar tiendas disponibles para el dropdown de filtro
  useEffect(() => {
    getSupplierLocations(actorId).then(setLocations).catch(() => {});
  }, [actorId]);

  // Marcar notificaciones leídas al entrar
  useEffect(() => {
    getSupplierNotifications(actorId, { limit: 50, unreadOnly: true })
      .then((notifs) => {
        if (!notifs.length) return;
        return markNotificationsRead(actorId, notifs.map((n) => n.id)).then(() => refreshUnread());
      })
      .catch(() => {});
  }, [actorId, refreshUnread]);

  // Alertas del servidor
  useEffect(() => {
    getSupplierOrderAlerts(actorId)
      .then(setAlerts)
      .catch(() => {});
  }, [actorId]);

  const load = useCallback(async (estado: string, p: number, locId: string | null) => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const result = await getSupplierOrdersUnified(actorId, {
        estado:     estado || undefined,
        limit:      LIMIT,
        offset:     p * LIMIT,
        locationId: locId ?? undefined,
      });
      setPage(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(estadoFlt, pageIdx, locationFlt); }, [load, estadoFlt, pageIdx, locationFlt]);

  const filteredItems = useMemo(() => {
    let items = [...page.items];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (o) => o.numero.toLowerCase().includes(q) || o.org_nombre.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNew ? tb - ta : ta - tb;
    });
    return items;
  }, [page.items, search, sortNew]);

  // Multi-select helpers
  const allIds    = filteredItems.map((o) => o.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = allIds.some((id) => selected.has(id)) && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelected((s) => { const n = new Set(s); allIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); allIds.forEach((id) => n.add(id)); return n; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Bulk actions
  const selectedArr  = Array.from(selected);
  const selectedItems = filteredItems.filter((o) => selected.has(o.id));
  const hasPending    = selectedItems.some((o) => o.estado === 'pending');
  const hasShippable  = selectedItems.some((o) => ['confirmed','preparing'].includes(o.estado));

  const doBulkConfirm = async () => {
    if (!hasPending || bulkBusy || !canManage) return;
    setBulkBusy(true);
    try {
      const pendingIds = selectedItems.filter((o) => o.estado === 'pending').map((o) => o.id);
      await bulkConfirmSupplierOrders(actorId, pendingIds);
      await load(estadoFlt, pageIdx, locationFlt);
      getSupplierOrderAlerts(actorId).then(setAlerts).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : 'Error en confirmación masiva'); }
    finally { setBulkBusy(false); }
  };

  const doBulkShip = async () => {
    if (!hasShippable || bulkBusy || !canFulfill) return;
    setBulkBusy(true);
    try {
      const shipIds = selectedItems
        .filter((o) => ['confirmed','preparing'].includes(o.estado))
        .map((o) => o.id);
      await bulkShipSupplierOrders(actorId, shipIds);
      await load(estadoFlt, pageIdx, locationFlt);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error en envío masivo'); }
    finally { setBulkBusy(false); }
  };

  const exportSelectedCSV = () => {
    const rows = selectedItems.map((o) =>
      [o.numero, `"${o.org_nombre}"`, o.estado, o.items_count, o.total.toFixed(2), o.created_at].join(';'),
    );
    const csv = ['Numero;Instalador;Estado;Lineas;Total;Fecha', ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'pedidos-seleccionados.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSlideUpdated = () => {
    load(estadoFlt, pageIdx, locationFlt);
    getSupplierOrderAlerts(actorId).then(setAlerts).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">

      {/* ── Panel de alertas ─────────────────────────────────────────────── */}
      {alerts && (alerts.pending_urgent > 0 || alerts.atrasados > 0) && (
        <AlertsPanel alerts={alerts} onFilterPending={() => { setEstadoFlt('pending'); setPageIdx(0); }} />
      )}

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 shrink-0">Pedidos</h1>
          {/* Búsqueda */}
          <div className="flex-1 min-w-[180px] max-w-xs relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número u organización..."
              aria-label="Buscar pedidos"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {/* Filtro por tienda */}
          {locations.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={locationFlt ?? ''}
                onChange={(e) => { setLocationFlt(e.target.value || null); setPageIdx(0); }}
                aria-label="Filtrar por tienda"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[180px]"
              >
                <option value="">Todas las tiendas</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                ))}
              </select>
              {locationFlt && (
                <button
                  onClick={() => { setLocationFlt(null); setPageIdx(0); }}
                  className="flex items-center gap-1 rounded-full bg-teal-100 dark:bg-teal-900/30 px-2 py-1 text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  aria-label="Quitar filtro de tienda"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  Tienda
                </button>
              )}
            </div>
          )}
          {/* Orden */}
          <button
            onClick={() => setSortNew((v) => !v)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label={sortNew ? 'Ordenar más antiguos primero' : 'Ordenar más recientes primero'}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m11-1v8m0 0l-3-3m3 3l3-3" />
            </svg>
            {sortNew ? 'Recientes' : 'Antiguos'}
          </button>
          {/* Total */}
          <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0" role="status" aria-live="polite">
            {page.totalCount} pedido{page.totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filtros por estado */}
        <div className="px-6 pb-3 flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por estado">
          {ESTADO_OPTS.map((opt) => {
            const active = estadoFlt === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setEstadoFlt(opt.value); setPageIdx(0); setSearch(''); }}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 shrink-0" role="alert">
          <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2 text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <TableSkeleton />
        ) : filteredItems.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <table className="w-full text-sm">
            <TableHead
              allChecked={allChecked}
              someChecked={someChecked}
              onToggleAll={toggleAll}
            />
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredItems.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selected={selected.has(order.id)}
                  onToggle={() => toggleOne(order.id)}
                  onOpen={() => setSlideOrder(order)}
                  canManage={canManage}
                  canFulfill={canFulfill}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Paginación ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-400 tabular-nums">{pageIdx + 1} / {totalPages}</span>
          <button
            onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIdx >= totalPages - 1}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Barra de acciones masivas ────────────────────────────────────── */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          hasPending={hasPending}
          hasShippable={hasShippable}
          canManage={canManage}
          canFulfill={canFulfill}
          loading={bulkBusy}
          onConfirm={doBulkConfirm}
          onShip={doBulkShip}
          onExport={exportSelectedCSV}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* ── SlideOver de detalle ─────────────────────────────────────────── */}
      {slideOrder && (
        <PortalPedidoSlideOver
          key={slideOrder.id}
          actorId={actorId}
          order={slideOrder}
          canManage={canManage}
          canFulfill={canFulfill}
          onClose={() => setSlideOrder(null)}
          onUpdated={handleSlideUpdated}
        />
      )}
    </div>
  );
}

// ── AlertsPanel ───────────────────────────────────────────────────────────────

interface AlertsPanelProps {
  alerts:          SupplierOrderAlerts;
  onFilterPending: () => void;
}

function AlertsPanel({ alerts, onFilterPending }: AlertsPanelProps) {
  return (
    <div className="px-6 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 shrink-0 flex items-center gap-3 flex-wrap">
      {alerts.pending_urgent > 0 && (
        <button
          onClick={onFilterPending}
          className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {alerts.pending_urgent} pendiente{alerts.pending_urgent !== 1 ? 's' : ''} sin responder (+4h)
        </button>
      )}
      {alerts.atrasados > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
          {alerts.atrasados} pedido{alerts.atrasados !== 1 ? 's' : ''} atrasado{alerts.atrasados !== 1 ? 's' : ''} (+72h)
        </span>
      )}
    </div>
  );
}

// ── TableHead ─────────────────────────────────────────────────────────────────

interface TableHeadProps {
  allChecked:   boolean;
  someChecked:  boolean;
  onToggleAll:  () => void;
}

function TableHead({ allChecked, someChecked, onToggleAll }: TableHeadProps) {
  return (
    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <tr>
        <th className="w-10 pl-4 pr-2 py-3">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={onToggleAll}
            aria-label="Seleccionar todos"
            className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
          />
        </th>
        <th className="w-6 px-1 py-3" aria-label="Prioridad" />
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Número</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Instalador</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Estado</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wide">Importe</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wide hidden lg:table-cell">Líneas</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wide hidden xl:table-cell">Fecha</th>
        <th className="px-4 py-3" aria-label="Acción" />
      </tr>
    </thead>
  );
}

// ── OrderRow ──────────────────────────────────────────────────────────────────

interface OrderRowProps {
  order:      PortalOrder;
  selected:   boolean;
  onToggle:   () => void;
  onOpen:     () => void;
  canManage:  boolean;
  canFulfill: boolean;
}

function OrderRow({ order, selected, onToggle, onOpen, canManage, canFulfill }: OrderRowProps) {
  const atrasado = isAtrasado(order);
  const urgent   = isUrgentPending(order);
  const dotColor = urgent  ? 'bg-amber-400'
                 : atrasado ? 'bg-red-400'
                 : 'bg-transparent';

  const ctaLabel = order.estado === 'pending'
    ? (canManage  ? 'Confirmar' : null)
    : (order.estado === 'confirmed' || order.estado === 'preparing')
    ? (canFulfill ? 'Enviado'   : null)
    : null;

  const ctaClass = order.estado === 'pending'
    ? 'bg-teal-600 hover:bg-teal-500 text-white'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  return (
    <tr
      className={`group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
        selected ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
      }`}
      onClick={onOpen}
    >
      {/* Checkbox */}
      <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Seleccionar pedido ${order.numero}`}
          className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
        />
      </td>
      {/* Prioridad dot */}
      <td className="px-1 py-3">
        <span className={`block h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      </td>
      {/* Número */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div>
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{order.numero}</span>
            {order.source === 'marketplace' && (
              <span className="ml-1.5 rounded-full bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300 align-middle">MKT</span>
            )}
          </div>
          {order.tienda_nombre && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]" title={order.tienda_nombre}>
              {order.tienda_nombre}
            </span>
          )}
        </div>
      </td>
      {/* Instalador */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={order.org_nombre}>{order.org_nombre}</p>
      </td>
      {/* Estado */}
      <td className="px-4 py-3">
        <OrderStatusBadge estado={order.estado as OrderLifecycleEstado} size="sm" />
      </td>
      {/* Importe */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{fmt(order.total)}</span>
      </td>
      {/* Líneas */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-xs text-slate-400 tabular-nums">{order.items_count}</span>
      </td>
      {/* Fecha */}
      <td className="px-4 py-3 text-right hidden xl:table-cell">
        <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(order.created_at)}</span>
      </td>
      {/* CTA */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {ctaLabel ? (
          <button
            onClick={onOpen}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${ctaClass}`}
          >
            {ctaLabel}
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Ver
          </button>
        )}
      </td>
    </tr>
  );
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  count:       number;
  hasPending:  boolean;
  hasShippable: boolean;
  canManage:   boolean;
  canFulfill:  boolean;
  loading:     boolean;
  onConfirm:   () => void;
  onShip:      () => void;
  onExport:    () => void;
  onClear:     () => void;
}

function BulkActionBar({
  count, hasPending, hasShippable, canManage, canFulfill,
  loading, onConfirm, onShip, onExport, onClear,
}: BulkActionBarProps) {
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center gap-3 flex-wrap shadow-lg">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0">
        {count} seleccionado{count !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {canManage && hasPending && (
          <BulkBtn label="Confirmar" loading={loading} className="bg-teal-600 hover:bg-teal-500 text-white" onClick={onConfirm} />
        )}
        {canFulfill && hasShippable && (
          <BulkBtn label="Marcar enviado" loading={loading} className="bg-blue-600 hover:bg-blue-500 text-white" onClick={onShip} />
        )}
        <BulkBtn label="Exportar CSV" loading={false} className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500" onClick={onExport} />
      </div>
      <button
        onClick={onClear}
        className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
      >
        Cancelar selección
      </button>
    </div>
  );
}

interface BulkBtnProps { label: string; loading: boolean; className: string; onClick: () => void; }
function BulkBtn({ label, loading, className, onClick }: BulkBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${className}`}
    >
      {loading ? 'Procesando...' : label}
    </button>
  );
}

// ── Helpers de estado ─────────────────────────────────────────────────────────

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex h-48 items-center justify-center bg-white dark:bg-slate-900">
      <p className="text-sm text-slate-400">
        {search.trim() ? 'Sin resultados para tu búsqueda.' : 'No hay pedidos en este estado.'}
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 animate-pulse" aria-busy="true" aria-label="Cargando pedidos">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800 ml-auto" />
          <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
