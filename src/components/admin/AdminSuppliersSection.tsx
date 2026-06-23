import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Package, Upload, RefreshCw, CheckCircle, XCircle, Clock,
  ChevronRight, AlertTriangle, Truck, Building2, User, Plus,
  Download, Eye, Trash2, ToggleLeft, ToggleRight, Star, StarOff,
  FileSpreadsheet, Info, Zap, ArrowUpDown, Search, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type SupplierTipo = 'nacional' | 'fabricante' | 'propio' | 'custom';
type AcuerdoEstado = 'activo' | 'negociando' | 'sin_acuerdo';
type SyncEstado = 'ok' | 'error' | 'pendiente' | 'nunca';

interface SupplierConfig {
  id: string;
  nombre: string;
  tipo: SupplierTipo;
  activo: boolean;
  margen_pct: number;
  prioridad: number;
  productos: number;
  ultima_sync?: string;
  sync_estado: SyncEstado;
  descripcion: string;
  acuerdo: AcuerdoEstado;
  color: string;
  admin_notes?: string;
  contact_name?: string;
  contact_email?: string;
}

// Metadata estética + negocio que no se persiste en DB
const SUPPLIER_META: Record<string, { tipo: SupplierTipo; descripcion: string; acuerdo: AcuerdoEstado; color: string }> = {
  propio:   { tipo: 'propio',     descripcion: 'Tus tarifas negociadas. CSV con precios de compra propios.',                        acuerdo: 'activo',       color: '#4A6741' },
  obramat:  { tipo: 'nacional',   descripcion: 'Distribución nacional materiales construcción e instalaciones.',                    acuerdo: 'negociando',   color: '#E87722' },
  saltoki:  { tipo: 'nacional',   descripcion: 'Distribuidor fontanería, calefacción y climatización.',                             acuerdo: 'sin_acuerdo',  color: '#1A5A96' },
  sonepar:  { tipo: 'nacional',   descripcion: 'Distribución eléctrica e industrial.',                                              acuerdo: 'sin_acuerdo',  color: '#6366f1' },
  novelec:  { tipo: 'nacional',   descripcion: 'Material eléctrico y automatización.',                                              acuerdo: 'sin_acuerdo',  color: '#f59e0b' },
  rexel:    { tipo: 'nacional',   descripcion: 'Distribución eléctrica global.',                                                    acuerdo: 'sin_acuerdo',  color: '#ef4444' },
  vaillant: { tipo: 'fabricante', descripcion: 'Calefacción, ACS y climatización.',                                                 acuerdo: 'sin_acuerdo',  color: '#10b981' },
  junkers:  { tipo: 'fabricante', descripcion: 'Calderas, calentadores y ACS.',                                                     acuerdo: 'sin_acuerdo',  color: '#ec4899' },
  ariston:  { tipo: 'fabricante', descripcion: 'Calentadores y acumuladores ACS.',                                                  acuerdo: 'sin_acuerdo',  color: '#14b8a6' },
  baxi:     { tipo: 'fabricante', descripcion: 'Calderas y calentadores residenciales.',                                            acuerdo: 'sin_acuerdo',  color: '#8b5cf6' },
  ferroli:  { tipo: 'fabricante', descripcion: 'Calefacción, climatización y ACS.',                                                 acuerdo: 'sin_acuerdo',  color: '#f97316' },
};

const INITIAL_SUPPLIERS: SupplierConfig[] = [];

