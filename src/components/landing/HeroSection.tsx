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
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100/80 overflow-hidden text-sm backdrop-blur-sm">
      {/* Titlebar */}
      <div className="bg-[#1C2535] px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <span className="text-[9px] text-white/35 font-medium tracking-wide">TradeFlow · Presupuesto</span>
        <div className="w-8" />
      </div>

      {/* Doc header */}
      <div className="px-4 py-2.5 bg-[#F5F6F8] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider leading-none mb-0.5">Presupuesto</p>
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
        <p className="font-bold text-[#1C2535] text-xs leading-tight">María García</p>
        <p className="text-[9px] text-gray-400">622 451 890 · C/ Valencia 245</p>
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
          <div className="flex justify-between font-black text-[#1C2535] text-xs pt-1.5 border-t border-gray-200">
            <span>TOTAL</span>
            <span className="tabular-nums text-sm">1.490,50 €</span>
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
    <section className="bg-white pt-6 pb-10 lg:pt-8 lg:pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Desktop: 2-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[44%_56%] gap-0 items-center">

          {/* Col 1: Text */}
          <div className="pr-10 xl:pr-14">
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/8 text-[#1A5A96] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A5A96] animate-pulse" />
              Beta abierta — Únete gratis hoy
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-[#1C2535] leading-[1.05] mb-5 tracking-tight">
              La app que necesita{' '}
              <span className="text-[#1A5A96]">tu negocio</span>{' '}
              de instalaciones
            </h1>

            <p className="text-base xl:text-lg text-[#1C2535]/55 leading-relaxed mb-7">
              Presupuestos profesionales, planificación de rutas y normativa técnica con IA. Todo en una app, sin papeles, sin complicaciones.
            </p>

            <ul className="space-y-2.5 mb-8">
              {CHECKS.map((text) => (
                <li key={text} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#4A6741] shrink-0" />
                  <span className="text-sm font-medium text-[#1C2535]/75">{text}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="flex items-center gap-2 bg-[#1A5A96] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#1A5A96]/90 transition-all shadow-lg cursor-pointer"
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

          {/* Col 2: Large photo + floating card */}
          <div className="relative">
            {/* Installer photo — full size, dominant */}
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/8">
              <img
                src="/instaladorportada.png"
                alt="Instalador profesional"
                className="w-full block"
                style={{
                  height: '580px',
                  objectFit: 'cover',
                  objectPosition: 'center 12%',
                }}
              />
              {/* Gradient: transparent left → dark right, for card readability */}
              <div
                className="absolute inset-0 pointer-events-none rounded-3xl"
                style={{
                  background:
                    'linear-gradient(to right, transparent 30%, rgba(10, 14, 28, 0.72) 100%)',
                }}
              />
            </div>

            {/* Presupuesto card — floats over right edge of photo */}
            <div
              className="absolute z-10"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                right: '20px',
                width: '256px',
              }}
            >
              <PresupuestoCard />
            </div>
          </div>
        </div>

        {/* Mobile / Tablet: stacked */}
        <div className="lg:hidden flex flex-col gap-7">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/8 text-[#1A5A96] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A5A96] animate-pulse" />
              Beta abierta — Únete gratis hoy
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#1C2535] leading-[1.1] mb-4">
              La app que necesita{' '}
              <span className="text-[#1A5A96]">tu negocio</span>{' '}
              de instalaciones
            </h1>
            <p className="text-base text-[#1C2535]/55 leading-relaxed mb-6">
              Presupuestos profesionales, planificación de rutas y normativa técnica con IA.
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

          {/* Mobile: photo with floating card */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img
                src="/instaladorportada.png"
                alt="Instalador profesional"
                className="w-full block"
                style={{ height: '320px', objectFit: 'cover', objectPosition: 'center 12%' }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, transparent 20%, rgba(10,14,28,0.75) 100%)',
                }}
              />
            </div>
            <div
              className="absolute z-10"
              style={{ top: '50%', transform: 'translateY(-50%)', right: '12px', width: '200px' }}
            >
              <PresupuestoCard />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
