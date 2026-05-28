import React, { useState, useCallback } from 'react';
import {
  TrendingUp, FilePlus, Image as ImageIcon, Users, FileText,
  Package, Calendar, BarChart2, Settings as SettingsIcon,
  Mic, CheckCircle, AlertCircle, Loader2, Sparkles,
  X, Star, Clock, Euro, ArrowRight,
  ScrollText, Plus, ChevronDown, ChevronRight,
  Zap, Phone, Building2, Briefcase,
} from 'lucide-react';
import { ActivePage } from '../../types';

interface DemoViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

type NavId =
  | 'dashboard' | 'create_quote' | 'ai_scan'
  | 'crm' | 'invoices' | 'catalog'
  | 'planificacion' | 'ingresos' | 'equipo' | 'contratos';

const NAV_ITEMS: { id: NavId; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Panel Control',     Icon: TrendingUp },
  { id: 'create_quote',  label: 'Crear Presupuesto', Icon: FilePlus },
  { id: 'ai_scan',       label: 'Escaneo Foto IA',   Icon: ImageIcon },
  { id: 'crm',           label: 'Clientes CRM',      Icon: Users },
  { id: 'invoices',      label: 'Facturación',        Icon: FileText },
  { id: 'catalog',       label: 'Catálogo',           Icon: Package },
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
            onClick={onSwitchToDesktop}
            className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-1 rounded-lg border border-white/10 hover:border-white/25 transition-colors hidden sm:block"
          >
            Vista PC →
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
          <div className="w-[390px] h-[844px] rounded-[44px] overflow-hidden border-8 border-slate-800 shadow-2xl bg-[#0B0F14] relative shrink-0">
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
    <div className="flex h-screen overflow-hidden bg-slate-50">

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
    </div>
  );
}
