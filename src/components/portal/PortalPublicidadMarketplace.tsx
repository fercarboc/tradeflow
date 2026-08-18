// ═══════════════════════════════════════════════════════════════
// PortalPublicidadMarketplace.tsx  E4.C.2 + E4.C.3
// Portal Proveedor → Marketing → Publicidad Marketplace
//
// E4.C.2: Solicitudes reales persistidas (request_ad_slot RPC).
// E4.C.3: Wizard creatividad 5 pasos — ESPACIO/TIPO/CONTENIDO/PREVIEW/GUARDAR
// SOLICITUD ≠ RESERVA: REQUESTED no bloquea disponibilidad.
// INVARIANTE: publicidad ≠ ranking.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import AdPlacementMap, {
  type PlacementSlot,
  type PlacementCampaign,
  type PlacementBooking,
} from '../admin/AdPlacementMap';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SolicitudEstado = 'REQUESTED' | 'CONTACTING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
type ReservaEstado   = 'RESERVED' | 'CONFIRMED' | 'EXPIRED';
type CreativeMode    = 'FULL_IMAGE' | 'IMAGE_CONTENT' | 'TRABFLOW_DESIGN';
type TextPosition    = 'LEFT' | 'CENTER' | 'RIGHT';
type ThemePreset     = 'AZUL_PROFESIONAL' | 'VERDE_TECNICO' | 'NARANJA_OFERTA' | 'GRIS_INDUSTRIAL' | 'MORADO_NOVEDAD';

interface OwnCampaign {
  id: string; slot_id: string; nombre: string;
  estado: string; activa: boolean;
  start_at: string | null; end_at: string | null;
  booking_id: string | null;
}

interface OwnBooking {
  id: string; slot_id: string;
  estado: SolicitudEstado | ReservaEstado;
  inicio: string; fin: string;
  origen: string;
  mensaje: string | null;
}

interface OwnCreative {
  id: string; campaign_id: string;
  estado: string; submitted_at: string | null;
  image_url: string | null; mobile_image_url: string | null;
  headline: string | null; body_text: string | null;
  cta_text: string | null; alt_text: string | null;
  creative_mode: CreativeMode;
  text_position: TextPosition;
  overlay_strength: number;
  price_display: number | null; old_price_display: number | null;
  discount_label: string | null;
  theme_preset: ThemePreset;
}

interface AdSlotCreativeSpec {
  label: string; device: string;
  recW: number; recH: number; ratio: string;
  previewDesktop: string | null; previewMobile: string | null;
}

type ThemePresetDef = { bg: string; accent: string; text: string; label: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  DRAFT:            'bg-slate-700 text-slate-400',
  PENDING_APPROVAL: 'bg-amber-900/40 text-amber-300',
  APPROVED:         'bg-emerald-900/40 text-emerald-300',
  REJECTED:         'bg-red-900/30 text-red-400',
  SCHEDULED:        'bg-teal-900/40 text-teal-300',
  ACTIVE:           'bg-emerald-900/40 text-emerald-300',
  PAUSED:           'bg-orange-900/40 text-orange-300',
  ENDED:            'bg-slate-800 text-slate-500',
  CANCELLED:        'bg-red-900/30 text-red-400',
  EXPIRED:          'bg-slate-800 text-slate-500',
  REQUESTED:        'bg-amber-900/40 text-amber-300',
  CONTACTING:       'bg-blue-900/40 text-blue-300',
  ACCEPTED:         'bg-emerald-900/40 text-emerald-300',
  RESERVED:         'bg-teal-900/40 text-teal-300',
  CONFIRMED:        'bg-emerald-900/40 text-emerald-300',
};

const ESTADO_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_APPROVAL: 'En revisión',
  APPROVED: 'Aprobada', REJECTED: 'Rechazada',
  SCHEDULED: 'Programada', ACTIVE: 'Activa', PAUSED: 'Pausada',
  ENDED: 'Finalizada', CANCELLED: 'Cancelada', EXPIRED: 'Expirada',
  REQUESTED: 'Enviada', CONTACTING: 'En revisión',
  ACCEPTED:  'Aceptada', RESERVED: 'Reservada', CONFIRMED: 'Confirmada',
};

const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  AZUL_PROFESIONAL: { bg: 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)', accent: '#3b82f6', text: '#e2e8f0', label: 'Azul Profesional' },
  VERDE_TECNICO:    { bg: 'linear-gradient(135deg,#052e16 0%,#14532d 100%)', accent: '#22c55e', text: '#d1fae5', label: 'Verde Técnico'    },
  NARANJA_OFERTA:   { bg: 'linear-gradient(135deg,#431407 0%,#7c2d12 100%)', accent: '#f97316', text: '#fff7ed', label: 'Naranja Oferta'   },
  GRIS_INDUSTRIAL:  { bg: 'linear-gradient(135deg,#1c1917 0%,#292524 100%)', accent: '#a8a29e', text: '#e7e5e4', label: 'Gris Industrial'  },
  MORADO_NOVEDAD:   { bg: 'linear-gradient(135deg,#2e1065 0%,#4c1d95 100%)', accent: '#a855f7', text: '#f0e6ff', label: 'Morado Novedad'   },
};

const CREATIVE_MODE_INFO: Record<CreativeMode, { label: string; desc: string }> = {
  FULL_IMAGE:      { label: 'A · Imagen completa',    desc: 'Banner terminado que subirás tú. Sin composición de texto automática.' },
  IMAGE_CONTENT:   { label: 'B · Imagen + Contenido', desc: 'Imagen de fondo con texto, precio y CTA compuesto por TrabFlow. Recomendado.' },
  TRABFLOW_DESIGN: { label: 'C · Diseño TrabFlow',    desc: 'Sin imagen obligatoria. Gradiente y tipografía del sistema TrabFlow.' },
};

