import { ArrowLeft, Search, ShoppingCart } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  mode:           'public' | 'professional';
  view:           'home' | 'catalog';
  setCurrentPage: (p: ActivePage) => void;
  onGoToHome:     () => void;   // catalog → home
  cartCount:      number;
  onOpenCart:     () => void;
  query:          string;
  onQueryChange:  (q: string) => void;
  onSearch:       () => void;   // switch to catalog view on enter/focus
}

export default function MarketplaceHeader({
  mode, view, setCurrentPage, onGoToHome,
  cartCount, onOpenCart,
  query, onQueryChange, onSearch,
}: Props) {
  const handleBack = () => {
    if (view === 'catalog') {
      onGoToHome();
    } else if (mode === 'public') {
      setCurrentPage(ActivePage.Home);
    } else {
      setCurrentPage(ActivePage.AppDashboard);
    }
  };

  const backLabel = view === 'catalog'
    ? 'Inicio'
    : mode === 'public' ? 'Volver a la web' : 'Panel';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 h-16 px-4 max-w-screen-2xl mx-auto">
        {/* Back */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm shrink-0"
          aria-label={backLabel}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">{backLabel}</span>
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#1A5A96] flex items-center justify-center">
            <span className="text-white font-black text-[10px]">TF</span>
          </div>
          <span className="text-[#1A5A96] font-black text-base tracking-tight hidden sm:block">
            Marketplace
          </span>
        </div>

        {/* Search bar — centro */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={e => {
                onQueryChange(e.target.value);
                if (view === 'home' && e.target.value.trim()) onSearch();
              }}
              onFocus={() => { if (view === 'home') onSearch(); }}
              onKeyDown={e => { if (e.key === 'Enter') { onSearch(); } }}
              placeholder="Buscar materiales, herramientas, equipos…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96] transition-all"
            />
          </div>
        </div>

        {/* Cart badge — mobile only */}
        <button
          onClick={onOpenCart}
          className="relative lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-gray-100 transition-colors"
          aria-label="Ver carrito"
        >
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1A5A96] text-[9px] font-black text-white flex items-center justify-center tabular-nums">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
