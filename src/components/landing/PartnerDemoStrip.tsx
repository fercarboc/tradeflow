import { Play, Zap } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

export default function PartnerDemoStrip({ setCurrentPage }: Props) {
  return (
    <section className="bg-[#1C2535] py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gradient-to-r from-[#0F1A2E] to-[#131E34] border border-[#1A5A96]/30 rounded-3xl px-8 py-10 overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Icon */}
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
              <Play className="w-7 h-7 text-white ml-0.5" />
            </div>

            {/* Text */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                <Zap className="w-3 h-3" />
                Para socios y distribuidores
              </div>
              <h3 className="text-xl font-black text-white mb-1">
                Demo interactiva — 5 minutos
              </h3>
              <p className="text-sm text-white/45 max-w-md">
                Sigue la historia completa de un trabajo: presupuesto, aprobación del cliente, ruta optimizada y factura. Todo desde la IA.
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <button
                onClick={() => setCurrentPage(ActivePage.PartnerDemo)}
                className="group flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Ver demostración
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
