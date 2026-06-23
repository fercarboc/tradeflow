import React, { useState, useCallback } from 'react';
import {
  TrendingUp, FilePlus, Image as ImageIcon, Users, FileText,
  Package, Calendar, BarChart2, Settings as SettingsIcon,
  Mic, CheckCircle, AlertCircle, Loader2, Sparkles,
  X, Star, Clock, Euro, ArrowRight,
  ScrollText, Plus, ChevronDown, ChevronRight,
  Zap, Phone, Building2, Briefcase, Truck, ArrowUpDown, ToggleRight, ToggleLeft,
  Layers, CreditCard, Send, Eye,
} from 'lucide-react';
import { ActivePage } from '../../types';

interface DemoViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

type NavId =
  | 'dashboard' | 'create_quote' | 'ai_scan'
  | 'crm' | 'invoices' | 'catalog' | 'proveedores'
  | 'planificacion' | 'ingresos' | 'equipo' | 'contratos'
  | 'subcontratas';

const NAV_ITEMS: { id: NavId; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Panel Control',     Icon: TrendingUp },
  { id: 'create_quote',  label: 'Crear Presupuesto', Icon: FilePlus },
  { id: 'ai_scan',       label: 'Escaneo Foto IA',   Icon: ImageIcon },
  { id: 'crm',           label: 'Clientes CRM',      Icon: Users },
  { id: 'invoices',      label: 'Facturación',        Icon: FileText },
  { id: 'catalog',       label: 'Catálogo',           Icon: Package },
  { id: 'proveedores',   label: 'Motor Catálogos',    Icon: Truck },
  { id: 'subcontratas',  label: 'Externalizados',     Icon: Layers },
  { id: 'planificacion', label: 'Planificación',      Icon: Calendar },
  { id: 'ingresos',      label: 'Ingresos',           Icon: BarChart2 },
  { id: 'equipo',        label: 'Equipo',             Icon: Users },
  { id: 'contratos',     label: 'Contratos',          Icon: ScrollText },
];

