import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import { MobileJobCard } from './MobileSectionEnCurso';

type TimeFilter = 'hoy' | 'semana' | 'todos';

interface Props {
  jobs: TradeJob[];
  selectedDate: string; // 'YYYY-MM-DD'
  onBack: () => void;
  onJobClick: (job: TradeJob) => void;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function MobileSectionPlanificados({ jobs, selectedDate, onBack, onJobClick }: Props) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('todos');

  const todayStr = selectedDate;
  const weekEndStr = addDays(selectedDate, 6);

  const filtered = jobs
    .filter(j => {
      if (!j.fecha_inicio) return timeFilter === 'todos';
      if (timeFilter === 'hoy') return j.fecha_inicio === todayStr;
      if (timeFilter === 'semana') return j.fecha_inicio >= todayStr && j.fecha_inicio <= weekEndStr;
      return true;
    })
    .sort((a, b) => {
      const fa = a.fecha_inicio ?? '';
      const fb = b.fecha_inicio ?? '';
      if (fa !== fb) return fa.localeCompare(fb);
      return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
    });

  const filters: { id: TimeFilter; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'todos', label: 'Todos' },
  ];

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
        <h2 className="font-bold text-sm text-slate-900 dark:text-white">Planificados</h2>
        {filtered.length > 0 && (
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setTimeFilter(f.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              timeFilter === f.id
                ? 'bg-blue-600 text-white border-transparent'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-blue-300 dark:text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {timeFilter === 'hoy' ? 'Sin planificados para hoy' : timeFilter === 'semana' ? 'Sin planificados esta semana' : 'No hay trabajos planificados'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Los trabajos programados aparecerán aquí</p>
          </div>
        ) : (
          filtered.map(job => <MobileJobCard key={job.id} job={job} onClick={() => onJobClick(job)} />)
        )}
      </div>
    </div>
  );
}
