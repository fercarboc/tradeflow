import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, Package, RefreshCw, Eye, Star,
  ToggleLeft, ToggleRight, Upload, FileSpreadsheet, Download, X, Plus, Search, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CatalogRow {
  id: string;
  supplier_key: string;
  supplier_name: string;
  margen_pct_default: number;
  prioridad: number;
  productos: number;
  is_custom: boolean;
  org_id: string | null;
}

interface OrgSetting {
  catalog_id: string;
  enabled: boolean;
  margen_override: number | null;
  preferido_categorias?: string[] | null;
}

interface ProductRow {
  id: string;
  ref_proveedor: string | null;
  descripcion: string;
  marca: string | null;
  precio_coste: number;
  unidad: string;
}

const TRADE_CATEGORIAS = [
  'Fontanería', 'Electricidad', 'Climatización', 'Gas y calefacción',
  'Carpintería', 'Pintura', 'Albañilería', 'Reformas baño',
  'Reformas cocina', 'Reforma integral', 'Telecomunicaciones', 'Solar / fotovoltaica',
  'Mudanzas', 'Reformas interiores',
];

const SUPPLIER_META: Record<string, { color: string; descripcion: string; tipo: string }> = {
  propio:   { color: '#059669', descripcion: 'Tus tarifas personalizadas y negociadas',          tipo: 'Propio' },
  obramat:  { color: '#E87722', descripcion: 'Materiales de construcción e instalaciones',        tipo: 'Nacional' },
  saltoki:  { color: '#1A5A96', descripcion: 'Fontanería, calefacción y climatización',           tipo: 'Nacional' },
  sonepar:  { color: '#6366f1', descripcion: 'Distribución eléctrica e industrial',               tipo: 'Nacional' },
  novelec:  { color: '#d97706', descripcion: 'Material eléctrico y automatización',               tipo: 'Nacional' },
  rexel:    { color: '#dc2626', descripcion: 'Distribución eléctrica global',                     tipo: 'Nacional' },
  vaillant: { color: '#10b981', descripcion: 'Calefacción, ACS y climatización',                  tipo: 'Fabricante' },
  junkers:  { color: '#db2777', descripcion: 'Calderas, calentadores y ACS',                      tipo: 'Fabricante' },
  ariston:  { color: '#0d9488', descripcion: 'Calentadores y acumuladores ACS',                   tipo: 'Fabricante' },
  baxi:     { color: '#7c3aed', descripcion: 'Calderas y calentadores residenciales',             tipo: 'Fabricante' },
  ferroli:  { color: '#ea580c', descripcion: 'Calefacción, climatización y ACS',                  tipo: 'Fabricante' },
};

const CSV_COLUMNS = [
  { campo: 'codigo',        req: true,  ejemplo: 'FON-001' },
  { campo: 'descripcion',   req: true,  ejemplo: 'Termo eléctrico 100L' },
  { campo: 'marca',         req: false, ejemplo: 'Junkers' },
  { campo: 'precio_compra', req: true,  ejemplo: '289.50' },
  { campo: 'familia',       req: false, ejemplo: 'ACS' },
  { campo: 'unidad',        req: false, ejemplo: 'ud' },
];

