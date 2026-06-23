import { useState, useEffect } from 'react';
import { Truck, Package, TrendingUp, Search, ChevronDown, ToggleLeft, ToggleRight, RefreshCw, Eye, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  preferido_categorias?: string[] | null;
}

const TRADE_CATEGORIAS = [
  'Fontanería', 'Electricidad', 'Climatización', 'Gas y calefacción',
  'Carpintería', 'Pintura', 'Albañilería', 'Reformas baño',
  'Reformas cocina', 'Reforma integral', 'Telecomunicaciones', 'Solar / fotovoltaica',
  'Mudanzas', 'Reformas interiores',
];

interface ProductRow {
  id: string;
  ref_proveedor: string | null;
  descripcion: string;
  marca: string | null;
  precio_coste: number;
  unidad: string;
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

const PAGE_SIZE = 50;

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ScreenProveedoresCliente({ orgId, showToast }: Props) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [settings, setSettings] = useState<Record<string, OrgSetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editMargen, setEditMargen] = useState<Record<string, string>>({});
  const [savingPreferido, setSavingPreferido] = useState<string | null>(null);

  // Modal de productos
  const [showProducts, setShowProducts] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [productCatalogId, setProductCatalogId] = useState<string | null>(null);
  const [productCatalogName, setProductCatalogName] = useState('');

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

        const rows: CatalogRow[] = (catRes.data ?? []).map((c: {
          id: string; supplier_key: string; supplier_name: string;
          margen_pct_default: number; prioridad: number;
        }) => ({ ...c, productos: countMap.get(c.id) ?? 0 }));
        setCatalogs(rows);

        const sMap: Record<string, OrgSetting> = {};
        for (const s of (settRes.data ?? []) as OrgSetting[]) {
          sMap[s.catalog_id] = s;
        }
        setSettings(sMap);

        const margenes: Record<string, string> = {};
        for (const c of rows) {
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
    const newEnabled = !current;
    setSaving(cat.id);
    setSettings(prev => ({
      ...prev,
      [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: newEnabled, margen_override: prev[cat.id]?.margen_override ?? null },
    }));
    const { error } = await supabase
      .from('trade_org_suppliers')
      .upsert(
        { org_id: orgId, catalog_id: cat.id, enabled: newEnabled, margen_override: settings[cat.id]?.margen_override ?? null },
        { onConflict: 'org_id,catalog_id' },
      );
    if (error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], enabled: current } }));
      showToast(`Error al ${newEnabled ? 'activar' : 'desactivar'} ${cat.supplier_name}`, 'error');
    } else {
      showToast(`${cat.supplier_name} ${newEnabled ? 'activado ✓' : 'desactivado'}`, 'success');
    }
    setSaving(null);
  };

  const handleSaveMargen = async (cat: CatalogRow) => {
    const val = parseFloat(editMargen[cat.id] ?? '');
    if (isNaN(val) || val < 0 || val > 200) { showToast('Margen inválido (0–200%)', 'error'); return; }
    setSaving(cat.id + '_m');
    const { error } = await supabase
      .from('trade_org_suppliers')
      .upsert(
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
    const { error } = await supabase
      .from('trade_org_suppliers')
      .upsert(
        { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: settings[cat.id]?.margen_override ?? null, preferido_categorias: next },
        { onConflict: 'org_id,catalog_id' },
      );
    if (error) {
      setSettings(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], preferido_categorias: current } }));
      showToast('Error al guardar preferencia', 'error');
    }
    setSavingPreferido(null);
  };

  const loadProducts = async (catId: string, page: number, search: string) => {
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
    if (page === 0) {
      setProducts((data ?? []) as ProductRow[]);
    } else {
      setProducts(prev => [...prev, ...((data ?? []) as ProductRow[])]);
    }
    setProductTotal(count ?? 0);
    setProductsLoading(false);
  };

  const handleViewProducts = (cat: CatalogRow) => {
    setProductCatalogId(cat.id);
    setProductCatalogName(cat.supplier_name);
    setProductPage(0);
    setProductSearch('');
    setProducts([]);
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

  // KPIs
  const activeCount = Object.values(settings).filter(s => s.enabled).length;
  const totalProductos = catalogs
    .filter(c => settings[c.id]?.enabled)
    .reduce((a, c) => a + c.productos, 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 px-6 text-slate-400 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando catálogos…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Hero + KPIs */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/5 border border-orange-200 rounded-2xl p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-base">Motor de Catálogos</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Activa los proveedores con los que trabajas. La IA usará sus precios reales al generar tus presupuestos.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Activos', value: activeCount, Icon: ToggleRight, color: 'text-emerald-600' },
            { label: 'Productos', value: totalProductos.toLocaleString('es-ES'), Icon: Package, color: 'text-blue-600' },
            { label: 'Ahorro estimado', value: '12%', Icon: TrendingUp, color: 'text-orange-600' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-white/80 rounded-xl p-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <div className="font-black text-slate-800 text-lg leading-none">{value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de catálogos */}
      <div className="space-y-2">
        {catalogs.map(cat => {
          const meta = SUPPLIER_META[cat.supplier_key];
          const enabled = isEnabled(cat.id);
          const isOpen = expanded === cat.id;
          const isSavingToggle = saving === cat.id;
          const isSavingMargen = saving === cat.id + '_m';
          const margenActual = settings[cat.id]?.margen_override ?? cat.margen_pct_default;

          return (
            <div
              key={cat.id}
              className={`rounded-xl border transition-all ${enabled ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ backgroundColor: (meta?.color ?? '#64748b') + '20', border: `1.5px solid ${meta?.color ?? '#64748b'}30` }}
                >
                  <span style={{ color: meta?.color ?? '#64748b' }}>
                    {cat.supplier_name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{cat.supplier_name}</span>
                    {cat.productos > 0 && (
                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {cat.productos.toLocaleString('es-ES')} prods
                      </span>
                    )}
                    {(settings[cat.id]?.preferido_categorias?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] bg-amber-50 border border-amber-200 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        Preferido · {settings[cat.id]!.preferido_categorias!.length} categ.
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{meta?.descripcion ?? ''}</p>
                </div>

                {/* Margen */}
                <span className="text-[10px] text-slate-500 shrink-0 hidden md:block">
                  Margen: <strong className="text-slate-700">{margenActual}%</strong>
                </span>

                {/* Ver productos */}
                {cat.productos > 0 && (
                  <button
                    onClick={() => handleViewProducts(cat)}
                    className="hidden sm:flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer shrink-0"
                  >
                    <Eye className="w-3 h-3" /> Ver
                  </button>
                )}

                {/* Expand */}
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(cat)}
                  disabled={isSavingToggle}
                  className="cursor-pointer shrink-0 disabled:opacity-50"
                  title={enabled ? 'Desactivar' : 'Activar para mis presupuestos'}
                >
                  {isSavingToggle
                    ? <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                    : enabled
                      ? <ToggleRight className="h-7 w-7 text-emerald-500" />
                      : <ToggleLeft className="h-7 w-7 text-slate-300" />
                  }
                </button>
              </div>

              {/* Panel expandible — margen + preferido */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">

                  {/* Margen */}
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                      Mi margen sobre precio de compra (%)
                    </p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="number"
                        min={0} max={200} step={0.5}
                        value={editMargen[cat.id] ?? ''}
                        onChange={e => setEditMargen(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => handleSaveMargen(cat)}
                        disabled={isSavingMargen}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSavingMargen ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                        Guardar
                      </button>
                      <span className="text-[10px] text-slate-400">
                        Coste 100€ → venta{' '}
                        <strong className="text-slate-600">
                          {(100 * (1 + (parseFloat(editMargen[cat.id] ?? '0') || 0) / 100)).toFixed(2)}€
                        </strong>
                      </span>
                    </div>
                    {settings[cat.id]?.margen_override != null && (
                      <p className="text-[9px] text-blue-500 mt-1">
                        Margen personalizado activo (global por defecto: {cat.margen_pct_default}%)
                      </p>
                    )}
                  </div>

                  {/* Preferido para categorías */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Proveedor preferido para
                      </p>
                      {savingPreferido === cat.id && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mb-2">
                      La IA priorizará este proveedor al buscar productos en estas categorías de trabajo
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TRADE_CATEGORIAS.map(tc => {
                        const active = (settings[cat.id]?.preferido_categorias ?? []).includes(tc);
                        return (
                          <button
                            key={tc}
                            onClick={() => handleTogglePreferidoCat(cat, tc)}
                            disabled={savingPreferido === cat.id}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                              active
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {active && <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />}
                            {tc}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {cat.productos > 0 && (
                    <button
                      onClick={() => handleViewProducts(cat)}
                      className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver {cat.productos.toLocaleString('es-ES')} productos del catálogo
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {catalogs.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Package className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No hay catálogos disponibles todavía</p>
          <p className="text-xs mt-1">El equipo de TrabFlow está negociando acuerdos con los principales distribuidores</p>
        </div>
      )}

      {/* Modal productos */}
      {showProducts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">{productCatalogName}</h3>
                <p className="text-xs text-slate-400">{productTotal} productos</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar…"
                    value={productSearch}
                    onChange={e => handleProductSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 w-48"
                  />
                </div>
                <button onClick={() => setShowProducts(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">✕</button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Ref.', 'Descripción', 'Marca', 'Precio coste', 'Unidad'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsLoading && products.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" />Cargando…
                    </td></tr>
                  ) : products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-500">{p.ref_proveedor ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-800 max-w-xs truncate">{p.descripcion}</td>
                      <td className="px-4 py-2 text-slate-500">{p.marca ?? '—'}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{p.precio_coste.toFixed(2)} €</td>
                      <td className="px-4 py-2 text-slate-500">{p.unidad}</td>
                    </tr>
                  ))}
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
              Precios de coste del proveedor — tu margen configurado se aplica al generar presupuestos
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
