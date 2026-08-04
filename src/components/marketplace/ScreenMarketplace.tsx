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

import MarketplaceHeader          from './MarketplaceHeader';
import MarketplaceSearchBar       from './MarketplaceSearchBar';
import MarketplaceFilters         from './MarketplaceFilters';
import type { SortBy }            from './MarketplaceFilters';
import MarketplaceGrid            from './MarketplaceGrid';
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
}

export default function ScreenMarketplace({ setCurrentPage }: Props) {
  const { state, actions } = useMarketplaceCart();

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState('');
  const [familia,   setFamilia]   = useState<string | null>(null);
  const [onlyStock, setOnlyStock] = useState(false);
  const [sortBy,    setSortBy]    = useState<SortBy>('nombre');
  const [familias,  setFamilias]  = useState<string[]>([]);

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [slideOverItem, setSlideOverItem] = useState<MarketplaceCatalogItem | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { toast, show: showToast } = useToast();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar familias una sola vez ───────────────────────────────────────────
  useEffect(() => {
    getMarketplaceFamilias().then(setFamilias).catch(() => {});
  }, []);

  // ── Cargar catálogo con debounce en búsqueda ───────────────────────────────
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getMarketplaceCatalog({
        query:     query.trim() || undefined,
        familia:   familia ?? undefined,
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
  }, [query, familia, onlyStock, sortBy]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() ? 350 : 0;
    debounceRef.current = setTimeout(loadCatalog, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadCatalog]);

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

  return (
    <div className="min-h-screen bg-[#020B16] flex flex-col">
      {/* Header */}
      <MarketplaceHeader
        setCurrentPage={setCurrentPage}
        cartCount={cartCount}
        onOpenCart={() => setMobileCartOpen(true)}
      />

      {/* SearchBar */}
      <MarketplaceSearchBar query={query} onChange={setQuery} />

      {/* Body: filtros | grid | carrito */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Filtros — desktop sidebar izquierdo */}
        <MarketplaceFilters
          familias={familias}
          familia={familia}
          onFamilia={setFamilia}
          onlyStock={onlyStock}
          onOnlyStock={setOnlyStock}
          sortBy={sortBy}
          onSortBy={setSortBy}
          totalResults={totalCount}
          loading={loading}
        />

        {/* Grid central */}
        <MarketplaceGrid
          items={catalog?.items ?? []}
          loading={loading}
          error={error}
          query={query}
          onClearQuery={() => setQuery('')}
          onAddBest={handleAddBest}
          onViewOptions={setSlideOverItem}
        />

        {/* Carrito — desktop sidebar derecho */}
        <CartSidebarDesktop
          items={cartItems}
          onUpdateQty={actions.updateQuantity}
          onRemove={actions.removeItem}
        />
      </div>

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
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/50'
              : toast.type === 'error'
              ? 'bg-red-900/90 text-red-200 border border-red-700/50'
              : 'bg-slate-800/90 text-slate-200 border border-slate-600/50'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {toast.type === 'error'   && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.type === 'info'    && <Info className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
