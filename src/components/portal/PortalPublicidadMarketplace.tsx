// ═══════════════════════════════════════════════════════════════
// PortalPublicidadMarketplace.tsx
// Portal Proveedor → Marketing → Publicidad Marketplace (E4.C.1)
//
// Vista de solo lectura: disponibilidad de espacios publicitarios.
// Usa AdPlacementMap mode='supplier-preview'.
//
// Privacidad:
//   - Slots con campaña activa de tercero → OCUPADO (sin identidad del anunciante)
//   - Slots con solo fallback TrabFlow → LIBRE (calcSlotStatus ya lo filtra)
//   - Mis campañas / Mis reservas: datos propios visibles
//
// CTA "Solicitar espacio": informacional, deshabilitado (Próximamente)
// INVARIANTE: publicidad ≠ ranking. Este módulo es solo presentacional.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdPlacementMap, {
  type PlacementSlot,
  type PlacementCampaign,
  type PlacementBooking,
} from '../admin/AdPlacementMap';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OwnCampaign {
  id:       string;
  slot_id:  string;
  nombre:   string;
  estado:   string;
  activa:   boolean;
  start_at: string | null;
  end_at:   string | null;
}

interface OwnBooking {
  id:       string;
  slot_id:  string;
  estado:   'REQUESTED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  inicio:   string;
  fin:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  DRAFT:              'bg-slate-700 text-slate-400',
  PENDING_APPROVAL:   'bg-amber-900/40 text-amber-300',
  APPROVED:           'bg-blue-900/40 text-blue-300',
  SCHEDULED:          'bg-teal-900/40 text-teal-300',
  ACTIVE:             'bg-emerald-900/40 text-emerald-300',
  PAUSED:             'bg-orange-900/40 text-orange-300',
  ENDED:              'bg-slate-800 text-slate-500',
  CANCELLED:          'bg-red-900/30 text-red-400',
  // Bookings
  REQUESTED:          'bg-amber-900/40 text-amber-300',
  RESERVED:           'bg-teal-900/40 text-teal-300',
  CONFIRMED:          'bg-emerald-900/40 text-emerald-300',
  EXPIRED:            'bg-slate-800 text-slate-500',
};

const ESTADO_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_APPROVAL: 'Pendiente aprobación', APPROVED: 'Aprobada',
  SCHEDULED: 'Programada', ACTIVE: 'Activa', PAUSED: 'Pausada',
  ENDED: 'Finalizada', CANCELLED: 'Cancelada',
  REQUESTED: 'Solicitada', RESERVED: 'Reservada', CONFIRMED: 'Confirmada', EXPIRED: 'Expirada',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function slotName(slotId: string, slots: PlacementSlot[]): string {
  return slots.find(s => s.id === slotId)?.nombre ?? slotId;
}

// Anonimiza campañas de terceros: solo conserva campos necesarios para calcSlotStatus.
// El campo advertiser_name queda en blanco para que InfoPanel en mode=supplier-preview
// no exponga identidad aunque se renderice por error.
function sanitizeCampaigns(campaigns: PlacementCampaign[], actorId: string): PlacementCampaign[] {
  return campaigns.map(c => {
    if (c.actor_id === actorId) return c;
    return {
      ...c,
      advertiser_name: '',
      nombre:          '',
      title:           '',
      image_url:       null,
      accent:          null,
      bg:              null,
      text_color:      null,
    };
  });
}

// ─── AdCommercialInfo ─────────────────────────────────────────────────────────

function AdCommercialInfo() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-900/40 flex items-center justify-center">
        <svg className="h-4 w-4 text-teal-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-300 mb-0.5">Espacios publicitarios Marketplace</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Puedes visualizar la disponibilidad de los 16 espacios publicitarios. El coste y las condiciones se gestionan directamente con TrabFlow.
          <span className="font-medium text-slate-400"> Precio: Consultar TrabFlow · Duración mínima: Por definir</span>
        </p>
      </div>
    </div>
  );
}

// ─── OwnCampaignsPanel ────────────────────────────────────────────────────────

interface OwnCampaignsPanelProps {
  campaigns: OwnCampaign[];
  slots:     PlacementSlot[];
}

