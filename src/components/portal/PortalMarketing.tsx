import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PromoScope    = 'national' | 'regional' | 'local';
type PromoType     = 'percentage_discount' | 'fixed_amount' | 'fixed_price';
type PromoStatus   = 'active' | 'inactive' | 'scheduled' | 'expired';

const SCOPE_LABELS: Record<PromoScope, string> = {
  national: 'Nacional',
  regional: 'Regional',
  local:    'Local',
};

const SCOPE_COLORS: Record<PromoScope, string> = {
  national: 'bg-blue-900/50 text-blue-400',
  regional: 'bg-purple-900/50 text-purple-400',
  local:    'bg-teal-900/50 text-teal-400',
};

const TYPE_LABELS: Record<PromoType, string> = {
  percentage_discount: '% Descuento',
  fixed_amount:        'Importe fijo',
  fixed_price:         'Precio fijo',
};

const STATUS_COLORS: Record<PromoStatus, string> = {
  active:    'bg-emerald-900/40 text-emerald-400',
  inactive:  'bg-slate-800 text-slate-500',
  scheduled: 'bg-amber-900/40 text-amber-400',
  expired:   'bg-red-900/30 text-red-500',
};

interface Promotion {
  id:                    string;
  actor_id:              string;
  codigo:                string;
  nombre:                string;
  scope:                 PromoScope;
  tipo:                  PromoType;
  valor:                 number;
  comunidades_target:    string[] | null;
  location_ids_target:   string[] | null;
  offering_ids_target:   string[] | null;
  familia_ids_target:    string[] | null;
  valida_desde:          string;
  valida_hasta:          string | null;
  prioridad:             number;
  activa:                boolean;
  descripcion:           string | null;
}

interface SupplierLocation {
  id:     string;
  nombre: string;
}

