import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ActivePage } from '../../types';
import { useMarketplaceCart } from '../../hooks/useMarketplaceCart';
import {
  getMarketplaceCatalog,
  getMarketplaceFamilias,
} from '../../lib/api/marketplace-catalog';
import type { MarketplaceCatalogItem, CatalogPage } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

import MarketplaceHome             from './MarketplaceHome';
import MarketplaceHeader           from './MarketplaceHeader';
import MarketplaceFilters          from './MarketplaceFilters';
import type { SortBy }             from './MarketplaceFilters';
import MarketplaceGrid             from './MarketplaceGrid';
import MarketplaceProductSlideOver from './MarketplaceProductSlideOver';
import CartSidebar                 from './CartSidebar';
import { CartSidebarDesktop }      from './CartSidebar';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 3000);
  }, []);
  return { toast, show };
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

interface Props {
  setCurrentPage: (p: ActivePage) => void;
  mode?: 'public' | 'professional';
}

export default function ScreenMarketplace({ setCurrentPage, mode = 'professional' }: Props) {
  const { state, actions } = useMarketplaceCart();

  // ── Vista interna (home ↔ catalog) ────────────────────────────────────────
  // Instalador: entra directamente al catálogo. Público: empieza en home.
  const [view, setView] = useState<'home' | 'catalog'>(mode === 'professional' ? 'catalog' : 'home');

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState('');
  const [oficio,    setOficio]    = useState<string | null>(null);
  const [familia,   setFamilia]   = useState<string | null>(null);
  const [onlyStock, setOnlyStock] = useState(false);
  const [sortBy,    setSortBy]    = useState<SortBy>('nombre');
  const [familias,  setFamilias]  = useState<string[]>([]);

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [slideOverItem, setSlideOverItem]   = useState<MarketplaceCatalogItem | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { toast, show: showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar familias una sola vez ───────────────────────────────────────────
  useEffect(() => {
    getMarketplaceFamilias().then(setFamilias).catch(() => {});
  }, []);

  // ── Navegar al catálogo con oficio opcional ────────────────────────────────
  const goToCatalog = useCallback((newOficio?: string | null) => {
    if (newOficio !== undefined) setOficio(newOficio);
    setView('catalog');
  }, []);

  // ── Cargar catálogo (sólo cuando estamos en vista catalog) ─────────────────
  const loadCatalog = useCallback(async () => {
    if (view !== 'catalog') return;
    setLoading(true);
    setError(null);
    try {
      const page = await getMarketplaceCatalog({
        query:     query.trim() || undefined,
        familia:   familia ?? undefined,
        oficio:    oficio ?? undefined,
        onlyStock,
        sortBy,
        limit:     48,
        offset:    0,
      });
      setCatalog(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar catálogo');
    } finally {
      setLoading(false);
    }
  }, [view, query, oficio, familia, onlyStock, sortBy]);

  useEffect(() => {
    if (view !== 'catalog') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() ? 350 : 0;
    debounceRef.current = setTimeout(loadCatalog, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadCatalog, view]);

  // ── Añadir la mejor offering de una tarjeta ────────────────────────────────
  const handleAddBest = useCallback((item: MarketplaceCatalogItem) => {
    if (!item.best_offering_id || !item.best_actor_id) {
      showToast('No hay offering disponible para añadir', 'error');
      return;
    }

    const cartItem: Omit<LocalCartItem, 'cartItemId'> = {
      universalProductId: item.up_id,
      offeringId:         item.best_offering_id,
      supplierActorId:    item.best_actor_id,
      supplierName:       item.best_actor_nombre ?? '',
      supplierRef:        item.best_supplier_ref,
      nombre:             item.nombre_canonico,
      imagen:             item.image_url,
      cantidad:           1,
      unidadTecnica:      item.unidad,
      unidadComercial:    item.best_unidad ?? item.unidad,
      precioUnitario:     item.best_precio ?? 0,
      stockDisponible:    item.best_stock,
      plazoEntregaDias:   item.best_plazo ?? 0,
      sourceType:         'free',
      lineaOrigen:        'manual',
    };

    actions.addItem(cartItem);

    if (!item.best_stock) {
      showToast(`${item.nombre_canonico} añadido (sin stock confirmado)`, 'info');
    } else {
      showToast(`${item.nombre_canonico} añadido al carrito`, 'success');
    }
  }, [actions, showToast]);

  // ── Añadir desde el SlideOver ──────────────────────────────────────────────
  const handleAddFromSlideOver = useCallback((item: Omit<LocalCartItem, 'cartItemId'>) => {
    actions.addItem(item);
    showToast(`${item.nombre} añadido al carrito`, 'success');
  }, [actions, showToast]);

  const cartItems  = state.items;
  const cartCount  = cartItems.length;
  const totalCount = catalog?.total ?? 0;

  const handleGuestCheckout = mode === 'public' ? () => {
    sessionStorage.setItem('mk_return', '1');
    setCurrentPage(ActivePage.Login);
  } : undefined;

  // ── Cambio de query: auto-navega a catálogo ────────────────────────────────
  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (q.trim() && view === 'home') setView('catalog');
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header sticky */}
      <MarketplaceHeader
        mode={mode}
        view={view}
        setCurrentPage={setCurrentPage}
        onGoToHome={() => setView('home')}
        cartCount={cartCount}
        onOpenCart={() => setMobileCartOpen(true)}
        query={query}
        onQueryChange={handleQueryChange}
        onSearch={() => setView('catalog')}
      />

      {view === 'home' ? (
        /* ── Home ── */
        <main className="flex-1 overflow-y-auto">
          <MarketplaceHome onGoToCatalog={goToCatalog} />
        </main>
      ) : (
        /* ── Catalog ── */
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Filtros */}
          <MarketplaceFilters
            familias={familias}
            familia={familia}
            onFamilia={f => { setFamilia(f); }}
            oficio={oficio}
            onOficio={o => { setOficio(o); }}
            onlyStock={onlyStock}
            onOnlyStock={setOnlyStock}
            sortBy={sortBy}
            onSortBy={setSortBy}
            totalResults={totalCount}
            loading={loading}
          />

          {/* Grid */}
          <MarketplaceGrid
            items={catalog?.items ?? []}
            loading={loading}
            error={error}
            query={query}
            onClearQuery={() => setQuery('')}
            onAddBest={handleAddBest}
            onViewOptions={setSlideOverItem}
          />

          {/* Carrito desktop */}
          <CartSidebarDesktop
            items={cartItems}
            onUpdateQty={actions.updateQuantity}
            onRemove={actions.removeItem}
            onCheckout={handleGuestCheckout}
          />
        </div>
      )}

      {/* SlideOver de opciones */}
      <MarketplaceProductSlideOver
        item={slideOverItem}
        onClose={() => setSlideOverItem(null)}
        onAdd={handleAddFromSlideOver}
      />

      {/* Carrito drawer móvil */}
      <CartSidebar
        items={cartItems}
        isOpen={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        onUpdateQty={actions.updateQuantity}
        onRemove={actions.removeItem}
        onCheckout={handleGuestCheckout}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-white text-emerald-700 border border-emerald-200 shadow-emerald-100'
              : toast.type === 'error'
              ? 'bg-white text-red-600 border border-red-200 shadow-red-100'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
          {toast.type === 'error'   && <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />}
          {toast.type === 'info'    && <Info className="w-4 h-4 shrink-0 text-blue-500" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
