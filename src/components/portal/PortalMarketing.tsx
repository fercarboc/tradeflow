// ═══════════════════════════════════════════════════════════════
// PortalMarketing.tsx
// Portal Proveedor → Marketing → Promociones locales
//
// Alineado con schema real trade_marketplace_promotions (2026-08-16):
//   columnas: id, actor_id, tipo (promo_tipo), scope (promo_scope),
//   location_id, comunidad_autonoma, titulo, descripcion, cta_label,
//   fecha_inicio, fecha_fin, activa, mostrar_en_home, mostrar_en_perfil,
//   mostrar_chip_comparador, config, created_at, updated_at.
//
// NO EXISTEN en BD: prioridad, codigo, nombre, valor, valida_desde,
//   valida_hasta, comunidades_target (array), location_ids_target (array),
//   offering_ids_target, familia_ids_target.
//
// INVARIANTE: promotion.activa no modifica ranking ni checkout.
//   trade_marketplace_promotions ≠ trade_marketplace_ad_campaigns.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import PortalPublicidadMarketplace from './PortalPublicidadMarketplace';

// ─── Tipos alineados con schema real ──────────────────────────────────────────

type PromoScope = 'national' | 'regional' | 'local';
type PromoTipo  =
  | 'descuento_porcentaje' | 'pack_ahorro'    | 'envio_gratis'
  | 'recogida_gratis'      | 'local_discount' | 'clearance'
  | 'discontinued'         | 'local_campaign' | 'excess_stock'
  | 'novedad'              | 'destacado_home' | 'destacado_perfil';

type PromoStatus = 'active' | 'inactive' | 'scheduled' | 'expired';

const SCOPE_LABELS: Record<PromoScope, string> = {
  national: 'Nacional', regional: 'Regional', local: 'Local',
};

const SCOPE_COLORS: Record<PromoScope, string> = {
  national: 'bg-blue-900/50 text-blue-400',
  regional: 'bg-purple-900/50 text-purple-400',
  local:    'bg-teal-900/50 text-teal-400',
};

const SCOPE_BAR_COLORS: Record<PromoScope, string> = {
  national: 'bg-blue-600',
  regional: 'bg-purple-600',
  local:    'bg-teal-600',
};

const TIPO_LABELS: Record<PromoTipo, string> = {
  descuento_porcentaje: '% Descuento',
  pack_ahorro:          'Pack ahorro',
  envio_gratis:         'Envío gratis',
  recogida_gratis:      'Recogida gratis',
  local_discount:       'Descuento local',
  clearance:            'Liquidación',
  discontinued:         'Descontinuado',
  local_campaign:       'Campaña local',
  excess_stock:         'Exceso stock',
  novedad:              'Novedad',
  destacado_home:       'Destacado home',
  destacado_perfil:     'Destacado perfil',
};

const STATUS_COLORS: Record<PromoStatus, string> = {
  active:    'bg-emerald-900/40 text-emerald-400',
  inactive:  'bg-slate-800 text-slate-500',
  scheduled: 'bg-amber-900/40 text-amber-400',
  expired:   'bg-red-900/30 text-red-500',
};

const STATUS_LABELS: Record<PromoStatus, string> = {
  active: 'Activa', inactive: 'Inactiva', scheduled: 'Programada', expired: 'Expirada',
};

// Columnas reales — sin prioridad, sin codigo, sin valor
interface Promotion {
  id:                     string;
  actor_id:               string;
  tipo:                   PromoTipo;
  scope:                  PromoScope;
  location_id:            string | null;
  comunidad_autonoma:     string | null;
  titulo:                 string;
  descripcion:            string | null;
  cta_label:              string | null;
  fecha_inicio:           string;
  fecha_fin:              string | null;
  activa:                 boolean;
  mostrar_en_home:        boolean;
  mostrar_en_perfil:      boolean;
  mostrar_chip_comparador: boolean;
  created_at:             string;
}

