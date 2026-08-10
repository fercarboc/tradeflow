import React, { useEffect, useState } from 'react';
import {
  PortalOrder,
  PortalOrderDetail,
  PortalOrderItem,
  PortalOrderEvent,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

const fmtRelative = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor(diff / 60_000);
  if (m < 60)  return `hace ${m} min`;
  if (h < 24)  return `hace ${h} h`;
  return fmtDate(d) ?? d;
};

type Tab = 'resumen' | 'lineas' | 'envio' | 'documentos' | 'historial';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  order:      PortalOrder;
  canManage:  boolean;
  canFulfill: boolean;
  onClose:    () => void;
  onUpdated:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalPedidoSlideOver({
  actorId, order, canManage, canFulfill, onClose, onUpdated,
}: Props) {
  const [tab,     setTab]     = useState<Tab>('resumen');
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
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white dark:bg-slate-900 shadow-2xl sm:w-[640px] xl:w-[720px]"
      >
        {/* Header */}
        <SlideHeader order={order} onClose={onClose} />

        {/* Tabs */}
        <SlideTabs tab={tab} onTabChange={setTab} />

        {/* Error global */}
        {error && (
          <div className="px-6 pt-3">
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <DetailSkeleton />
          ) : detail ? (
            <>
              {tab === 'resumen'    && (
                <TabResumen
                  detail={detail}
                  order={order}
                  actorId={actorId}
                  canManage={canManage}
                  canFulfill={canFulfill}
                  onReload={reload}
                  onError={setError}
                />
              )}
              {tab === 'lineas'     && <TabLineas items={detail.items} total={detail.order.total} subtotal={detail.order.subtotal} costeEnvio={detail.order.coste_envio} />}
              {tab === 'envio'      && <TabEnvio detail={detail} />}
              {tab === 'documentos' && <TabDocumentos order={order} items={detail.items} />}
              {tab === 'historial'  && <TabHistorial events={detail.events} />}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ── SlideHeader ───────────────────────────────────────────────────────────────

interface SlideHeaderProps {
  order:   PortalOrder;
  onClose: () => void;
}

function SlideHeader({ order, onClose }: SlideHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{order.numero}</span>
          <OrderStatusBadge estado={order.estado as OrderLifecycleEstado} size="sm" />
          {order.source === 'marketplace' && (
            <span className="rounded-full bg-teal-100 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
              Marketplace
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">{order.org_nombre}</p>
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
  );
}

// ── SlideTabs ─────────────────────────────────────────────────────────────────

interface SlideTabsProps {
  tab:         Tab;
  onTabChange: (t: Tab) => void;
}

const TAB_LIST: { id: Tab; label: string }[] = [
  { id: 'resumen',    label: 'Resumen'    },
  { id: 'lineas',     label: 'Líneas'     },
  { id: 'envio',      label: 'Envío'      },
  { id: 'documentos', label: 'Documentos' },
  { id: 'historial',  label: 'Historial'  },
];

function SlideTabs({ tab, onTabChange }: SlideTabsProps) {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto" role="tablist">
      {TAB_LIST.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onTabChange(t.id)}
          className={`shrink-0 px-5 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 transition-colors ${
            tab === t.id
              ? 'border-b-2 border-teal-600 text-teal-600 dark:text-teal-400 -mb-px'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── TabResumen ────────────────────────────────────────────────────────────────

interface TabResumenProps {
  detail:     PortalOrderDetail;
  order:      PortalOrder;
  actorId:    string;
  canManage:  boolean;
  canFulfill: boolean;
  onReload:   () => void;
  onError:    (msg: string) => void;
}

function TabResumen({ detail, order, actorId, canManage, canFulfill, onReload, onError }: TabResumenProps) {
  const o     = detail.order;
  const estado = o.estado;

  const [busy,        setBusy]        = useState(false);
  const [showShip,    setShowShip]    = useState(false);
  const [trackRef,    setTrackRef]    = useState('');
  const [trackUrl,    setTrackUrl]    = useState('');
  const [trackUrlErr, setTrackUrlErr] = useState('');
  const [shipNotas,   setShipNotas]   = useState('');
  const [showCancel,  setShowCancel]  = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showIncident,  setShowIncident]  = useState(false);
  const [incidentDesc,  setIncidentDesc]  = useState('');

  const canConfirm  = estado === 'pending'   && canManage;
  const canPrepare  = estado === 'confirmed' && canFulfill && order.source === 'marketplace';
  const canShip     = (estado === 'confirmed' || estado === 'preparing') && canFulfill;
  const canCancel   = (estado === 'pending'   || estado === 'confirmed') && canManage;
  const canIncident = !['completed','cancelled'].includes(estado);

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmSupplierOrder(order.id, order.source);
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al confirmar'); }
    finally { setBusy(false); }
  };

  const doPrepare = async () => {
    setBusy(true);
    try {
      await prepareOrderFromPortal(order.id);
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al preparar'); }
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
          orderId:     order.id,
          trackingRef: trackRef || undefined,
          trackingUrl: trackUrl || undefined,
          notas:       shipNotas || undefined,
        });
      } else {
        await shipSupplierOrder(order.id, order.source, trackRef || undefined);
      }
      setShowShip(false);
      setTrackRef('');
      setTrackUrl('');
      setShipNotas('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al enviar'); }
    finally { setBusy(false); }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelSupplierOrder(order.id, actorId, cancelReason || undefined);
      setShowCancel(false);
      setCancelReason('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al cancelar'); }
    finally { setBusy(false); }
  };

  const doIncident = async () => {
    if (!incidentDesc.trim()) return;
    setBusy(true);
    try {
      await markSupplierOrderIncident(order.id, actorId, incidentDesc.trim());
      setShowIncident(false);
      setIncidentDesc('');
      onReload();
    } catch (e) { onError(e instanceof Error ? e.message : 'Error al registrar incidencia'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Totales */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            {o.subtotal !== o.total && (
              <p className="text-xs text-slate-400">
                Subtotal <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmt(o.subtotal)}</span>
                {o.coste_envio > 0 && (
                  <> + portes <span className="tabular-nums">{fmt(o.coste_envio)}</span></>
                )}
              </p>
            )}
            <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">{fmt(o.total)}</p>
          </div>
          <p className="text-sm text-slate-400">{detail.items.length} línea{detail.items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <InfoCell label="Recibido"   value={fmtDate(o.created_at)} />
        {o.confirmed_at && <InfoCell label="Confirmado"  value={fmtDate(o.confirmed_at)} />}
        {o.preparing_at && <InfoCell label="Preparando"  value={fmtDate(o.preparing_at)} />}
        {o.shipped_at   && <InfoCell label="Enviado"     value={fmtDate(o.shipped_at)}   />}
        {o.delivered_at && <InfoCell label="Entregado"   value={fmtDate(o.delivered_at)} />}
        {o.cancelled_at && <InfoCell label="Cancelado"   value={fmtDate(o.cancelled_at)} />}
        {o.completed_at && <InfoCell label="Completado"  value={fmtDate(o.completed_at)} />}
      </div>

      {/* Notas del instalador */}
      {o.notas && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs font-medium text-slate-400 mb-1">Notas del instalador</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{o.notas}"</p>
        </div>
      )}

      {/* Razón de cancelación */}
      {o.cancel_reason && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
          <p className="text-xs font-medium text-red-500 mb-1">Motivo de cancelación</p>
          <p className="text-sm text-red-700 dark:text-red-300">{o.cancel_reason}</p>
        </div>
      )}

      {/* Acciones */}
      {(canConfirm || canPrepare || canShip || canCancel || canIncident) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Acciones</p>

          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <ActionBtn
                label="Confirmar pedido"
                loading={busy}
                className="bg-teal-600 hover:bg-teal-500 text-white"
                onClick={doConfirm}
                icon={<CheckIcon />}
              />
            )}
            {canPrepare && (
              <ActionBtn
                label="Iniciar preparación"
                loading={busy}
                className="border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                onClick={doPrepare}
                icon={<BoxIcon />}
              />
            )}
            {canShip && !showShip && (
              <ActionBtn
                label="Marcar como enviado"
                loading={busy}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => setShowShip(true)}
                icon={<TruckIcon />}
              />
            )}
            {canCancel && !showCancel && (
              <ActionBtn
                label="Cancelar pedido"
                loading={busy}
                className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => setShowCancel(true)}
                icon={<XIcon />}
              />
            )}
            {canIncident && !showIncident && (
              <ActionBtn
                label="Registrar incidencia"
                loading={false}
                className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => setShowIncident(true)}
                icon={<AlertIcon />}
              />
            )}
          </div>

          {/* Formulario de envío inline */}
          {showShip && (
            <InlineForm
              title="Datos de envío (opcionales)"
              onSubmit={doShip}
              onCancel={() => { setShowShip(false); setTrackRef(''); setTrackUrl(''); setTrackUrlErr(''); setShipNotas(''); }}
              submitLabel="Confirmar envío"
              submitClass="bg-blue-600 hover:bg-blue-500 text-white"
              loading={busy}
            >
              <FormField id="track-ref" label="Referencia de tracking">
                <input
                  id="track-ref" type="text" value={trackRef}
                  onChange={(e) => setTrackRef(e.target.value)}
                  placeholder="Ej: ES123456789"
                  className={inputCls}
                />
              </FormField>
              <FormField id="track-url" label="URL de seguimiento" error={trackUrlErr}>
                <input
                  id="track-url" type="url" value={trackUrl}
                  onChange={(e) => { setTrackUrl(e.target.value); setTrackUrlErr(''); }}
                  placeholder="https://seguimiento.transportista.es/..."
                  aria-invalid={!!trackUrlErr}
                  className={`${inputCls} ${trackUrlErr ? 'border-red-400 dark:border-red-600' : ''}`}
                />
              </FormField>
              <FormField id="ship-notas" label="Nota al instalador (opcional)">
                <textarea
                  id="ship-notas" rows={2} value={shipNotas}
                  onChange={(e) => setShipNotas(e.target.value)}
                  placeholder="Ej: Entrega en conserjería, preguntar por Juan"
                  className={`${inputCls} resize-none`}
                />
              </FormField>
            </InlineForm>
          )}

          {/* Formulario de cancelación inline */}
          {showCancel && (
            <InlineForm
              title="¿Por qué cancelas este pedido?"
              onSubmit={doCancel}
              onCancel={() => { setShowCancel(false); setCancelReason(''); }}
              submitLabel="Cancelar pedido"
              submitClass="bg-red-600 hover:bg-red-500 text-white"
              loading={busy}
            >
              <FormField id="cancel-reason" label="Motivo (opcional)">
                <textarea
                  id="cancel-reason" rows={3} value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Sin stock disponible, plazo no viable..."
                  className={`${inputCls} resize-none`}
                />
              </FormField>
            </InlineForm>
          )}

          {/* Formulario de incidencia inline */}
          {showIncident && (
            <InlineForm
              title="Descripción de la incidencia"
              onSubmit={doIncident}
              onCancel={() => { setShowIncident(false); setIncidentDesc(''); }}
              submitLabel="Registrar incidencia"
              submitClass="bg-amber-600 hover:bg-amber-500 text-white"
              loading={busy}
            >
              <FormField id="incident-desc" label="Descripción *">
                <textarea
                  id="incident-desc" rows={3} value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Describe el problema encontrado..."
                  required
                  className={`${inputCls} resize-none`}
                />
              </FormField>
            </InlineForm>
          )}
        </div>
      )}

      {/* Notas del proveedor (propias) */}
      {o.notas_proveedor && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 p-3">
          <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1">Tus notas al instalador</p>
          <p className="text-sm text-teal-800 dark:text-teal-200">{o.notas_proveedor}</p>
        </div>
      )}
    </div>
  );
}

// ── TabLineas ─────────────────────────────────────────────────────────────────

interface TabLineasProps {
  items:      PortalOrderItem[];
  total:      number;
  subtotal:   number;
  costeEnvio: number;
}

function TabLineas({ items, total, subtotal, costeEnvio }: TabLineasProps) {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Ref.</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Descripción</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Cant.</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">P. unitario</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {items.map((item) => (
                <OrderItemRow key={item.id} item={item} />
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 dark:border-slate-800">
              {costeEnvio > 0 && (
                <tr className="bg-slate-50 dark:bg-slate-950">
                  <td colSpan={4} className="px-4 py-2 text-right text-xs text-slate-400">Portes</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-500">+{fmt(costeEnvio)}</td>
                </tr>
              )}
              <tr className="bg-slate-50 dark:bg-slate-950">
                <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">Total</td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-teal-600 dark:text-teal-400">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── TabEnvio ──────────────────────────────────────────────────────────────────

interface TabEnvioProps {
  detail: PortalOrderDetail;
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  entrega_obra:       'Envío a obra',
  entrega_almacen:    'Envío a almacén',
  recogida_proveedor: 'Recogida en tienda/almacén',
  por_coordinar:      'Por coordinar',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cuenta_proveedor: 'Cuenta del proveedor',
  pago_anticipado:  'Pago anticipado',
  contrareembolso:  'Contra reembolso',
};

function TabEnvio({ detail }: TabEnvioProps) {
  const o = detail.order;
  const hasTracking  = o.tracking_ref || o.tracking_url;
  const isPickup     = o.delivery_method === 'recogida_proveedor';
  const pickup       = o.pickup_location_snapshot;
  const addr         = o.direccion_entrega as Record<string, string> | null;

  return (
    <div className="p-6 space-y-5">
      {/* Método de entrega — siempre visible si existe */}
      {o.delivery_method && (
        <InfoSection title="Forma de entrega">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPickup
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
            }`}>
              {isPickup ? '🏪' : '🚚'} {DELIVERY_METHOD_LABELS[o.delivery_method] ?? o.delivery_method}
            </span>
          </div>
          {o.payment_method && (
            <InfoCell label="Pago" value={PAYMENT_METHOD_LABELS[o.payment_method] ?? o.payment_method} />
          )}
        </InfoSection>
      )}

      {/* Punto de recogida */}
      {isPickup && pickup && (
        <InfoSection title="Punto de recogida">
          <InfoCell label="Tienda / Almacén" value={pickup.nombre} />
          {pickup.direccion_linea1 && (
            <InfoCell
              label="Dirección"
              value={[pickup.direccion_linea1, pickup.codigo_postal, pickup.localidad, pickup.provincia]
                .filter(Boolean).join(', ')}
            />
          )}
          {pickup.telefono && <InfoCell label="Teléfono" value={pickup.telefono} />}
        </InfoSection>
      )}

      {/* Dirección de entrega para envíos */}
      {!isPickup && addr && (
        <InfoSection title="Dirección de entrega">
          {addr.nombre_contacto && <InfoCell label="Contacto" value={addr.nombre_contacto} />}
          {addr.calle && (
            <InfoCell
              label="Dirección"
              value={[addr.calle, addr.cp, addr.ciudad].filter(Boolean).join(', ')}
            />
          )}
          {addr.telefono_contacto && <InfoCell label="Teléfono" value={addr.telefono_contacto} />}
        </InfoSection>
      )}

      {/* Dirección legacy (texto plano) */}
      {!isPickup && !addr && o.delivery_address && (
        <InfoSection title="Dirección de entrega">
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{o.delivery_address}</p>
        </InfoSection>
      )}

      {/* Notas de entrega del instalador */}
      {o.delivery_notas && (
        <InfoSection title="Notas del instalador">
          <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{o.delivery_notas}"</p>
        </InfoSection>
      )}

      {/* Tracking */}
      {hasTracking && (
        <InfoSection title="Tracking">
          {o.tracking_ref && <InfoCell label="Referencia" value={o.tracking_ref} />}
          {o.tracking_url && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">URL de seguimiento</p>
              <a
                href={o.tracking_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-teal-600 dark:text-teal-400 underline underline-offset-2 break-all hover:text-teal-500"
              >
                {o.tracking_url}
              </a>
            </div>
          )}
        </InfoSection>
      )}

      {/* Notas del proveedor al instalador */}
      {o.notas_proveedor && (
        <InfoSection title="Notas al instalador">
          <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{o.notas_proveedor}"</p>
        </InfoSection>
      )}

      {/* Vacío total */}
      {!o.delivery_method && !hasTracking && !o.delivery_address && !o.notas_proveedor && !detail.supplier_config && (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-slate-400">Sin datos de envío registrados.</p>
        </div>
      )}
    </div>
  );
}

// ── TabDocumentos ─────────────────────────────────────────────────────────────

interface TabDocumentosProps {
  order: PortalOrder;
  items: PortalOrderItem[];
}

function TabDocumentos({ order, items }: TabDocumentosProps) {
  const exportCSV = () => {
    const headers = ['Referencia', 'Descripcion', 'Cantidad', 'Unidad', 'Precio unitario', 'Total'];
    const rows = items.map((i) => [
      i.referencia ?? '',
      `"${(i.descripcion ?? '').replace(/"/g, '""')}"`,
      i.cantidad,
      i.unidad,
      i.precio_unitario != null ? i.precio_unitario.toFixed(2) : '',
      i.precio_total    != null ? i.precio_total.toFixed(2)    : '',
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pedido-${order.numero}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-4">Exportar y descargar</p>

      <DocButton
        label="Exportar líneas como CSV"
        description="Descarga un archivo CSV con todas las líneas del pedido (compatible con Excel)."
        icon={<TableIcon />}
        onClick={exportCSV}
      />
      <DocButton
        label="Imprimir detalle"
        description="Abre el diálogo de impresión del navegador con la vista del pedido."
        icon={<PrintIcon />}
        onClick={() => window.print()}
      />
    </div>
  );
}

// ── TabHistorial ──────────────────────────────────────────────────────────────

interface TabHistorialProps {
  events: PortalOrderEvent[];
}

function TabHistorial({ events }: TabHistorialProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center p-6">
        <p className="text-sm text-slate-400">Sin eventos registrados.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-6 ml-3">
        {events.map((ev) => (
          <EventItem key={ev.id} event={ev} />
        ))}
      </ol>
    </div>
  );
}

// ── Shared sub-components (all module-level) ──────────────────────────────────

interface InfoCellProps  { label: string; value: string | null | undefined; }
function InfoCell({ label, value }: InfoCellProps) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{value}</p>
    </div>
  );
}

