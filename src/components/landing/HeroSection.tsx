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

const BUDGET_ITEMS = [
  { desc: 'Mano de obra (8h × 45 €/h)', precio: '360,00 €' },
  { desc: 'Desmontaje y retirada bañera', precio: '80,00 €' },
  { desc: 'Plato ducha antidesliz. 80×80', precio: '320,00 €' },
  { desc: 'Mampara cristal templado 6mm', precio: '280,00 €' },
  { desc: 'Grifería termoestática', precio: '195,00 €' },
  { desc: 'Materiales e instalación', precio: '85,00 €' },
  { desc: 'Desplazamiento', precio: '35,00 €' },
];

function PresupuestoCard() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-sm w-full">
      {/* Titlebar */}
      <div className="bg-[#1C2535] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <span className="text-[9px] text-white/35 font-medium tracking-wide">TradeFlow · Presupuesto</span>
        <div className="w-10" />
      </div>

      {/* Doc header */}
      <div className="px-4 py-2.5 bg-[#F5F6F8] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Presupuesto</p>
            <p className="font-black text-[#1C2535] text-sm leading-tight">#P-2025-0247</p>
          </div>
          <span className="text-[9px] font-bold bg-[#4A6741]/12 text-[#4A6741] px-2 py-1 rounded-full border border-[#4A6741]/20">
            ✓ Enviado
          </span>
        </div>
      </div>

      {/* Client */}
      <div className="px-4 pt-2.5 pb-2 border-b border-gray-100">
        <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Cliente</p>
        <p className="font-bold text-[#1C2535] text-xs">María García</p>
        <p className="text-[9px] text-gray-400">622 451 890 · C/ Valencia 245, Madrid</p>
        <p className="text-[9px] text-[#1A5A96] font-semibold mt-1">
          Cambio de bañera por plato de ducha
        </p>
      </div>

      {/* Items */}
      <div className="px-4 py-2.5">
        <div className="space-y-1.5">
          {BUDGET_ITEMS.map(({ desc, precio }) => (
            <div key={desc} className="flex justify-between items-baseline gap-1">
              <span className="text-[9px] text-gray-500 flex-1 truncate">{desc}</span>
              <span className="text-[9px] font-semibold text-[#1C2535] shrink-0 tabular-nums">{precio}</span>
            </div>
          ))}
        </div>

        <div className="mt-2.5 pt-2 border-t border-gray-200 space-y-1">
          <div className="flex justify-between text-[9px] text-gray-400">
            <span>Base imponible</span>
            <span className="tabular-nums">1.355,00 €</span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-400">
            <span>IVA (10% reforma)</span>
            <span className="tabular-nums">135,50 €</span>
          </div>
          <div className="flex justify-between font-black text-[#1C2535] text-xs pt-1 border-t border-gray-200">
            <span>TOTAL</span>
            <span className="tabular-nums">1.490,50 €</span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <button className="w-full bg-[#25D366] text-white text-[9px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5">
            <Smartphone className="w-3 h-3" />
            Enviar por WhatsApp
          </button>
          <button className="w-full bg-[#1A5A96] text-white text-[9px] font-bold py-2 rounded-lg">
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection({ setCurrentPage }: HeroSectionProps) {
  return (
    <section className="bg-white pt-6 pb-10 lg:pt-8 lg:pb-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Mobile / Tablet: stacked */}
        <div className="lg:hidden flex flex-col gap-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/8 text-[#1A5A96] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A5A96] animate-pulse" />
              Beta abierta — Únete gratis hoy
            </div>
            <h1 className="text-4xl font-black text-[#1C2535] leading-[1.1] mb-4">
              La app que necesita{' '}
              <span className="text-[#1A5A96]">tu negocio</span>{' '}
              de instalaciones
            </h1>
            <p className="text-base text-[#1C2535]/60 leading-relaxed mb-6">
              Presupuestos profesionales, planificación de rutas y normativa técnica con IA. Todo en una app, sin papeles.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="flex items-center justify-center gap-2 bg-[#1A5A96] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg cursor-pointer"
              >
                Empezar gratis <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(ActivePage.ComoFunciona)}
                className="flex items-center justify-center text-[#1C2535] font-semibold text-sm px-6 py-3 rounded-xl border border-[#1C2535]/15 cursor-pointer"
              >
                Ver cómo funciona
              </button>
            </div>
          </div>
          <div className="max-w-xs mx-auto w-full">
            <PresupuestoCard />
          </div>
        </div>

        {/* Desktop: 3-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[1.9fr_1.6fr_1fr] lg:gap-8 xl:gap-12 items-end">

          {/* Col 1: Text */}
          <div className="pb-4">
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/8 text-[#1A5A96] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A5A96] animate-pulse" />
              Beta abierta — Únete gratis hoy
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-[#1C2535] leading-[1.05] mb-5">
              La app que necesita{' '}
              <span className="text-[#1A5A96]">tu negocio</span>{' '}
              de instalaciones
            </h1>

            <p className="text-base xl:text-lg text-[#1C2535]/55 leading-relaxed mb-7">
              Presupuestos profesionales, planificación de rutas y normativa técnica con IA. Todo en una app, sin papeles, sin complicaciones.
            </p>

            <ul className="space-y-2.5 mb-8">
              {CHECKS.map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#4A6741] shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-[#1C2535]/75">{text}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="flex items-center gap-2 bg-[#1A5A96] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#1A5A96]/90 transition-all shadow-lg hover:shadow-xl cursor-pointer"
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(ActivePage.ComoFunciona)}
                className="flex items-center text-[#1C2535] font-semibold text-sm px-6 py-3 rounded-xl border border-[#1C2535]/15 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Ver cómo funciona
              </button>
            </div>

            <p className="mt-3 text-xs text-[#1C2535]/35">
              Sin tarjeta de crédito · Prueba gratuita 3 meses
            </p>
          </div>

          {/* Col 2: Installer photo — full, no crop */}
          <div className="flex items-end">
            <div className="w-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
              <img
                src="/instaladorportada.png"
                alt="Instalador profesional"
                className="w-full h-auto block"
                style={{ maxHeight: '520px', objectFit: 'cover', objectPosition: 'center top' }}
              />
            </div>
          </div>

          {/* Col 3: Presupuesto card */}
          <div className="flex items-end">
            <div className="w-full">
              <PresupuestoCard />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
