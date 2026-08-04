import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (p: ActivePage) => void;
  cartCount:      number;
  onOpenCart:     () => void;
}

export default function MarketplaceHeader({ setCurrentPage, cartCount, onOpenCart }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-[#020B16]/95 backdrop-blur border-b border-white/8 flex items-center h-14 px-4 gap-3">
      <button
        onClick={() => setCurrentPage(ActivePage.AppDashboard)}
        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
        aria-label="Volver al ERP"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">ERP</span>
      </button>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-white font-bold text-base tracking-tight">Marketplace</span>
        <span className="hidden sm:inline text-white/30 text-xs font-normal">
          — Catálogo de materiales
        </span>
      </div>

      {/* Cart toggle visible only en móvil */}
      <button
        onClick={onOpenCart}
        className="relative lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white/8 hover:bg-white/12 transition-colors"
        aria-label="Ver carrito"
      >
        <ShoppingCart className="w-4.5 h-4.5 text-white/80" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00CFE8] text-[9px] font-black text-[#020B16] flex items-center justify-center tabular-nums">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </header>
  );
}
