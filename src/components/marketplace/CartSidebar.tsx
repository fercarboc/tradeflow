import { ShoppingCart, X, Lock, Tag } from 'lucide-react';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import CartItemRow from './CartItemRow';
import CartSummary from './CartSummary';

interface Props {
  items:       LocalCartItem[];
  isOpen:      boolean;
  onClose:     () => void;
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
  onCheckout?: () => void;  // undefined = disabled (RC1-C)
  quoteRef?:   string | null;  // ref del presupuesto de origen (RC1-C1D)
}

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

// Desktop always-visible sidebar
export function CartSidebarDesktop({ items, onUpdateQty, onRemove, onCheckout, quoteRef }: Omit<Props, 'isOpen' | 'onClose'>) {
  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 hidden lg:flex flex-col bg-white">
      <CartContent items={items} onUpdateQty={onUpdateQty} onRemove={onRemove} onCheckout={onCheckout} quoteRef={quoteRef} />
    </aside>
  );
}

// Drawer móvil
export default function CartSidebar({ items, isOpen, onClose, onUpdateQty, onRemove, onCheckout, quoteRef }: Props) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <div
        className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transform transition-transform duration-300 lg:hidden ${
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

        <CartContent items={items} onUpdateQty={onUpdateQty} onRemove={onRemove} onCheckout={onCheckout} quoteRef={quoteRef} />
      </div>
    </>
  );
}

function CartContent({ items, onUpdateQty, onRemove, onCheckout, quoteRef }: {
  items:       LocalCartItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onRemove:    (id: string) => void;
  onCheckout?: () => void;
  quoteRef?:   string | null;
}) {
  const quoteItems = items.filter(i => i.sourceType === 'quote').length;
  return (
    <>
      {/* Header desktop */}
      <div className="px-4 py-4 border-b border-gray-100 hidden lg:flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-[#1A5A96]" />
        <span className="text-gray-900 font-bold text-sm">Carrito</span>
        {quoteRef && quoteItems > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-[#1A5A96]/10 text-[#1A5A96] text-[10px] font-semibold">
            {quoteRef}
          </span>
        )}
        {items.length > 0 && (
          <span className="ml-auto text-xs text-gray-400 tabular-nums">
            {items.length} línea{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <ul className="flex-1 overflow-y-auto px-4 py-2">
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

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4">
          <CartSummary items={items} />

          {/* Código descuento — visual slot */}
          <div className="flex items-center gap-2 border border-dashed border-gray-200 rounded-xl px-3 py-2">
            <Tag className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <input
              type="text"
              placeholder="Código de descuento"
              disabled
              className="flex-1 text-xs text-gray-400 bg-transparent placeholder:text-gray-300 focus:outline-none cursor-not-allowed"
            />
            <span className="text-[10px] text-gray-300 font-semibold shrink-0">PRONTO</span>
          </div>

          {onCheckout ? (
            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 bg-[#1A5A96] hover:bg-[#154d82] text-white font-bold text-sm py-3 rounded-xl transition-colors"
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
