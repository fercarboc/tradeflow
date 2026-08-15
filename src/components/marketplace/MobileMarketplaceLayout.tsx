import { ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { MARKETPLACE_OFICIOS } from '../../lib/marketplace-config';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import type { MarketplacePurchaseContext } from '../../lib/marketplace/purchase-context';
import type { SortBy } from './MarketplaceFilters';
import MarketplaceGrid from './MarketplaceGrid';
import MarketplaceFiltersDrawer from './MarketplaceFiltersDrawer';
import CartSidebar from './CartSidebar';
import MarketplaceCatalogBanner from './MarketplaceCatalogBanner';
import { DEMO_CATALOG_BANNER } from '../../lib/marketplace-campaigns-demo';

// ─── Chips horizontales de categoría ─────────────────────────────────────────

function CategoryChips({
  oficio, onOficio,
}: { oficio: string | null; onOficio: (o: string | null) => void }) {
  return (
    <div className="shrink-0 overflow-x-auto flex gap-2 px-3 py-2 border-b border-gray-100 bg-white scrollbar-none">
      <button
        onClick={() => onOficio(null)}
        className={`flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
          oficio === null
            ? 'bg-[#1A5A96] text-white border-[#1A5A96]'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
        }`}
      >
        Todos
      </button>
      {MARKETPLACE_OFICIOS.map(o => (
        <button
          key={o.id}
          onClick={() => onOficio(oficio === o.id ? null : o.id)}
          className={`flex-none flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
            oficio === o.id
              ? 'text-white border-transparent'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
          style={oficio === o.id ? { backgroundColor: o.color, borderColor: o.color } : {}}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: oficio === o.id ? 'rgba(255,255,255,0.7)' : o.color }}
          />
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Sort label compacto ──────────────────────────────────────────────────────

const SORT_LABELS: Record<SortBy, string> = {
  nombre:     'Nombre A–Z',
  precio_asc: 'Precio',
  plazo_asc:  'Entrega',
};

// ─── Toolbar Filtros + Ordenar ────────────────────────────────────────────────

function MobileToolbar({
  activeFilterCount, onOpenFilters,
  sortBy, onSortBy,
  totalResults, loading,
}: {
  activeFilterCount: number;
  onOpenFilters:     () => void;
  sortBy:            SortBy;
  onSortBy:          (s: SortBy) => void;
  totalResults:      number;
  loading:           boolean;
}) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
      {/* Filtros con badge */}
      <button
        onClick={onOpenFilters}
        className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-[#1A5A96]/40 hover:text-[#1A5A96] transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {activeFilterCount > 0 ? (
          <>
            Filtros
            <span className="ml-0.5 bg-[#1A5A96] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {activeFilterCount}
            </span>
          </>
        ) : 'Filtros'}
      </button>

      {/* Sort inline */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 overflow-hidden">
        {(['nombre', 'precio_asc', 'plazo_asc'] as SortBy[]).map(s => (
          <button
            key={s}
            onClick={() => onSortBy(s)}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              sortBy === s
                ? 'bg-[#1A5A96] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {SORT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Resultado count */}
      <span className="ml-auto text-xs text-gray-400 tabular-nums shrink-0">
        {loading ? '…' : `${totalResults}`}
      </span>
    </div>
  );
}

// ─── Cart FAB ─────────────────────────────────────────────────────────────────

function CartFAB({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      aria-label={`Ver carrito — ${count} artículo${count !== 1 ? 's' : ''}`}
      className="fixed bottom-5 right-4 z-30 lg:hidden flex items-center gap-2 bg-[#1A5A96] hover:bg-[#154d82] text-white font-bold text-sm pl-4 pr-5 py-3 rounded-2xl shadow-lg shadow-[#1A5A96]/30 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] focus-visible:ring-offset-2"
    >
      <span className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 bg-white text-[#1A5A96] text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full tabular-nums">
          {count > 9 ? '9+' : count}
        </span>
      </span>
      Ver carrito
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MobileLayoutProps {
  // Filters
  familias:        string[];
  familia:         string | null;
  onFamilia:       (f: string | null) => void;
  oficio:          string | null;
  onOficio:        (o: string | null) => void;
  actorNombres:    string[];
  selectedActores: string[];
  onActores:       (a: string[]) => void;
  onlyStock:       boolean;
  onOnlyStock:     (v: boolean) => void;
  sortBy:          SortBy;
  onSortBy:        (s: SortBy) => void;
  minPrice:        string;
  maxPrice:        string;
  onMinPrice:      (v: string) => void;
  onMaxPrice:      (v: string) => void;

  // Catalog
  filteredItems:      MarketplaceCatalogItem[];
  loading:            boolean;
  error:              string | null;
  purchaseCtx:        MarketplacePurchaseContext | null;
  actorIdsWithPickup: Set<string>;

  // Grid handlers
  query:        string;
  onClearQuery: () => void;
  onAddBest:    (item: MarketplaceCatalogItem) => void;
  onViewItem:   (item: MarketplaceCatalogItem | null) => void;

  // Cart
  cartItems:   LocalCartItem[];
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
  onCheckout?: () => void;
  quoteRef?:   string | null;

  // Drawer state
  mobileFiltersOpen:    boolean;
  onOpenMobileFilters:  () => void;
  onCloseMobileFilters: () => void;
  mobileCartOpen:       boolean;
  onOpenMobileCart:     () => void;
  onCloseMobileCart:    () => void;
}

// ─── Mobile layout ────────────────────────────────────────────────────────────

export default function MobileMarketplaceLayout({
  familias, familia, onFamilia,
  oficio, onOficio,
  actorNombres, selectedActores, onActores,
  onlyStock, onOnlyStock,
  sortBy, onSortBy,
  minPrice, maxPrice, onMinPrice, onMaxPrice,
  filteredItems, loading, error,
  purchaseCtx, actorIdsWithPickup,
  query, onClearQuery, onAddBest, onViewItem,
  cartItems, onUpdateQty, onRemove, onCheckout, quoteRef,
  mobileFiltersOpen, onOpenMobileFilters, onCloseMobileFilters,
  mobileCartOpen, onOpenMobileCart, onCloseMobileCart,
}: MobileLayoutProps) {
  const activeFilterCount = [
    oficio !== null,
    familia !== null,
    selectedActores.length > 0,
    onlyStock,
    minPrice !== '' || maxPrice !== '',
  ].filter(Boolean).length;

  const cartCount = cartItems.length;

  return (
    <div className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chips de categoría */}
      <CategoryChips oficio={oficio} onOficio={onOficio} />

      {/* Toolbar filtros + ordenar */}
      <MobileToolbar
        activeFilterCount={activeFilterCount}
        onOpenFilters={onOpenMobileFilters}
        sortBy={sortBy}
        onSortBy={onSortBy}
        totalResults={filteredItems.length}
        loading={loading}
      />

      {/* Slot publicitario catalog — solo compra libre */}
      {!purchaseCtx && (
        <MarketplaceCatalogBanner
          campaign={DEMO_CATALOG_BANNER}
          onNavigate={(type, value) => {
            if (type === 'category') onOficio(value ?? null);
          }}
          className="mx-0 mt-2"
        />
      )}

      {/* Catálogo */}
      <div className="flex-1 overflow-y-auto pb-20">
        <MarketplaceGrid
          items={filteredItems}
          loading={loading}
          error={error}
          query={query}
          onClearQuery={onClearQuery}
          onAddBest={onAddBest}
          onViewOptions={onViewItem}
          actorIdsWithPickup={actorIdsWithPickup}
        />
      </div>

      {/* FAB carrito */}
      <CartFAB count={cartCount} onClick={onOpenMobileCart} />

      {/* Filtros drawer */}
      <MarketplaceFiltersDrawer
        isOpen={mobileFiltersOpen}
        onClose={onCloseMobileFilters}
        familias={familias}
        familia={familia}
        onFamilia={onFamilia}
        oficio={oficio}
        onOficio={onOficio}
        actorNombres={actorNombres}
        selectedActores={selectedActores}
        onActores={onActores}
        onlyStock={onlyStock}
        onOnlyStock={onOnlyStock}
        sortBy={sortBy}
        onSortBy={onSortBy}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinPrice={onMinPrice}
        onMaxPrice={onMaxPrice}
        totalResults={filteredItems.length}
        loading={loading}
      />

      {/* Carrito drawer */}
      <CartSidebar
        items={cartItems}
        isOpen={mobileCartOpen}
        onClose={onCloseMobileCart}
        onUpdateQty={onUpdateQty}
        onRemove={onRemove}
        onCheckout={onCheckout}
        quoteRef={quoteRef}
      />
    </div>
  );
}
