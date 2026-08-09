import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type LocationTipo = 'tienda' | 'almacen' | 'delegacion' | 'punto_recogida';
type StockStatus  = 'disponible' | 'disponible_hoy' | 'bajo_pedido' | 'sin_stock' | 'discontinuado';

const LOCATION_TIPO_LABELS: Record<LocationTipo, string> = {
  tienda:         'Tienda',
  almacen:        'Almacén',
  delegacion:     'Delegación',
  punto_recogida: 'Punto de recogida',
};

const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  disponible:     'Disponible',
  disponible_hoy: 'Disponible hoy',
  bajo_pedido:    'Bajo pedido',
  sin_stock:      'Sin stock',
  discontinuado:  'Discontinuado',
};

const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  disponible:     'bg-emerald-100 text-emerald-700',
  disponible_hoy: 'bg-teal-100 text-teal-700',
  bajo_pedido:    'bg-amber-100 text-amber-700',
  sin_stock:      'bg-red-100 text-red-700',
  discontinuado:  'bg-gray-100 text-gray-500',
};

interface SupplierLocation {
  id:                    string;
  actor_id:              string;
  codigo_interno:        string | null;
  nombre:                string;
  tipo:                  LocationTipo;
  direccion_linea1:      string | null;
  codigo_postal:         string | null;
  localidad:             string;
  provincia:             string;
  comunidad_autonoma:    string | null;
  telefono:              string | null;
  email:                 string | null;
  horario:               Record<string, string> | null;
  permite_recogida:      boolean;
  permite_entrega_local: boolean;
  radio_servicio_km:     number | null;
  activa:                boolean;
  orden:                 number;
  synthetic:             boolean;
}

interface LocationInventoryRow {
  id:               string;
  location_id:      string;
  offering_id:      string;
  stock_status:     StockStatus;
  stock_cantidad:   number | null;
  reservado:        number;
  plazo_local_dias: number | null;
  offering?: {
    id:                  string;
    nombre_interno:      string | null;
    codigo_interno:      string | null;
    precio_profesional:  number | null;
    unidad:              string;
  };
}

interface SupplierOffering {
  id:                 string;
  nombre_interno:     string | null;
  codigo_interno:     string | null;
  precio_profesional: number | null;
  unidad:             string;
}

// ─── Sub-componentes de formulario ────────────────────────────────────────────

