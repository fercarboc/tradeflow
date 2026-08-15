import { useState, useEffect, useCallback } from 'react';
import {
  Search, MapPin, ChevronRight, Store, Package,
  Droplets, Zap, Layers, Hammer, Paintbrush, Wind, Flame,
  ShoppingCart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MARKETPLACE_OFICIOS } from '../../lib/marketplace-config';
import { listActiveSuppliers } from '../../lib/api/marketplace-actors';
import type { ActiveSupplier } from '../../lib/api/marketplace-actors';
import type { MarketplaceLocation } from '../../hooks/useMarketplaceLocation';
import type { AdDestinationType, AdSlotId } from '../../lib/marketplace-ad-types';
import {
  DEMO_HERO_SLIDES,
  DEMO_LATERAL_CAMPAIGNS,
  DEMO_MOBILE_CAMPAIGNS,
  DEMO_PROMO_CARDS,
} from '../../lib/marketplace-campaigns-demo';
import { useAdCampaigns } from '../../hooks/useAdCampaigns';
import {
  adCampaignToHeroSlide,
  adCampaignToPromoCard,
  resolveCampaignDestination,
} from '../../lib/api/marketplace-ads';

import MarketplaceHeroCarousel     from './MarketplaceHeroCarousel';
import MarketplaceAdSlot            from './MarketplaceAdSlot';
import MarketplaceBenefitsBar       from './MarketplaceBenefitsBar';
import MarketplacePromotedSuppliers from './MarketplacePromotedSuppliers';
import MarketplaceMobilePromos      from './MarketplaceMobilePromos';
import MarketplaceTopNav            from './MarketplaceTopNav';

// ── Iconos por oficio ─────────────────────────────────────────────────────────

const OFICIO_ICONS: Record<string, LucideIcon> = {
  fontaneria:    Droplets,
  electricidad:  Zap,
  albanileria:   Layers,
  carpinteria:   Hammer,
  pintura:       Paintbrush,
  climatizacion: Wind,
  soldadura:     Flame,
};

// ── Colores de proveedores (determinista, sin N+1) ────────────────────────────

const SUPPLIER_PALETTE = [
  '#3B82F6','#10B981','#8B5CF6','#F59E0B',
  '#EC4899','#EF4444','#06B6D4','#6366F1',
];

function supplierColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SUPPLIER_PALETTE[hash % SUPPLIER_PALETTE.length];
}

function supplierInitials(nombre: string): string {
  return nombre.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

// ── Logos locales — match por nombre.toLowerCase().includes(pattern) ──────────

const SUPPLIER_LOGO_MAP: Array<[string, string]> = [
  ['hidrosur',                      '/marketplace/logos/hidrosur.png'],
  ['obrama',                        '/marketplace/logos/obrama.png'],
  ['electro norte',                 '/marketplace/logos/electro-norte.png'],
  ['electrosuministros cantábrico', '/marketplace/logos/electro-norte.png'],
  ['climatizar',                    '/marketplace/logos/climatizar.png'],
  ['maderas del norte',             '/marketplace/logos/maderas-norte.png'],
  ['pinturas pro',                  '/marketplace/logos/pinturas-pro.png'],
];

function getLocalLogo(supplier: ActiveSupplier): string | null {
  if (supplier.logo_url) return supplier.logo_url;
  const key = supplier.nombre.toLowerCase();
  for (const [pattern, path] of SUPPLIER_LOGO_MAP) {
    if (key.includes(pattern)) return path;
  }
  return null;
}

// ── Sub-componentes top-level (nunca anidados dentro del export default) ───────

interface HomeSearchBarProps {
  onSearch: (q: string) => void;
  compact?: boolean;
}

function HomeSearchBar({ onSearch, compact }: HomeSearchBarProps) {
  const [localQuery, setLocalQuery] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = localQuery.trim();
    if (q) onSearch(q);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={localQuery}
          onChange={e => setLocalQuery(e.target.value)}
          placeholder="¿Qué material necesitas?"
          className={`w-full bg-white border-2 border-gray-200 rounded-xl pl-10 pr-20 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1A5A96] shadow-sm transition-colors ${compact ? 'py-2' : 'py-3.5 rounded-2xl text-base pl-12 pr-24'}`}
        />
        <button
          type="submit"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#1A5A96] text-white rounded-lg font-bold hover:bg-[#154d82] transition-colors ${compact ? 'px-3 py-1.5 text-xs min-h-[30px]' : 'px-4 py-2 text-sm min-h-[36px] rounded-xl'}`}
        >
          Buscar
        </button>
      </div>
    </form>
  );
}

interface HomeLocationRowProps {
  location:         MarketplaceLocation | null;
  onChangeLocation: () => void;
}

