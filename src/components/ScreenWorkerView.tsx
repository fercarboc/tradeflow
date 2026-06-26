import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Clock, User, Navigation, CheckCircle, Play,
  LogOut, RefreshCw, AlertTriangle, Phone, ChevronDown, ChevronUp, X, Check,
  Plus, Camera, Loader2, CalendarDays, Edit2, Route, Users, Trash2,
  ChevronLeft, ChevronRight, List, Bell, BellOff, Wrench, AlertCircle, FileText,
} from 'lucide-react';
import {
  supabase, loadWorkerJobs, workerSetJobStatus,
  loadJobPhotos, uploadJobPhoto, workerCreateJob, loadOrgClients,
  loadJobs, updateJob, loadOrgWorkers, assignWorkerToJob, removeWorkerFromJob,
  deleteJob, subscribePush, unsubscribePush, isPushSubscribed,
  loadWorkerIncidencias, updateMaintenanceIncidencia, sendParteTrabajo,
} from '../lib/supabase';
import type { WorkerProfile, TradeJob, TradeJobPhoto, TradeClient, TradeJobWorker, MaintenanceIncidencia } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../types';

interface Props {
  workerProfile: WorkerProfile | null;
  session: Session | null;
  setCurrentPage: (p: ActivePage) => void;
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

const FILTER_OPTIONS: Array<'todos' | TradeJob['estado']> = [
  'todos', 'planificado', 'en_curso', 'pendiente_material', 'completado', 'cancelado',
];

const INC_PRIORIDAD_LABEL: Record<MaintenanceIncidencia['prioridad'], string> = {
  critica: 'Crítica', urgente: 'Urgente', normal: 'Normal', baja: 'Baja',
};
const INC_PRIORIDAD_DOT: Record<MaintenanceIncidencia['prioridad'], string> = {
  critica: 'bg-red-500', urgente: 'bg-orange-500', normal: 'bg-blue-500', baja: 'bg-slate-500',
};
const INC_ESTADO_LABEL: Record<MaintenanceIncidencia['estado'], string> = {
  abierta: 'Abierta', en_curso: 'En curso', resuelta: 'Resuelta', cerrada: 'Cerrada',
};
const INC_ESTADO_DOT: Record<MaintenanceIncidencia['estado'], string> = {
  abierta: 'bg-red-500', en_curso: 'bg-amber-500', resuelta: 'bg-emerald-500', cerrada: 'bg-slate-500',
};

function fmtDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function mapsUrl(job: TradeJob): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [job.direccion, job.localidad, job.cp].filter(Boolean).join(', '),
  )}`;
}

// ── TodaySummary ──────────────────────────────────────────────────────────────

interface TodaySummaryProps {
  jobs: TradeJob[];
  onFocus: (jobId: string) => void;
}

function TodaySummary({ jobs, onFocus }: TodaySummaryProps) {
  if (jobs.length === 0) return null;
  const completed  = jobs.filter(j => j.estado === 'completado').length;
  const totalHours = jobs.reduce((s, j) => s + (j.duracion_horas ?? 0), 0);
  const nextJob    = jobs.find(j => j.estado !== 'completado' && j.estado !== 'cancelado');
  const allDone    = completed === jobs.length;

  return (
    <div className="bg-slate-800/70 border border-blue-700/40 rounded-xl p-4 mb-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">Ruta de hoy</span>
        </div>
        {totalHours > 0 && (
          <span className="text-[9px] text-slate-400 font-mono">~{totalHours}h estimadas</span>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[9px] text-slate-500 mb-1.5">
          <span>{completed} completados</span>
          <span>{jobs.length} total</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(completed / jobs.length) * 100}%` }}
          />
        </div>
      </div>

      {allDone ? (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">¡Todos los trabajos completados!</span>
        </div>
      ) : nextJob ? (
        <button
          onClick={() => onFocus(nextJob.id)}
          className="w-full bg-slate-800/60 hover:bg-slate-800 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer"
        >
          <p className="text-[9px] font-mono uppercase text-blue-400 mb-0.5">Próxima parada</p>
          <p className="text-xs font-bold text-white leading-snug">{nextJob.titulo}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {nextJob.hora_inicio && (
              <span className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                <Clock className="w-2.5 h-2.5" />{nextJob.hora_inicio}
                {nextJob.duracion_horas ? ` · ${nextJob.duracion_horas}h` : ''}
              </span>
            )}
            {nextJob.direccion && (
              <span className="flex items-center gap-1 text-[9px] text-slate-400 truncate max-w-[180px]">
                <MapPin className="w-2.5 h-2.5 shrink-0" />{nextJob.direccion}
              </span>
            )}
          </div>
        </button>
      ) : null}
    </div>
  );
}

// ── WeekStrip ─────────────────────────────────────────────────────────────────

