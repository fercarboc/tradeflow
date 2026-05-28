import React, { useState, useRef, useCallback } from 'react';
import {
  Mic, Camera, FileText, Users, BookOpen, Calendar, BarChart2, Lock,
  ChevronRight, ArrowLeft, CheckCircle, AlertCircle, Loader2,
  Zap, Phone, Star, Upload, X, Sparkles, Building2, Package,
  Clock, TrendingUp, Send, User,
} from 'lucide-react';
import { ActivePage } from '../../types';

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type DemoPlan = 'basico' | 'profesional' | 'empresa' | 'empresa_plus';

interface DemoViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS: { key: DemoPlan; name: string; price: number; users: string; color: string; badge?: string; features: string[]; tabs: string[] }[] = [
  {
    key: 'basico', name: 'Básico', price: 29, users: '1 usuario', color: 'border-white/20',
    features: ['Hasta 15 presupuestos/mes', 'Presupuestos por voz con IA', 'Foto IA (5/mes)', 'PDF profesional', 'Hasta 50 clientes'],
    tabs: ['voz', 'foto', 'presupuestos', 'clientes'],
  },
  {
    key: 'profesional', name: 'Profesional', price: 49, users: '1 usuario', color: 'border-[#00CFE8]/50', badge: 'Más popular',
    features: ['Presupuestos ilimitados', 'Clientes y facturas ilimitados', 'Foto IA ilimitada', 'Catálogo de precios propio', 'Planificación de trabajos'],
    tabs: ['voz', 'foto', 'presupuestos', 'clientes', 'catalogo', 'planificacion'],
  },
  {
    key: 'empresa', name: 'Empresa', price: 89, users: 'Hasta 5 usuarios', color: 'border-white/20',
    features: ['Todo lo de Profesional', 'Hasta 5 usuarios en equipo', 'Panel Equipo y Permisos', 'Módulo Ingresos', 'Soporte VIP'],
    tabs: ['voz', 'foto', 'presupuestos', 'clientes', 'catalogo', 'planificacion', 'equipo', 'ingresos'],
  },
  {
    key: 'empresa_plus', name: 'Empresa+', price: 179, users: 'Hasta 15 usuarios', color: 'border-[#FFC400]/50',
    features: ['Todo lo de Empresa', 'Hasta 15 usuarios', 'Módulo Contratos y mantenimientos', 'Panel financiero avanzado', 'Soporte dedicado 1-on-1'],
    tabs: ['voz', 'foto', 'presupuestos', 'clientes', 'catalogo', 'planificacion', 'equipo', 'ingresos', 'contratos'],
  },
];

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_QUOTES = [
  { id: 1, titulo: 'Instalación cuadro eléctrico', cliente: 'Juan García', importe: 1850, estado: 'enviado', fecha: 'Hace 2 días', oficio: 'Electricidad' },
  { id: 2, titulo: 'Reparación tubería baño', cliente: 'María López', importe: 320, estado: 'aceptado', fecha: 'Hace 1 semana', oficio: 'Fontanería' },
  { id: 3, titulo: 'Pintura salón y habitaciones', cliente: 'Comunidad C/ Mayor 5', importe: 1200, estado: 'borrador', fecha: 'Hoy', oficio: 'Pintura' },
];

const MOCK_CLIENTS = [
  { id: 1, nombre: 'Juan García', telefono: '672 123 456', presupuestos: 3, total: 4200 },
  { id: 2, nombre: 'María López', telefono: '611 987 654', presupuestos: 1, total: 320 },
  { id: 3, nombre: 'Comunidad C/ Mayor 5', telefono: '915 234 567', presupuestos: 2, total: 3800 },
];

