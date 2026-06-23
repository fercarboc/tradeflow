import { Play, Zap, LayoutDashboard } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

export default function PartnerDemoStrip({ setCurrentPage }: Props) {
  return (
    <section className="bg-[#1C2535] py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Demo guiada 5 min */}
          <div className="relative bg-gradient-to-r from-[#0F1A2E] to-[#131E34] border border-[#1A5A96]/30 rounded-3xl px-7 py-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col h-full gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                  <Zap className="w-3 h-3" />
                  Para socios y distribuidores
                </div>
                <h3 className="text-lg font-black text-white mb-1">Demo guiada — 5 minutos</h3>
                <p className="text-sm text-white/45">
                  Sigue la historia completa de un trabajo: presupuesto, aprobación del cliente, ruta optimizada y factura.
                </p>
              </div>
              <button
                onClick={() => setCurrentPage(ActivePage.PartnerDemo)}
                className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer w-fit"
              >
                <Play className="w-4 h-4" />
                Ver demostración
              </button>
            </div>
          </div>

          {/* Demo sandbox interactiva */}
          <div className="relative bg-gradient-to-r from-[#0F2210] to-[#101F18] border border-emerald-800/30 rounded-3xl px-7 py-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col h-full gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                  <LayoutDashboard className="w-3 h-3" />
                  Panel completo interactivo
                </div>
                <h3 className="text-lg font-black text-white mb-1">Explora el panel</h3>
                <p className="text-sm text-white/45">
                  Navega libremente por todos los módulos: catálogos, planificación, externalizados, proveedores e ingresos.
                </p>
              </div>
              <button
                onClick={() => setCurrentPage(ActivePage.Demo)}
                className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer w-fit"
              >
                <LayoutDashboard className="w-4 h-4" />
                Abrir panel demo
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
