import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_HEADERS = ['L','M','X','J','V','S','D'];

interface MonthCalendarProps {
  selectedDate: string;             // "YYYY-MM-DD"
  onDateSelect: (date: string) => void;
  jobDates: Set<string>;            // "YYYY-MM-DD"
  className?: string;
}

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string {
  return toLocalStr(new Date());
}

function getDaysInMonth(year: number, month: number): Array<{ date: string; isCurrentMonth: boolean }> {
  const days: Array<{ date: string; isCurrentMonth: boolean }> = [];
  const firstDay = new Date(year, month, 1);
  // Monday-first grid: getDay() 0=Sun→7, 1=Mon→1, …
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  const startOffset = startDow - 1;

  // Days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: toLocalStr(d), isCurrentMonth: false });
  }

  // Days of current month
  const daysCount = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysCount; i++) {
    days.push({ date: toLocalStr(new Date(year, month, i)), isCurrentMonth: true });
  }

  // Trailing days to complete last row
  let fill = 1;
  while (days.length % 7 !== 0) {
    days.push({ date: toLocalStr(new Date(year, month + 1, fill++)), isCurrentMonth: false });
  }

  return days;
}

export default function MonthCalendar({
  selectedDate, onDateSelect, jobDates, className,
}: MonthCalendarProps) {
  const parts = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear]   = useState(parts[0]);
  const [viewMonth, setViewMonth] = useState(parts[1] - 1);

  // Sync view when selectedDate changes to a different month (e.g. external navigation)
  useEffect(() => {
    const p = selectedDate.split('-').map(Number);
    setViewYear(p[0]);
    setViewMonth(p[1] - 1);
  }, [selectedDate]);

  const today = todayStr();
  const days  = getDaysInMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onDateSelect(toLocalStr(now));
  };

  const handleDay = (date: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      const p = date.split('-').map(Number);
      setViewYear(p[0]);
      setViewMonth(p[1] - 1);
    }
    onDateSelect(date);
  };

  return (
    <div className={className ?? 'px-2 py-1'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={prevMonth}
          aria-label="Mes anterior"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={goToday}
            className="text-[9px] font-bold uppercase text-blue-600 hover:text-blue-800 dark:text-blue-400 cursor-pointer"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={nextMonth}
          aria-label="Mes siguiente"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-slate-400 uppercase py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map(({ date, isCurrentMonth }) => {
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const hasJobs    = jobDates.has(date);

          return (
            <button
              key={date}
              onClick={() => handleDay(date, isCurrentMonth)}
              data-date={date}
              className={`
                relative flex flex-col items-center justify-center h-9 w-full rounded-lg cursor-pointer transition-colors text-[11px] font-semibold
                ${isSelected
                  ? 'bg-blue-600 text-white'
                  : isToday
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700'
                    : isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
              `}
            >
              {new Date(date + 'T12:00:00').getDate()}
              {hasJobs && (
                <div className={`absolute bottom-1 w-1 h-1 rounded-full ${
                  isSelected ? 'bg-blue-200' : 'bg-blue-500 dark:bg-blue-400'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
