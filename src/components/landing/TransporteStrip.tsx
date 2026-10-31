import { ArrowRight } from 'lucide-react';
import { ActivePage } from '../../types';

interface TransporteStripProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function TransporteStrip({ setCurrentPage }: TransporteStripProps) {
  return (
    <section
      id="transport-section"
      className="bg-[#020B16] py-16 px-4 sm:px-6 lg:px-8"
      aria-labelledby="transport-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-[#FFC400]/20 bg-gradient-to-br from-[#111008] to-[#0a0d12] p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#FFC400]/30 bg-[#FFC400]/10 px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC400]">
                Nueva vertical
              </span>
            </div>
            <h2
              id="transport-heading"
              className="text-2xl font-black text-white mb-3"
            >
              TrabFlow para empresas de transporte
            </h2>
            <p className="text-sm leading-relaxed text-white/55 max-w-lg mb-5">
              Gestión de flota, conductores, rutas y agenda de servicios para autobuses y autocares.
              Desde{' '}
              <span className="font-bold text-[#FFC400]">29 €/vehículo/mes</span>{' '}
              con hasta 2 conductores incluidos.
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage(ActivePage.Transporte)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-6 py-3 text-sm font-black text-[#020B16] transition hover:brightness-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020B16]"
            >
              Descubrir TrabFlow Transporte
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="shrink-0 hidden sm:flex flex-col gap-2 text-sm">
            {[
              'Flota y vehículos',
              'Conductores',
              'Rutas y partes de servicio',
              'Presupuestos con IA',
              'Control de costes',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/60">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#FFC400]/70 shrink-0"
                  aria-hidden="true"
                />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
