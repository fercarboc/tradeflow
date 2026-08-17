// ═══════════════════════════════════════════════════════════════
// AdPlacementMap.tsx
// Mapa visual de espacios publicitarios — E4.B.1
// mode='admin'            → uso actual Admin > Espacios
// mode='supplier-preview' → preparado para E4.C Portal Proveedor
//
// INVARIANTE: publicidad ≠ ranking.
// No modifica: checkout, pricing, ranking, UI pública Marketplace.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  Monitor, Smartphone, BookOpen, MousePointer2, Building2, Info,
} from 'lucide-react';

// ─── TIPOS LOCALES ───────────────────────────────────────────────────────────
// Compatibles estructuralmente con los tipos de AdminMarketplaceAdsSection.tsx.
// TypeScript structural typing: pass AdSlot[], AdCampaignAdmin[], AdBookingAdmin[]
// directamente — no se requiere cast.

type SlotFormato = 'banner_vertical' | 'carousel_slide' | 'mobile_promo' | 'catalog_banner' | 'promo_card';

export interface PlacementSlot {
  id: string; nombre: string; descripcion: string | null;
  pagina: 'home' | 'catalog';
  dispositivo: 'desktop' | 'mobile' | 'both';
  formato: SlotFormato;
  ancho_px: number | null; alto_min_px: number | null; aspect_ratio: string | null;
  activo: boolean; comercializable: boolean; posicion: number;
  fallback_campaign_id: string | null;
}

export interface PlacementCampaign {
  id: string; slot_id: string; actor_id: string | null;
  campaign_source: 'demo' | 'trabflow' | 'supplier';
  estado: string; nombre: string; advertiser_name: string;
  activa: boolean; start_at: string | null; end_at: string | null;
  image_url: string | null;
  accent: string | null; bg: string | null; text_color: string | null;
  title: string;
}

export interface PlacementBooking {
  id: string; slot_id: string; actor_id: string;
  estado: 'REQUESTED' | 'CONTACTING' | 'ACCEPTED' | 'REJECTED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  inicio: string; fin: string;
}

export type SlotMapStatus = 'LIBRE' | 'RESERVADO' | 'OCUPADO' | 'TU_CAMPANA' | 'INACTIVO';
type MapView = 'desktop' | 'mobile' | 'catalog';

// ─── SPEC COMERCIAL (Fase 0 — sin tarifas definitivas) ───────────────────────
// No hardcodear precios. Modelo comercial pendiente de definición.

export type AdCommercialSpec = {
  minDurationDays: number | null;
  pricingModel: 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM' | null;
  basePrice: number | null;
  currency: 'EUR';
  priceLabel: string;
};

const COMMERCIAL_PHASE0: AdCommercialSpec = {
  minDurationDays: null,
  pricingModel:    null,
  basePrice:       null,
  currency:        'EUR',
  priceLabel:      'Consultar TrabFlow',
};

// ─── NOMBRES AMIGABLES Y SPECS ───────────────────────────────────────────────

const SLOT_NAMES: Record<string, string> = {
  MARKET_HOME_HERO_1:         'Hero Slide 1',
  MARKET_HOME_HERO_2:         'Hero Slide 2',
  MARKET_HOME_HERO_3:         'Hero Slide 3',
  MARKET_HOME_LEFT_TOP:       'Lateral izq. superior',
  MARKET_HOME_LEFT_MID:       'Lateral izq. medio',
  MARKET_HOME_LEFT_BOTTOM:    'Lateral izq. inferior',
  MARKET_HOME_RIGHT_TOP:      'Lateral der. superior',
  MARKET_HOME_RIGHT_MID:      'Lateral der. medio',
  MARKET_HOME_RIGHT_BOTTOM:   'Lateral der. inferior',
  MARKET_HOME_PROMO_CARD_1:   'Promo Destacada 1',
  MARKET_HOME_PROMO_CARD_2:   'Promo Destacada 2',
  MARKET_HOME_PROMO_CARD_3:   'Promo Destacada 3',
  MARKET_HOME_PROMO_CARD_4:   'Promo Destacada 4',
  MARKET_HOME_MOBILE_PROMO_1: 'Promo Mobile 1',
  MARKET_HOME_MOBILE_PROMO_2: 'Promo Mobile 2',
  MARKET_CATALOG_HERO:        'Banner Catálogo',
};

