import { ShoppingCart, X, Lock } from 'lucide-react';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import CartItemRow from './CartItemRow';
import CartSummary from './CartSummary';

interface Props {
  items:       LocalCartItem[];
  isOpen:      boolean;
  onClose:     () => void;
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
  onCheckout?: () => void;
  quoteRef?:   string | null;
}

// ─── Agrupador por proveedor ──────────────────────────────────────────────────

function groupBySupplier(items: LocalCartItem[]): { name: string; items: LocalCartItem[] }[] {
  const map = new Map<string, LocalCartItem[]>();
  for (const item of items) {
    const key = item.supplierName || 'Proveedor';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

function supplierSubtotal(items: LocalCartItem[]): number {
  return items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
}

// ─── Cart vacío ───────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
        <ShoppingCart className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-gray-600 text-sm font-semibold">Tu carrito está vacío</p>
      <p className="text-gray-400 text-xs mt-1">Añade productos del catálogo</p>
    </div>
  );
}

// ─── Desktop always-visible sidebar ──────────────────────────────────────────

export function CartSidebarDesktop({
  items, onUpdateQty, onRemove, onCheckout, quoteRef,
}: Omit<Props, 'isOpen' | 'onClose'>) {
  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 hidden lg:flex flex-col bg-white">
      <CartContent
        items={items}
        onUpdateQty={onUpdateQty}
        onRemove={onRemove}
        onCheckout={onCheckout}
        quoteRef={quoteRef}
        isDesktop
      />
    </aside>
  );
}

// ─── Drawer móvil ─────────────────────────────────────────────────────────────

export default function CartSidebar({
  items, isOpen, onClose,
  onUpdateQty, onRemove, onCheckout, quoteRef,
}: Props) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 xl:hidden" onClick={onClose} aria-hidden />
      )}
      <div
        className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transform transition-transform duration-300 xl:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compra"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-bold text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#1A5A96]" />
            Carrito
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <CartContent
          items={items}
          onUpdateQty={onUpdateQty}
          onRemove={onRemove}
          onCheckout={onCheckout}
          quoteRef={quoteRef}
          isDesktop={false}
        />
      </div>
    </>
  );
}

// ─── Contenido compartido ─────────────────────────────────────────────────────

function CartContent({
  items, onUpdateQty, onRemove, onCheckout, quoteRef, isDesktop,
}: {
  items:       LocalCartItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onRemove:    (id: string) => void;
  onCheckout?: () => void;
  quoteRef?:   string | null;
  isDesktop:   boolean;
}) {
  const groups       = groupBySupplier(items);
  const supplierCount = groups.length;
  const quoteItems   = items.filter(i => i.sourceType === 'quote').length;

  return (
    <>
      {/* Header desktop */}
      {isDesktop && (
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#1A5A96] shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-gray-900 font-bold text-sm">Carrito</span>
            {items.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400 tabular-nums">
                {items.length} artículo{items.length !== 1 ? 's' : ''}
                {supplierCount > 1 && ` · ${supplierCount} proveedores`}
              </span>
            )}
          </div>
          {quoteRef && quoteItems > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#1A5A96]/10 text-[#1A5A96] text-[10px] font-semibold">
              {quoteRef}
            </span>
          )}
        </div>
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {isDesktop && supplierCount > 1 ? (
            // Desktop: agrupado por proveedor
            <div className="divide-y divide-gray-100">
              {groups.map(group => (
                <div key={group.name}>
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">
                      {group.name}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums shrink-0 ml-2">
                      {supplierSubtotal(group.items).toLocaleString('es-ES', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })} €
                    </span>
                  </div>
                  <ul className="px-4 py-1">
                    {group.items.map(item => (
                      <CartItemRow
                        key={item.cartItemId}
                        item={item}
                        onUpdateQty={onUpdateQty}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            // Un solo proveedor o móvil: lista plana
            <ul className="px-4 py-2">
              {items.map(item => (
                <CartItemRow
                  key={item.cartItemId}
                  item={item}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
          <CartSummary items={items} />

          {onCheckout ? (
            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 bg-[#1A5A96] hover:bg-[#154d82] text-white font-bold text-sm py-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              Ir al checkout
            </button>
          ) : (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-bold text-sm py-3 rounded-xl cursor-not-allowed select-none"
            >
              <Lock className="w-3.5 h-3.5" />
              Ir al checkout
            </button>
          )}
        </div>
      )}
    </>
  );
}
