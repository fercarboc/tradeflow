/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType } from '../types';
import { Mic, CheckSquare, MessageSquare, FileText, HelpCircle, ArrowRight, Play, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
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
          { desc: 'Latiguillos de cobre reforzado 3/8', cant: 2, precio: 7.50, total: 15.00 }
        ],
        totalMateriales: 85.00,
        manoDeObra: { horas: 2, tarifa: 35.00, total: 70.00 },
        subtotal: 155.00,
        iva: 32.55,
        total: 187.55
      },
      whatsappText: 'Estimado Juan Gómez, te adjunto el presupuesto de fontanería para el cambio de grifo de cocina. Subtotal: 155,00€ + IVA. Puedes revisarlo en el siguiente PDF adjunto por TrabFlow: https://trabflow.com/view/pdf_83918'
    },
    'Electricidad': {
      oficio: 'Electricidad',
      title: 'Instalación de focos LED y enchufes',
      voiceText: 'Presupuesto para Reformas SL en Calle Alcala sesenta. Instalación de seis focos LED empotrados a doce euros cada uno, más tres bases de enchufe Simón a seis euros cada una. Mano de obra tres horas y media a cuarenta euros la hora.',
      extractedData: {
        cliente: 'Reformas SL (Calle Alcalá 60)',
        items: [
          { desc: 'Focos LED empotrados de bajo consumo', cant: 6, precio: 12.00, total: 72.00 },
          { desc: 'Bases de enchufe Simón 27 blancas', cant: 3, precio: 6.00, total: 18.00 }
        ],
        totalMateriales: 90.00,
        manoDeObra: { horas: 3.5, tarifa: 40.00, total: 140.00 },
        subtotal: 230.00,
        iva: 48.30,
        total: 278.30
      },
      whatsappText: 'Buenas tardes, aquí tiene el presupuesto de electricidad para la instalación de focos LED y enchufes en Calle Alcalá 60. Subtotal: 230,00€ + IVA. Revise los detalles en el PDF adjunto: https://trabflow.com/view/pdf_93810'
    },
    'Climatización / HVAC': {
      oficio: 'Climatización / HVAC',
      title: 'Limpieza y Carga de Aire Acondicionado',
      voiceText: 'Presupuesto para María Luisa en Avenida de Burgos. Mantenimiento de aire acondicionado split que incluye recarga de gas refrigerante cien euros, limpieza de filtros y desinfección treinta euros. Mano de obra una hora y media a cuarenta y cinco euros.',
      extractedData: {
        cliente: 'María Luisa (Avenida de Burgos)',
        items: [
          { desc: 'Gas refrigerante ecológico R32 (Carga)', cant: 1, precio: 100.00, total: 100.00 },
          { desc: 'Líquido desinfectante y limpieza filtros split', cant: 1, precio: 30.00, total: 30.00 }
        ],
        totalMateriales: 130.00,
        manoDeObra: { horas: 1.5, tarifa: 45.00, total: 67.50 },
        subtotal: 197.50,
        iva: 41.48,
        total: 238.98
      },
      whatsappText: 'Hola María Luisa, puedes ver aquí tu presupuesto de climatización para el mantenimiento del split. Desinfectado y cargado. Total: 238,98€ IVA incl. Pulse para ver PDF: https://trabflow.com/view/pdf_71620'
    },
    'Cerrajería': {
      oficio: 'Cerrajería',
      title: 'Apertura de puerta y bombín',
      voiceText: 'Presupuesto de cerrajería urgente para Pedro Solares en Calle Luna nueve. Apertura de puerta simple ochenta euros. Cambio de bombín de seguridad de latón cincuenta euros. Un único concepto global.',
      extractedData: {
        cliente: 'Pedro Solares (Calle Luna 9)',
        items: [
          { desc: 'Apertura de puerta simple urgente (Sin daño)', cant: 1, precio: 80.00, total: 80.00 },
          { desc: 'Bombín de seguridad reforzado latón 70mm', cant: 1, precio: 50.00, total: 50.00 }
        ],
        totalMateriales: 130.00,
        manoDeObra: { horas: 0, tarifa: 0, total: 0 },
        subtotal: 130.00,
        iva: 27.30,
        total: 157.30
      },
      whatsappText: 'Presupuesto Cerrajería Urgente - Pedro Solares. Apertura y cambio de bombín de seguridad latonado. Total: 157,30€ IVA incl. PDF Oficial: https://trabflow.com/view/pdf_10821'
    },
    'Otros': {
      oficio: 'Otros',
      title: 'Arreglo de persiana y pintura',
      voiceText: 'Presupuesto para oficina de Seguros García. Arreglo de persiana de aluminio desgastada cuarenta euros. Pintura blanca plástica de techos treinta euros. Mano de obra tres horas a treinta euros.',
      extractedData: {
        cliente: 'Seguros García (Oficina)',
        items: [
          { desc: 'Lamas y cinta para persiana de aluminio', cant: 1, precio: 40.00, total: 40.00 },
          { desc: 'Pintura plástica blanca techos antihumedad', cant: 1, precio: 30.00, total: 30.00 }
        ],
        totalMateriales: 70.00,
        manoDeObra: { horas: 3, tarifa: 30.00, total: 90.00 },
        subtotal: 160.00,
        iva: 33.60,
        total: 193.60
      },
      whatsappText: 'Presupuesto de reparaciones - Seguros García. Arreglo persiana + Pintura techos. Subtotal: 160,00€ + IVA. PDF TrabFlow adjuntado: https://trabflow.com/view/pdf_55102'
    }
  };

  const currentPreset = (presets[activeTab] ?? presets['Fontanería'])!;

  const runSimulation = () => {
    setSimulationState('typing');
    setTypingIndex(0);
    
    // Simulate speech-to-text typing animation
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      if (i >= currentPreset.voiceText.length) {
        clearInterval(interval);
        setSimulationState('parsing');
        
        // Parsing artificial intelligence delay
        setTimeout(() => {
          setSimulationState('done');
        }, 1500);
      } else {
        setTypingIndex(i);
      }
    }, 40);
  };

  const handleJoinBetaWithSelected = () => {
    setPreselectedTrade(activeTab);
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 font-sans" id="como-funciona-container">
      {/* Title */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="inline-flex items-center gap-1 hover:opacity-90 transition-opacity rounded bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3 text-emerald-500" />
          Inteligencia diseñada para autónomos
        </span>
        <h1 className="text-3.5xl sm:text-5xl font-display font-bold text-slate-950 tracking-tight mt-3 leading-tight">
          ¿Cómo funciona <span className="text-blue-600">TrabFlow AI</span>?
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-505 leading-relaxed max-w-2xl mx-auto">
          Hemos eliminado la complicación de usar ordenadores o rellenar tediosas bases de datos. TrabFlow entiende el lenguaje natural y tus notas de voz de WhatsApp para redactar presupuestos de forma mágica.
        </p>
      </div>

      {/* 3 Step Visual Path */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <div className="bg-white p-6 rounded border border-slate-200 shadow-xs relative overflow-hidden" id="step-card-1">
          <div className="absolute top-4 right-4 text-5xl font-bold font-display text-slate-105 select-none animate-none font-mono">01</div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-blue-600 border border-blue-105 mb-4 shadow-xs">
            <Mic className="h-5 w-5" />
          </div>
          <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide mb-2">1. Dicta tu trabajo</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Graba una nota de voz relatando lo que has hecho o necesitas cobrar, el cliente, y el material. También puedes subir una foto manuscrita o del lugar del trabajo para que evaluemos modelos.
          </p>
        </div>

        <div className="bg-white p-6 rounded border border-slate-200 shadow-xs relative overflow-hidden" id="step-card-2">
          <div className="absolute top-4 right-4 text-5xl font-bold font-display text-slate-105 select-none animate-none font-mono">02</div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded bg-emerald-50 text-emerald-600 border border-emerald-105 mb-4 shadow-xs">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide mb-2">2. Revisa el borrador</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nuestra IA estructurada extrae los nombres de repuestos, precios y horas de mano de obra en segundos. Compara totales, añade descuentos o ajusta el IVA en un toque visual e intuitivo.
          </p>
        </div>

        <div className="bg-white p-6 rounded border border-slate-200 shadow-xs relative overflow-hidden" id="step-card-3">
          <div className="absolute top-4 right-4 text-5xl font-bold font-display text-slate-105 select-none animate-none font-mono">03</div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded bg-amber-50 text-amber-600 border border-amber-105 mb-4 shadow-xs">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide mb-2">3. Manda por WhatsApp</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            TrabFlow redacta el texto formal y genera la URL del PDF profesional directamente listo para compartir. Tu cliente lo acepta Online con un click, notificándote de inmediato en el móvil.
          </p>
        </div>
      </div>

      {/* Simulator Headline */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h2 className="text-2xl font-display font-bold text-slate-950 uppercase tracking-wide">Prueba el Simulador de Inteligencia</h2>
        <p className="text-xs text-slate-500 mt-2">Selecciona tu sector técnico y dale al play para ver cómo nuestra IA procesa e interpreta tus dictados de voz:</p>
      </div>

      {/* Interactive Dictation Simulator Sandbox */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch mb-20" id="visual-simulator-console">
        
        {/* Left Console: Controls and text */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Tab selector */}
            <div className="flex flex-wrap gap-1 bg-white p-1 rounded border border-slate-200">
              {(Object.keys(presets) as TradeType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSimulationState('idle');
                    setTypingIndex(0);
                  }}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                    activeTab === tab 
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-650 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Voice Dictation Simulation Box */}
            <div className="bg-white rounded border border-slate-200 p-5 shadow-xs space-y-3 relative">
              <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase block font-mono">Audio Recibido (Dictado de voz)</span>
              
              <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded border border-slate-150">
                <div className={`h-8 w-8 rounded flex items-center justify-center ${simulationState === 'typing' ? 'bg-red-500 text-white shadow-xs animate-pulse' : 'bg-slate-200 text-slate-600'}`}>
                  <Mic className="h-4 w-4" />
                </div>
                <div className="flex-1 flex items-center gap-1">
                  {simulationState === 'typing' ? (
                    <div className="flex items-center gap-0.5 h-6">
                      <div className="w-[3px] bg-red-500 h-2 rounded animate-[bounce_0.6s_infinite]" />
                      <div className="w-[3px] bg-red-500 h-4 rounded animate-[bounce_0.6s_infinite_0.1s]" />
                      <div className="w-[3px] bg-red-500 h-5 rounded animate-[bounce_0.6s_infinite_0.2s]" />
                      <div className="w-[3px] bg-red-500 h-3 rounded animate-[bounce_0.6s_infinite_0.3s]" />
                      <div className="w-[3px] bg-red-500 h-1.5 rounded animate-[bounce_0.6s_infinite_0.4s]" />
                    </div>
                  ) : (
                    <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-400">Nota de voz procesada</span>
                  )}
                  <span className="text-[9px] text-slate-400 font-mono ml-auto">0:18 min</span>
                </div>
              </div>

              {/* Typed text or parsed */}
              <div className="min-h-[80px] bg-slate-50/60 p-3 rounded text-slate-750 text-xs leading-relaxed font-sans italic border border-slate-150">
                {simulationState === 'idle' && (
                  <span className="text-slate-400">Presiona "Reproducir Dictado de Voz" abajo para iniciar la simulación...</span>
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

          <div className="space-y-3">
            {simulationState === 'idle' && (
              <button
                onClick={runSimulation}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Play className="h-4 w-4 fill-white text-white" />
                <span>Simular Dictado de Voz</span>
              </button>
            )}

            {simulationState === 'typing' && (
              <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 py-3 rounded text-xs font-bold uppercase tracking-wider border border-slate-200">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Transcribiendo voz a texto en vivo...</span>
              </div>
            )}

            {simulationState === 'parsing' && (
              <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 py-3 rounded text-xs font-bold uppercase tracking-wider animate-pulse">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span>IA extrayendo conceptos y repuestos para presupuesto...</span>
              </div>
            )}

            {simulationState === 'done' && (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded text-xs flex items-center gap-2 font-bold uppercase tracking-wide">
                  <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>¡Datos estructurados creados sin errores!</span>
                </div>
                <button
                  onClick={runSimulation}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-550 hover:text-slate-800 hover:underline transition-colors py-2 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reiniciar simulación</span>
                </button>
              </div>
            )}

            <button
              onClick={handleJoinBetaWithSelected}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-xs py-3.5 rounded cursor-pointer shadow-sm transition-colors"
            >
              <span>Me gusta, quiero registrarme</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Console: Result Preview Mockup */}
        <div className="lg:col-span-7 flex flex-col justify-start bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[400px]">
          {/* Mockup Header */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
            </div>
            <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Pantalla de Trabajo TrabFlow Client</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">MOCKUP REAL</span>
          </div>

          <AnimatePresence mode="wait">
            {simulationState === 'idle' || simulationState === 'typing' ? (
              <motion.div
                key="simulate-pending-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3"
              >
                <AlertCircle className="h-10 w-10 text-slate-700 animate-bounce" />
                <div>
                  <span className="text-slate-300 font-display font-bold text-sm block">Esperando procesamiento del dictado</span>
                  <p className="text-slate-500 text-xs mt-1 max-w-xs leading-normal">
                    La IA se activa cuando reproduces el dictado. Verás el desglose tributario y la factura en tiempo real.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="simulated-result-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-5"
              >
                {/* Simulated PDF / Quote Card */}
                <div className="bg-white rounded-xl shadow-lg text-slate-900 text-xs overflow-hidden border border-slate-200">
                  {/* Header PDF */}
                  <div className="bg-slate-50 border-b border-slate-100 p-3 sm:px-4 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 text-[10px] block uppercase">AUTÓNOMO EMISOR</span>
                      <span className="text-slate-500 text-[9px] font-mono">Presupuesto #BETA-{activeTab.substring(0, 3).toUpperCase()}</span>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase">Borrador IA</span>
                  </div>

                  {/* Body PDF info */}
                  <div className="p-3 sm:p-4 space-y-3">
                    <div className="flex justify-between text-[10px] border-b border-slate-100 pb-2">
                      <span className="text-slate-550"><strong>Cliente:</strong> {currentPreset.extractedData.cliente}</span>
                      <span className="text-slate-550 font-mono">Fecha: 23/05/2026</span>
                    </div>

                    {/* Table row */}
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[9px] text-slate-400 uppercase font-semibold">
                          <th className="py-1">Conc. / Material</th>
                          <th className="py-1 text-center">Cant.</th>
                          <th className="py-1 text-right">Precio</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {currentPreset.extractedData.items.map((item, idx) => (
                          <tr key={idx} className="text-[10px] text-slate-750 font-medium">
                            <td className="py-1.5">{item.desc}</td>
                            <td className="py-1.5 text-center font-mono">{item.cant}</td>
                            <td className="py-1.5 text-right font-mono">{item.precio.toFixed(2)}€</td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-900">{item.total.toFixed(2)}€</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Labor row if exists */}
                    {currentPreset.extractedData.manoDeObra.horas > 0 && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-100/60 flex justify-between items-center text-[10px]">
                        <span className="text-amber-800 font-medium">🧑‍🔧 Mano de Obra Estimada:</span>
                        <span className="font-mono text-slate-850">
                          {currentPreset.extractedData.manoDeObra.horas} hs x {currentPreset.extractedData.manoDeObra.tarifa}€/h = <strong className="text-slate-900 font-bold">{currentPreset.extractedData.manoDeObra.total.toFixed(2)}€</strong>
                        </span>
                      </div>
                    )}

                    {/* Totals table */}
                    <div className="border-t border-slate-100 pt-3 flex flex-col items-end space-y-1">
                      <div className="flex justify-between w-full max-w-[180px] text-[10px] text-slate-600">
                        <span>Suma Conceptos:</span>
                        <span className="font-mono font-semibold">{currentPreset.extractedData.subtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[180px] text-[10px] text-slate-500">
                        <span>IVA Regulado (21%):</span>
                        <span className="font-mono">{currentPreset.extractedData.iva.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[180px] text-xs font-bold text-slate-950 border-t border-slate-100 pt-1.5">
                        <span className="text-blue-700">Importe Total:</span>
                        <span className="font-mono text-blue-700">{currentPreset.extractedData.total.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated WhatsApp bubble bottom */}
                <div className="bg-slate-950/80 p-3 sm:p-4 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow">WA</div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold tracking-wider text-emerald-400 block uppercase">Mensaje listo para enviar por WhatsApp:</span>
                    <p className="text-[10px] text-slate-300 italic font-sans leading-normal bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      "{currentPreset.whatsappText}"
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pre-Beta Faq section specifically built for Tradesmen */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto space-y-6" id="faq-tradesmen-section">
        <h2 className="text-2xl font-display font-bold text-slate-950 text-center mb-4">Preguntas Frecuentes de la Beta</h2>
        
        <div className="space-y-4 text-sm divide-y divide-slate-100">
          <div className="pt-4 first:pt-0 space-y-1.5">
            <h4 className="font-bold text-slate-900">¿Tengo que saber de informática para usar TrabFlow?</h4>
            <p className="text-slate-600 leading-normal">No. Si sabes mandar un audio por WhatsApp o hacer una foto con el móvil, sabes usar TrabFlow AI. No hay pantallas complejas ni menús en inglés.</p>
          </div>
          <div className="pt-4 space-y-1.5">
            <h4 className="font-bold text-slate-900">¿De dónde saca la IA el precio de los materiales en la cotización?</h4>
            <p className="text-slate-600 leading-normal">Tú puedes definir tus precios de materiales frecuentes en la configuración o dictárselo de viva voz en el mismo audio ("material setenta euros"). La IA mapea estos valores al vuelo.</p>
          </div>
          <div className="pt-4 space-y-1.5">
            <h4 className="font-bold text-slate-900">¿Qué pasa si mi cliente acepta el presupuesto por WhatsApp?</h4>
            <p className="text-slate-600 leading-normal">Te mandamos una notificación instantánea indicando que el cliente ha aceptado. TrabFlow te permite pulsar un solo botón para convertir ese borrador aceptado en Factura numerada oficial lista para exportar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