const SECTION_TITLES: Record<NavId, string> = {
  dashboard:     'Panel de Control',
  create_quote:  'Crear Presupuesto por Voz',
  ai_scan:       'Escáner Fotográfico IA',
  crm:           'Clientes CRM',
  invoices:      'Facturación',
  catalog:       'Catálogo de Precios',
  proveedores:   'Motor de Catálogos de Proveedores',
  subcontratas:  'Trabajos Externalizados',
  planificacion: 'Planificación de Trabajos',
  ingresos:      'Ingresos y Rentabilidad',
  equipo:        'Equipo y Permisos',
  contratos:     'Contratos de Mantenimiento',
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_QUOTES = [
  { id: 1, titulo: 'Instalación cuadro eléctrico trifásico', cliente: 'Juan García', importe: 1850, estado: 'enviado', fecha: 'Hace 2 días' },
  { id: 2, titulo: 'Reparación tubería baño principal', cliente: 'María López', importe: 320, estado: 'aceptado', fecha: 'Hace 1 semana' },
  { id: 3, titulo: 'Pintura salón y habitaciones', cliente: 'Comunidad C/ Mayor 5', importe: 1200, estado: 'borrador', fecha: 'Hoy' },
  { id: 4, titulo: 'Cambio caldera gas 24kW', cliente: 'Pedro Martín', importe: 2800, estado: 'aceptado', fecha: 'Hace 3 días' },
  { id: 5, titulo: 'Aire acondicionado 2x1 split', cliente: 'Oficinas DEMO SL', importe: 4200, estado: 'enviado', fecha: 'Hoy' },
];

const MOCK_CLIENTS = [
  { id: 1, nombre: 'Juan García', telefono: '672 123 456', presupuestos: 3, total: 4200 },
  { id: 2, nombre: 'María López', telefono: '611 987 654', presupuestos: 1, total: 320 },
  { id: 3, nombre: 'Comunidad C/ Mayor 5', telefono: '915 234 567', presupuestos: 2, total: 3800 },
  { id: 4, nombre: 'Pedro Martín', telefono: '645 321 098', presupuestos: 4, total: 8500 },
  { id: 5, nombre: 'Oficinas DEMO SL', telefono: '912 000 111', presupuestos: 2, total: 6300 },
];

const MOCK_INVOICES = [
  { id: 'F-2026-001', titulo: 'Instalación cuadro eléctrico', cliente: 'Juan García', importe: 1850, estado: 'pagada', fecha: '15/04/2026' },
  { id: 'F-2026-002', titulo: 'Cambio caldera gas 24kW', cliente: 'Pedro Martín', importe: 2800, estado: 'pendiente', fecha: '22/04/2026' },
  { id: 'F-2026-003', titulo: 'Pintura salón', cliente: 'Comunidad C/ Mayor 5', importe: 1200, estado: 'vencida', fecha: '01/04/2026' },
  { id: 'F-2026-004', titulo: 'Revisión instalación eléctrica', cliente: 'Oficinas DEMO SL', importe: 890, estado: 'pagada', fecha: '10/04/2026' },
];

const MOCK_CATALOG = [
  { familia: 'Electricidad', items: [
    { desc: 'Hora técnico electricista', precio: 50, unidad: 'h' },
    { desc: 'Punto de luz empotrado', precio: 45, unidad: 'ud' },
    { desc: 'Base enchufe schuko', precio: 35, unidad: 'ud' },
    { desc: 'Interruptor bipolar', precio: 28, unidad: 'ud' },
    { desc: 'Cuadro eléctrico 16 elementos', precio: 180, unidad: 'ud' },
  ]},
  { familia: 'Fontanería', items: [
    { desc: 'Hora fontanero', precio: 50, unidad: 'h' },
    { desc: 'Grifo mezclador cocina', precio: 85, unidad: 'ud' },
    { desc: 'Inodoro suspendido', precio: 220, unidad: 'ud' },
  ]},
  { familia: 'Climatización', items: [
    { desc: 'Hora instalador HVAC', precio: 55, unidad: 'h' },
    { desc: 'Split inverter 2.5kW', precio: 380, unidad: 'ud' },
    { desc: 'Caldera condensación 24kW', precio: 1200, unidad: 'ud' },
  ]},
  { familia: 'Pintura', items: [
    { desc: 'Hora pintor', precio: 32, unidad: 'h' },
    { desc: 'Pintura plástica m²', precio: 8, unidad: 'm²' },
  ]},
];

const MOCK_JOBS = [
  { id: 1, titulo: 'Reforma cocina García', cliente: 'Juan García', fecha: '29/05/2026', estado: 'en_curso', oficio: 'Electricidad', trabajador: 'Carlos M.' },
  { id: 2, titulo: 'Instalación split López', cliente: 'María López', fecha: '30/05/2026', estado: 'pendiente', oficio: 'Climatización', trabajador: 'Sin asignar' },
  { id: 3, titulo: 'Mantenimiento cuadro', cliente: 'Oficinas DEMO SL', fecha: '02/06/2026', estado: 'pendiente', oficio: 'Electricidad', trabajador: 'Carlos M.' },
  { id: 4, titulo: 'Revisión caldera anual', cliente: 'Pedro Martín', fecha: '05/06/2026', estado: 'pendiente', oficio: 'Gas', trabajador: 'Sin asignar' },
];

const MOCK_TEAM = [
  { id: 1, nombre: 'Carlos Méndez', rol: 'Técnico', oficio: 'Electricidad', trabajos: 12 },
  { id: 2, nombre: 'Laura Sánchez', rol: 'Técnico', oficio: 'Fontanería', trabajos: 8 },
  { id: 3, nombre: 'Miguel Torres', rol: 'Admin', oficio: 'Administración', trabajos: 0 },
  { id: 4, nombre: 'Ana Ruiz', rol: 'Técnico', oficio: 'Climatización', trabajos: 5 },
];

const MOCK_CONTRATOS = [
  { id: 1, cliente: 'Oficinas DEMO SL', tipo: 'Mantenimiento integral', frecuencia: 'Mensual', importe: 350, estado: 'activo', proxima: '01/06/2026' },
  { id: 2, cliente: 'Comunidad C/ Mayor 5', tipo: 'Revisión anual caldera', frecuencia: 'Anual', importe: 200, estado: 'activo', proxima: '15/09/2026' },
  { id: 3, cliente: 'Pedro Martín', tipo: 'SAT prioritario', frecuencia: 'A demanda', importe: 100, estado: 'pendiente', proxima: '—' },
];

const MOCK_OBRAMAT_PRODUCTS = [
  { ref: 'OB-ACS-001', desc: 'Termo eléctrico 80L vertical Ariston', familia: 'ACS', coste: 189.50, pvp: 227.40 },
  { ref: 'OB-ACS-002', desc: 'Calentador a gas instantáneo 11L Junkers', familia: 'ACS', coste: 312.00, pvp: 374.40 },
  { ref: 'OB-FON-001', desc: 'Válvula de esfera 1" latón PN16', familia: 'Fontanería', coste: 8.20, pvp: 9.84 },
  { ref: 'OB-FON-002', desc: 'Grifo mezclador monomando cocina Grohe', familia: 'Fontanería', coste: 64.90, pvp: 77.88 },
  { ref: 'OB-ELE-001', desc: 'Cable manguera 2.5mm 100m H07V-K', familia: 'Electricidad', coste: 87.00, pvp: 104.40 },
  { ref: 'OB-ELE-002', desc: 'Cuadro eléctrico 16 elementos Legrand', familia: 'Electricidad', coste: 145.00, pvp: 174.00 },
  { ref: 'OB-CLI-001', desc: 'Split mural 2.5kW inverter Daikin', familia: 'Climatización', coste: 380.00, pvp: 456.00 },
];

const MOCK_PRESUPUESTO_COMPARAR = [
  { id: 1, desc: 'Termo eléctrico 80L vertical', tipo: 'material', cantidad: 1, pvp: 0, supplier_key: '', comparer: true },
  { id: 2, desc: 'Válvula de seguridad 1/2" ACS', tipo: 'material', cantidad: 2, pvp: 12.50, supplier_key: '' },
  { id: 3, desc: 'Mano de obra instalación ACS', tipo: 'mano_de_obra', cantidad: 4, pvp: 50, supplier_key: '' },
  { id: 4, desc: 'Tubo multicapa 16mm rollo 50m', tipo: 'material', cantidad: 1, pvp: 0, supplier_key: '', comparer: true },
];

const EXAMPLE_TEXTS = [
  'Instalación cuadro eléctrico trifásico en nave con 20 puntos de luz y 4 enchufes industriales',
  'Sustitución caldera gas 24kW, termostato nuevo y revisión de 8 radiadores en piso de 90m²',
  'Reforma baño: cambio bañera por plato ducha, alicatado 30m², sanitarios y griferías nuevas',
  'Aire acondicionado split 2x1 de 3kW para salón y habitación con línea frigorífica nueva',
];

const MOCK_AI_RESULT = {
  transcript: '',
  quote: {
    resumen: { tipo_presupuesto: 'Instalación eléctrica', texto_original: '', requiere_revision_general: false, alertas: [] },
    partidas: [
      { concepto: 'Mano de obra técnico electricista', cantidad: 8, unidad: 'h', precio_unitario: 50, total: 400, oficio: 'Electricidad', requiere_revision: false },
      { concepto: 'Cuadro eléctrico 16 elementos', cantidad: 1, unidad: 'ud', precio_unitario: 180, total: 180, oficio: 'Electricidad', requiere_revision: false },
      { concepto: 'Cable manguera 2.5mm (rollo 100m)', cantidad: 1, unidad: 'rollo', precio_unitario: 95, total: 95, oficio: 'Electricidad', requiere_revision: false },
      { concepto: 'Puntos de luz empotrados LED', cantidad: 20, unidad: 'ud', precio_unitario: 45, total: 900, oficio: 'Electricidad', requiere_revision: false },
      { concepto: 'Enchufes schuko industriales', cantidad: 4, unidad: 'ud', precio_unitario: 55, total: 220, oficio: 'Electricidad', requiere_revision: false },
    ],
    calculos: { subtotal: 1795, iva_porcentaje: 21, iva: 376.95, total: 2171.95 },
  },
};

const MOCK_PHOTO_RESULT = {
  quote: {
    descripcion: 'Baño con instalación de fontanería antigua y humedad en paredes',
    partidas: [
      { concepto: 'Revisión y reparación de tuberías', cantidad: 3, unidad: 'h', precio_unitario: 50, total: 150 },
      { concepto: 'Sustitución grifería lavabo', cantidad: 1, unidad: 'ud', precio_unitario: 75, total: 75 },
      { concepto: 'Sellado y impermeabilización', cantidad: 4, unidad: 'm²', precio_unitario: 25, total: 100 },
      { concepto: 'Material fontanería y accesorios', cantidad: 1, unidad: 'lote', precio_unitario: 60, total: 60 },
    ],
    calculos: { subtotal: 385, iva_porcentaje: 21, iva: 80.85, total: 465.85 },
  },
};

// ── Helper components (all top-level) ─────────────────────────────────────────

function Badge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    enviado:   'bg-blue-100 text-blue-700',
    aceptado:  'bg-emerald-100 text-emerald-700',
    borrador:  'bg-slate-100 text-slate-500',
    rechazado: 'bg-red-100 text-red-600',
    pagada:    'bg-emerald-100 text-emerald-700',
    pendiente: 'bg-amber-100 text-amber-700',
    vencida:   'bg-red-100 text-red-600',
    en_curso:  'bg-blue-100 text-blue-700',
    activo:    'bg-emerald-100 text-emerald-700',
  };
  const labels: Record<string, string> = {
    enviado: 'Enviado', aceptado: 'Aceptado', borrador: 'Borrador',
    rechazado: 'Rechazado', pagada: 'Pagada', pendiente: 'Pendiente',
    vencida: 'Vencida', en_curso: 'En curso', activo: 'Activo',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${map[estado] ?? 'bg-slate-100 text-slate-500'}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-3">{children}</h3>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function AIResultPartidas({ partidas, calculos }: {
  partidas: Array<{ concepto: string; cantidad: number; unidad: string; precio_unitario: number; total: number; oficio?: string; requiere_revision?: boolean }>;
  calculos: { subtotal: number; iva_porcentaje: number; iva: number; total: number };
}) {
  return (
    <div className="space-y-3 mt-3">
      <div className="divide-y divide-slate-100">
        {partidas.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{p.concepto}</p>
              <p className="text-xs text-slate-400">{p.cantidad} {p.unidad} × {p.precio_unitario}€</p>
              {p.oficio && <span className="text-[10px] text-blue-500 font-medium">{p.oficio}</span>}
            </div>
            <span className="text-sm font-bold text-slate-700 shrink-0">{p.total.toFixed(2)}€</span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-3 space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Subtotal</span><span>{calculos.subtotal.toFixed(2)}€</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>IVA {calculos.iva_porcentaje}%</span><span>{calculos.iva.toFixed(2)}€</span>
        </div>
        <div className="flex justify-between text-base font-black text-slate-900 pt-1">
          <span>TOTAL</span><span>{calculos.total.toFixed(2)}€</span>
        </div>
      </div>
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────

function ScreenDashboard({ onNav }: { onNav: (id: NavId) => void }) {
  const kpis = [
    { label: 'Presupuestos mes',   value: '18',       icon: FilePlus,  color: 'text-blue-600',   bg: 'bg-blue-50',   sub: '+3 vs mes anterior' },
    { label: 'Pendiente de cobro', value: '8.470€',   icon: Euro,      color: 'text-emerald-600',bg: 'bg-emerald-50',sub: '5 presupuestos' },
    { label: 'Clientes activos',   value: '24',        icon: Users,     color: 'text-violet-600', bg: 'bg-violet-50', sub: '+2 esta semana' },
    { label: 'Facturado abril',    value: '5.200€',   icon: BarChart2, color: 'text-amber-600',  bg: 'bg-amber-50',  sub: '4 facturas cobradas' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className={`h-8 w-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{k.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <SectionTitle>Últimos presupuestos</SectionTitle>
          <button onClick={() => onNav('create_quote')} className="text-xs text-blue-600 font-semibold cursor-pointer hover:text-blue-500 flex items-center gap-1">
            <Plus className="h-3 w-3" /> Nuevo con voz
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_QUOTES.map(q => (
            <div key={q.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="min-w-0 mr-3">
                <p className="text-sm font-semibold text-slate-800 truncate">{q.titulo}</p>
                <p className="text-xs text-slate-400">{q.cliente} · {q.fecha}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-slate-700">{q.importe.toLocaleString('es-ES')}€</span>
                <Badge estado={q.estado} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => onNav('create_quote')} className="flex items-center justify-center gap-2 rounded-xl py-3 bg-[#020B16] text-white text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer">
          <Mic className="h-4 w-4" /> Dictar
        </button>
        <button onClick={() => onNav('ai_scan')} className="flex items-center justify-center gap-2 rounded-xl py-3 bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors cursor-pointer">
          <ImageIcon className="h-4 w-4" /> Foto IA
        </button>
        <button onClick={() => onNav('crm')} className="flex items-center justify-center gap-2 rounded-xl py-3 border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer">
          <Users className="h-4 w-4" /> Clientes
        </button>
      </div>
    </div>
  );
}

function ScreenVoz() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof MOCK_AI_RESULT | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2200));
    setResult({ ...MOCK_AI_RESULT, transcript: text });
    setLoading(false);
  }, [text]);

  const quote = result?.quote;

  return (
    <div className="max-w-xl space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-[#020B16] flex items-center justify-center shrink-0">
            <Mic className="h-4 w-4 text-[#FFC400]" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">Dictar presupuesto</p>
            <p className="text-xs text-slate-400">Describe el trabajo y la IA genera el presupuesto</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ej: Instalación de 5 puntos de luz y 3 enchufes en salón, con caja de distribución nueva..."
          rows={4}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition resize-none"
        />

        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {EXAMPLE_TEXTS.map((t, i) => (
            <button key={i} onClick={() => setText(t)} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md cursor-pointer transition-colors font-medium">
              Ejemplo {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !text.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#020B16] py-3 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando presupuesto...</> : <><Sparkles className="h-4 w-4" /> Generar presupuesto</>}
        </button>
      </Card>

      {loading && (
        <Card className="p-5">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-slate-700">TrabFlow IA procesando...</p>
              <p className="text-xs text-slate-400">Detectando oficios, materiales y tarifas del catálogo</p>
            </div>
          </div>
        </Card>
      )}

      {quote && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-black text-slate-800">Presupuesto generado</span>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
              {quote.resumen.tipo_presupuesto}
            </span>
          </div>
          <AIResultPartidas partidas={quote.partidas} calculos={quote.calculos} />
          <div className="flex gap-2 mt-4">
            <button className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Editar partidas
            </button>
            <button className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold hover:bg-emerald-500 cursor-pointer transition-colors flex items-center justify-center gap-1">
              <Zap className="h-3 w-3" /> Enviar al cliente
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScreenFoto() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof MOCK_PHOTO_RESULT | null>(null);
  const [photoLabel, setPhotoLabel] = useState('');

  const analyze = useCallback(async (label: string) => {
    setLoading(true);
    setResult(null);
    setPhotoLabel(label);
    await new Promise(r => setTimeout(r, 2500));
    setResult(MOCK_PHOTO_RESULT);
    setLoading(false);
  }, []);

  return (
    <div className="max-w-xl space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <ImageIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">Escaneo fotográfico IA</p>
            <p className="text-xs text-slate-400">Sube una foto del trabajo y la IA estima el presupuesto</p>
          </div>
        </div>

        {!result && !loading && (
          <div className="space-y-3">
            <button
              onClick={() => analyze('Foto de baño de ejemplo')}
              className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-8 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center gap-2 text-blue-600">
                <ImageIcon className="h-8 w-8" />
                <p className="text-sm font-bold">Usar foto de ejemplo</p>
                <p className="text-xs text-blue-400">Baño con instalación de fontanería</p>
              </div>
            </button>
            <button
              onClick={() => analyze('Foto subida por el usuario')}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <ImageIcon className="h-4 w-4" /> Subir mi propia foto
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">Analizando imagen con IA...</p>
            <p className="text-xs text-slate-400">Detectando materiales, estado y trabajo necesario</p>
          </div>
        )}
      </Card>

      {result && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-black text-slate-800">Análisis completado</span>
          </div>
          <p className="text-xs text-slate-500 mb-3 italic">"{result.quote.descripcion}"</p>
          <AIResultPartidas partidas={result.quote.partidas} calculos={result.quote.calculos} />
          <div className="flex gap-2 mt-4">
            <button className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Editar
            </button>
            <button onClick={() => setResult(null)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              Nueva foto
            </button>
            <button className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold hover:bg-emerald-500 cursor-pointer transition-colors">
              Enviar al cliente
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScreenClientes() {
  const [search, setSearch] = useState('');
  const filtered = MOCK_CLIENTS.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition"
        />
        <button className="px-4 rounded-xl bg-[#020B16] text-white text-sm font-bold cursor-pointer hover:bg-slate-800 transition-colors flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      </div>
      <Card>
        <div className="divide-y divide-slate-100">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm shrink-0">
                  {c.nombre[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-700">{c.total.toLocaleString('es-ES')}€</p>
                <p className="text-xs text-slate-400">{c.presupuestos} pres.</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScreenFacturacion() {
  const total = MOCK_INVOICES.reduce((s, f) => s + (f.estado === 'pagada' ? f.importe : 0), 0);
  const pending = MOCK_INVOICES.reduce((s, f) => s + (f.estado === 'pendiente' ? f.importe : 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Cobrado</p>
          <p className="text-xl font-black text-emerald-600">{total.toLocaleString('es-ES')}€</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Pendiente</p>
          <p className="text-xl font-black text-amber-600">{pending.toLocaleString('es-ES')}€</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Facturas</p>
          <p className="text-xl font-black text-slate-700">{MOCK_INVOICES.length}</p>
        </Card>
      </div>
      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <SectionTitle>Facturas</SectionTitle>
          <button className="text-xs text-blue-600 font-semibold cursor-pointer flex items-center gap-1">
            <Plus className="h-3 w-3" /> Nueva
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_INVOICES.map(f => (
            <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <p className="text-xs font-mono text-slate-400">{f.id}</p>
                <p className="text-sm font-semibold text-slate-800">{f.titulo}</p>
                <p className="text-xs text-slate-400">{f.cliente} · {f.fecha}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-slate-700">{f.importe.toLocaleString('es-ES')}€</span>
                <Badge estado={f.estado} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScreenCatalogo() {
  const [open, setOpen] = useState<string | null>('Electricidad');
  return (
    <div className="space-y-3 max-w-xl">
      {MOCK_CATALOG.map(fam => (
        <Card key={fam.familia}>
          <button
            onClick={() => setOpen(open === fam.familia ? null : fam.familia)}
            className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-bold text-slate-800">{fam.familia}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{fam.items.length} artículos</span>
              {open === fam.familia ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {open === fam.familia && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {fam.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <span className="text-sm text-slate-700">{item.desc}</span>
                  <span className="text-sm font-bold text-slate-900 shrink-0 ml-4">{item.precio}€/{item.unidad}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
      <button className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-400 hover:text-slate-600 hover:border-slate-300 cursor-pointer transition-colors">
        <Plus className="h-4 w-4" /> Añadir categoría
      </button>
    </div>
  );
}

const DEMO_SUPPLIERS = [
  { key: 'obramat', nombre: 'OBRAMAT',     color: '#E87722', tipo: 'Nacional',   desc: 'Materiales de construcción e instalaciones',  prods: 2847, activo: true,  margen: 20, cats: ['Fontanería', 'Climatización'] },
  { key: 'propio',  nombre: 'Mi Catálogo', color: '#059669', tipo: 'Propio',     desc: 'Tus precios negociados y tarifas propias',     prods: 48,   activo: true,  margen: 0,  cats: ['Gas y calefacción', 'Fontanería'] },
  { key: 'saltoki', nombre: 'Saltoki',     color: '#1A5A96', tipo: 'Nacional',   desc: 'Fontanería, calefacción y climatización',      prods: 0,    activo: false, margen: 18, cats: [] },
  { key: 'sonepar', nombre: 'Sonepar',     color: '#6366f1', tipo: 'Nacional',   desc: 'Distribución eléctrica e industrial',          prods: 0,    activo: false, margen: 15, cats: [] },
  { key: 'vaillant',nombre: 'Vaillant',    color: '#10b981', tipo: 'Fabricante', desc: 'Calefacción, ACS y climatización',             prods: 0,    activo: false, margen: 22, cats: [] },
  { key: 'junkers', nombre: 'Junkers',     color: '#db2777', tipo: 'Fabricante', desc: 'Calderas, calentadores y ACS',                 prods: 0,    activo: false, margen: 22, cats: [] },
];

function ScreenProveedores() {
  const [selected, setSelected] = useState(DEMO_SUPPLIERS[0]);
  const [margenEdit, setMargenEdit] = useState('20');
  const [compareOpen, setCompareOpen] = useState<number | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<Record<number, { pvp: number; supplier: string }>>({});

  const compareOptions = [
    { supplier: 'OBRAMAT', ref: 'OB-ACS-001', desc: 'Termo eléctrico 80L vertical Ariston', coste: 189.50, pvp: 227.40, logo: true },
    { supplier: 'Mi catálogo', ref: 'MC-ACS-080', desc: 'Termo 80L (tarifa negociada)', coste: 165.00, pvp: 198.00, logo: false },
  ];
  const compareOptionsTubo = [
    { supplier: 'OBRAMAT', ref: 'OB-FON-016', desc: 'Tubo multicapa PE-RT/AL 16mm 50m', coste: 48.90, pvp: 58.68, logo: true },
    { supplier: 'Mi catálogo', ref: null, desc: 'Sin precio asignado', coste: 0, pvp: 0, logo: false },
  ];
  const CATS_TRADE = ['Fontanería','Electricidad','Climatización','Gas y calefacción','Carpintería','Pintura','Albañilería','Reformas baño','Reformas cocina'];
  const margenNum = parseFloat(margenEdit) || 0;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header azul */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base">Motor de Catálogos</h2>
            <p className="text-blue-200 text-[11px]">La IA usa los precios reales de tus proveedores al generar presupuestos.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Activos', value: '2', color: 'text-emerald-300' },
            { label: 'Productos', value: '2.895', color: 'text-blue-200' },
            { label: 'Ahorro est.', value: '~12%', color: 'text-orange-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
              <div className={`text-lg font-black leading-none ${color}`}>{value}</div>
              <div className="text-blue-300 text-[9px] mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-4">

        {/* Left: supplier list */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Proveedores</p>
          {DEMO_SUPPLIERS.map(sup => {
            const isSelected = selected.key === sup.key;
            return (
              <button
                key={sup.key}
                onClick={() => { setSelected(sup); setMargenEdit(String(sup.margen)); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                  isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black"
                  style={{ backgroundColor: sup.color + '22', border: `1.5px solid ${sup.color}55` }}
                >
                  <span style={{ color: sup.color }}>{sup.nombre.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">{sup.nombre}</span>
                    {sup.key === 'propio' && <span className="text-[8px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">MÍO</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {sup.prods > 0 && <span className="text-[9px] text-slate-400">{sup.prods.toLocaleString('es-ES')} prods</span>}
                    {sup.cats.length > 0 && <span className="flex items-center gap-0.5 text-[9px] text-amber-600"><Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />{sup.cats.length}</span>}
                    {!sup.activo && <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 rounded-full">inactivo</span>}
                  </div>
                </div>
                {sup.activo
                  ? <ToggleRight className="h-6 w-6 text-emerald-500 shrink-0" />
                  : <ToggleLeft className="h-6 w-6 text-slate-300 shrink-0" />
                }
              </button>
            );
          })}
        </div>

        {/* Right: detail panel */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="border-t-4 border-b border-slate-100 px-5 py-4" style={{ borderTopColor: selected.color }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0" style={{ backgroundColor: selected.color + '22', border: `2px solid ${selected.color}55` }}>
                  <span style={{ color: selected.color }}>{selected.nombre.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">{selected.nombre}</h3>
                  <p className="text-[10px] text-slate-400">{selected.tipo}{selected.key === 'propio' ? ' · Catálogo personalizado' : ''}</p>
                </div>
              </div>
              <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${selected.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {selected.activo ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                {selected.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">{selected.desc}</p>
          </div>

          <div className="p-5 space-y-5">
            {/* Margen */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2.5">Mi margen sobre precio de compra</p>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <input
                    type="number" min={0} max={200} step={0.5}
                    value={margenEdit}
                    onChange={e => setMargenEdit(e.target.value)}
                    className="w-24 bg-white border-2 border-slate-200 focus:border-blue-400 rounded-lg pl-3 pr-7 py-2 text-sm font-bold text-slate-800 focus:outline-none text-center"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
                <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer">Guardar</button>
                <span className="text-[10px] text-slate-400">
                  Coste 100€ → <strong className="text-slate-700">{(100 * (1 + margenNum / 100)).toFixed(0)}€</strong> venta
                </span>
              </div>
            </div>

            {/* Preferido */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Proveedor preferido para</p>
              </div>
              <p className="text-[10px] text-slate-400 mb-2.5">La IA priorizará este proveedor en las categorías marcadas</p>
              <div className="flex flex-wrap gap-1.5">
                {CATS_TRADE.map(tc => {
                  const active = selected.cats.includes(tc);
                  return (
                    <span
                      key={tc}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                        active ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {active && <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" />}
                      {tc}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Productos */}
            {selected.prods > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity border"
                  style={{ backgroundColor: selected.color + '10', borderColor: selected.color + '30' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: selected.color + '22' }}>
                      <Package className="w-4 h-4" style={{ color: selected.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{selected.prods.toLocaleString('es-ES')} referencias</p>
                      <p className="text-[9px] text-slate-400">Precios de coste · con tu margen aplicado</p>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            )}

            {/* Comparador demo */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Comparador en presupuesto</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Instalación ACS — demo IA</p>
                {MOCK_PRESUPUESTO_COMPARAR.slice(0, 4).map(item => {
                  const sel = selectedPrices[item.id];
                  const displayPvp = sel ? sel.pvp : item.pvp;
                  const opts = item.id === 1 ? compareOptions : item.id === 4 ? compareOptionsTubo : null;
                  return (
                    <div key={item.id}>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${compareOpen === item.id ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 font-medium truncate">{item.desc}</p>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.tipo === 'mano_de_obra' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {item.tipo === 'mano_de_obra' ? 'Mano de obra' : 'Material'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {displayPvp > 0
                            ? <span className="text-xs font-bold text-slate-900 font-mono">{displayPvp.toFixed(2)} €</span>
                            : <span className="text-xs text-red-400 font-semibold">Sin precio</span>
                          }
                          {opts && item.tipo === 'material' && (
                            <button
                              onClick={() => setCompareOpen(compareOpen === item.id ? null : item.id)}
                              className={`p-1 rounded cursor-pointer transition-colors ${compareOpen === item.id ? 'bg-amber-200 text-amber-700' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {compareOpen === item.id && opts && (
                        <div className="mx-1 mb-1 border border-amber-200 rounded-b-xl overflow-hidden bg-white shadow-sm">
                          {opts.map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => { if (opt.pvp > 0) setSelectedPrices(p => ({ ...p, [item.id]: { pvp: opt.pvp, supplier: opt.supplier } })); setCompareOpen(null); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-amber-50 transition-colors cursor-pointer ${oi < opts.length - 1 ? 'border-b border-slate-100' : ''}`}
                            >
                              <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                {opt.logo ? <img src="/logoobramat.png" alt="OB" className="h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} /> : <Package className="h-3 w-3 text-slate-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-700 truncate">{opt.desc}</p>
                                <p className="text-[9px] text-slate-400">{opt.supplier}{opt.ref ? ` · ${opt.ref}` : ''}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {opt.pvp > 0
                                  ? <><p className="text-xs font-black text-slate-900">{opt.pvp.toFixed(2)} €</p><p className="text-[9px] text-slate-400">coste {opt.coste.toFixed(2)} €</p></>
                                  : <p className="text-[10px] text-slate-400">Sin precio</p>
                                }
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_EXTERNALIZADOS = [
  {
    id: 1, descripcion: 'Instalación fontanería baño principal',
    empresa: 'Pedro García Fontanería S.L.', telefono: '612 345 678',
    estado: 'en_curso', coste: 850, precio: 1100,
    trabajo: 'Reforma baño completo — Calle Mayor 12',
    fecha: '2026-06-18',
  },
  {
    id: 2, descripcion: 'Trabajo eléctrico cuadro trifásico',
    empresa: 'ElectroSuárez', telefono: '654 321 987',
    estado: 'completado', coste: 620, precio: 780,
    trabajo: 'Instalación industrial — Polígono Cerro',
    fecha: '2026-06-10',
  },
  {
    id: 3, descripcion: 'Pintura interior salón y habitaciones',
    empresa: 'Pinturas Díaz Hermanos', telefono: '691 234 567',
    estado: 'presupuesto_recibido', coste: 480, precio: 630,
    trabajo: 'Reforma integral piso 3B',
    fecha: '2026-06-22',
  },
  {
    id: 4, descripcion: 'Carpintería armarios empotrados',
    empresa: 'Muebles Carpintería Norte', telefono: '666 789 012',
    estado: 'pendiente', coste: 1200, precio: 0,
    trabajo: 'Reforma cocina completa',
    fecha: '2026-06-25',
  },
];

const ESTADO_EXT: Record<string, { label: string; cls: string }> = {
  pendiente:            { label: 'Borrador',          cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  solicitado:           { label: 'Solicitado',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  presupuesto_recibido: { label: 'Ppto. recibido',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_curso:             { label: 'En curso',           cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  completado:           { label: 'Finalizado',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pagado:               { label: 'Pagado',             cls: 'bg-green-50 text-green-700 border-green-200' },
};

function ScreenExternalizados() {
  const [selected, setSelected] = useState<typeof MOCK_EXTERNALIZADOS[0] | null>(null);

  const totalCoste = MOCK_EXTERNALIZADOS.reduce((a, e) => a + e.coste, 0);
  const totalPrecio = MOCK_EXTERNALIZADOS.filter(e => e.precio > 0).reduce((a, e) => a + e.precio, 0);
  const margenTotal = totalPrecio > 0 ? ((totalPrecio - MOCK_EXTERNALIZADOS.filter(e => e.precio > 0).reduce((a, e) => a + e.coste, 0)) / totalPrecio * 100).toFixed(0) : 0;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base">Trabajos Externalizados</h2>
            <p className="text-slate-300 text-[11px]">
              Gestiona los trabajos que subcontratas a otros profesionales. Controla costes, márgenes y estados sin que el cliente lo vea.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Activos', value: '2', color: 'text-blue-300' },
            { label: 'Coste total', value: `${totalCoste.toLocaleString('es-ES')} €`, color: 'text-slate-300' },
            { label: 'Margen medio', value: `${margenTotal}%`, color: 'text-emerald-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/8 rounded-xl p-3 text-center">
              <div className={`text-base font-black leading-none ${color}`}>{value}</div>
              <div className="text-slate-400 text-[9px] mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nota importante */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Privado:</strong> el cliente solo ve "partida de obra" en su presupuesto. Nunca aparece el nombre del proveedor ni el coste real.
        </p>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

        {/* List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trabajos externalizados</p>
            <button className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
              <Plus className="h-3 w-3" /> Añadir
            </button>
          </div>
          {MOCK_EXTERNALIZADOS.map(ext => {
            const est = ESTADO_EXT[ext.estado] ?? { label: ext.estado, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
            const isSelected = selected?.id === ext.id;
            const margenExt = ext.precio > 0 ? ((ext.precio - ext.coste) / ext.precio * 100).toFixed(0) : null;
            return (
              <button
                key={ext.id}
                onClick={() => setSelected(isSelected ? null : ext)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected ? 'border-slate-400 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{ext.descripcion}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[9px] text-slate-400 truncate">{ext.empresa}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${est.cls}`}>{est.label}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-800">{ext.coste.toLocaleString('es-ES')} €</p>
                  {margenExt && (
                    <p className="text-[9px] text-emerald-600 font-semibold">+{margenExt}% margen</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center min-h-[300px]">
              <div>
                <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">Selecciona un trabajo</p>
                <p className="text-xs text-slate-300 mt-1">para ver su detalle y acciones</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="border-t-4 border-slate-800 border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">{selected.descripcion}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{selected.trabajo}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border shrink-0 ${(ESTADO_EXT[selected.estado] ?? { cls: '' }).cls}`}>
                    {(ESTADO_EXT[selected.estado] ?? { label: selected.estado }).label}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-4">

                {/* Proveedor */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Proveedor externo</p>
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{selected.empresa}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {selected.telefono}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Costes */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Costes e ingresos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Mi coste</p>
                      <p className="text-lg font-black text-red-500">{selected.coste.toLocaleString('es-ES')} €</p>
                      <p className="text-[9px] text-slate-400">Lo que pago al proveedor</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Al cliente</p>
                      {selected.precio > 0 ? (
                        <>
                          <p className="text-lg font-black text-emerald-600">{selected.precio.toLocaleString('es-ES')} €</p>
                          <p className="text-[9px] text-emerald-500 font-semibold">
                            +{((selected.precio - selected.coste) / selected.precio * 100).toFixed(0)}% margen
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-slate-400 mt-2">Pte. presupuesto</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer">
                    <ChevronRight className="h-3.5 w-3.5" /> Avanzar estado
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl cursor-pointer transition-colors">
                      <Send className="h-3 w-3" /> WhatsApp
                    </button>
                    <button className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl cursor-pointer transition-colors">
                      <CreditCard className="h-3 w-3" /> Registrar pago
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScreenPlanificacion() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button className="px-4 py-2.5 rounded-xl bg-[#020B16] text-white text-sm font-bold cursor-pointer hover:bg-slate-800 transition-colors flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo trabajo
        </button>
      </div>
      <Card>
        <div className="px-5 py-3 border-b border-slate-100">
          <SectionTitle>Trabajos programados</SectionTitle>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_JOBS.map(j => (
            <div key={j.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{j.titulo}</p>
                  <p className="text-xs text-slate-400">{j.cliente} · {j.fecha}</p>
                  <p className="text-xs text-slate-500">{j.trabajador}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-400 font-medium">{j.oficio}</span>
                <Badge estado={j.estado} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScreenIngresos() {
  const months = [
    { mes: 'Ene', valor: 3200 },
    { mes: 'Feb', valor: 4100 },
    { mes: 'Mar', valor: 3800 },
    { mes: 'Abr', valor: 5200 },
    { mes: 'May', valor: 4800 },
  ];
  const max = Math.max(...months.map(m => m.valor));
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Este mes</p>
          <p className="text-xl font-black text-emerald-600">4.800€</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">+7% vs anterior</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Ticket medio</p>
          <p className="text-xl font-black text-blue-600">960€</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Conversión</p>
          <p className="text-xl font-black text-violet-600">72%</p>
          <p className="text-[10px] text-violet-400 mt-0.5">de enviados</p>
        </Card>
      </div>
      <Card className="p-5">
        <SectionTitle>Facturación mensual</SectionTitle>
        <div className="flex items-end gap-3 h-32 mt-2">
          {months.map(m => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-slate-600">{(m.valor / 1000).toFixed(1)}k</span>
              <div
                className="w-full rounded-t-md bg-blue-500"
                style={{ height: `${(m.valor / max) * 80}px` }}
              />
              <span className="text-[10px] text-slate-400">{m.mes}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle>Ingresos por oficio</SectionTitle>
        <div className="space-y-2">
          {[
            { oficio: 'Electricidad', pct: 45, color: 'bg-amber-400' },
            { oficio: 'Climatización', pct: 30, color: 'bg-blue-400' },
            { oficio: 'Fontanería', pct: 15, color: 'bg-emerald-400' },
            { oficio: 'Pintura', pct: 10, color: 'bg-violet-400' },
          ].map(o => (
            <div key={o.oficio}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-600 font-medium">{o.oficio}</span>
                <span className="text-slate-400">{o.pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${o.color}`} style={{ width: `${o.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScreenEquipo() {
  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-3">
        <button className="px-4 py-2.5 rounded-xl bg-[#020B16] text-white text-sm font-bold cursor-pointer hover:bg-slate-800 transition-colors flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Invitar miembro
        </button>
      </div>
      <Card>
        <div className="divide-y divide-slate-100">
          {MOCK_TEAM.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {m.nombre[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.nombre}</p>
                  <p className="text-xs text-slate-400">{m.oficio}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">{m.trabajos} trabajos</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  m.rol === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                }`}>{m.rol}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-slate-400 text-center">Plan Empresa+ · Hasta <strong className="text-slate-700">15 usuarios</strong> · {4 - MOCK_TEAM.length} plazas disponibles</p>
      </Card>
    </div>
  );
}

function ScreenContratos() {
  const mrr = MOCK_CONTRATOS.filter(c => c.estado === 'activo').reduce((s, c) => s + (c.frecuencia === 'Mensual' ? c.importe : c.importe / 12), 0);
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Contratos activos</p>
          <p className="text-xl font-black text-emerald-600">{MOCK_CONTRATOS.filter(c => c.estado === 'activo').length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Ingresos recurrentes</p>
          <p className="text-xl font-black text-blue-600">{Math.round(mrr)}€/mes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Próximas visitas</p>
          <p className="text-xl font-black text-amber-600">2</p>
        </Card>
      </div>
      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <SectionTitle>Contratos de mantenimiento</SectionTitle>
          <button className="text-xs text-blue-600 font-semibold cursor-pointer flex items-center gap-1">
            <Plus className="h-3 w-3" /> Nuevo
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {MOCK_CONTRATOS.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <p className="text-sm font-semibold text-slate-800">{c.cliente}</p>
                <p className="text-xs text-slate-400">{c.tipo} · {c.frecuencia}</p>
                <p className="text-xs text-slate-400">Próxima visita: {c.proxima}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-slate-700">{c.importe}€</span>
                <Badge estado={c.estado} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Mobile screens ────────────────────────────────────────────────────────────

type MobileTab = 'inicio' | 'presupuestos' | 'clientes' | 'catalogo' | 'trabajos' | 'ajustes';

function MobInicio({ onFab }: { onFab: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Pdte. cobro', value: '8.470€', color: 'text-emerald-400' },
          { label: 'Este mes', value: '18 pres.', color: 'text-blue-400' },
          { label: 'Clientes', value: '24', color: 'text-violet-400' },
          { label: 'Fact. cobradas', value: '5.200€', color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-xs font-bold text-white">Últimos trabajos</span>
          <button onClick={onFab} className="text-[10px] text-blue-400 font-semibold cursor-pointer">+ Nuevo</button>
        </div>
        {MOCK_QUOTES.slice(0, 4).map(q => (
          <div key={q.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 active:bg-white/5 cursor-pointer">
            <div className="min-w-0 mr-2">
              <p className="text-sm font-semibold text-white truncate">{q.titulo}</p>
              <p className="text-[10px] text-slate-400">{q.cliente}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-white">{q.importe.toLocaleString('es-ES')}€</p>
              <Badge estado={q.estado} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobPresupuestos() {
  return (
    <div className="space-y-3">
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        {MOCK_QUOTES.map(q => (
          <div key={q.id} className="flex items-center justify-between px-4 py-4 border-b border-white/5 last:border-0 cursor-pointer active:bg-white/5">
            <div className="min-w-0 mr-2">
              <p className="text-sm font-semibold text-white truncate">{q.titulo}</p>
              <p className="text-[10px] text-slate-400">{q.cliente} · {q.fecha}</p>
            </div>
            <div className="shrink-0 text-right space-y-1">
              <p className="text-sm font-bold text-white">{q.importe.toLocaleString('es-ES')}€</p>
              <Badge estado={q.estado} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobClientes() {
  const [search, setSearch] = useState('');
  const filtered = MOCK_CLIENTS.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        {filtered.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-4 border-b border-white/5 last:border-0 cursor-pointer active:bg-white/5">
            <div className="h-10 w-10 rounded-xl bg-blue-600/30 flex items-center justify-center font-bold text-blue-300 text-sm shrink-0">
              {c.nombre[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
              <p className="text-[10px] text-slate-400">{c.telefono}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-white">{c.total.toLocaleString('es-ES')}€</p>
              <p className="text-[10px] text-slate-400">{c.presupuestos} pres.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobCatalogo() {
  const [open, setOpen] = useState<string | null>('Electricidad');
  return (
    <div className="space-y-2">
      {MOCK_CATALOG.map(fam => (
        <div key={fam.familia} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setOpen(open === fam.familia ? null : fam.familia)}
            className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer active:bg-white/5"
          >
            <span className="text-sm font-bold text-white">{fam.familia}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{fam.items.length} artículos</span>
              {open === fam.familia ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {open === fam.familia && (
            <div className="border-t border-white/10">
              {fam.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-300">{item.desc}</span>
                  <span className="text-sm font-bold text-white shrink-0 ml-2">{item.precio}€/{item.unidad}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MobTrabajos() {
  return (
    <div className="space-y-3">
      {MOCK_JOBS.map(j => (
        <div key={j.id} className="bg-white/5 rounded-2xl border border-white/10 p-4 cursor-pointer active:bg-white/10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">{j.titulo}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{j.cliente}</p>
            </div>
            <Badge estado={j.estado} />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Calendar className="h-3 w-3" /> {j.fecha}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Users className="h-3 w-3" /> {j.trabajador}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobAjustes({ setCurrentPage }: { setCurrentPage: (p: ActivePage) => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white">TF</div>
        <div>
          <p className="text-sm font-bold text-white">Demo TrabFlow</p>
          <p className="text-[10px] text-[#FFC400] font-bold uppercase">Plan Empresa+</p>
        </div>
      </div>
      {[
        { label: 'Empresa y datos fiscales', icon: Building2 },
        { label: 'Tarifas y catálogo', icon: Package },
        { label: 'Equipo y permisos', icon: Users },
        { label: 'Notificaciones', icon: Mic },
      ].map(item => (
        <div key={item.label} className="bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between px-4 py-4 cursor-pointer active:bg-white/10">
          <div className="flex items-center gap-3">
            <item.icon className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-white">{item.label}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </div>
      ))}
      <button
        onClick={() => setCurrentPage(ActivePage.Registro)}
        className="w-full rounded-2xl bg-[#FFC400] text-[#020B16] py-4 text-sm font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all flex items-center justify-center gap-2"
      >
        <Star className="h-4 w-4" /> Registrarme gratis · 15 días
      </button>
    </div>
  );
}

function MobVozSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof MOCK_AI_RESULT | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2200));
    setResult({ ...MOCK_AI_RESULT, transcript: text });
    setLoading(false);
  }, [text]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <Mic className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800">Dictar presupuesto</p>
          <p className="text-[10px] text-slate-400">IA genera el presupuesto al instante</p>
        </div>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-4 w-4" /></button>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe el trabajo..."
        rows={3}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 resize-none"
      />

      <div className="flex flex-wrap gap-1">
        {EXAMPLE_TEXTS.slice(0, 2).map((t, i) => (
          <button key={i} onClick={() => setText(t)} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md cursor-pointer font-medium">Ejemplo {i + 1}</button>
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !text.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#020B16] py-3 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</> : <><Sparkles className="h-4 w-4" /> Generar presupuesto</>}
      </button>

      {result && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-800">Presupuesto generado</span>
          </div>
          <AIResultPartidas partidas={result.quote.partidas} calculos={result.quote.calculos} />
        </div>
      )}
    </div>
  );
}

function MobFotoSheet({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof MOCK_PHOTO_RESULT | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2500));
    setResult(MOCK_PHOTO_RESULT);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800">Escaneo Foto IA</p>
          <p className="text-[10px] text-slate-400">Sube una foto y la IA presupuesta</p>
        </div>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-4 w-4" /></button>
      </div>

      {!result && !loading && (
        <button
          onClick={analyze}
          className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-8 cursor-pointer hover:bg-blue-100 transition-colors"
        >
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <ImageIcon className="h-8 w-8" />
            <p className="text-sm font-bold">Foto de ejemplo — Baño</p>
            <p className="text-xs text-blue-400">Pulsa para analizar con IA</p>
          </div>
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold text-slate-700">Analizando imagen...</p>
        </div>
      )}

      {result && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-800">Análisis completado</span>
          </div>
          <p className="text-xs text-slate-400 italic mb-2">"{result.quote.descripcion}"</p>
          <AIResultPartidas partidas={result.quote.partidas} calculos={result.quote.calculos} />
        </div>
      )}
    </div>
  );
}

type FabAction = 'voz' | 'foto' | null;

function DemoMobileShell({ setCurrentPage, onSwitchToDesktop }: {
  setCurrentPage: (p: ActivePage) => void;
  onSwitchToDesktop: () => void;
}) {
  const [tab, setTab] = useState<MobileTab>('inicio');
  const [fabOpen, setFabOpen] = useState(false);
  const [fabAction, setFabAction] = useState<FabAction>(null);

  const openFab = useCallback((action?: FabAction) => {
    setFabAction(action ?? null);
    setFabOpen(true);
  }, []);

  const closeFab = useCallback(() => {
    setFabOpen(false);
    setFabAction(null);
  }, []);

  function renderTab() {
    switch (tab) {
      case 'inicio':        return <MobInicio onFab={() => openFab()} />;
      case 'presupuestos':  return <MobPresupuestos />;
      case 'clientes':      return <MobClientes />;
      case 'catalogo':      return <MobCatalogo />;
      case 'trabajos':      return <MobTrabajos />;
      case 'ajustes':       return <MobAjustes setCurrentPage={setCurrentPage} />;
    }
  }

  const tabItems: { id: MobileTab; label: string; Icon: React.ElementType }[] = [
    { id: 'inicio',       label: 'Inicio',       Icon: TrendingUp },
    { id: 'trabajos',     label: 'Trabajos',     Icon: Briefcase },
    { id: 'clientes',     label: 'Clientes',     Icon: Users },
    { id: 'catalogo',     label: 'Catálogo',     Icon: Package },
    { id: 'presupuestos', label: 'Presupuestos', Icon: FileText },
    { id: 'ajustes',      label: 'Ajustes',      Icon: SettingsIcon },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0B0F14] text-white relative overflow-hidden">

      {/* Top bar */}
      <div className="bg-[#0B0F14] border-b border-white/5 flex items-center justify-between px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <span className="text-white font-black text-[10px]">TF</span>
          </div>
          <div>
            <span className="text-white font-black text-sm">TrabFlow <span className="text-blue-400">AI</span></span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-[#FFC400] rounded-full inline-block" />
              <span className="text-[8px] text-[#FFC400] font-bold uppercase tracking-wider">Demo · Empresa+</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(ActivePage.Home)}
            className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-1 rounded-lg border border-white/10 hover:border-white/25 transition-colors"
          >
            ← Sitio web
          </button>
          <button
            onClick={() => setCurrentPage(ActivePage.Registro)}
            className="px-3 py-1.5 rounded-xl bg-[#FFC400] text-[#020B16] text-[10px] font-black uppercase cursor-pointer hover:brightness-110"
          >
            Registrarme
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-24">
        {renderTab()}
      </div>

      {/* FAB overlay */}
      {fabOpen && (
        <>
          <div className="absolute inset-0 bg-black/60 z-40" onClick={closeFab} />
          <div className="absolute bottom-20 left-0 right-0 bg-white rounded-t-3xl p-5 z-50 shadow-2xl max-h-[80%] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            {fabAction === 'voz' && <MobVozSheet onClose={closeFab} />}
            {fabAction === 'foto' && <MobFotoSheet onClose={closeFab} />}
            {!fabAction && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Nuevo presupuesto rápido</p>
                <button
                  onClick={() => setFabAction('voz')}
                  className="w-full flex items-center gap-3 bg-[#020B16] text-white font-bold p-4 rounded-2xl cursor-pointer"
                >
                  <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Dictar presupuesto</p>
                    <p className="text-[10px] text-slate-400">Escribe y la IA genera en segundos</p>
                  </div>
                </button>
                <button
                  onClick={() => setFabAction('foto')}
                  className="w-full flex items-center gap-3 bg-blue-600 text-white font-bold p-4 rounded-2xl cursor-pointer"
                >
                  <div className="h-9 w-9 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Escaneo Foto IA</p>
                    <p className="text-[10px] text-blue-200">Sube una foto del trabajo</p>
                  </div>
                </button>
                <button onClick={closeFab} className="w-full text-slate-400 text-sm py-2 cursor-pointer">Cancelar</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom tab bar + FAB */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {/* FAB button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10">
          <button
            onClick={() => openFab()}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-xl border-4 border-[#0B0F14] transition-transform active:scale-95 cursor-pointer"
          >
            {fabOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-[#0B0F14] border-t border-white/5 flex items-stretch" style={{ minHeight: '60px' }}>
          {tabItems.slice(0, 3).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 cursor-pointer transition-colors ${tab === id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-semibold">{label}</span>
            </button>
          ))}
          {/* Center gap for FAB */}
          <div className="w-14 shrink-0" />
          {tabItems.slice(3).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 cursor-pointer transition-colors ${tab === id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main DemoView ─────────────────────────────────────────────────────────────

export default function DemoView({ setCurrentPage }: DemoViewProps) {
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const handleNav = useCallback((id: NavId) => {
    setActiveNav(id);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, []);

  function renderScreen() {
    switch (activeNav) {
      case 'dashboard':     return <ScreenDashboard onNav={handleNav} />;
      case 'create_quote':  return <ScreenVoz />;
      case 'ai_scan':       return <ScreenFoto />;
      case 'crm':           return <ScreenClientes />;
      case 'invoices':      return <ScreenFacturacion />;
      case 'catalog':       return <ScreenCatalogo />;
      case 'proveedores':   return <ScreenProveedores />;
      case 'subcontratas':  return <ScreenExternalizados />;
      case 'planificacion': return <ScreenPlanificacion />;
      case 'ingresos':      return <ScreenIngresos />;
      case 'equipo':        return <ScreenEquipo />;
      case 'contratos':     return <ScreenContratos />;
    }
  }

  // Mobile view: phone frame on large screens, full-screen on mobile
  if (viewMode === 'mobile') {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-200">
        {/* On large screens: centered phone frame */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-12 p-8">
          <div className="w-[300px] rounded-[40px] overflow-hidden border-8 border-slate-800 shadow-2xl bg-[#0B0F14] relative shrink-0" style={{ height: 'min(640px, calc(100vh - 64px))' }}>
            <DemoMobileShell setCurrentPage={setCurrentPage} onSwitchToDesktop={() => setViewMode('desktop')} />
          </div>
          <div className="max-w-xs space-y-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demo móvil</span>
              <h2 className="text-2xl font-black text-slate-800 mt-1">La app en tu bolsillo</h2>
              <p className="text-sm text-slate-500 mt-2">Genera presupuestos por voz, escanea fotos con IA y gestiona tus trabajos desde cualquier lugar.</p>
            </div>
            <div className="space-y-2">
              {['Presupuesto por voz en 10 segundos', 'Foto → presupuesto con IA', 'Clientes, trabajos y catálogo', 'Funciona sin conexión'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => setViewMode('desktop')}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            >
              ← Ver demo de escritorio
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="w-full rounded-xl bg-[#FFC400] text-[#020B16] py-3 text-sm font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Star className="h-4 w-4" /> Registrarme gratis · 15 días
            </button>
          </div>
        </div>
        {/* On mobile/tablet: full screen */}
        <div className="lg:hidden flex-1">
          <DemoMobileShell setCurrentPage={setCurrentPage} onSwitchToDesktop={() => setViewMode('desktop')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">

      {/* ── Barra de navegación web — siempre visible ── */}
      <div className="shrink-0 bg-[#020B16] border-b border-white/10 flex items-center justify-between px-4 py-2.5 z-50">
        <button
          onClick={() => setCurrentPage(ActivePage.Home)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <img src="/tradeflow.png" alt="TrabFlow" className="h-5 w-auto" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          <span className="text-white font-black text-xs tracking-widest uppercase group-hover:text-[#00CFE8] transition-colors">TRABFLOW</span>
        </button>
        <nav className="hidden sm:flex items-center gap-1">
          {([
            [ActivePage.Home, 'Inicio'],
            [ActivePage.ComoFunciona, 'Funciones'],
            [ActivePage.Precios, 'Precios'],
            [ActivePage.Contacto, 'Contacto'],
          ] as [ActivePage, string][]).map(([page, label]) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className="px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="text-[11px] font-semibold text-white/60 hover:text-white transition-colors cursor-pointer px-3 py-1.5 hidden sm:block"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setCurrentPage(ActivePage.Registro)}
            className="px-3 py-1.5 rounded-lg bg-[#FFC400] text-[#020B16] text-[11px] font-black uppercase cursor-pointer hover:brightness-110 transition-all"
          >
            Registrarse
          </button>
        </div>
      </div>

      {/* ── Contenido demo ── */}
      <div className="flex flex-1 overflow-hidden">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-40 md:z-auto
        flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 shrink-0
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
              TF
            </div>
            <div>
              <span className="font-black text-xs text-white block uppercase tracking-wide">TrabFlow</span>
              <span className="text-[9px] text-[#FFC400] font-bold uppercase tracking-wider">Demo · Empresa+</span>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white cursor-pointer" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeNav === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {id === 'contratos' && (
                <span className="ml-auto text-[8px] font-black bg-[#FFC400]/20 text-[#FFC400] border border-[#FFC400]/30 px-1.5 py-0.5 rounded-full uppercase">E+</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFC400]/20 text-[#FFC400] border border-[#FFC400]/30">
              Empresa+
            </span>
            <span className="text-[9px] text-emerald-400 font-bold">Demo activa</span>
          </div>
          <button
            onClick={() => setViewMode('mobile')}
            className="w-full text-[10px] font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg py-2 cursor-pointer transition-colors"
          >
            📱 Ver demo móvil
          </button>
          <button
            onClick={() => setCurrentPage(ActivePage.Registro)}
            className="w-full text-[10px] font-bold bg-gradient-to-r from-[#FFC400] to-amber-500 text-[#020B16] rounded-lg py-2 cursor-pointer hover:brightness-110 transition-all"
          >
            Registrarme gratis 15 días
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block">TrabFlow AI · Demo interactiva</span>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight truncate">
                {SECTION_TITLES[activeNav]}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setViewMode('mobile')}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
              📱 Demo móvil
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Home)}
              className="hidden sm:flex text-xs text-slate-400 hover:text-slate-700 cursor-pointer transition-colors items-center gap-1"
            >
              ← Volver
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="px-4 py-2 rounded-xl bg-[#FFC400] text-[#020B16] text-xs font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              <Star className="h-3.5 w-3.5" /> Registrarme gratis
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {renderScreen()}
        </div>
      </div>

      </div>{/* end ── Contenido demo ── */}
    </div>
  );
}