function HomeLocationRow({ location, onChangeLocation }: HomeLocationRowProps) {
  return (
    <button
      onClick={onChangeLocation}
      className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A5A96] transition-colors"
    >
      <MapPin className="w-4 h-4 text-[#1A5A96] shrink-0" />
      {location ? (
        <>
          <span className="font-semibold text-gray-800">{location.localidad}</span>
          {location.comunidad_autonoma && (
            <span className="text-gray-400 text-xs">· {location.comunidad_autonoma}</span>
          )}
          <span className="text-gray-400 text-xs ml-1">· Cambiar</span>
        </>
      ) : (
        <span className="text-gray-400">Activar disponibilidad local</span>
      )}
    </button>
  );
}

interface HomeCategoryGridProps {
  onGoToCatalog: (oficio?: string | null, search?: string) => void;
}

function HomeCategoryGrid({ onGoToCatalog }: HomeCategoryGridProps) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Categorías
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {MARKETPLACE_OFICIOS.map(o => {
          const Icon = OFICIO_ICONS[o.id];
          return (
            <button
              key={o.id}
              onClick={() => onGoToCatalog(o.id)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
              style={{ background: o.bg }}
            >
              {Icon && (
                <Icon className="w-6 h-6 transition-transform group-hover:scale-110" style={{ color: o.color }} />
              )}
              <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
                {o.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => onGoToCatalog()}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-dashed border-gray-200 hover:border-[#1A5A96]/30 hover:bg-[#1A5A96]/5 transition-all group"
        >
          <Package className="w-6 h-6 text-gray-300 group-hover:text-[#1A5A96] transition-colors" />
          <span className="text-xs font-semibold text-gray-400 group-hover:text-[#1A5A96] text-center leading-tight transition-colors">
            Ver todo
          </span>
        </button>
      </div>
    </div>
  );
}

interface HomeCategoryScrollProps {
  onGoToCatalog: (oficio?: string | null, search?: string) => void;
}

function HomeCategoryScroll({ onGoToCatalog }: HomeCategoryScrollProps) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 px-0.5">
        Categorías
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {MARKETPLACE_OFICIOS.map(o => {
          const Icon = OFICIO_ICONS[o.id];
          return (
            <button
              key={o.id}
              onClick={() => onGoToCatalog(o.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-gray-100 shrink-0 min-w-[70px] hover:shadow-sm transition-all min-h-[44px]"
              style={{ background: o.bg }}
            >
              {Icon && <Icon className="w-5 h-5" style={{ color: o.color }} />}
              <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight whitespace-nowrap">
                {o.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => onGoToCatalog()}
          className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-dashed border-gray-200 shrink-0 min-w-[70px] hover:bg-gray-50 transition-all min-h-[44px]"
        >
          <Package className="w-5 h-5 text-gray-300" />
          <span className="text-[10px] font-semibold text-gray-400 text-center leading-tight whitespace-nowrap">
            Ver todo
          </span>
        </button>
      </div>
    </div>
  );
}

interface HomeSupplierCardProps {
  supplier:      ActiveSupplier;
  onGoToCatalog: (oficio?: string | null, search?: string, actor?: string) => void;
}

function HomeSupplierCard({ supplier, onGoToCatalog }: HomeSupplierCardProps) {
  const color    = supplierColor(supplier.id);
  const initials = supplierInitials(supplier.nombre);
  const logoSrc  = getLocalLogo(supplier);

  return (
    <button
      onClick={() => onGoToCatalog(undefined, undefined, supplier.nombre)}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group shrink-0 w-28 min-h-[44px]"
    >
      {logoSrc ? (
        <img src={logoSrc} alt={supplier.nombre} loading="lazy" className="w-12 h-12 rounded-xl object-contain" />
      ) : (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
          style={{ background: color }}
        >
          {initials}
        </div>
      )}
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{supplier.nombre}</p>
        {supplier.verificado && (
          <span className="text-[9px] font-bold text-[#1A5A96] uppercase tracking-wide">Verificado</span>
        )}
      </div>
    </button>
  );
}

interface HomeSuppliersProps {
  suppliers:     ActiveSupplier[];
  loading:       boolean;
  onGoToCatalog: (oficio?: string | null, search?: string, actor?: string) => void;
}

function HomeSuppliers({ suppliers, loading, onGoToCatalog }: HomeSuppliersProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Distribuidores</h3>
        <button onClick={() => onGoToCatalog()} className="text-xs text-[#1A5A96] font-semibold hover:underline">
          Ver todos →
        </button>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-28 h-[104px] bg-gray-100 rounded-2xl animate-pulse shrink-0" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
          <Store className="w-4 h-4" />
          <span>Próximamente nuevos distribuidores</span>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {suppliers.map(s => (
            <HomeSupplierCard key={s.id} supplier={s} onGoToCatalog={onGoToCatalog} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slots del Home (constante de módulo — estable, sin re-creación) ────────────
// 15 slots = 6 laterales + 3 hero comerciales + 2 mobile + 4 promo cards.
// MARKET_CATALOG_HERO se gestiona en DesktopMarketplaceLayout / MobileMarketplaceLayout.

const HOME_SLOT_IDS: readonly AdSlotId[] = [
  'MARKET_HOME_LEFT_TOP',    'MARKET_HOME_LEFT_MID',    'MARKET_HOME_LEFT_BOTTOM',
  'MARKET_HOME_RIGHT_TOP',   'MARKET_HOME_RIGHT_MID',   'MARKET_HOME_RIGHT_BOTTOM',
  'MARKET_HOME_HERO_1',      'MARKET_HOME_HERO_2',      'MARKET_HOME_HERO_3',
  'MARKET_HOME_MOBILE_PROMO_1', 'MARKET_HOME_MOBILE_PROMO_2',
  'MARKET_HOME_PROMO_CARD_1', 'MARKET_HOME_PROMO_CARD_2',
  'MARKET_HOME_PROMO_CARD_3', 'MARKET_HOME_PROMO_CARD_4',
];

// ── Componente principal ───────────────────────────────────────────────────────

interface MarketplaceHomeProps {
  onGoToCatalog:    (oficio?: string | null, search?: string, actor?: string) => void;
  onGoHome:         () => void;
  cartCount:        number;
  onOpenCart:       () => void;
  location:         MarketplaceLocation | null;
  onChangeLocation: () => void;
  onMisPedidos?:    () => void;
}

export default function MarketplaceHome({
  onGoToCatalog,
  onGoHome,
  cartCount,
  onOpenCart,
  location,
  onChangeLocation,
  onMisPedidos,
}: MarketplaceHomeProps) {
  const [suppliers,   setSuppliers]   = useState<ActiveSupplier[]>([]);
  const [suppLoading, setSuppLoading] = useState(true);

  useEffect(() => {
    listActiveSuppliers(12)
      .then(setSuppliers)
      .catch(() => {})
      .finally(() => setSuppLoading(false));
  }, []);

  const handleSearch = useCallback((q: string) => {
    onGoToCatalog(null, q);
  }, [onGoToCatalog]);

  // 1 llamada bulk para los 15 slots del Home — sin N+1
  const { getCampaign } = useAdCampaigns(HOME_SLOT_IDS);

  // Navegación central — delega a resolveCampaignDestination para un único punto de dispatch
  function handleAdNavigate(type: AdDestinationType, value?: string) {
    resolveCampaignDestination(type, value, onGoToCatalog);
  }

  // ── Hero slides — slide 0 institucional (hardcoded), slides 1-3 de BD o demo ──
  const heroSlides = [
    DEMO_HERO_SLIDES[0], // TrabFlow institucional, nunca comercializable
    ...((['MARKET_HOME_HERO_1', 'MARKET_HOME_HERO_2', 'MARKET_HOME_HERO_3'] as const).map(
      (slotId, i) => {
        const bd = getCampaign(slotId);
        return bd ? adCampaignToHeroSlide(bd) : (DEMO_HERO_SLIDES[i + 1] ?? DEMO_HERO_SLIDES[1]);
      }
    )),
  ];

  // ── PromoCards — BD si disponible, demo como fallback ─────────────────────────
  const promoCards = (
    ['MARKET_HOME_PROMO_CARD_1', 'MARKET_HOME_PROMO_CARD_2',
     'MARKET_HOME_PROMO_CARD_3', 'MARKET_HOME_PROMO_CARD_4'] as const
  ).map((slotId, i) => {
    const bd = getCampaign(slotId);
    return bd ? adCampaignToPromoCard(bd, i) : (DEMO_PROMO_CARDS[i] ?? DEMO_PROMO_CARDS[0]);
  });

  // ── Mobile promos — BD si disponible, demo como fallback ─────────────────────
  const mobileCampaigns = (
    ['MARKET_HOME_MOBILE_PROMO_1', 'MARKET_HOME_MOBILE_PROMO_2'] as const
  ).map((slotId, i) => getCampaign(slotId) ?? (DEMO_MOBILE_CAMPAIGNS[i] ?? DEMO_MOBILE_CAMPAIGNS[0]));

  // ── Slots laterales — BD si disponible, demo como fallback ───────────────────
  const leftTop     = getCampaign('MARKET_HOME_LEFT_TOP')     ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_LEFT_TOP');
  const leftMid     = getCampaign('MARKET_HOME_LEFT_MID')     ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_LEFT_MID');
  const leftBottom  = getCampaign('MARKET_HOME_LEFT_BOTTOM')  ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_LEFT_BOTTOM');
  const rightTop    = getCampaign('MARKET_HOME_RIGHT_TOP')    ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_RIGHT_TOP');
  const rightMid    = getCampaign('MARKET_HOME_RIGHT_MID')    ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_RIGHT_MID');
  const rightBottom = getCampaign('MARKET_HOME_RIGHT_BOTTOM') ?? DEMO_LATERAL_CAMPAIGNS.find(c => c.slotId === 'MARKET_HOME_RIGHT_BOTTOM');

  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-gray-50">

      {/* ── TopNav + Buscador + Ubicación — solo Desktop ─────────────────── */}
      <div className="hidden lg:block">
        <MarketplaceTopNav
          activeTab="inicio"
          onGoHome={onGoHome}
          onGoToCatalog={oficio => onGoToCatalog(oficio ?? null)}
          onMisPedidos={onMisPedidos}
          centerSlot={<HomeSearchBar onSearch={handleSearch} compact />}
          rightSlot={<HomeLocationRow location={location} onChangeLocation={onChangeLocation} />}
        />
      </div>

      {/* ── Desktop (lg+) — 3 columnas ────────────────────────────────────── */}
      <div className="hidden lg:block">
        {/* Layout 3 columnas — flush al borde izquierdo */}
        <div className="w-full px-2 pb-8 pt-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: '192px 1fr 192px' }}>

            {/* Columna izquierda — 3 slots publicitarios */}
            <div className="space-y-3 pt-1">
              <MarketplaceAdSlot campaign={leftTop}    onNavigate={handleAdNavigate} />
              <MarketplaceAdSlot campaign={leftMid}    onNavigate={handleAdNavigate} />
              <MarketplaceAdSlot campaign={leftBottom} onNavigate={handleAdNavigate} />
            </div>

            {/* Columna central — contenido editorial */}
            <div className="space-y-5">
              <MarketplaceHeroCarousel
                slides={heroSlides}
                onGoToCatalog={onGoToCatalog}
              />

              <MarketplacePromotedSuppliers
                cards={promoCards}
                onNavigate={handleAdNavigate}
                onViewAll={() => onGoToCatalog()}
              />

              <MarketplaceBenefitsBar />

              <HomeSuppliers
                suppliers={suppliers}
                loading={suppLoading}
                onGoToCatalog={onGoToCatalog}
              />

              <div className="pt-2 pb-4 text-center">
                <button
                  onClick={() => onGoToCatalog()}
                  className="inline-flex items-center gap-2.5 bg-[#1A5A96] text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-[#154d82] transition-colors shadow-sm"
                >
                  <Package className="w-5 h-5" />
                  Ver todo el catálogo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Columna derecha — 3 slots publicitarios */}
            <div className="space-y-3 pt-1">
              <MarketplaceAdSlot campaign={rightTop}    onNavigate={handleAdNavigate} />
              <MarketplaceAdSlot campaign={rightMid}    onNavigate={handleAdNavigate} />
              <MarketplaceAdSlot campaign={rightBottom} onNavigate={handleAdNavigate} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile (< lg) ─────────────────────────────────────────────────── */}
      <div className="lg:hidden px-4 py-4 space-y-5 pb-24">
        <HomeSearchBar onSearch={handleSearch} />

        <HomeLocationRow location={location} onChangeLocation={onChangeLocation} />

        <MarketplaceHeroCarousel
          slides={heroSlides}
          onGoToCatalog={onGoToCatalog}
        />

        <HomeCategoryScroll onGoToCatalog={onGoToCatalog} />

        {/* Slots promocionales mobile — reemplazan los 4 laterales desktop */}
        <MarketplaceMobilePromos
          campaigns={mobileCampaigns}
          onNavigate={handleAdNavigate}
        />

        <MarketplacePromotedSuppliers
          cards={promoCards}
          onNavigate={handleAdNavigate}
          onViewAll={() => onGoToCatalog()}
        />

        <HomeSuppliers
          suppliers={suppliers}
          loading={suppLoading}
          onGoToCatalog={onGoToCatalog}
        />

        <div className="text-center">
          <button
            onClick={() => onGoToCatalog()}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1A5A96] text-white font-bold px-6 py-3.5 rounded-2xl hover:bg-[#154d82] transition-colors"
          >
            <Package className="w-4 h-4" />
            Ver todo el catálogo
          </button>
        </div>
      </div>

      {/* FAB carrito — mobile con artículos */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="lg:hidden fixed bottom-6 right-4 z-30 flex items-center gap-2 bg-[#1A5A96] text-white px-4 py-3 rounded-2xl shadow-lg font-semibold text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}
        </button>
      )}
    </div>
  );
}