interface SupplierOffering {
  id:             string;
  nombre_interno: string | null;
  codigo_interno: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promoStatus(p: Promotion): PromoStatus {
  if (!p.activa) return 'inactive';
  const now    = Date.now();
  const desde  = new Date(p.valida_desde).getTime();
  const hasta  = p.valida_hasta ? new Date(p.valida_hasta).getTime() : null;
  if (now < desde)             return 'scheduled';
  if (hasta && now > hasta)    return 'expired';
  return 'active';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtValor(tipo: PromoType, valor: number) {
  if (tipo === 'percentage_discount') return `−${valor}%`;
  if (tipo === 'fixed_price')         return `${valor.toFixed(2)} €`;
  return `−${valor.toFixed(2)} €`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const inputCls  = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-600 transition-colors';
const selectCls = `${inputCls} appearance-none`;

interface FieldProps {
  label:    string;
  required?: boolean;
  children:  React.ReactNode;
  hint?:     string;
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

// ─── PromoSlideOver ───────────────────────────────────────────────────────────

interface FormValues {
  codigo:              string;
  nombre:              string;
  scope:               PromoScope;
  tipo:                PromoType;
  valor:               string;
  valida_desde:        string;
  valida_hasta:        string;
  prioridad:           string;
  descripcion:         string;
  activa:              boolean;
  comunidades_target:  string;
  location_ids_target: string[];
  offering_ids_target: string[];
}

function emptyForm(): FormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    codigo: '', nombre: '', scope: 'national', tipo: 'percentage_discount',
    valor: '', valida_desde: today, valida_hasta: '', prioridad: '10',
    descripcion: '', activa: true,
    comunidades_target: '', location_ids_target: [], offering_ids_target: [],
  };
}

function promoToForm(p: Promotion): FormValues {
  return {
    codigo:              p.codigo,
    nombre:              p.nombre,
    scope:               p.scope,
    tipo:                p.tipo,
    valor:               p.valor.toString(),
    valida_desde:        p.valida_desde.slice(0, 10),
    valida_hasta:        p.valida_hasta?.slice(0, 10) ?? '',
    prioridad:           p.prioridad.toString(),
    descripcion:         p.descripcion ?? '',
    activa:              p.activa,
    comunidades_target:  (p.comunidades_target ?? []).join(', '),
    location_ids_target: p.location_ids_target ?? [],
    offering_ids_target: p.offering_ids_target ?? [],
  };
}

interface PromoSlideOverProps {
  actorId:   string;
  promo:     Promotion | null;
  locations: SupplierLocation[];
  offerings: SupplierOffering[];
  onSave:    () => void;
  onClose:   () => void;
}

function PromoSlideOver({ actorId, promo, locations, offerings, onSave, onClose }: PromoSlideOverProps) {
  const [form,   setForm]   = useState<FormValues>(promo ? promoToForm(promo) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const set = (k: keyof FormValues, v: string | boolean | string[]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  function toggleMultiId(key: 'location_ids_target' | 'offering_ids_target', id: string) {
    setForm(prev => {
      const cur = prev[key] as string[];
      return { ...prev, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.nombre.trim() || !form.valor) {
      setError('Código, nombre y valor son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);

    const comunidades = form.comunidades_target
      .split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      actor_id:              actorId,
      codigo:                form.codigo.trim().toUpperCase(),
      nombre:                form.nombre.trim(),
      scope:                 form.scope,
      tipo:                  form.tipo,
      valor:                 parseFloat(form.valor),
      valida_desde:          form.valida_desde,
      valida_hasta:          form.valida_hasta || null,
      prioridad:             parseInt(form.prioridad) || 10,
      descripcion:           form.descripcion.trim() || null,
      activa:                form.activa,
      comunidades_target:    comunidades.length > 0 ? comunidades : null,
      location_ids_target:   form.location_ids_target.length > 0 ? form.location_ids_target : null,
      offering_ids_target:   form.offering_ids_target.length > 0 ? form.offering_ids_target : null,
      familia_ids_target:    null,
    };

    const { error: dbErr } = promo
      ? await (supabase as any).from('trade_marketplace_promotions').update(payload).eq('id', promo.id)
      : await (supabase as any).from('trade_marketplace_promotions').insert(payload);

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Código" required>
              <input className={inputCls} value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="VERANO25" />
            </Field>
            <Field label="Prioridad" hint="Mayor = más prioridad">
              <input type="number" min={1} className={inputCls} value={form.prioridad} onChange={e => set('prioridad', e.target.value)} />
            </Field>
          </div>

          <Field label="Nombre" required>
            <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Promo verano 2026" />
          </Field>

          <Field label="Descripción">
            <textarea rows={2} className={inputCls} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Texto visible en el marketplace…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Alcance">
              <select className={selectCls} value={form.scope} onChange={e => set('scope', e.target.value as PromoScope)}>
                {(Object.entries(SCOPE_LABELS) as [PromoScope, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select className={selectCls} value={form.tipo} onChange={e => set('tipo', e.target.value as PromoType)}>
                {(Object.entries(TYPE_LABELS) as [PromoType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={form.tipo === 'percentage_discount' ? 'Valor (%)' : 'Valor (€)'} required>
            <input type="number" min={0} step="0.01" className={inputCls} value={form.valor} onChange={e => set('valor', e.target.value)} placeholder={form.tipo === 'percentage_discount' ? '10' : '5.00'} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Válida desde" required>
              <input type="date" className={inputCls} value={form.valida_desde} onChange={e => set('valida_desde', e.target.value)} />
            </Field>
            <Field label="Válida hasta">
              <input type="date" className={inputCls} value={form.valida_hasta} onChange={e => set('valida_hasta', e.target.value)} />
            </Field>
          </div>

          {form.scope === 'regional' && (
            <Field label="Comunidades autónomas" hint="Separadas por coma">
              <input className={inputCls} value={form.comunidades_target} onChange={e => set('comunidades_target', e.target.value)} placeholder="Cantabria, País Vasco" />
            </Field>
          )}

          {form.scope === 'local' && locations.length > 0 && (
            <Field label="Tiendas / almacenes">
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {locations.map(loc => (
                  <label key={loc.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.location_ids_target.includes(loc.id)}
                      onChange={() => toggleMultiId('location_ids_target', loc.id)}
                      className="accent-teal-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors">{loc.nombre}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {offerings.length > 0 && (
            <Field label="Productos específicos" hint="Vacío = todos los productos">
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {offerings.map(off => (
                  <label key={off.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.offering_ids_target.includes(off.id)}
                      onChange={() => toggleMultiId('offering_ids_target', off.id)}
                      className="accent-teal-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors truncate">
                      {off.nombre_interno ?? off.codigo_interno ?? off.id.slice(0, 8)}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <label className="flex items-center justify-between cursor-pointer pt-1">
            <span className="text-sm text-slate-300">Promoción activa</span>
            <button
              type="button"
              onClick={() => set('activa', !form.activa)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                form.activa ? 'bg-teal-600' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                form.activa ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </label>
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
    <div className="bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-all p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${SCOPE_COLORS[promo.scope]}`}>
              {SCOPE_LABELS[promo.scope]}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[status]}`}>
              {status === 'active' ? 'Activa' : status === 'inactive' ? 'Inactiva' : status === 'scheduled' ? 'Programada' : 'Expirada'}
            </span>
            <code className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {promo.codigo}
            </code>
          </div>

          <p className="font-semibold text-slate-100 text-sm">{promo.nombre}</p>
          {promo.descripcion && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{promo.descripcion}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="font-bold text-emerald-400 text-sm">{fmtValor(promo.tipo, promo.valor)}</span>
            <span>{TYPE_LABELS[promo.tipo]}</span>
            <span className="text-slate-600">Prio: {promo.prioridad}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3"  y1="10" x2="21" y2="10" />
            </svg>
            {fmtDate(promo.valida_desde)} → {fmtDate(promo.valida_hasta)}
          </div>

          {promo.offering_ids_target && promo.offering_ids_target.length > 0 && (
            <p className="text-[10px] text-slate-600 mt-1">
              {promo.offering_ids_target.length} producto{promo.offering_ids_target.length !== 1 ? 's' : ''} específico{promo.offering_ids_target.length !== 1 ? 's' : ''}
            </p>
          )}
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
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | PromoStatus;
const FILTER_LABELS: [FilterStatus, string][] = [
  ['all', 'Todas'], ['active', 'Activas'], ['scheduled', 'Programadas'],
  ['inactive', 'Inactivas'], ['expired', 'Expiradas'],
];

// ─── PortalMarketing ──────────────────────────────────────────────────────────

export default function PortalMarketing({ actorId }: Props) {
  const [promos,       setPromos]       = useState<Promotion[]>([]);
  const [locations,    setLocations]    = useState<SupplierLocation[]>([]);
  const [offerings,    setOfferings]    = useState<SupplierOffering[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [slideOver,    setSlideOver]    = useState(false);
  const [editing,      setEditing]      = useState<Promotion | null>(null);
  const [filter,       setFilter]       = useState<FilterStatus>('all');
  const [scopeFilter,  setScopeFilter]  = useState<PromoScope | 'all'>('all');
  const [search,       setSearch]       = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [promosRes, locsRes, offsRes] = await Promise.all([
      (supabase as any)
        .from('trade_marketplace_promotions')
        .select('*')
        .eq('actor_id', actorId)
        .order('prioridad', { ascending: false })
        .order('valida_desde', { ascending: false }),
      (supabase as any)
        .from('trade_marketplace_supplier_locations')
        .select('id, nombre')
        .eq('actor_id', actorId)
        .eq('activa', true)
        .order('nombre'),
      (supabase as any)
        .from('trade_marketplace_supplier_offerings')
        .select('id, nombre_interno, codigo_interno')
        .eq('actor_id', actorId)
        .eq('activa', true)
        .order('nombre_interno'),
    ]);
    setLoading(false);
    if (promosRes.error) { setError(promosRes.error.message); return; }
    setPromos(promosRes.data ?? []);
    setLocations(locsRes.data ?? []);
    setOfferings(offsRes.data ?? []);
  }, [actorId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggle(p: Promotion) {
    await (supabase as any)
      .from('trade_marketplace_promotions')
      .update({ activa: !p.activa })
      .eq('id', p.id);
    loadData();
  }

  const filtered = promos.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase()) &&
        !p.codigo.toLowerCase().includes(search.toLowerCase())) return false;
    if (scopeFilter !== 'all' && p.scope !== scopeFilter) return false;
    if (filter !== 'all' && promoStatus(p) !== filter) return false;
    return true;
  });

  const activeCount    = promos.filter(p => promoStatus(p) === 'active').length;
  const scheduledCount = promos.filter(p => promoStatus(p) === 'scheduled').length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
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
            placeholder="Buscar código o nombre…"
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
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <svg className="h-12 w-12 text-slate-800 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-slate-500 text-sm">
              {search || filter !== 'all' || scopeFilter !== 'all' ? 'Sin resultados para este filtro' : 'Todavía no hay promociones'}
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

        {/* Aviso invariante publicidad */}
        {promos.length > 0 && (
          <p className="text-[10px] text-slate-700 mt-6 max-w-2xl">
            Las promociones afectan al precio que ve el comprador. No modifican el ranking de productos — el orden en el marketplace siempre refleja stock, precio y plazo, nunca inversión publicitaria.
          </p>
        )}
      </div>

      {/* SlideOver */}
      {slideOver && (
        <PromoSlideOver
          actorId={actorId}
          promo={editing}
          locations={locations}
          offerings={offerings}
          onSave={() => { setSlideOver(false); loadData(); }}
          onClose={() => setSlideOver(false)}
        />
      )}
    </div>
  );
}
