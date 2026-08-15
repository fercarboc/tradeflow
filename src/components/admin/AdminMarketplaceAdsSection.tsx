// ═══════════════════════════════════════════════════════════════
// AdminMarketplaceAdsSection.tsx
// Admin → Marketplace → Publicidad
// E2: Dashboard · Espacios · Campañas · Reservas · Creatividades
//
// INVARIANTE preservado: publicidad ≠ ranking.
// No tocar: checkout, pricing, ranking, ProductCard, Universal Products.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Layout, Calendar, Film, RefreshCw, Plus, Edit2,
  Eye, X, AlertCircle, CheckCircle, Clock, Monitor, Smartphone,
  Globe, XCircle, ChevronDown, Megaphone, Image, Tag, Link,
  ArrowRight, Layers,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type AdsTab = 'dashboard' | 'slots' | 'campanas' | 'reservas' | 'creatividades';

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
  created_at: string; updated_at: string;
};

type AdBookingAdmin = {
  id: string; slot_id: string; actor_id: string;
  estado: 'REQUESTED' | 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  inicio: string; fin: string; origen: 'admin' | 'portal_request';
  notas: string | null; created_at: string;
};

type AdCreativeAdmin = {
  id: string; campaign_id: string;
  image_url: string | null; mobile_image_url: string | null;
  headline: string | null; body_text: string | null;
  cta_text: string | null; alt_text: string | null;
  generada_ia: boolean; activa: boolean; created_at: string;
};

type MarketplaceActor = { id: string; nombre: string; tipo: string };

type DashboardKPIs = {
  slots_total: number; slots_comerciales: number; slots_ocupados: number;
  slots_libres: number; slots_sin_fallback: number;
  campanas_activas: number; campanas_programadas: number; campanas_pendientes_aprobacion: number;
  campanas_proximas_inicio: number; campanas_terminan_pronto: number;
  reservas_pendientes: number; reservas_activas: number; reservas_proximas: number;
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
  REQUESTED: 'Solicitada', RESERVED: 'Reservada', CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada', EXPIRED: 'Expirada',
};

const ESTADO_BOOK_CLS: Record<AdBookingAdmin['estado'], string> = {
  REQUESTED: 'bg-amber-900/60 text-amber-300',
  RESERVED: 'bg-blue-900/60 text-blue-300',
  CONFIRMED: 'bg-emerald-900/60 text-emerald-300',
  CANCELLED: 'bg-slate-700/40 text-slate-500',
  EXPIRED: 'bg-red-900/60 text-red-300',
};

const VALID_BOOK_TRANSITIONS: Record<AdBookingAdmin['estado'], AdBookingAdmin['estado'][]> = {
  REQUESTED: ['RESERVED', 'CONFIRMED', 'CANCELLED'],
  RESERVED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
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
};

const EMPTY_BOOKING: BookingFormData = {
  slot_id: '', actor_id: '', inicio: '', fin: '',
  estado: 'REQUESTED', notas: '',
};

