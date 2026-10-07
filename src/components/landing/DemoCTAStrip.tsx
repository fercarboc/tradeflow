import { Play, Download } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

export default function DemoCTAStrip({ setCurrentPage }: Props) {
  return (
    <section
      id="demo-cta-strip"
      className="bg-[#0a1526] border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-3xl flex flex-col items-center gap-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/35">
          Conoce TrabFlow en acción
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
          <button
            id="demo-cta-strip-demo"
            onClick={() => setCurrentPage(ActivePage.PartnerDemo)}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-[#1A5A96] hover:bg-[#1868B0] px-7 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-[#1A5A96]/25 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00CFE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1526]"
            aria-label="Ver demo guiada de TrabFlow — 5 minutos"
          >
            <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
            Ver demo guiada
          </button>
          <a
            id="demo-cta-strip-video"
            href="/trabflow.mp4"
            download
            className="flex items-center justify-center gap-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-7 py-3.5 text-sm font-bold text-white/70 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1526]"
            aria-label="Descargar vídeo de presentación de TrabFlow"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Descargar vídeo de presentación
          </a>
        </div>
      </div>
    </section>
  );
}
