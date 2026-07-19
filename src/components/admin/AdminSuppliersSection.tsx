import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Package, Upload, RefreshCw, CheckCircle, XCircle, Clock,
  ChevronRight, AlertTriangle, Truck, Building2, User, Plus,
  Download, Eye, Trash2, ToggleLeft, ToggleRight,
  FileSpreadsheet, Zap, Search, X, Mail, Globe, Phone, MapPin,
  Hash, Send, ExternalLink,
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
  phone?: string;
  website?: string;
  address?: string;
  tax_id?: string;
  categoria?: string;
  is_custom?: boolean;
}

const SUPPLIER_META: Record<string, { tipo: SupplierTipo; descripcion: string; acuerdo: AcuerdoEstado; color: string }> = {
  propio:        { tipo: 'propio',     descripcion: 'Tus tarifas negociadas. CSV con precios de compra propios.',                 acuerdo: 'activo',      color: '#4A6741' },
  obramat:       { tipo: 'nacional',   descripcion: 'Distribución nacional materiales construcción e instalaciones.',             acuerdo: 'negociando',  color: '#E87722' },
  saltoki:       { tipo: 'nacional',   descripcion: 'Distribuidor fontanería, calefacción y climatización.',                      acuerdo: 'activo',      color: '#1A5A96' },
  sonepar:       { tipo: 'nacional',   descripcion: 'Distribución eléctrica e industrial.',                                       acuerdo: 'activo',      color: '#6366f1' },
  novelec:       { tipo: 'nacional',   descripcion: 'Material eléctrico y automatización.',                                       acuerdo: 'activo',      color: '#f59e0b' },
  rexel:         { tipo: 'nacional',   descripcion: 'Distribución eléctrica global. Marcas ABB, Top Cable.',                      acuerdo: 'activo',      color: '#ef4444' },
  wurth:         { tipo: 'nacional',   descripcion: 'Suministro industrial multi-oficio: tornillería, EPIs, herramienta, química.',acuerdo: 'activo',      color: '#e11d48' },
  bricomart:     { tipo: 'nacional',   descripcion: 'Materiales construcción profesional: cemento, estructura, herramienta.',      acuerdo: 'activo',      color: '#0ea5e9' },
  daikin:        { tipo: 'fabricante', descripcion: 'Splits, multi-split, aerotermia y VRV. Líder climatización.',                acuerdo: 'activo',      color: '#0284c7' },
  saunier_duval: { tipo: 'fabricante', descripcion: 'Calderas de condensación, aerotermia y solar térmica.',                      acuerdo: 'activo',      color: '#16a34a' },
  vaillant:      { tipo: 'fabricante', descripcion: 'Calefacción ecoTEC, bomba de calor arotherm y ACS.',                         acuerdo: 'activo',      color: '#10b981' },
  junkers:       { tipo: 'fabricante', descripcion: 'Calderas Cerapur, calentadores HydroCompact y ACS.',                         acuerdo: 'activo',      color: '#ec4899' },
  ariston:       { tipo: 'fabricante', descripcion: 'Calderas Genus, termoacumuladores Velis y aerotermia Nimbus.',                acuerdo: 'activo',      color: '#14b8a6' },
  baxi:          { tipo: 'fabricante', descripcion: 'Calderas Duo-tec, calentadores y aerotermia Aurea.',                          acuerdo: 'activo',      color: '#8b5cf6' },
  ferroli:       { tipo: 'fabricante', descripcion: 'Calefacción, climatización y ACS.',                                           acuerdo: 'sin_acuerdo', color: '#f97316' },
};

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
  { campo: 'codigo',         tipo: 'texto',   req: false, ejemplo: 'FON-001' },
  { campo: 'descripcion',    tipo: 'texto',   req: true,  ejemplo: 'Termo eléctrico 100L vertical' },
  { campo: 'marca',          tipo: 'texto',   req: false, ejemplo: 'Junkers' },
  { campo: 'precio_compra',  tipo: 'número',  req: true,  ejemplo: '289.50' },
  { campo: 'familia',        tipo: 'texto',   req: false, ejemplo: 'ACS' },
  { campo: 'unidad',         tipo: 'texto',   req: false, ejemplo: 'ud' },
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

