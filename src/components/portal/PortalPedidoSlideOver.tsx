import React, { useEffect, useState } from 'react';
import {
  PortalOrder,
  PortalOrderDetail,
  PortalOrderItem,
  PortalOrderEvent,
  PortalBuyerSnapshot,
  getSupplierOrderDetail,
  cancelSupplierOrder,
  markSupplierOrderIncident,
  confirmSupplierOrder,
  shipSupplierOrder,
} from '../../lib/api/marketplace-portal';
import {
  prepareOrderFromPortal,
  shipMarketplaceOrderWithTracking,
} from '../../lib/api/marketplace-orders';
import OrderStatusBadge from '../marketplace/shared/OrderStatusBadge';
import { OrderLifecycleEstado } from '../../lib/api/marketplace-orders';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : null;

const fmtShort = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

// ── Constants ─────────────────────────────────────────────────────────────────

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  entrega_obra:       'Envío a obra',
  entrega_almacen:    'Envío a almacén',
  recogida_proveedor: 'Recogida en tienda / almacén',
  por_coordinar:      'Por coordinar',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cuenta_proveedor: 'Pago acordado con el proveedor',
  pago_anticipado:  'Pago anticipado',
  contrareembolso:  'Contra reembolso',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  quote:                'Desde presupuesto',
  free:                 'Compra directa Marketplace',
  job:                  'Desde trabajo',
  field_action:         'Desde actuación',
  maintenance_incident: 'Desde incidencia mantenimiento',
};