interface SupplierLocation {
  id: string; nombre: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promoStatus(p: Promotion): PromoStatus {
  if (!p.activa) return 'inactive';
  const now   = Date.now();
  const desde = new Date(p.fecha_inicio).getTime();
  const hasta = p.fecha_fin ? new Date(p.fecha_fin).getTime() : null;
  if (now < desde)          return 'scheduled';
  if (hasta && now > hasta) return 'expired';
  return 'active';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const inputCls  = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-600 transition-colors';
const selectCls = `${inputCls} appearance-none`;

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}

function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── FormValues alineado con schema real ──────────────────────────────────────

interface FormValues {
  titulo:                  string;
  descripcion:             string;
  tipo:                    PromoTipo;
  scope:                   PromoScope;
  fecha_inicio:            string;
  fecha_fin:               string;
  activa:                  boolean;
  cta_label:               string;
  location_id:             string;
  comunidad_autonoma:      string;
  mostrar_en_home:         boolean;
  mostrar_en_perfil:       boolean;
  mostrar_chip_comparador: boolean;
}

function emptyForm(): FormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    titulo: '', descripcion: '', tipo: 'descuento_porcentaje', scope: 'national',
    fecha_inicio: today, fecha_fin: '', activa: true, cta_label: '',
    location_id: '', comunidad_autonoma: '',
    mostrar_en_home: false, mostrar_en_perfil: true, mostrar_chip_comparador: false,
  };
}

function promoToForm(p: Promotion): FormValues {
  return {
    titulo:                  p.titulo,
    descripcion:             p.descripcion ?? '',
    tipo:                    p.tipo,
    scope:                   p.scope,
    fecha_inicio:            p.fecha_inicio.slice(0, 10),
    fecha_fin:               p.fecha_fin?.slice(0, 10) ?? '',
    activa:                  p.activa,
    cta_label:               p.cta_label ?? '',
    location_id:             p.location_id ?? '',
    comunidad_autonoma:      p.comunidad_autonoma ?? '',
    mostrar_en_home:         p.mostrar_en_home,
    mostrar_en_perfil:       p.mostrar_en_perfil,
    mostrar_chip_comparador: p.mostrar_chip_comparador,
  };
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer pt-1">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          on ? 'bg-teal-600' : 'bg-slate-700'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </label>
  );
}

// ─── PromoSlideOver ───────────────────────────────────────────────────────────

interface PromoSlideOverProps {
  actorId:   string;
  promo:     Promotion | null;
  locations: SupplierLocation[];
  onSave:    () => void;
  onClose:   () => void;
}

