import React, { useState } from 'react';
import { Route, Map, CalendarDays } from 'lucide-react';
import ScreenTransporteMapaServicios from './ScreenTransporteMapaServicios';
import ScreenTransporteRutasRecurrentes from './ScreenTransporteRutasRecurrentes';

// Re-exports so scheduleManagement.test.ts imports keep working
export {
  buildCalendarProjection,
  getAvailableTransitions,
  applyTransition,
  fmtHora,
  filterSchedules,
} from './ScreenTransporteRutasRecurrentes';
export type {
  CalendarOccurrence,
  ScheduleTransition,
  ScheduleFilterOptions,
} from './ScreenTransporteRutasRecurrentes';

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = 'mapa' | 'recurrentes';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
  initialServiceId?: string | null;
  onConsumeInitialServiceId?: () => void;
}

// ── Module-level sub-components ───────────────────────────────────────────────

interface MainTabBarProps {
  active: MainTab;
  onChange: (t: MainTab) => void;
}

function MainTabBar({ active, onChange }: MainTabBarProps) {
  return (
    <div className="flex gap-1 bg-white/60 rounded-lg p-0.5">
      <button
        onClick={() => onChange('mapa')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
          ${active === 'mapa'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'}`}
      >
        <Map className="w-3.5 h-3.5" />
        Mapa de servicios
      </button>
      <button
        onClick={() => onChange('recurrentes')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
          ${active === 'recurrentes'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'}`}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        Rutas recurrentes
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScreenTransporteRutas({
  orgId, showToast, onNavigate, initialServiceId, onConsumeInitialServiceId,
}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('mapa');

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Route className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Rutas</h1>
          </div>
          <MainTabBar active={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'mapa' ? (
          <ScreenTransporteMapaServicios
            orgId={orgId}
            showToast={showToast}
            onNavigate={onNavigate}
            initialServiceId={initialServiceId}
            onConsumeInitialServiceId={onConsumeInitialServiceId}
          />
        ) : (
          <ScreenTransporteRutasRecurrentes
            orgId={orgId}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
