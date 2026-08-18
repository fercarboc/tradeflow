// ═══════════════════════════════════════════════════════════════
// AdminMarketplaceAdsSection.tsx
// Admin → Marketplace → Publicidad
// E2: Dashboard · Espacios · Campañas · Reservas · Creatividades
//
// INVARIANTE preservado: publicidad ≠ ranking.
// No tocar: checkout, pricing, ranking, ProductCard, Universal Products.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart2, Layout, Calendar, RefreshCw, Plus, Edit2,
  Eye, X, AlertCircle, CheckCircle, Clock, Monitor, Smartphone,
  XCircle, ChevronDown, ChevronUp, Megaphone, Image as ImageIcon,
  Lock, Upload, AlertTriangle, Layers, Map,
  AlignLeft, AlignCenter, AlignRight, Tag, Sparkles, Inbox,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdPlacementMap, { type PlacementCampaign, type PlacementBooking } from './AdPlacementMap';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type AdsTab = 'dashboard' | 'slots' | 'solicitudes' | 'campanas' | 'reservas' | 'creatividades';

type AdSlot = {
  id: string; nombre: string; descripcion: string | null;
  pagina: 'home' | 'catalog';
  dispositivo: 'desktop' | 'mobile' | 'both';
  formato: 'banner_vertical' | 'carousel_slide' | 'mobile_promo' | 'catalog_banner' | 'promo_card';
  ancho_px: number | null; alto_min_px: number | null; aspect_ratio: string | null;
  activo: boolean; comercializable: boolean; posicion: number;
  fallback_campaign_id: string | null; created_at: string;
};

type AdCampaignAdmin = {
  id: string; slot_id: string; actor_id: string | null; booking_id: string | null;
  campaign_source: 'demo' | 'trabflow' | 'supplier';
  estado: 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'REJECTED';
  nombre: string; advertiser_name: string; eyebrow: string | null;
  title: string; subtitle: string | null; cta_label: string;
  destination_type: 'catalog' | 'category' | 'supplier' | 'search' | 'product' | 'offer';
  destination_value: string | null; oficio: string | null;
  priority: number; activa: boolean;
  start_at: string | null; end_at: string | null;
  accent: string | null; bg: string | null; text_color: string | null;
  aprobada_por: string | null; aprobada_at: string | null; rechazo_motivo: string | null;
  image_url: string | null; mobile_image_url: string | null;
  created_at: string; updated_at: string;
};

type AdBookingAdmin = {
  id: string; slot_id: string; actor_id: string;
  estado: 'REQUESTED' | 'CONTACTING' | 'ACCEPTED' | 'REJECTED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  inicio: string; fin: string; origen: 'admin' | 'portal_request';
  notas: string | null; mensaje: string | null; created_at: string;
};

type CreativeMode  = 'FULL_IMAGE' | 'IMAGE_CONTENT' | 'TRABFLOW_DESIGN';
type TextPosition  = 'LEFT' | 'CENTER' | 'RIGHT';
type ThemePreset   = 'AZUL_PROFESIONAL' | 'VERDE_TECNICO' | 'NARANJA_OFERTA' | 'GRIS_INDUSTRIAL' | 'MORADO_NOVEDAD';
type ThemePresetDef = { bg: string; accent: string; text: string; label: string };
type AdSlotCreativeSpec = {
  label: string; device: string;
  recW: number; recH: number; ratio: string;
  previewDesktop: string | null; previewMobile: string | null;
};

type AdCreativeAdmin = {
  id: string; campaign_id: string;
  image_url: string | null; mobile_image_url: string | null;
  headline: string | null; body_text: string | null;
  cta_text: string | null; alt_text: string | null;
  generada_ia: boolean; activa: boolean; created_at: string;
  creative_mode: CreativeMode;
  text_position: TextPosition;
  overlay_strength: number;
  price_display: number | null;
  old_price_display: number | null;
  discount_label: string | null;
  theme_preset: ThemePreset;
};

type MarketplaceActor = { id: string; nombre: string; actor_type: string; estado: string };

type DashboardKPIs = {
  slots_total: number; slots_comerciales: number; slots_ocupados: number;
  slots_libres: number; slots_sin_fallback: number;
  campanas_activas: number; campanas_programadas: number; campanas_pendientes_aprobacion: number;
  campanas_proximas_inicio: number; campanas_terminan_pronto: number;
  reservas_pendientes: number; reservas_activas: number; reservas_proximas: number;
  solicitudes_portal_nuevas: number;
};

type CampaignFormData = {
  slot_id: string; campaign_source: 'trabflow' | 'supplier' | 'demo';
  actor_id: string; nombre: string; advertiser_name: string;
  eyebrow: string; title: string; subtitle: string; cta_label: string;
  destination_type: 'catalog' | 'category' | 'supplier' | 'search' | 'product' | 'offer';
  destination_value: string; oficio: string; priority: string;
  start_at: string; end_at: string;
  accent: string; bg: string; text_color: string;
  estado: AdCampaignAdmin['estado']; activa: boolean;
  image_url: string; mobile_image_url: string;
};

type BookingFormData = {
  slot_id: string; actor_id: string;
  inicio: string; fin: string;
  estado: AdBookingAdmin['estado']; notas: string;
};

type CreativeFormData = {
  campaign_id: string; image_url: string; mobile_image_url: string;
  headline: string; body_text: string; cta_text: string; alt_text: string;
  activa: boolean;
  creative_mode: CreativeMode;
  text_position: TextPosition;
  overlay_strength: string;
  price_display: string;
  old_price_display: string;
  discount_label: string;
  theme_preset: ThemePreset;
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ESTADO_CAMP_LABEL: Record<AdCampaignAdmin['estado'], string> = {
  DRAFT: 'Borrador', PENDING_APPROVAL: 'Pend. aprobación',
  SCHEDULED: 'Programada', ACTIVE: 'Activa',
  PAUSED: 'Pausada', FINISHED: 'Finalizada', REJECTED: 'Rechazada',
};

const ESTADO_CAMP_CLS: Record<AdCampaignAdmin['estado'], string> = {
  DRAFT: 'bg-slate-700 text-slate-300',
  PENDING_APPROVAL: 'bg-amber-900/60 text-amber-300',
  SCHEDULED: 'bg-blue-900/60 text-blue-300',
  ACTIVE: 'bg-emerald-900/60 text-emerald-300',
  PAUSED: 'bg-yellow-900/60 text-yellow-300',
  FINISHED: 'bg-slate-700/40 text-slate-500',
  REJECTED: 'bg-red-900/60 text-red-300',
};

const VALID_TRANSITIONS: Record<AdCampaignAdmin['estado'], AdCampaignAdmin['estado'][]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['ACTIVE', 'SCHEDULED', 'REJECTED'],
  SCHEDULED: ['ACTIVE', 'PAUSED', 'FINISHED'],
  ACTIVE: ['PAUSED', 'FINISHED'],
  PAUSED: ['ACTIVE', 'FINISHED'],
  FINISHED: [],
  REJECTED: ['DRAFT'],
};

const ESTADO_BOOK_LABEL: Record<AdBookingAdmin['estado'], string> = {
  REQUESTED:  'Nueva',
  CONTACTING: 'En contacto',
  ACCEPTED:   'Aceptada',
  REJECTED:   'Rechazada',
  RESERVED:   'Reservada',
  CONFIRMED:  'Confirmada',
  CANCELLED:  'Cancelada',
  EXPIRED:    'Expirada',
};

const ESTADO_BOOK_CLS: Record<AdBookingAdmin['estado'], string> = {
  REQUESTED:  'bg-amber-900/60 text-amber-300',
  CONTACTING: 'bg-blue-900/60 text-blue-300',
  ACCEPTED:   'bg-teal-900/60 text-teal-300',
  REJECTED:   'bg-red-900/60 text-red-400',
  RESERVED:   'bg-blue-900/60 text-blue-300',
  CONFIRMED:  'bg-emerald-900/60 text-emerald-300',
  CANCELLED:  'bg-slate-700/40 text-slate-500',
  EXPIRED:    'bg-red-900/60 text-red-300',
};

// Transiciones para tab Solicitudes (via RPC admin_update_ad_request_status)
const SOLICITUD_TRANSITIONS: Record<string, string[]> = {
  REQUESTED:  ['CONTACTING', 'ACCEPTED', 'REJECTED'],
  CONTACTING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED:   ['REJECTED'],
  REJECTED:   [],
  CANCELLED:  [],
};

// Transiciones para tab Reservas (via supabase directo)
const VALID_BOOK_TRANSITIONS: Record<AdBookingAdmin['estado'], AdBookingAdmin['estado'][]> = {
  REQUESTED:  [],
  CONTACTING: [],
  ACCEPTED:   [],
  REJECTED:   [],
  RESERVED:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['CANCELLED'],
  CANCELLED:  [],
  EXPIRED:    [],
};

const FORMATO_LABEL: Record<AdSlot['formato'], string> = {
  banner_vertical: 'Banner vertical', carousel_slide: 'Hero slide',
  mobile_promo: 'Promo mobile', catalog_banner: 'Banner catálogo', promo_card: 'Promo card',
};

const DEVICE_LABEL: Record<AdSlot['dispositivo'], string> = {
  desktop: 'Desktop', mobile: 'Mobile', both: 'Ambos',
};

const EMPTY_CAMPAIGN: CampaignFormData = {
  slot_id: '', campaign_source: 'trabflow', actor_id: '',
  nombre: '', advertiser_name: 'TrabFlow', eyebrow: '', title: '',
  subtitle: '', cta_label: 'Ver más',
  destination_type: 'catalog', destination_value: '',
  oficio: '', priority: '10', start_at: '', end_at: '',
  accent: '#60a5fa', bg: 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)',
  text_color: '#ffffff', estado: 'DRAFT', activa: false,
  image_url: '', mobile_image_url: '',
};

const EMPTY_BOOKING: BookingFormData = {
  slot_id: '', actor_id: '', inicio: '', fin: '',
  estado: 'REQUESTED', notas: '',
};

const EMPTY_CREATIVE: CreativeFormData = {
  campaign_id: '', image_url: '', mobile_image_url: '',
  headline: '', body_text: '', cta_text: '', alt_text: '', activa: false,
  creative_mode: 'IMAGE_CONTENT', text_position: 'LEFT',
  overlay_strength: '50', price_display: '', old_price_display: '',
  discount_label: '', theme_preset: 'AZUL_PROFESIONAL',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function slotStatus(slot: AdSlot, bookings: AdBookingAdmin[]): 'LIBRE' | 'OCUPADO' | 'RESERVADO' | 'INACTIVO' {
  if (!slot.activo) return 'INACTIVO';
  const today = new Date().toISOString().slice(0, 10);
  if (bookings.some(b => b.slot_id === slot.id && b.estado === 'CONFIRMED' && b.inicio <= today && b.fin >= today))
    return 'OCUPADO';
  if (bookings.some(b => b.slot_id === slot.id && b.estado === 'RESERVED' && b.inicio <= today && b.fin >= today))
    return 'RESERVADO';
  return 'LIBRE';
}

const STATUS_CLS = {
  LIBRE:     'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  OCUPADO:   'bg-blue-900/40 text-blue-300 border-blue-700/40',
  RESERVADO: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  INACTIVO:  'bg-slate-800 text-slate-500 border-slate-700',
};

const iCls = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500';
const lCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1';

// ─── SLOT FORMAT RECOMMENDATIONS (para validación de imagen) ─────────────────

const SLOT_FORMAT_RECOMMENDATIONS: Partial<Record<AdSlot['formato'], { w: number; h: number; label: string }>> = {
  banner_vertical:  { w: 300,  h: 600,  label: 'Banner vertical'    },
  carousel_slide:   { w: 1200, h: 628,  label: 'Hero slide'         },
  promo_card:       { w: 600,  h: 600,  label: 'Tarjeta promo'      },
  mobile_promo:     { w: 800,  h: 400,  label: 'Promo mobile'        },
  catalog_banner:   { w: 1200, h: 300,  label: 'Banner catálogo'    },
};

// ─── CREATIVE THEMES (Modo C — TRABFLOW_DESIGN) ──────────────────────────────

const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  AZUL_PROFESIONAL: { bg: 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)', accent: '#3b82f6', text: '#e2e8f0', label: 'Azul Profesional' },
  VERDE_TECNICO:    { bg: 'linear-gradient(135deg,#052e16 0%,#14532d 100%)', accent: '#22c55e', text: '#d1fae5', label: 'Verde Técnico'    },
  NARANJA_OFERTA:   { bg: 'linear-gradient(135deg,#431407 0%,#7c2d12 100%)', accent: '#f97316', text: '#fff7ed', label: 'Naranja Oferta'   },
  GRIS_INDUSTRIAL:  { bg: 'linear-gradient(135deg,#1c1917 0%,#292524 100%)', accent: '#a8a29e', text: '#e7e5e4', label: 'Gris Industrial'  },
  MORADO_NOVEDAD:   { bg: 'linear-gradient(135deg,#2e1065 0%,#4c1d95 100%)', accent: '#a855f7', text: '#f0e6ff', label: 'Morado Novedad'   },
};

