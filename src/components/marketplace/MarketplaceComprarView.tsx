import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../../types';
import {
  CartDetail, CartProviderSummary, OrderByIdRow,
  DeliveryOptionPerProvider, BuyerSnapshot,
  getCartDetail, getCartProviderSummary, checkoutCartV2, getOrdersByIds,
  getOrdersByCheckoutKey,
  DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS,
} from '../../lib/api/marketplace-checkout';
import { getPurchaseSummaryByCheckoutKey } from '../../lib/marketplace/finance/marketplace-purchase-summary.service';
import { downloadMarketplacePurchaseSummary } from '../../lib/printMarketplacePurchase';
import {
  MarketplacePurchaseContext,
  loadPurchaseContext,
  clearPurchaseContext,
} from '../../lib/marketplace/purchase-context';
import {
  MarketplacePurchaseSession,
  createPurchaseSession,
  loadPurchaseSession,
  savePurchaseSession,
  clearPurchaseSession,
} from '../../lib/marketplace/purchase-session';
import { OrderLifecycleEstado } from '../../lib/api/marketplace-orders';
import { useSession } from '../../context/SessionContext';
import { useMarketplaceCart } from '../../hooks/useMarketplaceCart';
import StepRevisar from './StepRevisar';
import StepEntrega from './StepEntrega';
import StepConfirmar from './StepConfirmar';
import OrderTimeline from './shared/OrderTimeline';
import { INSTALLER_ESTADO_LABELS } from './shared/OrderStatusBadge';

// RC1-C.6.3: clave namespaciada por quoteId para aislar carritos de presupuestos distintos
function cartKey(quoteId: string | null | undefined): string {
  return quoteId ? `mkt_cart_id_${quoteId}` : 'mkt_cart_id_noquote';
}

// Elimina actores huérfanos y sanea campos de recogida (P4)
// pickup_point_id referencia trade_marketplace_supplier_pickup_points — tabla vacía,
// nunca puede tener valor válido. pickup_location_id → trade_marketplace_supplier_locations.
function sanitizeDeliveryData(
  delivery: Record<string, DeliveryOptionPerProvider>,
  summary:  CartProviderSummary[],
): Record<string, DeliveryOptionPerProvider> {
  const activeIds = new Set(summary.map(s => s.actor_id));
  const result: Record<string, DeliveryOptionPerProvider> = {};
  for (const [actorId, opt] of Object.entries(delivery)) {
    if (!activeIds.has(actorId)) continue; // actor ya no está en el carrito activo
    const isPickup = opt.delivery_method === 'recogida_proveedor';
    result[actorId] = {
      ...opt,
      pickup_point_id:          null,                                              // FK a tabla vacía — siempre null
      pickup_location_id:       isPickup ? (opt.pickup_location_id       ?? null) : null,
      pickup_location_snapshot: isPickup ? (opt.pickup_location_snapshot ?? null) : null,
    };
  }
  return result;
}

type WizardStep = 'revisar' | 'entrega' | 'confirmar' | 'exito';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'revisar',   label: 'Revisar' },
  { id: 'entrega',   label: 'Entrega' },
  { id: 'confirmar', label: 'Confirmar' },
];

// ─── Etiqueta del botón atrás según el paso ───────────────────────────────────

function backLabel(step: WizardStep): string {
  if (step === 'confirmar') return 'Entrega';
  if (step === 'entrega')   return 'Revisar';
  return 'Catálogo';
}

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

// ─── Cabecera contextual (presupuesto + cliente + obra) ───────────────────────

interface ContextBannerProps {
  context: MarketplacePurchaseContext | null;
  cart:    CartDetail | null;
  onVolver: () => void;
}

