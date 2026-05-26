import { useState } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, MapPin, Clock, User, Users,
  CheckCircle, Play, Trash2, Edit3, Navigation, Calendar,
  AlertTriangle, X, Check,
} from 'lucide-react';
import type { TradeJob } from '../lib/supabase';

interface Worker { id: string; nombre: string; rol: string; activo: boolean; }
interface Cliente { id: string; nombre: string; telefono: string; }

export interface ScreenPlanificacionProps {
  jobs: TradeJob[];
  workers: Worker[];
  clientes: Cliente[];
  orgId: string | null;
  isLiveMode: boolean;
  isDarkMode: boolean;
  onCreateJob: (job: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>) => Promise<TradeJob>;
  onUpdateJob: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onAssignWorker: (jobId: string, workerId: string, rol: string) => Promise<void>;
  onRemoveWorker: (jobId: string, workerId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ViewMode = 'dia' | 'semana';
type FilterEstado = 'todos' | 'planificado' | 'en_curso' | 'completado' | 'cancelado';

const ESTADO_CFG: Record<TradeJob['estado'], { label: string; cls: string; dot: string }> = {
  planificado:        { label: 'Planificado',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     dot: 'bg-blue-500' },
  en_curso:           { label: 'En curso',           cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  completado:         { label: 'Completado',         cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelado:          { label: 'Cancelado',          cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',         dot: 'bg-red-500' },
  pendiente_material: { label: 'Pdte. material',     cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-500' },
};

const PRIORIDAD_CFG: Record<TradeJob['prioridad'], { label: string; cls: string } | null> = {
  urgente: { label: 'URGENTE', cls: 'bg-red-600 text-white' },
  alta:    { label: 'Alta',    cls: 'bg-orange-500 text-white' },
  normal:  null,
  baja:    { label: 'Baja',   cls: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

const DEMO_JOBS: TradeJob[] = (() => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const jw = (id: string, workerId: string, rol: 'responsable' | 'asignado', nombre: string): import('../lib/supabase').TradeJobWorker => ({
    id, job_id: 'demo-1', worker_id: workerId, rol, notificado: false, aceptado: null, created_at: today,
    trade_workers: { nombre, rol: 'tecnico' },
  });
  return [
    { id: 'demo-1', org_id: '', titulo: 'Revisión caldera gas', estado: 'planificado', prioridad: 'urgente', fecha_inicio: today, hora_inicio: '09:00', duracion_horas: 2, direccion: 'Calle Mayor 12', localidad: 'Sevilla', cp: '41001', created_at: today, updated_at: today, trade_clients: { nombre: 'Juan García', telefono: '612 345 678' }, trade_job_workers: [jw('jw-1', 'w-1', 'responsable', 'Pedro Ramos')] },
    { id: 'demo-2', org_id: '', titulo: 'Instalación punto de luz', estado: 'en_curso', prioridad: 'normal', fecha_inicio: today, hora_inicio: '11:30', duracion_horas: 1.5, direccion: 'Av. Constitución 8', localidad: 'Sevilla', cp: '41001', created_at: today, updated_at: today, trade_clients: { nombre: 'María López', telefono: '678 000 111' }, trade_job_workers: [] },
    { id: 'demo-3', org_id: '', titulo: 'Cambio tubería cocina', estado: 'planificado', prioridad: 'alta', fecha_inicio: today, hora_inicio: '15:00', duracion_horas: 3, direccion: 'C/ Real 45', localidad: 'Alcalá de Guadaíra', cp: '41500', created_at: today, updated_at: today, trade_clients: { nombre: 'Carlos Ruiz', telefono: '699 222 333' }, trade_job_workers: [jw('jw-2', 'w-2', 'asignado', 'Luis Torres')] },
    { id: 'demo-4', org_id: '', titulo: 'Cuadro eléctrico trifásico', estado: 'planificado', prioridad: 'normal', fecha_inicio: tomorrow, hora_inicio: '08:30', duracion_horas: 4, direccion: 'Polígono Industrial Sur, Nave 7', localidad: 'Dos Hermanas', cp: '41700', created_at: tomorrow, updated_at: tomorrow, trade_clients: { nombre: 'Constructora Hércules', telefono: '954 111 222' }, trade_job_workers: [] },
  ] as TradeJob[];
})();

function fmt(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const EMPTY_DRAFT = (): Partial<TradeJob> => ({
  titulo: '', descripcion: '', estado: 'planificado', prioridad: 'normal',
  fecha_inicio: new Date().toISOString().split('T')[0],
  hora_inicio: '09:00', duracion_horas: 2,
  direccion: '', localidad: '', cp: '', client_id: null,
});

export default function ScreenPlanificacion({
  jobs: propJobs, workers, clientes, orgId, isLiveMode,
  onCreateJob, onUpdateJob, onDeleteJob, onAssignWorker, onRemoveWorker, showToast,
}: ScreenPlanificacionProps) {
  const jobs = isLiveMode ? propJobs : DEMO_JOBS;
  const today = new Date().toISOString().split('T')[0];

  const [viewMode, setViewMode]               = useState<ViewMode>('dia');
  const [selectedDate, setSelectedDate]       = useState(today);
  const [filterEstado, setFilterEstado]       = useState<FilterEstado>('todos');
  const [showRoute, setShowRoute]             = useState(false);
  const [showModal, setShowModal]             = useState(false);
  const [editingJob, setEditingJob]           = useState<TradeJob | null>(null);
  const [draft, setDraft]                     = useState<Partial<TradeJob>>(EMPTY_DRAFT());
  const [saving, setSaving]                   = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());

  // ── Computed ──────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const base = new Date(selectedDate + 'T12:00:00');
    const diff = i - base.getDay() + 1; // Monday-based
    const d = new Date(base); d.setDate(base.getDate() + diff);
    return d.toISOString().split('T')[0];
  });

  const jobsForDate = (date: string) => jobs.filter(j => j.fecha_inicio === date);

  const visibleJobs = viewMode === 'dia' ? jobsForDate(selectedDate) : jobs.filter(j => weekDays.includes(j.fecha_inicio ?? ''));

  const filtered = filterEstado === 'todos' ? visibleJobs : visibleJobs.filter(j => j.estado === filterEstado);

  const todayJobs = jobsForDate(selectedDate)
    .filter(j => j.estado !== 'cancelado')
    .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''));

  const totalHoras = todayJobs.reduce((s, j) => s + (j.duracion_horas ?? 0), 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingJob(null);
    setDraft({ ...EMPTY_DRAFT(), fecha_inicio: selectedDate });
    setSelectedWorkerIds(new Set());
    setShowModal(true);
  };

  const openEdit = (job: TradeJob) => {
    setEditingJob(job);
    setDraft({ ...job });
    setSelectedWorkerIds(new Set(job.trade_job_workers?.map(jw => jw.worker_id) ?? []));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!draft.titulo?.trim()) { showToast('El título es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      if (editingJob) {
        await onUpdateJob(editingJob.id, draft);
        const prevIds = new Set(editingJob.trade_job_workers?.map(jw => jw.worker_id) ?? []);
        const toAdd = [...selectedWorkerIds].filter(id => !prevIds.has(id));
        const toRemove = [...prevIds].filter(id => !selectedWorkerIds.has(id));
        await Promise.all([
          ...toAdd.map(id => onAssignWorker(editingJob.id, id, 'asignado')),
          ...toRemove.map(id => onRemoveWorker(editingJob.id, id)),
        ]);
        showToast('Trabajo actualizado ✓', 'success');
      } else {
        const saved = await onCreateJob(draft as Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>);
        await Promise.all([...selectedWorkerIds].map(id => onAssignWorker(saved.id, id, 'asignado')));
        showToast('Trabajo creado ✓', 'success');
      }
      setShowModal(false);
    } catch (e: unknown) {
      showToast('Error al guardar: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleQuickStatus = async (job: TradeJob, estado: TradeJob['estado']) => {
    if (!isLiveMode) { showToast('Activa el modo real para cambiar estados', 'info'); return; }
    try {
      await onUpdateJob(job.id, { estado, ...(estado === 'completado' ? { completado_at: new Date().toISOString() } : {}) });
      showToast(`Estado → ${ESTADO_CFG[estado].label} ✓`, 'success');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const handleDelete = async (job: TradeJob) => {
    if (!window.confirm(`¿Eliminar "${job.titulo}"?`)) return;
    if (!isLiveMode) { showToast('Activa el modo real para eliminar trabajos', 'info'); return; }
    try {
      await onDeleteJob(job.id);
      showToast('Trabajo eliminado', 'info');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const mapsUrl = (job: TradeJob) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([job.direccion, job.localidad, job.cp].filter(Boolean).join(', '))}`;

  // ── Render helpers ────────────────────────────────────────────────────────
  const JobCard = ({ job }: { job: TradeJob }) => {
    const est = ESTADO_CFG[job.estado];
    const pri = PRIORIDAD_CFG[job.prioridad];
    return (
      <div className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 space-y-2.5 transition-all ${job.estado === 'completado' ? 'opacity-60' : ''} border-slate-200 dark:border-slate-800`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${est.dot}`} />
            <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">{job.titulo}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {pri && <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${pri.cls}`}>{pri.label}</span>}
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${est.cls}`}>{est.label}</span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          {(job.hora_inicio || job.duracion_horas) && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{job.hora_inicio ?? '--:--'}{job.duracion_horas ? ` · ${job.duracion_horas}h` : ''}</span>
            </div>
          )}
          {job.trade_clients?.nombre && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <User className="w-3 h-3 shrink-0" />
              <span>{job.trade_clients.nombre}{job.trade_clients.telefono ? ` · ${job.trade_clients.telefono}` : ''}</span>
            </div>
          )}
          {(job.direccion || job.localidad) && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{[job.direccion, job.localidad].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {(job.trade_job_workers?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Users className="w-3 h-3 shrink-0" />
              <span>{job.trade_job_workers!.map(jw => jw.trade_workers?.nombre ?? '—').join(', ')}</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          {job.estado === 'planificado' && (
            <button onClick={() => handleQuickStatus(job, 'en_curso')}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
              <Play className="w-2.5 h-2.5" /> Iniciar
            </button>
          )}
          {job.estado === 'en_curso' && (
            <button onClick={() => handleQuickStatus(job, 'completado')}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
              <CheckCircle className="w-2.5 h-2.5" /> Completar
            </button>
          )}
          {(job.direccion || job.localidad) && (
            <a href={mapsUrl(job)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
              <Navigation className="w-2.5 h-2.5" /> Maps
            </a>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => openEdit(job)}
              className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors rounded">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={() => handleDelete(job)}
              className="p-1 text-slate-400 hover:text-red-500 cursor-pointer transition-colors rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Vista ruta del día ────────────────────────────────────────────────────
  const RouteView = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[10px] font-bold uppercase font-mono text-slate-500 dark:text-slate-400">Ruta del día — {fmt(selectedDate)}</span>
        </div>
        <span className="text-[9px] text-slate-400 font-mono">{todayJobs.length} trabajos · {totalHoras}h estimadas</span>
      </div>
      {todayJobs.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-8">Sin trabajos para este día.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {todayJobs.map((job, i) => (
            <div key={job.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-[9px] font-mono font-bold text-slate-400 w-8 shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">{job.titulo}</span>
                  {job.hora_inicio && <span className="text-[9px] font-mono text-slate-400">{job.hora_inicio}{job.duracion_horas ? ` (${job.duracion_horas}h)` : ''}</span>}
                </div>
                {job.trade_clients?.nombre && <p className="text-[10px] text-slate-500">{job.trade_clients.nombre}{job.trade_clients.telefono ? ` · ${job.trade_clients.telefono}` : ''}</p>}
                {(job.direccion || job.localidad) && <p className="text-[10px] text-slate-500">{[job.direccion, job.localidad, job.cp].filter(Boolean).join(', ')}</p>}
              </div>
              {(job.direccion || job.localidad) && (
                <a href={mapsUrl(job)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-700 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded cursor-pointer shrink-0">
                  <Navigation className="w-2.5 h-2.5" /> Maps
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Modal nuevo/editar trabajo ────────────────────────────────────────────
  const JobModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            {editingJob ? 'Editar trabajo' : 'Nuevo trabajo'}
          </h3>
          <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {/* Título */}
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Título *</label>
            <input value={draft.titulo ?? ''} onChange={e => setDraft(d => ({ ...d, titulo: e.target.value }))} placeholder="Ej: Instalación calentador eléctrico"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
          </div>

          {/* Cliente */}
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Cliente</label>
            <select value={draft.client_id ?? ''} onChange={e => setDraft(d => ({ ...d, client_id: e.target.value || null }))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500">
              <option value="">— Sin cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Fecha inicio</label>
              <input type="date" value={draft.fecha_inicio ?? ''} onChange={e => setDraft(d => ({ ...d, fecha_inicio: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Hora inicio</label>
              <input type="time" value={draft.hora_inicio ?? ''} onChange={e => setDraft(d => ({ ...d, hora_inicio: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Duración + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Duración (horas)</label>
              <input type="number" step="0.5" min="0.5" value={draft.duracion_horas ?? ''} onChange={e => setDraft(d => ({ ...d, duracion_horas: parseFloat(e.target.value) || null }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Prioridad</label>
              <select value={draft.prioridad ?? 'normal'} onChange={e => setDraft(d => ({ ...d, prioridad: e.target.value as TradeJob['prioridad'] }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500">
                <option value="urgente">🔴 Urgente</option>
                <option value="alta">🟠 Alta</option>
                <option value="normal">⚪ Normal</option>
                <option value="baja">🔵 Baja</option>
              </select>
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Dirección</label>
            <input value={draft.direccion ?? ''} onChange={e => setDraft(d => ({ ...d, direccion: e.target.value }))} placeholder="Calle Mayor 12"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Localidad</label>
              <input value={draft.localidad ?? ''} onChange={e => setDraft(d => ({ ...d, localidad: e.target.value }))} placeholder="Sevilla"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">C.P.</label>
              <input value={draft.cp ?? ''} onChange={e => setDraft(d => ({ ...d, cp: e.target.value }))} placeholder="41001"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Estado (solo edición) */}
          {editingJob && (
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Estado</label>
              <select value={draft.estado ?? 'planificado'} onChange={e => setDraft(d => ({ ...d, estado: e.target.value as TradeJob['estado'] }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500">
                {Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}

          {/* Trabajadores */}
          {workers.filter(w => w.activo).length > 0 && (
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-2">Trabajadores asignados</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {workers.filter(w => w.activo).map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="cursor-pointer"
                      checked={selectedWorkerIds.has(w.id)}
                      onChange={e => setSelectedWorkerIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(w.id); else next.delete(w.id);
                        return next;
                      })} />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{w.nombre}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{w.rol}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Notas / instrucciones</label>
            <textarea rows={2} value={draft.descripcion ?? ''} onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))} placeholder="Instrucciones para el técnico..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:border-slate-400">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5" />{editingJob ? 'Guardar cambios' : 'Crear trabajo'}</>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full">

      {/* Barra de navegación */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Vista día/semana */}
        <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex text-[10px]">
          {(['dia', 'semana'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all cursor-pointer ${viewMode === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>

        {/* Navegación de fecha */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'dia' ? -1 : -7))}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setSelectedDate(today)}
            className="text-[10px] font-bold uppercase font-mono text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer px-2">
            Hoy
          </button>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono capitalize min-w-[180px] text-center">
            {viewMode === 'dia' ? fmt(selectedDate) : `Sem. del ${fmt(weekDays[0])}`}
          </span>
          <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'dia' ? 1 : 7))}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setShowRoute(!showRoute)}
            className={`flex items-center gap-1 text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${showRoute ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Navigation className="w-3 h-3" />
            Ruta del día
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
            <Plus className="w-3 h-3" />
            Nuevo trabajo
          </button>
        </div>
      </div>

      {/* Filtros estado */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['todos', 'planificado', 'en_curso', 'completado', 'cancelado'] as FilterEstado[]).map(f => (
          <button key={f} onClick={() => setFilterEstado(f)}
            className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer transition-all ${filterEstado === f ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}>
            {f === 'todos' ? 'Todos' : ESTADO_CFG[f as TradeJob['estado']].label}
            <span className="ml-1 opacity-60">
              {f === 'todos' ? visibleJobs.length : visibleJobs.filter(j => j.estado === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Demo notice */}
      {!isLiveMode && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-300">Modo demo — datos de ejemplo. Activa el modo real para crear y gestionar trabajos.</p>
        </div>
      )}

      {/* Vista ruta */}
      {showRoute && <RouteView />}

      {/* Vista semana */}
      {viewMode === 'semana' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayJobs = filtered.filter(j => j.fecha_inicio === day);
            const isToday = day === today;
            return (
              <div key={day} className={`rounded-xl border overflow-hidden ${isToday ? 'border-blue-400 dark:border-blue-600' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className={`px-2 py-1.5 text-center border-b ${isToday ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  <p className="text-[9px] font-bold uppercase font-mono">{new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</p>
                  <p className="text-xs font-bold">{new Date(day + 'T12:00:00').getDate()}</p>
                </div>
                <div className="p-1.5 space-y-1 min-h-[80px]">
                  {dayJobs.length === 0
                    ? <p className="text-[9px] text-slate-300 dark:text-slate-700 text-center py-2">—</p>
                    : dayJobs.map(job => (
                        <div key={job.id} className="bg-slate-50 dark:bg-slate-800 rounded p-1.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" onClick={() => openEdit(job)}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ESTADO_CFG[job.estado].dot}`} />
                            <span className="text-[8px] font-mono text-slate-400">{job.hora_inicio ?? ''}</span>
                          </div>
                          <p className="text-[9px] font-semibold text-slate-700 dark:text-slate-300 leading-tight truncate">{job.titulo}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista día */}
      {viewMode === 'dia' && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-xs mb-3">No hay trabajos para este día.</p>
              <button onClick={openCreate}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase px-4 py-2 rounded-lg cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Añadir trabajo
              </button>
            </div>
          ) : (
            filtered
              .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
              .map(job => <JobCard key={job.id} job={job} />)
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && <JobModal />}
    </div>
  );
}