const EMPTY_CREATE = {
  nombre: '', key: '', tipo: 'nacional' as SupplierTipo,
  taxId: '', phone: '', website: '', address: '',
  contactName: '', contactEmail: '', descripcion: '', categoria: '',
};

export default function AdminSuppliersSection({ toast }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupplierConfig | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tabs detail panel
  const [rightTab, setRightTab] = useState<'catalogo' | 'empresa' | 'acuerdo'>('catalogo');

  // Edit: catálogo
  const [editMargen, setEditMargen] = useState('');

  // Edit: empresa
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTaxId, setEditTaxId] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editNombreEmpresa, setEditNombreEmpresa] = useState('');
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // Edit: acuerdo
  const [editAcuerdo, setEditAcuerdo] = useState<AcuerdoEstado>('sin_acuerdo');
  const [editNotes, setEditNotes] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [savingAcuerdo, setSavingAcuerdo] = useState(false);

  // Crear nuevo proveedor
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);

  // Eliminar proveedor (solo custom)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal productos
  const [showProducts, setShowProducts] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [productCatalogId, setProductCatalogId] = useState<string | null>(null);

  useEffect(() => {
    loadCatalogs();
  }, []);

  async function loadCatalogs() {
    setLoading(true);
    try {
      const { data: catalogs, error } = await supabase
        .from('trade_supplier_catalogs')
        .select('id, supplier_key, supplier_name, is_active, margen_pct_default, prioridad, is_custom, created_at, acuerdo_estado, admin_notes, contact_name, contact_email, phone, website, address, tax_id, categoria')
        .is('org_id', null)
        .order('prioridad');
      if (error) throw error;

      const { data: counts } = await supabase
        .from('trade_supplier_products')
        .select('catalog_id, updated_at');

      const countMap = new Map<string, number>();
      const lastSyncMap = new Map<string, string>();
      for (const row of (counts ?? []) as Array<{ catalog_id: string; updated_at: string }>) {
        countMap.set(row.catalog_id, (countMap.get(row.catalog_id) ?? 0) + 1);
        const prev = lastSyncMap.get(row.catalog_id);
        if (!prev || row.updated_at > prev) lastSyncMap.set(row.catalog_id, row.updated_at);
      }

      const mapped: SupplierConfig[] = (catalogs ?? []).map((c: Record<string, unknown>) => {
        const key = c.supplier_key as string;
        const meta = SUPPLIER_META[key] ?? {
          tipo: 'custom' as SupplierTipo, descripcion: c.supplier_name as string,
          acuerdo: 'sin_acuerdo' as AcuerdoEstado, color: '#64748b',
        };
        const prods = countMap.get(c.id as string) ?? 0;
        return {
          id: c.id as string,
          nombre: c.supplier_name as string,
          tipo: meta.tipo,
          activo: c.is_active as boolean,
          margen_pct: Number(c.margen_pct_default),
          prioridad: c.prioridad as number,
          productos: prods,
          ultima_sync: lastSyncMap.get(c.id as string)?.slice(0, 10) ?? undefined,
          sync_estado: prods > 0 ? 'ok' : 'nunca',
          descripcion: meta.descripcion,
          acuerdo: (c.acuerdo_estado as AcuerdoEstado) || meta.acuerdo,
          color: meta.color,
          admin_notes: (c.admin_notes as string) ?? '',
          contact_name: (c.contact_name as string) ?? '',
          contact_email: (c.contact_email as string) ?? '',
          phone: (c.phone as string) ?? '',
          website: (c.website as string) ?? '',
          address: (c.address as string) ?? '',
          tax_id: (c.tax_id as string) ?? '',
          categoria: (c.categoria as string) ?? '',
          is_custom: (c.is_custom as boolean) ?? false,
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

  const handleToggle = async (id: string) => {
    const sup = suppliers.find(s => s.id === id);
    if (!sup) return;
    const newActive = !sup.activo;
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, activo: newActive } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, activo: newActive } : prev);
    const { error } = await supabase.from('trade_supplier_catalogs').update({ is_active: newActive }).eq('id', id);
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
    setEditPhone(s.phone ?? '');
    setEditWebsite(s.website ?? '');
    setEditAddress(s.address ?? '');
    setEditTaxId(s.tax_id ?? '');
    setEditCategoria(s.categoria ?? '');
    setEditNombreEmpresa(s.nombre);
    setShowUpload(false);
  };

  const handleSaveMargen = async () => {
    if (!selected) return;
    const val = parseFloat(editMargen);
    if (isNaN(val) || val < 0 || val > 200) { toast('error', 'Margen inválido (0-200%)'); return; }
    const { error } = await supabase.from('trade_supplier_catalogs').update({ margen_pct_default: val }).eq('id', selected.id);
    if (error) { toast('error', 'Error al guardar el margen'); return; }
    setSuppliers(prev => prev.map(s => s.id === selected.id ? { ...s, margen_pct: val } : s));
    setSelected(prev => prev ? { ...prev, margen_pct: val } : prev);
    toast('success', `Margen de ${selected.nombre} actualizado a ${val}%`);
  };

  const handleSaveEmpresa = async () => {
    if (!selected) return;
    setSavingEmpresa(true);
    const updates: Record<string, unknown> = {
      supplier_name: editNombreEmpresa.trim() || selected.nombre,
      phone:    editPhone.trim()    || null,
      website:  editWebsite.trim()  || null,
      address:  editAddress.trim()  || null,
      tax_id:   editTaxId.trim()    || null,
      categoria: editCategoria.trim() || null,
    };
    const { error } = await supabase.from('trade_supplier_catalogs').update(updates).eq('id', selected.id);
    if (error) {
      toast('error', 'Error al guardar datos de empresa');
    } else {
      const updated = {
        ...selected,
        nombre: updates.supplier_name as string,
        phone: editPhone, website: editWebsite, address: editAddress,
        tax_id: editTaxId, categoria: editCategoria,
      };
      setSuppliers(prev => prev.map(s => s.id === selected.id ? updated : s));
      setSelected(updated);
      toast('success', `Datos de ${updated.nombre} guardados`);
    }
    setSavingEmpresa(false);
  };

  const handleSaveAcuerdo = async () => {
    if (!selected) return;
    setSavingAcuerdo(true);
    const { error } = await supabase.from('trade_supplier_catalogs').update({
      acuerdo_estado:  editAcuerdo,
      admin_notes:     editNotes || null,
      contact_name:    editContactName || null,
      contact_email:   editContactEmail || null,
    }).eq('id', selected.id);
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

  const handleCreate = async () => {
    if (!createForm.nombre.trim()) { toast('error', 'El nombre de la empresa es obligatorio'); return; }
    setCreating(true);
    const key = createForm.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      || createForm.nombre.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
    const { data, error } = await supabase.from('trade_supplier_catalogs').insert({
      supplier_key: key,
      supplier_name: createForm.nombre.trim(),
      is_active: true,
      is_custom: true,
      org_id: null,
      margen_pct_default: 20,
      prioridad: suppliers.length + 1,
      acuerdo_estado: 'sin_acuerdo',
      contact_name:  createForm.contactName  || null,
      contact_email: createForm.contactEmail || null,
      phone:         createForm.phone        || null,
      website:       createForm.website      || null,
      address:       createForm.address      || null,
      tax_id:        createForm.taxId        || null,
      categoria:     createForm.categoria    || null,
    }).select().single();

    if (error) {
      toast('error', `Error al crear el proveedor: ${error.message}`);
    } else {
      const newSup: SupplierConfig = {
        id: data.id, nombre: createForm.nombre.trim(), tipo: createForm.tipo,
        activo: true, margen_pct: 20, prioridad: suppliers.length + 1, productos: 0,
        sync_estado: 'nunca', descripcion: createForm.descripcion || createForm.nombre.trim(),
        acuerdo: 'sin_acuerdo', color: '#64748b', is_custom: true,
        contact_name: createForm.contactName, contact_email: createForm.contactEmail,
        phone: createForm.phone, website: createForm.website, address: createForm.address,
        tax_id: createForm.taxId, categoria: createForm.categoria, admin_notes: '',
      };
      setSuppliers(prev => [...prev, newSup]);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      toast('success', `${createForm.nombre.trim()} añadido a la central de compras`);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const sup = suppliers.find(s => s.id === id);
    if (!sup?.is_custom) return;
    setDeletingId(id);
    await supabase.from('trade_supplier_products').delete().eq('catalog_id', id);
    const { error } = await supabase.from('trade_supplier_catalogs').delete().eq('id', id);
    if (error) {
      toast('error', 'Error al eliminar el proveedor');
    } else {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      if (selected?.id === id) setSelected(null);
      toast('success', `${sup.nombre} eliminado`);
    }
    setDeletingId(null);
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    await new Promise(r => setTimeout(r, 2000));
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : prev);
    setSyncing(null);
    toast('success', `${suppliers.find(s => s.id === id)?.nombre ?? ''} sincronizado`);
  };

  const handleUploadProcess = async () => {
    if (!uploadFile || !selected) return;
    setUploadLoading(true);
    try {
      const text = await uploadFile.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('error', 'El archivo está vacío o sin datos'); setUploadLoading(false); return; }
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
        setUploadLoading(false); return;
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

      if (rows.length === 0) { toast('error', 'No se encontraron filas válidas'); setUploadLoading(false); return; }
      await supabase.from('trade_supplier_products').delete().eq('catalog_id', selected.id);
      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('trade_supplier_products').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
        inserted += Math.min(BATCH, rows.length - i);
      }
      setSuppliers(prev => prev.map(s => s.id === selected.id ? { ...s, productos: inserted, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : s));
      setSelected(prev => prev ? { ...prev, productos: inserted, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : prev);
      setUploadFile(null); setShowUpload(false);
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
      let query = supabase.from('trade_supplier_products')
        .select('id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo', { count: 'exact' })
        .eq('catalog_id', catalogId).order('descripcion')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (search.trim()) query = query.ilike('descripcion', `%${search.trim()}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      if (page === 0) setProducts((data as ProductRow[]) ?? []);
      else setProducts(prev => [...prev, ...((data as ProductRow[]) ?? [])]);
      setProductTotal(count ?? 0);
    } catch (e) {
      toast('error', `Error cargando productos: ${(e as Error).message}`);
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  const handleViewProducts = (sup: SupplierConfig) => {
    setProductCatalogId(sup.id); setProductSearch(''); setProductPage(0);
    setProducts([]); setProductTotal(0); setShowProducts(true);
    loadProducts(sup.id, '', 0);
  };

  const totalActivos = suppliers.filter(s => s.activo).length;
  const totalProductos = suppliers.filter(s => s.activo).reduce((a, s) => a + s.productos, 0);
  const lastSync = suppliers.filter(s => s.ultima_sync).sort((a, b) => (b.ultima_sync ?? '').localeCompare(a.ultima_sync ?? ''))[0]?.ultima_sync;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-3">
        <RefreshCw className="h-5 w-5 animate-spin" />Cargando catálogos de proveedores…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header + KPIs */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />Central de Compras
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestiona proveedores, acuerdos comerciales y catálogos base para la generación de presupuestos.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setShowCreate(true); setSelected(null); setShowUpload(false); }}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva empresa
          </button>
          <button
            onClick={() => { setSelected(null); setShowUpload(true); setShowCreate(false); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" /> Subir catálogo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Proveedores activos', value: totalActivos, Icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Productos indexados', value: totalProductos.toLocaleString('es-ES'), Icon: Package, color: 'text-blue-400' },
          { label: 'Último sync', value: lastSync ?? '—', Icon: Clock, color: 'text-slate-300' },
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

      {/* Suppliers grid + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

        {/* Lista */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proveedores ({suppliers.length})</p>
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
                  isSelected ? 'bg-blue-900/30 border-blue-700' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-black"
                  style={{ backgroundColor: sup.color + '30', border: `1px solid ${sup.color}40` }}
                >
                  <span style={{ color: sup.color }}>{sup.nombre.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{sup.nombre}</span>
                    <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <TipoIcon className="h-2.5 w-2.5" />{tipoLabel}
                    </span>
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded ${acuerdoCfg.cls}`}>
                      {acuerdoCfg.label}
                    </span>
                    {sup.is_custom && (
                      <span className="text-[9px] bg-purple-900/40 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded">Custom</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                    <span>{sup.productos > 0 ? `${sup.productos.toLocaleString('es-ES')} prods` : 'Sin productos'}</span>
                    <span>Margen: <strong className="text-slate-300">{sup.margen_pct}%</strong></span>
                    {sup.contact_email && <span className="flex items-center gap-0.5 text-blue-500"><Mail className="h-2.5 w-2.5" />{sup.contact_email}</span>}
                    <span className={`flex items-center gap-1 ${syncCfg.cls}`}>
                      {isSyncing ? <><RefreshCw className="h-3 w-3 animate-spin" />Sincronizando…</> : <><SyncIcon className="h-3 w-3" />{syncCfg.label}</>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">#{sup.prioridad}</span>
                  {sup.is_custom && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(sup.id); }}
                      disabled={deletingId === sup.id}
                      className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      title="Eliminar proveedor"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleToggle(sup.id); }} className="cursor-pointer" title={sup.activo ? 'Desactivar' : 'Activar'}>
                    {sup.activo ? <ToggleRight className="h-6 w-6 text-emerald-400" /> : <ToggleLeft className="h-6 w-6 text-slate-600" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel derecho: detalle / crear / subir */}
        <div>

          {/* Detalle proveedor seleccionado */}
          {selected && !showUpload && !showCreate && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: selected.color + '30', border: `1px solid ${selected.color}40` }}>
                    <span style={{ color: selected.color }}>{selected.nombre.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className="font-bold text-white text-sm truncate max-w-[140px]">{selected.nombre}</span>
                </div>
                <button
                  onClick={() => handleToggle(selected.id)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                    selected.activo ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700' : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {selected.activo ? 'Disponible ✓' : 'Oculto'}
                </button>
              </div>

              {/* Tabs: Catálogo / Empresa / Acuerdo */}
              <div className="flex border-b border-slate-700">
                {(['catalogo', 'empresa', 'acuerdo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`flex-1 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                      rightTab === tab ? 'bg-slate-700/60 text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'catalogo' ? '📦 Catálogo' : tab === 'empresa' ? '🏢 Empresa' : '🤝 Acuerdo'}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4">

                {/* ── TAB CATÁLOGO ── */}
                {rightTab === 'catalogo' && (
                  <>
                    <p className="text-xs text-slate-400">{selected.descripcion}</p>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                        Margen por defecto para clientes (%)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number" min={0} max={200} step={0.5} value={editMargen}
                          onChange={e => setEditMargen(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <button onClick={handleSaveMargen} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer">
                          Guardar
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Catálogo de productos</span>
                        {selected.ultima_sync && <span className="text-[10px] text-slate-500">Sync: {selected.ultima_sync}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSync(selected.id)} disabled={syncing === selected.id}
                          className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                          {syncing === selected.id ? <><RefreshCw className="h-3 w-3 animate-spin" />Sincronizando…</> : <><RefreshCw className="h-3 w-3" />Sync manual</>}
                        </button>
                        <button onClick={() => setShowUpload(true)}
                          className="flex items-center justify-center gap-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 text-xs font-semibold py-2 rounded-lg border border-blue-800 transition-colors cursor-pointer">
                          <Upload className="h-3 w-3" />Subir CSV
                        </button>
                      </div>
                    </div>

                    {selected.productos > 0 && (
                      <button onClick={() => handleViewProducts(selected)}
                        className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-300 py-1.5 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg transition-colors cursor-pointer">
                        <Eye className="h-3.5 w-3.5" />Ver {selected.productos.toLocaleString('es-ES')} productos
                      </button>
                    )}
                  </>
                )}

                {/* ── TAB EMPRESA ── */}
                {rightTab === 'empresa' && (
                  <>
                    {/* Nombre editable */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Nombre empresa</label>
                      <input type="text" value={editNombreEmpresa} onChange={e => setEditNombreEmpresa(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* CIF */}
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Hash className="h-3 w-3" />CIF / NIF
                        </label>
                        <input type="text" placeholder="B12345678" value={editTaxId} onChange={e => setEditTaxId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                      </div>
                      {/* Teléfono */}
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />Teléfono
                        </label>
                        <input type="tel" placeholder="91 000 00 00" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    {/* Web */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Globe className="h-3 w-3" />Página web
                      </label>
                      <div className="flex gap-2">
                        <input type="url" placeholder="https://www.proveedor.com" value={editWebsite} onChange={e => setEditWebsite(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                        {editWebsite && (
                          <a href={editWebsite} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2 py-2 rounded-lg transition-colors">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Dirección */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />Dirección
                      </label>
                      <input type="text" placeholder="Calle Industria 15, 28001 Madrid" value={editAddress} onChange={e => setEditAddress(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Categoría / Especialidad</label>
                      <input type="text" placeholder="Fontanería, Electricidad, Construcción…" value={editCategoria} onChange={e => setEditCategoria(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                    </div>

                    <button onClick={handleSaveEmpresa} disabled={savingEmpresa}
                      className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
                      {savingEmpresa ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Guardando…</> : 'Guardar datos de empresa'}
                    </button>
                  </>
                )}

                {/* ── TAB ACUERDO ── */}
                {rightTab === 'acuerdo' && (
                  <>
                    {/* Estado */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Estado del acuerdo</label>
                      <div className="flex gap-1.5">
                        {(['activo', 'negociando', 'sin_acuerdo'] as AcuerdoEstado[]).map(est => (
                          <button key={est} onClick={() => setEditAcuerdo(est)}
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border cursor-pointer transition-all ${
                              editAcuerdo === est ? ACUERDO_CFG[est].cls : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                            }`}>
                            {est === 'activo' ? '✓ Activo' : est === 'negociando' ? '⏳ Negociando' : '— Sin acuerdo'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contacto */}
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Persona de contacto comercial</label>
                      <input type="text" placeholder="Nombre y apellidos"
                        value={editContactName} onChange={e => setEditContactName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                      <div className="flex gap-2">
                        <input type="email" placeholder="contacto@proveedor.com"
                          value={editContactEmail} onChange={e => setEditContactEmail(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                        {editContactEmail && (
                          <a href={`mailto:${editContactEmail}?subject=Contacto TrabFlow — ${selected.nombre}`}
                            className="flex items-center gap-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                            title="Enviar email">
                            <Send className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Notas del acuerdo / conversaciones</label>
                      <textarea rows={5} placeholder="Condiciones negociadas, descuentos especiales, próxima reunión, resumen llamadas…"
                        value={editNotes} onChange={e => setEditNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
                    </div>

                    <button onClick={handleSaveAcuerdo} disabled={savingAcuerdo}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
                      {savingAcuerdo ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Guardando…</> : 'Guardar acuerdo'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Crear nuevo proveedor */}
          {showCreate && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-400" />Nueva empresa proveedora
                </h3>
                <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); }} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Nombre empresa *</label>
                <input type="text" placeholder="Nombre del proveedor"
                  value={createForm.nombre} onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">CIF / NIF</label>
                  <input type="text" placeholder="B12345678"
                    value={createForm.taxId} onChange={e => setCreateForm(f => ({ ...f, taxId: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Teléfono</label>
                  <input type="tel" placeholder="91 000 00 00"
                    value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Página web</label>
                <input type="url" placeholder="https://www.proveedor.com"
                  value={createForm.website} onChange={e => setCreateForm(f => ({ ...f, website: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Persona de contacto</label>
                <input type="text" placeholder="Nombre del comercial"
                  value={createForm.contactName} onChange={e => setCreateForm(f => ({ ...f, contactName: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Email de contacto</label>
                <input type="email" placeholder="comercial@proveedor.com"
                  value={createForm.contactEmail} onChange={e => setCreateForm(f => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Categoría / Especialidad</label>
                <input type="text" placeholder="Fontanería, Electricidad, Material general…"
                  value={createForm.categoria} onChange={e => setCreateForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Dirección</label>
                <input type="text" placeholder="Calle, número, ciudad, CP"
                  value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              <button onClick={handleCreate} disabled={creating || !createForm.nombre.trim()}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
                {creating ? <><RefreshCw className="h-4 w-4 animate-spin" />Creando…</> : <><Plus className="h-4 w-4" />Dar de alta proveedor</>}
              </button>
            </div>
          )}

          {/* Subir catálogo CSV */}
          {showUpload && !showCreate && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-400" />Subir catálogo (CSV)
                </h3>
                <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
              </div>

              {selected ? (
                <p className="text-xs text-slate-400">Subiendo catálogo para: <strong className="text-white">{selected.nombre}</strong></p>
              ) : (
                <p className="text-xs text-amber-400">Selecciona primero un proveedor de la lista para asociar el catálogo.</p>
              )}

              <div className="bg-slate-900/60 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Formato CSV</p>
                  <button onClick={() => {
                    const csv = CSV_COLUMNS.map(c => c.campo).join(',') + '\n' + CSV_COLUMNS.map(c => c.ejemplo).join(',') + '\n';
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_catalogo.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                    <Download className="h-3 w-3" />Plantilla
                  </button>
                </div>
                {CSV_COLUMNS.map(col => (
                  <div key={col.campo} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.req ? 'bg-blue-500' : 'bg-slate-600'}`} />
                    <code className="text-slate-300 font-mono w-24 shrink-0">{col.campo}</code>
                    <span className="text-slate-500">{col.tipo}{col.req ? ' *' : ''}</span>
                    <span className="text-slate-600 ml-auto">{col.ejemplo}</span>
                  </div>
                ))}
              </div>

              <div onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
                  uploadFile ? 'border-blue-600 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
                }`}>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { setUploadFile(e.target.files?.[0] ?? null); }} />
                {uploadFile ? (
                  <div>
                    <FileSpreadsheet className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Arrastra o <span className="text-blue-400">haz click</span></p>
                    <p className="text-xs text-slate-600 mt-1">CSV · separador coma o punto y coma</p>
                  </div>
                )}
              </div>

              <button onClick={handleUploadProcess} disabled={!uploadFile || uploadLoading || !selected}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
                {uploadLoading ? <><RefreshCw className="h-4 w-4 animate-spin" />Procesando…</> : <><Upload className="h-4 w-4" />Importar catálogo</>}
              </button>
            </div>
          )}

          {/* Empty state */}
          {!selected && !showUpload && !showCreate && (
            <div className="bg-slate-800/30 border border-slate-700 border-dashed rounded-lg p-8 text-center">
              <Truck className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-semibold">Selecciona un proveedor</p>
              <p className="text-xs text-slate-600 mt-1">para ver su ficha, acuerdo comercial y catálogo</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 mx-auto text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 hover:border-emerald-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                <Plus className="h-3.5 w-3.5" />Añadir nuevo proveedor
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Ver productos */}
      {showProducts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {suppliers.find(s => s.id === productCatalogId)?.nombre ?? 'Catálogo'} — Productos
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{productTotal.toLocaleString('es-ES')} productos indexados</p>
              </div>
              <button onClick={() => { setShowProducts(false); setProducts([]); }} className="text-slate-500 hover:text-white cursor-pointer p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-slate-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input type="text" placeholder="Buscar por descripción…" value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductPage(0); setProducts([]); if (productCatalogId) loadProducts(productCatalogId, e.target.value, 0); }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-700">
                    {['Ref.', 'Descripción', 'Marca', 'Familia', 'P. Coste', 'P. Venta', 'Ud.'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const margen = suppliers.find(s => s.id === productCatalogId)?.margen_pct ?? 20;
                    const pvp = p.precio_coste * (1 + margen / 100);
                    return (
                      <tr key={p.id} className={`border-b border-slate-800/50 hover:bg-slate-800/40 ${!p.activo ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2 font-mono text-[10px] text-blue-400">{p.ref_proveedor ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-200 max-w-[240px]"><span className="line-clamp-2 leading-snug">{p.descripcion}</span></td>
                        <td className="px-3 py-2 text-slate-400">{p.marca ?? '—'}</td>
                        <td className="px-3 py-2">{p.familia && <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{p.familia}</span>}</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">{p.precio_coste.toFixed(2)} €</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-mono font-semibold">{pvp.toFixed(2)} €</td>
                        <td className="px-3 py-2 text-center text-slate-500">{p.unidad}</td>
                      </tr>
                    );
                  })}
                  {productsLoading && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Cargando…</td></tr>
                  )}
                  {!productsLoading && products.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-xs">
                      {productSearch ? 'Sin resultados' : 'No hay productos en este catálogo'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-700 shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                {products.length} de {productTotal.toLocaleString('es-ES')} · Venta = coste × (1 + {suppliers.find(s => s.id === productCatalogId)?.margen_pct ?? 20}%)
              </span>
              {products.length < productTotal && !productsLoading && (
                <button onClick={() => { const next = productPage + 1; setProductPage(next); if (productCatalogId) loadProducts(productCatalogId, productSearch, next); }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer">
                  Cargar más →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
