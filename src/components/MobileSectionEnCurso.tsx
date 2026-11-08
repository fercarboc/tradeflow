import { ChevronLeft } from 'lucide-react';
import type { TradeJob } from '../lib/supabase';

interface Props {
  jobs: TradeJob[];
  onBack: () => void;
  onJobClick: (job: TradeJob) => void;
}

export default function MobileSectionEnCurso({ jobs, onBack, onJobClick }: Props) {
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
        <h2 className="font-bold text-sm text-slate-900 dark:text-white">En curso</h2>
        {jobs.length > 0 && (
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
            {jobs.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No hay trabajos en curso</p>
            <p className="text-xs text-slate-400 mt-1">Los trabajos activos aparecerán aquí</p>
          </div>
        ) : (
          jobs.map(job => <MobileJobCard key={job.id} job={job} onClick={() => onJobClick(job)} />)
        )}
      </div>
    </div>
  );
}

export function MobileJobCard({ job, onClick }: { job: TradeJob; onClick: () => void }) {
  const clientName = job.trade_clients?.nombre ?? null;
  const workers = job.trade_job_workers ?? [];
  const responsable = workers.find(w => w.rol === 'responsable') ?? workers[0];

  const fechaFmt = job.fecha_inicio
    ? new Date(job.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">{job.titulo}</p>
          {clientName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{clientName}</p>
          )}
        </div>
        {job.prioridad === 'urgente' && (
          <span className="shrink-0 text-[9px] font-bold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded">
            Urgente
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        {fechaFmt && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {fechaFmt}
            {job.hora_inicio && ` · ${job.hora_inicio}`}
          </span>
        )}
        {responsable && (
          <span className="flex items-center gap-1 truncate">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="truncate">{responsable.trade_workers?.nombre ?? 'Sin asignar'}</span>
          </span>
        )}
        {workers.length === 0 && (
          <span className="text-orange-400 dark:text-orange-500">Sin asignar</span>
        )}
      </div>
    </button>
  );
}