// Mismos valores que getAdSlotCreativeSpec() en E4.B.
// Redeclarado aquí para aislar el módulo de importaciones circulares.
// Si se extrae a lib compartida, importar desde ahí.

type PlacementSpec = { label: string; device: string; recW: number; recH: number; ratio: string };

function getPlacementSpec(formato: SlotFormato): PlacementSpec {
  switch (formato) {
    case 'banner_vertical': return { label: 'Banner vertical', device: 'Desktop', recW: 400,  recH: 600, ratio: '2:3'  };
    case 'carousel_slide':  return { label: 'Hero slide',      device: 'Ambos',   recW: 1600, recH: 400, ratio: '4:1'  };
    case 'mobile_promo':    return { label: 'Promo mobile',    device: 'Mobile',  recW: 800,  recH: 200, ratio: '4:1'  };
    case 'promo_card':      return { label: 'Promo card',      device: 'Ambos',   recW: 600,  recH: 500, ratio: '6:5'  };
    case 'catalog_banner':  return { label: 'Banner catálogo', device: 'Ambos',   recW: 1600, recH: 240, ratio: '20:3' };
  }
}

// ─── ESTADOS VISUALES ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SlotMapStatus, {
  label: string; border: string; bg: string;
  dot: string; pillBg: string; pillText: string; text: string;
}> = {
  LIBRE:      { label: 'Libre',      border: 'border-emerald-700/50', bg: 'bg-emerald-950/30', dot: 'bg-emerald-400', pillBg: 'bg-emerald-800',  pillText: 'text-emerald-100', text: 'text-emerald-300' },
  RESERVADO:  { label: 'Reservado',  border: 'border-amber-700/50',   bg: 'bg-amber-950/30',   dot: 'bg-amber-400',   pillBg: 'bg-amber-800',    pillText: 'text-amber-100',   text: 'text-amber-300'   },
  OCUPADO:    { label: 'Ocupado',    border: 'border-rose-700/60',    bg: 'bg-rose-950/30',    dot: 'bg-rose-400',    pillBg: 'bg-rose-800',     pillText: 'text-rose-100',    text: 'text-rose-300'    },
  TU_CAMPANA: { label: 'Tu campaña', border: 'border-blue-600/70',    bg: 'bg-blue-950/30',    dot: 'bg-blue-400',    pillBg: 'bg-blue-700',     pillText: 'text-blue-100',    text: 'text-blue-300'    },
  INACTIVO:   { label: 'Inactivo',   border: 'border-slate-700/40',   bg: 'bg-slate-900/20',   dot: 'bg-slate-600',   pillBg: 'bg-slate-800',    pillText: 'text-slate-400',   text: 'text-slate-500'   },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function calcSlotStatus(
  slot: PlacementSlot,
  campaigns: PlacementCampaign[],
  bookings: PlacementBooking[],
  actorId?: string,
): SlotMapStatus {
  if (!slot.activo) return 'INACTIVO';
  const today = new Date().toISOString().slice(0, 10);

  if (actorId) {
    const mine = campaigns.find(c =>
      c.slot_id === slot.id && c.activa && c.actor_id === actorId && c.estado === 'ACTIVE'
    );
    if (mine) return 'TU_CAMPANA';
  }

  const commercial = campaigns.find(c =>
    c.slot_id === slot.id &&
    c.activa &&
    c.estado === 'ACTIVE' &&
    c.campaign_source !== 'trabflow' &&
    c.id !== slot.fallback_campaign_id
  );
  if (commercial) return 'OCUPADO';

  const booked = bookings.find(b =>
    b.slot_id === slot.id &&
    (b.estado === 'RESERVED' || b.estado === 'CONFIRMED') &&
    b.inicio <= today && b.fin >= today
  );
  if (booked) return 'RESERVADO';

  return 'LIBRE';
}

function getCommercialCampaign(slot: PlacementSlot, campaigns: PlacementCampaign[]): PlacementCampaign | null {
  return campaigns.find(c =>
    c.slot_id === slot.id &&
    c.activa &&
    c.campaign_source !== 'trabflow' &&
    c.id !== slot.fallback_campaign_id
  ) ?? null;
}

function getActiveBooking(slot: PlacementSlot, bookings: PlacementBooking[]): PlacementBooking | null {
  const today = new Date().toISOString().slice(0, 10);
  return bookings.find(b =>
    b.slot_id === slot.id &&
    (b.estado === 'RESERVED' || b.estado === 'CONFIRMED') &&
    b.inicio <= today && b.fin >= today
  ) ?? null;
}

function getNextBooking(slot: PlacementSlot, bookings: PlacementBooking[]): PlacementBooking | null {
  const today = new Date().toISOString().slice(0, 10);
  const future = bookings
    .filter(b =>
      b.slot_id === slot.id &&
      (b.estado === 'RESERVED' || b.estado === 'CONFIRMED') &&
      b.inicio > today
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return future[0] ?? null;
}

function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function slotById(id: string, slots: PlacementSlot[]): PlacementSlot | undefined {
  return slots.find(s => s.id === id);
}

// ─── SUB-COMPONENTES (todos top-level) ───────────────────────────────────────

function SlotStatusPill({ status }: { status: SlotMapStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`text-[7px] font-black px-1 py-0.5 rounded-full leading-none ${cfg.pillBg} ${cfg.pillText}`}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

function MapSlotButton({
  slot, campaigns, bookings, isSelected, isHovered,
  onSelect, onHover, actorId, className,
}: {
  slot: PlacementSlot;
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (slot: PlacementSlot) => void;
  onHover: (slot: PlacementSlot | null) => void;
  actorId?: string;
  className?: string;
}) {
  const status    = calcSlotStatus(slot, campaigns, bookings, actorId);
  const cfg       = STATUS_CONFIG[status];
  const camp      = getCommercialCampaign(slot, campaigns);
  const name      = SLOT_NAMES[slot.id] ?? slot.nombre;
  const isFallback = !camp;

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      onMouseEnter={() => onHover(slot)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(slot)}
      onBlur={() => onHover(null)}
      aria-label={`${name}, ${cfg.label}`}
      aria-pressed={isSelected}
      className={`relative border rounded-lg overflow-hidden transition-all duration-150 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${cfg.border} ${cfg.bg} ${
        isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900 brightness-110' :
        isHovered  ? 'brightness-125 scale-[1.01]' : ''
      } ${className ?? ''}`}
    >
      {camp?.image_url && (
        <img
          src={camp.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {isFallback && slot.fallback_campaign_id && (
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)' }}
        />
      )}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-1.5 gap-0.5">
        <div className="flex justify-end">
          <SlotStatusPill status={status} />
        </div>
        <div className="overflow-hidden">
          {isFallback && (
            <div className="text-[7px] font-bold text-blue-300/60 leading-none mb-0.5">TW</div>
          )}
          {camp && !camp.image_url && (
            <div className="text-[7px] text-white/70 truncate leading-none">{camp.advertiser_name}</div>
          )}
          <div className="text-[8px] font-bold text-white/90 truncate leading-tight">{name}</div>
        </div>
      </div>
    </button>
  );
}

function HeroSlotGroup({
  heroSlots, campaigns, bookings, selectedSlotId, hoveredSlotId,
  onSelect, onHover, actorId,
}: {
  heroSlots: PlacementSlot[];
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  selectedSlotId?: string | null;
  hoveredSlotId?: string | null;
  onSelect: (slot: PlacementSlot) => void;
  onHover: (slot: PlacementSlot | null) => void;
  actorId?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0); // 0 = institucional, 1-3 = commercial

  const currentSlot = activeIdx === 0 ? null : heroSlots[activeIdx - 1];

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Slide selector */}
      <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1.5 border-b border-slate-800 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveIdx(0)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-colors ${
            activeIdx === 0 ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Building2 className="h-2.5 w-2.5" />
          0 · TrabFlow
        </button>
        {heroSlots.map((slot, i) => {
          const status = calcSlotStatus(slot, campaigns, bookings, actorId);
          const cfg = STATUS_CONFIG[status];
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setActiveIdx(i + 1)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                activeIdx === i + 1 ? 'bg-blue-700 text-white' : `bg-slate-800 hover:bg-slate-700 ${cfg.text}`
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Slide content */}
      <div className="h-[96px] relative">
        {currentSlot === null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-r from-blue-950 to-indigo-950">
            <Building2 className="h-5 w-5 text-blue-400 mb-1" />
            <p className="text-[9px] font-bold text-blue-300">Slide institucional TrabFlow</p>
            <p className="text-[8px] text-slate-500">No comercializable</p>
          </div>
        ) : (
          <MapSlotButton
            slot={currentSlot}
            campaigns={campaigns}
            bookings={bookings}
            isSelected={selectedSlotId === currentSlot.id}
            isHovered={hoveredSlotId === currentSlot.id}
            onSelect={onSelect}
            onHover={onHover}
            actorId={actorId}
            className="absolute inset-0 rounded-none border-0"
          />
        )}
      </div>
    </div>
  );
}

function InfoPanel({
  slot, campaigns, bookings, mode, onSelectSlot, onCreateCampaign,
}: {
  slot: PlacementSlot | null;
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  mode: 'admin' | 'supplier-preview';
  onSelectSlot?: (slot: PlacementSlot) => void;
  onCreateCampaign?: (slotId: string) => void;
}) {
  if (!slot) {
    return (
      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
        <MousePointer2 className="h-5 w-5 text-slate-600 mb-2" />
        <p className="text-[10px] text-slate-500 max-w-[140px] leading-relaxed">
          Pasa el ratón o pulsa un espacio para ver formato, medidas y disponibilidad.
        </p>
      </div>
    );
  }

  const status = calcSlotStatus(slot, campaigns, bookings);
  const cfg    = STATUS_CONFIG[status];
  const spec   = getPlacementSpec(slot.formato);
  const camp   = getCommercialCampaign(slot, campaigns);
  const book   = getActiveBooking(slot, bookings);
  const next   = getNextBooking(slot, bookings);
  const name   = SLOT_NAMES[slot.id] ?? slot.nombre;

  return (
    <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4 space-y-3 min-h-[200px] overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-white text-sm leading-snug">{name}</h3>
          <SlotStatusPill status={status} />
        </div>
        <p className="text-[8px] text-slate-600 font-mono">{slot.id}</p>
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <div>
          <div className="text-[8px] uppercase font-bold tracking-wider text-slate-600 mb-0.5">Formato</div>
          <div className="text-[10px] text-slate-300">{spec.label}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase font-bold tracking-wider text-slate-600 mb-0.5">Dispositivo</div>
          <div className="text-[10px] text-slate-300">{spec.device}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase font-bold tracking-wider text-slate-600 mb-0.5">Imagen rec.</div>
          <div className="text-[10px] text-slate-300">{spec.recW} × {spec.recH} px</div>
        </div>
        <div>
          <div className="text-[8px] uppercase font-bold tracking-wider text-slate-600 mb-0.5">Ratio</div>
          <div className="text-[10px] text-slate-300">{spec.ratio}</div>
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-0.5">
        {status === 'LIBRE' && (
          <>
            <div className={`text-[10px] font-semibold ${cfg.text}`}>Disponible ahora</div>
            {next && (
              <div className="text-[9px] text-slate-500">
                Próxima reserva: {fmtDateShort(next.inicio)} → {fmtDateShort(next.fin)}
              </div>
            )}
          </>
        )}
        {status === 'RESERVADO' && book && (
          <div className={`text-[10px] font-semibold ${cfg.text}`}>
            Reservado: {fmtDateShort(book.inicio)} → {fmtDateShort(book.fin)}
          </div>
        )}
        {(status === 'OCUPADO' || status === 'TU_CAMPANA') && camp && (
          <>
            <div className={`text-[10px] font-semibold ${cfg.text}`}>
              {status === 'TU_CAMPANA' ? 'Tu campaña activa' : 'Ocupado'}
            </div>
            {mode === 'admin' && (
              <div className="text-[9px] text-slate-400">
                {camp.advertiser_name}
                {camp.end_at && ` · hasta ${fmtDateShort(camp.end_at)}`}
              </div>
            )}
          </>
        )}
        {status === 'INACTIVO' && (
          <div className="text-[9px] text-slate-500">Espacio desactivado</div>
        )}
      </div>

      {/* Tarifa */}
      <div className="pt-1 border-t border-slate-800">
        <div className="text-[8px] uppercase font-bold tracking-wider text-slate-600 mb-0.5">Tarifa</div>
        <div className="text-[10px] text-slate-400">{COMMERCIAL_PHASE0.priceLabel}</div>
        <div className="text-[9px] text-slate-600 mt-0.5">Periodo mínimo: por definir</div>
      </div>

      {/* Acciones */}
      <div className="space-y-1.5 pt-0.5">
        {onSelectSlot && (
          <button
            type="button"
            onClick={() => onSelectSlot(slot)}
            className="w-full py-1.5 rounded-lg border border-blue-700 text-blue-300 text-[10px] font-bold cursor-pointer hover:bg-blue-900/30 transition-colors"
          >
            Ver detalle completo
          </button>
        )}
        {mode === 'admin' && status === 'LIBRE' && onCreateCampaign && (
          <button
            type="button"
            onClick={() => onCreateCampaign(slot.id)}
            className="w-full py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold cursor-pointer transition-colors"
          >
            Crear campaña
          </button>
        )}
      </div>
    </div>
  );
}

function MapLegend() {
  const items: { status: SlotMapStatus }[] = [
    { status: 'LIBRE' },
    { status: 'RESERVADO' },
    { status: 'OCUPADO' },
    { status: 'TU_CAMPANA' },
    { status: 'INACTIVO' },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map(({ status }) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-[9px] text-slate-400">{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── VISTAS ──────────────────────────────────────────────────────────────────

function DesktopMapView({
  slots, campaigns, bookings, selectedSlotId, hoveredSlotId,
  onSelect, onHover, actorId,
}: {
  slots: PlacementSlot[];
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  selectedSlotId?: string | null;
  hoveredSlotId?: string | null;
  onSelect: (s: PlacementSlot) => void;
  onHover: (s: PlacementSlot | null) => void;
  actorId?: string;
}) {
  const ls = (id: string) => slotById(id, slots);

  const LEFT_IDS  = ['MARKET_HOME_LEFT_TOP',    'MARKET_HOME_LEFT_MID',    'MARKET_HOME_LEFT_BOTTOM'  ];
  const RIGHT_IDS = ['MARKET_HOME_RIGHT_TOP',   'MARKET_HOME_RIGHT_MID',   'MARKET_HOME_RIGHT_BOTTOM' ];
  const HERO_IDS  = ['MARKET_HOME_HERO_1',       'MARKET_HOME_HERO_2',      'MARKET_HOME_HERO_3'      ];
  const PROMO_IDS = ['MARKET_HOME_PROMO_CARD_1', 'MARKET_HOME_PROMO_CARD_2','MARKET_HOME_PROMO_CARD_3','MARKET_HOME_PROMO_CARD_4'];

  const heroSlots  = HERO_IDS.map(id => ls(id)).filter(Boolean) as PlacementSlot[];
  const promoSlots = PROMO_IDS.map(id => ls(id)).filter(Boolean) as PlacementSlot[];

  function SideSlot({ id }: { id: string }) {
    const slot = ls(id);
    if (!slot) return (
      <div className="h-[92px] bg-slate-900/20 rounded-lg border border-dashed border-slate-800 flex items-center justify-center">
        <span className="text-[7px] text-slate-700">Sin datos</span>
      </div>
    );
    return (
      <MapSlotButton
        slot={slot}
        campaigns={campaigns}
        bookings={bookings}
        isSelected={selectedSlotId === id}
        isHovered={hoveredSlotId === id}
        onSelect={onSelect}
        onHover={onHover}
        actorId={actorId}
        className="h-[92px]"
      />
    );
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '110px 1fr 110px' }}>
      {/* LEFT column */}
      <div className="flex flex-col gap-2">
        {LEFT_IDS.map(id => <SideSlot key={id} id={id} />)}
      </div>

      {/* CENTER column */}
      <div className="flex flex-col gap-2">
        {/* Hero carrusel */}
        <HeroSlotGroup
          heroSlots={heroSlots}
          campaigns={campaigns}
          bookings={bookings}
          selectedSlotId={selectedSlotId}
          hoveredSlotId={hoveredSlotId}
          onSelect={onSelect}
          onHover={onHover}
          actorId={actorId}
        />
        {/* Placeholder productos */}
        <div className="h-9 bg-slate-900/30 border border-dashed border-slate-800/60 rounded-lg flex items-center justify-center gap-1.5 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-7 h-5 bg-slate-800 rounded border border-slate-700/60 shrink-0" />
          ))}
          <span className="text-[7px] text-slate-700 ml-0.5">···</span>
        </div>
        {/* PromoCards */}
        <div className="grid grid-cols-4 gap-2">
          {promoSlots.map(slot => (
            <MapSlotButton
              key={slot.id}
              slot={slot}
              campaigns={campaigns}
              bookings={bookings}
              isSelected={selectedSlotId === slot.id}
              isHovered={hoveredSlotId === slot.id}
              onSelect={onSelect}
              onHover={onHover}
              actorId={actorId}
              className="h-[76px]"
            />
          ))}
        </div>
      </div>

      {/* RIGHT column */}
      <div className="flex flex-col gap-2">
        {RIGHT_IDS.map(id => <SideSlot key={id} id={id} />)}
      </div>
    </div>
  );
}

function MobileMapView({
  slots, campaigns, bookings, selectedSlotId, hoveredSlotId,
  onSelect, onHover, actorId,
}: {
  slots: PlacementSlot[];
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  selectedSlotId?: string | null;
  hoveredSlotId?: string | null;
  onSelect: (s: PlacementSlot) => void;
  onHover: (s: PlacementSlot | null) => void;
  actorId?: string;
}) {
  const HERO_IDS   = ['MARKET_HOME_HERO_1', 'MARKET_HOME_HERO_2', 'MARKET_HOME_HERO_3'];
  const MOBILE_IDS = ['MARKET_HOME_MOBILE_PROMO_1', 'MARKET_HOME_MOBILE_PROMO_2'];

  const heroSlots   = HERO_IDS.map(id => slotById(id, slots)).filter(Boolean) as PlacementSlot[];
  const mobileSlots = MOBILE_IDS.map(id => slotById(id, slots)).filter(Boolean) as PlacementSlot[];

  return (
    <div className="flex justify-center">
      <div className="w-64 border border-slate-700 rounded-2xl overflow-hidden bg-slate-950">
        {/* Phone notch */}
        <div className="h-2.5 bg-slate-900 flex items-center justify-center">
          <div className="w-10 h-1 bg-slate-800 rounded-full" />
        </div>
        <div className="space-y-2 p-2">
          <HeroSlotGroup
            heroSlots={heroSlots}
            campaigns={campaigns}
            bookings={bookings}
            selectedSlotId={selectedSlotId}
            hoveredSlotId={hoveredSlotId}
            onSelect={onSelect}
            onHover={onHover}
            actorId={actorId}
          />
          {/* Category chips placeholder */}
          <div className="flex gap-1 overflow-hidden">
            {['Herramienta', 'Material', 'Consumible'].map(c => (
              <div key={c} className="px-2 py-1 bg-slate-800 rounded-full text-[7px] text-slate-600 whitespace-nowrap border border-slate-700/60">{c}</div>
            ))}
          </div>
          {/* Mobile promo slots */}
          {mobileSlots.map(slot => (
            <MapSlotButton
              key={slot.id}
              slot={slot}
              campaigns={campaigns}
              bookings={bookings}
              isSelected={selectedSlotId === slot.id}
              isHovered={hoveredSlotId === slot.id}
              onSelect={onSelect}
              onHover={onHover}
              actorId={actorId}
              className="w-full h-12"
            />
          ))}
          {/* Ghost products */}
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-800 rounded-lg border border-slate-700/40 flex flex-col items-center justify-center gap-1">
                <div className="w-6 h-6 bg-slate-700 rounded" />
                <div className="h-1 w-10 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogMapView({
  slots, campaigns, bookings, selectedSlotId, hoveredSlotId,
  onSelect, onHover, actorId,
}: {
  slots: PlacementSlot[];
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  selectedSlotId?: string | null;
  hoveredSlotId?: string | null;
  onSelect: (s: PlacementSlot) => void;
  onHover: (s: PlacementSlot | null) => void;
  actorId?: string;
}) {
  const catalogSlot = slotById('MARKET_CATALOG_HERO', slots);

  return (
    <div className="space-y-3 max-w-xl">
      <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-900/10 border border-amber-800/30 rounded-lg px-3 py-2">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Visible únicamente en compra libre. El instalador comprando desde un presupuesto no ve este anuncio.
      </div>

      {catalogSlot ? (
        <div>
          <div className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Banner catálogo</div>
          <MapSlotButton
            slot={catalogSlot}
            campaigns={campaigns}
            bookings={bookings}
            isSelected={selectedSlotId === catalogSlot.id}
            isHovered={hoveredSlotId === catalogSlot.id}
            onSelect={onSelect}
            onHover={onHover}
            actorId={actorId}
            className="w-full h-14"
          />
        </div>
      ) : (
        <div className="h-14 bg-slate-900/30 rounded-lg border border-dashed border-slate-700 flex items-center justify-center">
          <span className="text-[9px] text-slate-600">MARKET_CATALOG_HERO no encontrado</span>
        </div>
      )}

      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 space-y-2">
        {/* Filters bar */}
        <div className="flex gap-2 items-center">
          {[28, 20, 16].map(w => (
            <div key={w} className={`h-6 w-${w} bg-slate-800 rounded border border-slate-700/60`} />
          ))}
          <span className="text-[8px] text-slate-700">Filtros del catálogo</span>
        </div>
        {/* Product grid */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700/40 rounded-lg h-16 flex flex-col items-center justify-center gap-1">
              <div className="w-7 h-7 bg-slate-700 rounded" />
              <div className="h-1 w-10 bg-slate-700 rounded" />
              <div className="h-1 w-6 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export interface AdPlacementMapProps {
  slots: PlacementSlot[];
  campaigns: PlacementCampaign[];
  bookings: PlacementBooking[];
  selectedSlotId?: string | null;
  onSelectSlot?: (slot: PlacementSlot) => void;
  mode: 'admin' | 'supplier-preview';
  actorId?: string;
  onCreateCampaign?: (slotId: string) => void;
}

export default function AdPlacementMap({
  slots, campaigns, bookings, selectedSlotId, onSelectSlot,
  mode, actorId, onCreateCampaign,
}: AdPlacementMapProps) {
  const [view, setView]           = useState<MapView>('desktop');
  const [hoveredSlot, setHoveredSlot] = useState<PlacementSlot | null>(null);
  const [infoSlot, setInfoSlot]   = useState<PlacementSlot | null>(null);

  const handleSelect = (slot: PlacementSlot) => {
    setInfoSlot(slot);
    onSelectSlot?.(slot);
  };

  const handleHover = (slot: PlacementSlot | null) => {
    setHoveredSlot(slot);
    if (slot) setInfoSlot(slot);
  };

  const displaySlot = hoveredSlot ?? infoSlot;

  const VIEWS: { id: MapView; label: string; Icon: React.ElementType }[] = [
    { id: 'desktop', label: 'Desktop',  Icon: Monitor    },
    { id: 'mobile',  label: 'Mobile',   Icon: Smartphone },
    { id: 'catalog', label: 'Catálogo', Icon: BookOpen   },
  ];

  const mapProps = {
    slots, campaigns, bookings, actorId,
    selectedSlotId: selectedSlotId ?? infoSlot?.id,
    hoveredSlotId:  hoveredSlot?.id,
    onSelect:       handleSelect,
    onHover:        handleHover,
  };

  return (
    <div className="space-y-3">
      {/* View selector + legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                view === id
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <MapLegend />
      </div>

      {/* Map + info panel */}
      <div className="flex gap-3 items-start">
        {/* Map area */}
        <div className="flex-1 min-w-0">
          {view === 'desktop' && <DesktopMapView {...mapProps} />}
          {view === 'mobile'  && <MobileMapView  {...mapProps} />}
          {view === 'catalog' && <CatalogMapView {...mapProps} />}
        </div>

        {/* Info panel — 220px, aparece en hover o click */}
        <div className="w-[210px] shrink-0">
          <InfoPanel
            slot={displaySlot}
            campaigns={campaigns}
            bookings={bookings}
            mode={mode}
            onSelectSlot={onSelectSlot}
            onCreateCampaign={onCreateCampaign}
          />
        </div>
      </div>

      {/* Help text */}
      <p className="text-[9px] text-slate-600 text-center">
        Pasa el ratón o pulsa un espacio para ver formato, medidas y disponibilidad.
      </p>
    </div>
  );
}