const EMPTY_CREATIVE: CreativeFormData = {
  campaign_id: '', image_url: '', mobile_image_url: '',
  headline: '', body_text: '', cta_text: '', alt_text: '', activa: false,
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
      title: 'Reservas',
      items: [
        { label: 'Pendientes',          value: kpis.reservas_pendientes,  color: kpis.reservas_pendientes > 0 ? 'text-amber-400' : 'text-slate-400' },
        { label: 'Confirmadas activas', value: kpis.reservas_activas,     color: 'text-emerald-400' },
        { label: 'Próximas',            value: kpis.reservas_proximas,    color: 'text-blue-400' },
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

// ─── CAMPAIGN PREVIEW ─────────────────────────────────────────────────────────

function AdsCampaignPreview({ campaign, formato }: { campaign: Partial<CampaignFormData>; formato: AdSlot['formato'] | null }) {
  const bg = campaign.bg || 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)';
  const textColor = campaign.text_color || '#ffffff';
  const accent = campaign.accent || '#60a5fa';

  const isVertical = formato === 'banner_vertical';
  const isCard = formato === 'promo_card';

  return (
    <div className="flex gap-4 flex-wrap">
      {/* Desktop preview */}
      <div>
        <div className="text-[9px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1">
          <Monitor className="h-3 w-3" /> Desktop
        </div>
        <div
          className={`rounded-lg overflow-hidden flex flex-col justify-between p-4 ${isVertical ? 'w-36 h-52' : isCard ? 'w-40 h-40' : 'w-72 h-32'}`}
          style={{ background: bg, color: textColor }}
        >
          {campaign.eyebrow && (
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">{campaign.eyebrow}</div>
          )}
          <div>
            <div className="text-sm font-bold leading-tight mb-1">{campaign.title || 'Título de la campaña'}</div>
            {campaign.subtitle && <div className="text-[10px] opacity-70">{campaign.subtitle}</div>}
          </div>
          <button
            className="self-start text-[9px] font-bold px-2 py-1 rounded mt-2"
            style={{ background: accent, color: '#fff' }}
          >
            {campaign.cta_label || 'Ver más'}
          </button>
        </div>
      </div>
      {/* Mobile preview */}
      <div>
        <div className="text-[9px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1">
          <Smartphone className="h-3 w-3" /> Mobile
        </div>
        <div
          className="rounded-lg overflow-hidden flex items-center gap-3 px-3 py-2 w-60 h-16"
          style={{ background: bg, color: textColor }}
        >
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
  );
}

// ─── CAMPAIGN FORM MODAL ──────────────────────────────────────────────────────

function AdsCampaignFormModal({
  initial, slots, actors, onClose, onSaved, toast,
}: {
  initial: AdCampaignAdmin | null;
  slots: AdSlot[];
  actors: MarketplaceActor[];
  onClose: () => void;
  onSaved: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [form, setForm] = useState<CampaignFormData>(
    initial
      ? {
          slot_id: initial.slot_id, campaign_source: initial.campaign_source,
          actor_id: initial.actor_id ?? '', nombre: initial.nombre,
          advertiser_name: initial.advertiser_name, eyebrow: initial.eyebrow ?? '',
          title: initial.title, subtitle: initial.subtitle ?? '',
          cta_label: initial.cta_label,
          destination_type: initial.destination_type,
          destination_value: initial.destination_value ?? '',
          oficio: initial.oficio ?? '', priority: String(initial.priority),
          start_at: initial.start_at ? initial.start_at.slice(0, 10) : '',
          end_at: initial.end_at ? initial.end_at.slice(0, 10) : '',
          accent: initial.accent ?? '#60a5fa',
          bg: initial.bg ?? 'linear-gradient(135deg,#0f2044 0%,#1e3a5f 100%)',
          text_color: initial.text_color ?? '#ffffff',
          estado: initial.estado, activa: initial.activa,
        }
      : { ...EMPTY_CAMPAIGN }
  );
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const selectedSlot = slots.find(s => s.id === form.slot_id);

  const set = (k: keyof CampaignFormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.slot_id || !form.nombre || !form.title || !form.cta_label) {
      toast('error', 'Slot, nombre, título y CTA son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slot_id: form.slot_id,
        campaign_source: form.campaign_source,
        actor_id: form.actor_id || null,
        nombre: form.nombre, advertiser_name: form.advertiser_name,
        eyebrow: form.eyebrow || null, title: form.title,
        subtitle: form.subtitle || null, cta_label: form.cta_label,
        destination_type: form.destination_type,
        destination_value: form.destination_value || null,
        oficio: form.oficio || null,
        priority: parseInt(form.priority) || 10,
        start_at: form.start_at || null, end_at: form.end_at || null,
        accent: form.accent || null, bg: form.bg || null,
        text_color: form.text_color || null,
        estado: form.estado, activa: form.activa,
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl my-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-bold text-white text-sm">{initial ? 'Editar campaña' : 'Nueva campaña'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Básico */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lCls}>Nombre interno *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={iCls} placeholder="Ej: Campaña Electricidad Agosto" />
            </div>
            <div>
              <label className={lCls}>Fuente *</label>
              <select value={form.campaign_source} onChange={e => set('campaign_source', e.target.value as CampaignFormData['campaign_source'])} className={iCls}>
                <option value="trabflow">TrabFlow (editorial)</option>
                <option value="supplier">Proveedor (comercial)</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className={lCls}>Slot *</label>
              <select value={form.slot_id} onChange={e => set('slot_id', e.target.value)} className={iCls}>
                <option value="">— Selecciona slot —</option>
                {slots.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.id.replace('MARKET_', '')})</option>)}
              </select>
            </div>
            {form.campaign_source === 'supplier' && (
              <div className="col-span-2">
                <label className={lCls}>Proveedor (actor)</label>
                <select value={form.actor_id} onChange={e => set('actor_id', e.target.value)} className={iCls}>
                  <option value="">— Sin proveedor —</option>
                  {actors.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Contenido */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Contenido</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Anunciante</label>
                <input value={form.advertiser_name} onChange={e => set('advertiser_name', e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>Eyebrow</label>
                <input value={form.eyebrow} onChange={e => set('eyebrow', e.target.value)} className={iCls} placeholder="Ej: Oferta del mes" />
              </div>
              <div className="col-span-2">
                <label className={lCls}>Título *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} className={iCls} placeholder="Electricidad profesional" />
              </div>
              <div className="col-span-2">
                <label className={lCls}>Subtítulo</label>
                <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>CTA *</label>
                <input value={form.cta_label} onChange={e => set('cta_label', e.target.value)} className={iCls} placeholder="Ver más" />
              </div>
              <div>
                <label className={lCls}>Oficio (fallback matching)</label>
                <input value={form.oficio} onChange={e => set('oficio', e.target.value)} className={iCls} placeholder="electricidad" />
              </div>
            </div>
          </div>

          {/* Destino */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Destino</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Tipo de destino *</label>
                <select value={form.destination_type} onChange={e => set('destination_type', e.target.value as CampaignFormData['destination_type'])} className={iCls}>
                  <option value="catalog">Catálogo (sin valor)</option>
                  <option value="category">Categoría</option>
                  <option value="supplier">Proveedor</option>
                  <option value="search">Búsqueda</option>
                  <option value="product">Producto (futuro)</option>
                  <option value="offer">Oferta (futuro)</option>
                </select>
              </div>
              <div>
                <label className={lCls}>Valor</label>
                <input
                  value={form.destination_value}
                  onChange={e => set('destination_value', e.target.value)}
                  className={iCls}
                  placeholder={form.destination_type === 'category' ? 'electricidad' : form.destination_type === 'search' ? 'cable rojo' : ''}
                  disabled={form.destination_type === 'catalog'}
                />
              </div>
            </div>
          </div>

          {/* Estilo */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Estilo visual</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lCls}>Accent color</label>
                <input value={form.accent} onChange={e => set('accent', e.target.value)} className={iCls} placeholder="#60a5fa" />
              </div>
              <div>
                <label className={lCls}>Texto color</label>
                <input value={form.text_color} onChange={e => set('text_color', e.target.value)} className={iCls} placeholder="#ffffff" />
              </div>
              <div>
                <label className={lCls}>Prioridad</label>
                <input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} className={iCls} min={0} max={999} />
              </div>
              <div className="col-span-3">
                <label className={lCls}>Background (CSS)</label>
                <input value={form.bg} onChange={e => set('bg', e.target.value)} className={iCls} placeholder="linear-gradient(…)" />
              </div>
            </div>
          </div>

          {/* Programación */}
          <div>
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
                  {(Object.keys(ESTADO_CAMP_LABEL) as AdCampaignAdmin['estado'][]).map(e => (
                    <option key={e} value={e}>{ESTADO_CAMP_LABEL[e]}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activa} onChange={e => set('activa', e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Campaña activa (visible en RPC)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Ocultar preview' : 'Ver preview'}
            </button>
            {showPreview && (
              <div className="mt-3 p-3 bg-slate-900 rounded-lg">
                <AdsCampaignPreview campaign={form} formato={selectedSlot?.formato ?? null} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGNS LIST ───────────────────────────────────────────────────────────

function AdsCampaignsList({
  campaigns, slots, actors, onRefresh, toast,
}: {
  campaigns: AdCampaignAdmin[];
  slots: AdSlot[];
  actors: MarketplaceActor[];
  onRefresh: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterSlot, setFilterSlot] = useState('all');
  const [editCampaign, setEditCampaign] = useState<AdCampaignAdmin | null | 'new'>('null_sentinel' as unknown as null);
  const [showForm, setShowForm] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const filtered = campaigns.filter(c => {
    if (filterEstado !== 'all' && c.estado !== filterEstado) return false;
    if (filterSource !== 'all' && c.campaign_source !== filterSource) return false;
    if (filterSlot !== 'all' && c.slot_id !== filterSlot) return false;
    return true;
  });

  const handleTransition = async (campaign: AdCampaignAdmin, newEstado: AdCampaignAdmin['estado']) => {
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
          return (
            <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_CAMP_CLS[c.estado]}`}>
                      {ESTADO_CAMP_LABEL[c.estado]}
                    </span>
                    <span className="text-[9px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{c.campaign_source}</span>
                    {c.activa && <span className="text-[9px] text-emerald-400 font-bold">● ACTIVA</span>}
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
          actors={actors}
          onClose={() => setShowForm(false)}
          onSaved={onRefresh}
          toast={toast}
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
              {actors.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>)}
            </select>
            {actors.length === 0 && <p className="text-[10px] text-amber-400 mt-1">No hay proveedores registrados.</p>}
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
    if (filterEstado !== 'all' && b.estado !== filterEstado) return false;
    if (filterSlot !== 'all' && b.slot_id !== filterSlot) return false;
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
          {(Object.keys(ESTADO_BOOK_LABEL) as AdBookingAdmin['estado'][]).map(e => (
            <option key={e} value={e}>{ESTADO_BOOK_LABEL[e]}</option>
          ))}
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

// ─── CREATIVE FORM MODAL ──────────────────────────────────────────────────────

function AdsCreativeFormModal({
  initial, campaigns, onClose, onSaved, toast,
}: {
  initial: AdCreativeAdmin | null;
  campaigns: AdCampaignAdmin[];
  onClose: () => void;
  onSaved: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [form, setForm] = useState<CreativeFormData>(
    initial
      ? { campaign_id: initial.campaign_id, image_url: initial.image_url ?? '', mobile_image_url: initial.mobile_image_url ?? '', headline: initial.headline ?? '', body_text: initial.body_text ?? '', cta_text: initial.cta_text ?? '', alt_text: initial.alt_text ?? '', activa: initial.activa }
      : { ...EMPTY_CREATIVE }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CreativeFormData, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.campaign_id) { toast('error', 'Selecciona una campaña.'); return; }
    setSaving(true);
    try {
      const payload = { campaign_id: form.campaign_id, image_url: form.image_url || null, mobile_image_url: form.mobile_image_url || null, headline: form.headline || null, body_text: form.body_text || null, cta_text: form.cta_text || null, alt_text: form.alt_text || null, activa: form.activa };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-bold text-white text-sm">{initial ? 'Editar creatividad' : 'Nueva creatividad'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={lCls}>Campaña *</label>
            <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)} className={iCls}>
              <option value="">— Selecciona campaña —</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.nombre} ({ESTADO_CAMP_LABEL[c.estado]})</option>)}
            </select>
          </div>
          <div>
            <label className={lCls}>URL imagen desktop</label>
            <input value={form.image_url} onChange={e => set('image_url', e.target.value)} className={iCls} placeholder="https://…" />
          </div>
          <div>
            <label className={lCls}>URL imagen mobile</label>
            <input value={form.mobile_image_url} onChange={e => set('mobile_image_url', e.target.value)} className={iCls} placeholder="https://…" />
          </div>
          <div>
            <label className={lCls}>Alt text (accesibilidad)</label>
            <input value={form.alt_text} onChange={e => set('alt_text', e.target.value)} className={iCls} />
          </div>
          <div>
            <label className={lCls}>Headline (override campaña)</label>
            <input value={form.headline} onChange={e => set('headline', e.target.value)} className={iCls} />
          </div>
          <div>
            <label className={lCls}>CTA text (override campaña)</label>
            <input value={form.cta_text} onChange={e => set('cta_text', e.target.value)} className={iCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activa} onChange={e => set('activa', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">Creatividad activa</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : initial ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CREATIVES LIST ───────────────────────────────────────────────────────────

function AdsCreativesList({
  creatives, campaigns, onRefresh, toast,
}: {
  creatives: AdCreativeAdmin[];
  campaigns: AdCampaignAdmin[];
  onRefresh: () => void;
  toast: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editCreative, setEditCreative] = useState<AdCreativeAdmin | null>(null);

  const filtered = creatives.filter(c => filterCampaign === 'all' || c.campaign_id === filterCampaign);

  const handleToggleActiva = async (creative: AdCreativeAdmin) => {
    try {
      const { error } = await supabase.from('trade_marketplace_ad_creatives').update({ activa: !creative.activa }).eq('id', creative.id);
      if (error) throw error;
      toast('success', creative.activa ? 'Creatividad desactivada' : 'Creatividad activada');
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
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
          <option value="all">Todas las campañas</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center text-slate-500 text-sm py-12">No hay creatividades.</div>}
        {filtered.map(cr => {
          const camp = campaigns.find(c => c.id === cr.campaign_id);
          return (
            <div key={cr.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cr.activa ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                      {cr.activa ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                    {cr.generada_ia && <span className="text-[9px] font-bold bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">IA</span>}
                  </div>
                  <div className="text-sm font-semibold text-white truncate">{camp?.nombre ?? cr.campaign_id.slice(0, 8)}</div>
                  {cr.image_url && <div className="text-xs text-blue-400 truncate">Desktop: {cr.image_url}</div>}
                  {cr.mobile_image_url && <div className="text-xs text-blue-400 truncate">Mobile: {cr.mobile_image_url}</div>}
                  {cr.alt_text && <div className="text-xs text-slate-500">Alt: {cr.alt_text}</div>}
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
                    className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors ${cr.activa ? 'bg-yellow-800 hover:bg-yellow-700 text-white' : 'bg-emerald-800 hover:bg-emerald-700 text-white'}`}
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

  // Slot filters
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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
        supabase.from('trade_marketplace_ad_bookings').select('*').order('inicio'),
        supabase.from('trade_marketplace_ad_creatives').select('*').order('created_at', { ascending: false }),
        supabase.from('trade_marketplace_actors').select('id, nombre, tipo').order('nombre'),
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

  const TABS: { id: AdsTab; label: string; Icon: React.ElementType }[] = [
    { id: 'dashboard',    label: 'Dashboard',      Icon: BarChart2 },
    { id: 'slots',        label: 'Espacios',        Icon: Layout },
    { id: 'campanas',     label: 'Campañas',        Icon: Megaphone },
    { id: 'reservas',     label: 'Reservas',        Icon: Calendar },
    { id: 'creatividades',label: 'Creatividades',   Icon: Image },
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
        {TABS.map(({ id, label, Icon }) => (
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
            {loading ? (
              <div className="text-center text-slate-400 text-sm py-12">Cargando slots…</div>
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

        {tab === 'campanas' && (
          <AdsCampaignsList
            campaigns={campaigns}
            slots={slots}
            actors={actors}
            onRefresh={loadAll}
            toast={toast}
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
