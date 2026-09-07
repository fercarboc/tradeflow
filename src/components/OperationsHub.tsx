import React, { useState, useRef } from 'react';
import {
  Calendar, Navigation, FileCheck, CheckCircle, Clock, Activity,
  PenLine, ArrowRight, Plus, Eye, MapPin, User, ChevronRight,
} from 'lucide-react';
import ScreenPlanificacion, {
  type PresupuestoPendiente,
  type LinkedPresupuesto,
} from './ScreenPlanificacion';
import ScreenRutaDia from './ScreenRutaDia';
import ScreenParteTrabajo from './ScreenParteTrabajo';
import type { TradeJob, TradeInvoice } from '../lib/supabase';
import { loadInvoicesByJobId, checkClientMaintenanceContract } from '../lib/supabase';
import type { GeoLocation } from '../lib/routeOptimizer';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TarifaLike {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
}

interface WorkerRef { id: string; nombre: string; rol: string; activo: boolean; }
interface ClienteLike { id: string; nombre: string; telefono: string; email?: string | null; }

export type HubSubTab = 'pendientes' | 'agenda' | 'partes';

// ── PENDIENTES TAB ─────────────────────────────────────────────────────────────

interface PendientesTabProps {
  pendingPlanningQuotes: PresupuestoPendiente[];
  onProgramar: (quote: PresupuestoPendiente) => void;
  onViewAgenda: () => void;
}

function PendientesTab({ pendingPlanningQuotes, onProgramar, onViewAgenda }: PendientesTabProps) {
  if (pendingPlanningQuotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="font-bold text-slate-700 text-base">Todo está planificado</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          No hay presupuestos aceptados pendientes de programar.
        </p>
        <button
          onClick={onViewAgenda}
          className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Ver agenda <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingPlanningQuotes.map(quote => (
        <div
          key={quote.dbId ?? quote.id}
          className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-4 hover:border-blue-200 hover:shadow-sm transition-all"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                Aceptado
              </span>
              {quote.id && (
                <span className="text-[9px] text-slate-400 font-mono truncate">{quote.id}</span>
              )}
            </div>
            <p className="font-bold text-slate-900 text-sm leading-tight">{quote.nombreCliente}</p>
            {quote.descripcion && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{quote.descripcion}</p>
            )}
            {typeof quote.total === 'number' && (
              <p className="text-xs font-bold text-slate-700 mt-1.5">
                {quote.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </p>
            )}
          </div>
          <button
            onClick={() => onProgramar(quote)}
            className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap border border-blue-200"
          >
            <Plus className="w-3.5 h-3.5" /> Programar
          </button>
        </div>
      ))}
    </div>
  );
}

// ── AGENDA TAB ────────────────────────────────────────────────────────────────

type AgendaView = 'agenda' | 'ruta';

interface AgendaTabProps {
  jobs: TradeJob[];
  workers: WorkerRef[];
  clientes: ClienteLike[];
  orgId: string | null;
  isLiveMode: boolean;
  isDarkMode: boolean;
  presupuestosAceptados: PresupuestoPendiente[];
  presupuestosPorId: Record<string, LinkedPresupuesto>;
  activePrefill: PresupuestoPendiente | null;
  onPrefillConsumed: () => void;
  startLocation: string | GeoLocation;
  workerProfileId: string | null;
  onCreateJob: (job: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>) => Promise<TradeJob>;
  onUpdateJob: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onAssignWorker: (jobId: string, workerId: string, rol: string) => Promise<void>;
  onRemoveWorker: (jobId: string, workerId: string) => Promise<void>;
  onOpenParte: (job: TradeJob) => void;
  onCreatePresupuesto?: (job: TradeJob) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  triggerNew?: number;
}