const PAGE_SIZE = 50;

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ScreenProveedoresCliente({ orgId, showToast }: Props) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [settings, setSettings] = useState<Record<string, OrgSetting>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const [editMargen, setEditMargen] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savingPreferido, setSavingPreferido] = useState<string | null>(null);

  const [showProducts, setShowProducts] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [productCatalogId, setProductCatalogId] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [creatingPropio, setCreatingPropio] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [globalRes, propioRes, settRes, countRes] = await Promise.all([
          supabase
            .from('trade_supplier_catalogs')
            .select('id, supplier_key, supplier_name, margen_pct_default, prioridad, is_custom, org_id')
            .is('org_id', null)
            .eq('is_active', true)
            .order('prioridad'),
          supabase
            .from('trade_supplier_catalogs')
            .select('id, supplier_key, supplier_name, margen_pct_default, prioridad, is_custom, org_id')
            .eq('org_id', orgId)
            .eq('supplier_key', 'propio')
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('trade_org_suppliers')
            .select('catalog_id, enabled, margen_override, preferido_categorias')
            .eq('org_id', orgId),
          supabase
            .from('trade_supplier_products')
            .select('catalog_id'),
        ]);

        const countMap = new Map<string, number>();
        for (const r of (countRes.data ?? []) as Array<{ catalog_id: string }>) {
          countMap.set(r.catalog_id, (countMap.get(r.catalog_id) ?? 0) + 1);
        }

        const globalRows: CatalogRow[] = (globalRes.data ?? []).map((c: {
          id: string; supplier_key: string; supplier_name: string;
          margen_pct_default: number; prioridad: number; is_custom: boolean; org_id: string | null;
        }) => ({ ...c, productos: countMap.get(c.id) ?? 0 }));

        const allCatalogs: CatalogRow[] = [];
        if (propioRes.data) {
          allCatalogs.push({ ...propioRes.data, productos: countMap.get(propioRes.data.id) ?? 0 });
        }
        allCatalogs.push(...globalRows);
        setCatalogs(allCatalogs);

        const sMap: Record<string, OrgSetting> = {};
        for (const s of (settRes.data ?? []) as OrgSetting[]) {
          sMap[s.catalog_id] = s;
        }
        setSettings(sMap);

        const margenes: Record<string, string> = {};
        for (const c of allCatalogs) {
          margenes[c.id] = String(sMap[c.id]?.margen_override ?? c.margen_pct_default);
        }
        setEditMargen(margenes);
      } catch (e) {
        showToast('Error cargando proveedores', 'error');
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
    const next = !current;
    setSaving(cat.id);
    setSettings(prev => ({
      ...prev,
      [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: next, margen_override: prev[cat.id]?.margen_override ?? null },
    }));
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      { org_id: orgId, catalog_id: cat.id, enabled: next, margen_override: settings[cat.id]?.margen_override ?? null },
      { onConflict: 'org_id,catalog_id' },
    );
    if (error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], enabled: current } }));
      showToast(`Error al ${next ? 'activar' : 'desactivar'} ${cat.supplier_name}`, 'error');
    } else {
      showToast(`${cat.supplier_name} ${next ? 'activado ✓' : 'desactivado'}`, 'success');
    }
    setSaving(null);
  };

  const handleSaveMargen = async (cat: CatalogRow) => {
    const val = parseFloat(editMargen[cat.id] ?? '');
    if (isNaN(val) || val < 0 || val > 200) { showToast('Margen inválido (0–200%)', 'error'); return; }
    setSaving(cat.id + '_m');
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val },
      { onConflict: 'org_id,catalog_id' },
    );
    if (!error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val } }));
      showToast(`Margen de ${cat.supplier_name} → ${val}%`, 'success');
    } else {
      showToast('Error al guardar el margen', 'error');
    }
    setSaving(null);
  };

  const handleTogglePreferidoCat = async (cat: CatalogRow, categoria: string) => {
    const current: string[] = settings[cat.id]?.preferido_categorias ?? [];
    const next = current.includes(categoria)
      ? current.filter(c => c !== categoria)
      : [...current, categoria];
    setSettings(prev => ({
      ...prev,
      [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: prev[cat.id]?.margen_override ?? null, preferido_categorias: next },
    }));
    setSavingPreferido(cat.id);
    const { error } = await supabase.from('trade_org_suppliers').upsert(
      { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: settings[cat.id]?.margen_override ?? null, preferido_categorias: next },
      { onConflict: 'org_id,catalog_id' },
    );
    if (error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], preferido_categorias: current } }));
      showToast('Error al guardar preferencia', 'error');
    }
    setSavingPreferido(null);
  };

  const loadProducts = useCallback(async (catId: string, page: number, search: string) => {
    setProductsLoading(true);
    const from = page * PAGE_SIZE;
    let q = supabase
      .from('trade_supplier_products')
      .select('id, ref_proveedor, descripcion, marca, precio_coste, unidad', { count: 'exact' })
      .eq('catalog_id', catId)
      .eq('activo', true)
      .range(from, from + PAGE_SIZE - 1);
    if (search.trim()) q = q.ilike('descripcion', `%${search.trim()}%`);
    const { data, count } = await q;
    if (page === 0) setProducts((data ?? []) as ProductRow[]);
    else setProducts(prev => [...prev, ...((data ?? []) as ProductRow[])]);
    setProductTotal(count ?? 0);
    setProductsLoading(false);
  }, []);

  const handleViewProducts = (cat: CatalogRow) => {
    setProductCatalogId(cat.id);
    setProductPage(0);
    setProductSearch('');
    setProducts([]);
    setProductTotal(0);
    setShowProducts(true);
    loadProducts(cat.id, 0, '');
  };

  const handleProductSearch = (s: string) => {
    setProductSearch(s);
    setProductPage(0);
    if (productCatalogId) loadProducts(productCatalogId, 0, s);
  };

  const handleLoadMore = () => {
    const next = productPage + 1;
    setProductPage(next);
    if (productCatalogId) loadProducts(productCatalogId, next, productSearch);
  };

  const handleCreatePropio = async () => {
    setCreatingPropio(true);
    const { data, error } = await supabase
      .from('trade_supplier_catalogs')
      .insert({ org_id: orgId, supplier_key: 'propio', supplier_name: 'Mi Catálogo', is_active: true, margen_pct_default: 20, prioridad: 0, is_custom: true })
      .select('id, supplier_key, supplier_name, margen_pct_default, prioridad, is_custom, org_id')
      .single();
    if (error) {
      showToast('Error al crear el catálogo propio', 'error');
    } else {
      const newCat: CatalogRow = { ...data, productos: 0 };
      setCatalogs(prev => [newCat, ...prev]);
      setEditMargen(prev => ({ ...prev, [data.id]: '20' }));
      setSelected(newCat);
    }
    setCreatingPropio(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFile(e.target.files?.[0] ?? null);
  };

  const handleUploadCSV = async () => {
    if (!uploadFile || !selected) return;
    setUploadLoading(true);
    try {
      const text = await uploadFile.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { showToast('El archivo está vacío o sin datos', 'error'); setUploadLoading(false); return; }
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const idx = {
        codigo:        headers.indexOf('codigo'),
        descripcion:   headers.indexOf('descripcion'),
        marca:         headers.indexOf('marca'),
        precio_compra: headers.indexOf('precio_compra'),
        familia:       headers.indexOf('familia'),
        unidad:        headers.indexOf('unidad'),
      };
      if (idx.descripcion === -1 || idx.precio_compra === -1) {
        showToast('Faltan columnas obligatorias: descripcion, precio_compra', 'error');
        setUploadLoading(false);
        return;
      }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        return {
          catalog_id:    selected.id,
          ref_proveedor: idx.codigo >= 0 ? (cols[idx.codigo] || null) : null,
          descripcion:   cols[idx.descripcion] ?? '',
          marca:         idx.marca >= 0 ? (cols[idx.marca] || null) : null,
          familia:       idx.familia >= 0 ? (cols[idx.familia] || null) : null,
          precio_coste:  parseFloat(cols[idx.precio_compra]?.replace(',', '.') ?? '0') || 0,
          unidad:        idx.unidad >= 0 ? (cols[idx.unidad] || 'ud') : 'ud',
          activo:        true,
        };
      }).filter(r => r.descripcion && r.precio_coste > 0);

      if (rows.length === 0) { showToast('Sin filas válidas (descripción y precio > 0)', 'error'); setUploadLoading(false); return; }

      await supabase.from('trade_supplier_products').delete().eq('catalog_id', selected.id);

      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('trade_supplier_products').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
        inserted += Math.min(BATCH, rows.length - i);
      }

      setCatalogs(prev => prev.map(c => c.id === selected.id ? { ...c, productos: inserted } : c));
      setSelected(prev => prev ? { ...prev, productos: inserted } : prev);
      setUploadFile(null);
      setShowUpload(false);
      showToast(`${inserted} productos importados a Mi Catálogo`, 'success');
    } catch (e: unknown) {
      showToast(`Error al importar: ${(e as Error).message}`, 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header = CSV_COLUMNS.map(c => c.campo).join(',');
    const example = CSV_COLUMNS.map(c => c.ejemplo).join(',');
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_catalogo_propio.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Derived state for detail panel
  const selMeta = selected ? (SUPPLIER_META[selected.supplier_key] ?? { color: '#64748b', descripcion: selected.supplier_name, tipo: 'Otro' }) : null;
  const selEnabled = selected ? isEnabled(selected.id) : false;
  const selIsSavingToggle = selected ? saving === selected.id : false;
  const selIsSavingMargen = selected ? saving === selected.id + '_m' : false;
  const selIsPropio = selected ? (selected.supplier_key === 'propio' && !!selected.org_id) : false;
  const selPrefCats = selected ? (settings[selected.id]?.preferido_categorias ?? []) : [];
  const hasPropio = catalogs.some(c => c.supplier_key === 'propio' && !!c.org_id);

  const activeCount = Object.values(settings).filter(s => s.enabled).length;
  const totalProductos = catalogs.filter(c => settings[c.id]?.enabled).reduce((a, c) => a + c.productos, 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 px-6 text-slate-400 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando catálogos…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base">Motor de Catálogos</h2>
            <p className="text-blue-200 text-[11px]">
              Activa los proveedores con los que trabajas. La IA usará sus precios reales al generar presupuestos.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Activos', value: activeCount, color: 'text-emerald-300', Icon: ToggleRight },
            { label: 'Productos', value: totalProductos.toLocaleString('es-ES'), color: 'text-blue-200', Icon: Package },
            { label: 'Ahorro est.', value: '~12%', color: 'text-orange-300', Icon: TrendingUp },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
              <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
              <div className={`text-lg font-black leading-none ${color}`}>{value}</div>
              <div className="text-blue-300 text-[9px] mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

        {/* Left: supplier list */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
            Proveedores disponibles
          </p>

          {!hasPropio && (
            <button
              onClick={handleCreatePropio}
              disabled={creatingPropio}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {creatingPropio
                ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                : <Plus className="h-4 w-4 shrink-0" />
              }
              Crear mi catálogo propio
            </button>
          )}

          {catalogs.map(cat => {
            const meta = SUPPLIER_META[cat.supplier_key] ?? { color: '#64748b', descripcion: cat.supplier_name, tipo: 'Otro' };
            const enabled = isEnabled(cat.id);
            const isPropio = cat.supplier_key === 'propio' && !!cat.org_id;
            const prefCount = settings[cat.id]?.preferido_categorias?.length ?? 0;
            const isSelected = selected?.id === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => { setSelected(cat); setShowUpload(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black"
                  style={{ backgroundColor: meta.color + '22', border: `1.5px solid ${meta.color}55` }}
                >
                  <span style={{ color: meta.color }}>{cat.supplier_name.slice(0, 2).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 truncate">{cat.supplier_name}</span>
                    {isPropio && (
                      <span className="text-[8px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">MÍO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat.productos > 0 && (
                      <span className="text-[9px] text-slate-400">{cat.productos.toLocaleString('es-ES')} prods</span>
                    )}
                    {prefCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />{prefCount}
                      </span>
                    )}
                    {!enabled && cat.productos > 0 && (
                      <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 rounded-full">inactivo</span>
                    )}
                  </div>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggle(cat)}
                    disabled={saving === cat.id}
                    className="cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {saving === cat.id
                      ? <RefreshCw className="h-5 w-5 text-slate-400 animate-spin" />
                      : enabled
                        ? <ToggleRight className="h-6 w-6 text-emerald-500" />
                        : <ToggleLeft className="h-6 w-6 text-slate-300" />
                    }
                  </button>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: detail panel */}
        <div>
          {!selected ? (
            <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center min-h-[320px]">
              <div>
                <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">Selecciona un proveedor</p>
                <p className="text-xs text-slate-300 mt-1">para ver y editar su configuración</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

              {/* Header with brand color bar */}
              <div className="border-t-4 border-b border-slate-100 px-5 py-4" style={{ borderTopColor: selMeta!.color }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                      style={{ backgroundColor: selMeta!.color + '22', border: `2px solid ${selMeta!.color}55` }}
                    >
                      <span style={{ color: selMeta!.color }}>{selected.supplier_name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800 text-sm truncate">{selected.supplier_name}</h3>
                      <p className="text-[10px] text-slate-400">{selMeta!.tipo}{selIsPropio ? ' · Catálogo personalizado' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(selected)}
                    disabled={selIsSavingToggle}
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors disabled:opacity-50 shrink-0 ${
                      selEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {selIsSavingToggle
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : selEnabled
                        ? <ToggleRight className="h-3.5 w-3.5" />
                        : <ToggleLeft className="h-3.5 w-3.5" />
                    }
                    {selEnabled ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{selMeta!.descripcion}</p>
              </div>

              <div className="p-5 space-y-5">

                {/* Margin */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2.5">
                    Mi margen sobre precio de compra
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative">
                      <input
                        type="number"
                        min={0} max={200} step={0.5}
                        value={editMargen[selected.id] ?? ''}
                        onChange={e => setEditMargen(prev => ({ ...prev, [selected.id]: e.target.value }))}
                        className="w-24 bg-white border-2 border-slate-200 focus:border-blue-400 rounded-lg pl-3 pr-7 py-2 text-sm font-bold text-slate-800 focus:outline-none text-center"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                    </div>
                    <button
                      onClick={() => handleSaveMargen(selected)}
                      disabled={selIsSavingMargen}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {selIsSavingMargen ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                      Guardar
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Coste 100€ → <strong className="text-slate-700">
                        {(100 * (1 + (parseFloat(editMargen[selected.id] ?? '0') || 0) / 100)).toFixed(0)}€
                      </strong> venta
                    </span>
                  </div>
                  {settings[selected.id]?.margen_override != null && (
                    <p className="text-[9px] text-blue-500 mt-1.5">
                      Margen personalizado activo · global por defecto: {selected.margen_pct_default}%
                    </p>
                  )}
                </div>

                {/* Preferido categories */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                        Proveedor preferido para
                      </p>
                      {savingPreferido === selected.id && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                    </div>
                    {selPrefCats.length > 0 && (
                      <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                        {selPrefCats.length} activas
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2.5">
                    La IA priorizará este proveedor en las categorías marcadas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TRADE_CATEGORIAS.map(tc => {
                      const active = selPrefCats.includes(tc);
                      return (
                        <button
                          key={tc}
                          onClick={() => handleTogglePreferidoCat(selected, tc)}
                          disabled={savingPreferido === selected.id}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" />}
                          {tc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Products */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                        Productos en catálogo
                      </p>
                    </div>
                    {selected.productos > 0 && (
                      <button
                        onClick={() => handleViewProducts(selected)}
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        Ver {selected.productos.toLocaleString('es-ES')}
                      </button>
                    )}
                  </div>

                  {selected.productos > 0 ? (
                    <div
                      className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity border"
                      style={{ backgroundColor: selMeta!.color + '10', borderColor: selMeta!.color + '30' }}
                      onClick={() => handleViewProducts(selected)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: selMeta!.color + '22' }}>
                          <Package className="w-4 h-4" style={{ color: selMeta!.color }} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{selected.productos.toLocaleString('es-ES')} referencias</p>
                          <p className="text-[9px] text-slate-400">Precios de coste · con tu margen aplicado</p>
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-slate-400" />
                    </div>
                  ) : (
                    !selIsPropio && (
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400">Catálogo en proceso de integración. Pronto disponible.</p>
                      </div>
                    )
                  )}
                </div>

                {/* CSV upload — solo catálogo propio */}
                {selIsPropio && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                          Subir mis precios (CSV)
                        </p>
                      </div>
                      <button
                        onClick={() => setShowUpload(v => !v)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                          showUpload
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {showUpload ? 'Cancelar' : 'Subir CSV'}
                      </button>
                    </div>

                    {!showUpload && (
                      <p className="text-[10px] text-slate-400">
                        Sube tu lista de precios en formato CSV. La IA los priorizará al buscar materiales.
                      </p>
                    )}

                    {showUpload && (
                      <div className="space-y-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Columnas CSV</p>
                            <button
                              onClick={handleDownloadTemplate}
                              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 cursor-pointer font-semibold"
                            >
                              <Download className="h-3 w-3" /> Plantilla
                            </button>
                          </div>
                          <div className="space-y-0.5">
                            {CSV_COLUMNS.map(col => (
                              <div key={col.campo} className="flex items-center gap-2 text-[9px]">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.req ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                <code className="text-slate-600 font-mono w-24">{col.campo}</code>
                                {col.req && <span className="text-blue-400">obligatorio</span>}
                                <span className="text-slate-400 ml-auto font-mono">{col.ejemplo}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          onClick={() => fileRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl py-5 text-center cursor-pointer transition-colors ${
                            uploadFile ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                          }`}
                        >
                          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                          {uploadFile ? (
                            <div>
                              <FileSpreadsheet className="h-7 w-7 text-blue-500 mx-auto mb-1.5" />
                              <p className="text-xs font-bold text-blue-700">{uploadFile.name}</p>
                              <p className="text-[10px] text-slate-400">{(uploadFile.size / 1024).toFixed(1)} KB · Listo para importar</p>
                            </div>
                          ) : (
                            <div>
                              <Upload className="h-7 w-7 text-slate-400 mx-auto mb-1.5" />
                              <p className="text-xs text-slate-500">Click para seleccionar CSV</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">separado por coma o punto y coma</p>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleUploadCSV}
                          disabled={!uploadFile || uploadLoading}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                        >
                          {uploadLoading
                            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importando…</>
                            : <><Upload className="h-3.5 w-3.5" /> Importar productos</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {catalogs.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold">No hay catálogos disponibles todavía</p>
          <p className="text-xs mt-1">El equipo de TrabFlow está negociando acuerdos con los principales distribuidores</p>
        </div>
      )}

      {/* Products modal */}
      {showProducts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">
                  {catalogs.find(c => c.id === productCatalogId)?.supplier_name ?? 'Catálogo'}
                </h3>
                <p className="text-xs text-slate-400">
                  {productTotal.toLocaleString('es-ES')} productos · precios de coste con tu margen
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar…"
                    value={productSearch}
                    onChange={e => handleProductSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
                  />
                </div>
                <button
                  onClick={() => setShowProducts(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Ref.', 'Descripción', 'Marca', 'P. Coste', 'P. Venta', 'Ud.'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsLoading && products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" />Cargando…
                      </td>
                    </tr>
                  ) : products.map(p => {
                    const cat = catalogs.find(c => c.id === productCatalogId);
                    const margen = settings[cat?.id ?? '']?.margen_override ?? cat?.margen_pct_default ?? 20;
                    const pvp = p.precio_coste * (1 + margen / 100);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-[10px] text-blue-500">{p.ref_proveedor ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-800 max-w-[200px]">
                          <span className="line-clamp-2 leading-snug">{p.descripcion}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{p.marca ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{p.precio_coste.toFixed(2)} €</td>
                        <td className="px-3 py-2 font-mono font-semibold text-emerald-600">{pvp.toFixed(2)} €</td>
                        <td className="px-3 py-2 text-slate-400">{p.unidad}</td>
                      </tr>
                    );
                  })}
                  {!productsLoading && products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                        {productSearch ? 'Sin resultados para esa búsqueda' : 'No hay productos en este catálogo'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {products.length < productTotal && (
                <div className="p-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={productsLoading}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {productsLoading ? 'Cargando…' : `Cargar más (${productTotal - products.length} restantes)`}
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 text-[10px] text-slate-400">
              P. Venta = coste × (1 + {settings[productCatalogId ?? '']?.margen_override ?? catalogs.find(c => c.id === productCatalogId)?.margen_pct_default ?? 20}% margen)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