function ContextBanner({ context, cart, onVolver }: ContextBannerProps) {
  if (!context && !cart) return null;

  const quoteRef     = context?.quoteRef     ?? cart?.cart.source_ref ?? null;
  const customerName = context?.customerName ?? null;
  const projectName  = context?.projectName  ?? null;
  const totalItems   = cart?.summary.total_items        ?? context?.lineCount ?? null;
  const withUp       = cart?.summary.items_con_up       ?? null;
  const withProvider = cart?.summary.items_con_proveedor ?? null;
  const totalEst     = cart?.summary.total_estimado     ?? null;

  return (
    <div className="bg-[#1A5A96]/8 border-b border-[#1A5A96]/15 shrink-0">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onVolver}
                className="text-[#1A5A96] font-bold text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] rounded"
              >
                ← {quoteRef ?? 'Presupuesto'}
              </button>
              {customerName && <span className="text-gray-400 text-xs">·</span>}
              {customerName && <span className="text-gray-600 text-sm font-medium">{customerName}</span>}
            </div>
            {projectName && (
              <p className="text-gray-500 text-xs mt-0.5 line-clamp-1 italic">{projectName}</p>
            )}
          </div>

          {(totalItems != null || totalEst != null) && (
            <div className="flex items-center gap-4 shrink-0">
              {totalItems != null && (
                <div className="text-center">
                  <p className="text-gray-900 font-bold text-sm tabular-nums">{totalItems}</p>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide">Líneas</p>
                </div>
              )}
              {withUp != null && (
                <div className="text-center">
                  <p className="text-[#1A5A96] font-bold text-sm tabular-nums">{withUp}</p>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide">Localizados</p>
                </div>
              )}
              {withProvider != null && (
                <div className="text-center">
                  <p className="text-emerald-600 font-bold text-sm tabular-nums">{withProvider}</p>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide">Con proveedor</p>
                </div>
              )}
              {totalEst != null && totalEst > 0 && (
                <div className="text-center">
                  <p className="text-gray-900 font-black text-sm tabular-nums">
                    {totalEst.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide">Estimado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MarketplaceComprarView({ setCurrentPage, session }: Props) {
  const { org }                 = useSession();
  const { actions: cartActions } = useMarketplaceCart();

  const [context,         setContext]         = useState<MarketplacePurchaseContext | null>(null);
  const [cartId,          setCartId]          = useState<string | null>(null);
  const [cart,            setCart]            = useState<CartDetail | null>(null);
  const [providerSummary, setProviderSummary] = useState<CartProviderSummary[]>([]);
  const [step,            setStep]            = useState<WizardStep>('revisar');
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [checking,        setChecking]        = useState(false);
  const [orders,          setOrders]          = useState<OrderByIdRow[]>([]);

  // Estado entrega — persistido entre revisar y confirmar
  const [deliveryData,   setDeliveryData]   = useState<Record<string, DeliveryOptionPerProvider>>({});
  const [buyerSnapshot,  setBuyerSnapshot]  = useState<BuyerSnapshot>({
    nombre: '', empresa: '', nif: '', email: session?.user?.email ?? '', telefono: '',
  });

  // Sesión unificada de compra (P0-A)
  // checkout_key vive en la sesión — nunca en el ciclo de vida del componente
  const purchaseSession = useRef<MarketplacePurchaseSession | null>(null);

  // Precarga datos del comprador desde la organización
  useEffect(() => {
    if (!org) return;
    setBuyerSnapshot(prev => ({
      nombre:   prev.nombre   || org.nombre,
      empresa:  prev.empresa  || org.nombre,
      nif:      prev.nif      || org.nif      || '',
      email:    prev.email    || org.email    || session?.user?.email || '',
      telefono: prev.telefono || org.telefono || '',
    }));
  }, [org, session?.user?.email]);

  useEffect(() => {
    if (!session) setCurrentPage(ActivePage.Login);
  }, [session, setCurrentPage]);

  useEffect(() => {
    const ctx     = loadPurchaseContext();
    const quoteId = ctx?.quoteId ?? null;
    setContext(ctx ?? null);

    // RC1-C.6.3 (P1+P2): sesión namespaciada por quoteId — aísla presupuestos distintos
    const existingSession = loadPurchaseSession(quoteId);
    if (existingSession && existingSession.cart_id) {
      purchaseSession.current = existingSession;
      const restoredStep = existingSession.checkout_step;
      if (restoredStep !== 'exito') setStep(restoredStep);
      if (existingSession.delivery_options) setDeliveryData(existingSession.delivery_options);
      if (existingSession.buyer_data) setBuyerSnapshot(existingSession.buyer_data);

      // P3: restaurar providerSummary si se vuelve al paso entrega o confirmar
      if ((restoredStep === 'entrega' || restoredStep === 'confirmar') && existingSession.cart_id) {
        getCartProviderSummary(existingSession.cart_id)
          .then(ps => setProviderSummary(ps))
          .catch(() => {});
      }

      console.log('[CHECKOUT:C6.3] SESSION_RESTORED', {
        session_id:    existingSession.session_id,
        checkout_step: restoredStep,
        cart_id:       existingSession.cart_id,
        quote_id:      quoteId,
      });
    }

    console.log('[RC1-C1D] MarketplaceComprarView mount', { hasFreshCtx: !!ctx, cartId: ctx?.cartId });

    // P2: clave de carrito namespaciada por quoteId
    const ck = cartKey(quoteId);
    const fromSession = sessionStorage.getItem(ck);
    const resolvedId  = fromSession ?? existingSession?.cart_id ?? ctx?.cartId ?? null;

    if (resolvedId) {
      setCartId(resolvedId);
      if (!fromSession && resolvedId) sessionStorage.setItem(ck, resolvedId);
    } else {
      console.log('[RC1-C1D] MarketplaceComprarView: sin contexto fresco, redirigiendo a Marketplace');
      setCurrentPage(ActivePage.Marketplace);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCurrentPage]);

  // Crea o actualiza la sesión cuando los datos clave cambian (P0-A / P5)
  useEffect(() => {
    if (!cartId) return;
    if (!purchaseSession.current) {
      // checkout_key generado internamente en createPurchaseSession — persiste en storage
      purchaseSession.current = createPurchaseSession({
        orgId:       org?.id ?? null,
        quoteId:     context?.quoteId ?? null,
        quoteRef:    context?.quoteRef ?? null,
        clientName:  context?.customerName ?? null,
        obra:        context?.projectName ?? null,
        cartId,
      });
    } else {
      purchaseSession.current = {
        ...purchaseSession.current,
        cart_id:          cartId,
        checkout_step:    step,
        delivery_options: Object.keys(deliveryData).length > 0 ? deliveryData : purchaseSession.current.delivery_options,
        buyer_data:       buyerSnapshot,
        actor_ids:        providerSummary.map(s => s.actor_id),
        // checkout_key no se sobreescribe — se mantiene el de la sesión original
      };
    }
    savePurchaseSession(purchaseSession.current);
  }, [cartId, step, deliveryData, buyerSnapshot, context, org, providerSummary]);

  const loadCart = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getCartDetail(id);
      setCart(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cartId) loadCart(cartId);
  }, [cartId, loadCart]);

  const handleCheckout = async () => {
    if (!cartId || checking) return;
    setChecking(true);
    setError(null);

    // checkout_key siempre viene de la sesión persistida — mismo valor tras reload/retry
    const checkoutKey = purchaseSession.current?.checkout_key ?? '';
    const sessionId   = purchaseSession.current?.session_id   ?? 'no-session';
    const t0          = Date.now();

    // INV-2: proveedores del checkout = unique(cart_items.actor_id), nunca actors del presupuesto original
    console.log('[C6.5:CHECKOUT_ACTORS]', {
      session_id:     sessionId,
      checkout_key:   checkoutKey,
      cart_id:        cartId,
      quote_id:       context?.quoteId ?? null,
      actors:         providerSummary.map(s => ({ actor_id: s.actor_id, actor: s.actor_nombre, items: s.items_count })),
      actor_count:    providerSummary.length,
    });
    console.log('[C6.5:CHECKOUT_LINES]', {
      cart_id:   cartId,
      item_count: cart?.items.filter(i => i.activo && i.selected_offering_id).length ?? null,
      items:     cart?.items
        .filter(i => i.activo && i.selected_offering_id)
        .map(i => ({ id: i.id, offering: i.selected_offering_id, actor: i.selected_actor_id, qty: i.cantidad })) ?? [],
    });
    console.log('[CHECKOUT:C6.1] RPC_STARTED', {
      session_id:     sessionId,
      checkout_key:   checkoutKey,
      cart_id:        cartId,
      quote_id:       context?.quoteId ?? null,
      supplier_count: Object.keys(deliveryData).length,
      item_count:     cart?.items.length ?? null,
    });

    const CHECKOUT_TIMEOUT_MS = 25_000;

    try {
      // P4: sanear delivery antes del RPC — elimina actores huérfanos y pickup_point_ids inválidos
      const sanitizedDelivery = sanitizeDeliveryData(deliveryData, providerSummary);
      const checkoutPromise = checkoutCartV2({ cartId, deliveryData: sanitizedDelivery, buyerSnapshot, checkoutKey });
      const timeoutPromise  = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('El servidor tardó demasiado en responder (>25s). Por favor, inténtalo de nuevo.')),
          CHECKOUT_TIMEOUT_MS,
        )
      );

      const ids = await Promise.race([checkoutPromise, timeoutPromise]);
      const duration_ms = Date.now() - t0;

      console.log('[CHECKOUT:C6.1] RPC_FINISHED', {
        session_id:   sessionId,
        checkout_key: checkoutKey,
        order_ids:    ids,
        duration_ms,
      });

      const rows = await getOrdersByIds(ids);

      // INV-3: número de pedidos == actores únicos con al menos una línea procesable
      console.log('[C6.5:ORDER_RESULT]', {
        checkout_key:    checkoutKey,
        expected_orders: providerSummary.length,
        actual_orders:   ids.length,
        order_ids:       ids,
        orders:          rows.map(r => ({ numero: r.numero, actor: r.actor_nombre, total: r.total })),
      });

      setOrders(rows);
      setStep('exito');
      clearPurchaseContext();
      clearPurchaseSession(purchaseSession.current?.quote_id);
      // INV-5: siempre limpiar carrito local después de compra completada.
      // BUG F fix: antes solo se limpiaba para carritos libres; para presupuesto
      // el carrito local persistía y reaparecía al volver al Marketplace.
      cartActions.clearCart('ordered');
    } catch (e) {
      const duration_ms = Date.now() - t0;
      const errorMsg    = e instanceof Error ? e.message : 'Error al confirmar el pedido';
      const isTimeout   = e instanceof Error && e.message.includes('>25s');

      console.error('[CHECKOUT:C6.1] RPC_ERROR', {
        session_id:    sessionId,
        checkout_key:  checkoutKey,
        cart_id:       cartId,
        duration_ms,
        error_message: errorMsg,
        is_timeout:    isTimeout,
      });

      if (isTimeout && checkoutKey) {
        // El RPC pudo haberse completado en backend antes de expirar el cliente.
        // Consultar la BD por pedidos ya creados con esta checkout_key.
        console.log('[CHECKOUT:C6.1] TIMEOUT_RECOVERY_START', { checkout_key: checkoutKey });
        try {
          const existingIds = await getOrdersByCheckoutKey(checkoutKey);
          if (existingIds.length > 0) {
            console.log('[CHECKOUT:C6.1] TIMEOUT_RECOVERED', {
              checkout_key: checkoutKey,
              order_ids:    existingIds,
              order_count:  existingIds.length,
            });
            const rows = await getOrdersByIds(existingIds);
            setOrders(rows);
            setStep('exito');
            clearPurchaseContext();
            clearPurchaseSession(purchaseSession.current?.quote_id);
            cartActions.clearCart('ordered'); // siempre limpiar
            return;
          }
          // Sin pedidos — retry seguro: la misma checkout_key garantiza idempotencia
          console.log('[CHECKOUT:C6.1] TIMEOUT_NO_ORDERS_RETRY_SAFE', { checkout_key: checkoutKey });
          setError('La conexión tardó demasiado. Puedes reintentar: tu compra no se duplicará.');
        } catch {
          setError('La conexión tardó demasiado. Puedes reintentar: tu compra no se duplicará.');
        }
      } else {
        setError(errorMsg);
      }
    } finally {
      setChecking(false);
    }
  };

  // StepRevisar → StepEntrega
  const handleNext = async () => {
    if (!cartId) return;
    setLoading(true);
    try {
      const [detail, ps] = await Promise.all([
        getCartDetail(cartId),
        getCartProviderSummary(cartId),
      ]);
      setCart(detail);
      setProviderSummary(ps);
      setStep('entrega');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos del proveedor');
    } finally {
      setLoading(false);
    }
  };

  // StepEntrega → StepConfirmar
  const handleEntregaNext = (delivery: Record<string, DeliveryOptionPerProvider>, buyer: BuyerSnapshot) => {
    setDeliveryData(delivery);
    setBuyerSnapshot(buyer);
    setStep('confirmar');
  };

  const handleBack = () => {
    if (step === 'confirmar') setStep('entrega');
    else if (step === 'entrega') setStep('revisar');
  };

  const volverAlCatalogo    = () => setCurrentPage(ActivePage.Marketplace);
  const volverAlPresupuesto = () => setCurrentPage(ActivePage.AppDashboard);

  // ─── Carga ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#1A5A96] border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-gray-500">Preparando materiales del presupuesto...</p>
          {context?.quoteRef && <p className="text-xs text-gray-400 mt-1">{context.quoteRef}</p>}
        </div>
      </div>
    );
  }

  // ─── Error fatal ─────────────────────────────────────────────────────────────
  if (error && !cart) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6 max-w-md w-full text-center shadow-sm">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={volverAlPresupuesto}
            className="text-sm text-[#1A5A96] hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] rounded"
          >
            ← Volver al presupuesto
          </button>
        </div>
      </div>
    );
  }

  // ─── Pantalla de éxito ───────────────────────────────────────────────────────
  if (step === 'exito') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100" aria-hidden="true">
              <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900" aria-live="polite">
              {orders.length === 1 ? '¡Pedido realizado!' : `¡${orders.length} pedidos realizados!`}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Los proveedores han recibido el pedido y lo confirmarán en breve.
            </p>
            {context?.quoteRef && (
              <p className="mt-0.5 text-xs text-gray-400">
                Vinculado a {context.quoteRef}
                {context.customerName ? ` · ${context.customerName}` : ''}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {orders.map((order) => (
              <SuccessOrderCard key={order.order_id} order={order} />
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={async () => {
                const key = purchaseSession.current?.checkout_key;
                if (!key) return;
                try {
                  const summary = await getPurchaseSummaryByCheckoutKey(key);
                  if (summary) downloadMarketplacePurchaseSummary(summary);
                } catch { /* abre ventana igualmente si hay error */ }
              }}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              Descargar resumen
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem('tf:nav:tab', 'pedidos_material');
                setCurrentPage(ActivePage.AppDashboard);
              }}
              className="rounded-lg border border-[#1A5A96] px-6 py-2.5 text-sm font-medium text-[#1A5A96] hover:bg-[#1A5A96]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              Ver mis pedidos
            </button>
            <button
              onClick={volverAlPresupuesto}
              className="rounded-lg bg-[#1A5A96] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#154d82] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              Volver al presupuesto
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Wizard 3 pasos ──────────────────────────────────────────────────────────
  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ContextBanner context={context} cart={cart} onVolver={volverAlCatalogo} />

      <header className="border-b border-gray-200 bg-white px-4 py-3 shrink-0">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <button
            onClick={step === 'revisar' ? volverAlCatalogo : handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] rounded"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel(step)}
          </button>

          <nav className="flex-1 flex items-center justify-center gap-0" aria-label="Pasos del pedido">
            {STEPS.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    idx < currentStepIdx
                      ? 'bg-[#1A5A96] text-white'
                      : idx === currentStepIdx
                        ? 'bg-[#1A5A96] text-white ring-2 ring-[#1A5A96]/20'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                    aria-current={idx === currentStepIdx ? 'step' : undefined}
                  >
                    {idx < currentStepIdx ? (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-label="Completado">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                      </svg>
                    ) : idx + 1}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${
                    idx === currentStepIdx ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`mx-2 h-px w-8 sm:w-16 ${
                    idx < currentStepIdx ? 'bg-[#1A5A96]' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="w-20" aria-hidden="true" />
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shrink-0" role="alert">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col">
        {cart && step === 'revisar' && (
          <StepRevisar
            cart={cart}
            onCartChanged={async () => { if (cartId) await loadCart(cartId); }}
            onNext={handleNext}
          />
        )}
        {step === 'entrega' && providerSummary.length === 0 && (
          <div className="flex justify-center items-center py-20" aria-label="Cargando proveedores">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1A5A96] border-t-transparent" aria-hidden="true" />
          </div>
        )}
        {step === 'entrega' && providerSummary.length > 0 && (
          <StepEntrega
            summary={providerSummary}
            initialBuyer={buyerSnapshot}
            initialDelivery={deliveryData}
            onNext={handleEntregaNext}
            onBack={handleBack}
          />
        )}
        {cart && step === 'confirmar' && (
          <StepConfirmar
            cart={cart}
            checking={checking}
            deliveryData={deliveryData}
            buyerSnapshot={buyerSnapshot}
            onCheckout={handleCheckout}
          />
        )}
      </main>
    </div>
  );
}

// ─── SuccessOrderCard ─────────────────────────────────────────────────────────

interface SuccessOrderCardProps { order: OrderByIdRow }

function SuccessOrderCard({ order }: SuccessOrderCardProps) {
  const estado = order.estado as OrderLifecycleEstado;
  const label  = INSTALLER_ESTADO_LABELS[estado] ?? order.estado;

  const badgeColor =
    estado === 'completed' || estado === 'delivered'
      ? 'bg-emerald-100 text-emerald-700'
      : estado === 'shipped'
        ? 'bg-blue-100 text-blue-700'
        : estado === 'confirmed' || estado === 'preparing'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-600';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{order.actor_nombre}</p>
            {order.actor_verificado && (
              <svg className="h-4 w-4 text-[#1A5A96]" fill="currentColor" viewBox="0 0 24 24" aria-label="Proveedor verificado">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Pedido {order.numero} · {order.items_count} artículo{order.items_count !== 1 ? 's' : ''} · {order.total.toFixed(2)} €
          </p>
          {/* Entrega y pago resumidos */}
          {order.delivery_method && (
            <p className="text-xs text-teal-600 mt-1 font-medium">
              {DELIVERY_METHOD_LABELS[order.delivery_method]}
              {order.delivery_address?.ciudad ? ` · ${order.delivery_address.ciudad}` : ''}
              {order.payment_method ? ` · ${PAYMENT_METHOD_LABELS[order.payment_method]}` : ''}
            </p>
          )}
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeColor}`}>
          {label}
        </span>
      </div>
      <OrderTimeline estado={estado} installerView={true} />
    </div>
  );
}
