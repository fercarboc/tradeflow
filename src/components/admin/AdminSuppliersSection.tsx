import { useState, useRef } from 'react';
import {
  Package, Upload, RefreshCw, CheckCircle, XCircle, Clock,
  ChevronRight, AlertTriangle, Truck, Building2, User, Plus,
  Download, Eye, Trash2, ToggleLeft, ToggleRight, Star, StarOff,
  FileSpreadsheet, Info, Zap, ArrowUpDown,
} from 'lucide-react';

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
}

const INITIAL_SUPPLIERS: SupplierConfig[] = [
  { id: 'propio',   nombre: 'Catálogo propio',   tipo: 'propio',     activo: true,  margen_pct: 35, prioridad: 1, productos: 0,     sync_estado: 'nunca',    descripcion: 'Tus tarifas negociadas. CSV con precios de compra propios.', acuerdo: 'activo',       color: '#4A6741' },
  { id: 'obramat',  nombre: 'OBRAMAT',            tipo: 'nacional',   activo: false, margen_pct: 30, prioridad: 2, productos: 15400, ultima_sync: '2026-06-15', sync_estado: 'ok',    descripcion: 'Distribución nacional materiales construcción e instalaciones.', acuerdo: 'negociando',  color: '#E87722' },
  { id: 'saltoki',  nombre: 'Saltoki',            tipo: 'nacional',   activo: false, margen_pct: 22, prioridad: 3, productos: 8200,  sync_estado: 'nunca',    descripcion: 'Distribuidor fontanería, calefacción y climatización.', acuerdo: 'sin_acuerdo', color: '#1A5A96' },
  { id: 'sonepar',  nombre: 'Sonepar',            tipo: 'nacional',   activo: false, margen_pct: 25, prioridad: 4, productos: 12500, sync_estado: 'nunca',    descripcion: 'Distribución eléctrica e industrial.', acuerdo: 'sin_acuerdo', color: '#6366f1' },
  { id: 'novelec',  nombre: 'Novelec',            tipo: 'nacional',   activo: false, margen_pct: 22, prioridad: 5, productos: 6800,  sync_estado: 'nunca',    descripcion: 'Material eléctrico y automatización.', acuerdo: 'sin_acuerdo', color: '#f59e0b' },
  { id: 'rexel',    nombre: 'Rexel',              tipo: 'nacional',   activo: false, margen_pct: 20, prioridad: 6, productos: 9300,  sync_estado: 'nunca',    descripcion: 'Distribución eléctrica global.', acuerdo: 'sin_acuerdo', color: '#ef4444' },
  { id: 'vaillant', nombre: 'Vaillant',           tipo: 'fabricante', activo: false, margen_pct: 18, prioridad: 7, productos: 420,   sync_estado: 'nunca',    descripcion: 'Calefacción, ACS y climatización.', acuerdo: 'sin_acuerdo', color: '#10b981' },
  { id: 'junkers',  nombre: 'Junkers / Bosch',   tipo: 'fabricante', activo: false, margen_pct: 18, prioridad: 8, productos: 380,   sync_estado: 'nunca',    descripcion: 'Calderas, calentadores y ACS.', acuerdo: 'sin_acuerdo', color: '#ec4899' },
  { id: 'ariston',  nombre: 'Ariston',           tipo: 'fabricante', activo: false, margen_pct: 18, prioridad: 9, productos: 310,   sync_estado: 'nunca',    descripcion: 'Calentadores y acumuladores ACS.', acuerdo: 'sin_acuerdo', color: '#14b8a6' },
];

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

interface Props {
  toast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export default function AdminSuppliersSection({ toast }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierConfig[]>(INITIAL_SUPPLIERS);
  const [selected, setSelected] = useState<SupplierConfig | null>(null);
  const [editMargen, setEditMargen] = useState<string>('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalActivos = suppliers.filter(s => s.activo).length;
  const totalProductos = suppliers.filter(s => s.activo).reduce((a, s) => a + s.productos, 0);
  const lastSync = suppliers
    .filter(s => s.ultima_sync)
    .sort((a, b) => (b.ultima_sync ?? '').localeCompare(a.ultima_sync ?? ''))[0]?.ultima_sync;

  const handleToggle = (id: string) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, activo: !s.activo } : s));
    const sup = suppliers.find(s => s.id === id);
    if (sup) toast('success', `${sup.nombre} ${sup.activo ? 'desactivado' : 'activado'}`);
  };

  const handleSelect = (s: SupplierConfig) => {
    setSelected(s);
    setEditMargen(String(s.margen_pct));
    setShowUpload(false);
  };

  const handleSaveMargen = () => {
    if (!selected) return;
    const val = parseFloat(editMargen);
    if (isNaN(val) || val < 0 || val > 200) { toast('error', 'Margen inválido (0-200%)'); return; }
    setSuppliers(prev => prev.map(s => s.id === selected.id ? { ...s, margen_pct: val } : s));
    setSelected(prev => prev ? { ...prev, margen_pct: val } : prev);
    toast('success', `Margen de ${selected.nombre} actualizado a ${val}%`);
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
    if (!uploadFile) return;
    setUploadLoading(true);
    await new Promise(r => setTimeout(r, 2200));
    setUploadLoading(false);
    setSuppliers(prev => prev.map(s => s.id === 'propio' ? { ...s, productos: 127, sync_estado: 'ok', ultima_sync: new Date().toISOString().slice(0, 10) } : s));
    if (selected?.id === 'propio') setSelected(prev => prev ? { ...prev, productos: 127, sync_estado: 'ok' } : prev);
    setUploadFile(null);
    setUploadPreview(false);
    setShowUpload(false);
    toast('success', `127 productos importados al catálogo propio`);
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
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
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
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                    selected.activo
                      ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700 hover:bg-red-900/30 hover:text-red-400 hover:border-red-700'
                      : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-emerald-900/30 hover:text-emerald-400 hover:border-emerald-700'
                  }`}
                >
                  {selected.activo ? 'Activo ✓' : 'Inactivo'}
                </button>
              </div>

              <p className="text-xs text-slate-400">{selected.descripcion}</p>

              {/* Margen */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                  Margen sobre precio de compra (%)
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
                <div className="mt-2 bg-slate-900/60 rounded-lg p-3 text-xs">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Ejemplo: precio compra</span>
                    <span>100,00 €</span>
                  </div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Margen ({editMargen || 0}%)</span>
                    <span>+ {((parseFloat(editMargen) || 0)).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-1">
                    <span>Precio venta al cliente</span>
                    <span>{(100 * (1 + (parseFloat(editMargen) || 0) / 100)).toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Acuerdo */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Estado del acuerdo</label>
                <div className="flex gap-1.5">
                  {(['activo', 'negociando', 'sin_acuerdo'] as AcuerdoEstado[]).map(est => (
                    <button
                      key={est}
                      onClick={() => {
                        setSuppliers(prev => prev.map(s => s.id === selected.id ? { ...s, acuerdo: est } : s));
                        setSelected(prev => prev ? { ...prev, acuerdo: est } : prev);
                      }}
                      className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border cursor-pointer transition-all ${
                        selected.acuerdo === est ? ACUERDO_CFG[est].cls : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {est === 'activo' ? '✓ Activo' : est === 'negociando' ? '⏳ Negociando' : '— Sin acuerdo'}
                    </button>
                  ))}
                </div>
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
                <button className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-300 py-1.5 border border-dashed border-slate-700 rounded-lg transition-colors cursor-pointer">
                  <Eye className="h-3.5 w-3.5" /> Ver {selected.productos.toLocaleString('es-ES')} productos
                </button>
              )}
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
