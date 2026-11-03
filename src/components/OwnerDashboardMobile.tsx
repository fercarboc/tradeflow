import React, { useMemo } from 'react';
import {
  Mic, FilePlus, Calendar, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Euro, FileText, Wrench, Truck,
} from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import type { Presupuesto, Factura } from '../types';

interface Worker {
  id: string;
  nombre: string;
  activo: boolean;
}

interface PendingPlanningQuote {
  id: string;
  dbId: string;
  nombreCliente: string;
  descripcion: string;
  total: number;
}

export interface OwnerDashboardMobileProps {
  jobs: TradeJob[];
  workers: Worker[];
  presupuestos: Presupuesto[];
  facturas: Factura[];
  pendingPlanningQuotes: PendingPlanningQuote[];
  hasTransport: boolean;
  onNavigateMobileTab: (tab: string) => void;
  onStartWizardVoz: () => void;
  onNewQuoteSteps: () => void;
  onGoPartes: () => void;
  onGoSuppliers: () => void;
}

function todayLocalISO(): string {
  return Intl.DateTimeFormat('sv-SE').format(new Date());
}

const ESTADO_DOT: Record<TradeJob['estado'], string> = {
  planificado:               'bg-blue-500',
  en_curso:                  'bg-amber-500',
  completado:                'bg-emerald-500',
  cancelado:                 'bg-red-500',
  pendiente_material:        'bg-orange-500',
  no_realizado:              'bg-slate-400',
  pausado_continua:          'bg-violet-500',
  bloqueado_espera_material: 'bg-rose-500',
};

const ESTADO_LABEL: Record<TradeJob['estado'], string> = {
  planificado:               'Planificado',
  en_curso:                  'En curso',
  completado:                'Completado',
  cancelado:                 'Cancelado',
  pendiente_material:        'Pdte. material',
  no_realizado:              'No realizado',
  pausado_continua:          'Pausado',
  bloqueado_espera_material: 'Espera material',
};

