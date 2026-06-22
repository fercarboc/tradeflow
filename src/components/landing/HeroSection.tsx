import { CheckCircle2, ArrowRight, Smartphone } from 'lucide-react';
import { ActivePage } from '../../types';

interface HeroSectionProps {
  setCurrentPage: (page: ActivePage) => void;
}

const CHECKS = [
  'Presupuestos PDF en menos de 3 minutos',
  'Planificación de rutas automática',
  'Normativa REBT, RITE, CTE, IVA, SS con IA',
  'Control total de tu negocio en tiempo real',
];

function PresupuestoMockup() {
  return (
    <div className="relative">
      <div className="absolute -top-4 -right-4 w-full h-full bg-[#1A5A96]/8 rounded-2xl" />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-sm font-sans">
        <div className="bg-[#1C2535] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-white/50 font-medium">Presupuesto</span>
          <div className="w-12" />
        </div>

        <div className="px-4 py-3 bg-[#F5F6F8] border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">PRESUPUESTO</p>
              <p className="font-black text-[#1C2535] text-base">#P-2025-0158</p>
            </div>
            <span className="text-xs font-bold bg-[#4A6741]/15 text-[#4A6741] px-2.5 py-1 rounded-full">
              ✓ Enviado
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-0.5">CLIENTE</p>
          <p className="font-semibold text-[#1C2535]">Carlos Martínez</p>
          <p className="text-xs text-gray-400">622 451 890 · Madrid</p>
        </div>

        <div className="px-4 py-3">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 flex-1 mr-2 truncate">Caldera Junkers CerapurSmart 24kW</span>
              <span className="font-semibold text-[#1C2535] shrink-0">1.240,00 €</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Instalación y montaje</span>
              <span className="font-semibold text-[#1C2535]">280,00 €</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Material conexiones</span>
              <span className="font-semibold text-[#1C2535]">85,00 €</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Desplazamiento</span>
              <span className="font-semibold text-[#1C2535]">35,00 €</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Base imponible</span>
              <span>1.640,00 €</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>IVA (21%)</span>
              <span>344,40 €</span>
            </div>
            <div className="flex justify-between font-black text-[#1C2535] text-sm">
              <span>TOTAL</span>
              <span>1.984,40 €</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button className="w-full bg-[#25D366] text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              Enviar por WhatsApp
            </button>
            <button className="w-full bg-[#1A5A96] text-white text-xs font-bold py-2 rounded-lg">
              Descargar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 -left-3 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#4A6741]/15 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4A6741]" />
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Presupuesto aceptado</p>
          <p className="text-xs font-bold text-[#1C2535]">hace 2 minutos</p>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection({ setCurrentPage }: HeroSectionProps) {
  return (
    <section className="bg-white pt-16 pb-20 lg:pt-24 lg:pb-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/8 text-[#1A5A96] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A5A96] animate-pulse" />
              Beta abierta — Únete gratis hoy
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-[#1C2535] leading-[1.1] mb-5">
              La app que necesita{' '}
              <span className="text-[#1A5A96]">tu negocio</span>{' '}
              de instalaciones
            </h1>

            <p className="text-lg text-[#1C2535]/60 leading-relaxed mb-8">
              Presupuestos profesionales, planificación de rutas y normativa técnica con IA. Todo en una app, sin papeles, sin complicaciones.
            </p>

            <ul className="space-y-3 mb-10">
              {CHECKS.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#4A6741] shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-[#1C2535]/80">{text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="flex items-center justify-center gap-2 bg-[#1A5A96] text-white font-bold text-sm px-7 py-3.5 rounded-xl hover:bg-[#1A5A96]/90 transition-all shadow-lg hover:shadow-xl cursor-pointer"
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(ActivePage.ComoFunciona)}
                className="flex items-center justify-center gap-2 text-[#1C2535] font-semibold text-sm px-7 py-3.5 rounded-xl border border-[#1C2535]/15 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Ver cómo funciona
              </button>
            </div>

            <p className="mt-4 text-xs text-[#1C2535]/40">
              Sin tarjeta de crédito · Prueba gratuita 3 meses
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm">
              <PresupuestoMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
