import { ArrowLeft, Search, ShoppingCart, Building2 } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  mode:           'public' | 'professional';
  setCurrentPage: (p: ActivePage) => void;
  cartCount:      number;
  onOpenCart:     () => void;
  query:          string;
  onQueryChange:  (q: string) => void;
  orgName?:       string;
  onGoHome?:      () => void;   // si se pasa, el branding vuelve al Home
  hideSearch?:    boolean;      // ocultar input de búsqueda (ej: en vista Home)
}

export default function MarketplaceHeader({
  mode, setCurrentPage,
  cartCount, onOpenCart,
  query, onQueryChange,
  orgName, onGoHome, hideSearch,
}: Props) {
  const handleBack = () => {
    if (mode === 'public') {
      setCurrentPage(ActivePage.Home);
    } else {
      setCurrentPage(ActivePage.AppDashboard);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm shrink-0">
      <div className="flex items-center gap-3 h-14 px-4">
        {/* Back */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors shrink-0"
          aria-label={mode === 'public' ? 'Volver a la web' : 'Volver al panel'}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">
            {mode === 'public' ? 'Web' : 'Panel'}
          </span>
        </button>

        {/* Brand — clickable para volver a Home cuando se está en catálogo */}
        {onGoHome ? (
          <button
            onClick={onGoHome}
            className="flex items-center gap-1.5 shrink-0 hover:opacity-75 transition-opacity"
            aria-label="Volver al inicio del marketplace"
          >
            <div className="w-6 h-6 rounded-md bg-[#1A5A96] flex items-center justify-center">
              <span className="text-white font-black text-[9px]">TF</span>
            </div>
            <span className="text-[#1A5A96] font-black text-sm tracking-tight hidden sm:block">
              Marketplace
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-[#1A5A96] flex items-center justify-center">
              <span className="text-white font-black text-[9px]">TF</span>
            </div>
            <span className="text-[#1A5A96] font-black text-sm tracking-tight hidden sm:block">
              Marketplace
            </span>
          </div>
        )}

        {/* Search — centro, crece; oculto en vista Home */}
        {hideSearch ? (
          <div className="flex-1" />
        ) : (
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Buscar materiales, herramientas, equipos…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96] transition-all"
              />
            </div>
          </div>
        )}

        {/* Derecha: org name (professional) + carrito mobile */}
        <div className="flex items-center gap-2 shrink-0">
          {mode === 'professional' && orgName && (
            <div className="hidden md:flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#1A5A96]" />
              <span className="text-xs font-semibold text-gray-700 max-w-[120px] truncate">
                {orgName}
              </span>
            </div>
          )}

          {/* Cart badge — mobile */}
          <button
            onClick={onOpenCart}
            className="relative lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
            aria-label="Ver carrito"
          >
            <ShoppingCart className="w-4 h-4 text-gray-600" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#1A5A96] text-[9px] font-black text-white flex items-center justify-center tabular-nums min-w-[18px] min-h-[18px] px-1">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