function PromoSlideOver({ actorId, promo, locations, onSave, onClose }: PromoSlideOverProps) {
  const [form,   setForm]   = useState<FormValues>(promo ? promoToForm(promo) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleSave() {
    if (!form.titulo.trim()) {
      setError('El título es obligatorio');
      return;
    }
    if (!form.fecha_inicio) {
      setError('La fecha de inicio es obligatoria');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      actor_id:               actorId,
      titulo:                 form.titulo.trim(),
      descripcion:            form.descripcion.trim() || null,
      tipo:                   form.tipo,
      scope:                  form.scope,
      fecha_inicio:           form.fecha_inicio,
      fecha_fin:              form.fecha_fin || null,
      activa:                 form.activa,
      cta_label:              form.cta_label.trim() || null,
      location_id:            form.scope === 'local' && form.location_id ? form.location_id : null,
      comunidad_autonoma:     form.scope === 'regional' && form.comunidad_autonoma.trim() ? form.comunidad_autonoma.trim() : null,
      mostrar_en_home:        form.mostrar_en_home,
      mostrar_en_perfil:      form.mostrar_en_perfil,
      mostrar_chip_comparador: form.mostrar_chip_comparador,
    };

    const { error: dbErr } = promo
      ? await supabase.from('trade_marketplace_promotions').update(payload).eq('id', promo.id)
      : await supabase.from('trade_marketplace_promotions').insert(payload);

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-bold text-slate-100 text-sm">
            {promo ? 'Editar promoción' : 'Nueva promoción'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <Field label="Título" required>
            <input
              className={inputCls}
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Promo verano 2026"
            />
          </Field>

          <Field label="Descripción">
            <textarea
              rows={2}
              className={inputCls}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Texto visible en el marketplace…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select
                className={selectCls}
                value={form.tipo}
                onChange={e => set('tipo', e.target.value as PromoTipo)}
              >
                {(Object.entries(TIPO_LABELS) as [PromoTipo, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Alcance">
              <select
                className={selectCls}
                value={form.scope}
                onChange={e => set('scope', e.target.value as PromoScope)}
              >
                {(Object.entries(SCOPE_LABELS) as [PromoScope, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          {form.scope === 'regional' && (
            <Field label="Comunidad autónoma">
              <input
                className={inputCls}
                value={form.comunidad_autonoma}
                onChange={e => set('comunidad_autonoma', e.target.value)}
                placeholder="Cantabria"
              />
            </Field>
          )}

          {form.scope === 'local' && locations.length > 0 && (
            <Field label="Tienda / almacén">
              <select
                className={selectCls}
                value={form.location_id}
                onChange={e => set('location_id', e.target.value)}
              >
                <option value="">Cualquier tienda</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha inicio" required>
              <input
                type="date"
                className={inputCls}
                value={form.fecha_inicio}
                onChange={e => set('fecha_inicio', e.target.value)}
              />
            </Field>
            <Field label="Fecha fin">
              <input
                type="date"
                className={inputCls}
                value={form.fecha_fin}
                onChange={e => set('fecha_fin', e.target.value)}
              />
            </Field>
          </div>

          <Field label="CTA (texto botón)" hint="Ej: Ver oferta">
            <input
              className={inputCls}
              value={form.cta_label}
              onChange={e => set('cta_label', e.target.value)}
              placeholder="Ver oferta"
            />
          </Field>

          <div className="space-y-2 pt-1 border-t border-slate-800">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Visibilidad</p>
            <ToggleSwitch on={form.activa}            label="Promoción activa"        onChange={v => set('activa', v)} />
            <ToggleSwitch on={form.mostrar_en_perfil} label="Mostrar en perfil"       onChange={v => set('mostrar_en_perfil', v)} />
            <ToggleSwitch on={form.mostrar_en_home}   label="Destacar en home"        onChange={v => set('mostrar_en_home', v)} />
            <ToggleSwitch on={form.mostrar_chip_comparador} label="Chip en comparador" onChange={v => set('mostrar_chip_comparador', v)} />
          </div>
        </div>

        <div className="p-5 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Guardando…' : promo ? 'Guardar cambios' : 'Crear promoción'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PromoCard ────────────────────────────────────────────────────────────────

interface PromoCardProps {
  promo:    Promotion;
  onEdit:   () => void;
  onToggle: () => void;
}

function PromoCard({ promo, onEdit, onToggle }: PromoCardProps) {
  const status = promoStatus(promo);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-all overflow-hidden flex">
      <div className={`w-1 shrink-0 ${SCOPE_BAR_COLORS[promo.scope]}`} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${SCOPE_COLORS[promo.scope]}`}>
                {SCOPE_LABELS[promo.scope]}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {TIPO_LABELS[promo.tipo]}
              </span>
            </div>

            <p className="font-bold text-slate-100 text-sm leading-snug">{promo.titulo}</p>
            {promo.descripcion && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{promo.descripcion}</p>
            )}

            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
              {fmtDate(promo.fecha_inicio)} → {fmtDate(promo.fecha_fin)}
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              {promo.mostrar_en_home && (
                <span className="text-[10px] text-teal-400 bg-teal-900/30 px-1.5 py-0.5 rounded">Home</span>
              )}
              {promo.mostrar_chip_comparador && (
                <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">Comparador</span>
              )}
              {promo.comunidad_autonoma && (
                <span className="text-[10px] text-slate-500">{promo.comunidad_autonoma}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={onToggle}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                promo.activa ? 'bg-teal-600' : 'bg-slate-700'
              }`}
              title={promo.activa ? 'Desactivar' : 'Activar'}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                promo.activa ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <button onClick={onEdit} className="text-[11px] text-slate-500 hover:text-teal-400 transition-colors">
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PromoExplanationBanner ───────────────────────────────────────────────────

function PromoExplanationBanner() {
  return (
    <div className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-teal-900/40 flex items-center justify-center mt-0.5">
        <svg className="h-3.5 w-3.5 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-200 mb-0.5">¿Qué son las Promociones?</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Descuentos, ofertas y condiciones especiales visibles en tu perfil y catálogo.{' '}
          <span className="text-slate-400 font-medium">No modifican el ranking del Marketplace</span>
          {' '}— el orden siempre refleja precio, stock y plazo de entrega.
        </p>
        <p className="text-[11px] text-slate-600 mt-1">
          Para aparecer en banners y espacios publicitarios, usa la pestaña{' '}
          <span className="text-teal-600">Publicidad Marketplace</span>.
        </p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

// ─── MarketingTabBar ──────────────────────────────────────────────────────────

type MarketingTab = 'promociones' | 'publicidad';

interface MarketingTabBarProps {
  active: MarketingTab;
  onChange: (tab: MarketingTab) => void;
}

const MARKETING_TABS: { id: MarketingTab; label: string }[] = [
  { id: 'promociones', label: 'Promociones' },
  { id: 'publicidad',  label: 'Publicidad Marketplace' },
];

function MarketingTabBar({ active, onChange }: MarketingTabBarProps) {
  return (
    <div className="flex gap-0 px-4 pt-3 bg-slate-950 border-b border-slate-800">
      {MARKETING_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? 'text-teal-400 border-teal-500 bg-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-900/50'
          }`}
        >
          {tab.id === 'promociones' ? (
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | PromoStatus;
const FILTER_LABELS: [FilterStatus, string][] = [
  ['all', 'Todas'], ['active', 'Activas'], ['scheduled', 'Programadas'],
  ['inactive', 'Inactivas'], ['expired', 'Expiradas'],
];

// ─── PortalMarketing ──────────────────────────────────────────────────────────

export default function PortalMarketing({ actorId }: Props) {
  const [activeTab,   setActiveTab]   = useState<MarketingTab>('promociones');
  const [promos,      setPromos]      = useState<Promotion[]>([]);
  const [locations,   setLocations]   = useState<SupplierLocation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [slideOver,   setSlideOver]   = useState(false);
  const [editing,     setEditing]     = useState<Promotion | null>(null);
  const [filter,      setFilter]      = useState<FilterStatus>('all');
  const [scopeFilter, setScopeFilter] = useState<PromoScope | 'all'>('all');
  const [search,      setSearch]      = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [promosRes, locsRes] = await Promise.all([
      supabase
        .from('trade_marketplace_promotions')
        .select('*')
        .eq('actor_id', actorId)
        .order('created_at', { ascending: false }),
      supabase
        .from('trade_marketplace_supplier_locations')
        .select('id, nombre')
        .eq('actor_id', actorId)
        .eq('activa', true)
        .order('nombre'),
    ]);
    setLoading(false);
    if (promosRes.error) { setError(promosRes.error.message); return; }
    setPromos((promosRes.data ?? []) as Promotion[]);
    setLocations((locsRes.data ?? []) as SupplierLocation[]);
  }, [actorId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggle(p: Promotion) {
    await supabase
      .from('trade_marketplace_promotions')
      .update({ activa: !p.activa })
      .eq('id', p.id);
    loadData();
  }

  const filtered = promos.filter(p => {
    if (search && !p.titulo.toLowerCase().includes(search.toLowerCase())) return false;
    if (scopeFilter !== 'all' && p.scope !== scopeFilter) return false;
    if (filter !== 'all' && promoStatus(p) !== filter) return false;
    return true;
  });

  const activeCount    = promos.filter(p => promoStatus(p) === 'active').length;
  const scheduledCount = promos.filter(p => promoStatus(p) === 'scheduled').length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Tabs */}
      <MarketingTabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab: Publicidad Marketplace */}
      {activeTab === 'publicidad' && (
        <PortalPublicidadMarketplace actorId={actorId} />
      )}

      {/* Tab: Promociones */}
      {activeTab === 'promociones' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-slate-100 text-base">Promociones locales</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeCount} activa{activeCount !== 1 ? 's' : ''}
                  {scheduledCount > 0 && `, ${scheduledCount} programada${scheduledCount !== 1 ? 's' : ''}`}
                  {' '}· {promos.length} total
                </p>
              </div>
              <button
                onClick={() => { setEditing(null); setSlideOver(true); }}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nueva
              </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar título…"
                className="flex-1 min-w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600 transition-colors"
              />
              <select
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as PromoScope | 'all')}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 appearance-none"
              >
                <option value="all">Todos los alcances</option>
                {(Object.entries(SCOPE_LABELS) as [PromoScope, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div className="flex gap-1 bg-slate-900 rounded-xl p-0.5">
                {FILTER_LABELS.map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      filter === k ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-6">
            <PromoExplanationBanner />

            {loading && (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="text-center py-16">
                <svg className="h-12 w-12 text-slate-800 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-slate-500 text-sm">
                  {search || filter !== 'all' || scopeFilter !== 'all'
                    ? 'Sin resultados para este filtro'
                    : 'Todavía no hay promociones'}
                </p>
                {promos.length === 0 && (
                  <button
                    onClick={() => { setEditing(null); setSlideOver(true); }}
                    className="mt-4 text-teal-400 hover:text-teal-300 text-sm transition-colors"
                  >
                    Crear la primera promoción →
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-3 max-w-2xl">
              {filtered.map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  onEdit={() => { setEditing(p); setSlideOver(true); }}
                  onToggle={() => handleToggle(p)}
                />
              ))}
            </div>

            {promos.length > 0 && (
              <p className="text-[10px] text-slate-700 mt-6 max-w-2xl">
                Las promociones afectan al precio que ve el comprador. No modifican el ranking — el orden en el marketplace siempre refleja stock, precio y plazo, nunca inversión publicitaria.
              </p>
            )}
          </div>

          {slideOver && (
            <PromoSlideOver
              actorId={actorId}
              promo={editing}
              locations={locations}
              onSave={() => { setSlideOver(false); loadData(); }}
              onClose={() => setSlideOver(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
