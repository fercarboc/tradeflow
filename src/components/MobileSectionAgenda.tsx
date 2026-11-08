import { ChevronLeft } from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import MonthCalendar from './MonthCalendar';

interface MobileSectionAgendaProps {
  jobs: TradeJob[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  jobDates: Set<string>;
  onBack: () => void;
  onJobClick: (job: TradeJob) => void;
}

const ESTADO_LABEL: Record<string, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  completado: 'Completado',
  cancelado: 'Cancelado',
  pendiente_material: 'Pdte. material',
  no_realizado: 'No realizado',
  pausado_continua: 'Pausado',
  bloqueado_espera_material: 'Espera material',
};

function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function MobileSectionAgenda({
  jobs,
  selectedDate,
  onDateSelect,
  jobDates,
  onBack,
  onJobClick,
}: MobileSectionAgendaProps) {
  const dayJobs = jobs.filter(j => j.fecha_inicio?.startsWith(selectedDate));
  const dateLabel = formatDateLabel(selectedDate);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white sticky top-0">
        <button onClick={onBack} className="flex items-center gap-1 text-blue-600 text-sm font-medium cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <h2 className="font-bold text-sm text-slate-900">Agenda mensual</h2>
      </div>
      <div className="overflow-y-auto flex-1 pb-6">
        <div className="px-2 pt-2">
          <MonthCalendar
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            jobDates={jobDates}
          />
        </div>
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 capitalize">
            {dateLabel}
          </p>
          {dayJobs.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Sin trabajos este día</p>
          ) : (
            <div className="space-y-2">
              {dayJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => onJobClick(job)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{job.titulo}</p>
                  {job.trade_clients?.nombre && (
                    <p className="text-xs text-slate-500 mt-0.5">{job.trade_clients.nombre}</p>
                  )}
                  <span className="inline-block mt-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {ESTADO_LABEL[job.estado] ?? job.estado}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
