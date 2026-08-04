import { ShoppingCart, X, Lock } from 'lucide-react';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import CartItemRow from './CartItemRow';
import CartSummary from './CartSummary';

interface Props {
  items:       LocalCartItem[];
  isOpen:      boolean;          // mobile drawer
  onClose:     () => void;       // mobile close
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-10 px-4 text-center">
      <ShoppingCart className="w-10 h-10 text-white/15 mb-3" />
      <p className="text-white/35 text-sm font-medium">Tu carrito está vacío</p>
      <p className="text-white/20 text-xs mt-1">Añade productos del catálogo</p>
    </div>
  );
}

// Sidebar desktop (always visible lg+)
export function CartSidebarDesktop({ items, onUpdateQty, onRemove }: Omit<Props, 'isOpen' | 'onClose'>) {
  return (
    <aside className="w-72 shrink-0 border-l border-white/8 hidden lg:flex flex-col bg-[#0a1020]">
      <CartContent items={items} onUpdateQty={onUpdateQty} onRemove={onRemove} />
    </aside>
  );
}

// Drawer móvil
export default function CartSidebar({ items, isOpen, onClose, onUpdateQty, onRemove }: Props) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel lateral móvil */}
      <div
        className={`fixed right-0 top-0 h-full w-80 bg-[#0a1020] border-l border-white/8 z-50 flex flex-col transform transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compra"
      >
        {/* Header con close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#00CFE8]" />
            Carrito
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <CartContent items={items} onUpdateQty={onUpdateQty} onRemove={onRemove} />
      </div>
    </>
  );
}

function CartContent({ items, onUpdateQty, onRemove }: {
  items: LocalCartItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 hidden lg:flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-[#00CFE8]" />
        <span className="text-white font-semibold text-sm">Carrito</span>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-white/40 tabular-nums">{items.length} línea{items.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Lista de ítems */}
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

      {/* Footer: resumen + botón */}
      {items.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-white/8 space-y-3">
          <CartSummary items={items} />

          <button
            disabled
            title="Checkout disponible en RC1-C"
            className="w-full flex items-center justify-center gap-2 bg-white/10 text-white/40 font-bold text-sm py-3 rounded-xl cursor-not-allowed select-none"
          >
            <Lock className="w-3.5 h-3.5" />
            Continuar al pago
          </button>

          <p className="text-white/20 text-[10px] text-center">
            Checkout disponible en RC1-C
          </p>
        </div>
      )}
    </>
  );
}
