import { Loader2 } from 'lucide-react';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';
import MarketplaceProductCard from './MarketplaceProductCard';
import MarketplaceEmptyState  from './MarketplaceEmptyState';

interface Props {
  items:         MarketplaceCatalogItem[];
  loading:       boolean;
  error:         string | null;
  query:         string;
  onClearQuery:  () => void;
  onAddBest:     (item: MarketplaceCatalogItem) => void;
  onViewOptions: (item: MarketplaceCatalogItem) => void;
}

export default function MarketplaceGrid({
  items, loading, error, query, onClearQuery, onAddBest, onViewOptions,
}: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#1A5A96] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="text-center">
          <p className="text-red-500 text-sm font-semibold mb-1">Error al cargar el catálogo</p>
          <p className="text-gray-400 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex-1">
        <MarketplaceEmptyState query={query} onClearQuery={onClearQuery} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
        {items.map(item => (
          <MarketplaceProductCard
            key={item.up_id}
            item={item}
            onAddBest={onAddBest}
            onViewOptions={onViewOptions}
          />
        ))}
      </div>
      {loading && items.length > 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-[#1A5A96] animate-spin" />
        </div>
      )}
    </div>
  );
}