const MOCK_CATALOG = [
  { familia: 'Electricidad', items: [{ desc: 'Hora técnico electricista', precio: 50, unidad: 'h' }, { desc: 'Punto de luz empotrado', precio: 45, unidad: 'ud' }, { desc: 'Base enchufe schuko', precio: 35, unidad: 'ud' }] },
  { familia: 'Fontanería',   items: [{ desc: 'Hora fontanero', precio: 50, unidad: 'h' }, { desc: 'Grifo mezclador cocina', precio: 85, unidad: 'ud' }] },
  { familia: 'Pintura',      items: [{ desc: 'Hora pintor', precio: 32, unidad: 'h' }, { desc: 'Pintura plástica m²', precio: 8, unidad: 'm²' }] },
];

const EXAMPLE_TEXTS = [
  'Instalación de cuadro eléctrico trifásico en nave industrial con 20 puntos de luz y 4 enchufes industriales, cable nuevo desde contador',
  'Sustitución de caldera de gas de 24kW en vivienda de 90m², con sustitución de termostato y revisión de radiadores',
  'Reforma de baño completa: sustitución de bañera por plato de ducha, alicatado 30m², sanitarios nuevos y griferías',
  'Montaje e instalación de aire acondicionado split 2x1 de 3kW para salón y habitación principal, con línea frigorífica nueva',
];