const WIZARD_STEPS = ['ESPACIO', 'TIPO', 'CONTENIDO', 'PREVIEW', 'GUARDAR'] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const MIME_ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function slotName(slotId: string, slots: PlacementSlot[]): string {
  return slots.find(s => s.id === slotId)?.nombre ?? slotId;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sanitizeCampaigns(campaigns: PlacementCampaign[], actorId: string): PlacementCampaign[] {
  return campaigns.map(c => {
    if (c.actor_id === actorId) return c;
    return { ...c, advertiser_name: '', nombre: '', title: '', image_url: null, accent: null, bg: null, text_color: null };
  });
}

function getAdSlotCreativeSpec(formato: PlacementSlot['formato']): AdSlotCreativeSpec {
  switch (formato) {
    case 'banner_vertical':
      return { label: 'Banner vertical', device: 'Desktop', recW: 400,  recH: 600, ratio: '2:3', previewDesktop: 'w-28 h-44', previewMobile: null };
    case 'carousel_slide':
      return { label: 'Hero slide',      device: 'Ambos',   recW: 1600, recH: 400, ratio: '4:1', previewDesktop: 'w-72 h-20', previewMobile: 'w-60 h-28' };
    case 'mobile_promo':
      return { label: 'Promo mobile',    device: 'Mobile',  recW: 800,  recH: 200, ratio: '4:1', previewDesktop: null,        previewMobile: 'w-60 h-16' };
    case 'promo_card':
      return { label: 'Promo card',      device: 'Ambos',   recW: 600,  recH: 500, ratio: '6:5', previewDesktop: 'w-36 h-32', previewMobile: 'w-32 h-28' };
    case 'catalog_banner':
      return { label: 'Banner catálogo', device: 'Ambos',   recW: 1600, recH: 240, ratio: '20:3',previewDesktop: 'w-72 h-12', previewMobile: 'w-60 h-11' };
    default:
      return { label: 'Formato',         device: 'Ambos',   recW: 800,  recH: 400, ratio: '2:1', previewDesktop: 'w-60 h-32', previewMobile: 'w-48 h-28' };
  }
}

async function uploadSupplierCreativeImage(
  file: File,
  actorId: string,
  campaignId: string,
): Promise<string> {
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `ads/${actorId}/${campaignId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('marketplace-offerings')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('marketplace-offerings').getPublicUrl(path);
  return data.publicUrl;
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
  inicio:  string;
  fin:     string;
  mensaje: string;
}

interface SolicitarEspacioDrawerProps {
  slots:   PlacementSlot[];
  actorId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const PERIOD_PRESETS = [
  { label: '1 sem.',  days: 6  },
  { label: '15 días', days: 14 },
  { label: '1 mes',   days: 29 },
  { label: '3 meses', days: 89 },
];

function SolicitarEspacioDrawer({ slots, actorId, onClose, onSubmitted }: SolicitarEspacioDrawerProps) {
  const freeSlots = slots.filter(s => s.comercializable);
  const tomorrow  = addDays(todayStr(), 1);

  const [step,      setStep]      = useState<DrawerStep>('form');
  const [form,      setForm]      = useState<SolicitarForm>({
    slotId:  freeSlots[0]?.id ?? '',
    inicio:  tomorrow,
    fin:     addDays(tomorrow, 6),
    mensaje: '',
  });
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState('');

  const setField = <K extends keyof SolicitarForm>(k: K, v: SolicitarForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  function applyPreset(days: number) {
    const base = form.inicio || tomorrow;
    setField('fin', addDays(base, days));
  }

  async function handleSend() {
    if (!form.slotId || !form.inicio || !form.fin) return;
    setSending(true);
    setSendError(null);

    const { data, error } = await supabase.rpc('request_ad_slot', {
      p_actor_id: actorId,
      p_slot_id:  form.slotId,
      p_inicio:   form.inicio,
      p_fin:      form.fin,
      p_mensaje:  form.mensaje.trim() || null,
    });

    setSending(false);

    if (error) {
      if (error.message.includes('Ya existe una solicitud')) {
        setSendError('Ya tienes una solicitud activa para este espacio en esas fechas.');
      } else if (error.message.includes('en el pasado')) {
        setSendError('La fecha de inicio no puede ser anterior a hoy.');
      } else if (error.message.includes('No autorizado')) {
        setSendError('Sin autorización. Recarga la página y vuelve a intentarlo.');
      } else {
        setSendError('No se pudo enviar. Inténtalo de nuevo.');
      }
      return;
    }

    setRequestId((data as { request_id: string })?.request_id ?? '');
    setStep('sent');
    onSubmitted();
  }

  const canSend = !!form.slotId && !!form.inicio && !!form.fin && form.fin >= form.inicio;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Solicitar espacio publicitario</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Sin compromiso · El equipo te contactará</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
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
              {requestId && (
                <p className="text-[11px] text-slate-600 font-mono mb-3">
                  Ref: {requestId.slice(0, 8).toUpperCase()}
                </p>
              )}
              <p className="text-xs text-slate-400 leading-relaxed">
                El equipo de TrabFlow revisará tu solicitud y se pondrá en contacto
                para confirmar disponibilidad, periodo y condiciones.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 text-teal-400 hover:text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-[11px] text-slate-400 leading-relaxed">
                Selecciona el espacio y el periodo. Nuestro equipo confirmará disponibilidad,
                precio y condiciones.
              </div>
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
                          type="radio" name="slot" value={s.id}
                          checked={form.slotId === s.id}
                          onChange={() => setField('slotId', s.id)}
                          className="sr-only"
                        />
                        <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          form.slotId === s.id ? 'border-teal-500' : 'border-slate-600'
                        }`}>
                          {form.slotId === s.id && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
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
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Periodo deseado</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Desde</label>
                    <input
                      type="date" min={todayStr()} value={form.inicio}
                      onChange={e => setField('inicio', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Hasta</label>
                    <input
                      type="date" min={form.inicio || todayStr()} value={form.fin}
                      onChange={e => setField('fin', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-600 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {PERIOD_PRESETS.map(p => (
                    <button
                      key={p.label} type="button" onClick={() => applyPreset(p.days)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-400 hover:border-teal-700 hover:text-teal-300 transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Mensaje adicional{' '}
                  <span className="text-slate-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 transition-colors resize-none"
                  value={form.mensaje}
                  onChange={e => setField('mensaje', e.target.value)}
                  placeholder="Qué quieres promocionar, presupuesto aproximado…"
                />
              </div>
              {sendError && (
                <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  {sendError}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-800 space-y-2">
              <button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {sending ? 'Enviando…' : 'Enviar solicitud a TrabFlow'}
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

// ─── PortalCreativeModeSelector ───────────────────────────────────────────────

function PortalCreativeModeSelector({
  value, onChange,
}: { value: CreativeMode; onChange: (m: CreativeMode) => void }) {
  return (
    <div className="space-y-2">
      {(Object.entries(CREATIVE_MODE_INFO) as [CreativeMode, typeof CREATIVE_MODE_INFO[CreativeMode]][]).map(([mode, info]) => (
        <button
          key={mode} type="button" onClick={() => onChange(mode)}
          className={`w-full text-left border rounded-xl px-4 py-3 transition-all cursor-pointer ${
            value === mode
              ? 'border-teal-500 bg-teal-900/20 text-white'
              : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{info.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {mode === 'IMAGE_CONTENT' && (
                <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded">Recomendado</span>
              )}
              {value === mode && (
                <svg className="h-3.5 w-3.5 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{info.desc}</p>
        </button>
      ))}
    </div>
  );
}

// ─── PortalAdCreativePreview ──────────────────────────────────────────────────

function PortalAdCreativePreview({
  formato, mode, imageUrl,
  headline, bodyText, ctaText, priceDisplay, oldPriceDisplay,
  discountLabel, textPosition, overlayStrength, themePreset,
}: {
  formato: PlacementSlot['formato'] | null;
  mode: CreativeMode;
  imageUrl: string;
  headline: string;
  bodyText: string;
  ctaText: string;
  priceDisplay: string;
  oldPriceDisplay: string;
  discountLabel: string;
  textPosition: TextPosition;
  overlayStrength: number;
  themePreset: ThemePreset;
}) {
  const spec     = formato ? getAdSlotCreativeSpec(formato) : null;
  const theme    = THEME_PRESETS[themePreset] ?? THEME_PRESETS.AZUL_PROFESIONAL;
  const clrAcc   = theme.accent;
  const showImg  = mode !== 'TRABFLOW_DESIGN' && !!imageUrl;
  const showOvly = mode === 'IMAGE_CONTENT' && showImg;
  const bgStyle  = !showImg ? { background: theme.bg } : undefined;

  const flexAlign: React.CSSProperties['alignItems'] =
    textPosition === 'CENTER' ? 'center' : textPosition === 'RIGHT' ? 'flex-end' : 'flex-start';
  const txtAlign: React.CSSProperties['textAlign'] =
    textPosition === 'CENTER' ? 'center' : textPosition === 'RIGHT' ? 'right' : 'left';

  const priceVal    = parseFloat(priceDisplay);
  const oldPriceVal = parseFloat(oldPriceDisplay);
  const hasPrice    = !isNaN(priceVal) && priceVal > 0;
  const hasOldPrice = !isNaN(oldPriceVal) && oldPriceVal > 0;

  const previewCls = spec?.previewDesktop ?? 'w-60 h-32';

  if (!spec) {
    return (
      <div className="text-[10px] text-slate-500 text-center py-6">
        Selecciona el espacio para ver el preview.
      </div>
    );
  }

  const textColor = mode === 'TRABFLOW_DESIGN' ? theme.text : '#ffffff';

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[10px] text-slate-500">Vista previa · {spec.label} ({spec.ratio})</p>
      <div className={`relative rounded-lg overflow-hidden flex-shrink-0 ${previewCls}`} style={bgStyle}>
        {showImg && (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {showOvly && (
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayStrength / 100})` }} />
        )}
        {mode === 'FULL_IMAGE' ? (
          !showImg && (
            <div className="relative z-10 flex items-center justify-center w-full h-full p-2">
              <span className="text-[8px] text-slate-500 text-center">Sube una imagen</span>
            </div>
          )
        ) : (
          <div
            className="relative z-10 flex flex-col h-full p-2 gap-0.5"
            style={{ color: textColor, alignItems: flexAlign, textAlign: txtAlign }}
          >
            {discountLabel && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: clrAcc, color: '#fff' }}>
                {discountLabel}
              </span>
            )}
            {headline && (
              <p className="text-[9px] font-black leading-tight line-clamp-2">{headline}</p>
            )}
            {bodyText && (
              <p className="text-[7px] leading-tight line-clamp-2 opacity-80">{bodyText}</p>
            )}
            {hasPrice && (
              <div className="flex items-baseline gap-1 mt-auto">
                <span className="text-[10px] font-black">{priceVal.toFixed(2)} €</span>
                {hasOldPrice && (
                  <span className="text-[7px] opacity-50 line-through">{oldPriceVal.toFixed(2)} €</span>
                )}
              </div>
            )}
            {ctaText && (
              <div className="mt-1 px-2 py-1 rounded-lg text-[7px] font-bold text-center"
                style={{ background: clrAcc, color: '#fff' }}>
                {ctaText}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-600">
        Resolución recomendada: {spec.recW}×{spec.recH}px
      </p>
    </div>
  );
}

// ─── ImageUploadZone ──────────────────────────────────────────────────────────

interface ImageUploadZoneProps {
  label: string;
  currentUrl: string;
  uploading: boolean;
  onFile: (f: File) => void;
  onError: (msg: string) => void;
}

function ImageUploadZone({ label, currentUrl, uploading, onFile, onError }: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!MIME_ALLOWED.includes(file.type)) {
      onError('Solo se aceptan JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onError('El archivo no puede superar 5 MB.');
      return;
    }
    onFile(file);
  }

  return (
    <div>
      <p className="text-[10px] text-slate-500 mb-1.5">{label}</p>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition-colors min-h-[80px] ${
          uploading ? 'border-teal-600 bg-teal-900/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
        }`}
      >
        {currentUrl ? (
          <>
            <img src={currentUrl} alt="" className="max-h-20 max-w-full object-contain" />
            {!uploading && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">Cambiar imagen</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 py-3 px-4 text-center">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-[10px] text-slate-500">JPG · PNG · WebP · máx 5 MB</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleChange} />
    </div>
  );
}

// ─── CreativeWizardDrawer ─────────────────────────────────────────────────────

interface CreativeDraft {
  id: string | null;
  creative_mode: CreativeMode;
  image_url: string;
  headline: string;
  body_text: string;
  cta_text: string;
  alt_text: string;
  text_position: TextPosition;
  overlay_strength: number;
  price_display: string;
  old_price_display: string;
  discount_label: string;
  theme_preset: ThemePreset;
}

const EMPTY_DRAFT: CreativeDraft = {
  id: null, creative_mode: 'IMAGE_CONTENT',
  image_url: '', headline: '', body_text: '',
  cta_text: 'Ver más', alt_text: '',
  text_position: 'LEFT', overlay_strength: 50,
  price_display: '', old_price_display: '', discount_label: '',
  theme_preset: 'AZUL_PROFESIONAL',
};

interface CreativeWizardDrawerProps {
  bookingId: string;
  slot: PlacementSlot | null;
  actorId: string;
  existingCreative: OwnCreative | null;
  existingCampaignId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function CreativeWizardDrawer({
  bookingId, slot, actorId, existingCreative, existingCampaignId, onClose, onSaved,
}: CreativeWizardDrawerProps) {
  const [step, setStep]           = useState<WizardStep>('ESPACIO');
  const [campaignId, setCampaignId] = useState<string | null>(existingCampaignId);
  const [draft, setDraft]         = useState<CreativeDraft>(() => {
    if (!existingCreative) return EMPTY_DRAFT;
    return {
      id:               existingCreative.id,
      creative_mode:    existingCreative.creative_mode,
      image_url:        existingCreative.image_url ?? '',
      headline:         existingCreative.headline ?? '',
      body_text:        existingCreative.body_text ?? '',
      cta_text:         existingCreative.cta_text ?? 'Ver más',
      alt_text:         existingCreative.alt_text ?? '',
      text_position:    existingCreative.text_position,
      overlay_strength: existingCreative.overlay_strength,
      price_display:    existingCreative.price_display?.toString() ?? '',
      old_price_display:existingCreative.old_price_display?.toString() ?? '',
      discount_label:   existingCreative.discount_label ?? '',
      theme_preset:     existingCreative.theme_preset,
    };
  });

  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);
  const [saved,      setSaved]      = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const isLocked = existingCreative?.estado === 'PENDING_APPROVAL';
  const spec     = slot ? getAdSlotCreativeSpec(slot.formato) : null;
  const stepIdx  = WIZARD_STEPS.indexOf(step);

  function setDraftField<K extends keyof CreativeDraft>(k: K, v: CreativeDraft[K]) {
    setDraft(prev => ({ ...prev, [k]: v }));
  }

  async function handleImageFile(file: File) {
    if (!campaignId) {
      // Ensure campaign exists before upload
      const { data: campId, error } = await supabase.rpc('ensure_campaign_for_booking', {
        p_booking_id: bookingId,
      });
      if (error || !campId) {
        setUploadErr(error?.message ?? 'No se pudo inicializar la campaña');
        return;
      }
      setCampaignId(campId as string);
      await doUpload(file, campId as string);
    } else {
      await doUpload(file, campaignId);
    }
  }

  async function doUpload(file: File, campId: string) {
    setUploading(true);
    setUploadErr(null);
    try {
      const url = await uploadSupplierCreativeImage(file, actorId, campId);
      setDraftField('image_url', url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);

    try {
      // Ensure campaign
      let campId = campaignId;
      if (!campId) {
        const { data, error } = await supabase.rpc('ensure_campaign_for_booking', {
          p_booking_id: bookingId,
        });
        if (error || !data) throw new Error(error?.message ?? 'No se pudo inicializar la campaña');
        campId = data as string;
        setCampaignId(campId);
      }

      const payload = {
        campaign_id:       campId,
        creative_mode:     draft.creative_mode,
        image_url:         draft.image_url || null,
        mobile_image_url:  null,
        headline:          draft.headline || null,
        body_text:         draft.body_text || null,
        cta_text:          draft.cta_text || null,
        alt_text:          draft.alt_text || null,
        text_position:     draft.text_position,
        overlay_strength:  draft.overlay_strength,
        price_display:     draft.price_display ? parseFloat(draft.price_display) : null,
        old_price_display: draft.old_price_display ? parseFloat(draft.old_price_display) : null,
        discount_label:    draft.discount_label || null,
        theme_preset:      draft.theme_preset,
        generada_ia:       false,
        activa:            false,
        estado:            'DRAFT',
        updated_at:        new Date().toISOString(),
      };

      if (draft.id) {
        const { error } = await supabase
          .from('trade_marketplace_ad_creatives')
          .update(payload)
          .eq('id', draft.id)
          .eq('estado', 'DRAFT');
        if (error) throw error;
      } else {
        const { data: newCr, error } = await supabase
          .from('trade_marketplace_ad_creatives')
          .insert({ ...payload })
          .select('id')
          .single();
        if (error) throw error;
        setDraftField('id', (newCr as { id: string }).id);
      }

      setSaved(true);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!draft.id) {
      await handleSave();
    }
    const creativeId = draft.id;
    if (!creativeId) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const { error } = await supabase.rpc('submit_ad_creative_for_review', {
        p_creative_id: creativeId,
      });
      if (error) throw error;
      setSubmitted(true);
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative ml-auto w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-900/40 flex items-center justify-center">
              <svg className="h-7 w-7 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-100 text-base mb-2">Creatividad enviada</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                El equipo de TrabFlow revisará tu creatividad. Cuando esté aprobada,
                se programará para el espacio reservado.
              </p>
            </div>
            <button onClick={onClose} className="mt-2 text-teal-400 hover:text-teal-300 text-xs font-semibold transition-colors cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Preparar creatividad</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {slot?.nombre ?? 'Espacio'} · Paso {stepIdx + 1} de {WIZARD_STEPS.length}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step pills */}
        <div className="flex gap-1 px-5 py-3 border-b border-slate-800 overflow-x-auto">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => !isLocked && i <= stepIdx + 1 && setStep(s)}
              disabled={isLocked || i > stepIdx + 1}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                step === s
                  ? 'bg-teal-700 text-white'
                  : i <= stepIdx
                    ? 'bg-slate-700 text-slate-300 cursor-pointer hover:bg-slate-600'
                    : 'bg-slate-800 text-slate-600 cursor-default'
              }`}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </button>
          ))}
        </div>

        {isLocked && (
          <div className="mx-5 mt-4 flex items-center gap-2 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
            <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[11px] text-amber-300">Creatividad enviada a revisión. No se puede modificar.</p>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* PASO 1: ESPACIO */}
          {step === 'ESPACIO' && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Espacio reservado</p>
              {slot ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                    <p className="text-sm font-bold text-slate-100">{slot.nombre}</p>
                  </div>
                  {slot.descripcion && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">{slot.descripcion}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-900 rounded-lg p-2.5">
                      <p className="text-slate-500 mb-0.5">Dispositivo</p>
                      <p className="text-slate-200 font-semibold capitalize">{slot.dispositivo}</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2.5">
                      <p className="text-slate-500 mb-0.5">Formato</p>
                      <p className="text-slate-200 font-semibold">{spec?.label ?? slot.formato}</p>
                    </div>
                    {spec && (
                      <>
                        <div className="bg-slate-900 rounded-lg p-2.5">
                          <p className="text-slate-500 mb-0.5">Ratio</p>
                          <p className="text-slate-200 font-semibold">{spec.ratio}</p>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2.5">
                          <p className="text-slate-500 mb-0.5">Resolución recomendada</p>
                          <p className="text-slate-200 font-semibold">{spec.recW}×{spec.recH}px</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 italic">Cargando datos del espacio…</div>
              )}
              <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <svg className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  El espacio es el que tienes reservado. No se puede cambiar aquí.
                </p>
              </div>
            </div>
          )}

          {/* PASO 2: TIPO */}
          {step === 'TIPO' && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tipo de creatividad</p>
              <PortalCreativeModeSelector value={draft.creative_mode} onChange={v => setDraftField('creative_mode', v)} />
            </div>
          )}

          {/* PASO 3: CONTENIDO */}
          {step === 'CONTENIDO' && (
            <div className="space-y-5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Contenido</p>

              {draft.creative_mode !== 'TRABFLOW_DESIGN' && (
                <div className="space-y-3">
                  <ImageUploadZone
                    label={`Imagen${draft.creative_mode === 'FULL_IMAGE' ? ' (Banner terminado)' : ' de fondo'} · ${spec ? `${spec.recW}×${spec.recH}px recomendado` : 'JPG/PNG/WebP'}`}
                    currentUrl={draft.image_url}
                    uploading={uploading}
                    onFile={handleImageFile}
                    onError={setUploadErr}
                  />
                  {uploadErr && (
                    <p className="text-[11px] text-red-400">{uploadErr}</p>
                  )}
                </div>
              )}

              {draft.creative_mode !== 'FULL_IMAGE' && (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1.5">
                      Titular <span className="text-slate-600">(recomendado)</span>
                    </label>
                    <input
                      value={draft.headline}
                      onChange={e => setDraftField('headline', e.target.value)}
                      placeholder="Ej: Instalaciones eléctricas de calidad"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1.5">
                      Texto adicional <span className="text-slate-600">(opcional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={draft.body_text}
                      onChange={e => setDraftField('body_text', e.target.value)}
                      placeholder="Descripción breve de tu oferta o servicio…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-600 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1.5">Texto del botón CTA</label>
                    <input
                      value={draft.cta_text}
                      onChange={e => setDraftField('cta_text', e.target.value)}
                      placeholder="Ver más"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-600 transition-colors"
                    />
                  </div>

                  {draft.creative_mode === 'TRABFLOW_DESIGN' && (
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1.5">Tema de color</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.entries(THEME_PRESETS) as [ThemePreset, ThemePresetDef][]).map(([preset, def]) => (
                          <button
                            key={preset} type="button"
                            onClick={() => setDraftField('theme_preset', preset)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              draft.theme_preset === preset ? 'border-teal-400 ring-1 ring-teal-400' : 'border-slate-700 hover:border-slate-600'
                            }`}
                            style={{ background: def.bg }}
                          >
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: def.accent }} />
                            <span className="text-[10px] font-semibold" style={{ color: def.text }}>{def.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {draft.creative_mode === 'IMAGE_CONTENT' && (
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1.5">Posición del texto</label>
                      <div className="flex gap-1">
                        {(['LEFT', 'CENTER', 'RIGHT'] as TextPosition[]).map(p => (
                          <button
                            key={p} type="button"
                            onClick={() => setDraftField('text_position', p)}
                            className={`flex-1 py-2 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                              draft.text_position === p ? 'border-teal-500 bg-teal-900/30 text-teal-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {p === 'LEFT' ? 'Izquierda' : p === 'CENTER' ? 'Centro' : 'Derecha'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-4 space-y-3">
                    <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                      <svg className="h-3 w-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="text-[10px] text-amber-300">
                        <strong>PUBLICIDAD ≠ PRICING.</strong> Los precios aquí son sólo visuales en el anuncio. No modifican tu catálogo.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Precio (€) <span className="text-slate-600">opt.</span></label>
                        <input
                          type="number" step="0.01" min="0"
                          value={draft.price_display}
                          onChange={e => setDraftField('price_display', e.target.value)}
                          placeholder="89.90"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-teal-600 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Antes (€) <span className="text-slate-600">opt.</span></label>
                        <input
                          type="number" step="0.01" min="0"
                          value={draft.old_price_display}
                          onChange={e => setDraftField('old_price_display', e.target.value)}
                          placeholder="119.90"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-teal-600 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Descuento <span className="text-slate-600">opt.</span></label>
                        <input
                          value={draft.discount_label}
                          onChange={e => setDraftField('discount_label', e.target.value)}
                          placeholder="-25%"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-teal-600 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5">
                  Texto alternativo (accesibilidad) <span className="text-slate-600">opt.</span>
                </label>
                <input
                  value={draft.alt_text}
                  onChange={e => setDraftField('alt_text', e.target.value)}
                  placeholder="Descripción de la imagen para lectores de pantalla"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-600 transition-colors"
                />
              </div>
            </div>
          )}

          {/* PASO 4: PREVIEW */}
          {step === 'PREVIEW' && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Vista previa</p>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <PortalAdCreativePreview
                  formato={slot?.formato ?? null}
                  mode={draft.creative_mode}
                  imageUrl={draft.image_url}
                  headline={draft.headline}
                  bodyText={draft.body_text}
                  ctaText={draft.cta_text}
                  priceDisplay={draft.price_display}
                  oldPriceDisplay={draft.old_price_display}
                  discountLabel={draft.discount_label}
                  textPosition={draft.text_position}
                  overlayStrength={draft.overlay_strength}
                  themePreset={draft.theme_preset}
                />
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-[11px] text-slate-400 leading-relaxed space-y-1">
                <p>• La creatividad será revisada por el equipo de TrabFlow antes de publicarse.</p>
                <p>• El equipo puede solicitar ajustes o rechazarla si no cumple los estándares.</p>
                <p>• Una vez aprobada se activa automáticamente en el periodo reservado.</p>
              </div>
            </div>
          )}

          {/* PASO 5: GUARDAR/ENVIAR */}
          {step === 'GUARDAR' && (
            <div className="space-y-5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Guardar y enviar</p>

              {saved && !saving && (
                <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/40 rounded-lg px-3 py-2">
                  <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-[11px] text-emerald-300">Borrador guardado correctamente.</p>
                </div>
              )}

              {saveErr && (
                <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  {saveErr}
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-100">Resumen</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <p className="text-slate-500">Tipo</p>
                      <p className="text-slate-200">{CREATIVE_MODE_INFO[draft.creative_mode].label}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Titular</p>
                      <p className="text-slate-200 truncate">{draft.headline || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Imagen</p>
                      <p className={draft.image_url ? 'text-emerald-400' : 'text-slate-500'}>
                        {draft.image_url ? 'Subida ✓' : 'Sin imagen'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">CTA</p>
                      <p className="text-slate-200">{draft.cta_text || '—'}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || isLocked}
                  className="w-full border border-teal-700 text-teal-300 hover:bg-teal-900/30 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={saving || isLocked || (!draft.image_url && draft.creative_mode !== 'TRABFLOW_DESIGN')}
                  className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  {saving ? 'Enviando…' : 'Enviar a revisión'}
                </button>

                {!draft.image_url && draft.creative_mode !== 'TRABFLOW_DESIGN' && (
                  <p className="text-[10px] text-amber-400 text-center">
                    Necesitas subir una imagen antes de enviar.
                  </p>
                )}

                <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                  Puedes guardar el borrador y continuar más tarde.
                  El envío es definitivo hasta que el equipo lo revise.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t border-slate-800 flex gap-2">
          {stepIdx > 0 && (
            <button
              onClick={() => setStep(WIZARD_STEPS[stepIdx - 1])}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:border-slate-600 transition-colors cursor-pointer"
            >
              ← Atrás
            </button>
          )}
          {stepIdx < WIZARD_STEPS.length - 1 && (
            <button
              onClick={() => setStep(WIZARD_STEPS[stepIdx + 1])}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OwnCampaignsPanel ────────────────────────────────────────────────────────

interface OwnCampaignsPanelProps { campaigns: OwnCampaign[]; slots: PlacementSlot[] }

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

// ─── OwnRequestsPanel (solicitudes portal_request) ───────────────────────────

interface OwnRequestsPanelProps { requests: OwnBooking[]; slots: PlacementSlot[] }

function OwnRequestsPanel({ requests, slots }: OwnRequestsPanelProps) {
  if (requests.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-6 text-center">
        <p className="text-xs text-slate-600">No has enviado ninguna solicitud todavía</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {requests.map(r => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{slotName(r.slot_id, slots)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(r.inicio)} → {fmtDate(r.fin)}</p>
              {r.mensaje && (
                <p className="text-[11px] text-slate-600 italic mt-0.5 truncate">"{r.mensaje}"</p>
              )}
            </div>
            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLORS[r.estado] ?? 'bg-slate-800 text-slate-400'}`}>
              {ESTADO_LABELS[r.estado] ?? r.estado}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── OwnBookingsPanel (reservas reales RESERVED/CONFIRMED) ────────────────────

interface OwnBookingsPanelProps {
  bookings:  OwnBooking[];
  slots:     PlacementSlot[];
  campaigns: OwnCampaign[];
  creatives: OwnCreative[];
  actorId:   string;
  onOpenWizard: (bookingId: string, slotId: string, existingCreative: OwnCreative | null, existingCampaignId: string | null) => void;
}

function OwnBookingsPanel({ bookings, slots, campaigns, creatives, actorId: _actorId, onOpenWizard }: OwnBookingsPanelProps) {
  if (bookings.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-6 text-center">
        <p className="text-xs text-slate-600">Sin reservas activas</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {bookings.map(b => {
        const campaign = campaigns.find(c => c.booking_id === b.id) ?? null;
        const creative = campaign ? creatives.find(cr => cr.campaign_id === campaign.id) ?? null : null;
        const creativeEstado = creative?.estado ?? null;

        let btnLabel = 'Preparar creatividad';
        let btnCls   = 'bg-teal-700 hover:bg-teal-600 text-white cursor-pointer';
        let btnDisabled = false;

        if (creativeEstado === 'PENDING_APPROVAL') {
          btnLabel = 'En revisión';
          btnCls   = 'bg-amber-900/40 text-amber-300 cursor-default';
          btnDisabled = true;
        } else if (creativeEstado === 'APPROVED') {
          btnLabel = 'Aprobada';
          btnCls   = 'bg-emerald-900/40 text-emerald-300 cursor-default';
          btnDisabled = true;
        } else if (creativeEstado === 'DRAFT') {
          btnLabel = 'Continuar creatividad';
          btnCls   = 'bg-blue-700 hover:bg-blue-600 text-white cursor-pointer';
        } else if (creativeEstado === 'REJECTED') {
          btnLabel = 'Rehace creatividad';
          btnCls   = 'bg-red-700/60 hover:bg-red-700 text-white cursor-pointer';
        }

        return (
          <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{slotName(b.slot_id, slots)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(b.inicio)} → {fmtDate(b.fin)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLORS[b.estado] ?? 'bg-slate-800 text-slate-400'}`}>
                  {ESTADO_LABELS[b.estado] ?? b.estado}
                </span>
                <button
                  disabled={btnDisabled}
                  onClick={() => !btnDisabled && onOpenWizard(b.id, b.slot_id, creative, campaign?.id ?? null)}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${btnCls}`}
                >
                  {btnLabel}
                </button>
              </div>
            </div>
            {creativeEstado === 'PENDING_APPROVAL' && (
              <p className="text-[10px] text-slate-600 mt-1.5">
                Tu creatividad está siendo revisada por el equipo. Te contactaremos pronto.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">{children}</p>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { actorId: string }

// ─── PortalPublicidadMarketplace ──────────────────────────────────────────────

export default function PortalPublicidadMarketplace({ actorId }: Props) {
  const [slots,         setSlots]         = useState<PlacementSlot[]>([]);
  const [campaigns,     setCampaigns]     = useState<PlacementCampaign[]>([]);
  const [bookings,      setBookings]      = useState<PlacementBooking[]>([]);
  const [ownBookings,   setOwnBookings]   = useState<OwnBooking[]>([]);
  const [ownCampaigns,  setOwnCampaigns]  = useState<OwnCampaign[]>([]);
  const [ownCreatives,  setOwnCreatives]  = useState<OwnCreative[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [showSolicitar, setShowSolicitar] = useState(false);

  // Wizard state
  const [wizardBookingId,    setWizardBookingId]    = useState<string | null>(null);
  const [wizardSlotId,       setWizardSlotId]       = useState<string | null>(null);
  const [wizardCreative,     setWizardCreative]     = useState<OwnCreative | null>(null);
  const [wizardCampaignId,   setWizardCampaignId]   = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [slotsRes, campaignsRes, bookingsRes, creativesRes] = await Promise.all([
      supabase
        .from('trade_marketplace_ad_slots')
        .select('id,nombre,descripcion,pagina,dispositivo,formato,ancho_px,alto_min_px,aspect_ratio,activo,comercializable,posicion,fallback_campaign_id')
        .eq('activo', true)
        .order('posicion'),
      supabase
        .from('trade_marketplace_ad_campaigns')
        .select('id,slot_id,actor_id,campaign_source,estado,nombre,advertiser_name,activa,start_at,end_at,image_url,accent,bg,text_color,title,booking_id'),
      supabase
        .from('trade_marketplace_ad_bookings')
        .select('id,slot_id,actor_id,estado,inicio,fin,origen,mensaje')
        .in('estado', ['REQUESTED','CONTACTING','ACCEPTED','REJECTED','RESERVED','CONFIRMED']),
      supabase
        .from('trade_marketplace_ad_creatives')
        .select('id,campaign_id,estado,submitted_at,image_url,mobile_image_url,headline,body_text,cta_text,alt_text,creative_mode,text_position,overlay_strength,price_display,old_price_display,discount_label,theme_preset'),
    ]);
    setLoading(false);
    if (slotsRes.error)     { setError(slotsRes.error.message);     return; }
    if (campaignsRes.error) { setError(campaignsRes.error.message); return; }
    if (bookingsRes.error)  { setError(bookingsRes.error.message);  return; }
    // creatives failure is non-fatal (just won't show creative buttons)

    const allBookings = (bookingsRes.data ?? []) as (PlacementBooking & { origen: string; mensaje: string | null })[];
    const allCampaigns = (campaignsRes.data ?? []) as (PlacementCampaign & { booking_id: string | null })[];

    setSlots((slotsRes.data ?? []) as PlacementSlot[]);
    setCampaigns(sanitizeCampaigns(allCampaigns as PlacementCampaign[], actorId));
    setBookings(allBookings as PlacementBooking[]);

    setOwnBookings(
      allBookings
        .filter(b => b.actor_id === actorId)
        .map(b => ({
          id: b.id, slot_id: b.slot_id,
          estado: b.estado as OwnBooking['estado'],
          inicio: b.inicio, fin: b.fin,
          origen: b.origen, mensaje: b.mensaje,
        }))
    );

    setOwnCampaigns(
      allCampaigns
        .filter(c => c.actor_id === actorId)
        .map(c => ({
          id: c.id, slot_id: c.slot_id, nombre: c.nombre,
          estado: c.estado, activa: c.activa,
          start_at: c.start_at, end_at: c.end_at,
          booking_id: c.booking_id ?? null,
        }))
    );

    setOwnCreatives((creativesRes.data ?? []) as OwnCreative[]);
  }, [actorId]);

  useEffect(() => { loadData(); }, [loadData]);

  function openWizard(bookingId: string, slotId: string, creative: OwnCreative | null, campaignId: string | null) {
    setWizardBookingId(bookingId);
    setWizardSlotId(slotId);
    setWizardCreative(creative);
    setWizardCampaignId(campaignId);
  }

  function closeWizard() {
    setWizardBookingId(null);
    setWizardSlotId(null);
    setWizardCreative(null);
    setWizardCampaignId(null);
  }

  const ownSolicitudes = ownBookings.filter(b =>
    ['REQUESTED','CONTACTING','ACCEPTED','REJECTED'].includes(b.estado)
  );
  const ownReservas = ownBookings.filter(b =>
    ['RESERVED','CONFIRMED'].includes(b.estado)
  );

  const totalSolicitudes = ownSolicitudes.length;
  const totalReservas    = ownReservas.length;

  const wizardSlot = wizardSlotId ? slots.find(s => s.id === wizardSlotId) ?? null : null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-slate-100 text-base">Publicidad Marketplace</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {slots.length} espacios · {ownCampaigns.length} campañas · {totalSolicitudes} solicitudes · {totalReservas} reservas
            </p>
          </div>
          <button
            onClick={() => setShowSolicitar(true)}
            className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
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
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{error}</div>
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <AdPlacementMap
                    slots={slots}
                    campaigns={campaigns}
                    bookings={bookings}
                    mode="supplier-preview"
                    actorId={actorId}
                  />
                </div>
              )}
            </section>

            <p className="text-[10px] text-slate-700 -mt-4">
              Los espacios marcados como "Ocupado" pertenecen a otro anunciante. TrabFlow no revela la identidad de los anunciantes.
            </p>

            {/* Mis solicitudes */}
            <section>
              <SectionTitle>Mis solicitudes ({totalSolicitudes})</SectionTitle>
              <OwnRequestsPanel requests={ownSolicitudes} slots={slots} />
            </section>

            {/* Mis reservas */}
            <section>
              <SectionTitle>Mis reservas ({totalReservas})</SectionTitle>
              <OwnBookingsPanel
                bookings={ownReservas}
                slots={slots}
                campaigns={ownCampaigns}
                creatives={ownCreatives}
                actorId={actorId}
                onOpenWizard={openWizard}
              />
            </section>

            {/* Mis campañas */}
            <section>
              <SectionTitle>Mis campañas ({ownCampaigns.length})</SectionTitle>
              <OwnCampaignsPanel campaigns={ownCampaigns} slots={slots} />
            </section>

            {/* CTA */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-slate-300 mb-1">¿Quieres reservar un espacio?</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                Selecciona el espacio que te interesa y envíanos una solicitud. Nuestro equipo
                te contactará para confirmar disponibilidad, periodo y condiciones.
              </p>
              <button
                onClick={() => setShowSolicitar(true)}
                className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
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
          actorId={actorId}
          onClose={() => setShowSolicitar(false)}
          onSubmitted={loadData}
        />
      )}

      {/* Wizard creatividad */}
      {wizardBookingId && (
        <CreativeWizardDrawer
          bookingId={wizardBookingId}
          slot={wizardSlot}
          actorId={actorId}
          existingCreative={wizardCreative}
          existingCampaignId={wizardCampaignId}
          onClose={closeWizard}
          onSaved={() => { closeWizard(); loadData(); }}
        />
      )}
    </div>
  );
}
