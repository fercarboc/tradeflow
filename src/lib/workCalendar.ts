// Calendario laboral — gestión de días de trabajo, festivos y vacaciones
// Almacenado en localStorage: tf_work_calendar

export interface WorkDayConfig {
  active: boolean;
  start: string; // "08:00"
  end: string;   // "20:00"
}

export interface HolidayEntry {
  id: string;
  date: string;      // "YYYY-MM-DD" si no es recurrente, "MM-DD" si es recurrente
  name: string;
  recurring: boolean; // true = se repite cada año
}

export interface WorkCalendar {
  workDays: Record<number, WorkDayConfig>; // 0=Dom, 1=Lun, ..., 6=Sáb
  holidays: HolidayEntry[];
}

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DEFAULT_CALENDAR: WorkCalendar = {
  workDays: {
    0: { active: false, start: '08:00', end: '20:00' }, // Domingo — cerrado
    1: { active: true,  start: '08:00', end: '20:00' }, // Lunes
    2: { active: true,  start: '08:00', end: '20:00' }, // Martes
    3: { active: true,  start: '08:00', end: '20:00' }, // Miércoles
    4: { active: true,  start: '08:00', end: '20:00' }, // Jueves
    5: { active: true,  start: '08:00', end: '20:00' }, // Viernes
    6: { active: true,  start: '08:00', end: '14:00' }, // Sábado — mañana
  },
  holidays: [],
};

export function loadWorkCalendar(): WorkCalendar {
  try {
    const stored = localStorage.getItem('tf_work_calendar');
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<WorkCalendar>;
      return {
        workDays: { ...DEFAULT_CALENDAR.workDays, ...(parsed.workDays ?? {}) },
        holidays: parsed.holidays ?? [],
      };
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_CALENDAR);
}

export function saveWorkCalendar(cal: WorkCalendar): void {
  localStorage.setItem('tf_work_calendar', JSON.stringify(cal));
}

/** Devuelve true si la fecha (YYYY-MM-DD) es día laborable según el calendario */
export function isWorkingDay(dateStr: string, cal: WorkCalendar): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay();
  if (!cal.workDays[dow]?.active) return false;
  const mmdd = dateStr.slice(5); // MM-DD
  return !cal.holidays.some(h =>
    (h.recurring && h.date === mmdd) ||
    (!h.recurring && h.date === dateStr)
  );
}

/** Devuelve el siguiente día laborable DESPUÉS de fromDate (YYYY-MM-DD) */
export function getNextWorkingDay(fromDate: string, cal: WorkCalendar): string {
  const date = new Date(fromDate + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    date.setDate(date.getDate() + 1);
    const ds = date.toISOString().split('T')[0];
    if (isWorkingDay(ds, cal)) return ds;
  }
  return fromDate; // fallback (nunca debería llegar aquí)
}

/** Festivos nacionales españoles predefinidos (recurrentes) */
export const FESTIVOS_NACIONALES: Omit<HolidayEntry, 'id'>[] = [
  { date: '01-01', name: 'Año Nuevo',                     recurring: true },
  { date: '01-06', name: 'Reyes Magos',                   recurring: true },
  { date: '05-01', name: 'Día del Trabajador',            recurring: true },
  { date: '10-12', name: 'Fiesta Nacional de España',     recurring: true },
  { date: '11-01', name: 'Todos los Santos',              recurring: true },
  { date: '12-06', name: 'Día de la Constitución',        recurring: true },
  { date: '12-08', name: 'Inmaculada Concepción',         recurring: true },
  { date: '12-24', name: 'Nochebuena',                    recurring: true },
  { date: '12-25', name: 'Navidad',                       recurring: true },
  { date: '12-31', name: 'Nochevieja',                    recurring: true },
];
