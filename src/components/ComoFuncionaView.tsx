/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType } from '../types';
import { Mic, CheckSquare, MessageSquare, HelpCircle, ArrowRight, Play, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ComoFuncionaViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
}

interface DemoPreset {
  oficio: TradeType;
  title: string;
  voiceText: string;
  extractedData: {
    cliente: string;
    items: { desc: string; cant: number; precio: number; total: number }[];
    totalMateriales: number;
    manoDeObra: { horas: number; tarifa: number; total: number };
    subtotal: number;
    iva: number;
    total: number;
  };
  whatsappText: string;
}

export default function ComoFuncionaView({ setCurrentPage, setPreselectedTrade }: ComoFuncionaViewProps) {
  const [activeTab, setActiveTab] = useState<TradeType>('Fontanería');
  const [simulationState, setSimulationState] = useState<'idle' | 'typing' | 'parsing' | 'done'>('idle');
  const [typingIndex, setTypingIndex] = useState(0);

  const presets: Partial<Record<TradeType, DemoPreset>> = {
    'Fontanería': {
      oficio: 'Fontanería',
      title: 'Cambio de grifo y latiguillos',
      voiceText: 'Presupuesto para Juan Gómez en Calle Mayor 12. Cambio de grifo de cocina monomando y dos latiguillos de cobre. Material de grifo setenta euros, latiguillos quince euros. Mano de obra dos horas a treinta y cinco euros por hora.',
      extractedData: {
        cliente: 'Juan Gómez (Calle Mayor 12)',
        items: [
          { desc: 'Grifo monomando cocina premium', cant: 1, precio: 70.00, total: 70.00 },
          { desc: 'Latiguillos de cobre reforzado 3/8', cant: 2, precio: 7.50, total: 15.00 },
        ],
        totalMateriales: 85.00,
        manoDeObra: { horas: 2, tarifa: 35.00, total: 70.00 },
        subtotal: 155.00,
        iva: 32.55,
        total: 187.55,
      },
      whatsappText: 'Estimado Juan Gómez, te adjunto el presupuesto de fontanería para el cambio de grifo de cocina. Subtotal: 155,00€ + IVA. Revísalo en: https://trabflow.com/view/pdf_83918',
    },
    'Electricidad': {
      oficio: 'Electricidad',
      title: 'Instalación de focos LED y enchufes',
      voiceText: 'Presupuesto para Reformas SL en Calle Alcala sesenta. Instalación de seis focos LED empotrados a doce euros cada uno, más tres bases de enchufe Simón a seis euros cada una. Mano de obra tres horas y media a cuarenta euros la hora.',
      extractedData: {
        cliente: 'Reformas SL (Calle Alcalá 60)',
        items: [
          { desc: 'Focos LED empotrados de bajo consumo', cant: 6, precio: 12.00, total: 72.00 },
          { desc: 'Bases de enchufe Simón 27 blancas', cant: 3, precio: 6.00, total: 18.00 },
        ],
        totalMateriales: 90.00,
        manoDeObra: { horas: 3.5, tarifa: 40.00, total: 140.00 },
        subtotal: 230.00,
        iva: 48.30,
        total: 278.30,
      },
      whatsappText: 'Buenas tardes, aquí tiene el presupuesto de electricidad para la instalación de focos LED y enchufes. Subtotal: 230,00€ + IVA. PDF adjunto: https://trabflow.com/view/pdf_93810',
    },
    'Climatización / HVAC': {
      oficio: 'Climatización / HVAC',
      title: 'Limpieza y Carga de Aire Acondicionado',
      voiceText: 'Presupuesto para María Luisa en Avenida de Burgos. Mantenimiento de aire acondicionado split: recarga de gas refrigerante cien euros, limpieza de filtros y desinfección treinta euros. Mano de obra una hora y media a cuarenta y cinco euros.',
      extractedData: {
        cliente: 'María Luisa (Avenida de Burgos)',
        items: [
          { desc: 'Gas refrigerante ecológico R32 (Carga)', cant: 1, precio: 100.00, total: 100.00 },
          { desc: 'Líquido desinfectante y limpieza filtros split', cant: 1, precio: 30.00, total: 30.00 },
        ],
        totalMateriales: 130.00,
        manoDeObra: { horas: 1.5, tarifa: 45.00, total: 67.50 },
        subtotal: 197.50,
        iva: 41.48,
        total: 238.98,
      },
      whatsappText: 'Hola María Luisa, aquí tu presupuesto de climatización para el mantenimiento del split. Total: 238,98€ IVA incl. Ver PDF: https://trabflow.com/view/pdf_71620',
    },
    'Cerrajería': {
      oficio: 'Cerrajería',
      title: 'Apertura de puerta y bombín',
      voiceText: 'Presupuesto de cerrajería urgente para Pedro Solares en Calle Luna nueve. Apertura de puerta simple ochenta euros. Cambio de bombín de seguridad de latón cincuenta euros.',
      extractedData: {
        cliente: 'Pedro Solares (Calle Luna 9)',
        items: [
          { desc: 'Apertura de puerta simple urgente (Sin daño)', cant: 1, precio: 80.00, total: 80.00 },
          { desc: 'Bombín de seguridad reforzado latón 70mm', cant: 1, precio: 50.00, total: 50.00 },
        ],
        totalMateriales: 130.00,
        manoDeObra: { horas: 0, tarifa: 0, total: 0 },
        subtotal: 130.00,
        iva: 27.30,
        total: 157.30,
      },
      whatsappText: 'Presupuesto Cerrajería Urgente - Pedro Solares. Apertura y cambio de bombín. Total: 157,30€ IVA incl. PDF: https://trabflow.com/view/pdf_10821',
    },
    'Otros': {
      oficio: 'Otros',
      title: 'Arreglo de persiana y pintura',
      voiceText: 'Presupuesto para oficina de Seguros García. Arreglo de persiana de aluminio cuarenta euros. Pintura blanca plástica de techos treinta euros. Mano de obra tres horas a treinta euros.',
      extractedData: {
        cliente: 'Seguros García (Oficina)',
        items: [
          { desc: 'Lamas y cinta para persiana de aluminio', cant: 1, precio: 40.00, total: 40.00 },
          { desc: 'Pintura plástica blanca techos antihumedad', cant: 1, precio: 30.00, total: 30.00 },
        ],
        totalMateriales: 70.00,
        manoDeObra: { horas: 3, tarifa: 30.00, total: 90.00 },
        subtotal: 160.00,
        iva: 33.60,
        total: 193.60,
      },
      whatsappText: 'Presupuesto - Seguros García. Arreglo persiana + Pintura techos. Subtotal: 160,00€ + IVA. PDF adjunto: https://trabflow.com/view/pdf_55102',
    },
  };

  const currentPreset = (presets[activeTab] ?? presets['Fontanería'])!;

  const runSimulation = () => {
    setSimulationState('typing');
    setTypingIndex(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      if (i >= currentPreset.voiceText.length) {
        clearInterval(interval);
        setSimulationState('parsing');
        setTimeout(() => setSimulationState('done'), 1500);
      } else {
        setTypingIndex(i);
      }
    }, 40);
  };

  const handleJoinBeta = () => {
    setPreselectedTrade(activeTab);
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const steps = [
    {
      n: '01',
      icon: <Mic className="h-6 w-6" />,
      title: '1. Dicta tu trabajo',
      body: 'Graba una nota de voz contando lo que has hecho, el cliente y el material. También puedes subir una foto del lugar del trabajo.',
    },
    {
      n: '02',
      icon: <CheckSquare className="h-6 w-6" />,
      title: '2. Revisa el borrador',
      body: 'La IA extrae los materiales, precios y horas de mano de obra en segundos. Ajusta el IVA y descuentos con un solo toque.',
    },
    {
      n: '03',
      icon: <MessageSquare className="h-6 w-6" />,
      title: '3. Manda por WhatsApp',
      body: 'TrabFlow redacta el mensaje formal y genera el PDF. Tu cliente acepta online desde el móvil con un click.',
    },
  ];

  const faqs = [
    {
      q: '¿Tengo que saber de informática para usar TRABFLOW?',
      a: 'No. Si sabes mandar un audio por WhatsApp o hacer una foto con el móvil, sabes usar TRABFLOW. No hay pantallas complejas ni menús en inglés.',
    },
    {
      q: '¿De dónde saca la IA el precio de los materiales?',
      a: 'Puedes definir tus precios en la configuración o dictárselos de viva voz en el audio ("material setenta euros"). La IA los mapea al vuelo.',
    },
    {
      q: '¿Qué pasa si mi cliente acepta el presupuesto?',
      a: 'Recibes una notificación instantánea. Un botón convierte el borrador en Factura numerada oficial lista para exportar.',
    },
  ];

  return (
    <div className="bg-[#020B16] min-h-screen font-sans" id="como-funciona-container">

      {/* ── Hero header ─────────────────────────────── */}
      <div className="border-b border-white/10 py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45">
            <Sparkles className="h-3.5 w-3.5 text-[#00CFE8]" />
            Inteligencia diseñada para instaladores
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
            ¿Cómo funciona <span className="text-[#FFC400]">TRABFLOW</span>?
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-2xl mx-auto">
            Hemos eliminado la complicación de usar ordenadores o rellenar bases de datos. TRABFLOW entiende el lenguaje natural y tus notas de voz para redactar presupuestos al instante.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-20">

        {/* ── 3 Steps ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-[#0d1f38] border border-white/10 p-7 overflow-hidden">
              <div className="absolute top-4 right-5 text-6xl font-black text-white/[0.04] select-none leading-none">{s.n}</div>
              <div className="h-12 w-12 rounded-2xl bg-[#020B16] text-[#00CFE8] flex items-center justify-center mb-5 shadow-md">
                {s.icon}
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-white mb-2">{s.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* ── Simulator ───────────────────────────────── */}
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">Prueba el simulador</h2>
            <p className="text-white/40 text-sm mt-2">Selecciona tu sector y dale a Simular para ver cómo la IA procesa tu dictado:</p>
          </div>

          <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* Left panel */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                {/* tabs */}
                <div className="flex flex-wrap gap-1.5 bg-[#020B16] p-1.5 rounded-xl border border-white/10">
                  {(Object.keys(presets) as TradeType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setSimulationState('idle'); setTypingIndex(0); }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                        activeTab === tab
                          ? 'bg-[#FFC400] text-[#020B16]'
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Voice box */}
                <div className="rounded-xl bg-[#020B16] border border-white/10 p-5 space-y-3">
                  <span className="text-[9px] font-mono font-bold tracking-wider text-white/30 uppercase">Audio recibido (dictado de voz)</span>

                  <div className="flex items-center gap-2.5 bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${simulationState === 'typing' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/40'}`}>
                      <Mic className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      {simulationState === 'typing' ? (
                        <div className="flex items-center gap-0.5 h-6">
                          {[0,1,2,3,4].map(i => (
                            <div key={i} className="w-[3px] bg-red-500 rounded animate-bounce" style={{ height: `${[8,16,20,12,6][i]}px`, animationDelay: `${i*0.1}s` }} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">Nota de voz procesada · 0:18 min</span>
                      )}
                    </div>
                  </div>

                  <div className="min-h-[80px] bg-white/[0.03] p-3 rounded-lg text-xs leading-relaxed italic border border-white/8 text-white/55">
                    {simulationState === 'idle' && (
                      <span className="text-white/25">Presiona "Simular dictado" para iniciar la simulación…</span>
                    )}
                    {simulationState === 'typing' && (
                      <span>{currentPreset.voiceText.substring(0, typingIndex)}<span className="animate-ping">|</span></span>
                    )}
                    {(simulationState === 'parsing' || simulationState === 'done') && (
                      <span>"{currentPreset.voiceText}"</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2.5">
                {simulationState === 'idle' && (
                  <button
                    onClick={runSimulation}
                    className="w-full flex items-center justify-center gap-2 bg-[#FFC400] text-[#020B16] py-3 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:brightness-110 transition-all"
                  >
                    <Play className="h-4 w-4 fill-[#020B16]" />
                    Simular dictado de voz
                  </button>
                )}
                {simulationState === 'typing' && (
                  <div className="w-full flex items-center justify-center gap-2 bg-white/5 text-white/35 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Transcribiendo voz a texto…
                  </div>
                )}
                {simulationState === 'parsing' && (
                  <div className="w-full flex items-center justify-center gap-2 bg-[#00CFE8]/10 border border-[#00CFE8]/20 text-[#00CFE8] py-3 rounded-xl text-xs font-bold uppercase tracking-wider animate-pulse">
                    <Sparkles className="h-4 w-4" />
                    IA extrayendo conceptos…
                  </div>
                )}
                {simulationState === 'done' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs flex items-center gap-2 font-bold uppercase">
                      <CheckSquare className="h-4 w-4 shrink-0" />
                      ¡Datos estructurados sin errores!
                    </div>
                    <button onClick={runSimulation} className="w-full flex items-center justify-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors py-2 cursor-pointer">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reiniciar simulación
                    </button>
                  </div>
                )}
                <button
                  onClick={handleJoinBeta}
                  className="w-full flex items-center justify-center gap-2 border border-[#00CFE8]/30 bg-[#00CFE8]/10 text-[#00CFE8] font-bold uppercase tracking-widest text-xs py-3 rounded-xl cursor-pointer hover:bg-[#00CFE8]/20 transition-all"
                >
                  Me gusta, quiero registrarme
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Right panel — result */}
            <div className="lg:col-span-7 flex flex-col bg-slate-950 rounded-2xl border border-white/10 overflow-hidden min-h-[400px]">
              <div className="bg-[#08111e] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">TRABFLOW · Vista previa</span>
                <span className="text-[9px] font-mono text-[#00CFE8] bg-[#00CFE8]/10 px-2 py-0.5 rounded border border-[#00CFE8]/20">MOCKUP</span>
              </div>

              <AnimatePresence mode="wait">
                {simulationState === 'idle' || simulationState === 'typing' ? (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3"
                  >
                    <AlertCircle className="h-10 w-10 text-white/20 animate-bounce" />
                    <div>
                      <span className="text-white/50 font-bold text-sm block">Esperando procesamiento</span>
                      <p className="text-white/25 text-xs mt-1 max-w-xs leading-normal">La IA se activa al reproducir el dictado. Verás el desglose y la factura en tiempo real.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-4 sm:p-6 flex-1 flex flex-col justify-between gap-4"
                  >
                    {/* PDF card */}
                    <div className="bg-white rounded-xl shadow-xl text-slate-900 text-xs overflow-hidden border border-slate-200 flex-1">
                      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wide block">AUTÓNOMO EMISOR</span>
                          <span className="text-slate-400 text-[9px] font-mono">Presupuesto #BETA-{activeTab.substring(0,3).toUpperCase()}</span>
                        </div>
                        <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Borrador IA</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between text-[10px] border-b border-slate-100 pb-2">
                          <span className="text-slate-600"><strong>Cliente:</strong> {currentPreset.extractedData.cliente}</span>
                          <span className="text-slate-400 font-mono">23/05/2026</span>
                        </div>
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[9px] text-slate-400 uppercase font-semibold">
                              <th className="py-1">Material / Concepto</th>
                              <th className="py-1 text-center">Cant.</th>
                              <th className="py-1 text-right">Precio</th>
                              <th className="py-1 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {currentPreset.extractedData.items.map((item, i) => (
                              <tr key={i} className="text-[10px] text-slate-700">
                                <td className="py-1.5">{item.desc}</td>
                                <td className="py-1.5 text-center font-mono">{item.cant}</td>
                                <td className="py-1.5 text-right font-mono">{item.precio.toFixed(2)}€</td>
                                <td className="py-1.5 text-right font-mono font-bold">{item.total.toFixed(2)}€</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {currentPreset.extractedData.manoDeObra.horas > 0 && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 flex justify-between text-[10px]">
                            <span className="text-amber-700 font-medium">🧑‍🔧 Mano de obra:</span>
                            <span className="font-mono text-slate-700 font-bold">{currentPreset.extractedData.manoDeObra.total.toFixed(2)}€</span>
                          </div>
                        )}
                        <div className="border-t border-slate-100 pt-2 flex flex-col items-end gap-1">
                          <div className="flex justify-between w-full max-w-[180px] text-[10px] text-slate-500">
                            <span>Subtotal:</span><span className="font-mono">{currentPreset.extractedData.subtotal.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between w-full max-w-[180px] text-[10px] text-slate-400">
                            <span>IVA 21%:</span><span className="font-mono">{currentPreset.extractedData.iva.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between w-full max-w-[180px] text-xs font-black text-blue-700 border-t border-slate-100 pt-1">
                            <span>TOTAL:</span><span className="font-mono">{currentPreset.extractedData.total.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp bubble */}
                    <div className="bg-[#020B16] p-3 rounded-xl border border-white/10 flex items-start gap-2.5 shrink-0">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-xs text-white shrink-0">WA</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold tracking-wider text-emerald-400 uppercase block mb-1">Mensaje listo para WhatsApp:</span>
                        <p className="text-[10px] text-white/55 italic leading-snug line-clamp-2">"{currentPreset.whatsappText}"</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* ── Trabajos Externalizados + Gastos ────────── */}
        <div className="space-y-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFC400]/30 bg-[#FFC400]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#FFC400] mb-4">
              Planes Empresa y Empresa+
            </span>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">
              Gestiona proveedores y controla tus gastos
            </h2>
            <p className="text-white/40 text-sm mt-3 max-w-2xl mx-auto leading-relaxed">
              Subcontrata trabajos, registra facturas de material y conoce la rentabilidad real de cada proyecto — todo en un solo lugar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 — Trabajos Externalizados */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#020B16] flex items-center justify-center text-2xl">🤝</div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white mb-2">Trabajos Externalizados</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Subcontrata a otro instalador o empresa cuando no tienes disponibilidad. Gestiona 10 estados del proceso — desde solicitar precio hasta pagar la factura. El cliente nunca ve "subcontrata", solo la partida de obra.
                </p>
              </div>
              <ul className="space-y-1.5">
                {['Calculadora de margen automática', 'Vinculación a presupuestos', 'Bloqueo al pagar (solo lectura)', 'Directorio de proveedores colaboradores'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/55">
                    <span className="text-[#00CFE8]">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Mayoristas / Material */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#020B16] flex items-center justify-center text-2xl">🏭</div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white mb-2">Mayoristas y Distribuidores</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Da de alta a tus proveedores de material con sus datos fiscales completos. Registra cada factura de compra con su IVA y fecha de vencimiento. Consulta el historial de pagos por proveedor.
                </p>
              </div>
              <ul className="space-y-1.5">
                {['Ficha fiscal completa (NIF, dirección, IBAN)', 'Facturas con IVA 0/10/21%', 'Estado pagado / pendiente por factura', 'Historial por proveedor'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/55">
                    <span className="text-[#00CFE8]">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 — Panel Gastos + Resultado */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#020B16] flex items-center justify-center text-2xl">📊</div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white mb-2">Panel Gastos y Rentabilidad</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  En Ingresos → Gastos tienes todas las compras de material y facturas de proveedores. En la pestaña Resultado ves el margen bruto real: lo que cobras menos lo que pagas.
                </p>
              </div>
              <ul className="space-y-1.5">
                {['Gastos agrupados: material + externalizados', 'Resultado neto y margen bruto %', 'Gráfico ingresos vs gastos por mes', 'Vinculación de compra a trabajo concreto'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/55">
                    <span className="text-[#00CFE8]">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Flujo visual */}
          <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 sm:p-8">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 text-center mb-6">Ciclo completo de un trabajo externalizado</h4>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-0">
              {[
                { label: 'Solicitas precio', emoji: '📋' },
                { label: 'Recibes presupuesto', emoji: '📩' },
                { label: 'Lo añades al cliente', emoji: '👤' },
                { label: 'Proveedor ejecuta', emoji: '🔧' },
                { label: 'Recibes factura', emoji: '🧾' },
                { label: 'Pagas y cierras', emoji: '✅' },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-2 sm:gap-0">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <span className="text-xl">{step.emoji}</span>
                    <span className="text-[10px] font-bold text-white/55 text-center leading-tight max-w-[80px]">{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-white/20 text-lg hidden sm:block">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQ ─────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white text-center mb-8">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-[#00CFE8] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-white mb-1.5">{faq.q}</h4>
                    <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
