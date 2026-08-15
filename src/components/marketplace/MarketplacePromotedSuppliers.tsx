import type { PromoCard, AdDestinationType } from '../../lib/marketplace-ad-types';
import MarketplacePromoCard from './MarketplacePromoCard';

// Sección "Mayoristas promocionados" con scroll horizontal.
// INVARIANTE: promoción ≠ ranking orgánico.

interface Props {
  cards:      PromoCard[];
  onNavigate: (type: AdDestinationType, value?: string) => void;
  onViewAll?: () => void;
}

export default function MarketplacePromotedSuppliers({ cards, onNavigate, onViewAll }: Props) {
  if (cards.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-800">
          Mayoristas promocionados
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-[#1A5A96] font-semibold hover:underline"
          >
            Ver todos →
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {cards.map(card => (
          <MarketplacePromoCard
            key={card.id}
            card={card}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