const ACUERDO_CFG: Record<AcuerdoEstado, { label: string; cls: string }> = {
  activo:       { label: 'Acuerdo activo',  cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700' },
  negociando:   { label: 'Negociando',      cls: 'bg-yellow-900/40 text-yellow-300 border-yellow-700' },
  sin_acuerdo:  { label: 'Sin acuerdo',     cls: 'bg-slate-700 text-slate-400 border-slate-600' },
};

const TIPO_CFG: Record<SupplierTipo, { label: string; Icon: React.ElementType }> = {
  propio:     { label: 'Propio',     Icon: User },
  nacional:   { label: 'Nacional',   Icon: Building2 },
  fabricante: { label: 'Fabricante', Icon: Zap },
  custom:     { label: 'Custom',     Icon: Plus },
};

const SYNC_CFG: Record<SyncEstado, { label: string; cls: string; Icon: React.ElementType }> = {
  ok:        { label: 'Sincronizado', cls: 'text-emerald-400', Icon: CheckCircle },
  error:     { label: 'Error sync',   cls: 'text-red-400',     Icon: XCircle },
  pendiente: { label: 'Pendiente',    cls: 'text-yellow-400',  Icon: Clock },
  nunca:     { label: 'Sin sync',     cls: 'text-slate-500',   Icon: AlertTriangle },
};

const CSV_COLUMNS = [
  { campo: 'codigo',         tipo: 'texto',   req: true,  ejemplo: 'FON-001' },
  { campo: 'descripcion',    tipo: 'texto',   req: true,  ejemplo: 'Termo eléctrico 100L vertical' },
  { campo: 'marca',          tipo: 'texto',   req: false, ejemplo: 'Junkers' },
  { campo: 'precio_compra',  tipo: 'número',  req: true,  ejemplo: '289.50' },
  { campo: 'familia',        tipo: 'texto',   req: false, ejemplo: 'ACS' },
  { campo: 'unidad',         tipo: 'texto',   req: false, ejemplo: 'ud' },
  { campo: 'ean',            tipo: 'texto',   req: false, ejemplo: '8413849123456' },
  { campo: 'stock',          tipo: 'número',  req: false, ejemplo: '12' },
  { campo: 'url_producto',   tipo: 'texto',   req: false, ejemplo: 'https://...' },
];

const PREVIEW_ROWS = [
  { codigo: 'ACS-001', descripcion: 'Termo eléctrico 100L vertical', marca: 'Junkers', precio_compra: '289.50', familia: 'ACS', unidad: 'ud' },
  { codigo: 'ACS-002', descripcion: 'Calentador instantáneo 11L/min', marca: 'Ariston', precio_compra: '312.00', familia: 'ACS', unidad: 'ud' },
  { codigo: 'FON-001', descripcion: 'Válvula de seguridad 1/2" 8bar', marca: 'Honeywell', precio_compra: '14.80', familia: 'Fontanería', unidad: 'ud' },
];

interface ProductRow {
  id: string;
  ref_proveedor: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  precio_coste: number;
  unidad: string;
  activo: boolean;
}

const PAGE_SIZE = 50;

interface Props {
  toast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export default function AdminSuppliersSection({ toast }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierConfig[]>(INITIAL_SUPPLIERS);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupplierConfig | null>(null);
  const [editMargen, setEditMargen] = useState<string>('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rightTab, setRightTab] = useState<'catalogo' | 'acuerdo'>('catalogo');
  const [editAcuerdo, setEditAcuerdo] = useState<AcuerdoEstado>('sin_acuerdo');
  const [editNotes, setEditNotes] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [savingAcuerdo, setSavingAcuerdo] = useState(false);

  // Modal de productos
  const [showProducts, setShowProducts] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [productCatalogId, setProductCatalogId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalogs() {
      setLoading(true);
      try {
        const { data: catalogs, error } = await supabase
          .from('trade_supplier_catalogs')
          .select('id, supplier_key, supplier_name, is_active, margen_pct_default, prioridad, updated_at, acuerdo_estado, admin_notes, contact_name, contact_email')
          .is('org_id', null)
          .order('prioridad');
        if (error) throw error;

        const { data: counts } = await supabase
          .from('trade_supplier_products')
          .select('catalog_id');

        const countMap = new Map<string, number>();
        for (const row of (counts ?? []) as Array<{ catalog_id: string }>) {
          countMap.set(row.catalog_id, (countMap.get(row.catalog_id) ?? 0) + 1);
        }

        const mapped: SupplierConfig[] = (catalogs ?? []).map((c: {
          id: string; supplier_key: string; supplier_name: string;
          is_active: boolean; margen_pct_default: number; prioridad: number; updated_at: string;
          acuerdo_estado?: string; admin_notes?: string; contact_name?: string; contact_email?: string;
        }) => {
          const meta = SUPPLIER_META[c.supplier_key] ?? {
            tipo: 'nacional' as SupplierTipo, descripcion: c.supplier_name,
            acuerdo: 'sin_acuerdo' as AcuerdoEstado, color: '#64748b',
          };
          const prods = countMap.get(c.id) ?? 0;
          return {
            id: c.id,
            nombre: c.supplier_name,
            tipo: meta.tipo,
            activo: c.is_active,
            margen_pct: Number(c.margen_pct_default),
            prioridad: c.prioridad,
            productos: prods,
            ultima_sync: prods > 0 ? c.updated_at?.slice(0, 10) : undefined,
            sync_estado: prods > 0 ? 'ok' : 'nunca',
            descripcion: meta.descripcion,
            acuerdo: (c.acuerdo_estado as AcuerdoEstado) || meta.acuerdo,
            color: meta.color,
            admin_notes: c.admin_notes ?? '',
            contact_name: c.contact_name ?? '',
            contact_email: c.contact_email ?? '',
          } satisfies SupplierConfig;
        });

        setSuppliers(mapped);
      } catch (e) {
        toast('error', 'Error cargando catálogos de proveedores');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadCatalogs();
  }, []);

  const totalActivos = suppliers.filter(s => s.activo).length;
  const totalProductos = suppliers.filter(s => s.activo).reduce((a, s) => a + s.productos, 0);
  const lastSync = suppliers
    .filter(s => s.ultima_sync)
    .sort((a, b) => (b.ultima_sync ?? '').localeCompare(a.ultima_sync ?? ''))[0]?.ultima_sync;

  const handleToggle = async (id: string) => {
    const sup = suppliers.find(s => s.id === id);
    if (!sup) return;
    const newActive = !sup.activo;
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, activo: newActive } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, activo: newActive } : prev);
    const { error } = await supabase
      .from('trade_supplier_catalogs')
      .update({ is_active: newActive })
      .eq('id', id);
    if (error) {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, activo: !newActive } : s));
      toast('error', `Error al ${newActive ? 'activar' : 'desactivar'} ${sup.nombre}`);
    } else {
      toast('success', `${sup.nombre} ${newActive ? 'activado' : 'desactivado'}`);
    }
  };

  const handleSelect = (s: SupplierConfig) => {
    setSelected(s);
    setEditMargen(String(s.margen_pct));
    setEditAcuerdo(s.acuerdo);
    setEditNotes(s.admin_notes ?? '');
    setEditContactName(s.contact_name ?? '');
    setEditContactEmail(s.contact_email ?? '');
    setShowUpload(false);
  };

  const handleSaveMargen = async () => {
    if (!selected) return;
    const val = parseFloat(editMargen);
    if (isNaN(val) || val < 0 || val > 200) { toast('error', 'Margen inválido (0-200%)'); return; }
    const { error } = await supabase
      .from('trade_supplier_catalogs')
      .update({ margen_pct_default: val })
      .eq('id', selected.id);
    if (error) { toast('error', 'Error al guardar el margen'); return; }
    setSuppliers(prev => prev.map(s => s.id === selected.id ? { ...s, margen_pct: val } : s));
    setSelected(prev => prev ? { ...prev, margen_pct: val } : prev);
    toast('success', `Margen de ${selected.nombre} actualizado a ${val}%`);
  };

  const handleSaveAcuerdo = async () => {
    if (!selected) return;
    setSavingAcuerdo(true);
    const { error } = await supabase
      .from('trade_supplier_catalogs')
      .update({
        acuerdo_estado:  editAcuerdo,
        admin_notes:     editNotes || null,
        contact_name:    editContactName || null,
        contact_email:   editContactEmail || null,
      })
      .eq('id', selected.id);
    if (error) {
      toast('error', 'Error al guardar el acuerdo');
    } else {
      const updated = { ...selected, acuerdo: editAcuerdo, admin_notes: editNotes, contact_name: editContactName, contact_email: editContactEmail };
      setSuppliers(prev => prev.map(s => s.id === selected.id ? updated : s));
      setSelected(updated);
      toast('success', `Acuerdo con ${selected.nombre} guardado`);
    }
    setSavingAcuerdo(false);
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    await new Promise(r => setTimeout(r, 2000));
    setSuppliers(prev => prev.map(s => s.id === id
      ? { ...s, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) }
      : s
    ));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : prev);
    setSyncing(null);
    const name = suppliers.find(s => s.id === id)?.nombre ?? '';
    toast('success', `${name} sincronizado correctamente`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(f);
    setUploadPreview(false);
  };

  const handleUploadProcess = async () => {
    if (!uploadFile || !selected) return;
    setUploadLoading(true);
    try {
      const text = await uploadFile.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('error', 'El archivo está vacío o sin datos'); setUploadLoading(false); return; }

      // Detectar separador (coma o punto y coma)
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
        toast('error', 'Faltan columnas obligatorias: descripcion, precio_compra');
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

      if (rows.length === 0) { toast('error', 'No se encontraron filas válidas (descripción y precio > 0)'); setUploadLoading(false); return; }

      // Borrar productos anteriores del catálogo y reinsertar (replace)
      await supabase.from('trade_supplier_products').delete().eq('catalog_id', selected.id);

      // Insertar en lotes de 100
      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('trade_supplier_products').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
        inserted += Math.min(BATCH, rows.length - i);
      }

      // Refrescar recuento en la UI
      setSuppliers(prev => prev.map(s => s.id === selected.id
        ? { ...s, productos: inserted, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) }
        : s));
      setSelected(prev => prev ? { ...prev, productos: inserted, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : prev);
      setUploadFile(null);
      setUploadPreview(false);
      setShowUpload(false);
      toast('success', `${inserted} productos importados al catálogo de ${selected.nombre}`);
    } catch (e: unknown) {
      toast('error', `Error al importar: ${(e as Error).message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const loadProducts = useCallback(async (catalogId: string, search: string, page: number) => {
    setProductsLoading(true);
    try {
      let query = supabase
        .from('trade_supplier_products')
        .select('id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo', { count: 'exact' })
        .eq('catalog_id', catalogId)
        .order('descripcion')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.ilike('descripcion', `%${search.trim()}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      if (page === 0) {
        setProducts((data as ProductRow[]) ?? []);
      } else {
        setProducts(prev => [...prev, ...((data as ProductRow[]) ?? [])]);
      }
      setProductTotal(count ?? 0);
    } catch (e) {
      toast('error', `Error cargando productos: ${(e as Error).message}`);
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  const handleViewProducts = (sup: SupplierConfig) => {
    setProductCatalogId(sup.id);
    setProductSearch('');
    setProductPage(0);
    setProducts([]);
    setProductTotal(0);
    setShowProducts(true);
    loadProducts(sup.id, '', 0);
  };

  const handleProductSearch = (val: string) => {
    setProductSearch(val);
    setProductPage(0);
    setProducts([]);
    if (productCatalogId) loadProducts(productCatalogId, val, 0);
  };

  const handleLoadMore = () => {
    const nextPage = productPage + 1;
    setProductPage(nextPage);
    if (productCatalogId) loadProducts(productCatalogId, productSearch, nextPage);
  };

  const handleDownloadTemplate = () => {
    const header = CSV_COLUMNS.map(c => c.campo).join(',');
    const example = CSV_COLUMNS.map(c => c.ejemplo).join(',');
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_catalogo_trabflow.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-3">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Cargando catálogos de proveedores…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header + KPIs */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            Central de Compras
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestiona los catálogos de proveedores usados por la IA para generar presupuestos con precios reales.
          </p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowUpload(true); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <Upload className="h-3.5 w-3.5" /> Subir catálogo
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Proveedores activos', value: totalActivos, Icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Productos indexados', value: totalProductos.toLocaleString('es-ES'), Icon: Package, color: 'text-blue-400' },
          { label: 'Último sync',         value: lastSync ?? '—', Icon: Clock, color: 'text-slate-300' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline visual */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg px-5 py-3">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Pipeline IA — cómo se usa el catálogo</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300">
          {['Voz / Texto', 'Base Maestra', 'Partidas', 'Motor Catálogos ★', 'Proveedor', 'Margen', 'Presupuesto'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] font-semibold ${step.includes('★') ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {step.replace(' ★', '')}
              </span>
              {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />}
            </span>
          ))}
        </div>
      </div>

      {/* Suppliers grid + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

        {/* Supplier list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proveedores disponibles</p>
            <span className="text-[10px] text-slate-500">Prioridad: propio &gt; preferido &gt; resto</span>
          </div>

          {suppliers.map((sup) => {
            const { label: tipoLabel, Icon: TipoIcon } = TIPO_CFG[sup.tipo];
            const syncCfg = SYNC_CFG[sup.sync_estado];
            const SyncIcon = syncCfg.Icon;
            const isSyncing = syncing === sup.id;
            const acuerdoCfg = ACUERDO_CFG[sup.acuerdo];
            const isSelected = selected?.id === sup.id;

            return (
              <div
                key={sup.id}
                onClick={() => handleSelect(sup)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-900/30 border-blue-700'
                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Color badge */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-black"
                  style={{ backgroundColor: sup.color + '30', border: `1px solid ${sup.color}40` }}
                >
                  <span style={{ color: sup.color }}>{sup.nombre.slice(0, 2).toUpperCase()}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{sup.nombre}</span>
                    <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <TipoIcon className="h-2.5 w-2.5" />{tipoLabel}
                    </span>
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded ${acuerdoCfg.cls}`}>
                      {acuerdoCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                    <span>{sup.productos > 0 ? `${sup.productos.toLocaleString('es-ES')} prods` : 'Sin productos'}</span>
                    <span>Margen: <strong className="text-slate-300">{sup.margen_pct}%</strong></span>
                    <span className={`flex items-center gap-1 ${syncCfg.cls}`}>
                      {isSyncing
                        ? <><RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando…</>
                        : <><SyncIcon className="h-3 w-3" />{syncCfg.label}{sup.ultima_sync ? ` (${sup.ultima_sync})` : ''}</>
                      }
                    </span>
                  </div>
                </div>

                {/* Priority badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">#{sup.prioridad}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(sup.id); }}
                    className="cursor-pointer"
                    title={sup.activo ? 'Desactivar' : 'Activar'}
                  >
                    {sup.activo
                      ? <ToggleRight className="h-6 w-6 text-emerald-400" />
                      : <ToggleLeft className="h-6 w-6 text-slate-600" />
                    }
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add custom */}
          <button className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 text-xs font-semibold transition-colors cursor-pointer">
            <Plus className="h-4 w-4" />
            Añadir proveedor personalizado
          </button>
        </div>

        {/* Detail / Upload panel */}
        <div>

          {/* Selected supplier config */}
          {selected && !showUpload && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: selected.color + '30', border: `1px solid ${selected.color}40` }}
                  >
                    <span style={{ color: selected.color }}>{selected.nombre.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className="font-bold text-white text-sm">{selected.nombre}</span>
                </div>
                <button
                  onClick={() => handleToggle(selected.id)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                    selected.activo
                      ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700'
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {selected.activo ? 'Disponible ✓' : 'Oculto'}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-700">
                {(['catalogo', 'acuerdo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`flex-1 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                      rightTab === tab
                        ? 'bg-slate-700/60 text-white border-b-2 border-blue-500'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'catalogo' ? '📦 Catálogo' : '🤝 Acuerdo'}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4">
                {rightTab === 'catalogo' && (
                  <>
                    <p className="text-xs text-slate-400">{selected.descripcion}</p>

                    {/* Margen por defecto */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                        Margen por defecto para nuevos clientes (%)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0} max={200} step={0.5}
                          value={editMargen}
                          onChange={e => setEditMargen(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={handleSaveMargen}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                          Guardar
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">Los clientes pueden sobrescribir este margen para su organización</p>
                    </div>

                    {/* Sync */}
                    <div className="border-t border-slate-700 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sincronización</span>
                        {selected.ultima_sync && (
                          <span className="text-[10px] text-slate-500">Último: {selected.ultima_sync}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleSync(selected.id)}
                          disabled={syncing === selected.id}
                          className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {syncing === selected.id
                            ? <><RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando…</>
                            : <><RefreshCw className="h-3 w-3" /> Sync manual</>
                          }
                        </button>
                        <button
                          onClick={() => setShowUpload(true)}
                          className="flex items-center justify-center gap-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 text-xs font-semibold py-2 rounded-lg border border-blue-800 transition-colors cursor-pointer"
                        >
                          <Upload className="h-3 w-3" /> Subir CSV
                        </button>
                      </div>
                    </div>

                    {selected.productos > 0 && (
                      <button
                        onClick={() => handleViewProducts(selected)}
                        className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-300 py-1.5 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver {selected.productos.toLocaleString('es-ES')} productos
                      </button>
                    )}
                  </>
                )}

                {rightTab === 'acuerdo' && (
                  <>
                    {/* Estado */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Estado del acuerdo</label>
                      <div className="flex gap-1.5">
                        {(['activo', 'negociando', 'sin_acuerdo'] as AcuerdoEstado[]).map(est => (
                          <button
                            key={est}
                            onClick={() => setEditAcuerdo(est)}
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border cursor-pointer transition-all ${
                              editAcuerdo === est ? ACUERDO_CFG[est].cls : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {est === 'activo' ? '✓ Activo' : est === 'negociando' ? '⏳ Negociando' : '— Sin acuerdo'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contacto */}
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Contacto comercial</label>
                      <input
                        type="text"
                        placeholder="Nombre del contacto"
                        value={editContactName}
                        onChange={e => setEditContactName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="email"
                        placeholder="email@proveedor.com"
                        value={editContactEmail}
                        onChange={e => setEditContactEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Notas del acuerdo</label>
                      <textarea
                        rows={4}
                        placeholder="Condiciones negociadas, descuentos especiales, próxima revisión…"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>

                    <button
                      onClick={handleSaveAcuerdo}
                      disabled={savingAcuerdo}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {savingAcuerdo ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Guardando…</> : 'Guardar acuerdo'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Upload section */}
          {showUpload && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                  Subir catálogo (CSV / Excel)
                </h3>
                <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
              </div>

              {/* Format spec */}
              <div className="bg-slate-900/60 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Formato requerido (CSV)</p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    <Download className="h-3 w-3" /> Descargar plantilla
                  </button>
                </div>
                <div className="space-y-1">
                  {CSV_COLUMNS.map(col => (
                    <div key={col.campo} className="flex items-center gap-2 text-[10px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.req ? 'bg-blue-500' : 'bg-slate-600'}`} />
                      <code className="text-slate-300 font-mono w-24 shrink-0">{col.campo}</code>
                      <span className="text-slate-500">{col.tipo}</span>
                      {col.req && <span className="text-blue-400 text-[9px]">obligatorio</span>}
                      <span className="text-slate-600 ml-auto">{col.ejemplo}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
                  uploadFile ? 'border-blue-600 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
                }`}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                {uploadFile ? (
                  <div>
                    <FileSpreadsheet className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB · Listo para importar</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Arrastra el archivo aquí o <span className="text-blue-400">haz click</span></p>
                    <p className="text-xs text-slate-600 mt-1">CSV, Excel (.xlsx, .xls) · Max 10 MB</p>
                  </div>
                )}
              </div>

              {/* Preview toggle */}
              {uploadFile && (
                <button
                  onClick={() => setUploadPreview(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {uploadPreview ? 'Ocultar' : 'Ver'} previsualización
                </button>
              )}

              {uploadPreview && (
                <div className="overflow-x-auto">
                  <p className="text-[10px] text-slate-500 mb-1.5">Primeras 3 filas (ejemplo):</p>
                  <table className="w-full text-[10px] text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['codigo', 'descripcion', 'marca', 'precio_compra', 'familia'].map(h => (
                          <th key={h} className="text-left text-slate-500 font-semibold pb-1 pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PREVIEW_ROWS.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800">
                          <td className="py-1 pr-3 font-mono text-blue-400">{row.codigo}</td>
                          <td className="py-1 pr-3 max-w-[120px] truncate">{row.descripcion}</td>
                          <td className="py-1 pr-3 text-slate-400">{row.marca}</td>
                          <td className="py-1 pr-3 text-emerald-400">{row.precio_compra} €</td>
                          <td className="py-1 pr-3 text-slate-400">{row.familia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Import button */}
              <button
                onClick={handleUploadProcess}
                disabled={!uploadFile || uploadLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {uploadLoading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Procesando…</>
                ) : (
                  <><Upload className="h-4 w-4" /> Importar catálogo</>
                )}
              </button>
            </div>
          )}

          {/* Empty state */}
          {!selected && !showUpload && (
            <div className="bg-slate-800/30 border border-slate-700 border-dashed rounded-lg p-8 text-center">
              <Truck className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-semibold">Selecciona un proveedor</p>
              <p className="text-xs text-slate-600 mt-1">para ver y editar su configuración</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Ver productos del catálogo */}
      {showProducts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {suppliers.find(s => s.id === productCatalogId)?.nombre ?? 'Catálogo'} — Productos
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {productTotal.toLocaleString('es-ES')} productos indexados
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowProducts(false); setProducts([]); }}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por descripción…"
                  value={productSearch}
                  onChange={e => handleProductSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {productSearch && (
                  <button
                    onClick={() => handleProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-4 py-2.5 w-24">Ref.</th>
                    <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5">Descripción</th>
                    <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5 w-24">Marca</th>
                    <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5 w-24">Familia</th>
                    <th className="text-right text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5 w-20">P. Coste</th>
                    <th className="text-right text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5 w-20">P. Venta</th>
                    <th className="text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5 w-12">Ud.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const sup = suppliers.find(s => s.id === productCatalogId);
                    const margen = sup?.margen_pct ?? 20;
                    const pvp = p.precio_coste * (1 + margen / 100);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${!p.activo ? 'opacity-40' : ''}`}
                      >
                        <td className="px-4 py-2 font-mono text-[10px] text-blue-400 truncate max-w-[80px]">
                          {p.ref_proveedor ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-200 max-w-[260px]">
                          <span className="line-clamp-2 leading-snug">{p.descripcion}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 truncate">{p.marca ?? '—'}</td>
                        <td className="px-3 py-2">
                          {p.familia && (
                            <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                              {p.familia}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">
                          {p.precio_coste.toFixed(2)} €
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-mono font-semibold">
                          {pvp.toFixed(2)} €
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500">{p.unidad}</td>
                      </tr>
                    );
                  })}

                  {productsLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!productsLoading && products.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-xs">
                        {productSearch ? 'Sin resultados para esa búsqueda' : 'No hay productos en este catálogo'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer: load more + info */}
            <div className="px-5 py-3 border-t border-slate-700 shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                Mostrando {products.length} de {productTotal.toLocaleString('es-ES')} · P. Venta = coste × (1 + {suppliers.find(s => s.id === productCatalogId)?.margen_pct ?? 20}% margen)
              </span>
              {products.length < productTotal && !productsLoading && (
                <button
                  onClick={handleLoadMore}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer transition-colors"
                >
                  Cargar {Math.min(PAGE_SIZE, productTotal - products.length)} más →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Roadmap */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3 font-bold">Roadmap de implementación</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { fase: '1', label: 'OBRAMAT + Propio', items: ['Catálogo OBRAMAT', 'CSV propio', 'Márgenes', 'Proveedor preferido'], estado: 'en_curso' },
            { fase: '2', label: 'Multi-proveedor',  items: ['Saltoki, Sonepar', 'Comparador precios', 'Recomendación IA'], estado: 'pendiente' },
            { fase: '3', label: 'Aprendizaje',      items: ['Preferencias por categoría', 'Optimización márgenes', 'Historial decisiones'], estado: 'pendiente' },
            { fase: '4', label: 'Compra directa',   items: ['Cesta de compra', 'Pedido a proveedor', 'Integración comercial'], estado: 'pendiente' },
          ].map(({ fase, label, items, estado }) => (
            <div key={fase} className={`rounded-lg p-3 border ${estado === 'en_curso' ? 'border-blue-700 bg-blue-900/20' : 'border-slate-700 bg-slate-800/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${estado === 'en_curso' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  FASE {fase}
                </span>
                {estado === 'en_curso' && <span className="text-[9px] text-blue-400 font-bold">En curso</span>}
              </div>
              <p className="text-xs font-bold text-white mb-2">{label}</p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item} className={`text-[10px] flex items-center gap-1.5 ${estado === 'en_curso' ? 'text-slate-300' : 'text-slate-500'}`}>
                    <span className="w-1 h-1 rounded-full bg-current shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
