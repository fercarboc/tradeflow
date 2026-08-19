import {
  FileText,
  Briefcase,
  ShoppingCart,
  Store,
  PackageCheck,
  Wrench,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';

const STEPS = [
  { icon: FileText,      label: 'Presupuesto',    color: '#1A5A96', desc: 'Crea en minutos con IA de voz' },
  { icon: Briefcase,     label: 'Trabajo',         color: '#C8922A', desc: 'Planifica y asigna al equipo' },
  { icon: ShoppingCart,  label: 'Materiales',      color: '#1A7A5A', desc: 'Detecta lo que necesitas' },
  { icon: Store,         label: 'Marketplace',     color: '#1A5A96', desc: 'Busca y compara proveedores' },
  { icon: PackageCheck,  label: 'Pedido',          color: '#7C3AED', desc: 'Genera el pedido con un toque' },
  { icon: Wrench,        label: 'Ejecución',       color: '#C8922A', desc: 'Ejecuta el trabajo en campo' },
  { icon: ClipboardCheck,label: 'Parte + Firma',   color: '#4A6741', desc: 'Documenta y firma digital' },
  { icon: Receipt,       label: 'Factura',         color: '#B84E35', desc: 'Cobra y cierra el ciclo' },
];

export default function EcosistemaSection() {
  return (
    <section className="bg-white py-20 lg:py-28 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1A5A96] mb-3">Flujo completo</p>
          <h2 className="text-3xl lg:text-4xl font-black text-[#1C2535] mb-4">
            Presupuesta. Compra. Ejecuta. Cobra.
          </h2>
          <p className="text-[#1C2535]/55 max-w-2xl mx-auto leading-relaxed">
            TrabFlow conecta cada paso del trabajo de un instalador profesional,
            desde el primer presupuesto hasta el cobro final.
          </p>
        </div>

        {/* Desktop: fila horizontal */}
        <div className="hidden lg:flex items-start gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1 group">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-sm transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${step.color}12` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <p className="text-xs font-black text-[#1C2535] text-center mb-1">{step.label}</p>
                  <p className="text-[10px] text-[#1C2535]/45 text-center leading-snug max-w-[80px]">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex items-center mt-5 shrink-0">
                    <svg width="28" height="12" viewBox="0 0 28 12" fill="none" className="opacity-25">
                      <path d="M0 6h22M22 6l-5-5M22 6l-5 5" stroke="#1C2535" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: cuadrícula 2×4 con flechas verticales */}
        <div className="lg:hidden grid grid-cols-2 gap-x-4 gap-y-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="relative flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm"
                  style={{ backgroundColor: `${step.color}12` }}
                >
                  <Icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <p className="text-xs font-black text-[#1C2535] mb-0.5">{step.label}</p>
                <p className="text-[10px] text-[#1C2535]/45 leading-snug">{step.desc}</p>
                {/* Flecha hacia abajo entre filas */}
                {i < STEPS.length - 2 && (i % 2 === 1) && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[#1C2535]/20 text-xs">↓</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota sobre Marketplace */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex items-center gap-2.5 bg-[#1A5A96]/6 border border-[#1A5A96]/15 rounded-2xl px-5 py-3">
            <Store className="w-4 h-4 text-[#1A5A96] shrink-0" />
            <p className="text-sm text-[#1C2535]/65 leading-snug">
              <span className="font-bold text-[#1A5A96]">Marketplace</span> incluido —
              {' '}conecta el presupuesto con la compra de materiales sin salir de TrabFlow.{' '}
              <span className="text-[#1C2535]/40 text-xs">Fase de validación.</span>
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
