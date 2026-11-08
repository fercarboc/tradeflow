import type { PresupuestoPendiente } from './ScreenPlanificacion';

export type MobileSection = 'en-curso' | 'planificados' | 'ruta' | 'pendientes' | 'partes' | 'agenda';

interface MobileWorkHubProps {
  inProgressCount: number;
  scheduledCount: number;
  pendingCount: number;
  onNavigate: (section: MobileSection) => void;
  selectedDate: string; // 'YYYY-MM-DD'
}

interface HubCard {
  id: MobileSection;
  label: string;
  sublabel?: string;
  count?: number;
  ready: boolean;
  icon: React.ReactNode;
  color: string;
}

export default function MobileWorkHub({
  inProgressCount,
  scheduledCount,
  pendingCount,
  onNavigate,
  selectedDate: _selectedDate,
}: MobileWorkHubProps) {
  const cards: HubCard[] = [
    {
      id: 'en-curso',
      label: 'En curso',
      count: inProgressCount,
      sublabel: inProgressCount === 1 ? '1 trabajo activo' : `${inProgressCount} trabajos activos`,
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
      ),
    },
    {
      id: 'planificados',
      label: 'Planificados',
      count: scheduledCount,
      sublabel: scheduledCount === 1 ? '1 trabajo' : `${scheduledCount} trabajos`,
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      ),
    },
    {
      id: 'ruta',
      label: 'Ruta del día',
      sublabel: 'Hoy',
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
        </svg>
      ),
    },
    {
      id: 'pendientes',
      label: 'Pendientes',
      count: pendingCount,
      sublabel: pendingCount === 1 ? '1 presupuesto' : `${pendingCount} presupuestos`,
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>
      ),
    },
    {
      id: 'partes',
      label: 'Partes',
      sublabel: 'Gestión de partes',
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
    {
      id: 'agenda',
      label: 'Agenda',
      sublabel: 'Calendario mensual',
      ready: true,
      color: 'bg-blue-50 border-blue-200',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">Trabajos</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => card.ready && onNavigate(card.id)}
            className={`relative flex flex-col items-start gap-2 min-h-[120px] p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
              card.ready
                ? `${card.color} cursor-pointer hover:shadow-md`
                : 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              {card.icon}
              {card.count !== undefined && card.count > 0 && (
                <span className="text-xs font-bold bg-white/80 rounded-full px-2 py-0.5 text-slate-700 shadow-sm">
                  {card.count}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-900 leading-tight">{card.label}</p>
              {card.sublabel && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{card.sublabel}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