export default function OwnerDashboardMobile({
  jobs,
  workers,
  presupuestos,
  facturas,
  pendingPlanningQuotes,
  hasTransport,
  onNavigateMobileTab,
  onStartWizardVoz,
  onNewQuoteSteps,
  onGoPartes,
  onGoSuppliers,
}: OwnerDashboardMobileProps) {
  const today = todayLocalISO();

  const todayJobs = useMemo(() =>
    jobs
      .filter(j => j.fecha_inicio === today && j.estado !== 'cancelado')
      .sort((a, b) => (a.hora_inicio ?? '99:99').localeCompare(b.hora_inicio ?? '99:99')),
    [jobs, today],
  );

  const unassignedCount = useMemo(() =>
    todayJobs.filter(j => !(j.trade_job_workers?.length)).length,
    [todayJobs],
  );

  const workerById = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => { map[w.id] = w.nombre; });
    return map;
  }, [workers]);

  const totalPendiente = useMemo(() =>
    facturas
      .filter(f => f.estado === 'Emitida' || f.estado === 'Pendiente' || f.estado === 'Vencida')
      .reduce((sum, f) => sum + f.importe, 0),
    [facturas],
  );

  const facturasVencidas = useMemo(() =>
    facturas.filter(f => {
      if (f.estado === 'Vencida') return true;
      if (f.estado !== 'Emitida' && f.estado !== 'Pendiente') return false;
      return !!f.fechaVencimiento && f.fechaVencimiento < today;
    }),
    [facturas, today],
  );

  const presupuestosSinRespuesta = useMemo(() =>
    presupuestos.filter(p => p.estado === 'Enviado'),
    [presupuestos],
  );

  const totalAlerts = unassignedCount + facturasVencidas.length + pendingPlanningQuotes.length;

  return (
    <div className="space-y-4 pb-4" data-testid="owner-dashboard-mobile">

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className={`text-xl font-black leading-none ${todayJobs.length > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
            {todayJobs.length}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">Hoy</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className={`text-xl font-black leading-none ${unassignedCount > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {unassignedCount}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">Sin asig.</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className={`text-xl font-black leading-none ${totalPendiente > 0 ? (facturasVencidas.length > 0 ? 'text-red-600' : 'text-amber-600') : 'text-slate-300'}`}>
            {totalPendiente > 999
              ? `${Math.round(totalPendiente / 1000)}k`
              : totalPendiente > 0
                ? totalPendiente.toLocaleString('es-ES', { maximumFractionDigits: 0 })
                : '—'}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">€ Pdte</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <div className={`text-xl font-black leading-none ${pendingPlanningQuotes.length > 0 ? 'text-violet-600' : 'text-slate-300'}`}>
            {pendingPlanningQuotes.length}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">Plan.</div>
        </div>
      </div>

      {/* ── Alert banner (si hay pendientes urgentes) ───────────────────────── */}
      {totalAlerts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0 text-xs text-amber-800">
            {unassignedCount > 0 && <span className="font-semibold">{unassignedCount} sin asignar</span>}
            {unassignedCount > 0 && facturasVencidas.length > 0 && ' · '}
            {facturasVencidas.length > 0 && <span className="font-semibold">{facturasVencidas.length} factura{facturasVencidas.length !== 1 ? 's' : ''} vencida{facturasVencidas.length !== 1 ? 's' : ''}</span>}
            {(unassignedCount > 0 || facturasVencidas.length > 0) && pendingPlanningQuotes.length > 0 && ' · '}
            {pendingPlanningQuotes.length > 0 && <span className="font-semibold">{pendingPlanningQuotes.length} por planificar</span>}
          </div>
          <button
            onClick={() => onNavigateMobileTab('trabajos')}
            className="text-amber-700 shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Agenda diaria ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Agenda</span>
            <h3 className="text-sm font-black text-slate-900 uppercase">Trabajos de hoy</h3>
          </div>
          <button
            onClick={() => onNavigateMobileTab('trabajos')}
            className="text-xs font-bold text-blue-600 flex items-center gap-0.5 cursor-pointer"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Calendar className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs font-semibold text-slate-400">Sin trabajos para hoy</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayJobs.slice(0, 5).map(j => {
              const assignees = (j.trade_job_workers ?? [])
                .map(jw => jw.trade_workers?.nombre ?? workerById[jw.worker_id] ?? '')
                .filter(Boolean);
              const isUnassigned = assignees.length === 0;

              return (
                <div
                  key={j.id}
                  className={`flex items-center gap-3 px-4 py-3 ${isUnassigned ? 'bg-amber-50' : ''}`}
                >
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${ESTADO_DOT[j.estado]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{j.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {j.hora_inicio && (
                        <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{j.hora_inicio}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400">
                        {ESTADO_LABEL[j.estado]}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isUnassigned ? (
                      <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />Sin asignar
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 truncate max-w-[72px] block">
                        {assignees[0]}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {todayJobs.length > 5 && (
              <button
                onClick={() => onNavigateMobileTab('trabajos')}
                className="w-full text-center text-xs font-bold text-blue-600 py-3 cursor-pointer bg-slate-50 hover:bg-slate-100"
              >
                +{todayJobs.length - 5} trabajos más
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Presupuestos sin respuesta (compacto) ──────────────────────────── */}
      {presupuestosSinRespuesta.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0 text-xs text-blue-800">
            <span className="font-semibold">{presupuestosSinRespuesta.length}</span> presupuesto{presupuestosSinRespuesta.length !== 1 ? 's' : ''} esperando respuesta
          </div>
          <button
            onClick={() => onNavigateMobileTab('presupuestos')}
            className="text-blue-700 shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Por planificar (compacto) ──────────────────────────────────────── */}
      {pendingPlanningQuotes.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-800">Aceptados sin planificar</span>
            </div>
            <span className="text-[9px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">{pendingPlanningQuotes.length}</span>
          </div>
          {pendingPlanningQuotes.slice(0, 2).map(p => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-100 last:border-0">
              <span className="text-xs text-slate-700 truncate flex-1 min-w-0">{p.nombreCliente || p.descripcion}</span>
              <span className="text-xs font-mono text-emerald-700 shrink-0">{p.total.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
            </div>
          ))}
          <button
            onClick={() => onNavigateMobileTab('trabajos')}
            className="w-full text-center text-xs font-bold text-emerald-700 py-2.5 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
          >
            Programar trabajos <ChevronRight className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}

      {/* ── Accesos rápidos principales ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onStartWizardVoz}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors border border-blue-500"
        >
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] text-left leading-tight">Presupuesto Voz IA</span>
        </button>

        <button
          onClick={onNewQuoteSteps}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors border border-amber-400"
        >
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <FilePlus className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] text-left leading-tight">Presupuesto por Pasos</span>
        </button>
      </div>

      {/* ── Accesos secundarios ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onGoPartes}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Wrench className="w-5 h-5 text-slate-500" />
          <span className="text-[9px] font-bold uppercase text-center leading-tight">Partes hoy</span>
        </button>

        <button
          onClick={onGoSuppliers}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Euro className="w-5 h-5 text-slate-500" />
          <span className="text-[9px] font-bold uppercase text-center leading-tight">Proveedores</span>
        </button>

        {hasTransport && (
          <button
            onClick={() => onNavigateMobileTab('transporte')}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Truck className="w-5 h-5 text-slate-500" />
            <span className="text-[9px] font-bold uppercase text-center leading-tight">Transporte</span>
          </button>
        )}

        {!hasTransport && (
          <button
            onClick={() => onNavigateMobileTab('facturas')}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-5 h-5 text-slate-500" />
            <span className="text-[9px] font-bold uppercase text-center leading-tight">Facturas</span>
          </button>
        )}
      </div>

      {/* Estado tranquilo */}
      {totalAlerts === 0 && todayJobs.length === 0 && (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-300 mb-1" />
          <p className="text-[10px] text-slate-400">Sin pendientes urgentes</p>
        </div>
      )}
    </div>
  );
}
