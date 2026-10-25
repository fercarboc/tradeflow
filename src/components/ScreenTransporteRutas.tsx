import React from 'react';
import { Route, MapPin, Calendar, Bus, ChevronRight, Clock } from 'lucide-react';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
}

export default function ScreenTransporteRutas({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
            <Route size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Rutas</h1>
            <p className="text-xs text-slate-400">Planificación y seguimiento de rutas de transporte</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Empty state principal */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* Área del mapa placeholder */}
          <div className="relative bg-slate-100 h-64 flex flex-col items-center justify-center gap-4">
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            {/* Línea de ruta decorativa */}
            <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
              <path d="M 60,200 Q 200,80 340,160 Q 480,240 620,100 Q 760,20 900,140"
                fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="12 6" />
              <circle cx="60" cy="200" r="8" fill="#3b82f6" />
              <circle cx="900" cy="140" r="8" fill="#10b981" />
            </svg>
            <MapPin className="w-12 h-12 text-slate-300 relative z-10" />
            <div className="relative z-10 text-center px-4">
              <p className="text-base font-semibold text-slate-600">Sin rutas configuradas</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                La planificación de rutas con trazado en mapa estará disponible en la próxima fase del módulo de transporte.
              </p>
            </div>
          </div>

          {/* Info fase */}
          <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Próxima fase — T2</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              El módulo de rutas incluirá trazado en mapa, asignación automática de vehículo y conductor,
              y seguimiento en tiempo real de los servicios en curso.
            </p>
          </div>
        </div>

        {/* Accesos rápidos hacia lo que sí existe */}
        <div>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">Disponible ahora</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate?.('transporte_servicios')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 group-hover:bg-blue-100 transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight">Servicios</p>
                <p className="text-xs text-slate-400">Gestionar servicios del día</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>

            <button
              onClick={() => onNavigate?.('transporte_vehiculos')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Bus className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight">Flota</p>
                <p className="text-xs text-slate-400">Vehículos y disponibilidad</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>

            <button
              onClick={() => onNavigate?.('transporte_panel')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0 group-hover:bg-purple-100 transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight">Panel</p>
                <p className="text-xs text-slate-400">Visión general del día</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
