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
// CTA "Solicitar espacio": abre drawer informacional (sin Stripe, sin booking automático)
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
    <div className="space-y-3">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-100 mb-1.5">¿Qué son los espacios publicitarios?</p>
        <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
          Posiciones destacadas en el Marketplace — banners, cabeceras y secciones de relevancia —
          que incrementan la visibilidad de tu empresa y catálogo entre compradores activos.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-bold text-teal-400 mb-0.5">Desktop</p>
            <p className="text-[10px] text-slate-400 leading-snug">Cabecera · Lateral · Lista</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-bold text-blue-400 mb-0.5">Mobile</p>
            <p className="text-[10px] text-slate-400 leading-snug">Banner · Intersticial</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-bold text-purple-400 mb-0.5">Catálogo</p>
            <p className="text-[10px] text-slate-400 leading-snug">Productos destacados</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl">
        <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-[11px] text-amber-300 leading-snug">
          <span className="font-semibold">Publicidad ≠ Ranking.</span>{' '}
          Los espacios publicitarios no afectan al orden de resultados ni al precio. El ranking siempre es objetivo.
        </p>
      </div>
    </div>
  );
}

// ─── SolicitarEspacioDrawer ───────────────────────────────────────────────────

type DrawerStep = 'form' | 'sent';

interface SolicitarForm {
  slotId:  string;
  periodo: string;
  mensaje: string;
}

interface SolicitarEspacioDrawerProps {
  slots:   PlacementSlot[];
  onClose: () => void;
}

function SolicitarEspacioDrawer({ slots, onClose }: SolicitarEspacioDrawerProps) {
  const freeSlots = slots.filter(s => s.comercializable);
  const [step,    setStep]    = useState<DrawerStep>('form');
  const [form,    setForm]    = useState<SolicitarForm>({ slotId: freeSlots[0]?.id ?? '', periodo: '', mensaje: '' });
  const [sending, setSending] = useState(false);

  const setField = <K extends keyof SolicitarForm>(k: K, v: SolicitarForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  function handleSend() {
    if (!form.slotId) return;
    setSending(true);
    // Flujo básico — sin Stripe, sin booking automático
    setTimeout(() => { setSending(false); setStep('sent'); }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Solicitar espacio publicitario</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Sin compromiso · El equipo te contactará</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'sent' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-900/40 flex items-center justify-center">
              <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-100 text-base mb-2">Solicitud registrada</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                El equipo de TrabFlow revisará tu solicitud y se pondrá en contacto contigo para
                confirmar disponibilidad, periodo y condiciones.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 text-teal-400 hover:text-teal-300 text-xs font-semibold transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-[11px] text-slate-400 leading-relaxed">
                Selecciona el espacio que te interesa y el periodo aproximado. Nuestro equipo
                confirmará disponibilidad, precio y condiciones.
              </div>

              {/* Selección de espacio */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Espacio publicitario</p>
                {freeSlots.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic">No hay espacios disponibles en este momento.</p>
                ) : (
                  <div className="space-y-1.5">
                    {freeSlots.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          form.slotId === s.id
                            ? 'bg-teal-900/30 border-teal-700'
                            : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={s.id}
                          checked={form.slotId === s.id}
                          onChange={() => setField('slotId', s.id)}
                          className="sr-only"
                        />
                        <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          form.slotId === s.id ? 'border-teal-500' : 'border-slate-600'
                        }`}>
                          {form.slotId === s.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 leading-tight">{s.nombre}</p>
                          <p className="text-[10px] text-slate-500 capitalize mt-0.5">{s.dispositivo} · {s.pagina}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Periodo deseado */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Periodo deseado
                </label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-600 transition-colors"
                  value={form.periodo}
                  onChange={e => setField('periodo', e.target.value)}
                  placeholder="Ej: septiembre 2026, 3 meses…"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Mensaje adicional{' '}
                  <span className="text-slate-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-600 transition-colors resize-none"
                  value={form.mensaje}
                  onChange={e => setField('mensaje', e.target.value)}
                  placeholder="Qué quieres promocionar, presupuesto aproximado…"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 space-y-2">
              <button
                onClick={handleSend}
                disabled={!form.slotId || sending}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
              >
                {sending ? 'Enviando…' : 'Enviar consulta a TrabFlow'}
              </button>
              <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                Sin compromiso de contratación. Nuestro equipo te responderá para
                confirmar disponibilidad y condiciones.
              </p>
            </div>
          </>
        )}
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
        <p className="text-[11px] text-slate-700 mt-1">Usa "Solicitar espacio" para iniciar una.</p>
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
    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">{children}</p>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  actorId: string;
}

// ─── PortalPublicidadMarketplace ──────────────────────────────────────────────

export default function PortalPublicidadMarketplace({ actorId }: Props) {
  const [slots,          setSlots]          = useState<PlacementSlot[]>([]);
  const [campaigns,      setCampaigns]      = useState<PlacementCampaign[]>([]);
  const [bookings,       setBookings]       = useState<PlacementBooking[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [showSolicitar,  setShowSolicitar]  = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [slotsRes, campaignsRes, bookingsRes] = await Promise.all([
      supabase
        .from('trade_marketplace_ad_slots')
        .select('id,nombre,descripcion,pagina,dispositivo,formato,ancho_px,alto_min_px,aspect_ratio,activo,comercializable,posicion,fallback_campaign_id')
        .eq('activo', true)
        .order('posicion'),
      supabase
        .from('trade_marketplace_ad_campaigns')
        .select('id,slot_id,actor_id,campaign_source,estado,nombre,advertiser_name,activa,start_at,end_at,image_url,accent,bg,text_color,title'),
      supabase
        .from('trade_marketplace_ad_bookings')
        .select('id,slot_id,actor_id,estado,inicio,fin')
        .in('estado', ['REQUESTED', 'RESERVED', 'CONFIRMED']),
    ]);
    setLoading(false);
    if (slotsRes.error)     { setError(slotsRes.error.message);     return; }
    if (campaignsRes.error) { setError(campaignsRes.error.message); return; }
    if (bookingsRes.error)  { setError(bookingsRes.error.message);  return; }

    setSlots((slotsRes.data ?? []) as PlacementSlot[]);
    setCampaigns(sanitizeCampaigns((campaignsRes.data ?? []) as PlacementCampaign[], actorId));
    setBookings((bookingsRes.data ?? []) as PlacementBooking[]);
  }, [actorId]);

  useEffect(() => { loadData(); }, [loadData]);

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
          <button
            onClick={() => setShowSolicitar(true)}
            className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
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

            {/* CTA reserva */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-slate-300 mb-1">¿Quieres reservar un espacio?</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                Selecciona el espacio que te interesa y envíanos una consulta. Nuestro equipo
                te contactará para confirmar disponibilidad, periodo y condiciones.
              </p>
              <button
                onClick={() => setShowSolicitar(true)}
                className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              >
                Solicitar espacio →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Drawer solicitud */}
      {showSolicitar && (
        <SolicitarEspacioDrawer
          slots={slots}
          onClose={() => setShowSolicitar(false)}
        />
      )}
    </div>
  );
}