const CREATIVE_MODE_INFO: Record<CreativeMode, { label: string; desc: string }> = {
  FULL_IMAGE:      { label: 'A · Imagen completa',    desc: 'Banner terminado por proveedor/agencia. Sin composición de texto automática.' },
  IMAGE_CONTENT:   { label: 'B · Imagen + Contenido', desc: 'Imagen de fondo con texto, precio y CTA compuesto por TrabFlow. Recomendado.' },
  TRABFLOW_DESIGN: { label: 'C · Diseño TrabFlow',    desc: 'Sin imagen obligatoria. Gradiente y tipografía del sistema.' },
};

// ─── CREATIVE SPEC POR FORMATO (fuente única de verdad) ──────────────────────
// Dimensiones reales de BD: banner_vertical 192×220px, carousel_slide min 280px.
// Las dimensiones de recomendación de upload son mayores (mejor resolución).

function getAdSlotCreativeSpec(formato: AdSlot['formato']): AdSlotCreativeSpec {
  switch (formato) {
    case 'banner_vertical':
      return { label: 'Banner vertical', device: 'Desktop', recW: 400, recH: 600, ratio: '2:3', previewDesktop: 'w-28 h-44', previewMobile: null };
    case 'carousel_slide':
      return { label: 'Hero slide', device: 'Ambos', recW: 1600, recH: 400, ratio: '4:1', previewDesktop: 'w-80 h-20', previewMobile: 'w-64 h-28' };
    case 'mobile_promo':
      return { label: 'Promo mobile', device: 'Mobile', recW: 800, recH: 200, ratio: '4:1', previewDesktop: null, previewMobile: 'w-64 h-16' };
    case 'promo_card':
      return { label: 'Promo card', device: 'Ambos', recW: 600, recH: 500, ratio: '6:5', previewDesktop: 'w-40 h-36', previewMobile: 'w-36 h-32' };
    case 'catalog_banner':
      return { label: 'Banner catálogo', device: 'Ambos', recW: 1600, recH: 240, ratio: '20:3', previewDesktop: 'w-80 h-14', previewMobile: 'w-64 h-12' };
  }
}

// ─── UPLOAD IMAGEN ────────────────────────────────────────────────────────────
// Ruta: marketplace-offerings / ads / {campaignId|draft} / {uuid}.{ext}
// Políticas bucket: público, 5 MB, jpeg/jpg/png/webp — namespace ads/ seguro.

async function uploadAdImage(file: File, campaignId: string | null): Promise<string> {
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const folder = campaignId ? `ads/${campaignId}` : 'ads/draft';
  const path   = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('marketplace-offerings')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('marketplace-offerings').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadCreativeImage(file: File, campaignId: string, role: 'desktop' | 'mobile'): Promise<string> {
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const prefix = role === 'mobile' ? 'mob' : 'desk';
  const path   = `ads/${campaignId}/cr/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('marketplace-offerings')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('marketplace-offerings').getPublicUrl(path);
  return data.publicUrl;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function AdsDashboard({ kpis, loading }: { kpis: DashboardKPIs | null; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Cargando KPIs…</div>;
  if (!kpis) return <div className="text-slate-500 text-sm">No se pudieron cargar los KPIs.</div>;

  const groups = [
    {
      title: 'Espacios publicitarios',
      items: [
        { label: 'Slots totales',       value: kpis.slots_total,       color: 'text-white' },
        { label: 'Comercializables',    value: kpis.slots_comerciales,  color: 'text-blue-400' },
        { label: 'Ocupados hoy',        value: kpis.slots_ocupados,     color: 'text-amber-400' },
        { label: 'Libres hoy',          value: kpis.slots_libres,       color: 'text-emerald-400' },
        { label: 'Sin fallback',        value: kpis.slots_sin_fallback, color: kpis.slots_sin_fallback > 0 ? 'text-red-400' : 'text-emerald-400' },
      ],
    },
    {
      title: 'Campañas',
      items: [
        { label: 'Activas ahora',       value: kpis.campanas_activas,               color: 'text-emerald-400' },
        { label: 'Programadas',         value: kpis.campanas_programadas,            color: 'text-blue-400' },
        { label: 'Pend. aprobación',    value: kpis.campanas_pendientes_aprobacion,  color: kpis.campanas_pendientes_aprobacion > 0 ? 'text-amber-400' : 'text-slate-400' },
        { label: 'Pronto inicio',       value: kpis.campanas_proximas_inicio,        color: 'text-slate-300' },
        { label: 'Terminan en 7d',      value: kpis.campanas_terminan_pronto,        color: kpis.campanas_terminan_pronto > 0 ? 'text-amber-400' : 'text-slate-400' },
      ],
    },
    {
      title: 'Solicitudes',
      items: [
        { label: 'Nuevas del portal', value: kpis.solicitudes_portal_nuevas ?? 0, color: (kpis.solicitudes_portal_nuevas ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400' },
      ],
    },
    {
      title: 'Reservas',
      items: [
        { label: 'Confirmadas activas', value: kpis.reservas_activas,  color: 'text-emerald-400' },
        { label: 'Próximas',            value: kpis.reservas_proximas, color: 'text-blue-400' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-white">Dashboard Publicidad</h2>
      <div className="space-y-5">
        {groups.map(g => (
          <div key={g.title}>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{g.title}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {g.items.map(item => (
                <div key={item.label} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                  <div className={`text-2xl font-black tabular-nums ${item.color}`}>{item.value}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {kpis.slots_sin_fallback > 0 && (
        <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">
            <strong>{kpis.slots_sin_fallback} slot{kpis.slots_sin_fallback > 1 ? 's' : ''}</strong> sin campaña fallback asignada.
            Ve a la pestaña <strong>Espacios</strong> para asignarla.
          </p>
        </div>
      )}
      {kpis.campanas_pendientes_aprobacion > 0 && (
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">
            <strong>{kpis.campanas_pendientes_aprobacion} campaña{kpis.campanas_pendientes_aprobacion > 1 ? 's' : ''}</strong> pendientes de aprobación.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SLOTS MAP ────────────────────────────────────────────────────────────────

function AdsSlotCard({
  slot, status, activeCampaign, fallbackCampaign, onClick,
}: {
  slot: AdSlot;
  status: 'LIBRE' | 'OCUPADO' | 'RESERVADO' | 'INACTIVO';
  activeCampaign: AdCampaignAdmin | undefined;
  fallbackCampaign: AdCampaignAdmin | undefined;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-3 transition-all hover:opacity-90 ${STATUS_CLS[status]}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{slot.id.replace('MARKET_', '')}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_CLS[status]}`}>{status}</span>
      </div>
      <div className="text-xs font-semibold leading-tight mb-1">{slot.nombre}</div>
      <div className="text-[10px] opacity-60">{FORMATO_LABEL[slot.formato]} · {DEVICE_LABEL[slot.dispositivo]}</div>
      {activeCampaign && (
        <div className="mt-2 text-[10px] text-blue-300 truncate">▶ {activeCampaign.advertiser_name}</div>
      )}
      {!activeCampaign && fallbackCampaign && (
        <div className="mt-2 text-[10px] text-slate-400 truncate">↩ {fallbackCampaign.nombre}</div>
      )}
      {!fallbackCampaign && (
        <div className="mt-2 text-[10px] text-red-400">⚠ Sin fallback</div>
      )}
    </button>
  );
}

