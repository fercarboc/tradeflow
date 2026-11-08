import { ChevronLeft, Navigation } from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import { MobileJobCard } from './MobileSectionEnCurso';

interface Props {
  jobs: TradeJob[];
  selectedDate: string; // 'YYYY-MM-DD'
  onBack: () => void;
  onJobClick: (job: TradeJob) => void;
  onViewRoute?: (fecha: string) => void;
}

export default function MobileSectionRuta({ jobs, selectedDate, onBack, onJobClick, onViewRoute }: Props) {
  const todayStr = selectedDate;
  const todayJobs = jobs
    .filter(j => j.fecha_inicio === todayStr)
    .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''));

  const [y, m, d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium cursor-pointer"
          aria-label="Volver"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </button>
        <div>
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">Ruta del día</h2>
          <p className="text-[10px] text-slate-400 capitalize">{dateLabel}</p>
        </div>
        {onViewRoute && todayJobs.length > 0 && (
          <button
            onClick={() => onViewRoute(todayStr)}
            className="ml-auto flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
          >
            <Navigation className="w-3 h-3" />
            Ver mapa
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {todayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-emerald-300 dark:text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sin trabajos para hoy</p>
            <p className="text-xs text-slate-400 mt-1 capitalize">{dateLabel}</p>
          </div>
        ) : (
          todayJobs.map(job => <MobileJobCard key={job.id} job={job} onClick={() => onJobClick(job)} />)
        )}
      </div>
    </div>
  );
}
