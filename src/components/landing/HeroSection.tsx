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

function PresupuestoCard() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-sm w-64">
      <div className="bg-[#1C2535] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <span className="text-[10px] text-white/40 font-medium">Presupuesto</span>
        <div className="w-10" />
      </div>

      <div className="px-3.5 py-2.5 bg-[#F5F6F8] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-medium">PRESUPUESTO</p>
            <p className="font-black text-[#1C2535] text-sm">#P-2025-0158</p>
          </div>
          <span className="text-[10px] font-bold bg-[#4A6741]/15 text-[#4A6741] px-2 py-0.5 rounded-full">
            ✓ Enviado
          </span>
        </div>
      </div>

      <div className="px-3.5 py-2.5 border-b border-gray-100">
        <p className="text-[10px] text-gray-400 mb-0.5">CLIENTE</p>
        <p className="font-semibold text-[#1C2535] text-xs">Carlos Martínez</p>
        <p className="text-[10px] text-gray-400">622 451 890 · Madrid</p>
      </div>

      <div className="px-3.5 py-2.5">
        <div className="space-y-1.5">
          {[
            { desc: 'Caldera Junkers 24kW', precio: '1.240,00 €' },
            { desc: 'Instalación y montaje', precio: '280,00 €' },
            { desc: 'Material conexiones', precio: '85,00 €' },
            { desc: 'Desplazamiento', precio: '35,00 €' },
          ].map(({ desc, precio }) => (
            <div key={desc} className="flex justify-between text-[10px]">
              <span className="text-gray-500 flex-1 mr-1 truncate">{desc}</span>
              <span className="font-semibold text-[#1C2535] shrink-0">{precio}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>IVA (21%)</span>
            <span>344,40 €</span>
          </div>
          <div className="flex justify-between font-black text-[#1C2535] text-xs">
            <span>TOTAL</span>
            <span>1.984,40 €</span>
          </div>
        </div>

        <div className="mt-2.5 space-y-1.5">
          <button className="w-full bg-[#25D366] text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1">
            <Smartphone className="w-3 h-3" />
            Enviar por WhatsApp
          </button>
          <button className="w-full bg-[#1A5A96] text-white text-[10px] font-bold py-1.5 rounded-lg">
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative h-[520px] lg:h-[560px] w-full max-w-md mx-auto lg:mx-0">
      {/* Installer photo */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
        <img
          src="/instaladorportada.png"
          alt="Instalador profesional"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C2535]/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1A5A96]/10" />
      </div>

      {/* Presupuesto card floating bottom-left */}
      <div className="absolute -bottom-4 -left-4 lg:-left-8 drop-shadow-2xl z-10">
        <PresupuestoCard />
      </div>

      {/* Accepted badge top-right */}
      <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2 z-10">
        <div className="w-6 h-6 rounded-full bg-[#4A6741]/15 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4A6741]" />
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Presupuesto aceptado</p>
          <p className="text-xs font-bold text-[#1C2535]">hace 2 minutos</p>
        </div>
      </div>

      {/* Stats badge bottom-right */}
      <div className="absolute bottom-16 right-4 bg-[#1C2535] rounded-xl shadow-lg px-3 py-2 z-10">
        <p className="text-[10px] text-white/50 mb-0.5">Este mes</p>
        <p className="text-sm font-black text-white">8.340 €</p>
        <p className="text-[10px] text-[#4A6741]">↑ +23% vs anterior</p>
      </div>
    </div>
  );
}

export default function HeroSection({ setCurrentPage }: HeroSectionProps) {
  return (
    <section className="bg-white pt-14 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
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
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
