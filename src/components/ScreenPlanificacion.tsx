import { useState } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, MapPin, Clock, User, Users,
  CheckCircle, Play, Trash2, Edit3, Navigation, CalendarDays,
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

const ESTADO_CFG: Record<TradeJob['estado'], { label: string; cls: string; dot: string }> = {
  planificado:        { label: 'Planificado',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     dot: 'bg-blue-500' },
  en_curso:           { label: 'En curso',       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  completado:         { label: 'Completado',     cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelado:          { label: 'Cancelado',      cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',         dot: 'bg-red-500' },
  pendiente_material: { label: 'Pdte. material', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-500' },
};

const PRIORIDAD_CFG: Record<TradeJob['prioridad'], { label: string; cls: string } | null> = {
  urgente: { label: 'URGENTE', cls: 'bg-red-600 text-white' },
  alta:    { label: 'Alta',    cls: 'bg-orange-500 text-white' },
  normal:  null,
  baja:    { label: 'Baja',   cls: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

const DEMO_JOBS: TradeJob[] = (() => {
  const today    = new Date().toISOString().split('T')[0];
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

const EMPTY_DRAFT = (): Partial<TradeJob> => ({
  titulo: '', descripcion: '', estado: 'planificado', prioridad: 'normal',
  fecha_inicio: new Date().toISOString().split('T')[0],
  hora_inicio: '09:00', duracion_horas: 2,
  direccion: '', localidad: '', cp: '', client_id: null,
});

// ── JobModalPanel ─────────────────────────────────────────────────────────────
interface JobModalPanelProps {
  draft: Partial<TradeJob>;
  setDraft: (updater: (d: Partial<TradeJob>) => Partial<TradeJob>) => void;
  editingJob: TradeJob | null;
  clientes: Cliente[];
  workers: Worker[];
  selectedWorkerIds: Set<string>;
  setSelectedWorkerIds: (updater: (prev: Set<string>) => Set<string>) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

function JobModalPanel({ draft, setDraft, editingJob, clientes, workers, selectedWorkerIds, setSelectedWorkerIds, saving, onClose, onSave }: JobModalPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            {editingJob ? 'Editar trabajo' : 'Nuevo trabajo'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Título *</label>
            <input value={draft.titulo ?? ''} onChange={e => setDraft(d => ({ ...d, titulo: e.target.value }))} placeholder="Ej: Instalación calentador eléctrico"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Cliente</label>
            <select value={draft.client_id ?? ''} onChange={e => setDraft(d => ({ ...d, client_id: e.target.value || null }))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500">
              <option value="">— Sin cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
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
          {editingJob && (
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Estado</label>
              <select value={draft.estado ?? 'planificado'} onChange={e => setDraft(d => ({ ...d, estado: e.target.value as TradeJob['estado'] }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500">
                {Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
          {workers.filter(w => w.activo).length > 0 && (
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-2">Trabajadores asignados</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {workers.filter(w => w.activo).map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer">
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
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Notas / instrucciones</label>
            <textarea rows={2} value={draft.descripcion ?? ''} onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))} placeholder="Instrucciones para el técnico..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:border-slate-400">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5" />{editingJob ? 'Guardar cambios' : 'Crear trabajo'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DayCarousel ───────────────────────────────────────────────────────────────
const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function getWeekDays(weekOffset: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const now    = new Date();
    const dow    = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

interface DayCarouselProps {
  jobs: TradeJob[];
  selectedDate: string;
  weekOffset: number;
  onSelectDate: (d: string) => void;
  onChangeWeek: (delta: number) => void;
}

function DayCarousel({ jobs, selectedDate, weekOffset, onSelectDate, onChangeWeek }: DayCarouselProps) {
  const today    = new Date().toISOString().split('T')[0];
  const weekDays = getWeekDays(weekOffset);
  const from = new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const to   = new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-white border-b border-slate-100 px-3 pt-2 pb-3 space-y-2 sticky top-0 z-10">
      {/* Semana nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChangeWeek(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold font-mono uppercase text-slate-400 tracking-wider">
          {weekOffset === 0 ? 'Esta semana' : `${from} – ${to}`}
        </span>
        <button
          onClick={() => onChangeWeek(1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Días */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((date, i) => {
          const dayJobs    = jobs.filter(j => j.fecha_inicio === date && j.estado !== 'cancelado');
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const hasActive  = dayJobs.some(j => j.estado === 'en_curso');
          const hasPending = dayJobs.some(j => j.estado === 'planificado' || j.estado === 'pendiente_material');
          const dotColor   = hasActive ? 'bg-amber-400' : hasPending ? 'bg-blue-400' : dayJobs.length > 0 ? 'bg-emerald-400' : '';

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center py-2 rounded-xl transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600'
                  : isToday
                    ? 'bg-blue-50 ring-1 ring-blue-300'
                    : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-[9px] font-bold uppercase mb-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                {DAY_ABBR[i]}
              </span>
              <span className={`text-sm font-bold leading-none ${
                isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-slate-700'
              }`}>
                {new Date(date + 'T12:00:00').getDate()}
              </span>
              <div className="h-1.5 mt-1 flex items-center justify-center">
                {dotColor && <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── JobCard ───────────────────────────────────────────────────────────────────
interface JobCardProps {
  job: TradeJob;
  onQuickStatus: (job: TradeJob, estado: TradeJob['estado']) => void;
  onEdit: (job: TradeJob) => void;
  onDelete: (job: TradeJob) => void;
}

function JobCard({ job, onQuickStatus, onEdit, onDelete }: JobCardProps) {
  const est    = ESTADO_CFG[job.estado];
  const pri    = PRIORIDAD_CFG[job.prioridad];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [job.direccion, job.localidad, job.cp].filter(Boolean).join(', '),
  )}`;

  return (
    <div className={`bg-white border rounded-xl p-3.5 space-y-2.5 ${job.estado === 'completado' ? 'opacity-60' : ''} border-slate-200`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${est.dot}`} />
          <span className="font-semibold text-xs text-slate-900 truncate">{job.titulo}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {pri && <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${pri.cls}`}>{pri.label}</span>}
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${est.cls}`}>{est.label}</span>
        </div>
      </div>

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

      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
        {job.estado === 'planificado' && (
          <button onClick={() => onQuickStatus(job, 'en_curso')}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
            <Play className="w-2.5 h-2.5" /> Iniciar
          </button>
        )}
        {job.estado === 'en_curso' && (
          <button onClick={() => onQuickStatus(job, 'completado')}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
            <CheckCircle className="w-2.5 h-2.5" /> Completar
          </button>
        )}
        {(job.direccion || job.localidad) && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 border border-slate-200 text-slate-500 hover:text-blue-500 text-[9px] font-bold uppercase px-2 py-1 rounded cursor-pointer transition-colors">
            <Navigation className="w-2.5 h-2.5" /> Maps
          </a>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onEdit(job)} className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors rounded">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(job)} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer transition-colors rounded">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScreenPlanificacion({
  jobs: propJobs, workers, clientes, isLiveMode,
  onCreateJob, onUpdateJob, onDeleteJob, onAssignWorker, onRemoveWorker, showToast,
}: ScreenPlanificacionProps) {
  const jobs  = isLiveMode ? propJobs : DEMO_JOBS;
  const today = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate]           = useState(today);
  const [weekOffset, setWeekOffset]               = useState(0);
  const [filterEstado, setFilterEstado]           = useState<'todos' | TradeJob['estado']>('todos');
  const [showModal, setShowModal]                 = useState(false);
  const [editingJob, setEditingJob]               = useState<TradeJob | null>(null);
  const [draft, setDraft]                         = useState<Partial<TradeJob>>(EMPTY_DRAFT());
  const [saving, setSaving]                       = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());

  const dayJobs = jobs.filter(j => j.fecha_inicio === selectedDate);

  const FILTER_STATES: Array<'todos' | TradeJob['estado']> = [
    'todos', 'planificado', 'en_curso', 'pendiente_material', 'completado', 'cancelado',
  ];

  const filtered = filterEstado === 'todos'
    ? dayJobs
    : dayJobs.filter(j => j.estado === filterEstado);

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
        const prevIds  = new Set(editingJob.trade_job_workers?.map(jw => jw.worker_id) ?? []);
        const toAdd    = [...selectedWorkerIds].filter(id => !prevIds.has(id));
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

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setFilterEstado('todos');
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Carrusel de días (oscuro, pegado al header) ── */}
      <DayCarousel
        jobs={jobs}
        selectedDate={selectedDate}
        weekOffset={weekOffset}
        onSelectDate={handleSelectDate}
        onChangeWeek={delta => {
          const newOffset = weekOffset + delta;
          setWeekOffset(newOffset);
          const days = getWeekDays(newOffset);
          if (!days.includes(selectedDate)) handleSelectDate(days[0]);
        }}
      />

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-3">

        {/* Filtros de estado + botón nuevo */}
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTER_STATES.map(f => {
            const count = f === 'todos' ? dayJobs.length : dayJobs.filter(j => j.estado === f).length;
            if (count === 0 && f !== 'todos') return null;
            return (
              <button
                key={f}
                onClick={() => setFilterEstado(f)}
                className={`shrink-0 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                  filterEstado === f
                    ? 'bg-slate-900 text-white border-transparent'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {f === 'todos' ? 'Todos' : ESTADO_CFG[f as TradeJob['estado']].label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
          <button
            onClick={openCreate}
            className="ml-auto shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase px-2.5 py-1 rounded-full cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" /> Nuevo
          </button>
        </div>

        {/* Demo notice */}
        {!isLiveMode && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-700">Modo demo. Activa el modo real para gestionar trabajos.</p>
          </div>
        )}

        {/* Jobs */}
        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-xs mb-4">No hay trabajos para este día.</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir trabajo
            </button>
          </div>
        ) : (
          filtered
            .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
            .map(job => (
              <JobCard
                key={job.id}
                job={job}
                onQuickStatus={handleQuickStatus}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <JobModalPanel
          draft={draft}
          setDraft={setDraft}
          editingJob={editingJob}
          clientes={clientes}
          workers={workers}
          selectedWorkerIds={selectedWorkerIds}
          setSelectedWorkerIds={setSelectedWorkerIds}
          saving={saving}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
