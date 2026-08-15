import type { AdCampaign, AdDestinationType } from '../../lib/marketplace-ad-types';

// Slot publicitario lateral — Home Desktop.
// Renderiza una campaña en un slot (MARKET_HOME_LEFT_TOP, RIGHT_TOP, etc.)
// Sin campaña activa: devuelve null (sin reservar espacio visual).
//
// INVARIANTE: este componente NO afecta ranking, precio ni comparador.
// Es puramente un contenedor de visibilidad comercial contratada.

interface AdSlotProps {
  campaign: AdCampaign | null | undefined;
  onNavigate: (type: AdDestinationType, value?: string) => void;
  className?: string;
}

function advertiserInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function FeatureBullet({ text, accent }: { text: string; accent: string }) {
  return (
    <li className="flex items-start gap-1.5 text-xs text-white/80">
      <span
        className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: accent }}
      />
      {text}
    </li>
  );
}

export default function MarketplaceAdSlot({ campaign, onNavigate, className = '' }: AdSlotProps) {
  if (!campaign || !campaign.active) return null;

  const accent   = campaign.accent ?? '#60a5fa';
  const bg       = campaign.bg ?? 'linear-gradient(160deg, #1e3a5f 0%, #0f2044 100%)';
  const hasImage = Boolean(campaign.imageUrl);

  function handleClick() {
    onNavigate(campaign!.destinationType, campaign!.destinationValue);
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden flex flex-col ${className}`}
      style={{ background: hasImage ? undefined : bg, minHeight: '220px' }}
    >
      {/* Imagen de fondo cuando disponible */}
      {hasImage && (
        <img
          src={campaign.imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {hasImage && <div className="absolute inset-0 bg-black/50" />}

      {/* Etiqueta publicitaria */}
      <div className="relative z-10 px-3 pt-3">
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/30 select-none">
          Espacio publicitario
        </span>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col gap-2.5 px-3 pt-2 pb-3 flex-1">
        {/* Logo / iniciales + nombre */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
            style={{ background: accent + '33', border: `1px solid ${accent}66` }}
          >
            <span style={{ color: accent }}>
              {advertiserInitials(campaign.advertiserName)}
            </span>
          </div>
          <p
            className="text-[10px] font-bold leading-tight line-clamp-2"
            style={{ color: accent }}
          >
            {campaign.advertiserName}
          </p>
        </div>

        {/* Eyebrow */}
        {campaign.eyebrow && (
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">
            {campaign.eyebrow}
          </p>
        )}

        {/* Título */}
        <p className="text-sm font-black text-white leading-tight">
          {campaign.title}
        </p>

        {/* Subtítulo / bullets */}
        {campaign.subtitle && (
          <ul className="space-y-1">
            {campaign.subtitle.split(' · ').map((item, i) => (
              <FeatureBullet key={i} text={item} accent={accent} />
            ))}
          </ul>
        )}

        {/* Precio si aplica */}
        {campaign.price && (
          <div className="flex items-baseline gap-1.5 mt-auto">
            <span className="text-xl font-black text-white">{campaign.price}</span>
            {campaign.previousPrice && (
              <span className="text-xs text-white/40 line-through">{campaign.previousPrice}</span>
            )}
            {campaign.discount && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                style={{ background: accent, color: '#000' }}
              >
                {campaign.discount}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleClick}
          className="mt-auto w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 min-h-[36px]"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: `1px solid ${accent}55` }}
        >
          {campaign.ctaLabel}
        </button>
      </div>
    </div>
  );
}