function AdsSlotMap({
  slots, campaigns, bookings, onSlotClick, filterDevice, filterStatus,
}: {
  slots: AdSlot[];
  campaigns: AdCampaignAdmin[];
  bookings: AdBookingAdmin[];
  onSlotClick: (s: AdSlot) => void;
  filterDevice: string;
  filterStatus: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const getStatus = (slot: AdSlot) => slotStatus(slot, bookings);
  const getActive = (slot: AdSlot) => campaigns.find(c =>
    c.slot_id === slot.id && c.estado === 'ACTIVE' && c.activa &&
    (c.start_at == null || c.start_at <= today) &&
    (c.end_at == null || c.end_at > today) &&
    c.campaign_source !== 'trabflow'
  );
  const getFallback = (slot: AdSlot) =>
    slot.fallback_campaign_id ? campaigns.find(c => c.id === slot.fallback_campaign_id) : undefined;

  const filtered = slots.filter(s => {
    if (filterDevice !== 'all' && s.dispositivo !== filterDevice) return false;
    if (filterStatus !== 'all' && getStatus(s) !== filterStatus) return false;
    return true;
  });

  const groups = [
    { label: 'Hero', ids: ['MARKET_HOME_HERO_1','MARKET_HOME_HERO_2','MARKET_HOME_HERO_3'] },
    { label: 'Lateral izquierdo', ids: ['MARKET_HOME_LEFT_TOP','MARKET_HOME_LEFT_MID','MARKET_HOME_LEFT_BOTTOM'] },
    { label: 'Lateral derecho', ids: ['MARKET_HOME_RIGHT_TOP','MARKET_HOME_RIGHT_MID','MARKET_HOME_RIGHT_BOTTOM'] },
    { label: 'Mobile promos', ids: ['MARKET_HOME_MOBILE_PROMO_1','MARKET_HOME_MOBILE_PROMO_2'] },
    { label: 'Productos promocionados', ids: ['MARKET_HOME_PROMO_CARD_1','MARKET_HOME_PROMO_CARD_2','MARKET_HOME_PROMO_CARD_3','MARKET_HOME_PROMO_CARD_4'] },
    { label: 'Catálogo', ids: ['MARKET_CATALOG_HERO'] },
  ];

  return (
    <div className="space-y-6">
      {groups.map(g => {
        const groupSlots = g.ids
          .map(id => filtered.find(s => s.id === id))
          .filter(Boolean) as AdSlot[];
        if (groupSlots.length === 0) return null;
        return (
          <div key={g.label}>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{g.label}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {groupSlots.map(slot => (
                <AdsSlotCard
                  key={slot.id}
                  slot={slot}
                  status={getStatus(slot)}
                  activeCampaign={getActive(slot)}
                  fallbackCampaign={getFallback(slot)}
                  onClick={() => onSlotClick(slot)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className="text-center text-slate-500 text-sm py-12">No hay slots que coincidan con los filtros.</div>
      )}
    </div>
  );
}

// ─── SLOT DETAIL PANEL ────────────────────────────────────────────────────────

function AdsSlotDetailPanel({
  slot, campaigns, bookings, actors, onClose, onUpdated, toast,
}: {
  slot: AdSlot;
  campaigns: AdCampaignAdmin[];
  bookings: AdBookingAdmin[];
  actors: MarketplaceActor[];
  onClose: () => void;
  onUpdated: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [savingFb, setSavingFb] = useState(false);
  const [selectedFb, setSelectedFb] = useState(slot.fallback_campaign_id ?? '');

  const today = new Date().toISOString().slice(0, 10);
  const slotCampaigns = campaigns.filter(c => c.slot_id === slot.id);
  const activeCampaign = slotCampaigns.find(c =>
    c.estado === 'ACTIVE' && c.activa &&
    (c.start_at == null || c.start_at <= today) &&
    (c.end_at == null || c.end_at > today)
  );
  const slotBookings = bookings
    .filter(b => b.slot_id === slot.id)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const trabflowCampaigns = slotCampaigns.filter(c => c.campaign_source === 'trabflow' && c.activa && c.estado === 'ACTIVE');

  const handleSaveFallback = async () => {
    setSavingFb(true);
    try {
      if (!selectedFb) {
        toast('error', 'Selecciona una campaña fallback válida');
        return;
      }
      const { error } = await supabase
        .from('trade_marketplace_ad_slots')
        .update({ fallback_campaign_id: selectedFb })
        .eq('id', slot.id);
      if (error) throw error;
      toast('success', 'Fallback actualizado');
      onUpdated();
    } catch (e) {
      toast('error', 'Error al guardar fallback: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingFb(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{slot.id}</div>
            <div className="font-bold text-white">{slot.nombre}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* Datos */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Datos del espacio</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Formato', FORMATO_LABEL[slot.formato]],
                ['Dispositivo', DEVICE_LABEL[slot.dispositivo]],
                ['Página', slot.pagina],
                ['Posición', String(slot.posicion)],
                ['Activo', slot.activo ? '✓ Sí' : '✗ No'],
                ['Comercializable', slot.comercializable ? '✓ Sí' : '✗ No'],
                ['Dimensiones', slot.ancho_px ? `${slot.ancho_px}×${slot.alto_min_px ?? '?'}px` : 'Variable'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-800 rounded p-2">
                  <div className="text-slate-500 text-[9px] font-bold uppercase">{k}</div>
                  <div className="text-white font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaña activa */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Campaña activa</h3>
            {activeCampaign ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_CAMP_CLS[activeCampaign.estado]}`}>
                    {ESTADO_CAMP_LABEL[activeCampaign.estado]}
                  </span>
                  <span className="text-[9px] text-slate-500">{activeCampaign.campaign_source}</span>
                </div>
                <div className="text-sm font-semibold text-white">{activeCampaign.nombre}</div>
                <div className="text-xs text-slate-400">{activeCampaign.advertiser_name}</div>
                <div className="text-xs text-slate-500 mt-1">{activeCampaign.title}</div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">Sin campaña comercial activa ahora mismo.</div>
            )}
          </div>

          {/* Fallback */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Campaña fallback</h3>
            <div className="space-y-2">
              <select
                value={selectedFb}
                onChange={e => setSelectedFb(e.target.value)}
                className={iCls}
              >
                <option value="">— Sin fallback —</option>
                {trabflowCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} — {c.title}</option>
                ))}
              </select>
              {trabflowCampaigns.length === 0 && (
                <p className="text-[10px] text-amber-400">No hay campañas TrabFlow activas para este slot. Crea una primero.</p>
              )}
              <button
                onClick={handleSaveFallback}
                disabled={savingFb || !selectedFb || selectedFb === slot.fallback_campaign_id}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {savingFb ? 'Guardando…' : 'Guardar fallback'}
              </button>
              <p className="text-[9px] text-slate-500">Solo campañas TrabFlow activas pueden ser fallback permanente.</p>
            </div>
          </div>

          {/* Reservas (vista simple) */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Disponibilidad ({slotBookings.length} reservas)
            </h3>
            {slotBookings.length === 0 ? (
              <div className="text-xs text-slate-500">Sin reservas registradas.</div>
            ) : (
              <div className="space-y-1.5">
                {slotBookings.map(b => {
                  const actor = actors.find(a => a.id === b.actor_id);
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-xs bg-slate-800 rounded px-3 py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_BOOK_CLS[b.estado]}`}>
                        {ESTADO_BOOK_LABEL[b.estado]}
                      </span>
                      <span className="text-slate-300">{fmtDate(b.inicio)} — {fmtDate(b.fin)}</span>
                      {actor && <span className="text-slate-500 truncate">{actor.nombre}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SLOT BOX (top-level) ────────────────────────────────────────────────────

function SlotBox({
  className, children, bg, textColor, displayImg,
}: {
  className: string;
  children: React.ReactNode;
  bg: string;
  textColor: string;
  displayImg: string;
}) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden ${className}`}
      style={{ background: displayImg ? undefined : bg, color: textColor }}
    >
      {displayImg && (
        <>
          <img src={displayImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-3">
        {children}
      </div>
    </div>
  );
}

// ─── CAMPAIGN PREVIEW ─────────────────────────────────────────────────────────

function AdsCampaignPreview({
  campaign, formato, localImageUrl,
}: {
  campaign: Partial<CampaignFormData>;
  formato: AdSlot['formato'] | null;
  localImageUrl?: string;
}) {
  const bg         = campaign.bg || 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)';
  const textColor  = campaign.text_color || '#ffffff';
  const accent     = campaign.accent || '#60a5fa';
  const displayImg = localImageUrl || campaign.image_url || '';

  const isVertical = formato === 'banner_vertical';
  const isCard     = formato === 'promo_card';
  const dims       = SLOT_FORMAT_RECOMMENDATIONS[formato ?? 'banner_vertical'];

  return (
    <div className="space-y-3">
      {dims && (
        <p className="text-[10px] text-slate-500">
          Recomendado: <span className="text-slate-300">{dims.w}×{dims.h}px</span> · {dims.label}
        </p>
      )}
      <div className="flex gap-4 flex-wrap">
        <div>
          <div className="text-[9px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1">
            <Monitor className="h-3 w-3" /> Desktop
          </div>
          <SlotBox className={`${isVertical ? 'w-36 h-52' : isCard ? 'w-40 h-40' : 'w-72 h-32'}`} bg={bg} textColor={textColor} displayImg={displayImg}>
            {campaign.eyebrow && (
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">{campaign.eyebrow}</div>
            )}
            <div>
              <div className="text-sm font-bold leading-tight mb-1">{campaign.title || 'Título de la campaña'}</div>
              {campaign.subtitle && <div className="text-[10px] opacity-70">{campaign.subtitle}</div>}
            </div>
            <button className="self-start text-[9px] font-bold px-2 py-1 rounded mt-1" style={{ background: accent, color: '#fff' }}>
              {campaign.cta_label || 'Ver más'}
            </button>
          </SlotBox>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1">
            <Smartphone className="h-3 w-3" /> Mobile
          </div>
          <div
            className="relative rounded-lg overflow-hidden flex items-center gap-3 px-3 py-2 w-60 h-16"
            style={{ background: displayImg ? undefined : bg, color: textColor }}
          >
            {displayImg && (
              <>
                <img src={displayImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50" />
              </>
            )}
            <div className="relative z-10 flex items-center gap-3 w-full">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate">{campaign.title || 'Título campaña'}</div>
                <div className="text-[9px] opacity-60 truncate">{campaign.eyebrow || ''}</div>
              </div>
              <button className="text-[9px] font-bold px-2 py-1 rounded shrink-0" style={{ background: accent }}>
                {campaign.cta_label || 'Ver'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGN FORM MODAL ──────────────────────────────────────────────────────

function AdsCampaignFormModal({
  initial, slots, bookings, actors, onClose, onSaved, toast, defaultSlotId,
}: {
  initial:       AdCampaignAdmin | null;
  slots:         AdSlot[];
  bookings:      AdBookingAdmin[];
  actors:        MarketplaceActor[];   // ya filtrados: solo supplier + active
  onClose:       () => void;
  onSaved:       () => void;
  toast:         (t: 'success' | 'error' | 'info', m: string) => void;
  defaultSlotId?: string | null;
}) {
  const [form, setForm] = useState<CampaignFormData>(
    initial
      ? {
          slot_id:           initial.slot_id,
          campaign_source:   initial.campaign_source,
          actor_id:          initial.actor_id ?? '',
          nombre:            initial.nombre,
          advertiser_name:   initial.advertiser_name,
          eyebrow:           initial.eyebrow ?? '',
          title:             initial.title,
          subtitle:          initial.subtitle ?? '',
          cta_label:         initial.cta_label,
          destination_type:  initial.destination_type,
          destination_value: initial.destination_value ?? '',
          oficio:            initial.oficio ?? '',
          priority:          String(initial.priority),
          start_at:          initial.start_at ? initial.start_at.slice(0, 10) : '',
          end_at:            initial.end_at   ? initial.end_at.slice(0, 10)   : '',
          accent:            initial.accent     ?? '#60a5fa',
          bg:                initial.bg         ?? 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)',
          text_color:        initial.text_color ?? '#ffffff',
          estado:            initial.estado,
          activa:            initial.activa,
          image_url:         initial.image_url        ?? '',
          mobile_image_url:  initial.mobile_image_url ?? '',
        }
      : { ...EMPTY_CAMPAIGN, slot_id: defaultSlotId ?? EMPTY_CAMPAIGN.slot_id }
  );

  // Lock slot selector when defaultSlotId provided (navigated from slot map, new campaign only)
  const isDefaultSlotLocked = !initial && !!defaultSlotId;

  const [saving,          setSaving]          = useState(false);
  const [showPreview,     setShowPreview]     = useState(false);
  const [showAdvanced,    setShowAdvanced]    = useState(false);
  const [imageFile,       setImageFile]       = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
  const [imageWarning,    setImageWarning]    = useState('');
  const [uploadingImage,  setUploadingImage]  = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSlot = slots.find(s => s.id === form.slot_id);

  // E4.A: Detección de fallback por relación DB, NO por nombre
  const isFallback = initial
    ? slots.some(s => s.fallback_campaign_id === initial.id)
    : false;

  // E4.A: Slot locking — reglas A/B/C/D
  let slotLockReason: string | null = null;
  if (isFallback) {
    slotLockReason = 'Campaña institucional protegida';
  } else if (initial && (initial.estado === 'ACTIVE' || initial.estado === 'SCHEDULED')) {
    slotLockReason = `Campaña ${ESTADO_CAMP_LABEL[initial.estado].toLowerCase()} — slot bloqueado`;
  } else if (initial) {
    const hasActiveBooking = bookings.some(b =>
      b.slot_id === initial.slot_id &&
      (b.estado === 'RESERVED' || b.estado === 'CONFIRMED')
    );
    if (hasActiveBooking) slotLockReason = 'Espacio con reserva activa';
  }
  if (isDefaultSlotLocked && !slotLockReason) slotLockReason = 'Espacio preseleccionado desde el mapa';
  const isSlotLocked   = slotLockReason !== null;
  const isSourceLocked = isFallback;

  const set = (k: keyof CampaignFormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── Image handling ──────────────────────────────────────────────────────────

  function processFile(file: File) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast('error', 'Formato no permitido. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('error', 'La imagen supera el límite de 5 MB.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImageDimensions({ w, h });
      const rec = SLOT_FORMAT_RECOMMENDATIONS[selectedSlot?.formato ?? 'banner_vertical'];
      if (rec) {
        const diff = Math.abs(w / h - rec.w / rec.h) / (rec.w / rec.h);
        setImageWarning(diff > 0.2
          ? `Proporción distinta a la recomendada (${rec.w}×${rec.h}px). La imagen puede aparecer recortada.`
          : ''
        );
      } else {
        setImageWarning('');
      }
    };
    img.src = objectUrl;
    setImagePreviewUrl(objectUrl);
    setImageFile(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreviewUrl('');
    setImageDimensions(null);
    setImageWarning('');
    set('image_url', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.slot_id || !form.nombre.trim() || !form.title.trim() || !form.cta_label.trim()) {
      toast('error', 'Espacio, nombre, título y CTA son obligatorios.');
      return;
    }
    if (form.campaign_source === 'supplier' && !form.actor_id && form.estado !== 'DRAFT') {
      toast('error', 'Asigna un proveedor antes de avanzar a este estado.');
      return;
    }
    if (form.destination_type === 'product' || form.destination_type === 'offer') {
      toast('error', 'Ese tipo de destino aún no está disponible.');
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = form.image_url;
      if (imageFile) {
        setUploadingImage(true);
        finalImageUrl = await uploadAdImage(imageFile, initial?.id ?? null);
        setUploadingImage(false);
      }
      const payload = {
        slot_id:           form.slot_id,
        campaign_source:   form.campaign_source,
        actor_id:          form.actor_id || null,
        nombre:            form.nombre.trim(),
        advertiser_name:   form.advertiser_name,
        eyebrow:           form.eyebrow || null,
        title:             form.title.trim(),
        subtitle:          form.subtitle || null,
        cta_label:         form.cta_label.trim(),
        destination_type:  form.destination_type,
        destination_value: form.destination_value || null,
        oficio:            form.oficio || null,
        priority:          parseInt(form.priority) || 10,
        start_at:          form.start_at || null,
        end_at:            form.end_at   || null,
        accent:            form.accent     || null,
        bg:                form.bg         || null,
        text_color:        form.text_color || null,
        estado:            form.estado,
        activa:            form.activa,
        image_url:         finalImageUrl          || null,
        mobile_image_url:  form.mobile_image_url  || null,
      };
      if (initial) {
        const { error } = await supabase
          .from('trade_marketplace_ad_campaigns')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', initial.id);
        if (error) throw error;
        toast('success', 'Campaña actualizada');
      } else {
        const { error } = await supabase
          .from('trade_marketplace_ad_campaigns')
          .insert(payload);
        if (error) throw error;
        toast('success', 'Campaña creada');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const currentImageUrl = imagePreviewUrl || form.image_url;
  const humanSlotName   = selectedSlot?.nombre ?? form.slot_id.replace('MARKET_', '').replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl my-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="font-bold text-white text-sm">{initial ? 'Editar campaña' : 'Nueva campaña'}</h2>
            {isFallback && (
              <div className="flex items-center gap-1.5 mt-1">
                <Lock className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Fallback TrabFlow · Campaña institucional protegida
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* ── INFORMACIÓN ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Información</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lCls}>Nombre interno *</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={iCls} placeholder="Ej: Campaña Electricidad Agosto" />
              </div>
              <div>
                <label className={lCls}>Tipo *</label>
                {isSourceLocked ? (
                  <div className={`${iCls} flex items-center gap-2 opacity-60 cursor-not-allowed`}>
                    <Lock className="h-3 w-3 text-amber-400" />
                    <span>TrabFlow (protegido)</span>
                  </div>
                ) : (
                  <select value={form.campaign_source} onChange={e => set('campaign_source', e.target.value as CampaignFormData['campaign_source'])} className={iCls}>
                    <option value="trabflow">TrabFlow (editorial)</option>
                    <option value="supplier">Proveedor (comercial)</option>
                    <option value="demo">Demo</option>
                  </select>
                )}
              </div>
              <div>
                <label className={lCls}>Espacio *</label>
                {isSlotLocked ? (
                  <div className={`${iCls} flex items-center gap-2 opacity-60 cursor-not-allowed`} title={slotLockReason ?? ''}>
                    <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-200 truncate">{humanSlotName}</div>
                      <div className="text-[10px] text-slate-500 truncate">{form.slot_id}</div>
                    </div>
                  </div>
                ) : (
                  <select value={form.slot_id} onChange={e => set('slot_id', e.target.value)} className={iCls}>
                    <option value="">— Selecciona espacio —</option>
                    {slots.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre} · {s.id.replace('MARKET_', '')}</option>
                    ))}
                  </select>
                )}
                {slotLockReason && (
                  <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5 shrink-0" />{slotLockReason}
                  </p>
                )}
              </div>
              {form.campaign_source === 'supplier' && !isFallback && (
                <div className="col-span-2">
                  <label className={lCls}>Proveedor *</label>
                  <select value={form.actor_id} onChange={e => set('actor_id', e.target.value)} className={iCls}>
                    <option value="">— Selecciona proveedor —</option>
                    {actors.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  {actors.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">No hay proveedores activos registrados.</p>
                  )}
                  {form.campaign_source === 'supplier' && !form.actor_id && form.estado !== 'DRAFT' && (
                    <p className="text-[10px] text-red-400 mt-1">Obligatorio para estado {form.estado}.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── CONTENIDO ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Contenido</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>¿Qué quieres promocionar? *</label>
                <select value={form.destination_type} onChange={e => set('destination_type', e.target.value as CampaignFormData['destination_type'])} className={iCls}>
                  <option value="catalog">Catálogo general</option>
                  <option value="category">Categoría</option>
                  <option value="supplier">Proveedor específico</option>
                  <option value="search">Búsqueda libre</option>
                  <option value="product" disabled>Producto (próximamente)</option>
                  <option value="offer" disabled>Oferta (próximamente)</option>
                </select>
              </div>
              <div>
                <label className={lCls}>
                  {form.destination_type === 'category' ? 'Categoría (slug)' :
                   form.destination_type === 'search'   ? 'Término de búsqueda' :
                   form.destination_type === 'supplier' ? 'Nombre del proveedor' : 'Valor (no aplica)'}
                </label>
                <input
                  value={form.destination_value}
                  onChange={e => set('destination_value', e.target.value)}
                  className={iCls}
                  placeholder={
                    form.destination_type === 'category' ? 'electricidad' :
                    form.destination_type === 'search'   ? 'cable rojo 2.5mm' :
                    form.destination_type === 'supplier' ? 'Würth España' : ''
                  }
                  disabled={form.destination_type === 'catalog'}
                />
              </div>
              <div>
                <label className={lCls}>Eyebrow / Etiqueta</label>
                <input value={form.eyebrow} onChange={e => set('eyebrow', e.target.value)} className={iCls} placeholder="Oferta del mes" />
              </div>
              <div>
                <label className={lCls}>Nombre del anunciante</label>
                <input value={form.advertiser_name} onChange={e => set('advertiser_name', e.target.value)} className={iCls} />
              </div>
              <div className="col-span-2">
                <label className={lCls}>Título *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} className={iCls} placeholder="Electricidad profesional para instaladores" />
              </div>
              <div className="col-span-2">
                <label className={lCls}>Subtítulo</label>
                <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>CTA (botón) *</label>
                <input value={form.cta_label} onChange={e => set('cta_label', e.target.value)} className={iCls} placeholder="Ver catálogo" />
              </div>
            </div>
          </section>

          {/* ── CREATIVIDAD ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Creatividad</h3>
            {!currentImageUrl ? (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-6 py-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-900/40'
                }`}
              >
                <Upload className="h-7 w-7 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm text-slate-300">Arrastra una imagen aquí</p>
                  <p className="text-xs text-slate-500 mt-0.5">o</p>
                  <p className="text-xs font-semibold text-blue-400 mt-0.5">Seleccionar imagen</p>
                </div>
                <p className="text-[10px] text-slate-600">JPG · PNG · WebP · máx. 5 MB</p>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <img src={currentImageUrl} alt="preview" className="w-24 h-16 object-cover rounded-lg border border-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {imageFile ? (
                      <>
                        <p className="text-xs font-semibold text-slate-200 truncate">{imageFile.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {imageDimensions ? `${imageDimensions.w}×${imageDimensions.h}px · ` : ''}
                          {(imageFile.size / 1024).toFixed(0)} KB
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-500 break-all">{form.image_url.slice(0, 80)}{form.image_url.length > 80 ? '…' : ''}</p>
                    )}
                    {imageWarning && (
                      <p className="text-[10px] text-amber-400 mt-1 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />{imageWarning}
                      </p>
                    )}
                    {selectedSlot && SLOT_FORMAT_RECOMMENDATIONS[selectedSlot.formato] && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        Recomendado: {SLOT_FORMAT_RECOMMENDATIONS[selectedSlot.formato]!.w}×{SLOT_FORMAT_RECOMMENDATIONS[selectedSlot.formato]!.h}px
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer">
                      Reemplazar
                    </button>
                    <button onClick={handleRemoveImage} className="px-2 py-1 rounded text-[10px] font-semibold bg-red-900/40 hover:bg-red-900/60 text-red-300 cursor-pointer">
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={handleFileInputChange} />
          </section>

          {/* ── PROGRAMACIÓN ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Programación</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lCls}>Inicio (opcional)</label>
                <input type="date" value={form.start_at} onChange={e => set('start_at', e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>Fin (opcional)</label>
                <input type="date" value={form.end_at} onChange={e => set('end_at', e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>Estado</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value as CampaignFormData['estado'])} className={iCls}>
                  {(Object.keys(ESTADO_CAMP_LABEL) as AdCampaignAdmin['estado'][]).map(s => (
                    <option key={s} value={s}>{ESTADO_CAMP_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── CONFIGURACIÓN AVANZADA ── */}
          <section>
            <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors w-full">
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Configuración avanzada
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className={lCls}>Prioridad</label>
                  <input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} className={iCls} min={0} max={999} />
                </div>
                <div>
                  <label className={lCls}>Oficio (fallback matching)</label>
                  <input value={form.oficio} onChange={e => set('oficio', e.target.value)} className={iCls} placeholder="electricidad" />
                </div>
                <div>
                  <label className={lCls}>Accent color</label>
                  <div className="flex gap-2">
                    <input type="color" value={form.accent} onChange={e => set('accent', e.target.value)} className="h-[38px] w-12 rounded border border-slate-600 bg-slate-700 cursor-pointer p-0.5" />
                    <input value={form.accent} onChange={e => set('accent', e.target.value)} className={`${iCls} flex-1`} placeholder="#60a5fa" />
                  </div>
                </div>
                <div>
                  <label className={lCls}>Color texto</label>
                  <div className="flex gap-2">
                    <input type="color" value={form.text_color} onChange={e => set('text_color', e.target.value)} className="h-[38px] w-12 rounded border border-slate-600 bg-slate-700 cursor-pointer p-0.5" />
                    <input value={form.text_color} onChange={e => set('text_color', e.target.value)} className={`${iCls} flex-1`} placeholder="#ffffff" />
                  </div>
                </div>
                <div className="col-span-3">
                  <label className={lCls}>Background (CSS)</label>
                  <input value={form.bg} onChange={e => set('bg', e.target.value)} className={iCls} placeholder="linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)" />
                </div>
                <div className="col-span-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.activa} onChange={e => set('activa', e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-300">Campaña activa (visible en RPC)</span>
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* ── PREVIEW ── */}
          <section>
            <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Ocultar preview' : 'Ver preview'}
            </button>
            {showPreview && (
              <div className="mt-3 p-3 bg-slate-900 rounded-lg">
                <AdsCampaignPreview campaign={form} formato={selectedSlot?.formato ?? null} localImageUrl={imagePreviewUrl} />
              </div>
            )}
          </section>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors"
          >
            {uploadingImage ? 'Subiendo imagen…' : saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── CAMPAIGNS LIST ───────────────────────────────────────────────────────────

function AdsCampaignsList({
  campaigns, slots, bookings, actors, onRefresh, toast,
  preSelectSlotId, onCampaignSlotConsumed,
}: {
  campaigns: AdCampaignAdmin[];
  slots: AdSlot[];
  bookings: AdBookingAdmin[];
  actors: MarketplaceActor[];
  onRefresh: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
  preSelectSlotId?: string | null;
  onCampaignSlotConsumed?: () => void;
}) {
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterSlot, setFilterSlot] = useState('all');
  const [editCampaign, setEditCampaign] = useState<AdCampaignAdmin | null | 'new'>('null_sentinel' as unknown as null);
  const [showForm, setShowForm] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  // Auto-open form when navigated from slot map
  useEffect(() => {
    if (preSelectSlotId) {
      setEditCampaign(null);
      setShowForm(true);
      onCampaignSlotConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectSlotId]);

  const filtered = campaigns.filter(c => {
    if (filterEstado !== 'all' && c.estado !== filterEstado) return false;
    if (filterSource !== 'all' && c.campaign_source !== filterSource) return false;
    if (filterSlot !== 'all' && c.slot_id !== filterSlot) return false;
    return true;
  });

  const handleTransition = async (campaign: AdCampaignAdmin, newEstado: AdCampaignAdmin['estado']) => {
    if (newEstado === 'PENDING_APPROVAL' && campaign.campaign_source === 'supplier' && !campaign.actor_id) {
      toast('error', 'Asigna un proveedor antes de enviar a aprobación.');
      return;
    }
    setTransitioning(campaign.id);
    try {
      const updates: Partial<AdCampaignAdmin> = { estado: newEstado };
      if (newEstado === 'ACTIVE') updates.activa = true;
      if (newEstado === 'PAUSED' || newEstado === 'FINISHED') updates.activa = false;
      if (newEstado === 'SCHEDULED') updates.activa = false;
      const { error } = await supabase
        .from('trade_marketplace_ad_campaigns')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', campaign.id);
      if (error) throw error;
      toast('success', `Campaña → ${ESTADO_CAMP_LABEL[newEstado]}`);
      onRefresh();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTransitioning(null);
    }
  };

  const handleDuplicate = async (c: AdCampaignAdmin) => {
    try {
      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = c;
      const { error } = await supabase.from('trade_marketplace_ad_campaigns').insert({
        ...rest, nombre: rest.nombre + ' (copia)', estado: 'DRAFT', activa: false,
      });
      if (error) throw error;
      toast('success', 'Campaña duplicada como DRAFT');
      onRefresh();
    } catch (e) {
      toast('error', 'Error al duplicar: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-white">Campañas ({filtered.length})</h2>
        <button
          onClick={() => { setEditCampaign(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva campaña
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los estados</option>
          {(Object.keys(ESTADO_CAMP_LABEL) as AdCampaignAdmin['estado'][]).map(e => (
            <option key={e} value={e}>{ESTADO_CAMP_LABEL[e]}</option>
          ))}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todas las fuentes</option>
          <option value="trabflow">TrabFlow</option>
          <option value="supplier">Proveedor</option>
          <option value="demo">Demo</option>
        </select>
        <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los slots</option>
          {slots.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-12">No hay campañas que coincidan con los filtros.</div>
        )}
        {filtered.map(c => {
          const slot = slots.find(s => s.id === c.slot_id);
          const actor = actors.find(a => a.id === c.actor_id);
          const transitions = VALID_TRANSITIONS[c.estado];
          const isCampaignFallback = slots.some(s => s.fallback_campaign_id === c.id);
          return (
            <div key={c.id} className={`border rounded-lg p-3 ${isCampaignFallback ? 'bg-amber-950/20 border-amber-700/30' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_CAMP_CLS[c.estado]}`}>
                      {ESTADO_CAMP_LABEL[c.estado]}
                    </span>
                    <span className="text-[9px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{c.campaign_source}</span>
                    {c.activa && <span className="text-[9px] text-emerald-400 font-bold">● ACTIVA</span>}
                    {isCampaignFallback && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400">
                        <Lock className="h-2.5 w-2.5" /> FALLBACK
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white truncate">{c.nombre}</div>
                  <div className="text-xs text-slate-400">{c.advertiser_name} · {slot?.nombre ?? c.slot_id}</div>
                  {actor && <div className="text-xs text-slate-500">{actor.nombre}</div>}
                  <div className="text-xs text-slate-500 mt-0.5">{c.title}</div>
                  {(c.start_at || c.end_at) && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {fmtDate(c.start_at)} → {c.end_at ? fmtDate(c.end_at) : 'sin fin'}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => { setEditCampaign(c); setShowForm(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleDuplicate(c)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                  >
                    Duplicar
                  </button>
                  {transitions.map(t => (
                    <button
                      key={t}
                      onClick={() => handleTransition(c, t)}
                      disabled={transitioning === c.id}
                      className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
                        t === 'ACTIVE' ? 'bg-emerald-700 hover:bg-emerald-600 text-white' :
                        t === 'REJECTED' ? 'bg-red-800 hover:bg-red-700 text-white' :
                        t === 'PAUSED' ? 'bg-yellow-800 hover:bg-yellow-700 text-white' :
                        'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {ESTADO_CAMP_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <AdsCampaignFormModal
          initial={editCampaign instanceof Object && editCampaign !== null && 'id' in editCampaign ? editCampaign as AdCampaignAdmin : null}
          slots={slots}
          bookings={bookings}
          actors={actors}
          onClose={() => setShowForm(false)}
          onSaved={onRefresh}
          toast={toast}
          defaultSlotId={editCampaign === null ? preSelectSlotId : null}
        />
      )}
    </div>
  );
}

// ─── BOOKING FORM MODAL ───────────────────────────────────────────────────────

function AdsBookingFormModal({
  initial, slots, actors, onClose, onSaved, toast,
}: {
  initial: AdBookingAdmin | null;
  slots: AdSlot[];
  actors: MarketplaceActor[];
  onClose: () => void;
  onSaved: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [form, setForm] = useState<BookingFormData>(
    initial
      ? { slot_id: initial.slot_id, actor_id: initial.actor_id, inicio: initial.inicio, fin: initial.fin, estado: initial.estado, notas: initial.notas ?? '' }
      : { ...EMPTY_BOOKING }
  );
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BookingFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const checkAvailability = useCallback(async () => {
    if (!form.slot_id || !form.inicio || !form.fin) return;
    setCheckingAvail(true);
    try {
      const { data, error } = await supabase.rpc('admin_check_slot_availability', {
        p_slot_id: form.slot_id, p_inicio: form.inicio, p_fin: form.fin,
        p_exclude_booking_id: initial?.id ?? null,
      });
      if (error) throw error;
      setAvailability(data as boolean);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvail(false);
    }
  }, [form.slot_id, form.inicio, form.fin, initial?.id]);

  const handleSave = async () => {
    if (!form.slot_id || !form.actor_id || !form.inicio || !form.fin) {
      toast('error', 'Slot, proveedor, inicio y fin son obligatorios.');
      return;
    }
    if (form.inicio > form.fin) {
      toast('error', 'La fecha de inicio debe ser anterior al fin.');
      return;
    }
    setSaving(true);
    try {
      const payload = { slot_id: form.slot_id, actor_id: form.actor_id, inicio: form.inicio, fin: form.fin, estado: form.estado, notas: form.notas || null, origen: 'admin' as const };
      if (initial) {
        const { error } = await supabase.from('trade_marketplace_ad_bookings').update(payload).eq('id', initial.id);
        if (error) throw error;
        toast('success', 'Reserva actualizada');
      } else {
        const { error } = await supabase.from('trade_marketplace_ad_bookings').insert(payload);
        if (error) {
          // Trigger anti-overlap returns exclusion_violation
          if (error.message?.includes('Booking solapado') || error.code === '23P01') {
            toast('error', 'Este espacio ya está reservado para esas fechas.');
          } else {
            throw error;
          }
          return;
        }
        toast('success', 'Reserva creada');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-bold text-white text-sm">{initial ? 'Editar reserva' : 'Nueva reserva'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={lCls}>Slot *</label>
            <select value={form.slot_id} onChange={e => { set('slot_id', e.target.value); setAvailability(null); }} className={iCls}>
              <option value="">— Selecciona slot —</option>
              {slots.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={lCls}>Proveedor (actor) *</label>
            <select value={form.actor_id} onChange={e => set('actor_id', e.target.value)} className={iCls}>
              <option value="">— Selecciona proveedor —</option>
              {actors.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            {actors.length === 0 && <p className="text-[10px] text-amber-400 mt-1">No hay proveedores activos registrados.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lCls}>Inicio *</label>
              <input type="date" value={form.inicio} onChange={e => { set('inicio', e.target.value); setAvailability(null); }} className={iCls} />
            </div>
            <div>
              <label className={lCls}>Fin *</label>
              <input type="date" value={form.fin} onChange={e => { set('fin', e.target.value); setAvailability(null); }} className={iCls} />
            </div>
          </div>
          {/* Availability check */}
          <div className="flex items-center gap-3">
            <button
              onClick={checkAvailability}
              disabled={!form.slot_id || !form.inicio || !form.fin || checkingAvail}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {checkingAvail ? 'Comprobando…' : 'Comprobar disponibilidad'}
            </button>
            {availability === true && (
              <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="h-3.5 w-3.5" /> Disponible</span>
            )}
            {availability === false && (
              <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" /> No disponible</span>
            )}
          </div>
          <div>
            <label className={lCls}>Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value as BookingFormData['estado'])} className={iCls}>
              {(Object.keys(ESTADO_BOOK_LABEL) as AdBookingAdmin['estado'][]).map(e => (
                <option key={e} value={e}>{ESTADO_BOOK_LABEL[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lCls}>Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} className={`${iCls} h-20 resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : initial ? 'Guardar' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CONVERT BOOKING MODAL ───────────────────────────────────────────────────

function AdsConvertBookingModal({
  booking, slots, actors, onClose, onConverted, toast,
}: {
  booking:     AdBookingAdmin;
  slots:       AdSlot[];
  actors:      MarketplaceActor[];
  onClose:     () => void;
  onConverted: () => void;
  toast:       (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const slot  = slots.find(s => s.id === booking.slot_id);
  const actor = actors.find(a => a.id === booking.actor_id);
  const [inicio, setInicio] = useState(booking.inicio);
  const [fin,    setFin]    = useState(booking.fin);
  const [saving, setSaving] = useState(false);

  const handleConvert = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_convert_request_to_booking', {
        p_request_id: booking.id,
        p_inicio:     inicio,
        p_fin:        fin,
      });
      if (error) {
        if (error.message?.includes('solapado') || error.code === '23P01') {
          toast('error', 'El slot ya está reservado en esas fechas.');
        } else throw error;
      } else {
        toast('success', 'Solicitud convertida a reserva (RESERVED)');
        onConverted();
        onClose();
      }
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Crear reserva</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Convierte la solicitud en reserva RESERVED</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase w-12">Slot</span>
            <span className="text-slate-200">{slot?.nombre ?? booking.slot_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase w-12">Actor</span>
            <span className="text-slate-200">{actor?.nombre ?? booking.actor_id}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lCls}>Desde</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={iCls} />
          </div>
          <div>
            <label className={lCls}>Hasta</label>
            <input type="date" value={fin} onChange={e => setFin(e.target.value)} min={inicio} className={iCls} />
          </div>
        </div>
        <p className="text-[10px] text-amber-400">
          El sistema verificará que no haya solapamiento con reservas RESERVED/CONFIRMED existentes.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={saving || !inicio || !fin || fin < inicio}
            className="px-4 py-1.5 rounded text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creando…' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SOLICITUDES TAB ──────────────────────────────────────────────────────────

function AdsSolicitudesTab({
  bookings, slots, actors, onRefresh, toast,
}: {
  bookings: AdBookingAdmin[];
  slots:    AdSlot[];
  actors:   MarketplaceActor[];
  onRefresh: () => void;
  toast:    (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [filterEstado,   setFilterEstado]   = useState('all');
  const [filterSlot,     setFilterSlot]     = useState('all');
  const [transitioning,  setTransitioning]  = useState<string | null>(null);
  const [convertBooking, setConvertBooking] = useState<AdBookingAdmin | null>(null);

  const solicitudes = bookings
    .filter(b => ['REQUESTED','CONTACTING','ACCEPTED','REJECTED','CANCELLED'].includes(b.estado))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const filtered = solicitudes.filter(b => {
    if (filterEstado !== 'all' && b.estado !== filterEstado) return false;
    if (filterSlot   !== 'all' && b.slot_id !== filterSlot)  return false;
    return true;
  });

  const handleTransition = async (booking: AdBookingAdmin, newEstado: string) => {
    setTransitioning(booking.id);
    try {
      const { error } = await supabase.rpc('admin_update_ad_request_status', {
        p_request_id: booking.id,
        p_status:     newEstado,
      });
      if (error) throw error;
      toast('success', `Solicitud → ${ESTADO_BOOK_LABEL[newEstado as AdBookingAdmin['estado']] ?? newEstado}`);
      onRefresh();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTransitioning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-white">
          Solicitudes de espacios ({solicitudes.length})
        </h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los estados</option>
          <option value="REQUESTED">Nuevas</option>
          <option value="CONTACTING">En contacto</option>
          <option value="ACCEPTED">Aceptadas</option>
          <option value="REJECTED">Rechazadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los espacios</option>
          {slots.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-12">No hay solicitudes que coincidan.</div>
        )}
        {filtered.map(b => {
          const slot  = slots.find(s => s.id === b.slot_id);
          const actor = actors.find(a => a.id === b.actor_id);
          const transitions = SOLICITUD_TRANSITIONS[b.estado] ?? [];
          const isNew = b.estado === 'REQUESTED';

          return (
            <div key={b.id} className={`border rounded-xl p-4 ${isNew ? 'bg-amber-950/10 border-amber-700/30' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_BOOK_CLS[b.estado]}`}>
                      {ESTADO_BOOK_LABEL[b.estado]}
                    </span>
                    {b.origen === 'portal_request' && (
                      <span className="text-[9px] text-teal-500 font-bold">portal</span>
                    )}
                    <span className="text-[9px] text-slate-600 font-mono">{b.id.slice(0, 8)}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{slot?.nombre ?? b.slot_id}</div>
                  <div className="text-xs text-slate-400">{actor?.nombre ?? b.actor_id}</div>
                  <div className="text-xs text-slate-500">{fmtDate(b.inicio)} — {fmtDate(b.fin)}</div>
                  {b.mensaje && (
                    <div className="mt-1.5 text-[11px] text-slate-400 italic bg-slate-900/50 rounded px-2.5 py-1.5 border border-slate-700/50">
                      "{b.mensaje}"
                    </div>
                  )}
                  {b.notas && (
                    <div className="text-[10px] text-blue-400 mt-1">
                      <span className="font-bold">Nota admin:</span> {b.notas}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {b.estado === 'ACCEPTED' && (
                    <button
                      onClick={() => setConvertBooking(b)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Crear reserva
                    </button>
                  )}
                  {transitions.map(t => (
                    <button
                      key={t}
                      onClick={() => handleTransition(b, t)}
                      disabled={transitioning === b.id}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer disabled:opacity-50 transition-colors ${
                        t === 'ACCEPTED'   ? 'bg-teal-800 hover:bg-teal-700 text-white'     :
                        t === 'REJECTED'   ? 'bg-red-800 hover:bg-red-700 text-white'       :
                        t === 'CONTACTING' ? 'bg-blue-800 hover:bg-blue-700 text-slate-100' :
                        'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {ESTADO_BOOK_LABEL[t as AdBookingAdmin['estado']] ?? t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {convertBooking && (
        <AdsConvertBookingModal
          booking={convertBooking}
          slots={slots}
          actors={actors}
          onClose={() => setConvertBooking(null)}
          onConverted={() => { setConvertBooking(null); onRefresh(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── BOOKINGS LIST ────────────────────────────────────────────────────────────

function AdsBookingsList({
  bookings, slots, actors, onRefresh, toast,
}: {
  bookings: AdBookingAdmin[];
  slots: AdSlot[];
  actors: MarketplaceActor[];
  onRefresh: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterSlot, setFilterSlot] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editBooking, setEditBooking] = useState<AdBookingAdmin | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const filtered = bookings.filter(b => {
    if (!['RESERVED','CONFIRMED','CANCELLED','EXPIRED'].includes(b.estado)) return false;
    if (filterEstado !== 'all' && b.estado !== filterEstado) return false;
    if (filterSlot   !== 'all' && b.slot_id !== filterSlot)  return false;
    return true;
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));

  const handleTransition = async (booking: AdBookingAdmin, newEstado: AdBookingAdmin['estado']) => {
    setTransitioning(booking.id);
    try {
      const { error } = await supabase
        .from('trade_marketplace_ad_bookings')
        .update({ estado: newEstado })
        .eq('id', booking.id);
      if (error) {
        if (error.message?.includes('Booking solapado') || error.code === '23P01') {
          toast('error', 'Este espacio ya está reservado para esas fechas.');
        } else throw error;
      } else {
        toast('success', `Reserva → ${ESTADO_BOOK_LABEL[newEstado]}`);
        onRefresh();
      }
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTransitioning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-white">Reservas ({filtered.length})</h2>
        <button
          onClick={() => { setEditBooking(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva reserva
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los estados</option>
          <option value="RESERVED">Reservada</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="CANCELLED">Cancelada</option>
          <option value="EXPIRED">Expirada</option>
        </select>
        <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todos los slots</option>
          {slots.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center text-slate-500 text-sm py-12">No hay reservas.</div>}
        {filtered.map(b => {
          const slot = slots.find(s => s.id === b.slot_id);
          const actor = actors.find(a => a.id === b.actor_id);
          const transitions = VALID_BOOK_TRANSITIONS[b.estado];
          return (
            <div key={b.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_BOOK_CLS[b.estado]}`}>
                      {ESTADO_BOOK_LABEL[b.estado]}
                    </span>
                    <span className="text-[9px] text-slate-500">{b.origen}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{slot?.nombre ?? b.slot_id}</div>
                  {actor && <div className="text-xs text-slate-400">{actor.nombre}</div>}
                  <div className="text-xs text-slate-500 mt-0.5">{fmtDate(b.inicio)} — {fmtDate(b.fin)}</div>
                  {b.notas && <div className="text-xs text-slate-500 mt-0.5 italic">{b.notas}</div>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => { setEditBooking(b); setShowForm(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  {transitions.map(t => (
                    <button
                      key={t}
                      onClick={() => handleTransition(b, t)}
                      disabled={transitioning === b.id}
                      className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer disabled:opacity-50 transition-colors ${
                        t === 'CONFIRMED' ? 'bg-emerald-700 hover:bg-emerald-600 text-white' :
                        t === 'CANCELLED' ? 'bg-red-800 hover:bg-red-700 text-white' :
                        'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {ESTADO_BOOK_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showForm && (
        <AdsBookingFormModal
          initial={editBooking}
          slots={slots}
          actors={actors}
          onClose={() => { setShowForm(false); setEditBooking(null); }}
          onSaved={onRefresh}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── CREATIVE SUB-COMPONENTS (todos top-level — no componentes anidados) ─────

function CreativeModeSelector({ value, onChange }: { value: CreativeMode; onChange: (m: CreativeMode) => void }) {
  return (
    <div className="space-y-2">
      {(Object.entries(CREATIVE_MODE_INFO) as [CreativeMode, (typeof CREATIVE_MODE_INFO)[CreativeMode]][]).map(([mode, info]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`w-full text-left border rounded-lg px-4 py-3 transition-all cursor-pointer ${
            value === mode
              ? 'border-blue-500 bg-blue-900/20 text-white'
              : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{info.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {mode === 'IMAGE_CONTENT' && (
                <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">Recomendado</span>
              )}
              {value === mode && <CheckCircle className="h-3.5 w-3.5 text-blue-400" />}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{info.desc}</p>
        </button>
      ))}
    </div>
  );
}

function TextPositionControl({ value, onChange }: { value: TextPosition; onChange: (p: TextPosition) => void }) {
  const opts: { v: TextPosition; Icon: React.ElementType; label: string }[] = [
    { v: 'LEFT',   Icon: AlignLeft,   label: 'Izquierda' },
    { v: 'CENTER', Icon: AlignCenter, label: 'Centro'    },
    { v: 'RIGHT',  Icon: AlignRight,  label: 'Derecha'   },
  ];
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          title={o.label}
          onClick={() => onChange(o.v)}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
            value === o.v ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          <o.Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function OverlayStrengthControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const levels: { v: number; label: string }[] = [
    { v: 0,  label: '0%'  },
    { v: 20, label: '20%' },
    { v: 35, label: '35%' },
    { v: 50, label: '50%' },
    { v: 65, label: '65%' },
  ];
  return (
    <div className="flex gap-1">
      {levels.map(l => (
        <button
          key={l.v}
          type="button"
          onClick={() => onChange(l.v)}
          className={`flex-1 py-1.5 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
            value === l.v ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-slate-700 text-slate-500 hover:border-slate-600'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function ThemePresetSelector({ value, onChange }: { value: ThemePreset; onChange: (t: ThemePreset) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(Object.entries(THEME_PRESETS) as [ThemePreset, ThemePresetDef][]).map(([preset, def]) => (
        <button
          key={preset}
          type="button"
          title={def.label}
          onClick={() => onChange(preset)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
            value === preset ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-700 hover:border-slate-600'
          }`}
          style={{ background: def.bg }}
        >
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: def.accent }} />
          <span className="text-[10px] font-semibold" style={{ color: def.text }}>{def.label}</span>
        </button>
      ))}
    </div>
  );
}

function PriceDisplaySection({
  priceDisplay, oldPriceDisplay, discountLabel, onChange,
}: {
  priceDisplay: string; oldPriceDisplay: string; discountLabel: string;
  onChange: (field: 'price_display' | 'old_price_display' | 'discount_label', val: string) => void;
}) {
  const price    = parseFloat(priceDisplay);
  const oldPrice = parseFloat(oldPriceDisplay);
  const suggestedDiscount =
    !isNaN(price) && !isNaN(oldPrice) && oldPrice > price && oldPrice > 0
      ? `-${Math.round((1 - price / oldPrice) * 100)}%`
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300 leading-relaxed">
          <strong>PUBLICIDAD ≠ PRICING.</strong> Estos campos son presentación visual en el anuncio únicamente.
          No modifican offering.price, promotion.price, el comparador ni el checkout.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lCls}>Precio actual (€)</label>
          <input
            type="number" step="0.01" min="0"
            value={priceDisplay}
            onChange={e => onChange('price_display', e.target.value)}
            className={iCls}
            placeholder="89.90"
          />
        </div>
        <div>
          <label className={lCls}>Precio anterior (€)</label>
          <input
            type="number" step="0.01" min="0"
            value={oldPriceDisplay}
            onChange={e => onChange('old_price_display', e.target.value)}
            className={iCls}
            placeholder="119.90"
          />
        </div>
        <div>
          <label className={lCls}>Descuento</label>
          <div className="flex items-center gap-1">
            <input
              value={discountLabel}
              onChange={e => onChange('discount_label', e.target.value)}
              className={iCls}
              placeholder="-25%"
            />
            {suggestedDiscount && !discountLabel && (
              <button
                type="button"
                onClick={() => onChange('discount_label', suggestedDiscount)}
                className="shrink-0 text-[9px] px-1.5 py-1 rounded bg-blue-800 text-blue-300 cursor-pointer hover:bg-blue-700"
              >
                {suggestedDiscount}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdCreativePreview({
  formato, device, mode, imageUrl, mobileImageUrl,
  headline, bodyText, ctaText, priceDisplay, oldPriceDisplay,
  discountLabel, textPosition, overlayStrength, themePreset, accent,
}: {
  formato: AdSlot['formato'] | null;
  device: 'desktop' | 'mobile';
  mode: CreativeMode;
  imageUrl: string;
  mobileImageUrl: string;
  headline: string;
  bodyText: string;
  ctaText: string;
  priceDisplay: string;
  oldPriceDisplay: string;
  discountLabel: string;
  textPosition: TextPosition;
  overlayStrength: number;
  themePreset: ThemePreset;
  accent?: string;
}) {
  const spec   = formato ? getAdSlotCreativeSpec(formato) : null;
  const theme  = THEME_PRESETS[themePreset] ?? THEME_PRESETS.AZUL_PROFESIONAL;
  const clrAcc = accent || theme.accent;

  const displayImg = device === 'mobile' && mobileImageUrl ? mobileImageUrl : imageUrl;
  const showImage  = mode !== 'TRABFLOW_DESIGN' && !!displayImg;
  const showOverlay = mode === 'IMAGE_CONTENT' && showImage;
  const bgStyle    = !showImage ? { background: theme.bg } : undefined;

  const flexAlign: React.CSSProperties['alignItems'] =
    textPosition === 'CENTER' ? 'center' : textPosition === 'RIGHT' ? 'flex-end' : 'flex-start';
  const txtAlign: React.CSSProperties['textAlign'] =
    textPosition === 'CENTER' ? 'center' : textPosition === 'RIGHT' ? 'right' : 'left';

  const priceVal    = parseFloat(priceDisplay);
  const oldPriceVal = parseFloat(oldPriceDisplay);
  const hasPrice    = !isNaN(priceVal) && priceVal > 0;
  const hasOldPrice = !isNaN(oldPriceVal) && oldPriceVal > 0;

  const previewCls = spec ? (device === 'mobile' ? spec.previewMobile : spec.previewDesktop) : null;

  if (!previewCls) {
    return (
      <div className="text-[10px] text-slate-500 text-center py-6">
        {device === 'desktop' && formato === 'mobile_promo' && 'Este slot es solo mobile.'}
        {device === 'mobile' && formato === 'banner_vertical' && 'Este slot es solo desktop.'}
        {!formato && 'Selecciona una campaña para ver el preview.'}
      </div>
    );
  }

  const textColor = mode === 'TRABFLOW_DESIGN' ? theme.text : '#ffffff';

  return (
    <div className={`relative rounded-lg overflow-hidden flex-shrink-0 ${previewCls}`} style={bgStyle}>
      {showImage && (
        <img src={displayImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {showOverlay && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayStrength / 100})` }} />
      )}
      {mode === 'FULL_IMAGE' ? (
        !showImage && (
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
            <div className="text-[9px] font-bold leading-tight line-clamp-2">{headline}</div>
          )}
          {bodyText && (
            <div className="text-[8px] opacity-70 leading-snug line-clamp-2">{bodyText}</div>
          )}
          {hasPrice && (
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-[11px] font-black" style={{ color: clrAcc }}>
                {priceVal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
              {hasOldPrice && (
                <span className="text-[8px] line-through opacity-60">
                  {oldPriceVal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              )}
            </div>
          )}
          {ctaText && (
            <span
              className="text-[8px] font-bold px-2 py-0.5 rounded mt-auto self-start"
              style={{ background: clrAcc, color: '#fff', alignSelf: flexAlign === 'flex-end' ? 'flex-end' : flexAlign === 'center' ? 'center' : 'flex-start' }}
            >
              {ctaText}
            </span>
          )}
          {!headline && !discountLabel && !hasPrice && !ctaText && (
            <span className="text-[8px] text-slate-500 self-center mt-auto mb-auto">Preview</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CREATIVE FORM MODAL ──────────────────────────────────────────────────────

function AdsCreativeFormModal({
  initial, campaigns, slots, onClose, onSaved, toast,
}: {
  initial: AdCreativeAdmin | null;
  campaigns: AdCampaignAdmin[];
  slots: AdSlot[];
  onClose: () => void;
  onSaved: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [form, setForm] = useState<CreativeFormData>(
    initial
      ? {
          campaign_id:       initial.campaign_id,
          image_url:         initial.image_url ?? '',
          mobile_image_url:  initial.mobile_image_url ?? '',
          headline:          initial.headline ?? '',
          body_text:         initial.body_text ?? '',
          cta_text:          initial.cta_text ?? '',
          alt_text:          initial.alt_text ?? '',
          activa:            initial.activa,
          creative_mode:     initial.creative_mode ?? 'IMAGE_CONTENT',
          text_position:     initial.text_position ?? 'LEFT',
          overlay_strength:  String(initial.overlay_strength ?? 50),
          price_display:     initial.price_display != null ? String(initial.price_display) : '',
          old_price_display: initial.old_price_display != null ? String(initial.old_price_display) : '',
          discount_label:    initial.discount_label ?? '',
          theme_preset:      initial.theme_preset ?? 'AZUL_PROFESIONAL',
        }
      : { ...EMPTY_CREATIVE }
  );
  const [saving, setSaving] = useState(false);
  const [showPrice, setShowPrice] = useState(
    !!initial && (initial.price_display != null || initial.old_price_display != null || !!initial.discount_label)
  );
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [desktopPrev, setDesktopPrev] = useState('');
  const [desktopDims, setDesktopDims] = useState<{ w: number; h: number } | null>(null);
  const [desktopWarn, setDesktopWarn] = useState('');
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [mobilePrev, setMobilePrev] = useState('');
  const [dragDesk, setDragDesk] = useState(false);
  const [dragMob, setDragMob] = useState(false);
  const deskRef = useRef<HTMLInputElement>(null);
  const mobRef  = useRef<HTMLInputElement>(null);

  const set = (k: keyof CreativeFormData, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const selectedCampaign = campaigns.find(c => c.id === form.campaign_id);
  const selectedSlot     = slots.find(s => s.id === selectedCampaign?.slot_id);
  const spec             = selectedSlot ? getAdSlotCreativeSpec(selectedSlot.formato) : null;
  const needsImage       = form.creative_mode !== 'TRABFLOW_DESIGN';

  function processFile(file: File, role: 'desktop' | 'mobile') {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { toast('error', 'Formato no permitido. Usa JPG, PNG o WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('error', 'La imagen supera 5 MB.'); return; }
    const url = URL.createObjectURL(file);
    if (role === 'desktop') {
      const img = new window.Image();
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        setDesktopDims({ w, h });
        if (spec) {
          const actualR  = w / h;
          const expectR  = spec.recW / spec.recH;
          const diff     = Math.abs(actualR - expectR) / expectR;
          setDesktopWarn(
            w < 400 ? `Resolución baja (${w}px). Puede verse borrosa.` :
            diff > 0.25 ? `Proporción distinta a ${spec.recW}×${spec.recH}px. Puede recortarse.` : ''
          );
        }
      };
      img.src = url;
      setDesktopPrev(url); setDesktopFile(file);
    } else {
      setMobilePrev(url); setMobileFile(file);
    }
  }

  function removeImage(role: 'desktop' | 'mobile') {
    if (role === 'desktop') {
      setDesktopFile(null); setDesktopPrev(''); setDesktopDims(null); setDesktopWarn('');
      set('image_url', '');
      if (deskRef.current) deskRef.current.value = '';
    } else {
      setMobileFile(null); setMobilePrev('');
      set('mobile_image_url', '');
      if (mobRef.current) mobRef.current.value = '';
    }
  }

  const handleSave = async () => {
    if (!form.campaign_id) { toast('error', 'Selecciona una campaña.'); return; }
    if (needsImage && !desktopFile && !form.image_url) {
      toast('error', 'Los modos A y B requieren imagen. Sube una imagen desktop.'); return;
    }
    setSaving(true);
    try {
      const campId = form.campaign_id;
      let finalDesk  = form.image_url;
      let finalMob   = form.mobile_image_url;
      if (desktopFile) finalDesk = await uploadCreativeImage(desktopFile, campId, 'desktop');
      if (mobileFile)  finalMob  = await uploadCreativeImage(mobileFile,  campId, 'mobile');

      if (form.activa) {
        const { data: others } = await supabase
          .from('trade_marketplace_ad_creatives')
          .select('id')
          .eq('campaign_id', campId)
          .eq('activa', true)
          .neq('id', initial?.id ?? '00000000-0000-0000-0000-000000000000');
        if (others && others.length > 0) {
          await supabase
            .from('trade_marketplace_ad_creatives')
            .update({ activa: false, updated_at: new Date().toISOString() })
            .in('id', (others as { id: string }[]).map(o => o.id));
        }
      }

      const payload = {
        campaign_id:       campId,
        image_url:         finalDesk || null,
        mobile_image_url:  finalMob  || null,
        headline:          form.headline  || null,
        body_text:         form.body_text || null,
        cta_text:          form.cta_text  || null,
        alt_text:          form.alt_text  || null,
        activa:            form.activa,
        creative_mode:     form.creative_mode,
        text_position:     form.text_position,
        overlay_strength:  parseInt(form.overlay_strength) || 50,
        price_display:     showPrice && form.price_display     ? parseFloat(form.price_display)     : null,
        old_price_display: showPrice && form.old_price_display ? parseFloat(form.old_price_display) : null,
        discount_label:    showPrice && form.discount_label    ? form.discount_label                : null,
        theme_preset:      form.theme_preset,
        updated_at:        new Date().toISOString(),
      };

      if (initial) {
        const { error } = await supabase.from('trade_marketplace_ad_creatives').update(payload).eq('id', initial.id);
        if (error) throw error;
        toast('success', 'Creatividad actualizada');
      } else {
        const { error } = await supabase.from('trade_marketplace_ad_creatives').insert(payload);
        if (error) throw error;
        toast('success', 'Creatividad creada');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const curDesktop = desktopPrev || form.image_url;
  const curMobile  = mobilePrev  || form.mobile_image_url;
  const showMobileUpload = selectedSlot
    ? selectedSlot.dispositivo === 'both' || selectedSlot.dispositivo === 'mobile'
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl my-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <h2 className="font-bold text-white text-sm">
                {initial ? 'Editar creatividad' : 'Nueva creatividad'}
              </h2>
            </div>
            {selectedCampaign && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {selectedCampaign.nombre} · {selectedSlot?.nombre ?? selectedCampaign.slot_id}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* 1 · Campaña */}
          <section>
            <label className={`${lCls} mb-1.5`}>1 · Campaña *</label>
            <select
              value={form.campaign_id}
              onChange={e => set('campaign_id', e.target.value)}
              className={iCls}
              disabled={!!initial}
            >
              <option value="">— Selecciona campaña —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({ESTADO_CAMP_LABEL[c.estado]})
                </option>
              ))}
            </select>
            {spec && (
              <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] text-slate-500 bg-slate-900/40 rounded px-3 py-2">
                <span><span className="text-slate-400 font-semibold">Formato:</span> {spec.label}</span>
                <span><span className="text-slate-400 font-semibold">Rec:</span> {spec.recW}×{spec.recH}px</span>
                <span><span className="text-slate-400 font-semibold">Ratio:</span> {spec.ratio}</span>
                <span><span className="text-slate-400 font-semibold">Dispositivo:</span> {spec.device}</span>
              </div>
            )}
          </section>

          {/* 2 · Tipo de creatividad */}
          <section>
            <label className={`${lCls} mb-1.5`}>2 · Tipo de creatividad</label>
            <CreativeModeSelector
              value={form.creative_mode}
              onChange={v => set('creative_mode', v)}
            />
          </section>

          {/* 3A · Imagen (modos A y B) */}
          {needsImage && (
            <section>
              <label className={`${lCls} mb-1.5`}>3 · Imagen</label>
              <div className="space-y-3">
                {/* Desktop */}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                    <Monitor className="h-3 w-3" /> Desktop
                    {!curDesktop && <span className="text-red-400 ml-0.5">*</span>}
                  </div>
                  {!curDesktop ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragDesk(true); }}
                      onDragLeave={() => setDragDesk(false)}
                      onDrop={e => { e.preventDefault(); setDragDesk(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f, 'desktop'); }}
                      onClick={() => deskRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                        dragDesk ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-900/40'
                      }`}
                    >
                      <Upload className="h-5 w-5 text-slate-400" />
                      <p className="text-xs text-slate-300">Arrastra o <span className="text-blue-400 font-semibold">selecciona</span></p>
                      <p className="text-[9px] text-slate-600">JPG · PNG · WebP · máx 5 MB</p>
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-start gap-3">
                      <img src={curDesktop} alt="" className="w-20 h-14 object-cover rounded border border-slate-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {desktopFile
                          ? <p className="text-xs font-semibold text-slate-200 truncate">{desktopFile.name}</p>
                          : <p className="text-[10px] text-slate-500 break-all line-clamp-2">{form.image_url}</p>
                        }
                        {desktopDims && desktopFile && (
                          <p className="text-[10px] text-slate-500">{desktopDims.w}×{desktopDims.h}px · {(desktopFile.size / 1024).toFixed(0)} KB</p>
                        )}
                        {desktopWarn && (
                          <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />{desktopWarn}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => deskRef.current?.click()} className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-white cursor-pointer">Cambiar</button>
                        <button onClick={() => removeImage('desktop')} className="px-2 py-1 rounded text-[10px] bg-red-900/40 hover:bg-red-900/60 text-red-300 cursor-pointer">Quitar</button>
                      </div>
                    </div>
                  )}
                  <input ref={deskRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'desktop'); }} />
                </div>

                {/* Mobile */}
                {showMobileUpload && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> Mobile
                      <span className="text-slate-600 normal-case font-normal">(opcional · si no se sube, usa la desktop)</span>
                    </div>
                    {!curMobile ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragMob(true); }}
                        onDragLeave={() => setDragMob(false)}
                        onDrop={e => { e.preventDefault(); setDragMob(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f, 'mobile'); }}
                        onClick={() => mobRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl px-4 py-4 flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                          dragMob ? 'border-blue-400 bg-blue-900/20' : 'border-slate-700 hover:border-slate-600 bg-slate-900/20'
                        }`}
                      >
                        <Upload className="h-4 w-4 text-slate-500" />
                        <p className="text-xs text-slate-500">Imagen mobile específica</p>
                      </div>
                    ) : (
                      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
                        <img src={curMobile} alt="" className="w-16 h-10 object-cover rounded border border-slate-600 shrink-0" />
                        <div className="flex-1 text-[10px] text-slate-400 truncate">
                          {mobileFile ? mobileFile.name : form.mobile_image_url}
                        </div>
                        <button onClick={() => removeImage('mobile')} className="px-2 py-1 rounded text-[10px] bg-red-900/40 hover:bg-red-900/60 text-red-300 cursor-pointer shrink-0">Quitar</button>
                      </div>
                    )}
                    <input ref={mobRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'mobile'); }} />
                  </div>
                )}

                {/* Alt text en modo FULL_IMAGE */}
                {form.creative_mode === 'FULL_IMAGE' && (
                  <div>
                    <label className={lCls}>Alt text (accesibilidad)</label>
                    <input value={form.alt_text} onChange={e => set('alt_text', e.target.value)} className={iCls} placeholder="Describir el contenido del banner" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 3B · Tema visual (modo C) */}
          {form.creative_mode === 'TRABFLOW_DESIGN' && (
            <section>
              <label className={`${lCls} mb-1.5`}>3 · Tema visual</label>
              <ThemePresetSelector value={form.theme_preset} onChange={v => set('theme_preset', v)} />
            </section>
          )}

          {/* 4 · Contenido (modos B y C) */}
          {form.creative_mode !== 'FULL_IMAGE' && (
            <section>
              <label className={`${lCls} mb-1.5`}>4 · Contenido</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lCls}>Titular (headline)</label>
                  <input value={form.headline} onChange={e => set('headline', e.target.value)} className={iCls} placeholder="Taladro atornillador profesional" />
                </div>
                <div className="col-span-2">
                  <label className={lCls}>Texto / descripción</label>
                  <input value={form.body_text} onChange={e => set('body_text', e.target.value)} className={iCls} placeholder="Para instaladores exigentes" />
                </div>
                <div>
                  <label className={lCls}>CTA (texto del botón)</label>
                  <input value={form.cta_text} onChange={e => set('cta_text', e.target.value)} className={iCls} placeholder="Ver oferta" />
                </div>
                <div>
                  <label className={lCls}>Alt text (accesibilidad)</label>
                  <input value={form.alt_text} onChange={e => set('alt_text', e.target.value)} className={iCls} placeholder="Descripción accesible" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>Posición del texto</label>
                  <TextPositionControl value={form.text_position} onChange={v => set('text_position', v)} />
                </div>
                {form.creative_mode === 'IMAGE_CONTENT' && (
                  <div>
                    <label className={lCls}>Oscuridad del overlay</label>
                    <OverlayStrengthControl
                      value={parseInt(form.overlay_strength) || 50}
                      onChange={v => set('overlay_strength', String(v))}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5 · Precio / descuento (colapsable) */}
          <section>
            <button
              type="button"
              onClick={() => setShowPrice(v => !v)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPrice ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <Tag className="h-3 w-3" />
              {showPrice ? 'Ocultar sección de precio' : 'Añadir precio / descuento publicitario (opcional)'}
            </button>
            {showPrice && (
              <div className="mt-3">
                <PriceDisplaySection
                  priceDisplay={form.price_display}
                  oldPriceDisplay={form.old_price_display}
                  discountLabel={form.discount_label}
                  onChange={(field, val) => set(field as keyof CreativeFormData, val)}
                />
              </div>
            )}
          </section>

          {/* 6 · Preview */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className={lCls}>Preview</label>
              {spec && spec.previewMobile && (
                <div className="flex gap-1">
                  {(['desktop', 'mobile'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPreviewDevice(d)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                        previewDevice === d ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {d === 'desktop' ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                      {d === 'desktop' ? 'Desktop' : 'Mobile'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-center min-h-[80px]">
              <AdCreativePreview
                formato={selectedSlot?.formato ?? null}
                device={previewDevice}
                mode={form.creative_mode}
                imageUrl={desktopPrev || form.image_url}
                mobileImageUrl={mobilePrev || form.mobile_image_url}
                headline={form.headline}
                bodyText={form.body_text}
                ctaText={form.cta_text}
                priceDisplay={form.price_display}
                oldPriceDisplay={form.old_price_display}
                discountLabel={form.discount_label}
                textPosition={form.text_position}
                overlayStrength={parseInt(form.overlay_strength) || 50}
                themePreset={form.theme_preset}
                accent={selectedCampaign?.accent ?? undefined}
              />
            </div>
          </section>

          {/* 7 · Publicación */}
          <section className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.activa} onChange={e => set('activa', e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-300">Activar esta creatividad al guardar</span>
            </label>
            {form.activa && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Si hay otra creatividad activa en esta campaña, se desactivará automáticamente.
              </p>
            )}
          </section>

          {/* IA placeholder */}
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-slate-700 text-slate-600 text-xs cursor-not-allowed"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar creatividad con IA · Próximamente
          </button>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear creatividad'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── CREATIVES LIST ───────────────────────────────────────────────────────────

const CREATIVE_MODE_BADGE: Record<CreativeMode, { label: string; cls: string }> = {
  FULL_IMAGE:      { label: 'A · Imagen',    cls: 'bg-slate-700 text-slate-300'       },
  IMAGE_CONTENT:   { label: 'B · Img+Texto', cls: 'bg-blue-900/60 text-blue-300'      },
  TRABFLOW_DESIGN: { label: 'C · TrabFlow',  cls: 'bg-purple-900/60 text-purple-300'  },
};

function AdsCreativesList({
  creatives, campaigns, slots, onRefresh, toast,
}: {
  creatives: AdCreativeAdmin[];
  campaigns: AdCampaignAdmin[];
  slots: AdSlot[];
  onRefresh: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editCreative, setEditCreative] = useState<AdCreativeAdmin | null>(null);

  const filtered = creatives.filter(c => filterCampaign === 'all' || c.campaign_id === filterCampaign);

  const handleToggleActiva = async (creative: AdCreativeAdmin) => {
    try {
      const newActiva = !creative.activa;
      if (newActiva) {
        const { data: others } = await supabase
          .from('trade_marketplace_ad_creatives')
          .select('id')
          .eq('campaign_id', creative.campaign_id)
          .eq('activa', true)
          .neq('id', creative.id);
        if (others && others.length > 0) {
          await supabase
            .from('trade_marketplace_ad_creatives')
            .update({ activa: false, updated_at: new Date().toISOString() })
            .in('id', (others as { id: string }[]).map(o => o.id));
        }
      }
      const { error } = await supabase
        .from('trade_marketplace_ad_creatives')
        .update({ activa: newActiva, updated_at: new Date().toISOString() })
        .eq('id', creative.id);
      if (error) throw error;
      toast('success', newActiva ? 'Creatividad activada' : 'Creatividad desactivada');
      onRefresh();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-white">Creatividades ({filtered.length})</h2>
        <button
          onClick={() => { setEditCreative(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva creatividad
        </button>
      </div>
      <div>
        <select
          value={filterCampaign}
          onChange={e => setFilterCampaign(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="all">Todas las campañas</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center text-slate-500 text-sm py-12">No hay creatividades.</div>}
        {filtered.map(cr => {
          const camp = campaigns.find(c => c.id === cr.campaign_id);
          const mode = (cr.creative_mode ?? 'IMAGE_CONTENT') as CreativeMode;
          const badge = CREATIVE_MODE_BADGE[mode];
          const thumb = cr.image_url || cr.mobile_image_url;
          return (
            <div key={cr.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start gap-3">
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    className="w-14 h-10 object-cover rounded border border-slate-700 shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {!thumb && mode === 'TRABFLOW_DESIGN' && (
                  <div
                    className="w-14 h-10 rounded border border-slate-700 shrink-0 flex items-center justify-center"
                    style={{ background: THEME_PRESETS[cr.theme_preset ?? 'AZUL_PROFESIONAL']?.bg }}
                  >
                    <Layers className="h-4 w-4 opacity-50" style={{ color: THEME_PRESETS[cr.theme_preset ?? 'AZUL_PROFESIONAL']?.text }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cr.activa ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                      {cr.activa ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {cr.generada_ia && (
                      <span className="text-[9px] font-bold bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">IA</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white truncate">{camp?.nombre ?? cr.campaign_id.slice(0, 8)}</div>
                  {cr.headline && <div className="text-[10px] text-slate-400 truncate">{cr.headline}</div>}
                  {cr.price_display != null && (
                    <div className="text-[10px] text-amber-400">
                      Precio publicitario: {cr.price_display} €
                      {cr.old_price_display != null && <span className="line-through text-slate-500 ml-1">{cr.old_price_display} €</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => { setEditCreative(cr); setShowForm(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleActiva(cr)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                      cr.activa ? 'bg-yellow-800 hover:bg-yellow-700 text-white' : 'bg-emerald-800 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {cr.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showForm && (
        <AdsCreativeFormModal
          initial={editCreative}
          campaigns={campaigns}
          slots={slots}
          onClose={() => { setShowForm(false); setEditCreative(null); }}
          onSaved={onRefresh}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

interface Props {
  toast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export default function AdminMarketplaceAdsSection({ toast }: Props) {
  const [tab, setTab] = useState<AdsTab>('dashboard');

  // Data
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignAdmin[]>([]);
  const [bookings, setBookings] = useState<AdBookingAdmin[]>([]);
  const [creatives, setCreatives] = useState<AdCreativeAdmin[]>([]);
  const [actors, setActors] = useState<MarketplaceActor[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  // Slot detail panel
  const [detailSlot, setDetailSlot] = useState<AdSlot | null>(null);

  // Slot filters + view toggle
  const [slotsView, setSlotsView]         = useState<'visual' | 'list'>('visual');
  const [filterDevice, setFilterDevice]   = useState('all');
  const [filterStatus, setFilterStatus]   = useState('all');

  // Pre-select slot when navigating from mapa → campaña
  const [openCampaignSlotId, setOpenCampaignSlotId] = useState<string | null>(null);

  const handleCreateCampaignFromSlot = (slotId: string) => {
    setOpenCampaignSlotId(slotId);
    setTab('campanas');
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: slotData },
        { data: campData },
        { data: bookData },
        { data: creativeData },
        { data: actorData },
        { data: kpiData },
      ] = await Promise.all([
        supabase.from('trade_marketplace_ad_slots').select('*').order('posicion'),
        supabase.from('trade_marketplace_ad_campaigns').select('*').order('created_at', { ascending: false }),
        supabase.rpc('admin_get_ad_bookings'),
        supabase.from('trade_marketplace_ad_creatives').select('*').order('created_at', { ascending: false }),
        supabase.from('trade_marketplace_actors').select('id, nombre, actor_type, estado').eq('actor_type', 'supplier').eq('estado', 'active').order('nombre'),
        supabase.rpc('admin_get_ads_dashboard'),
      ]);
      setSlots((slotData ?? []) as AdSlot[]);
      setCampaigns((campData ?? []) as AdCampaignAdmin[]);
      setBookings((bookData ?? []) as AdBookingAdmin[]);
      setCreatives((creativeData ?? []) as AdCreativeAdmin[]);
      setActors((actorData ?? []) as MarketplaceActor[]);
      setKpis((kpiData as DashboardKPIs) ?? null);
    } catch (e) {
      toast('error', 'Error al cargar datos de publicidad: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const solicitudesNuevas = bookings.filter(b => b.estado === 'REQUESTED').length;

  const TABS: { id: AdsTab; label: string; Icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard',     label: 'Dashboard',     Icon: BarChart2 },
    { id: 'slots',         label: 'Espacios',       Icon: Layout },
    { id: 'solicitudes',   label: 'Solicitudes',    Icon: Inbox, badge: solicitudesNuevas > 0 ? solicitudesNuevas : undefined },
    { id: 'campanas',      label: 'Campañas',       Icon: Megaphone },
    { id: 'reservas',      label: 'Reservas',       Icon: Calendar },
    { id: 'creatividades', label: 'Creatividades',  Icon: ImageIcon },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Publicidad · Marketplace</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestión de espacios, campañas, reservas y creatividades. Publicidad ≠ ranking.</p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto pb-px">
        {TABS.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px ${
              tab === id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {badge != null && badge > 0 && (
              <span className="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'dashboard' && (
          <AdsDashboard kpis={kpis} loading={loading} />
        )}

        {tab === 'slots' && (
          <div className="space-y-4">
            {/* Toolbar: view toggle + list-only filters */}
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSlotsView('visual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${slotsView === 'visual' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  <Map className="h-3.5 w-3.5" /> Mapa visual
                </button>
                <button
                  type="button"
                  onClick={() => setSlotsView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${slotsView === 'list' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  <Layout className="h-3.5 w-3.5" /> Lista
                </button>
              </div>
              {slotsView === 'list' && (
                <div className="flex gap-2 flex-wrap">
                  <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
                    <option value="all">Todos los dispositivos</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="both">Ambos</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
                    <option value="all">Todos los estados</option>
                    <option value="LIBRE">Libre</option>
                    <option value="OCUPADO">Ocupado</option>
                    <option value="RESERVADO">Reservado</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center text-slate-400 text-sm py-12">Cargando slots…</div>
            ) : slotsView === 'visual' ? (
              <AdPlacementMap
                slots={slots}
                campaigns={campaigns as unknown as PlacementCampaign[]}
                bookings={bookings as unknown as PlacementBooking[]}
                selectedSlotId={detailSlot?.id}
                onSelectSlot={s => setDetailSlot(slots.find(sl => sl.id === s.id) ?? null)}
                mode="admin"
                onCreateCampaign={handleCreateCampaignFromSlot}
              />
            ) : (
              <AdsSlotMap
                slots={slots}
                campaigns={campaigns}
                bookings={bookings}
                onSlotClick={s => setDetailSlot(s)}
                filterDevice={filterDevice}
                filterStatus={filterStatus}
              />
            )}
          </div>
        )}

        {tab === 'solicitudes' && (
          <AdsSolicitudesTab
            bookings={bookings}
            slots={slots}
            actors={actors}
            onRefresh={loadAll}
            toast={toast}
          />
        )}

        {tab === 'campanas' && (
          <AdsCampaignsList
            campaigns={campaigns}
            slots={slots}
            bookings={bookings}
            actors={actors}
            onRefresh={loadAll}
            toast={toast}
            preSelectSlotId={openCampaignSlotId}
            onCampaignSlotConsumed={() => setOpenCampaignSlotId(null)}
          />
        )}

        {tab === 'reservas' && (
          <AdsBookingsList
            bookings={bookings}
            slots={slots}
            actors={actors}
            onRefresh={loadAll}
            toast={toast}
          />
        )}

        {tab === 'creatividades' && (
          <AdsCreativesList
            creatives={creatives}
            campaigns={campaigns}
            slots={slots}
            onRefresh={loadAll}
            toast={toast}
          />
        )}
      </div>

      {/* Slot detail panel (slide-over) */}
      {detailSlot && (
        <AdsSlotDetailPanel
          slot={detailSlot}
          campaigns={campaigns}
          bookings={bookings}
          actors={actors}
          onClose={() => setDetailSlot(null)}
          onUpdated={loadAll}
          toast={toast}
        />
      )}
    </div>
  );
}
