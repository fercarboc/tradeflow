import { ChevronLeft } from 'lucide-react';
import type { PresupuestoPendiente } from './ScreenPlanificacion';
import { FileText } from 'lucide-react';

interface Props {
  presupuestos: PresupuestoPendiente[];
  onBack: () => void;
  onProgramar: (quote: PresupuestoPendiente) => void;
}

export default function MobileSectionPendientes({ presupuestos, onBack, onProgramar }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden min-h-0">
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
        <h2 className="font-bold text-sm text-slate-900 dark:text-white">Pendientes de planificar</h2>
        {presupuestos.length > 0 && (
          <span className="ml-auto text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-bold px-2 py-0.5 rounded-full">
            {presupuestos.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {presupuestos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet-300 dark:text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sin presupuestos pendientes</p>
            <p className="text-xs text-slate-400 mt-1">Todos los presupuestos aceptados han sido programados</p>
          </div>
        ) : (
          presupuestos.map(q => (
            <div key={q.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">
                    {q.descripcion || '—'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{q.nombreCliente}</p>
                </div>
                {q.total > 0 && (
                  <span className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {q.total.toLocaleString('es-ES', { minimumFractionDigits: 0 })}€
                  </span>
                )}
              </div>
              <button
                onClick={() => onProgramar(q)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Programar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
