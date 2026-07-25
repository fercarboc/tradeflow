import React, { useEffect, useState } from 'react';
import { CartDetail, CartProviderSummary, getCartProviderSummary } from '../../lib/api/marketplace-checkout';

interface Props {
  cart: CartDetail;
  checking: boolean;
  onCheckout: () => Promise<void>;
}

export default function StepConfirmar({ cart, checking, onCheckout }: Props) {
  const [summary, setSummary] = useState<CartProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCartProviderSummary(cart.cart.id)
      .then(setSummary)
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, [cart.cart.id]);

  const activeItems  = cart.items.filter((i) => i.activo);
  const withProvider = activeItems.filter((i) => i.selected_offering_id !== null);
  const noProvider   = activeItems.filter((i) => i.selected_offering_id === null);

  const grandTotal  = summary.reduce((acc, s) => acc + s.total_estimado, 0);
  const grandPortes = summary.reduce((acc, s) => acc + s.portes, 0);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Confirmar pedido
        </h2>
        <p className="text-sm text-slate-500">
          Revisa el resumen antes de enviar. Los proveedores recibirán una notificación inmediata.
        </p>
      </div>

      {/* Alerta de artículos sin proveedor */}
      {noProvider.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            {noProvider.length} artículo{noProvider.length > 1 ? 's' : ''} sin proveedor
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Estos artículos no se incluirán en el pedido. Puedes volver atrás para asignarles un proveedor.
          </p>
          <ul className="mt-2 space-y-0.5">
            {noProvider.map((item) => (
              <li key={item.id} className="text-xs text-amber-600 dark:text-amber-400">
                · {item.descripcion_original}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pedidos por proveedor */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-36 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {summary.map((s) => {
            const providerItems = withProvider.filter((i) => i.selected_actor_id === s.actor_id);
            return (
              <OrderPreviewCard key={s.actor_id} summary={s} items={providerItems} />
            );
          })}
        </div>
      )}

      {/* Totales */}
      {!loading && summary.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Subtotal ({summary.length} proveedor{summary.length > 1 ? 'es' : ''})</span>
              <span className="tabular-nums">{(grandTotal - grandPortes).toFixed(2)} €</span>
            </div>
            {grandPortes > 0 && (
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Portes</span>
                <span className="tabular-nums">+{grandPortes.toFixed(2)} €</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center">
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Total</p>
              <p className="text-xs text-slate-400">{withProvider.length} artículos en {summary.length} pedido{summary.length > 1 ? 's' : ''}</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-teal-600 dark:text-teal-400">
              {grandTotal.toFixed(2)} €
            </p>
          </div>
        </div>
      )}

      {/* Botón de confirmación */}
      <div className="pb-8">
        <button
          onClick={onCheckout}
          disabled={checking || withProvider.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-base font-semibold text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Procesando pedido...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Confirmar pedido
            </>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Los proveedores recibirán una notificación y confirmarán en breve.
        </p>
      </div>
    </div>
  );
}

// ─── OrderPreviewCard ──────────────────────────────────────────────────────────

interface OrderPreviewCardProps {
  summary: CartProviderSummary;
  items: import('../../lib/api/marketplace-checkout').CartItem[];
}

function OrderPreviewCard({ summary, items }: OrderPreviewCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{summary.actor_nombre}</p>
            {summary.actor_verificado && (
              <svg className="h-4 w-4 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {items.length} artículo{items.length > 1 ? 's' : ''} · {summary.delivery_days} días estimados
            {summary.portes > 0
              ? ` · ${summary.portes.toFixed(2)} € portes`
              : ' · Portes gratis'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.total_estimado.toFixed(2)} €
          </p>
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <th className="px-5 py-2 text-left text-xs font-medium text-slate-400 font-normal">Artículo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 font-normal">Cant.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 font-normal">Precio</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-slate-400 font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-2.5">
                    <p className="text-slate-800 dark:text-slate-200 leading-snug">
                      {item.descripcion_original}
                    </p>
                    {item.up_nombre_canonico && (
                      <p className="text-xs text-slate-400 truncate">{item.up_nombre_canonico}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.cantidad} {item.unidad}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.precio_unitario_final != null ? `${item.precio_unitario_final.toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {item.total_linea != null ? `${item.total_linea.toFixed(2)} €` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {summary.portes > 0 && (
              <tfoot>
                <tr className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <td colSpan={3} className="px-5 py-2.5 text-right text-xs text-slate-400">Portes</td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    +{summary.portes.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