function AgendaTab(props: AgendaTabProps) {
  const [agendaView, setAgendaView] = useState<AgendaView>('agenda');

  const hoy = new Date().toISOString().slice(0, 10);
  const rutaJobs = props.jobs.filter(j => {
    const isToday = j.fecha_inicio === hoy || !j.fecha_inicio;
    if (props.workerProfileId) {
      return isToday && j.trade_job_workers?.some(jw => jw.worker_id === props.workerProfileId);
    }
    return isToday;
  }).filter(j => j.estado !== 'cancelado' && j.estado !== 'no_realizado');

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toggle: AGENDA | RUTA DEL DÍA */}
      <div className="flex gap-1.5 mb-4 shrink-0">
        <button
          onClick={() => setAgendaView('agenda')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            agendaView === 'agenda'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Agenda
        </button>
        <button
          onClick={() => setAgendaView('ruta')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            agendaView === 'ruta'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" /> Ruta del Día
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {agendaView === 'agenda' && (
          <ScreenPlanificacion
            jobs={props.jobs}
            workers={props.workers}
            clientes={props.clientes.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }))}
            orgId={props.orgId}
            isLiveMode={props.isLiveMode}
            isDarkMode={props.isDarkMode}
            presupuestosAceptados={props.presupuestosAceptados}
            presupuestosPorId={props.presupuestosPorId}
            prefillJobFromQuote={props.activePrefill}
            onPrefillConsumed={props.onPrefillConsumed}
            onCreateJob={props.onCreateJob}
            onUpdateJob={props.onUpdateJob}
            onDeleteJob={props.onDeleteJob}
            onAssignWorker={props.onAssignWorker}
            onRemoveWorker={props.onRemoveWorker}
            onOpenParte={props.onOpenParte}
            onCreatePresupuesto={props.onCreatePresupuesto}
            onViewRoute={() => setAgendaView('ruta')}
            showToast={props.showToast}
            triggerNew={props.triggerNew}
          />
        )}
        {agendaView === 'ruta' && props.orgId && (
          <ScreenRutaDia
            jobs={rutaJobs}
            orgId={props.orgId}
            startLocation={props.startLocation}
            horaInicio="08:00"
            onUpdateJob={props.onUpdateJob}
            showToast={props.showToast}
            onClose={() => setAgendaView('agenda')}
          />
        )}
        {agendaView === 'ruta' && !props.orgId && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-slate-400">Sin organización activa.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PARTES TAB ────────────────────────────────────────────────────────────────

type ParteCategory = 'todos' | 'pendientes' | 'en_curso' | 'pdte_firma' | 'firmados';

const PARTE_CATEGORY_CFG: Record<
  ParteCategory,
  { label: string; dotCls: string; badgeCls: string }
> = {
  todos:      { label: 'Todos',        dotCls: 'bg-slate-300',   badgeCls: 'bg-slate-100 text-slate-600 border-slate-200' },
  pendientes: { label: 'Pendientes',   dotCls: 'bg-blue-400',    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_curso:   { label: 'En curso',     dotCls: 'bg-amber-400',   badgeCls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pdte_firma: { label: 'Pdte. firma',  dotCls: 'bg-violet-400',  badgeCls: 'bg-violet-50 text-violet-700 border-violet-200' },
  firmados:   { label: 'Firmados',     dotCls: 'bg-emerald-400', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// Derivation conditions — backed by real TradeJob fields only.
// PENDIENTES  = estado in [planificado, pendiente_material, bloqueado_espera_material, pausado_continua]
// EN CURSO    = estado === 'en_curso'
// PDTE. FIRMA = estado === 'completado' && !firma_cliente_url
// FIRMADOS    = estado === 'completado' && firma_cliente_url != null
function jobParteCategory(j: TradeJob): Exclude<ParteCategory, 'todos'> {
  if (j.estado === 'en_curso') return 'en_curso';
  if (j.estado === 'completado' && !j.firma_cliente_url) return 'pdte_firma';
  if (j.estado === 'completado' && !!j.firma_cliente_url) return 'firmados';
  return 'pendientes';
}

interface PartesTabProps {
  jobs: TradeJob[];
  onOpenParte: (job: TradeJob) => void;
}

function PartesTab({ jobs, onOpenParte }: PartesTabProps) {
  const [category, setCategory] = useState<ParteCategory>('todos');

  const activeJobs = jobs.filter(
    j => j.estado !== 'cancelado' && j.estado !== 'no_realizado',
  );

  const counts: Record<ParteCategory, number> = {
    todos:      activeJobs.length,
    pendientes: activeJobs.filter(j => jobParteCategory(j) === 'pendientes').length,
    en_curso:   activeJobs.filter(j => jobParteCategory(j) === 'en_curso').length,
    pdte_firma: activeJobs.filter(j => jobParteCategory(j) === 'pdte_firma').length,
    firmados:   activeJobs.filter(j => jobParteCategory(j) === 'firmados').length,
  };

  const filtered = activeJobs
    .filter(j => category === 'todos' || jobParteCategory(j) === category)
    .sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''));

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {(Object.keys(PARTE_CATEGORY_CFG) as ParteCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {PARTE_CATEGORY_CFG[cat].label}
            <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black ${
              category === cat ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[cat]}
            </span>
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <FileCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Sin trabajos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(j => {
            const cat = jobParteCategory(j);
            const cfg = PARTE_CATEGORY_CFG[cat];
            const dateLabel = j.fecha_inicio
              ? new Date(j.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
              : '—';
            const responsable = j.trade_job_workers?.find(w => w.rol === 'responsable')
              ?? j.trade_job_workers?.[0];

            return (
              <button
                key={j.id}
                onClick={() => onOpenParte(j)}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dotCls}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{dateLabel}</span>
                    {j.firma_cliente_url && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        ✓ Firmado
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-slate-900 truncate">{j.titulo}</p>
                  {j.trade_clients?.nombre && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{j.trade_clients.nombre}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {j.localidad && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {j.localidad}
                      </span>
                    )}
                    {responsable?.trade_workers?.nombre && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" /> {responsable.trade_workers.nombre}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 mt-0.5">
                  <Eye className="w-3 h-3" /> Abrir
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── OPERATIONS HUB ────────────────────────────────────────────────────────────

export interface OperationsHubProps {
  jobs: TradeJob[];
  workers: WorkerRef[];
  clientes: ClienteLike[];
  orgId: string | null;
  isLiveMode: boolean;
  isDarkMode: boolean;
  pendingPlanningQuotes: PresupuestoPendiente[];
  presupuestosPorId: Record<string, LinkedPresupuesto>;
  tarifas: TarifaLike[];
  startLocation: string | GeoLocation;
  workerProfileId: string | null;
  /** For deep-linking from dashboard banner or legacy navigation. */
  initialSubTab?: HubSubTab;
  /** External prefill (from Presupuestos screen PROGRAMAR button). */
  prefillJobFromQuote?: PresupuestoPendiente | null;
  onPrefillConsumed?: () => void;
  onCreateJob: (job: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>) => Promise<TradeJob>;
  onUpdateJob: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onAssignWorker: (jobId: string, workerId: string, rol: string) => Promise<void>;
  onRemoveWorker: (jobId: string, workerId: string) => Promise<void>;
  onCreatePresupuesto?: (job: TradeJob) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  triggerNew?: number;
}

const TAB_CFG: Array<{ id: HubSubTab; icon: React.ReactNode; label: string }> = [
  { id: 'pendientes', icon: <Clock className="w-3.5 h-3.5" />, label: 'Pendientes' },
  { id: 'agenda',     icon: <Calendar className="w-3.5 h-3.5" />, label: 'Agenda' },
  { id: 'partes',     icon: <FileCheck className="w-3.5 h-3.5" />, label: 'Partes' },
];

export default function OperationsHub(props: OperationsHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<HubSubTab>(() => {
    if (props.initialSubTab) return props.initialSubTab;
    if (props.prefillJobFromQuote) return 'agenda';
    return props.pendingPlanningQuotes.length > 0 ? 'pendientes' : 'agenda';
  });

  // Internal prefill: merges external prop (from presupuestos screen) + internal (from PendientesTab)
  const [activePrefill, setActivePrefill] = useState<PresupuestoPendiente | null>(
    props.prefillJobFromQuote ?? null,
  );
  const prevExtPrefillId = useRef<string | null | undefined>(props.prefillJobFromQuote?.dbId);

  // Sync external prefill changes (new quote programmed from outside the hub while hub is mounted)
  const extPrefill = props.prefillJobFromQuote;
  if (extPrefill?.dbId !== prevExtPrefillId.current) {
    prevExtPrefillId.current = extPrefill?.dbId ?? null;
    if (extPrefill) {
      setActivePrefill(extPrefill);
      setActiveSubTab('agenda');
    }
  }

  const handleProgramar = (quote: PresupuestoPendiente) => {
    setActivePrefill(quote);
    setActiveSubTab('agenda');
  };

  const handlePrefillConsumed = () => {
    setActivePrefill(null);
    props.onPrefillConsumed?.();
  };

  // ── Parte overlay ───────────────────────────────────────────────────────────
  const [hubParteJob, setHubParteJob] = useState<TradeJob | null>(null);
  const [hubParteMode, setHubParteMode] = useState<'edit' | 'view' | 'supplement'>('edit');
  const [hubParteInvoices, setHubParteInvoices] = useState<TradeInvoice[]>([]);
  const [hubParteMaint, setHubParteMaint] = useState<{
    activo: boolean; materialesIncluidos: boolean; nombre: string | null;
  } | null>(null);

  const handleOpenParte = async (job: TradeJob) => {
    setHubParteJob(job);
    setHubParteMode('edit');
    setHubParteInvoices([]);
    setHubParteMaint(null);

    const [maint, invoices] = await Promise.all([
      props.isLiveMode && props.orgId && job.client_id
        ? checkClientMaintenanceContract(props.orgId, job.client_id).catch(() => null)
        : Promise.resolve(null),
      props.isLiveMode
        ? loadInvoicesByJobId(job.id).catch(() => [] as TradeInvoice[])
        : Promise.resolve([] as TradeInvoice[]),
    ]);

    setHubParteMaint(maint);
    setHubParteInvoices(invoices);

    const isCompleted = job.estado === 'completado';
    const hasInvoice = invoices.length > 0;
    if (!isCompleted) {
      setHubParteMode('edit');
    } else if (hasInvoice) {
      setHubParteMode('supplement');
    } else {
      setHubParteMode('view');
    }
  };

  const closeParteOverlay = () => {
    setHubParteJob(null);
    setHubParteMaint(null);
    setHubParteInvoices([]);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const pendingCount = props.pendingPlanningQuotes.length;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Hub header */}
      <div className="mb-4 shrink-0">
        <p className="text-xs text-slate-400 mt-0.5">
          Organiza trabajos, rutas y partes desde un único lugar.
        </p>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TAB_CFG.map(tab => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer relative ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'pendientes' && pendingCount > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeSubTab === 'pendientes' && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <PendientesTab
            pendingPlanningQuotes={props.pendingPlanningQuotes}
            onProgramar={handleProgramar}
            onViewAgenda={() => setActiveSubTab('agenda')}
          />
        </div>
      )}

      {activeSubTab === 'agenda' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgendaTab
            jobs={props.jobs}
            workers={props.workers}
            clientes={props.clientes}
            orgId={props.orgId}
            isLiveMode={props.isLiveMode}
            isDarkMode={props.isDarkMode}
            presupuestosAceptados={props.pendingPlanningQuotes}
            presupuestosPorId={props.presupuestosPorId}
            activePrefill={activePrefill}
            onPrefillConsumed={handlePrefillConsumed}
            startLocation={props.startLocation}
            workerProfileId={props.workerProfileId}
            onCreateJob={props.onCreateJob}
            onUpdateJob={props.onUpdateJob}
            onDeleteJob={props.onDeleteJob}
            onAssignWorker={props.onAssignWorker}
            onRemoveWorker={props.onRemoveWorker}
            onOpenParte={handleOpenParte}
            onCreatePresupuesto={props.onCreatePresupuesto}
            showToast={props.showToast}
            triggerNew={props.triggerNew}
          />
        </div>
      )}

      {activeSubTab === 'partes' && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <PartesTab
            jobs={props.jobs}
            onOpenParte={handleOpenParte}
          />
        </div>
      )}

      {/* ScreenParteTrabajo overlay — rendered at hub level */}
      {hubParteJob && (() => {
        const clienteCompleto = props.clientes.find(c => c.id === hubParteJob.client_id);
        return (
          <div className="fixed inset-0 z-50">
            <ScreenParteTrabajo
              key={hubParteJob.id}
              job={hubParteJob}
              orgId={props.orgId ?? ''}
              tarifas={props.tarifas}
              isLiveMode={props.isLiveMode}
              mode={hubParteMode}
              mantenimiento={hubParteMaint}
              existingInvoices={hubParteInvoices}
              clienteInfo={clienteCompleto ? {
                nombre: clienteCompleto.nombre,
                telefono: clienteCompleto.telefono,
                email: clienteCompleto.email ?? null,
              } : undefined}
              onComplete={async (jobId, notas, _materials, horaFin) => {
                const now = new Date().toISOString();
                await props.onUpdateJob(jobId, {
                  estado: 'completado',
                  notas_cierre: notas,
                  completado_at: now,
                  hora_fin: horaFin,
                });
                setHubParteJob(prev =>
                  prev ? { ...prev, estado: 'completado', notas_cierre: notas, completado_at: now, hora_fin: horaFin } : null,
                );
              }}
              onInvoiceCreated={inv => setHubParteInvoices(prev => [...prev, inv])}
              onClose={closeParteOverlay}
              showToast={props.showToast}
            />
          </div>
        );
      })()}
    </div>
  );
}
