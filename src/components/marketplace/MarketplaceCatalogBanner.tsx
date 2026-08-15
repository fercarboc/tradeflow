import type { AdCampaign, AdDestinationType } from '../../lib/marketplace-ad-types';

// Slot MARKET_CATALOG_HERO — banner compacto dentro de la vista catálogo.
// Se muestra encima del grid de productos (solo en compra libre, no en flujo presupuesto).
// INVARIANTE: NO modifica resultados de búsqueda ni ranking.

interface Props {
  campaign?:  AdCampaign | null;
  onNavigate: (type: AdDestinationType, value?: string) => void;
  className?: string;
}

export default function MarketplaceCatalogBanner({ campaign, onNavigate, className = '' }: Props) {
  if (!campaign || !campaign.active) return null;

  const accent = campaign.accent ?? '#60a5fa';
  const bg     = campaign.bg ?? 'linear-gradient(90deg, #0f2044 0%, #1e3a5f 100%)';

  return (
    <div
      className={`mx-4 mb-3 rounded-xl overflow-hidden flex items-center gap-4 px-4 py-3 ${className}`}
      style={{ background: bg }}
    >
      {/* Texto */}
      <div className="flex-1 min-w-0">
        {campaign.eyebrow && (
          <p className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
            {campaign.eyebrow} · {campaign.advertiserName}
          </p>
        )}
        <p className="text-xs font-bold text-white leading-tight line-clamp-1">
          {campaign.title}
        </p>
        {campaign.subtitle && (
          <p className="text-[10px] text-white/60 mt-0.5 line-clamp-1">
            {campaign.subtitle}
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigate(campaign.destinationType, campaign.destinationValue)}
        className="shrink-0 py-2 px-4 rounded-xl text-xs font-bold text-white min-h-[36px] transition-opacity hover:opacity-80 whitespace-nowrap"
        style={{ background: accent + '33', border: `1px solid ${accent}55` }}
      >
        {campaign.ctaLabel}
      </button>

      {/* Etiqueta publicitaria pequeña */}
      <span className="absolute top-1 right-2 text-[7px] text-white/20 font-bold uppercase tracking-wider pointer-events-none hidden">
        Publicidad
      </span>
    </div>
  );
}
