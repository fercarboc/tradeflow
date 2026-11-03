import React, { useMemo } from 'react';
import {
  Mic, FileText, Plus, Briefcase, Users, Wrench, FilePlus,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Calendar,
  Euro,
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

export interface OwnerDashboardDesktopProps {
  jobs: TradeJob[];
  workers: Worker[];
  presupuestos: Presupuesto[];
  facturas: Factura[];
  pendingPlanningQuotes: PendingPlanningQuote[];
  onNavigateTab: (tab: string, planSubTab?: string) => void;
  onOpenVoiceModal: () => void;
  onNewJob: () => void;
  onNewQuoteSteps: () => void;
  onNewClient: () => void;
  onNewMantenimiento: () => void;
  onViewQuote: (quote: Presupuesto) => void;
}

// Timezone-safe local date string ('YYYY-MM-DD' in the device's local TZ).
// Avoids the UTC-offset bug of toISOString().split('T')[0] for Spain (UTC+1/+2).
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

const ESTADO_CHIP: Record<TradeJob['estado'], string> = {
  planificado:               'bg-blue-50 text-blue-600 border-blue-200',
  en_curso:                  'bg-amber-50 text-amber-700 border-amber-200',
  completado:                'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado:                 'bg-red-50 text-red-500 border-red-200',
  pendiente_material:        'bg-orange-50 text-orange-600 border-orange-200',
  no_realizado:              'bg-slate-50 text-slate-500 border-slate-200',
  pausado_continua:          'bg-violet-50 text-violet-600 border-violet-200',
  bloqueado_espera_material: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function OwnerDashboardDesktop({
  jobs,
  workers,
  presupuestos,
  facturas,
  pendingPlanningQuotes,
  onNavigateTab,
  onOpenVoiceModal,
  onNewJob,
  onNewQuoteSteps,
  onNewClient,
  onNewMantenimiento,
  onViewQuote,
}: OwnerDashboardDesktopProps) {
  const today = todayLocalISO();

  const todayJobs = useMemo(() =>
    jobs
      .filter(j => j.fecha_inicio === today && j.estado !== 'cancelado')
      .sort((a, b) => (a.hora_inicio ?? '99:99').localeCompare(b.hora_inicio ?? '99:99')),
    [jobs, today],
  );

  const unassignedToday = useMemo(() =>
    todayJobs.filter(j => !(j.trade_job_workers?.length)),
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

  const kpis = [
    {
      label:  'Trabajos hoy',
      value:  String(todayJobs.length),
      sub:    unassignedToday.length > 0
        ? `${unassignedToday.length} sin asignar`
        : todayJobs.length > 0 ? 'Todos asignados' : 'Sin trabajos',
      accent: unassignedToday.length > 0 ? 'text-amber-600'
        : todayJobs.length > 0 ? 'text-emerald-600' : 'text-slate-400',
      alertSub: unassignedToday.length > 0,
    },
    {
      label:  'Pendiente cobro',
      value:  totalPendiente > 0
        ? `${totalPendiente.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`
        : '—',
      sub:    facturasVencidas.length > 0
        ? `${facturasVencidas.length} vencida${facturasVencidas.length !== 1 ? 's' : ''}`
        : totalPendiente > 0 ? 'En plazo' : 'Al día',
      accent: facturasVencidas.length > 0 ? 'text-red-600'
        : totalPendiente > 0 ? 'text-amber-600' : 'text-slate-400',
      alertSub: facturasVencidas.length > 0,
    },
    {
      label:  'Sin respuesta',
      value:  String(presupuestosSinRespuesta.length),
      sub:    presupuestosSinRespuesta.length === 0 ? 'Sin pendientes' : 'Esperando cliente',
      accent: presupuestosSinRespuesta.length > 0 ? 'text-blue-600' : 'text-slate-400',
      alertSub: false,
    },
    {
      label:  'Por planificar',
      value:  String(pendingPlanningQuotes.length),
      sub:    pendingPlanningQuotes.length === 0 ? 'Todo planificado' : 'Presupuestos aceptados',
      accent: pendingPlanningQuotes.length > 0 ? 'text-violet-600' : 'text-slate-400',
      alertSub: pendingPlanningQuotes.length > 0,
    },
  ];

  return (
    <div className="space-y-5" data-testid="owner-dashboard-desktop">

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{k.label}</span>
            <div className={`text-2xl font-black tracking-tight ${k.accent}`}>{k.value}</div>
            <span className="text-[10px] block">
              {k.alertSub
                ? <span className="font-semibold text-amber-600">{k.sub}</span>
                : <span className="text-slate-400">{k.sub}</span>
              }
            </span>
          </div>
        ))}
      </div>

      {/* ── Agenda + Pendientes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Agenda diaria (2/3) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Agenda</span>
              <h3 className="text-sm font-black text-slate-900 uppercase">Trabajos de hoy</h3>
            </div>
            <button
              onClick={onNewJob}
              className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir
            </button>
          </div>

          {todayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Calendar className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Sin trabajos programados para hoy</p>
              <button
                onClick={onNewJob}
                className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                + Añadir trabajo o visita
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayJobs.slice(0, 10).map(j => {
                const assignees = (j.trade_job_workers ?? [])
                  .map(jw => jw.trade_workers?.nombre ?? workerById[jw.worker_id] ?? '')
                  .filter(Boolean);
                const isUnassigned = assignees.length === 0;

                return (
                  <div
                    key={j.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      isUnassigned
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-1.5 min-h-[40px] rounded-full shrink-0 mt-0.5 ${ESTADO_DOT[j.estado]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">{j.titulo}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ESTADO_CHIP[j.estado]}`}>
                          {ESTADO_LABEL[j.estado]}
                        </span>
                      </div>
                      {j.trade_clients?.nombre && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{j.trade_clients.nombre}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {j.hora_inicio && (
                          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{j.hora_inicio}
                          </span>
                        )}
                        {isUnassigned ? (
                          <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />Sin asignar
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 min-w-0 truncate">
                            {assignees.slice(0, 2).join(', ')}{assignees.length > 2 ? ` +${assignees.length - 2}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {todayJobs.length > 10 && (
                <button
                  onClick={() => onNavigateTab('planificacion')}
                  className="w-full text-center text-xs font-bold text-blue-600 hover:text-blue-700 py-2 cursor-pointer"
                >
                  Ver todos ({todayJobs.length}) en Planificación <ChevronRight className="w-3.5 h-3.5 inline" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pendientes (1/3) */}
        <div className="space-y-3">

          {unassignedToday.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Sin asignar hoy</h4>
                <span className="text-[9px] font-black bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">{unassignedToday.length}</span>
              </div>
              {unassignedToday.slice(0, 3).map(j => (
                <div key={j.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1 min-w-0">{j.titulo}</span>
                  {j.hora_inicio && <span className="text-[10px] font-mono text-slate-400 shrink-0">{j.hora_inicio}</span>}
                </div>
              ))}
              <button
                onClick={() => onNavigateTab('planificacion')}
                className="w-full text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                Asignar operarios <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {pendingPlanningQuotes.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Por planificar</h4>
                <span className="text-[9px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">{pendingPlanningQuotes.length}</span>
              </div>
              {pendingPlanningQuotes.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1 min-w-0">{p.nombreCliente || p.descripcion}</span>
                  <span className="text-[10px] font-mono text-emerald-700 shrink-0">{p.total.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
                </div>
              ))}
              <button
                onClick={() => onNavigateTab('planificacion', 'pendientes')}
                className="w-full text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                Programar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {facturasVencidas.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-widest">Facturas vencidas</h4>
                <span className="text-[9px] font-black bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">{facturasVencidas.length}</span>
              </div>
              {facturasVencidas.slice(0, 3).map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-2">
                  <Euro className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1 min-w-0">{f.nombreCliente}</span>
                  <span className="text-[10px] font-mono text-red-600 shrink-0">{f.importe.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
                </div>
              ))}
              <button
                onClick={() => onNavigateTab('invoices')}
                className="w-full text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                Gestionar facturas <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {presupuestosSinRespuesta.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Sin respuesta</h4>
                <span className="text-[9px] font-black bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">{presupuestosSinRespuesta.length}</span>
              </div>
              {presupuestosSinRespuesta.slice(0, 3).map(p => (
                <button
                  key={p.id}
                  onClick={() => onViewQuote(p)}
                  className="w-full flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 text-left cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1 min-w-0">{p.nombreCliente || p.descripcion}</span>
                  <span className="text-[10px] font-mono text-blue-600 shrink-0">{(p.total ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
                </button>
              ))}
              <button
                onClick={() => onNavigateTab('quotes')}
                className="w-full text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                Ver presupuestos <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {unassignedToday.length === 0 && pendingPlanningQuotes.length === 0 &&
            facturasVencidas.length === 0 && presupuestosSinRespuesta.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">Sin pendientes urgentes</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Todo en orden</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Accesos rápidos (todos preservados) ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          onClick={onOpenVoiceModal}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 text-center shadow-sm space-y-2 cursor-pointer flex flex-col items-center justify-center border border-blue-500 transition-colors"
        >
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] block leading-tight">Presupuesto por Voz IA</span>
        </button>

        <button
          onClick={onNewJob}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-4 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center border border-violet-500 transition-colors"
        >
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] block leading-tight">Añadir Trabajo / Visita</span>
        </button>

        <button
          onClick={onNewClient}
          className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-2xl p-4 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-colors"
        >
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
            <Users className="w-5 h-5 text-slate-600" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] block leading-tight">Registrar Cliente</span>
        </button>

        <button
          onClick={onNewQuoteSteps}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-2xl p-4 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center border border-amber-400 transition-colors"
        >
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <FilePlus className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] block leading-tight">Presupuesto por Pasos</span>
        </button>

        <button
          onClick={onNewMantenimiento}
          className="bg-blue-700 hover:bg-blue-800 text-white rounded-2xl p-4 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center border border-blue-600 transition-colors"
        >
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-wider text-[10px] block leading-tight">Contrato Mantenimiento</span>
        </button>
      </div>

    </div>
  );
}