interface FieldProps {
  label:    string;
  required?: boolean;
  children:  React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-600 transition-colors';
const selectCls = `${inputCls} appearance-none`;

// ─── LocationForm (dentro del SlideOver) ─────────────────────────────────────

interface LocationFormValues {
  nombre:                string;
  tipo:                  LocationTipo;
  direccion_linea1:      string;
  codigo_postal:         string;
  localidad:             string;
  provincia:             string;
  comunidad_autonoma:    string;
  telefono:              string;
  email:                 string;
  permite_recogida:      boolean;
  permite_entrega_local: boolean;
  radio_servicio_km:     string;
  activa:                boolean;
  orden:                 string;
}

function emptyForm(): LocationFormValues {
  return {
    nombre: '', tipo: 'tienda', direccion_linea1: '', codigo_postal: '',
    localidad: '', provincia: '', comunidad_autonoma: '', telefono: '', email: '',
    permite_recogida: true, permite_entrega_local: false,
    radio_servicio_km: '', activa: true, orden: '0',
  };
}

function locationToForm(loc: SupplierLocation): LocationFormValues {
  return {
    nombre:                loc.nombre,
    tipo:                  loc.tipo,
    direccion_linea1:      loc.direccion_linea1 ?? '',
    codigo_postal:         loc.codigo_postal ?? '',
    localidad:             loc.localidad,
    provincia:             loc.provincia,
    comunidad_autonoma:    loc.comunidad_autonoma ?? '',
    telefono:              loc.telefono ?? '',
    email:                 loc.email ?? '',
    permite_recogida:      loc.permite_recogida,
    permite_entrega_local: loc.permite_entrega_local,
    radio_servicio_km:     loc.radio_servicio_km?.toString() ?? '',
    activa:                loc.activa,
    orden:                 loc.orden.toString(),
  };
}

interface LocationSlideOverProps {
  actorId:   string;
  location:  SupplierLocation | null;
  onSave:    () => void;
  onClose:   () => void;
}

function LocationSlideOver({ actorId, location, onSave, onClose }: LocationSlideOverProps) {
  const [form,   setForm]   = useState<LocationFormValues>(location ? locationToForm(location) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const set = (k: keyof LocationFormValues, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleSave() {
    if (!form.nombre.trim() || !form.localidad.trim() || !form.provincia.trim()) {
      setError('Nombre, localidad y provincia son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      actor_id:              actorId,
      nombre:                form.nombre.trim(),
      tipo:                  form.tipo,
      direccion_linea1:      form.direccion_linea1.trim() || null,
      codigo_postal:         form.codigo_postal.trim() || null,
      localidad:             form.localidad.trim(),
      provincia:             form.provincia.trim(),
      comunidad_autonoma:    form.comunidad_autonoma.trim() || null,
      telefono:              form.telefono.trim() || null,
      email:                 form.email.trim() || null,
      permite_recogida:      form.permite_recogida,
      permite_entrega_local: form.permite_entrega_local,
      radio_servicio_km:     form.radio_servicio_km ? parseInt(form.radio_servicio_km) : null,
      activa:                form.activa,
      orden:                 parseInt(form.orden) || 0,
    };
    const { error: dbErr } = location
      ? await (supabase as any).from('trade_marketplace_supplier_locations').update(payload).eq('id', location.id)
      : await (supabase as any).from('trade_marketplace_supplier_locations').insert(payload);
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
            {location ? 'Editar tienda' : 'Nueva tienda / almacén'}
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

          <Field label="Nombre" required>
            <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="p.ej. Santander Centro" />
          </Field>

          <Field label="Tipo">
            <select className={selectCls} value={form.tipo} onChange={e => set('tipo', e.target.value as LocationTipo)}>
              {(Object.entries(LOCATION_TIPO_LABELS) as [LocationTipo, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Dirección">
            <input className={inputCls} value={form.direccion_linea1} onChange={e => set('direccion_linea1', e.target.value)} placeholder="Calle y número" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Código postal">
              <input className={inputCls} value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} placeholder="39001" />
            </Field>
            <Field label="Localidad" required>
              <input className={inputCls} value={form.localidad} onChange={e => set('localidad', e.target.value)} placeholder="Santander" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Provincia" required>
              <input className={inputCls} value={form.provincia} onChange={e => set('provincia', e.target.value)} placeholder="Cantabria" />
            </Field>
            <Field label="Comunidad">
              <input className={inputCls} value={form.comunidad_autonoma} onChange={e => set('comunidad_autonoma', e.target.value)} placeholder="Cantabria" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input className={inputCls} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="942 000 000" />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tienda@proveedor.es" />
            </Field>
          </div>

          <Field label="Radio de servicio (km)">
            <input className={inputCls} type="number" min={0} value={form.radio_servicio_km} onChange={e => set('radio_servicio_km', e.target.value)} placeholder="Sin límite" />
          </Field>

          <Field label="Orden de visualización">
            <input className={inputCls} type="number" min={0} value={form.orden} onChange={e => set('orden', e.target.value)} />
          </Field>

          <div className="space-y-3 pt-1">
            {([
              ['permite_recogida',      'Permite recogida en tienda'],
              ['permite_entrega_local', 'Permite entrega local a obra'],
              ['activa',                'Location activa'],
            ] as [keyof LocationFormValues, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">{label}</span>
                <button
                  type="button"
                  onClick={() => set(key, !(form[key] as boolean))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    form[key] ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    form[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            ))}
          </div>
        </div>
        <div className="p-5 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Guardando…' : location ? 'Guardar cambios' : 'Crear tienda'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LocationCard ─────────────────────────────────────────────────────────────

interface LocationCardProps {
  loc:         SupplierLocation;
  isSelected:  boolean;
  onSelect:    () => void;
  onEdit:      () => void;
  onToggle:    () => void;
}

function LocationCard({ loc, isSelected, onSelect, onEdit, onToggle }: LocationCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-teal-500 bg-teal-950/30'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              loc.activa ? 'bg-teal-900/50 text-teal-400' : 'bg-slate-800 text-slate-500'
            }`}>
              {LOCATION_TIPO_LABELS[loc.tipo]}
            </span>
            {loc.synthetic && (
              <span className="text-[10px] text-slate-600">Demo</span>
            )}
          </div>
          <p className="font-semibold text-slate-100 text-sm">{loc.nombre}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {[loc.direccion_linea1, loc.localidad, loc.provincia].filter(Boolean).join(', ')}
          </p>
          {loc.telefono && (
            <p className="text-[11px] text-slate-500 mt-1">{loc.telefono}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            {loc.permite_recogida && (
              <span className="text-emerald-400">✓ Recogida</span>
            )}
            {loc.permite_entrega_local && (
              <span className="text-teal-400">✓ Entrega local</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              loc.activa ? 'bg-teal-600' : 'bg-slate-700'
            }`}
            title={loc.activa ? 'Desactivar' : 'Activar'}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              loc.activa ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="text-[11px] text-slate-500 hover:text-teal-400 transition-colors"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock local tab ──────────────────────────────────────────────────────────

interface StockLocalTabProps {
  actorId:    string;
  locationId: string;
}

function StockLocalTab({ actorId, locationId }: StockLocalTabProps) {
  const [inventory,  setInventory]  = useState<LocationInventoryRow[]>([]);
  const [offerings,  setOfferings]  = useState<SupplierOffering[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [editMap,    setEditMap]    = useState<Record<string, { status: StockStatus; cantidad: string; plazo: string }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [invRes, offRes] = await Promise.all([
      (supabase as any)
        .from('trade_marketplace_location_inventory')
        .select('*, offering:offering_id(id, nombre_interno, codigo_interno, precio_profesional, unidad)')
        .eq('location_id', locationId),
      (supabase as any)
        .from('trade_marketplace_supplier_offerings')
        .select('id, nombre_interno, codigo_interno, precio_profesional, unidad')
        .eq('actor_id', actorId)
        .eq('activa', true)
        .order('nombre_interno'),
    ]);
    if (!invRes.error) setInventory(invRes.data ?? []);
    if (!offRes.error) setOfferings(offRes.data ?? []);
    setLoading(false);
  }, [actorId, locationId]);

  useEffect(() => { loadData(); }, [loadData]);

  function getEdit(offeringId: string, fallback?: LocationInventoryRow) {
    return editMap[offeringId] ?? {
      status:   fallback?.stock_status ?? 'disponible',
      cantidad: fallback?.stock_cantidad?.toString() ?? '',
      plazo:    fallback?.plazo_local_dias?.toString() ?? '',
    };
  }

  function setEdit(offeringId: string, patch: Partial<{ status: StockStatus; cantidad: string; plazo: string }>) {
    setEditMap(prev => ({
      ...prev,
      [offeringId]: { ...getEdit(offeringId, inventory.find(i => i.offering_id === offeringId)), ...patch },
    }));
  }

  async function saveRow(offeringId: string) {
    const ed = editMap[offeringId];
    if (!ed) return;
    setSaving(offeringId);
    await (supabase as any)
      .from('trade_marketplace_location_inventory')
      .upsert({
        location_id:      locationId,
        offering_id:      offeringId,
        stock_status:     ed.status,
        stock_cantidad:   ed.cantidad ? parseInt(ed.cantidad) : null,
        plazo_local_dias: ed.plazo    ? parseInt(ed.plazo)    : null,
        updated_by:       'portal_manual',
        source:           'portal',
        synthetic:        false,
      }, { onConflict: 'location_id,offering_id' });
    setSaving(null);
    loadData();
    setEditMap(prev => { const n = { ...prev }; delete n[offeringId]; return n; });
  }

  const inventoryByOfferingId = Object.fromEntries(inventory.map(i => [i.offering_id, i]));
  const allOfferingIds = new Set([...inventory.map(i => i.offering_id), ...offerings.map(o => o.id)]);
  const rows = [...allOfferingIds].map(id => ({
    offering:  offerings.find(o => o.id === id) ?? inventory.find(i => i.offering_id === id)?.offering,
    inv:       inventoryByOfferingId[id] ?? null,
    offeringId: id,
  })).filter(r => r.offering);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">
        Overrides de stock local. Sin override, usa el stock general del catálogo.
      </p>
      {rows.map(({ offering, inv, offeringId }) => {
        if (!offering) return null;
        const ed = editMap[offeringId];
        const currentStatus = (ed?.status ?? inv?.stock_status ?? 'disponible') as StockStatus;
        const isDirty = !!ed;

        return (
          <div key={offeringId} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {offering.nombre_interno ?? offering.codigo_interno ?? offeringId.slice(0, 8)}
                </p>
                {offering.precio_profesional != null && (
                  <p className="text-[11px] text-slate-500">
                    {offering.precio_profesional.toFixed(2)} € / {offering.unidad}
                  </p>
                )}
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STOCK_STATUS_COLORS[currentStatus]}`}>
                {STOCK_STATUS_LABELS[currentStatus]}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Estado</p>
                <select
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={currentStatus}
                  onChange={e => setEdit(offeringId, { status: e.target.value as StockStatus })}
                >
                  {(Object.entries(STOCK_STATUS_LABELS) as [StockStatus, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Cantidad</p>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={ed?.cantidad ?? inv?.stock_cantidad?.toString() ?? ''}
                  onChange={e => setEdit(offeringId, { cantidad: e.target.value })}
                  placeholder="—"
                />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Plazo (días)</p>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={ed?.plazo ?? inv?.plazo_local_dias?.toString() ?? ''}
                  onChange={e => setEdit(offeringId, { plazo: e.target.value })}
                  placeholder="—"
                />
              </div>
            </div>

            {isDirty && (
              <button
                onClick={() => saveRow(offeringId)}
                disabled={saving === offeringId}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50"
              >
                {saving === offeringId ? 'Guardando…' : 'Guardar cambio'}
              </button>
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">
          No hay referencias en el catálogo de este actor.
        </p>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

// ─── PortalTiendas ────────────────────────────────────────────────────────────

export default function PortalTiendas({ actorId }: Props) {
  const [locations,          setLocations]          = useState<SupplierLocation[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [selectedId,         setSelectedId]         = useState<string | null>(null);
  const [slideOverOpen,      setSlideOverOpen]      = useState(false);
  const [editingLocation,    setEditingLocation]    = useState<SupplierLocation | null>(null);
  const [activeSubTab,       setActiveSubTab]       = useState<'config' | 'stock'>('config');
  const [search,             setSearch]             = useState('');

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: dbErr } = await (supabase as any)
      .from('trade_marketplace_supplier_locations')
      .select('*')
      .eq('actor_id', actorId)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });
    setLoading(false);
    if (dbErr) { setError(dbErr.message); return; }
    setLocations(data ?? []);
  }, [actorId]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  async function handleToggle(loc: SupplierLocation) {
    await (supabase as any)
      .from('trade_marketplace_supplier_locations')
      .update({ activa: !loc.activa })
      .eq('id', loc.id);
    loadLocations();
  }

  const filtered = locations.filter(l =>
    !search || l.nombre.toLowerCase().includes(search.toLowerCase()) ||
    l.localidad.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLocation = locations.find(l => l.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Panel izquierdo — lista */}
      <div className="w-80 shrink-0 border-r border-slate-800 flex flex-col bg-slate-950">
        <div className="px-5 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-100 text-base">Tiendas y almacenes</h2>
            <button
              onClick={() => { setEditingLocation(null); setSlideOverOpen(true); }}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nueva
            </button>
          </div>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600 transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 px-2">{error}</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">
              {search ? 'Sin resultados' : 'Todavía no has añadido tiendas'}
            </p>
          )}
          {filtered.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              isSelected={loc.id === selectedId}
              onSelect={() => { setSelectedId(loc.id); setActiveSubTab('config'); }}
              onEdit={() => { setEditingLocation(loc); setSlideOverOpen(true); }}
              onToggle={() => handleToggle(loc)}
            />
          ))}
        </div>

        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600">
            {locations.filter(l => l.activa).length} activa{locations.filter(l => l.activa).length !== 1 ? 's' : ''} de {locations.length}
          </p>
        </div>
      </div>

      {/* Panel derecho — detalle */}
      <div className="flex-1 overflow-y-auto bg-slate-950">
        {!selectedLocation ? (
          <div className="flex items-center justify-center h-full text-center px-8">
            <div>
              <svg className="h-12 w-12 text-slate-800 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
              </svg>
              <p className="text-slate-500 text-sm">Selecciona una tienda para ver el detalle</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-400">
                    {LOCATION_TIPO_LABELS[selectedLocation.tipo]}
                  </span>
                  {!selectedLocation.activa && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                      Inactiva
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-slate-100 text-lg">{selectedLocation.nombre}</h2>
                <p className="text-sm text-slate-400">
                  {[selectedLocation.direccion_linea1, selectedLocation.localidad, selectedLocation.provincia].filter(Boolean).join(', ')}
                </p>
              </div>
              <button
                onClick={() => { setEditingLocation(selectedLocation); setSlideOverOpen(true); }}
                className="shrink-0 text-xs font-semibold border border-slate-700 text-slate-400 hover:text-teal-400 hover:border-teal-700 rounded-lg px-3 py-1.5 transition-colors"
              >
                Editar
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 bg-slate-900 rounded-xl p-1 mb-5 w-fit">
              {(['config', 'stock'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeSubTab === tab
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'config' ? 'Configuración' : 'Stock local'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeSubTab === 'config' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Código interno', selectedLocation.codigo_interno ?? '—'],
                  ['Teléfono',       selectedLocation.telefono ?? '—'],
                  ['Email',          selectedLocation.email ?? '—'],
                  ['Código postal',  selectedLocation.codigo_postal ?? '—'],
                  ['Radio servicio', selectedLocation.radio_servicio_km ? `${selectedLocation.radio_servicio_km} km` : 'Sin límite'],
                  ['Orden',          selectedLocation.orden.toString()],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm text-slate-200">{value}</p>
                  </div>
                ))}
                <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Capacidades</p>
                  <div className="space-y-0.5 text-xs">
                    <p className={selectedLocation.permite_recogida ? 'text-emerald-400' : 'text-slate-600'}>
                      {selectedLocation.permite_recogida ? '✓' : '✗'} Recogida en tienda
                    </p>
                    <p className={selectedLocation.permite_entrega_local ? 'text-emerald-400' : 'text-slate-600'}>
                      {selectedLocation.permite_entrega_local ? '✓' : '✗'} Entrega local
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'stock' && (
              <StockLocalTab actorId={actorId} locationId={selectedLocation.id} />
            )}
          </div>
        )}
      </div>

      {/* SlideOver crear/editar */}
      {slideOverOpen && (
        <LocationSlideOver
          actorId={actorId}
          location={editingLocation}
          onSave={() => { setSlideOverOpen(false); loadLocations(); }}
          onClose={() => setSlideOverOpen(false)}
        />
      )}
    </div>
  );
}