// ── Top-level helper components ───────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    enviado: 'bg-blue-100 text-blue-700',
    aceptado: 'bg-green-100 text-green-700',
    borrador: 'bg-slate-100 text-slate-500',
    rechazado: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${map[estado] ?? 'bg-slate-100 text-slate-500'}`}>
      {estado}
    </span>
  );
}

function LockedTab({ plan, requiredPlan, setCurrentPage }: { plan: string; requiredPlan: string; setCurrentPage: (p: ActivePage) => void }) {
  const names: Record<string, string> = { profesional: 'Profesional (49€/mes)', empresa: 'Empresa (89€/mes)', empresa_plus: 'Empresa+ (179€/mes)' };
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Lock className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <p className="font-bold text-slate-700">Función disponible en {names[requiredPlan] ?? requiredPlan}</p>
        <p className="text-sm text-slate-400 mt-1">Selecciona ese plan en la demo para probarlo, o regístrate para acceder.</p>
      </div>
      <button
        onClick={() => setCurrentPage(ActivePage.Registro)}
        className="px-4 py-2 rounded-xl bg-[#00CFE8] text-[#020B16] text-sm font-bold cursor-pointer hover:brightness-110 transition-all"
      >
        Registrarme gratis 15 días
      </button>
    </div>
  );
}

function VoiceQuoteDisplay({ data }: { data: Record<string, unknown> }) {
  const quote = data.quote as Record<string, unknown> | undefined;
  if (!quote) return null;
  const partidas = (quote.partidas as Array<Record<string, unknown>>) ?? [];
  const calculos = quote.calculos as Record<string, unknown> | undefined;
  const resumen  = quote.resumen  as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3 mt-3">
      {resumen?.tipo_presupuesto && (
        <div className="flex items-center gap-2 text-xs text-[#00CFE8] font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          {resumen.tipo_presupuesto as string}
        </div>
      )}
      <div className="space-y-2">
        {partidas.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{p.concepto as string}</p>
              <p className="text-[10px] text-slate-400">{p.cantidad as number} {p.unidad as string} · {p.oficio as string}</p>
              {p.requiere_revision && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 font-semibold">
                  <AlertCircle className="h-2.5 w-2.5" /> Revisar precio
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-700 shrink-0">
              {(p.total as number) > 0 ? `${(p.total as number).toFixed(2)}€` : '—'}
            </span>
          </div>
        ))}
      </div>
      {calculos && (
        <div className="rounded-xl bg-slate-50 p-3 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal</span><span>{(calculos.subtotal as number)?.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>IVA {calculos.iva_porcentaje as number}%</span><span>{(calculos.iva as number)?.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-200">
            <span>Total</span><span>{(calculos.total as number)?.toFixed(2)}€</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoQuoteDisplay({ data }: { data: Record<string, unknown> }) {
  const quote = data.quote as Record<string, unknown> | undefined;
  if (!quote) return null;
  const partidas = (quote.partidas as Array<Record<string, unknown>>) ?? [];
  const iva = quote.iva as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3 mt-3">
      {quote.tipo_trabajo && (
        <div className="flex items-center gap-2 text-xs text-[#00CFE8] font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          {quote.oficio as string} · {quote.tipo_trabajo as string}
        </div>
      )}
      <div className="space-y-2">
        {partidas.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">{p.descripcion as string}</p>
              <p className="text-[10px] text-slate-400">{p.cantidad as number} {p.unidad as string} · {p.categoria as string}</p>
              {p.requiere_precio && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 font-semibold">
                  <AlertCircle className="h-2.5 w-2.5" /> Sin precio en catálogo
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">—</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-slate-50 p-3 space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Subtotal</span><span>{(quote.subtotal as number)?.toFixed(2)}€</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>IVA {iva?.tipo as number}%</span><span>{(iva?.importe as number)?.toFixed(2)}€</span>
        </div>
        <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-200">
          <span>Total</span><span>{(quote.total as number)?.toFixed(2)}€</span>
        </div>
        {quote.notas && <p className="text-[10px] text-slate-400 pt-1 italic">{quote.notas as string}</p>}
      </div>
    </div>
  );
}

// ── Plan Selector ─────────────────────────────────────────────────────────────

function PlanSelector({ onSelect, setCurrentPage }: { onSelect: (p: DemoPlan) => void; setCurrentPage: (p: ActivePage) => void }) {
  return (
    <div className="min-h-screen bg-[#030d1e] py-16 px-4">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="text-center mb-12">
          <button onClick={() => setCurrentPage(ActivePage.Home)} className="inline-flex items-center gap-2 text-white/40 hover:text-white text-xs mb-6 cursor-pointer transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </button>
          <div className="inline-block rounded-full border border-[#00CFE8]/30 bg-[#00CFE8]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#00CFE8] mb-4">
            Demo interactiva · Sin registro
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-3">
            Elige un plan y explora
          </h1>
          <p className="text-white/45 text-sm max-w-md mx-auto">
            Prueba la IA de TrabFlow en tiempo real: dicta un trabajo, sube una foto y ve el presupuesto generado al instante.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl bg-[#0d1f38] border ${plan.color} p-6 flex flex-col gap-4 ${plan.key === 'empresa_plus' ? 'ring-2 ring-[#FFC400]/30' : ''}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="rounded-full bg-[#00CFE8] px-3 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#020B16]">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div>
                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${plan.key === 'empresa_plus' ? 'text-[#FFC400]' : plan.key === 'profesional' ? 'text-[#00CFE8]' : 'text-white/40'}`}>
                  {plan.name}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white leading-none">{plan.price}€</span>
                  <span className="text-xs text-white/35 mb-0.5">/mes</span>
                </div>
                <p className="text-[10px] text-white/35 mt-0.5">{plan.users}</p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-white/60">
                    <CheckCircle className="h-3 w-3 text-[#00CFE8] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onSelect(plan.key)}
                className={`w-full rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  plan.key === 'empresa_plus'
                    ? 'bg-[#FFC400] text-[#020B16] hover:brightness-110'
                    : plan.key === 'profesional'
                    ? 'bg-[#00CFE8]/15 border border-[#00CFE8]/40 text-[#00CFE8] hover:bg-[#00CFE8]/25'
                    : 'border border-white/20 text-white/60 hover:border-white/40 hover:text-white'
                }`}
              >
                Explorar demo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="text-center">
          <p className="text-white/30 text-xs mb-4">La demo usa IA real · Los presupuestos generados son ejemplos funcionales</p>
          <button
            onClick={() => setCurrentPage(ActivePage.Registro)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-6 py-3 text-sm font-black uppercase tracking-wider text-[#020B16] hover:brightness-110 transition-all cursor-pointer"
          >
            <Star className="h-4 w-4" /> Registrarme gratis · 15 días sin tarjeta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Demo App Shell ────────────────────────────────────────────────────────────

const TAB_CONFIG: { key: string; label: string; icon: React.ElementType; minPlan: DemoPlan | null }[] = [
  { key: 'voz',          label: 'Voz',          icon: Mic,       minPlan: null },
  { key: 'foto',         label: 'Foto IA',       icon: Camera,    minPlan: null },
  { key: 'presupuestos', label: 'Presupuestos',  icon: FileText,  minPlan: null },
  { key: 'clientes',     label: 'Clientes',      icon: Users,     minPlan: null },
  { key: 'catalogo',     label: 'Catálogo',      icon: Package,   minPlan: 'profesional' },
  { key: 'planificacion',label: 'Planificación', icon: Calendar,  minPlan: 'profesional' },
  { key: 'equipo',       label: 'Equipo',        icon: Building2, minPlan: 'empresa' },
  { key: 'ingresos',     label: 'Ingresos',      icon: TrendingUp,minPlan: 'empresa' },
  { key: 'contratos',    label: 'Contratos',     icon: BookOpen,  minPlan: 'empresa_plus' },
];

const PLAN_ORDER: DemoPlan[] = ['basico', 'profesional', 'empresa', 'empresa_plus'];
function planLevel(p: DemoPlan) { return PLAN_ORDER.indexOf(p); }
function hasAccess(userPlan: DemoPlan, minPlan: DemoPlan | null) {
  if (!minPlan) return true;
  return planLevel(userPlan) >= planLevel(minPlan);
}

function DemoAppShell({ plan, onChangePlan, setCurrentPage }: { plan: DemoPlan; onChangePlan: () => void; setCurrentPage: (p: ActivePage) => void }) {
  const planInfo   = PLANS.find(p => p.key === plan)!;
  const visibleTabs = TAB_CONFIG.filter(t => planInfo.tabs.includes(t.key));
  const [activeTab, setActiveTab] = useState('voz');

  // Voice tab state
  const [voiceText, setVoiceText]       = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult]   = useState<Record<string, unknown> | null>(null);
  const [voiceError, setVoiceError]     = useState('');

  // Photo tab state
  const [photoSrc, setPhotoSrc]         = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoResult, setPhotoResult]   = useState<Record<string, unknown> | null>(null);
  const [photoError, setPhotoError]     = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleVoiceGenerate = useCallback(async () => {
    if (!voiceText.trim()) return;
    setVoiceLoading(true);
    setVoiceResult(null);
    setVoiceError('');
    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/trade-voice-to-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_ANON}` },
        body: JSON.stringify({ text: voiceText }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? 'Error generando presupuesto');
      setVoiceResult(data);
    } catch (e) {
      setVoiceError((e as Error).message);
    } finally {
      setVoiceLoading(false);
    }
  }, [voiceText]);

  const loadExamplePhoto = useCallback(async () => {
    setPhotoResult(null);
    setPhotoError('');
    try {
      const res = await fetch('/1000169265.jpg');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => setPhotoSrc(e.target?.result as string);
      reader.readAsDataURL(blob);
    } catch {
      setPhotoSrc('/1000169265.jpg');
    }
  }, []);

  const handlePhotoAnalyze = useCallback(async () => {
    if (!photoSrc) return;
    setPhotoLoading(true);
    setPhotoResult(null);
    setPhotoError('');
    try {
      const base64 = photoSrc.includes('base64,') ? photoSrc.split('base64,')[1] : photoSrc;
      const res = await fetch(`${SUPA_URL}/functions/v1/trade-photo-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_ANON}` },
        body: JSON.stringify({ image_base64: base64, mime_type: 'image/jpeg' }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? 'Error analizando imagen');
      setPhotoResult(data);
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setPhotoLoading(false);
    }
  }, [photoSrc]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoResult(null);
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const currentTab = visibleTabs.find(t => t.key === activeTab) ?? visibleTabs[0];
  const canAccess  = hasAccess(plan, currentTab?.minPlan ?? null);

  const planColors: Record<DemoPlan, string> = {
    basico: 'bg-white/10 text-white/70',
    profesional: 'bg-[#00CFE8]/20 text-[#00CFE8]',
    empresa: 'bg-white/10 text-white/70',
    empresa_plus: 'bg-[#FFC400]/20 text-[#FFC400]',
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top bar */}
      <div className="bg-[#020B16] border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <button onClick={onChangePlan} className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs cursor-pointer transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cambiar plan</span>
        </button>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${planColors[plan]}`}>
          Demo · {planInfo.name}
        </div>
        <button
          onClick={() => setCurrentPage(ActivePage.Registro)}
          className="px-3 py-1.5 rounded-lg bg-[#FFC400] text-[#020B16] text-[10px] font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all"
        >
          Registrarme gratis
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4">

          {/* VozTab */}
          {activeTab === 'voz' && canAccess && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#020B16] flex items-center justify-center">
                    <Mic className="h-4 w-4 text-[#FFC400]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">Dictar presupuesto</p>
                    <p className="text-[10px] text-slate-400">Escribe y la IA genera el presupuesto</p>
                  </div>
                </div>

                <textarea
                  value={voiceText}
                  onChange={e => setVoiceText(e.target.value)}
                  placeholder="Describe el trabajo... Ej: Instalación de 5 puntos de luz y 3 enchufes en salón, con caja de distribución nueva..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00CFE8] transition resize-none"
                />

                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {EXAMPLE_TEXTS.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setVoiceText(t)}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] text-slate-500 hover:bg-[#00CFE8]/10 hover:text-[#00CFE8] cursor-pointer transition-colors text-left"
                    >
                      Ejemplo {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleVoiceGenerate}
                  disabled={!voiceText.trim() || voiceLoading}
                  className="w-full rounded-xl bg-[#020B16] py-3 text-sm font-black uppercase tracking-wider text-[#FFC400] hover:bg-[#020B16]/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {voiceLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</> : <><Sparkles className="h-4 w-4" /> Generar presupuesto</>}
                </button>

                {voiceError && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {voiceError}</p>
                )}
                {voiceResult && <VoiceQuoteDisplay data={voiceResult} />}
              </div>
            </div>
          )}

          {/* FotoTab */}
          {activeTab === 'foto' && canAccess && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#020B16] flex items-center justify-center">
                    <Camera className="h-4 w-4 text-[#00CFE8]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">Escáner foto IA</p>
                    <p className="text-[10px] text-slate-400">Sube una foto y la IA genera el presupuesto</p>
                  </div>
                </div>

                {!photoSrc ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={loadExamplePhoto}
                      className="w-full rounded-xl border-2 border-dashed border-[#00CFE8]/40 py-6 flex flex-col items-center gap-2 text-[#00CFE8] hover:bg-[#00CFE8]/5 cursor-pointer transition-colors"
                    >
                      <Camera className="h-7 w-7" />
                      <span className="text-sm font-bold">Cargar foto de ejemplo</span>
                      <span className="text-[10px] text-slate-400">Instalación real para analizar</span>
                    </button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                      <div className="relative text-center"><span className="bg-white px-3 text-xs text-slate-400">o</span></div>
                    </div>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full rounded-xl border border-slate-200 py-3 flex items-center justify-center gap-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <Upload className="h-4 w-4" /> Subir tu propia foto
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={photoSrc} alt="Foto a analizar" className="w-full max-h-52 object-cover" />
                      <button
                        onClick={() => { setPhotoSrc(null); setPhotoResult(null); setPhotoError(''); }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                    <button
                      onClick={handlePhotoAnalyze}
                      disabled={photoLoading}
                      className="w-full rounded-xl bg-[#020B16] py-3 text-sm font-black uppercase tracking-wider text-[#00CFE8] hover:bg-[#020B16]/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {photoLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando imagen...</> : <><Zap className="h-4 w-4" /> Analizar con IA</>}
                    </button>
                    <button onClick={() => photoInputRef.current?.click()} className="w-full text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                      Cambiar foto
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    {photoError && (
                      <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {photoError}</p>
                    )}
                    {photoResult && <PhotoQuoteDisplay data={photoResult} />}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PresupuestosTab */}
          {activeTab === 'presupuestos' && canAccess && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-black text-slate-700">Mis presupuestos</p>
                <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Demo</span>
              </div>
              {MOCK_QUOTES.map(q => (
                <div key={q.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{q.titulo}</p>
                      <span className="text-sm font-black text-slate-700 shrink-0">{q.importe.toLocaleString('es-ES')}€</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span className="text-[11px] text-slate-500">{q.cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <EstadoBadge estado={q.estado} />
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {q.fecha}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 text-sm cursor-pointer hover:border-[#00CFE8]/40 hover:text-[#00CFE8] transition-colors" onClick={() => setActiveTab('voz')}>
                <Mic className="h-4 w-4" /> Generar nuevo presupuesto
              </div>
            </div>
          )}

          {/* ClientesTab */}
          {activeTab === 'clientes' && canAccess && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-black text-slate-700">Mis clientes</p>
                <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Demo</span>
              </div>
              {MOCK_CLIENTS.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#020B16] flex items-center justify-center shrink-0 text-[#FFC400] font-black text-sm">
                    {c.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{c.nombre}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.telefono}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-700">{c.total.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-slate-400">{c.presupuestos} presupuestos</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CatalogoTab */}
          {activeTab === 'catalogo' && canAccess && (
            <div className="space-y-4">
              <p className="text-sm font-black text-slate-700">Mi catálogo de precios</p>
              {MOCK_CATALOG.map(cat => (
                <div key={cat.familia} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wider">{cat.familia}</p>
                  </div>
                  {cat.items.map(item => (
                    <div key={item.desc} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                      <p className="text-sm text-slate-700">{item.desc}</p>
                      <span className="text-sm font-bold text-slate-800">{item.precio}€/{item.unidad}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* PlanificaciónTab */}
          {activeTab === 'planificacion' && canAccess && (
            <div className="space-y-3">
              <p className="text-sm font-black text-slate-700">Planificación de trabajos</p>
              {[
                { titulo: 'Instalación Empresa Navarro', fecha: 'Hoy 10:00', estado: 'En curso', color: 'bg-blue-100 text-blue-700' },
                { titulo: 'Reforma baño López', fecha: 'Mañana 9:00', estado: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
                { titulo: 'Mantenimiento HVAC', fecha: 'Vie 14:00', estado: 'Programado', color: 'bg-slate-100 text-slate-600' },
              ].map((job, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{job.titulo}</p>
                    <p className="text-[11px] text-slate-400">{job.fecha}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.color}`}>{job.estado}</span>
                </div>
              ))}
            </div>
          )}

          {/* EquipoTab */}
          {activeTab === 'equipo' && canAccess && (
            <div className="space-y-3">
              <p className="text-sm font-black text-slate-700">Equipo</p>
              {[
                { nombre: 'Carlos Martínez', rol: 'Técnico', estado: 'Activo' },
                { nombre: 'Ana Rodríguez', rol: 'Admin', estado: 'Activo' },
                { nombre: 'Pedro Sánchez', rol: 'Técnico', estado: 'En obra' },
              ].map((w, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#020B16] flex items-center justify-center text-[#00CFE8] font-black text-sm shrink-0">
                    {w.nombre.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{w.nombre}</p>
                    <p className="text-[11px] text-slate-400">{w.rol}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{w.estado}</span>
                </div>
              ))}
            </div>
          )}

          {/* IngresosTab */}
          {activeTab === 'ingresos' && canAccess && (
            <div className="space-y-4">
              <p className="text-sm font-black text-slate-700">Módulo Ingresos</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Facturado este mes', value: '8.370€', icon: TrendingUp, color: 'text-green-600' },
                  { label: 'Pendiente de cobro', value: '2.150€', icon: Clock, color: 'text-amber-600' },
                  { label: 'Presupuestos aceptados', value: '12', icon: CheckCircle, color: 'text-[#00CFE8]' },
                  { label: 'Ticket medio', value: '697€', icon: BarChart2, color: 'text-[#FFC400]' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                    <kpi.icon className={`h-5 w-5 ${kpi.color} mb-2`} />
                    <p className="text-lg font-black text-slate-800">{kpi.value}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ContratosTab */}
          {activeTab === 'contratos' && canAccess && (
            <div className="space-y-3">
              <p className="text-sm font-black text-slate-700">Contratos de Mantenimiento</p>
              {[
                { cliente: 'Comunidad Paseo del Prado 12', tipo: 'Fontanería + Electricidad', importe: '450€/mes', estado: 'Activo' },
                { cliente: 'Hotel Rural Las Dehesas', tipo: 'Climatización HVAC', importe: '1.200€/mes', estado: 'Activo' },
                { cliente: 'Supermercado FamilyMart', tipo: 'Frío industrial', importe: '2.100€/mes', estado: 'Renovando' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-800">{c.cliente}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${c.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.estado}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{c.tipo}</p>
                  <p className="text-sm font-black text-[#FFC400] mt-1">{c.importe}</p>
                </div>
              ))}
              <div className="bg-[#020B16] rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-[#FFC400] mb-1">Módulo exclusivo Empresa+</p>
                <p className="text-[10px] text-white/50">Genera contratos de mantenimiento con IA en menos de 60 segundos</p>
              </div>
            </div>
          )}

          {/* Locked */}
          {!canAccess && <LockedTab plan={plan} requiredPlan={currentTab?.minPlan ?? 'profesional'} setCurrentPage={setCurrentPage} />}

          {/* CTA sticky */}
          <div className="mt-6 bg-[#020B16] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">¿Te convence?</p>
              <p className="text-[10px] text-white/45">15 días gratis · Sin tarjeta</p>
            </div>
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFC400] text-[#020B16] text-xs font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all shrink-0"
            >
              <Send className="h-3.5 w-3.5" /> Registrarme
            </button>
          </div>

        </div>
      </div>

      {/* Bottom nav */}
      <div className="bg-white border-t border-slate-200 px-2 py-1 shrink-0">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {visibleTabs.slice(0, 5).map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors cursor-pointer ${active ? 'text-[#020B16]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-[#FFC400]' : ''}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-[#020B16]' : ''}`}>{tab.label}</span>
              </button>
            );
          })}
          {visibleTabs.length > 5 && (
            <div className="relative group">
              <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                <BookOpen className="h-5 w-5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Más</span>
              </button>
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden hidden group-hover:block z-10 min-w-[140px]">
                {visibleTabs.slice(5).map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <Icon className="h-4 w-4 text-slate-500" /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DemoView({ setCurrentPage }: DemoViewProps) {
  const [step, setStep]   = useState<'selector' | 'app'>('selector');
  const [plan, setPlan]   = useState<DemoPlan>('profesional');

  const handleSelect = useCallback((p: DemoPlan) => {
    setPlan(p);
    setStep('app');
    window.scrollTo(0, 0);
  }, []);

  if (step === 'selector') {
    return <PlanSelector onSelect={handleSelect} setCurrentPage={setCurrentPage} />;
  }

  return (
    <DemoAppShell
      plan={plan}
      onChangePlan={() => setStep('selector')}
      setCurrentPage={setCurrentPage}
    />
  );
}
