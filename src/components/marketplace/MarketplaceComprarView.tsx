import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../../types';
import {
  CartDetail, CartOrderStatus,
  getCartDetail, checkoutCart, getCartOrderStatus,
  CART_ESTADO_LABELS,
} from '../../lib/api/marketplace-checkout';
import { OrderLifecycleEstado } from '../../lib/api/marketplace-orders';
import StepRevisar from './StepRevisar';
import StepConfirmar from './StepConfirmar';
import OrderTimeline from './shared/OrderTimeline';
import { INSTALLER_ESTADO_LABELS } from './shared/OrderStatusBadge';

const CART_KEY = 'mkt_cart_id';

type WizardStep = 'revisar' | 'confirmar' | 'exito';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'revisar',   label: 'Revisar' },
  { id: 'confirmar', label: 'Confirmar' },
];

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

export default function MarketplaceComprarView({ setCurrentPage, session }: Props) {
  const [cartId,   setCartId]   = useState<string | null>(() => sessionStorage.getItem(CART_KEY));
  const [cart,     setCart]     = useState<CartDetail | null>(null);
  const [step,     setStep]     = useState<WizardStep>('revisar');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [tracking, setTracking] = useState<CartOrderStatus[]>([]);

  useEffect(() => {
    if (!session) setCurrentPage(ActivePage.Login);
  }, [session, setCurrentPage]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CART_KEY);
    if (stored) {
      setCartId(stored);
    } else {
      setError('No se encontró ningún pedido. Vuelve al presupuesto y pulsa "Comprar en Marketplace".');
      setLoading(false);
    }
  }, []);

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
    try {
      const ids = await checkoutCart(cartId);
      setOrderIds(ids);
      const status = await getCartOrderStatus(cartId);
      setTracking(status);
      setStep('exito');
      sessionStorage.removeItem(CART_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar el pedido');
    } finally {
      setChecking(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirmar') setStep('revisar');
  };

  const handleNext = async () => {
    if (!cartId) return;
    if (step === 'revisar') {
      await loadCart(cartId);
      setStep('confirmar');
    }
  };

  const volver = () => {
    sessionStorage.removeItem(CART_KEY);
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setCurrentPage(ActivePage.AppDashboard);
    }
  };

  // ─── Carga ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-slate-500">Preparando pedido...</p>
        </div>
      </div>
    );
  }

  // ─── Error fatal ─────────────────────────────────────────────────────────────
  if (error && !cart) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-6">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-6 max-w-md w-full text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={volver}
            className="text-sm text-teal-600 hover:text-teal-500 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ─── Éxito post-pedido ───────────────────────────────────────────────────────
  if (step === 'exito') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30" aria-hidden="true">
              <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100" aria-live="polite">
              {orderIds.length === 1 ? '¡Pedido realizado!' : `¡${orderIds.length} pedidos realizados!`}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Los proveedores han recibido tu pedido y lo confirmarán en breve.
            </p>
          </div>

          <div className="space-y-3">
            {tracking.map((order) => (
              <TrackingCard key={order.order_id} order={order} />
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage(ActivePage.SeguimientoMaterial)}
              className="rounded-lg border border-teal-600 px-6 py-2.5 text-sm font-medium text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Ver seguimiento
            </button>
            <button
              onClick={volver}
              className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Wizard 2 pasos ──────────────────────────────────────────────────────────
  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shrink-0">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <button
            onClick={step === 'revisar' ? volver : handleBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {step === 'revisar' ? 'Volver' : 'Anterior'}
          </button>

          {/* Stepper */}
          <nav className="flex-1 flex items-center justify-center gap-0" aria-label="Pasos del pedido">
            {STEPS.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    idx < currentStepIdx
                      ? 'bg-teal-600 text-white'
                      : idx === currentStepIdx
                        ? 'bg-teal-600 text-white ring-2 ring-teal-200 dark:ring-teal-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
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
                    idx === currentStepIdx ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`mx-2 h-px w-8 sm:w-16 ${
                    idx < currentStepIdx ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="w-20" aria-hidden="true" />
        </div>
      </header>

      {/* Subtítulo del pedido */}
      {cart && (
        <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 shrink-0">
          <div className="mx-auto max-w-4xl flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {cart.cart.source_ref
                ? `Desde: ${cart.cart.source_ref}`
                : `Pedido ${CART_ESTADO_LABELS[cart.cart.estado]?.toLowerCase() ?? ''}`}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400">
              {cart.summary.total_items} {cart.summary.total_items === 1 ? 'material' : 'materiales'}
            </span>
            {cart.summary.total_estimado > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {cart.summary.total_estimado.toFixed(2)} € estimados
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error no fatal */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2.5 shrink-0" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Contenido del paso */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {cart && step === 'revisar' && (
          <StepRevisar
            cart={cart}
            onCartChanged={async () => { if (cartId) await loadCart(cartId); }}
            onNext={handleNext}
          />
        )}
        {cart && cartId && step === 'confirmar' && (
          <StepConfirmar
            cart={cart}
            checking={checking}
            onCheckout={handleCheckout}
          />
        )}
      </main>
    </div>
  );
}

// ─── TrackingCard ─────────────────────────────────────────────────────────────

interface TrackingCardProps { order: CartOrderStatus }

function TrackingCard({ order }: TrackingCardProps) {
  const estado = order.estado as OrderLifecycleEstado;
  const label  = INSTALLER_ESTADO_LABELS[estado] ?? order.estado;

  const badgeColor =
    estado === 'completed' || estado === 'delivered'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : estado === 'shipped'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        : estado === 'confirmed' || estado === 'preparing'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{order.actor_nombre}</p>
            {order.actor_verificado && (
              <svg className="h-4 w-4 text-teal-500" fill="currentColor" viewBox="0 0 24 24" aria-label="Proveedor verificado">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.items_count} artículo{order.items_count !== 1 ? 's' : ''} · {order.total.toFixed(2)} €
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeColor}`}>
          {label}
        </span>
      </div>
      <OrderTimeline estado={estado} installerView={true} />
    </div>
  );
}