const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getWeekDays(weekOffset: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

interface WeekStripProps {
  jobs: TradeJob[];
  selectedDate: string;
  weekOffset: number;
  onSelectDate: (date: string) => void;
  onChangeWeek: (delta: number) => void;
}

function WeekStrip({ jobs, selectedDate, weekOffset, onSelectDate, onChangeWeek }: WeekStripProps) {
  const today = new Date().toISOString().split('T')[0];
  const weekDays = getWeekDays(weekOffset);

  const from = new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const to   = new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 pt-2 pb-3 space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => onChangeWeek(-1)} className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {weekOffset === 0 ? 'Esta semana' : `${from} – ${to}`}
        </span>
        <button onClick={() => onChangeWeek(1)} className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((date, i) => {
          const dayJobs = jobs.filter(j => j.fecha_inicio === date && j.estado !== 'cancelado');
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const dayNum = new Date(date + 'T12:00:00').getDate();
          const hasActive  = dayJobs.some(j => j.estado === 'en_curso');
          const hasPending = dayJobs.some(j => j.estado === 'planificado' || j.estado === 'pendiente_material');
          const dotColor   = hasActive ? 'bg-amber-500' : hasPending ? 'bg-blue-500' : dayJobs.length > 0 ? 'bg-emerald-500' : '';

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center py-2 rounded-xl transition-colors cursor-pointer ${
                isSelected ? 'bg-blue-600' : isToday ? 'bg-slate-800 ring-1 ring-blue-500/40' : 'hover:bg-slate-800'
              }`}
            >
              <span className={`text-[9px] font-bold uppercase mb-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                {DAY_ABBR[i]}
              </span>
              <span className={`text-sm font-bold leading-none ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                {dayNum}
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

// ── WorkerPickerModal ─────────────────────────────────────────────────────────

interface WorkerPickerModalProps {
  job: TradeJob;
  orgWorkers: WorkerProfile[];
  onToggle: (workerId: string, isAssigned: boolean) => Promise<void>;
  onClose: () => void;
}

function WorkerPickerModal({ job, orgWorkers, onToggle, onClose }: WorkerPickerModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const assignedIds = new Set((job.trade_job_workers ?? []).map(jw => jw.worker_id));

  const handleToggle = async (worker: WorkerProfile) => {
    setLoadingId(worker.id);
    try {
      await onToggle(worker.id, assignedIds.has(worker.id));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md shadow-2xl max-h-[70vh] flex flex-col">
        <div className="flex justify-between items-center px-5 pt-5 pb-3 shrink-0">
          <div>
            <h3 className="font-bold text-sm text-white">Trabajadores asignados</h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[260px]">{job.titulo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-5 space-y-1.5">
          {orgWorkers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No hay trabajadores en la organización.</p>
          ) : (
            orgWorkers.map(worker => {
              const isAssigned = assignedIds.has(worker.id);
              const isLoading  = loadingId === worker.id;
              return (
                <button
                  key={worker.id}
                  onClick={() => handleToggle(worker)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-left disabled:opacity-60 ${
                    isAssigned
                      ? 'bg-blue-600/20 border border-blue-600/40'
                      : 'bg-slate-800/60 border border-transparent hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isAssigned ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {worker.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white leading-tight">{worker.nombre}</p>
                    <p className="text-[9px] text-slate-400 font-mono uppercase">{worker.rol}</p>
                  </div>
                  {isLoading
                    ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    : isAssigned
                      ? <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      : <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                  }
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── NewJobModal ───────────────────────────────────────────────────────────────

interface NewJobModalProps {
  clientes: TradeClient[];
  onSave: (draft: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>) => Promise<void>;
  onClose: () => void;
}

function NewJobModal({ clientes, onSave, onClose }: NewJobModalProps) {
  const [titulo, setTitulo]       = useState('');
  const [fecha, setFecha]         = useState(new Date().toISOString().split('T')[0]);
  const [hora, setHora]           = useState('');
  const [duracion, setDuracion]   = useState('');
  const [direccion, setDireccion] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  const handleSubmit = async () => {
    if (!titulo.trim()) { setErr('El título es obligatorio'); return; }
    if (!fecha) { setErr('La fecha es obligatoria'); return; }
    setErr('');
    setSaving(true);
    try {
      await onSave({
        titulo: titulo.trim(), estado: 'planificado', prioridad: 'normal',
        fecha_inicio: fecha, hora_inicio: hora || null,
        duracion_horas: duracion ? parseFloat(duracion) : null,
        direccion: direccion || null, client_id: clienteId || null,
        descripcion: descripcion || null,
        fecha_fin: null, hora_fin: null, localidad: null, cp: null,
        latitud: null, longitud: null, quote_id: null,
        completado_por: null, completado_at: null, notas_cierre: null,
      });
    } catch (e: unknown) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-5 pt-5 pb-3 shrink-0">
          <h3 className="font-bold text-sm text-white">Nuevo trabajo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-3">
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Reparación calentador" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Hora inicio</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Duración (h)</label>
              <input type="number" min="0.5" step="0.5" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="1.5" className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Dirección</label>
            <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, localidad" className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Descripción</label>
            <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalles del trabajo..." className={inputCls + ' resize-none'} />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-slate-500">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarDays className="w-3.5 h-3.5" /> Crear trabajo</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditJobModal ──────────────────────────────────────────────────────────────

interface EditJobModalProps {
  job: TradeJob;
  onSave: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  onClose: () => void;
}

function EditJobModal({ job, onSave, onClose }: EditJobModalProps) {
  const [titulo, setTitulo]       = useState(job.titulo);
  const [fecha, setFecha]         = useState(job.fecha_inicio ?? '');
  const [hora, setHora]           = useState(job.hora_inicio ?? '');
  const [duracion, setDuracion]   = useState(job.duracion_horas?.toString() ?? '');
  const [descripcion, setDescripcion] = useState(job.descripcion ?? '');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  const handleSubmit = async () => {
    if (!titulo.trim()) { setErr('El título es obligatorio'); return; }
    setSaving(true);
    try {
      await onSave(job.id, {
        titulo: titulo.trim(),
        fecha_inicio: fecha || null,
        hora_inicio: hora || null,
        duracion_horas: duracion ? parseFloat(duracion) : null,
        descripcion: descripcion || null,
      });
    } catch (e: unknown) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h3 className="font-bold text-sm text-white">Editar trabajo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-2 space-y-3">
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Título</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Duración (h)</label>
            <input type="number" min="0.5" step="0.5" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="1.5" className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Descripción</label>
            <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls + ' resize-none'} />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-slate-500">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ResolveIncModal ───────────────────────────────────────────────────────────

interface ResolveIncModalProps {
  inc: MaintenanceIncidencia;
  onResolve: (notes: string) => Promise<void>;
  onClose: () => void;
}

function ResolveIncModal({ inc, onResolve, onClose }: ResolveIncModalProps) {
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try { await onResolve(notes); }
    catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm text-white">Resolver incidencia</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{inc.titulo}</p>
        <div className="mb-4">
          <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1.5">Notas de resolución (opcional)</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej: Solucionado. Sustituida la válvula de expansión..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-slate-500">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Confirmar resolución</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScreenWorkerView({ workerProfile, session, setCurrentPage }: Props) {
  const [jobs, setJobs]               = useState<TradeJob[]>([]);
  const [allJobs, setAllJobs]         = useState<TradeJob[]>([]);
  const [viewMode, setViewMode]       = useState<'mis' | 'todos'>('mis');
  const [filterEstado, setFilterEstado] = useState<'todos' | TradeJob['estado']>('todos');
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [completeModal, setCompleteModal] = useState<TradeJob | null>(null);
  const [editModal, setEditModal]     = useState<TradeJob | null>(null);
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [closeNotes, setCloseNotes]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [jobPhotos, setJobPhotos]     = useState<Record<string, TradeJobPhoto[]>>({});
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);
  const [newJobOpen, setNewJobOpen]   = useState(false);
  const [clientes, setClientes]       = useState<TradeClient[]>([]);
  const [orgWorkers, setOrgWorkers]   = useState<WorkerProfile[]>([]);
  const [calView, setCalView]         = useState<'lista' | 'semana'>('lista');
  const [weekOffset, setWeekOffset]   = useState(0);
  const [weekDay, setWeekDay]         = useState(() => new Date().toISOString().split('T')[0]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const photoInputRef                 = useRef<HTMLInputElement>(null);
  const activePhotoJobId              = useRef<string | null>(null);

  const [mainTab, setMainTab]             = useState<'trabajos' | 'mantenimiento'>('trabajos');
  const [incidencias, setIncidencias]     = useState<MaintenanceIncidencia[]>([]);
  const [incLoading, setIncLoading]       = useState(false);
  const [expandedIncId, setExpandedIncId] = useState<string | null>(null);
  const [resolveModal, setResolveModal]   = useState<MaintenanceIncidencia | null>(null);
  const [incSending, setIncSending]       = useState<string | null>(null);

  const isAdmin = workerProfile?.rol === 'admin';

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async () => {
    if (!workerProfile) return;
    setLoading(true);
    try {
      if (viewMode === 'todos') {
        const data = await loadJobs(workerProfile.org_id);
        setAllJobs(data);
      } else {
        const data = await loadWorkerJobs(workerProfile.id, workerProfile.org_id);
        setJobs(data);
      }
    } catch (e: unknown) {
      showToast('Error cargando trabajos: ' + (e as Error).message, 'error');
    }
    setLoading(false);
  }, [workerProfile, viewMode]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!workerProfile) return;
    loadOrgClients(workerProfile.org_id).then(setClientes).catch(() => {});
  }, [workerProfile]);

  useEffect(() => {
    if (!isAdmin || !workerProfile) return;
    loadOrgWorkers(workerProfile.org_id).then(setOrgWorkers).catch(() => {});
  }, [isAdmin, workerProfile]);

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    setIncLoading(true);
    loadWorkerIncidencias(session.user.id)
      .then(setIncidencias)
      .catch(() => {})
      .finally(() => setIncLoading(false));
  }, [session]);

  const handleStartInc = async (inc: MaintenanceIncidencia) => {
    try {
      const now = new Date().toISOString();
      await updateMaintenanceIncidencia(inc.id, { estado: 'en_curso', fecha_inicio_intervencion: now });
      setIncidencias(prev => prev.map(i => i.id === inc.id ? { ...i, estado: 'en_curso' as const, fecha_inicio_intervencion: now } : i));
      showToast('Intervención iniciada ✓');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const handleResolveInc = async (inc: MaintenanceIncidencia, notes: string) => {
    const now = new Date().toISOString();
    await updateMaintenanceIncidencia(inc.id, {
      estado: 'resuelta',
      fecha_resolucion: now,
      notas_resolucion: notes || null,
    });
    setIncidencias(prev => prev.map(i => i.id === inc.id ? { ...i, estado: 'resuelta' as const, fecha_resolucion: now, notas_resolucion: notes || null } : i));
    setResolveModal(null);
    showToast('Incidencia resuelta ✓');
  };

  const handleSendParte = async (inc: MaintenanceIncidencia) => {
    setIncSending(inc.id);
    try {
      await sendParteTrabajo(inc.id);
      showToast('Parte de intervención enviado ✓');
    } catch (e: unknown) {
      showToast('Error al enviar: ' + (e as Error).message, 'error');
    }
    setIncSending(null);
  };

  const handleSetViewMode = (mode: 'mis' | 'todos') => {
    setViewMode(mode);
    setFilterEstado('todos');
    setExpandedId(null);
  };

  const displayJobs = viewMode === 'todos' ? allJobs : jobs;

  const baseJobs = calView === 'semana'
    ? displayJobs.filter(j => j.fecha_inicio === weekDay)
    : displayJobs;

  const filteredJobs = filterEstado === 'todos'
    ? baseJobs
    : baseJobs.filter(j => j.estado === filterEstado);

  const handleExpand = async (jobId: string) => {
    const next = expandedId === jobId ? null : jobId;
    setExpandedId(next);
    if (next && !jobPhotos[next]) {
      try {
        const photos = await loadJobPhotos(next);
        setJobPhotos(prev => ({ ...prev, [next]: photos }));
      } catch {/* non-critical */}
    }
  };

  const handlePhotoClick = (jobId: string) => {
    activePhotoJobId.current = jobId;
    photoInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const jobId = activePhotoJobId.current;
    if (!file || !jobId || !workerProfile) return;
    e.target.value = '';
    setPhotoUploading(jobId);
    try {
      const photo = await uploadJobPhoto(jobId, file, workerProfile.id, workerProfile.org_id);
      setJobPhotos(prev => ({ ...prev, [jobId]: [...(prev[jobId] ?? []), photo] }));
      showToast('Foto subida ✓');
    } catch (err: unknown) {
      showToast('Error subiendo foto: ' + (err as Error).message, 'error');
    }
    setPhotoUploading(null);
    activePhotoJobId.current = null;
  };

  const handleStatus = async (job: TradeJob, estado: TradeJob['estado']) => {
    if (!workerProfile) return;
    try {
      await workerSetJobStatus(job.id, workerProfile.id, estado);
      const u = (prev: TradeJob[]) => prev.map(j => j.id === job.id ? { ...j, estado } : j);
      setJobs(u); setAllJobs(u);
      showToast(estado === 'en_curso' ? 'Trabajo iniciado ✓' : 'Estado actualizado ✓');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const handleComplete = async () => {
    if (!completeModal || !workerProfile) return;
    setSaving(true);
    try {
      await workerSetJobStatus(completeModal.id, workerProfile.id, 'completado', closeNotes);
      const u = (prev: TradeJob[]) => prev.map(j => j.id === completeModal.id ? { ...j, estado: 'completado' as const } : j);
      setJobs(u); setAllJobs(u);
      showToast('Trabajo completado ✓');
      setCompleteModal(null); setCloseNotes('');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleEditJob = async (id: string, updates: Partial<TradeJob>) => {
    await updateJob(id, updates);
    const u = (prev: TradeJob[]) => prev.map(j => j.id === id ? { ...j, ...updates } : j);
    setJobs(u); setAllJobs(u);
    setEditModal(null);
    showToast('Trabajo actualizado ✓');
  };

  const handleToggleWorker = async (jobId: string, workerId: string, isAssigned: boolean) => {
    if (isAssigned) {
      await removeWorkerFromJob(jobId, workerId);
      const u = (prev: TradeJob[]) => prev.map(j =>
        j.id === jobId
          ? { ...j, trade_job_workers: (j.trade_job_workers ?? []).filter(jw => jw.worker_id !== workerId) }
          : j,
      );
      setAllJobs(u);
    } else {
      const jobTitulo = allJobs.find(j => j.id === jobId)?.titulo;
      await assignWorkerToJob(jobId, workerId, 'asignado', jobTitulo);
      const worker = orgWorkers.find(w => w.id === workerId);
      const newJw: TradeJobWorker = {
        id: `tmp-${Date.now()}`,
        job_id: jobId,
        worker_id: workerId,
        rol: 'asignado',
        notificado: false,
        created_at: new Date().toISOString(),
        trade_workers: worker ? { nombre: worker.nombre, rol: worker.rol } : null,
      };
      const u = (prev: TradeJob[]) => prev.map(j =>
        j.id === jobId
          ? { ...j, trade_job_workers: [...(j.trade_job_workers ?? []), newJw] }
          : j,
      );
      setAllJobs(u);
    }
  };

  const handleCreateJob = async (
    draft: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>,
  ) => {
    if (!workerProfile) return;
    const job = await workerCreateJob(workerProfile.org_id, workerProfile.id, draft);
    setJobs(prev =>
      [...prev, job].sort((a, b) => {
        const da = (a.fecha_inicio ?? '') + (a.hora_inicio ?? '');
        const db = (b.fecha_inicio ?? '') + (b.hora_inicio ?? '');
        return da.localeCompare(db);
      }),
    );
    setNewJobOpen(false);
    showToast('Trabajo creado ✓');
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      const u = (prev: TradeJob[]) => prev.filter(j => j.id !== jobId);
      setJobs(u); setAllJobs(u);
      if (expandedId === jobId) setExpandedId(null);
      setConfirmDeleteId(null);
      showToast('Trabajo eliminado');
    } catch (e: unknown) {
      showToast('Error al eliminar: ' + (e as Error).message, 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentPage(ActivePage.Login);
  };

  const handleTogglePush = async () => {
    if (!workerProfile) return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribePush(workerProfile.id);
        setPushEnabled(false);
        showToast('Notificaciones desactivadas', 'info');
      } else {
        const granted = await Notification.requestPermission();
        if (granted !== 'granted') { showToast('Permiso denegado', 'error'); return; }
        const ok = await subscribePush(workerProfile.id, workerProfile.org_id);
        setPushEnabled(ok);
        showToast(ok ? 'Notificaciones activadas' : 'Error al activar notificaciones', ok ? 'success' : 'error');
      }
    } catch {
      showToast('Error con las notificaciones', 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const grouped = filteredJobs.reduce<Record<string, TradeJob[]>>((acc, job) => {
    const key = job.fecha_inicio ?? 'sin_fecha';
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  const todayJobsForSummary = displayJobs
    .filter(j => j.fecha_inicio === today)
    .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''));

  const activeJobs = jobs.filter(j => j.estado !== 'completado' && j.fecha_inicio === today);

  const assigningJob = assigningJobId ? allJobs.find(j => j.id === assigningJobId) ?? null : null;

  if (!workerProfile || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-white font-bold">Sin perfil de trabajador</p>
          <p className="text-slate-400 text-sm mt-1">Contacta con tu empresa para configurar tu acceso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
            {workerProfile.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">{workerProfile.nombre}</p>
            <p className="text-[9px] text-slate-400 font-mono uppercase">{workerProfile.rol}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeJobs.length > 0 && viewMode === 'mis' && (
            <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {activeJobs.length} pendiente{activeJobs.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={reload} className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const next = calView === 'lista' ? 'semana' : 'lista';
              setCalView(next);
              if (next === 'semana') {
                setWeekOffset(0);
                setWeekDay(new Date().toISOString().split('T')[0]);
              }
            }}
            className={`p-1.5 transition-colors cursor-pointer ${calView === 'semana' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            {calView === 'semana' ? <List className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
          </button>
          {'Notification' in window && (
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              title={pushEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
              className={`p-1.5 transition-colors cursor-pointer disabled:opacity-40 ${pushEnabled ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
            >
              {pushEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main tabs */}
      {(() => {
        const pendingInc = incidencias.filter(i => i.estado === 'abierta' || i.estado === 'en_curso').length;
        return (
          <div className="flex gap-1 px-4 pt-3 pb-1 bg-slate-950 border-b border-slate-800/60">
            <button
              onClick={() => setMainTab('trabajos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                mainTab === 'trabajos' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Route className="w-3 h-3" /> Trabajos
            </button>
            <button
              onClick={() => setMainTab('mantenimiento')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                mainTab === 'mantenimiento' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3 h-3" /> Mantenimiento
              {pendingInc > 0 && (
                <span className={`text-[9px] font-black rounded-full px-1.5 ${mainTab === 'mantenimiento' ? 'bg-white/25' : 'bg-red-600 text-white'}`}>{pendingInc}</span>
              )}
            </button>
          </div>
        );
      })()}

      {/* Admin sub-tabs (within trabajos) */}
      {mainTab === 'trabajos' && isAdmin && (
        <div className="flex gap-1 px-4 pt-2 pb-1 bg-slate-950">
          <button
            onClick={() => handleSetViewMode('mis')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
              viewMode === 'mis' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3 h-3" /> Mis trabajos
          </button>
          <button
            onClick={() => handleSetViewMode('todos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
              viewMode === 'todos' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" /> Todos
          </button>
        </div>
      )}

      {/* Week strip */}
      {mainTab === 'trabajos' && calView === 'semana' && (
        <WeekStrip
          jobs={displayJobs}
          selectedDate={weekDay}
          weekOffset={weekOffset}
          onSelectDate={setWeekDay}
          onChangeWeek={delta => setWeekOffset(o => o + delta)}
        />
      )}

      {/* Filter pills */}
      {mainTab === 'trabajos' && displayJobs.length > 0 && (
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto bg-slate-950" style={{ scrollbarWidth: 'none' }}>
          {FILTER_OPTIONS.map(e => {
            const count = e === 'todos' ? displayJobs.length : displayJobs.filter(j => j.estado === e).length;
            if (count === 0 && e !== 'todos') return null;
            const isActive = filterEstado === e;
            return (
              <button
                key={e}
                onClick={() => setFilterEstado(e)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {e === 'todos' ? 'Todos' : ESTADO_LABEL[e]}
                <span className={`text-[10px] font-black rounded-full px-1.5 ${isActive ? 'bg-white/25' : 'bg-slate-700 text-slate-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content — jobs */}
      {mainTab === 'trabajos' && <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayJobs.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-white font-bold">¡Todo al día!</p>
            <p className="text-slate-400 text-sm mt-1">No hay trabajos asignados.</p>
            {viewMode === 'mis' && (
              <button
                onClick={() => setNewJobOpen(true)}
                className="mt-4 flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Crear trabajo
              </button>
            )}
          </div>
        ) : baseJobs.length === 0 && calView === 'semana' ? (
          <div className="text-center py-16">
            <CalendarDays className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin trabajos para este día.</p>
            {viewMode === 'mis' && (
              <button
                onClick={() => setNewJobOpen(true)}
                className="mt-4 flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Crear trabajo
              </button>
            )}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">Sin resultados para este filtro.</p>
            <button onClick={() => setFilterEstado('todos')} className="mt-3 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
              Ver todos
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'mis' && todayJobsForSummary.length > 1 && filterEstado === 'todos' && (
              <TodaySummary jobs={todayJobsForSummary} onFocus={id => setExpandedId(id)} />
            )}

            {sortedDates.map(date => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${date === today ? 'text-blue-400' : 'text-slate-300'}`}>
                    {fmtDate(date)}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    · {grouped[date].length} trabajo{grouped[date].length > 1 ? 's' : ''}
                  </span>
                  {date === today && (
                    <span className="ml-auto text-[8px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">HOY</span>
                  )}
                </div>

                <div className="space-y-3">
                  {grouped[date].map(job => {
                    const isExpanded = expandedId === job.id;
                    const isDone = job.estado === 'completado';
                    const photos = jobPhotos[job.id] ?? [];
                    const isUploading = photoUploading === job.id;
                    const assignedWorkers = job.trade_job_workers ?? [];
                    return (
                      <div key={job.id} className={`bg-slate-800/70 border rounded-xl overflow-hidden transition-all ${isDone ? 'border-emerald-800/40 opacity-70' : 'border-slate-700/60'}`}>
                        <button
                          onClick={() => handleExpand(job.id)}
                          className="w-full px-4 py-3 flex items-start gap-3 text-left cursor-pointer"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ESTADO_DOT[job.estado]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white leading-snug">{job.titulo}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {job.hora_inicio && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                  <Clock className="w-2.5 h-2.5" />{job.hora_inicio}{job.duracion_horas ? ` · ${job.duracion_horas}h` : ''}
                                </span>
                              )}
                              {job.trade_clients?.nombre && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <User className="w-2.5 h-2.5" />{job.trade_clients.nombre}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(job.direccion || job.localidad) && (
                              <a
                                href={mapsUrl(job)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-1 rounded-lg"
                              >
                                <Navigation className="w-2.5 h-2.5" /> Maps
                              </a>
                            )}
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isDone ? 'bg-emerald-900/50 text-emerald-400' :
                              job.estado === 'en_curso' ? 'bg-amber-900/50 text-amber-400' :
                              'bg-slate-800 text-slate-400'
                            }`}>{ESTADO_LABEL[job.estado]}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-800 px-4 py-3 space-y-3">
                            {(job.direccion || job.localidad) && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <p className="flex-1 text-xs text-slate-300 min-w-0">{[job.direccion, job.localidad, job.cp].filter(Boolean).join(', ')}</p>
                                <a href={mapsUrl(job)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-800 px-2 py-1 rounded cursor-pointer shrink-0">
                                  <Navigation className="w-2.5 h-2.5" /> Maps
                                </a>
                              </div>
                            )}

                            {job.trade_clients?.telefono && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <a href={`tel:${job.trade_clients.telefono}`} className="text-xs text-blue-400 hover:text-blue-300">
                                  {job.trade_clients.telefono}
                                </a>
                              </div>
                            )}

                            {job.descripcion && (
                              <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-800/50 rounded-lg px-3 py-2">
                                {job.descripcion}
                              </p>
                            )}

                            {/* Photos */}
                            <div>
                              {photos.length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-2">
                                  {photos.map(p => (
                                    <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer">
                                      <img src={p.photo_url} alt="foto trabajo" className="w-16 h-16 object-cover rounded-lg border border-slate-700 hover:opacity-80 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => handlePhotoClick(job.id)}
                                disabled={isUploading}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                              >
                                {isUploading
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Subiendo...</>
                                  : <><Camera className="w-3 h-3" /> {photos.length > 0 ? 'Añadir foto' : 'Adjuntar foto'}</>
                                }
                              </button>
                            </div>

                            {/* Workers (admin + todos mode) */}
                            {isAdmin && viewMode === 'todos' && (
                              <div>
                                {assignedWorkers.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {assignedWorkers.map(jw => (
                                      <span key={jw.id} className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-[9px] text-slate-300">
                                        <div className="w-3.5 h-3.5 bg-blue-600/70 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0">
                                          {(jw.trade_workers?.nombre ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                        {jw.trade_workers?.nombre ?? '—'}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <button
                                  onClick={() => setAssigningJobId(job.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Users className="w-3 h-3" /> Gestionar trabajadores
                                </button>
                              </div>
                            )}

                            {isDone && job.notas_cierre && (
                              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
                                <p className="text-[9px] font-bold text-emerald-400 uppercase mb-1">Notas de cierre</p>
                                <p className="text-[10px] text-emerald-300">{job.notas_cierre}</p>
                              </div>
                            )}

                            {!isDone && (
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => setEditModal(job)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> Editar
                                </button>
                                {confirmDeleteId === job.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-slate-500">¿Eliminar?</span>
                                    <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-bold text-slate-400 hover:text-white cursor-pointer px-2 py-0.5">No</button>
                                    <button onClick={() => handleDeleteJob(job.id)} className="text-[9px] font-bold text-red-400 hover:text-red-300 cursor-pointer border border-red-800/60 px-2 py-0.5 rounded-lg">Sí, eliminar</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(job.id)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" /> Eliminar
                                  </button>
                                )}
                              </div>
                            )}

                            {!isDone && (
                              <div className="flex gap-2">
                                {job.estado === 'planificado' && (
                                  <button onClick={() => handleStatus(job, 'en_curso')}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase py-2.5 rounded-lg cursor-pointer transition-colors">
                                    <Play className="w-3 h-3" /> Iniciar trabajo
                                  </button>
                                )}
                                {(job.estado === 'planificado' || job.estado === 'en_curso') && (
                                  <button onClick={() => { setCompleteModal(job); setCloseNotes(''); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase py-2.5 rounded-lg cursor-pointer transition-colors">
                                    <CheckCircle className="w-3 h-3" /> Completar
                                  </button>
                                )}
                                {job.estado === 'en_curso' && (
                                  <button onClick={() => handleStatus(job, 'pendiente_material')}
                                    className="flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-bold uppercase px-3 py-2.5 rounded-lg cursor-pointer transition-colors">
                                    Pdte. material
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Logout button — visible at bottom of scroll */}
        <div className="pt-4 mt-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-slate-600 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer border border-slate-800/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>}

      {/* Hidden file input */}
      {mainTab === 'trabajos' && <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />}

      {/* FAB */}
      {mainTab === 'trabajos' && viewMode === 'mis' && (
        <button
          onClick={() => setNewJobOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-xl shadow-blue-900/40 flex items-center justify-center cursor-pointer transition-all z-20"
          aria-label="Nuevo trabajo"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Content — mantenimiento incidencias */}
      {mainTab === 'mantenimiento' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          {incLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : incidencias.length === 0 ? (
            <div className="text-center py-20">
              <Wrench className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-white font-bold">Sin incidencias asignadas</p>
              <p className="text-slate-400 text-sm mt-1">Cuando te asignen una incidencia de mantenimiento aparecerá aquí.</p>
            </div>
          ) : (
            <>
              {(['abierta', 'en_curso', 'resuelta', 'cerrada'] as MaintenanceIncidencia['estado'][]).map(estado => {
                const group = incidencias.filter(i => i.estado === estado);
                if (group.length === 0) return null;
                return (
                  <div key={estado}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${INC_ESTADO_DOT[estado]}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{INC_ESTADO_LABEL[estado]}</span>
                      <span className="text-[10px] text-slate-600 font-mono">({group.length})</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(inc => {
                        const isExpanded = expandedIncId === inc.id;
                        const cliente = inc.trade_maintenance_contratos?.nombre_cliente ?? null;
                        return (
                          <div key={inc.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            {/* Card header */}
                            <button
                              onClick={() => setExpandedIncId(isExpanded ? null : inc.id)}
                              className="w-full flex items-start gap-3 p-3 text-left cursor-pointer hover:bg-slate-800/50 transition-colors"
                            >
                              <span className={`w-1.5 h-full min-h-[2.5rem] rounded-full shrink-0 ${INC_PRIORIDAD_DOT[inc.prioridad]}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white leading-snug truncate">{inc.titulo}</p>
                                {cliente && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{cliente}</p>}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${INC_PRIORIDAD_DOT[inc.prioridad]} bg-opacity-20 text-white`} style={{ backgroundColor: undefined }}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${INC_PRIORIDAD_DOT[inc.prioridad]}`} />
                                    {INC_PRIORIDAD_LABEL[inc.prioridad]}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">
                                    {new Date(inc.fecha_reporte).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-slate-500 mt-0.5">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-slate-800/60 space-y-2.5">
                                {inc.descripcion && (
                                  <div className="pt-2.5">
                                    <p className="text-[9px] font-mono uppercase text-slate-500 mb-1">Descripción</p>
                                    <p className="text-xs text-slate-300 leading-relaxed">{inc.descripcion}</p>
                                  </div>
                                )}

                                {inc.notas_resolucion && (
                                  <div>
                                    <p className="text-[9px] font-mono uppercase text-slate-500 mb-1">Notas de resolución</p>
                                    <p className="text-xs text-emerald-300 leading-relaxed">{inc.notas_resolucion}</p>
                                  </div>
                                )}

                                {inc.fecha_inicio_intervencion && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    Inicio: {new Date(inc.fecha_inicio_intervencion).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                {inc.fecha_resolucion && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                                    Resuelta: {new Date(inc.fecha_resolucion).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-2 pt-1">
                                  {inc.estado === 'abierta' && (
                                    <button
                                      onClick={() => handleStartInc(inc)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      <Play className="w-3.5 h-3.5" /> Iniciar intervención
                                    </button>
                                  )}
                                  {inc.estado === 'en_curso' && (
                                    <button
                                      onClick={() => setResolveModal(inc)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Resolver
                                    </button>
                                  )}
                                  {(inc.estado === 'resuelta' || inc.estado === 'cerrada') && (
                                    <button
                                      onClick={() => handleSendParte(inc)}
                                      disabled={incSending === inc.id}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      {incSending === inc.id
                                        ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <><FileText className="w-3.5 h-3.5" /> Enviar parte</>
                                      }
                                    </button>
                                  )}
                                  {inc.estado === 'en_curso' && (
                                    <button
                                      onClick={() => handleSendParte(inc)}
                                      disabled={incSending === inc.id}
                                      className="flex items-center justify-center gap-1 py-2.5 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                                      title="Enviar parte provisional"
                                    >
                                      {incSending === inc.id
                                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <FileText className="w-3.5 h-3.5" />
                                      }
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Logout */}
              <div className="pt-4 mt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-slate-600 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer border border-slate-800/40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-white">Cerrar trabajo</h3>
              <button onClick={() => setCompleteModal(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">{completeModal.titulo}</p>
            <div className="mb-4">
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1.5">Notas de cierre (opcional)</label>
              <textarea rows={3} value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                placeholder="Ej: Instalado correctamente, cliente conforme..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCompleteModal(null)} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-slate-500">Cancelar</button>
              <button onClick={handleComplete} disabled={saving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && <EditJobModal job={editModal} onSave={handleEditJob} onClose={() => setEditModal(null)} />}

      {newJobOpen && <NewJobModal clientes={clientes} onSave={handleCreateJob} onClose={() => setNewJobOpen(false)} />}

      {resolveModal && (
        <ResolveIncModal
          inc={resolveModal}
          onResolve={notes => handleResolveInc(resolveModal, notes)}
          onClose={() => setResolveModal(null)}
        />
      )}

      {assigningJob && (
        <WorkerPickerModal
          job={assigningJob}
          orgWorkers={orgWorkers}
          onToggle={(workerId, isAssigned) => handleToggleWorker(assigningJob.id, workerId, isAssigned)}
          onClose={() => setAssigningJobId(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl whitespace-nowrap ${
          toast.type === 'error' ? 'bg-red-600 text-white' :
          toast.type === 'info'  ? 'bg-blue-600 text-white' :
          'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
