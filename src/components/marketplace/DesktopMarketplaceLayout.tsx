import { ArrowUpDown, ChevronDown } from 'lucide-react';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import type { MarketplacePurchaseContext } from '../../lib/marketplace/purchase-context';
import type { SortBy } from './MarketplaceFilters';
import MarketplaceFilters from './MarketplaceFilters';
import MarketplaceGrid from './MarketplaceGrid';
import MarketplaceBanner from './MarketplaceBanner';
import MarketplaceCatalogBanner from './MarketplaceCatalogBanner';
import { CartSidebarDesktop } from './CartSidebar';
import { DEMO_CATALOG_BANNER } from '../../lib/marketplace-campaigns-demo';
import { useAdCampaigns } from '../../hooks/useAdCampaigns';

// ─── Sort bar sobre catálogo ──────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'nombre',     label: 'Nombre A–Z' },
  { value: 'precio_asc', label: 'Precio más bajo' },
  { value: 'plazo_asc',  label: 'Entrega rápida' },
];

function SortBar({
  sortBy, onSortBy, totalResults, loading,
}: {
  sortBy: SortBy; onSortBy: (s: SortBy) => void; totalResults: number; loading: boolean;
}) {
  const currentLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Ordenar';

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-white shrink-0">
      <span className="text-xs text-gray-400 tabular-nums">
        {loading ? '…' : `${totalResults} resultado${totalResults !== 1 ? 's' : ''}`}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => onSortBy(e.target.value as SortBy)}
            className="appearance-none pl-2 pr-7 py-1 text-xs text-gray-700 border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96] cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DesktopLayoutProps {
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
  onCategory:   (oficio: string | null) => void;

  // Cart
  cartItems:   LocalCartItem[];
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
  onCheckout?: () => void;
  quoteRef?:   string | null;
}

// ─── Desktop layout ───────────────────────────────────────────────────────────

export default function DesktopMarketplaceLayout({
  familias, familia, onFamilia,
  oficio, onOficio,
  actorNombres, selectedActores, onActores,
  onlyStock, onOnlyStock,
  sortBy, onSortBy,
  minPrice, maxPrice, onMinPrice, onMaxPrice,
  filteredItems, loading, error,
  purchaseCtx, actorIdsWithPickup,
  query, onClearQuery, onAddBest, onViewItem, onCategory,
  cartItems, onUpdateQty, onRemove, onCheckout, quoteRef,
}: DesktopLayoutProps) {
  const { getCampaign: getCatalogCampaign } = useAdCampaigns(['MARKET_CATALOG_HERO']);
  const catalogBannerCampaign = getCatalogCampaign('MARKET_CATALOG_HERO') ?? DEMO_CATALOG_BANNER;

  return (
    <div className="hidden xl:flex flex-1 min-h-0 overflow-hidden">
      {/* Filtros — 240px */}
      <MarketplaceFilters
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

      {/* Centro: banner + slot publicitario + sort bar + catálogo */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!purchaseCtx && <MarketplaceBanner onCategory={onCategory} />}
        {!purchaseCtx && (
          <MarketplaceCatalogBanner
            campaign={catalogBannerCampaign}
            onNavigate={(type, value) => {
              if (type === 'category') onCategory(value ?? null);
            }}
          />
        )}
        <SortBar
          sortBy={sortBy}
          onSortBy={onSortBy}
          totalResults={filteredItems.length}
          loading={loading}
        />
        <div className="flex-1 overflow-y-auto">
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
      </div>

      {/* Carrito — 288px */}
      <CartSidebarDesktop
        items={cartItems}
        onUpdateQty={onUpdateQty}
        onRemove={onRemove}
        onCheckout={onCheckout}
        quoteRef={quoteRef}
      />
    </div>
  );
}
