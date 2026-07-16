import { useState, useEffect } from 'react';
import { Package, ToggleLeft, ToggleRight, RefreshCw, ChevronDown, ExternalLink, Store, Pencil, Star, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CATEGORIAS_DISPONIBLES = [
  'ACS', 'Calefacción', 'Climatización', 'Construcción', 'Electricidad', 'Fontanería',
  'Gas y calefacción', 'Pintura', 'Albañilería', 'Reformas',
  'Solar / Fotovoltaica', 'Telecomunicaciones', 'Carpintería', 'Cristalería', 'Suelos',
];

interface CatalogRow {
  id: string;
  supplier_key: string;
  supplier_name: string;
  margen_pct_default: number;
  prioridad: number;
  productos: number;
}

interface OrgSetting {
  catalog_id: string;
  enabled: boolean;
  margen_override: number | null;
  display_name: string | null;
  preferido_categorias: string[] | null;
  tienda_nombre: string | null;
  tienda_telefono: string | null;
  tienda_contacto: string | null;
  tienda_web: string | null;
  tienda_direccion: string | null;
}

const SUPPLIER_META: Record<string, { color: string; descripcion: string }> = {
  obramat:  { color: '#E87722', descripcion: 'Materiales de construcción e instalaciones' },
  saltoki:  { color: '#1A5A96', descripcion: 'Fontanería, calefacción y climatización' },
  sonepar:  { color: '#6366f1', descripcion: 'Distribución eléctrica e industrial' },
  novelec:  { color: '#f59e0b', descripcion: 'Material eléctrico y automatización' },
  rexel:    { color: '#ef4444', descripcion: 'Distribución eléctrica global' },
  vaillant: { color: '#10b981', descripcion: 'Calefacción, ACS y climatización' },
  junkers:  { color: '#ec4899', descripcion: 'Calderas, calentadores y ACS' },
  ariston:  { color: '#14b8a6', descripcion: 'Calentadores y acumuladores ACS' },
  baxi:     { color: '#8b5cf6', descripcion: 'Calderas y calentadores residenciales' },
  ferroli:  { color: '#f97316', descripcion: 'Calefacción, climatización y ACS' },
};

interface TiendaEdit {
  nombre: string; telefono: string; contacto: string; web: string; direccion: string;
}

interface Props {
  orgId: string;
  toast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export default function SettingsSuppliers({ orgId, toast }: Props) {
  const [catalogs, setCatalogs]           = useState<CatalogRow[]>([]);
  const [settings, setSettings]           = useState<Record<string, OrgSetting>>({});
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState<string | null>(null);
  const [expanded, setExpanded]           = useState<string | null>(null);
  const [editMargen, setEditMargen]       = useState<Record<string, string>>({});
  const [editDisplayName, setEditDisplayName] = useState<Record<string, string>>({});
  const [editCats, setEditCats]           = useState<Record<string, string[]>>({});
  const [editTienda, setEditTienda]       = useState<Record<string, TiendaEdit>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [catRes, settRes, countRes] = await Promise.all([
          supabase
            .from('trade_supplier_catalogs')
            .select('id, supplier_key, supplier_name, margen_pct_default, prioridad')
            .is('org_id', null)
            .eq('is_active', true)
            .order('prioridad'),
          supabase
            .from('trade_org_suppliers')
            .select('catalog_id, enabled, margen_override, display_name, preferido_categorias, tienda_nombre, tienda_telefono, tienda_contacto, tienda_web, tienda_direccion')
            .eq('org_id', orgId),
          supabase.from('trade_supplier_products').select('catalog_id'),
        ]);

        const countMap = new Map<string, number>();
        for (const r of (countRes.data ?? []) as Array<{ catalog_id: string }>) {
          countMap.set(r.catalog_id, (countMap.get(r.catalog_id) ?? 0) + 1);
        }

        const rows: CatalogRow[] = (catRes.data ?? []).map((c: {
          id: string; supplier_key: string; supplier_name: string;
          margen_pct_default: number; prioridad: number;
        }) => ({ ...c, productos: countMap.get(c.id) ?? 0 }));
        setCatalogs(rows);

        const sMap: Record<string, OrgSetting> = {};
        for (const s of (settRes.data ?? []) as OrgSetting[]) sMap[s.catalog_id] = s;
        setSettings(sMap);

        const margenes: Record<string, string> = {};
        const displayNames: Record<string, string> = {};
        const cats: Record<string, string[]> = {};
        const tiendas: Record<string, TiendaEdit> = {};
        for (const c of rows) {
          const s = sMap[c.id];
          margenes[c.id]     = String(s?.margen_override ?? c.margen_pct_default);
          displayNames[c.id] = s?.display_name ?? '';
          cats[c.id]         = s?.preferido_categorias ?? [];
          tiendas[c.id]      = {
            nombre:    s?.tienda_nombre    ?? '',
            telefono:  s?.tienda_telefono  ?? '',
            contacto:  s?.tienda_contacto  ?? '',
            web:       s?.tienda_web       ?? '',
            direccion: s?.tienda_direccion ?? '',
          };
        }
        setEditMargen(margenes);
        setEditDisplayName(displayNames);
        setEditCats(cats);
        setEditTienda(tiendas);
      } catch (e) {
        toast('error', 'Error cargando proveedores');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  const isEnabled = (catId: string) => settings[catId]?.enabled ?? false;

  const handleToggle = async (cat: CatalogRow) => {
    const current = isEnabled(cat.id);
    const newEnabled = !current;
    setSaving(cat.id);
    setSettings(prev => ({
      ...prev,
      [cat.id]: { ...(prev[cat.id] ?? { catalog_id: cat.id, enabled: current, margen_override: null, display_name: null, preferido_categorias: null, tienda_nombre: null, tienda_telefono: null, tienda_contacto: null, tienda_web: null, tienda_direccion: null }), enabled: newEnabled },
    }));
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      { org_id: orgId, catalog_id: cat.id, enabled: newEnabled },
      { onConflict: 'org_id,catalog_id' },
    );
    if (error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], enabled: current } }));
      toast('error', `Error al ${newEnabled ? 'activar' : 'desactivar'}`);
    } else {
      toast('success', `${cat.supplier_name} ${newEnabled ? 'activado' : 'desactivado'}`);
    }
    setSaving(null);
  };

  const handleSaveMargenAndName = async (cat: CatalogRow) => {
    const val = parseFloat(editMargen[cat.id] ?? '');
    if (isNaN(val) || val < 0 || val > 200) { toast('error', 'Margen inválido (0–200%)'); return; }
    setSaving(cat.id + '_m');
    const displayName = editDisplayName[cat.id]?.trim() || null;
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val, display_name: displayName },
      { onConflict: 'org_id,catalog_id' },
    );
    if (error) {
      toast('error', 'Error al guardar');
    } else {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val, display_name: displayName } }));
      toast('success', 'Configuración guardada');
    }
    setSaving(null);
  };

  const toggleCat = (catId: string, cat: string) => {
    setEditCats(prev => {
      const current = prev[catId] ?? [];
      return {
        ...prev,
        [catId]: current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat],
      };
    });
  };

  const handleSaveCats = async (cat: CatalogRow) => {
    setSaving(cat.id + '_c');
    const newCats = editCats[cat.id] ?? [];

    // Quitar estas categorías de cualquier otro proveedor que las tuviera
    const otherIds = catalogs.filter(c => c.id !== cat.id).map(c => c.id);
    const upserts = otherIds
      .filter(otherId => {
        const otherCats = settings[otherId]?.preferido_categorias ?? [];
        return newCats.some(nc => otherCats.includes(nc));
      })
      .map(otherId => {
        const cleaned = (settings[otherId]?.preferido_categorias ?? []).filter(c => !newCats.includes(c));
        return supabase.from('trade_org_suppliers').upsert(
          { org_id: orgId, catalog_id: otherId, enabled: isEnabled(otherId), preferido_categorias: cleaned },
          { onConflict: 'org_id,catalog_id' },
        );
      });

    const [mainResult, ...rest] = await Promise.all([
      supabase.from('trade_org_suppliers').upsert(
        { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), preferido_categorias: newCats },
        { onConflict: 'org_id,catalog_id' },
      ),
      ...upserts,
    ]);

    if (mainResult.error || rest.some(r => r.error)) {
      toast('error', 'Error al guardar preferencias');
    } else {
      // Actualizar estado local: limpiar las categorías transferidas de otros proveedores
      setSettings(prev => {
        const next = { ...prev };
        next[cat.id] = { ...next[cat.id], catalog_id: cat.id, enabled: isEnabled(cat.id), preferido_categorias: newCats };
        for (const otherId of otherIds) {
          if (next[otherId]) {
            next[otherId] = {
              ...next[otherId],
              preferido_categorias: (next[otherId].preferido_categorias ?? []).filter(c => !newCats.includes(c)),
            };
            setEditCats(ec => ({
              ...ec,
              [otherId]: (ec[otherId] ?? []).filter(c => !newCats.includes(c)),
            }));
          }
        }
        return next;
      });
      toast('success', `Preferencias de ${cat.supplier_name} guardadas`);
    }
    setSaving(null);
  };

  const handleSaveTienda = async (cat: CatalogRow) => {
    setSaving(cat.id + '_t');
    const t = editTienda[cat.id] ?? { nombre: '', telefono: '', contacto: '', web: '', direccion: '' };
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      {
        org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id),
        tienda_nombre:    t.nombre.trim()    || null,
        tienda_telefono:  t.telefono.trim()  || null,
        tienda_contacto:  t.contacto.trim()  || null,
        tienda_web:       t.web.trim()       || null,
        tienda_direccion: t.direccion.trim() || null,
      },
      { onConflict: 'org_id,catalog_id' },
    );
    if (error) {
      toast('error', 'Error al guardar tienda');
    } else {
      setSettings(prev => ({
        ...prev,
        [cat.id]: {
          ...prev[cat.id], catalog_id: cat.id,
          tienda_nombre:    t.nombre.trim()    || null,
          tienda_telefono:  t.telefono.trim()  || null,
          tienda_contacto:  t.contacto.trim()  || null,
          tienda_web:       t.web.trim()       || null,
          tienda_direccion: t.direccion.trim() || null,
        },
      }));
      toast('success', 'Datos de tienda guardados');
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-xs">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Cargando catálogos…
      </div>
    );
  }

  const activeCount = Object.values(settings).filter(s => s.enabled).length;

  // Mapa de categoría → nombre del proveedor que la tiene como preferida
  const catOwner: Record<string, string> = {};
  for (const cat of catalogs) {
    const cats = settings[cat.id]?.preferido_categorias ?? [];
    for (const c of cats) catOwner[c] = settings[cat.id]?.display_name ?? cat.supplier_name;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Activa los proveedores con los que trabajas, ajusta el margen y configura qué proveedor
          prefieres para cada tipo de material.
        </p>
        {activeCount > 0 && (
          <span className="shrink-0 ml-3 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            {activeCount} activo{activeCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Resumen de preferencias por categoría */}
      {Object.keys(catOwner).length > 0 && (
        <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Star className="w-3 h-3" /> Preferencias activas
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(catOwner).map(([cat, nombre]) => (
              <span key={cat} className="text-[9px] bg-white border border-sky-200 text-sky-700 px-1.5 py-0.5 rounded-full font-semibold">
                {cat} → {nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {catalogs.map(cat => {
          const meta          = SUPPLIER_META[cat.supplier_key];
          const enabled       = isEnabled(cat.id);
          const isOpen        = expanded === cat.id;
          const isSavingToggle = saving === cat.id;
          const isSavingMargen = saving === cat.id + '_m';
          const isSavingCats   = saving === cat.id + '_c';
          const isSavingTienda = saving === cat.id + '_t';
          const margenActual   = settings[cat.id]?.margen_override ?? cat.margen_pct_default;
          const displayNameSaved = settings[cat.id]?.display_name;
          const savedCats      = settings[cat.id]?.preferido_categorias ?? [];
          const editCatList    = editCats[cat.id] ?? [];
          const tienda         = editTienda[cat.id] ?? { nombre: '', telefono: '', contacto: '', web: '', direccion: '' };
          const hasTienda      = !!(settings[cat.id]?.tienda_nombre || settings[cat.id]?.tienda_telefono);

          return (
            <div
              key={cat.id}
              className={`rounded-xl border transition-all ${enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}
            >
              {/* Fila principal */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ backgroundColor: (meta?.color ?? '#64748b') + '20', border: `1px solid ${meta?.color ?? '#64748b'}30` }}
                >
                  <span style={{ color: meta?.color ?? '#64748b' }}>
                    {cat.supplier_name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">
                      {displayNameSaved || cat.supplier_name}
                    </span>
                    {displayNameSaved && (
                      <span className="text-[9px] text-slate-400 italic">({cat.supplier_name})</span>
                    )}
                    {cat.productos > 0 && (
                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {cat.productos} prods
                      </span>
                    )}
                    {savedCats.length > 0 && (
                      <span className="text-[9px] text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-sky-400 text-sky-400" />
                        {savedCats.length} cat.
                      </span>
                    )}
                    {hasTienda && (
                      <span className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Store className="w-2.5 h-2.5" /> tienda
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{meta?.descripcion ?? ''}</p>
                </div>

                <span className="text-[10px] text-slate-500 shrink-0 hidden sm:block">
                  Margen: <strong className="text-slate-700">{margenActual}%</strong>
                </span>

                <button
                  onClick={() => setExpanded(isOpen ? null : cat.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <button
                  onClick={() => handleToggle(cat)}
                  disabled={isSavingToggle}
                  className="cursor-pointer shrink-0 disabled:opacity-50"
                  title={enabled ? 'Desactivar' : 'Activar'}
                >
                  {isSavingToggle
                    ? <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                    : enabled
                      ? <ToggleRight className="h-7 w-7 text-emerald-500" />
                      : <ToggleLeft className="h-7 w-7 text-slate-300" />
                  }
                </button>
              </div>

              {/* Panel expandido */}
              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">

                  {/* ── Nombre + Margen ── */}
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Configuración del catálogo
                    </p>

                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                        <Pencil className="w-2.5 h-2.5" /> Nombre a mostrar en presupuestos
                      </label>
                      <input
                        type="text"
                        placeholder={cat.supplier_name}
                        value={editDisplayName[cat.id] ?? ''}
                        onChange={e => setEditDisplayName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Ej: «OBRAMAT (DEMO · Precios ficticios)»
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">
                        Margen sobre precio de compra (%)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number" min={0} max={200} step={0.5}
                          value={editMargen[cat.id] ?? ''}
                          onChange={e => setEditMargen(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleSaveMargenAndName(cat)}
                          disabled={isSavingMargen}
                          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          {isSavingMargen ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                          Guardar
                        </button>
                        <span className="text-[10px] text-slate-400">
                          100€ → <strong className="text-slate-600">
                            {(100 * (1 + (parseFloat(editMargen[cat.id] ?? '0') || 0) / 100)).toFixed(2)} €
                          </strong>
                        </span>
                      </div>
                      {settings[cat.id]?.margen_override != null && (
                        <p className="text-[9px] text-blue-500 mt-1">
                          Margen personalizado · global por defecto: {cat.margen_pct_default}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Preferencias por categoría ── */}
                  <div className="px-4 py-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Proveedor preferido para estas categorías
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        La IA mostrará este proveedor primero cuando la partida pertenezca a estas familias.
                        Solo puede haber un proveedor preferido por categoría.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIAS_DISPONIBLES.map(c => {
                        const selected = editCatList.includes(c);
                        const ownedByOther = !selected && catOwner[c] && catOwner[c] !== (displayNameSaved || cat.supplier_name);
                        return (
                          <button
                            key={c}
                            onClick={() => toggleCat(cat.id, c)}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                              selected
                                ? 'bg-sky-500 border-sky-500 text-white'
                                : ownedByOther
                                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-default'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600'
                            }`}
                            title={ownedByOther ? `Ya asignado a ${catOwner[c]}` : undefined}
                            disabled={!!ownedByOther}
                          >
                            {selected && '★ '}{c}
                          </button>
                        );
                      })}
                    </div>

                    {editCatList.length > 0 && (
                      <p className="text-[9px] text-sky-600">
                        Seleccionadas: {editCatList.join(', ')}
                      </p>
                    )}

                    <button
                      onClick={() => handleSaveCats(cat)}
                      disabled={isSavingCats}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {isSavingCats ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                      Guardar preferencias
                    </button>
                  </div>

                  {/* ── Mi tienda favorita ── */}
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Store className="w-3 h-3" /> Mi tienda favorita
                    </p>
                    <p className="text-[10px] text-slate-400 -mt-1">
                      Datos de tu sucursal habitual de {cat.supplier_name}.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 mb-0.5 block">Nombre / sucursal</label>
                        <input
                          type="text"
                          placeholder={`${cat.supplier_name} Santander`}
                          value={tienda.nombre}
                          onChange={e => setEditTienda(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], nombre: e.target.value } }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-0.5 block">Teléfono</label>
                        <input
                          type="tel" placeholder="942 000 000"
                          value={tienda.telefono}
                          onChange={e => setEditTienda(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], telefono: e.target.value } }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-0.5 block">Contacto</label>
                        <input
                          type="text" placeholder="Nombre del comercial"
                          value={tienda.contacto}
                          onChange={e => setEditTienda(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], contacto: e.target.value } }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 mb-0.5 block">Dirección</label>
                        <input
                          type="text" placeholder="Calle, nº, ciudad"
                          value={tienda.direccion}
                          onChange={e => setEditTienda(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], direccion: e.target.value } }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 mb-0.5 block">Web</label>
                        <input
                          type="url" placeholder="https://www.saltoki.es"
                          value={tienda.web}
                          onChange={e => setEditTienda(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], web: e.target.value } }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveTienda(cat)}
                        disabled={isSavingTienda}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {isSavingTienda ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Store className="h-3 w-3" />}
                        Guardar tienda
                      </button>
                      {tienda.web && (
                        <a href={tienda.web} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-semibold">
                          <ExternalLink className="w-3 h-3" /> Abrir web
                        </a>
                      )}
                      {tienda.telefono && (
                        <a href={`tel:${tienda.telefono.replace(/\s/g, '')}`}
                          className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold">
                          📞 Llamar
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {catalogs.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-xs">
          <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          No hay catálogos disponibles todavía
        </div>
      )}
    </div>
  );
}
