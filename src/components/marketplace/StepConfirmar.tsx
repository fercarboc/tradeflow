import { useEffect, useState } from 'react';
import {
  CartDetail, CartProviderSummary, getCartProviderSummary,
  DeliveryOptionPerProvider, BuyerSnapshot,
  DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS,
} from '../../lib/api/marketplace-checkout';

interface Props {
  cart:          CartDetail;
  checking:      boolean;
  deliveryData:  Record<string, DeliveryOptionPerProvider>;
  buyerSnapshot: BuyerSnapshot;
  onCheckout:    () => Promise<void>;
}

export default function StepConfirmar({ cart, checking, deliveryData, buyerSnapshot, onCheckout }: Props) {
  const [summary, setSummary] = useState<CartProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [clicked, setClicked] = useState(false);

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

  const handleConfirm = async () => {
    if (clicked || checking) return;
    setClicked(true);
    try {
      await onCheckout();
    } catch {
      setClicked(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">

      {/* Aviso explícito de N pedidos */}
      <div className="rounded-xl border border-[#1A5A96]/20 bg-[#1A5A96]/5 dark:bg-[#1A5A96]/10 px-5 py-4">
        <p className="text-sm font-semibold text-[#1A5A96] dark:text-blue-300">
          Se crearán {summary.length || '—'} pedido{summary.length !== 1 ? 's' : ''}, uno por proveedor
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Cada proveedor recibirá su pedido de forma independiente y lo confirmará por separado.
        </p>
      </div>

      {/* Artículos sin proveedor */}
      {noProvider.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            {noProvider.length} artículo{noProvider.length > 1 ? 's' : ''} sin proveedor — no se incluirán
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {noProvider.map((item) => (
              <li key={item.id} className="text-xs text-amber-600 dark:text-amber-400">· {item.descripcion_original}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pedidos por proveedor */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-48 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {summary.map((s) => {
            const providerItems = withProvider.filter((i) => i.selected_actor_id === s.actor_id);
            const delivery = deliveryData[s.actor_id];
            return (
              <OrderPreviewCard
                key={s.actor_id}
                summary={s}
                items={providerItems}
                delivery={delivery}
              />
            );
          })}
        </div>
      )}

      {/* Datos del comprador */}
      {(buyerSnapshot.empresa || buyerSnapshot.nif) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Datos del comprador</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {buyerSnapshot.empresa && <span className="text-slate-700 dark:text-slate-300 col-span-2 font-medium">{buyerSnapshot.empresa}</span>}
            {buyerSnapshot.nif && <span className="text-slate-500">{buyerSnapshot.nif}</span>}
            {buyerSnapshot.email && <span className="text-slate-500">{buyerSnapshot.email}</span>}
            {buyerSnapshot.telefono && <span className="text-slate-500">{buyerSnapshot.telefono}</span>}
          </div>
        </div>
      )}

      {/* Totales globales */}
      {!loading && summary.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Subtotal materiales</span>
              <span className="tabular-nums">{(grandTotal - grandPortes).toFixed(2)} €</span>
            </div>
            {grandPortes > 0 && (
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Total portes</span>
                <span className="tabular-nums">+{grandPortes.toFixed(2)} €</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center">
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Total pedido</p>
              <p className="text-xs text-slate-400">
                {withProvider.length} artículos · {summary.length} proveedor{summary.length !== 1 ? 'es' : ''}
              </p>
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
          onClick={handleConfirm}
          disabled={checking || clicked || withProvider.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-base font-semibold text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {checking ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
              Creando pedidos...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Confirmar y crear pedidos
            </>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Los proveedores recibirán una notificación inmediata y confirmarán en breve.
        </p>
      </div>
    </div>
  );
}

// ─── OrderPreviewCard ──────────────────────────────────────────────────────────

interface OrderPreviewCardProps {
  summary:  CartProviderSummary;
  items:    import('../../lib/api/marketplace-checkout').CartItem[];
  delivery: DeliveryOptionPerProvider | undefined;
}

function OrderPreviewCard({ summary, items, delivery }: OrderPreviewCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{summary.actor_nombre}</p>
            {summary.actor_verificado && (
              <svg className="h-4 w-4 text-teal-500" fill="currentColor" viewBox="0 0 24 24" aria-label="Verificado">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {items.length} artículo{items.length !== 1 ? 's' : ''} · {summary.delivery_days}d est.
            {summary.portes > 0 ? ` · +${summary.portes.toFixed(2)} € portes` : ' · Portes gratis'}
          </p>
          {/* Entrega resumida */}
          {delivery && (
            <div className="flex flex-wrap gap-x-2 mt-1">
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                {DELIVERY_METHOD_LABELS[delivery.delivery_method]}
              </span>
              {delivery.delivery_address?.ciudad && (
                <span className="text-[11px] text-slate-400">· {delivery.delivery_address.ciudad}</span>
              )}
              {delivery.payment_method && (
                <span className="text-[11px] text-slate-400">
                  · {PAYMENT_METHOD_LABELS[delivery.payment_method]}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.total_estimado.toFixed(2)} €
          </p>
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* Tabla de artículos */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <th className="px-5 py-2 text-left text-xs font-normal text-slate-400">Artículo</th>
                  <th className="px-3 py-2 text-right text-xs font-normal text-slate-400">Cant.</th>
                  <th className="px-3 py-2 text-right text-xs font-normal text-slate-400">Precio</th>
                  <th className="px-5 py-2 text-right text-xs font-normal text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-2.5">
                      <p className="text-slate-800 dark:text-slate-200 leading-snug">{item.descripcion_original}</p>
                      {item.up_nombre_canonico && (
                        <p className="text-xs text-slate-400 truncate">{item.up_nombre_canonico}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 whitespace-nowrap">
                      {item.cantidad} {item.unidad}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 whitespace-nowrap">
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

          {/* Detalle entrega */}
          {delivery && (
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-400">Entrega:</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {DELIVERY_METHOD_LABELS[delivery.delivery_method]}
                  </span>
                </div>
                {delivery.payment_method && (
                  <div>
                    <span className="text-slate-400">Pago:</span>{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {PAYMENT_METHOD_LABELS[delivery.payment_method]}
                    </span>
                  </div>
                )}
                {delivery.delivery_address?.calle && (
                  <div className="col-span-2 mt-0.5 text-slate-500">
                    {delivery.delivery_address.calle}, {delivery.delivery_address.cp} {delivery.delivery_address.ciudad}
                    {delivery.delivery_address.nombre_contacto && ` · ${delivery.delivery_address.nombre_contacto}`}
                    {delivery.delivery_address.telefono_contacto && ` · ${delivery.delivery_address.telefono_contacto}`}
                  </div>
                )}
                {delivery.notas && (
                  <div className="col-span-2 mt-0.5 text-slate-400 italic">"{delivery.notas}"</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
