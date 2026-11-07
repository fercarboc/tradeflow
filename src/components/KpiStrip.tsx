import { Clock, CalendarDays, Zap, AlertTriangle } from 'lucide-react';

interface KpiStripProps {
  pendingCount: number;    // presupuestos aceptados sin programar (global)
  todayJobsCount: number;  // trabajos en el día seleccionado
  inProgressCount: number; // trabajos en curso ahora (todos los días)
  unassignedCount: number; // trabajos del día sin trabajador asignado
  selectedDate: string;    // "YYYY-MM-DD" — para etiqueta del día
}

function fmt(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

interface TileProps { icon: React.ReactNode; label: string; value: number; accent?: string }

function Tile({ icon, label, value, accent = 'text-slate-700 dark:text-slate-200' }: TileProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 min-w-0">
      <div className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</div>
      <div className="min-w-0">
        <div className={`text-sm font-black leading-none ${accent}`}>{value}</div>
        <div className="text-[9px] text-slate-400 uppercase tracking-wide font-bold truncate mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function KpiStrip({
  pendingCount, todayJobsCount, inProgressCount, unassignedCount, selectedDate,
}: KpiStripProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Tile
        icon={<Clock className="w-3.5 h-3.5" />}
        label="Pdte. planificar"
        value={pendingCount}
        accent={pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
      />
      <Tile
        icon={<CalendarDays className="w-3.5 h-3.5" />}
        label={`Trabajos ${fmt(selectedDate)}`}
        value={todayJobsCount}
        accent="text-blue-600 dark:text-blue-400"
      />
      <Tile
        icon={<Zap className="w-3.5 h-3.5" />}
        label="En curso"
        value={inProgressCount}
        accent={inProgressCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined}
      />
      <Tile
        icon={<AlertTriangle className="w-3.5 h-3.5" />}
        label={`Sin asignar ${fmt(selectedDate)}`}
        value={unassignedCount}
        accent={unassignedCount > 0 ? 'text-orange-600 dark:text-orange-400' : undefined}
      />
    </div>
  );
}
