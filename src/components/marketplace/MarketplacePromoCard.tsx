import type { PromoCard, AdDestinationType } from '../../lib/marketplace-ad-types';

// Card individual de mayorista promocionado.
// INVARIANTE: la promoción da visibilidad pero NUNCA altera el ranking orgánico.

interface Props {
  card:       PromoCard;
  onNavigate: (type: AdDestinationType, value?: string) => void;
}

const BADGE_STYLES: Record<PromoCard['badgeVariant'], string> = {
  blue:  'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  red:   'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
};

const CARD_ACCENTS: Record<PromoCard['badgeVariant'], string> = {
  blue:  '#3b82f6',
  green: '#10b981',
  red:   '#ef4444',
  amber: '#f59e0b',
};

const CARD_BG: Record<PromoCard['badgeVariant'], string> = {
  blue:  'linear-gradient(135deg, #0f2044 0%, #1e3a5f 100%)',
  green: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)',
  red:   'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
  amber: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
};

function advertiserInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function MarketplacePromoCard({ card, onNavigate }: Props) {
  const accent = CARD_ACCENTS[card.badgeVariant];
  const bg     = CARD_BG[card.badgeVariant];

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border border-white/10 w-full hover:scale-[1.02] transition-transform cursor-pointer select-none"
      style={{ background: bg }}
      onClick={() => onNavigate(card.destinationType, card.destinationValue)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigate(card.destinationType, card.destinationValue)}
    >
      {/* Badge */}
      <div className="px-3 pt-3">
        <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${BADGE_STYLES[card.badgeVariant]}`}>
          {card.badge}
        </span>
      </div>

      {/* Área de imagen / placeholder */}
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.title}
          loading="lazy"
          className="w-full h-24 object-cover mt-2"
        />
      ) : (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black mx-3 mt-3"
          style={{ background: accent + '22', border: `1px solid ${accent}44`, color: accent }}
        >
          {advertiserInitials(card.advertiserName)}
        </div>
      )}

      {/* Texto */}
      <div className="flex flex-col gap-1.5 px-3 pt-2 pb-3 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>
          {card.advertiserName}
        </p>
        <p className="text-xs font-bold text-white leading-tight line-clamp-2">
          {card.title}
        </p>
        {card.promoText && (
          <p className="text-[10px] text-white/70 leading-tight">
            {card.promoText}
          </p>
        )}
        <button
          className="mt-auto w-full py-2 rounded-xl text-[10px] font-bold text-white transition-all hover:opacity-90 min-h-[36px]"
          style={{ background: accent + '33', border: `1px solid ${accent}55` }}
          onClick={e => { e.stopPropagation(); onNavigate(card.destinationType, card.destinationValue); }}
        >
          {card.ctaLabel}
        </button>
      </div>
    </div>
  );
}