function OwnCampaignsPanel({ campaigns, slots }: OwnCampaignsPanelProps) {
  if (campaigns.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-6 text-center">
        <p className="text-xs text-slate-600">Aún no tienes campañas publicitarias en el Marketplace</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {campaigns.map(c => (
        <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{c.nombre || '(sin nombre)'}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{slotName(c.slot_id, slots)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLORS[c.estado] ?? 'bg-slate-800 text-slate-400'}`}>
              {ESTADO_LABELS[c.estado] ?? c.estado}
            </span>
            <span className="text-[11px] text-slate-600">
              {fmtDate(c.start_at)} → {fmtDate(c.end_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── OwnBookingsPanel ─────────────────────────────────────────────────────────

interface OwnBookingsPanelProps {
  bookings: OwnBooking[];
  slots:    PlacementSlot[];
}

function OwnBookingsPanel({ bookings, slots }: OwnBookingsPanelProps) {
  if (bookings.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-6 text-center">
        <p className="text-xs text-slate-600">Sin reservas activas</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {bookings.map(b => (
        <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{slotName(b.slot_id, slots)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLORS[b.estado] ?? 'bg-slate-800 text-slate-400'}`}>
              {ESTADO_LABELS[b.estado] ?? b.estado}
            </span>
            <span className="text-[11px] text-slate-600">
              {fmtDate(b.inicio)} → {fmtDate(b.fin)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-600 mb-2">{children}</p>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  actorId: string;
}

// ─── PortalPublicidadMarketplace ──────────────────────────────────────────────

export default function PortalPublicidadMarketplace({ actorId }: Props) {
  const [slots,     setSlots]     = useState<PlacementSlot[]>([]);
  const [campaigns, setCampaigns] = useState<PlacementCampaign[]>([]);
  const [bookings,  setBookings]  = useState<PlacementBooking[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [slotsRes, campaignsRes, bookingsRes] = await Promise.all([
      // Slots: public access (SELECT true para todos)
      supabase
        .from('trade_marketplace_ad_slots')
        .select('id,nombre,descripcion,pagina,dispositivo,formato,ancho_px,alto_min_px,aspect_ratio,activo,comercializable,posicion,fallback_campaign_id')
        .eq('activo', true)
        .order('posicion'),
      // Campaigns: RLS retorna activas (de todos) + propias (cualquier estado)
      supabase
        .from('trade_marketplace_ad_campaigns')
        .select('id,slot_id,actor_id,campaign_source,estado,nombre,advertiser_name,activa,start_at,end_at,image_url,accent,bg,text_color,title'),
      // Bookings: RLS retorna solo propias
      supabase
        .from('trade_marketplace_ad_bookings')
        .select('id,slot_id,actor_id,estado,inicio,fin')
        .in('estado', ['REQUESTED', 'RESERVED', 'CONFIRMED']),
    ]);
    setLoading(false);
    if (slotsRes.error)     { setError(slotsRes.error.message);     return; }
    if (campaignsRes.error) { setError(campaignsRes.error.message); return; }
    if (bookingsRes.error)  { setError(bookingsRes.error.message);  return; }

    const rawSlots     = (slotsRes.data     ?? []) as PlacementSlot[];
    const rawCampaigns = (campaignsRes.data ?? []) as PlacementCampaign[];
    const rawBookings  = (bookingsRes.data  ?? []) as PlacementBooking[];

    setSlots(rawSlots);
    // Sanitizar: campaigns de terceros pierden identidad antes de pasar al mapa
    setCampaigns(sanitizeCampaigns(rawCampaigns, actorId));
    setBookings(rawBookings);
  }, [actorId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Propias campañas y reservas para las secciones de solo lectura
  const ownCampaigns: OwnCampaign[] = campaigns
    .filter(c => c.actor_id === actorId)
    .map(c => ({
      id: c.id, slot_id: c.slot_id, nombre: c.nombre,
      estado: c.estado, activa: c.activa, start_at: c.start_at, end_at: c.end_at,
    }));

  const ownBookings = bookings.filter(b => b.actor_id === actorId) as OwnBooking[];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-slate-100 text-base">Publicidad Marketplace</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {slots.length} espacios · {ownCampaigns.length} campañas propias · {ownBookings.length} reservas
            </p>
          </div>
          {/* CTA deshabilitado — Próximamente */}
          <button
            disabled
            title="Solicitud online disponible próximamente. Contacta con TrabFlow."
            className="flex items-center gap-1.5 bg-slate-800 text-slate-500 text-xs font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none border border-slate-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            Solicitar espacio
          </button>
        </div>
        <AdCommercialInfo />
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Mapa visual */}
            <section>
              <SectionTitle>Disponibilidad de espacios</SectionTitle>
              {slots.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-8 text-center">
                  <p className="text-xs text-slate-600">No se pudieron cargar los espacios</p>
                </div>
              ) : (
                <AdPlacementMap
                  slots={slots}
                  campaigns={campaigns}
                  bookings={bookings}
                  mode="supplier-preview"
                  actorId={actorId}
                />
              )}
            </section>

            {/* Aviso de privacidad */}
            <p className="text-[10px] text-slate-700 -mt-4">
              Los espacios marcados como "Ocupado" pertenecen a otro anunciante. TrabFlow no revela la identidad de los anunciantes.
            </p>

            {/* Mis campañas */}
            <section>
              <SectionTitle>Mis campañas ({ownCampaigns.length})</SectionTitle>
              <OwnCampaignsPanel campaigns={ownCampaigns} slots={slots} />
            </section>

            {/* Mis reservas */}
            <section>
              <SectionTitle>Mis reservas ({ownBookings.length})</SectionTitle>
              <OwnBookingsPanel bookings={ownBookings} slots={slots} />
            </section>

            {/* Aviso contratación */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-slate-400 mb-1">¿Quieres reservar un espacio?</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                La contratación online de espacios estará disponible próximamente. Contacta con TrabFlow para gestionar tu campaña publicitaria en el Marketplace.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