interface InfoSectionProps { title: string; children: React.ReactNode; }
function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

interface ActionBtnProps {
  label:     string;
  loading:   boolean;
  className: string;
  onClick:   () => void;
  icon:      React.ReactNode;
}
function ActionBtn({ label, loading, className, onClick, icon }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-teal-500 ${className}`}
    >
      {loading
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        : icon}
      {label}
    </button>
  );
}

interface InlineFormProps {
  title:       string;
  onSubmit:    () => void;
  onCancel:    () => void;
  submitLabel: string;
  submitClass: string;
  loading:     boolean;
  children:    React.ReactNode;
}
function InlineForm({ title, onSubmit, onCancel, submitLabel, submitClass, loading, children }: InlineFormProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${submitClass}`}
        >
          {loading ? 'Procesando...' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
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
    <tr>
      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono whitespace-nowrap">{item.referencia ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 max-w-[200px]">
        <p className="truncate" title={item.descripcion}>{item.descripcion}</p>
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
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <span className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-500 dark:text-slate-400">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <svg className="ml-auto h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  );
}

const EVENT_TIPO_LABELS: Record<string, string> = {
  state_changed:      'Cambio de estado',
  incident_reported:  'Incidencia registrada',
  note_added:         'Nota añadida',
  tracking_updated:   'Tracking actualizado',
};

const EVENT_TIPO_COLORS: Record<string, string> = {
  state_changed:      'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  incident_reported:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  note_added:         'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
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
          <span className="text-xs text-slate-400">{fmtRelative(event.created_at)}</span>
          {event.actor_type && (
            <span className="text-xs text-slate-400">· {event.actor_type === 'supplier' ? 'Proveedor' : event.actor_type === 'system' ? 'Sistema' : 'Instalador'}</span>
          )}
        </div>
        {event.from_estado && event.to_estado && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ESTADO_LABELS[event.from_estado] ?? event.from_estado} → {ESTADO_LABELS[event.to_estado] ?? event.to_estado}
          </p>
        )}
        {event.notas && (
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{event.notas}</p>
        )}
      </div>
    </li>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando detalle">
      <div className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

// ── Icon components ───────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500';

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