const ESTADO_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  shipped:   'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  order:      PortalOrder;
  canManage:  boolean;
  canFulfill: boolean;
  onClose:    () => void;
  onUpdated:  () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortalPedidoSlideOver({
  actorId, order, canManage, canFulfill, onClose, onUpdated,
}: Props) {
  const [detail,  setDetail]  = useState<PortalOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSupplierOrderDetail(actorId, order.id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar detalle'))
      .finally(() => setLoading(false));
  }, [actorId, order.id]);

  const reload = () => {
    setLoading(true);
    getSupplierOrderDetail(actorId, order.id)
      .then((d) => { setDetail(d); onUpdated(); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al recargar'))
      .finally(() => setLoading(false));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle pedido ${order.numero}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white dark:bg-slate-900 shadow-2xl sm:w-[660px] xl:w-[740px]"
      >
        {/* Header fijo */}
        <OrderHeader order={order} detail={detail} onClose={onClose} />

        {/* Error */}
        {error && (
          <div className="px-6 pt-3 shrink-0">
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <DetailSkeleton />
          ) : detail ? (
            <OrderContent
              detail={detail}
              order={order}
              actorId={actorId}
              canManage={canManage}
              canFulfill={canFulfill}
              onReload={reload}
              onError={setError}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

// ── OrderHeader ───────────────────────────────────────────────────────────────

interface OrderHeaderProps {
  order:   PortalOrder;
  detail:  PortalOrderDetail | null;
  onClose: () => void;
}

function OrderHeader({ order, detail, onClose }: OrderHeaderProps) {
  const total = detail?.order.total ?? order.total;
  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {order.numero}
            </span>
            <OrderStatusBadge estado={order.estado as OrderLifecycleEstado} size="sm" />
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>{fmtDate(order.created_at)}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {fmt(total)}
            </span>
          </div>
          {order.org_nombre && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">{order.org_nombre}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── OrderContent (single-page layout) ────────────────────────────────────────

interface OrderContentProps {
  detail:     PortalOrderDetail;
  order:      PortalOrder;
  actorId:    string;
  canManage:  boolean;
  canFulfill: boolean;
  onReload:   () => void;
  onError:    (msg: string) => void;
}

function OrderContent({ detail, order, actorId, canManage, canFulfill, onReload, onError }: OrderContentProps) {
  const o     = detail.order;
  const estado = o.estado;

  const [busy,          setBusy]          = useState(false);
  const [showShip,      setShowShip]      = useState(false);
  const [trackRef,      setTrackRef]      = useState('');
  const [trackUrl,      setTrackUrl]      = useState('');
  const [trackUrlErr,   setTrackUrlErr]   = useState('');
  const [shipNotas,     setShipNotas]     = useState('');
  const [showCancel,    setShowCancel]    = useState(false);
  const [cancelReason,  setCancelReason]  = useState('');
  const [showIncident,  setShowIncident]  = useState(false);
  const [incidentDesc,  setIncidentDesc]  = useState('');

  const canConfirm  = estado === 'pending'   && canManage;
  const canPrepare  = estado === 'confirmed' && canFulfill && order.source === 'marketplace';
  const canShip     = (estado === 'confirmed' || estado === 'preparing') && canFulfill;
  const canCancel   = (estado === 'pending'   || estado === 'confirmed') && canManage;
  const canIncident = !['completed', 'cancelled'].includes(estado);

  const doConfirm = async () => {
    setBusy(true);
    try { await confirmSupplierOrder(order.id, order.source); onReload(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Error al confirmar'); }
    finally { setBusy(false); }
  };

  const doPrepare = async () => {
    setBusy(true);
    try { await prepareOrderFromPortal(order.id); onReload(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Error al preparar'); }
    finally { setBusy(false); }
  };

  const doShip = async () => {
    if (trackUrl) {
      try { new URL(trackUrl); }
      catch { setTrackUrlErr('URL no válida (ej: https://...)'); return; }
    }
    setBusy(true);
    try {
      if (order.source === 'marketplace') {
        await shipMarketplaceOrderWithTracking({
          orderId: order.id, trackingRef: trackRef || undefined,
          trackingUrl: trackUrl || undefined, notas: shipNotas || undefined,
        });
      } else {
        await shipSupplierOrder(order.id, order.source, trackRef || undefined);
      }
      setShowShip(false); setTrackRef(''); setTrackUrl(''); setTrackUrlErr(''); setShipNotas('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al enviar'); }
    finally { setBusy(false); }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelSupplierOrder(order.id, actorId, cancelReason || undefined);
      setShowCancel(false); setCancelReason('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al cancelar'); }
    finally { setBusy(false); }
  };

  const doIncident = async () => {
    if (!incidentDesc.trim()) return;
    setBusy(true);
    try {
      await markSupplierOrderIncident(order.id, actorId, incidentDesc.trim());
      setShowIncident(false); setIncidentDesc('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al registrar incidencia'); }
    finally { setBusy(false); }
  };

  const exportCSV = () => {
    const headers = ['Referencia', 'Descripcion', 'Cantidad', 'Unidad', 'Precio unitario', 'Total'];
    const rows = detail.items.map((i) => [
      i.referencia ?? '',
      `"${(i.descripcion ?? '').replace(/"/g, '""')}"`,
      i.cantidad, i.unidad,
      i.precio_unitario != null ? i.precio_unitario.toFixed(2) : '',
      i.precio_total    != null ? i.precio_total.toFixed(2)    : '',
    ]);
    const csv  = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `pedido-${order.numero}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-4">
      {/* ── Acciones ────────────────────────────────────────────────────────── */}
      {(canConfirm || canPrepare || canShip || canCancel || canIncident) && (
        <section aria-label="Acciones del pedido" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <ActionBtn label="Confirmar pedido" loading={busy}
                className="bg-teal-600 hover:bg-teal-500 text-white"
                onClick={doConfirm} icon={<CheckIcon />} />
            )}
            {canPrepare && (
              <ActionBtn label="Iniciar preparación" loading={busy}
                className="border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                onClick={doPrepare} icon={<BoxIcon />} />
            )}
            {canShip && !showShip && (
              <ActionBtn label="Marcar como enviado" loading={busy}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => setShowShip(true)} icon={<TruckIcon />} />
            )}
            {canCancel && !showCancel && (
              <ActionBtn label="Cancelar" loading={busy}
                className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => setShowCancel(true)} icon={<XIcon />} />
            )}
            {canIncident && !showIncident && (
              <ActionBtn label="Registrar incidencia" loading={false}
                className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => setShowIncident(true)} icon={<AlertIcon />} />
            )}
          </div>

          {showShip && (
            <InlineForm title="Datos de envío (opcionales)" onSubmit={doShip} loading={busy}
              onCancel={() => { setShowShip(false); setTrackRef(''); setTrackUrl(''); setTrackUrlErr(''); setShipNotas(''); }}
              submitLabel="Confirmar envío" submitClass="bg-blue-600 hover:bg-blue-500 text-white">
              <FormField id="track-ref" label="Referencia de tracking">
                <input id="track-ref" type="text" value={trackRef}
                  onChange={(e) => setTrackRef(e.target.value)}
                  placeholder="Ej: ES123456789" className={inputCls} />
              </FormField>
              <FormField id="track-url" label="URL de seguimiento" error={trackUrlErr}>
                <input id="track-url" type="url" value={trackUrl}
                  onChange={(e) => { setTrackUrl(e.target.value); setTrackUrlErr(''); }}
                  placeholder="https://seguimiento.transportista.es/..." aria-invalid={!!trackUrlErr}
                  className={`${inputCls} ${trackUrlErr ? 'border-red-400 dark:border-red-600' : ''}`} />
              </FormField>
              <FormField id="ship-notas" label="Nota al instalador (opcional)">
                <textarea id="ship-notas" rows={2} value={shipNotas}
                  onChange={(e) => setShipNotas(e.target.value)}
                  placeholder="Ej: Entrega en conserjería, preguntar por Juan"
                  className={`${inputCls} resize-none`} />
              </FormField>
            </InlineForm>
          )}
          {showCancel && (
            <InlineForm title="¿Por qué cancelas este pedido?" onSubmit={doCancel} loading={busy}
              onCancel={() => { setShowCancel(false); setCancelReason(''); }}
              submitLabel="Cancelar pedido" submitClass="bg-red-600 hover:bg-red-500 text-white">
              <FormField id="cancel-reason" label="Motivo (opcional)">
                <textarea id="cancel-reason" rows={3} value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Sin stock disponible, plazo no viable..."
                  className={`${inputCls} resize-none`} />
              </FormField>
            </InlineForm>
          )}
          {showIncident && (
            <InlineForm title="Descripción de la incidencia" onSubmit={doIncident} loading={busy}
              onCancel={() => { setShowIncident(false); setIncidentDesc(''); }}
              submitLabel="Registrar incidencia" submitClass="bg-amber-600 hover:bg-amber-500 text-white">
              <FormField id="incident-desc" label="Descripción *">
                <textarea id="incident-desc" rows={3} value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Describe el problema encontrado..." required
                  className={`${inputCls} resize-none`} />
              </FormField>
            </InlineForm>
          )}
        </section>
      )}

      {/* ── Cancelación ─────────────────────────────────────────────────────── */}
      {o.cancel_reason && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
          <p className="text-xs font-medium text-red-500 mb-1">Motivo de cancelación</p>
          <p className="text-sm text-red-700 dark:text-red-300">{o.cancel_reason}</p>
        </div>
      )}

      {/* ── Cliente / Origen ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCliente buyer={o.buyer_snapshot} orgNombre={order.org_nombre} />
        <SectionOrigen
          sourceType={o.source_type}
          sourceRef={o.source_ref}
          quoteDescripcion={o.quote_descripcion}
        />
      </div>

      {/* ── Productos ────────────────────────────────────────────────────────── */}
      <SectionProductos
        items={detail.items}
        subtotal={o.subtotal}
        costeEnvio={o.coste_envio}
        total={o.total}
      />

      {/* ── Entrega / Pago ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionEntrega order={o} />
        <SectionPago paymentMethod={o.payment_method} notas={o.delivery_notas} />
      </div>

      {/* ── Seguimiento ──────────────────────────────────────────────────────── */}
      <SectionSeguimiento order={o} events={detail.events} />

      {/* ── Notas propias del proveedor ───────────────────────────────────────── */}
      {o.notas_proveedor && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 p-3">
          <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1">Tus notas al instalador</p>
          <p className="text-sm text-teal-800 dark:text-teal-200">{o.notas_proveedor}</p>
        </div>
      )}

      {/* ── Exportar ─────────────────────────────────────────────────────────── */}
      <details className="rounded-xl border border-slate-200 dark:border-slate-800">
        <summary className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl">
          Exportar
        </summary>
        <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
          <DocButton label="Exportar líneas como CSV" icon={<TableIcon />}
            description="Compatible con Excel"
            onClick={exportCSV} />
          <DocButton label="Imprimir detalle" icon={<PrintIcon />}
            description="Abre el diálogo de impresión"
            onClick={() => window.print()} />
        </div>
      </details>
    </div>
  );
}

// ── SectionCliente ────────────────────────────────────────────────────────────

interface SectionClienteProps {
  buyer:     PortalBuyerSnapshot | null;
  orgNombre: string;
}

function SectionCliente({ buyer, orgNombre }: SectionClienteProps) {
  const empresa  = buyer?.empresa  || orgNombre;
  const nombre   = buyer?.nombre;
  const nif      = buyer?.nif;
  const email    = buyer?.email;
  const telefono = buyer?.telefono;

  return (
    <CardSection title="Cliente">
      {empresa && <InfoCell label="Empresa / Razón social" value={empresa} />}
      {nombre && nombre !== empresa && <InfoCell label="Nombre contacto" value={nombre} />}
      {nif     && <InfoCell label="NIF / CIF" value={nif} />}
      {telefono && (
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Teléfono</p>
          <a href={`tel:${telefono}`}
            className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline">
            {telefono}
          </a>
        </div>
      )}
      {email && (
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Email</p>
          <a href={`mailto:${email}`}
            className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline break-all">
            {email}
          </a>
        </div>
      )}
      {!buyer && !orgNombre && (
        <p className="text-sm text-slate-400 italic">Sin datos de cliente registrados.</p>
      )}
    </CardSection>
  );
}

// ── SectionOrigen ─────────────────────────────────────────────────────────────

interface SectionOrigenProps {
  sourceType:       string | null;
  sourceRef:        string | null;
  quoteDescripcion: string | null;
}

function SectionOrigen({ sourceType, sourceRef, quoteDescripcion }: SectionOrigenProps) {
  const isQuote   = sourceType === 'quote' || !!sourceRef;
  const isFree    = sourceType === 'free'  || (!sourceType && !sourceRef);
  const typeLabel = sourceType ? (SOURCE_TYPE_LABELS[sourceType] ?? sourceType) : null;

  return (
    <CardSection title="Origen del pedido">
      {isQuote && sourceRef && (
        <InfoCell label="Presupuesto" value={sourceRef} />
      )}
      {quoteDescripcion && (
        <InfoCell label="Descripción / Obra" value={quoteDescripcion} />
      )}
      {isFree && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
            🛒 Compra directa Marketplace
          </span>
        </div>
      )}
      {typeLabel && !isFree && (
        <div className="text-xs text-slate-400">{typeLabel}</div>
      )}
    </CardSection>
  );
}

// ── SectionProductos ──────────────────────────────────────────────────────────

interface SectionProductosProps {
  items:      PortalOrderItem[];
  subtotal:   number;
  costeEnvio: number;
  total:      number;
}

function SectionProductos({ items, subtotal, costeEnvio, total }: SectionProductosProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Productos — {items.length} línea{items.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-400">
              <th className="px-4 py-2 text-left font-medium">Ref.</th>
              <th className="px-4 py-2 text-left font-medium">Descripción</th>
              <th className="px-4 py-2 text-right font-medium">Cant.</th>
              <th className="px-4 py-2 text-right font-medium">P. unit.</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            {subtotal !== total && (
              <tr>
                <td colSpan={4} className="px-4 py-1.5 text-right text-xs text-slate-400">Subtotal</td>
                <td className="px-4 py-1.5 text-right text-xs tabular-nums text-slate-500">{fmt(subtotal)}</td>
              </tr>
            )}
            {costeEnvio > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-1.5 text-right text-xs text-slate-400">Portes</td>
                <td className="px-4 py-1.5 text-right text-xs tabular-nums text-slate-500">+{fmt(costeEnvio)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                Total pedido
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-teal-600 dark:text-teal-400">
                {fmt(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── SectionEntrega ────────────────────────────────────────────────────────────

interface SectionEntregaProps {
  order: import('../../lib/api/marketplace-portal').PortalOrderDetailOrder;
}

function SectionEntrega({ order: o }: SectionEntregaProps) {
  const isPickup = o.delivery_method === 'recogida_proveedor';
  const pickup   = o.pickup_location_snapshot;
  const addr     = o.direccion_entrega;
  const methodLabel = o.delivery_method ? (DELIVERY_METHOD_LABELS[o.delivery_method] ?? o.delivery_method) : null;

  return (
    <CardSection title="Entrega">
      {/* Badge método */}
      {methodLabel && (
        <div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isPickup
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
          }`}>
            {isPickup ? '🏪' : '🚚'} {methodLabel}
          </span>
        </div>
      )}

      {/* Punto de recogida */}
      {isPickup && pickup && (
        <>
          <InfoCell label="Tienda / Almacén" value={pickup.nombre} />
          {pickup.direccion_linea1 && (
            <InfoCell
              label="Dirección"
              value={[pickup.direccion_linea1, pickup.codigo_postal, pickup.localidad, pickup.provincia]
                .filter(Boolean).join(', ')}
            />
          )}
          {pickup.telefono && <InfoCell label="Teléfono tienda" value={pickup.telefono} />}
        </>
      )}

      {/* Dirección de envío (jsonb estructurado) */}
      {!isPickup && addr && (
        <>
          {addr.nombre_contacto && <InfoCell label="Destinatario" value={addr.nombre_contacto} />}
          {addr.calle && (
            <InfoCell
              label="Dirección"
              value={[addr.calle, addr.cp, addr.ciudad].filter(Boolean).join(', ')}
            />
          )}
          {addr.telefono_contacto && <InfoCell label="Teléfono contacto" value={addr.telefono_contacto} />}
        </>
      )}

      {/* Dirección legacy (texto plano) */}
      {!isPickup && !addr && o.delivery_address && (
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{o.delivery_address}</p>
      )}

      {/* Tracking (si existe) */}
      {(o.tracking_ref || o.tracking_url) && (
        <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tracking</p>
          {o.tracking_ref && <InfoCell label="Referencia" value={o.tracking_ref} />}
          {o.tracking_url && (
            <a href={o.tracking_url} target="_blank" rel="noreferrer noopener"
              className="block text-xs text-teal-600 dark:text-teal-400 underline underline-offset-2 break-all hover:text-teal-500">
              {o.tracking_url}
            </a>
          )}
        </div>
      )}

      {/* Vacío */}
      {!methodLabel && !pickup && !addr && !o.delivery_address && !o.tracking_ref && (
        <p className="text-sm text-slate-400 italic">Sin datos de entrega.</p>
      )}
    </CardSection>
  );
}

// ── SectionPago ───────────────────────────────────────────────────────────────

interface SectionPagoProps {
  paymentMethod: string | null;
  notas:         string | null;
}

function SectionPago({ paymentMethod, notas }: SectionPagoProps) {
  const payLabel = paymentMethod ? (PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod) : null;
  return (
    <CardSection title="Pago">
      {payLabel
        ? <InfoCell label="Método de pago" value={payLabel} />
        : <p className="text-sm text-slate-400 italic">Sin método de pago registrado.</p>
      }
      {notas && (
        <div className="mt-1">
          <p className="text-xs text-slate-400 mb-0.5">Notas del instalador</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{notas}"</p>
        </div>
      )}
    </CardSection>
  );
}

// ── SectionSeguimiento ────────────────────────────────────────────────────────

interface SectionSeguimientoProps {
  order:  import('../../lib/api/marketplace-portal').PortalOrderDetailOrder;
  events: PortalOrderEvent[];
}

interface TimelineStep {
  key:       string;
  label:     string;
  pickupLabel?: string;
  ts:        string | null;
}

function SectionSeguimiento({ order: o, events }: SectionSeguimientoProps) {
  const isPickup     = o.delivery_method === 'recogida_proveedor';
  const isCancelled  = o.estado === 'cancelled';

  const steps: TimelineStep[] = [
    { key: 'pending',   label: 'Recibido',     ts: o.created_at  },
    { key: 'confirmed', label: 'Confirmado',   ts: o.confirmed_at },
    { key: 'preparing', label: 'Preparando',   ts: o.preparing_at },
    { key: 'shipped',   label: isPickup ? 'Listo para recoger' : 'Enviado', pickupLabel: 'Listo para recoger', ts: o.shipped_at },
    { key: 'completed', label: isPickup ? 'Recogido' : 'Completado', ts: o.completed_at ?? o.delivered_at },
  ];

  const currentIdx = (() => {
    const map: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, shipped: 3, delivered: 4, completed: 4 };
    return isCancelled ? -1 : (map[o.estado] ?? 0);
  })();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Seguimiento
        </p>
      </div>

      {/* Timeline visual */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-0">
          {steps.map((step, idx) => {
            const done    = !isCancelled && idx < currentIdx;
            const current = !isCancelled && idx === currentIdx;
            const future  = isCancelled || idx > currentIdx;
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center min-w-0">
                {/* Conector línea */}
                <div className="w-full flex items-center">
                  {idx > 0 && (
                    <div className={`flex-1 h-0.5 ${done || current ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                  <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors ${
                    done    ? 'bg-teal-500 border-teal-500 text-white'
                    : current ? 'bg-white dark:bg-slate-900 border-teal-500 text-teal-600 dark:text-teal-400 ring-2 ring-teal-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}>
                    {done ? (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : <span>{idx + 1}</span>}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 ${done ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
                {/* Label + fecha */}
                <div className="mt-1.5 text-center px-0.5 min-w-0">
                  <p className={`text-[10px] font-medium leading-tight ${
                    current ? 'text-teal-600 dark:text-teal-400'
                    : done   ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-400'
                  }`}>{step.label}</p>
                  {step.ts && (done || current) && (
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{fmtShort(step.ts)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancelado */}
        {isCancelled && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2">
            <XIcon />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Pedido cancelado{o.cancelled_at ? ` · ${fmtShort(o.cancelled_at)}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Eventos de auditoría */}
      {events.length > 0 && (
        <details className="border-t border-slate-100 dark:border-slate-800">
          <summary className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">
            Historial de eventos ({events.length})
          </summary>
          <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-4 ml-7 mr-4 pb-4 mt-2">
            {events.map((ev) => <EventItem key={ev.id} event={ev} />)}
          </ol>
        </details>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

interface CardSectionProps { title: string; children: React.ReactNode; }
function CardSection({ title, children }: CardSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

interface InfoCellProps { label: string; value: string | null | undefined; }
function InfoCell({ label, value }: InfoCellProps) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium break-words">{value}</p>
    </div>
  );
}

interface ActionBtnProps { label: string; loading: boolean; className: string; onClick: () => void; icon: React.ReactNode; }
function ActionBtn({ label, loading, className, onClick, icon }: ActionBtnProps) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-teal-500 ${className}`}>
      {loading
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        : icon}
      {label}
    </button>
  );
}

interface InlineFormProps { title: string; onSubmit: () => void; onCancel: () => void; submitLabel: string; submitClass: string; loading: boolean; children: React.ReactNode; }
function InlineForm({ title, onSubmit, onCancel, submitLabel, submitClass, loading, children }: InlineFormProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children}
      <div className="flex gap-2 pt-1">
        <button onClick={onSubmit} disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${submitClass}`}>
          {loading ? 'Procesando...' : submitLabel}
        </button>
        <button onClick={onCancel} disabled={loading}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

interface FormFieldProps { id: string; label: string; error?: string; children: React.ReactNode; }
function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

interface OrderItemRowProps { item: PortalOrderItem; }
function OrderItemRow({ item }: OrderItemRowProps) {
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono whitespace-nowrap">{item.referencia ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
        <p className="line-clamp-2" title={item.descripcion}>{item.descripcion}</p>
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {item.cantidad} {item.unidad}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {item.precio_unitario != null ? fmt(item.precio_unitario) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
        {item.precio_total != null ? fmt(item.precio_total) : '—'}
      </td>
    </tr>
  );
}

interface DocButtonProps { label: string; description: string; icon: React.ReactNode; onClick: () => void; }
function DocButton({ label, description, icon, onClick }: DocButtonProps) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
      <span className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-500 dark:text-slate-400">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

const EVENT_TIPO_LABELS: Record<string, string> = {
  order_created:      'Pedido creado',
  state_changed:      'Cambio de estado',
  incident_reported:  'Incidencia registrada',
  note_added:         'Nota añadida',
  tracking_updated:   'Tracking actualizado',
};

const EVENT_TIPO_COLORS: Record<string, string> = {
  order_created:      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  state_changed:      'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  incident_reported:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  note_added:         'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

interface EventItemProps { event: PortalOrderEvent; }
function EventItem({ event }: EventItemProps) {
  const label = EVENT_TIPO_LABELS[event.tipo] ?? event.tipo;
  const color = EVENT_TIPO_COLORS[event.tipo] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  return (
    <li className="ml-4 relative">
      <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-teal-500" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
          <span className="text-xs text-slate-400">{fmtShort(event.created_at)}</span>
          {event.actor_type && (
            <span className="text-xs text-slate-400">
              · {event.actor_type === 'supplier' ? 'Proveedor' : event.actor_type === 'system' ? 'Sistema' : 'Instalador'}
            </span>
          )}
        </div>
        {event.from_estado && event.to_estado && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ESTADO_LABELS[event.from_estado] ?? event.from_estado} → {ESTADO_LABELS[event.to_estado] ?? event.to_estado}
          </p>
        )}
        {event.notas && <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{event.notas}</p>}
      </div>
    </li>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando detalle">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
function BoxIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function TruckIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;
}
function XIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
function AlertIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
}
function TableIcon() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>;
}
function PrintIcon() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
}
