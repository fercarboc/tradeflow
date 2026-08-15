import type { AdCampaign, AdDestinationType } from '../../lib/marketplace-ad-types';

// Slots promocionales mobile (MARKET_HOME_MOBILE_PROMO_1 / _2).
// Mobile NO muestra los 4 banners laterales desktop — estos 2 slots
// los reemplazan con un formato horizontal compacto.

interface Props {
  campaigns:  AdCampaign[];
  onNavigate: (type: AdDestinationType, value?: string) => void;
  className?: string;
}

function MobilePromoItem({
  campaign, onNavigate,
}: { campaign: AdCampaign; onNavigate: (type: AdDestinationType, value?: string) => void }) {
  const accent = campaign.accent ?? '#60a5fa';
  const bg     = campaign.bg ?? 'linear-gradient(120deg, #0f2044 0%, #1e3a5f 100%)';

  return (
    <div
      className="flex-1 min-w-0 rounded-2xl overflow-hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ background: bg }}
      onClick={() => onNavigate(campaign.destinationType, campaign.destinationValue)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigate(campaign.destinationType, campaign.destinationValue)}
    >
      <div className="flex-1 min-w-0">
        {campaign.eyebrow && (
          <p className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
            {campaign.eyebrow}
          </p>
        )}
        <p className="text-xs font-bold text-white leading-tight line-clamp-2">
          {campaign.title}
        </p>
      </div>
      <button
        className="shrink-0 py-2 px-3 rounded-xl text-[10px] font-bold text-white whitespace-nowrap min-h-[36px] transition-opacity hover:opacity-80"
        style={{ background: accent + '33', border: `1px solid ${accent}55` }}
        onClick={e => { e.stopPropagation(); onNavigate(campaign.destinationType, campaign.destinationValue); }}
      >
        {campaign.ctaLabel}
      </button>
    </div>
  );
}

export default function MarketplaceMobilePromos({ campaigns, onNavigate, className = '' }: Props) {
  const active = campaigns.filter(c => c.active).slice(0, 2);
  if (active.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {active.map(c => (
        <MobilePromoItem key={c.id} campaign={c} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
