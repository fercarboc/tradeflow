import { useState, useEffect } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, MapPin, User, Users,
  CheckCircle, Play, Trash2, Edit3, Navigation, CalendarDays,
  AlertTriangle, X, Check, Zap, FileText, Phone, Receipt,
  Loader2,
} from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import { geocodeAddress, addressChanged, type GeoStatus } from '../lib/geocoder';

interface Worker { id: string; nombre: string; rol: string; activo: boolean; }
interface Cliente { id: string; nombre: string; telefono: string; }
export interface PresupuestoPendiente {
  id: string;
  nombreCliente: string;
  descripcion: string;
  total: number;
  client_id?: string | null;
}

export interface LinkedPresupuesto {
  id: string;
  descripcion: string;
  total: number;
  estado: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado';
  fecha: string;
}

export interface ScreenPlanificacionProps {
  jobs: TradeJob[];
  workers: Worker[];
  clientes: Cliente[];
  orgId: string | null;
  isLiveMode: boolean;
  isDarkMode: boolean;
  presupuestosAceptados?: PresupuestoPendiente[];
  presupuestosPorId?: Record<string, LinkedPresupuesto>;
  onCreateJob: (job: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>) => Promise<TradeJob>;
  onUpdateJob: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onAssignWorker: (jobId: string, workerId: string, rol: string) => Promise<void>;
  onRemoveWorker: (jobId: string, workerId: string) => Promise<void>;
  onOpenParte?: (job: TradeJob) => void;
  onCreatePresupuesto?: (job: TradeJob) => void;
  /** Abre la pantalla de Ruta del Día para la fecha seleccionada. */
  onViewRoute?: (fecha: string) => void;
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
  geoStatus: GeoStatus;
  onGeolocate: () => void;
  onClose: () => void;
  onSave: () => void;
}

function JobModalPanel({ draft, setDraft, editingJob, clientes, workers, selectedWorkerIds, setSelectedWorkerIds, saving, geoStatus, onGeolocate, onClose, onSave }: JobModalPanelProps) {
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
          {/* Tipo: trabajo normal o visita de valoración */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, tipo: 'trabajo' }))}
              className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${(draft.tipo ?? 'trabajo') === 'trabajo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
            >
              🔧 Trabajo
            </button>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, tipo: 'visita' }))}
              className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${draft.tipo === 'visita' ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
            >
              👁 Visita / Ver
            </button>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Título *</label>
            <input value={draft.titulo ?? ''} onChange={e => setDraft(d => ({ ...d, titulo: e.target.value }))}
              placeholder={draft.tipo === 'visita' ? 'Ej: Ver fuga de agua en baño de Conchy' : 'Ej: Instalación calentador eléctrico'}
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

          {/* Badge de geolocalización */}
          {(draft.direccion || draft.localidad || draft.cp) && (
            <div className="flex items-center justify-between -mt-1">
              <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                geoStatus === 'loading'   ? 'text-blue-500' :
                geoStatus === 'ok'        ? 'text-emerald-600' :
                geoStatus === 'not_found' ? 'text-amber-600' :
                geoStatus === 'error'     ? 'text-red-600' :
                'text-slate-400'
              }`}>
                {geoStatus === 'loading'   && <><Loader2 className="w-3 h-3 animate-spin" /> Geolocalizando…</>}
                {geoStatus === 'ok'        && <><CheckCircle className="w-3 h-3" /> Geolocalizado</>}
                {geoStatus === 'not_found' && <><AlertTriangle className="w-3 h-3" /> Dirección no encontrada</>}
                {geoStatus === 'error'     && <><AlertTriangle className="w-3 h-3" /> Error al geolocalizar</>}
                {geoStatus === 'idle'      && <><MapPin className="w-3 h-3" /> Sin geolocalizar</>}
              </span>
              {geoStatus !== 'loading' && geoStatus !== 'ok' && (
                <button
                  type="button"
                  onClick={onGeolocate}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  {geoStatus === 'idle' ? 'Geolocalizar' : 'Reintentar'}
                </button>
              )}
            </div>
          )}

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

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + (m || 0) + Math.round(hours * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── JobCard ───────────────────────────────────────────────────────────────────
interface JobCardProps {
  job: TradeJob;
  onQuickStatus: (job: TradeJob, estado: TradeJob['estado']) => void;
  onEdit: (job: TradeJob) => void;
  onDelete: (job: TradeJob) => void;
  onOpenParte?: (job: TradeJob) => void;
  onCreatePresupuesto?: (job: TradeJob) => void;
  linkedPresupuesto?: LinkedPresupuesto;
}

function JobCard({ job, onQuickStatus, onEdit, onDelete, onOpenParte, onCreatePresupuesto, linkedPresupuesto }: JobCardProps) {
  const est = ESTADO_CFG[job.estado];
  const pri = PRIORIDAD_CFG[job.prioridad];
  const isVisita = job.tipo === 'visita';

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [job.direccion, job.localidad, job.cp].filter(Boolean).join(', '),
  )}`;
  const waUrl = job.trade_clients?.telefono
    ? `https://wa.me/${job.trade_clients.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${job.trade_clients.nombre ?? ''}, te confirmo tu cita: ${job.titulo}`)}`
    : null;
  const callUrl = job.trade_clients?.telefono
    ? `tel:${job.trade_clients.telefono.replace(/\s/g, '')}`
    : null;

  const timeLabel = job.hora_inicio
    ? `${job.hora_inicio}${job.duracion_horas ? ` — ${addHoursToTime(job.hora_inicio, job.duracion_horas)}` : ''}`
    : null;

  const accentColor =
    isVisita                            ? 'border-l-violet-400'  :
    job.estado === 'en_curso'           ? 'border-l-amber-400'   :
    job.estado === 'completado'         ? 'border-l-emerald-400' :
    job.estado === 'cancelado'          ? 'border-l-red-400'     :
    job.estado === 'pendiente_material' ? 'border-l-orange-400'  :
                                          'border-l-blue-400';

  const timeColor =
    job.estado === 'en_curso'  ? 'text-amber-600'   :
    job.estado === 'completado'? 'text-emerald-600'  : 'text-blue-600';

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${accentColor} rounded-2xl overflow-hidden shadow-sm ${job.estado === 'completado' ? 'opacity-60' : ''}`}>
      <div className="p-4 space-y-3">

        {/* Tiempo + estado + prioridad */}
        <div className="flex items-center justify-between gap-2">
          {timeLabel ? (
            <span className={`text-sm font-bold ${timeColor}`}>{timeLabel}</span>
          ) : isVisita ? (
            <span className="text-xs font-bold text-violet-500">Pendiente de programar</span>
          ) : (
            <span className="text-xs text-slate-400">Sin hora</span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {isVisita && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Visita</span>}
            {pri && <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>}
            {!isVisita && <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${est.cls}`}>{est.label}</span>}
          </div>
        </div>

        {/* Título */}
        <p className="text-base font-bold text-slate-900 leading-snug">{job.titulo}</p>

        {/* Datos */}
        <div className="space-y-1.5">
          {job.trade_clients?.nombre && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{job.trade_clients.nombre}</span>
            </div>
          )}
          {(job.direccion || job.localidad) && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{[job.direccion, job.localidad].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {(job.trade_job_workers?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{job.trade_job_workers!.map(jw => jw.trade_workers?.nombre ?? '—').join(', ')}</span>
            </div>
          )}
        </div>

        {/* Botones de acción rápida */}
        {!isVisita && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 transition-colors cursor-pointer">
                <span className="text-base">💬</span>
                <span className="text-[10px] font-semibold">WhatsApp</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30">
                <span className="text-base">💬</span>
                <span className="text-[10px] font-semibold text-slate-400">WhatsApp</span>
              </div>
            )}
            {callUrl ? (
              <a href={callUrl}
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 transition-colors cursor-pointer">
                <Phone className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Llamar</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400">Llamar</span>
              </div>
            )}
            {(job.direccion || job.localidad) ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 transition-colors cursor-pointer">
                <Navigation className="w-4 h-4" />
                <span className="text-[10px] font-semibold">GPS</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30">
                <Navigation className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400">GPS</span>
              </div>
            )}
          </div>
        )}
        {/* Visita: siempre mostrar WhatsApp, Llamar y GPS */}
        {isVisita && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 cursor-pointer text-xs font-semibold">
                <span className="text-base">💬</span>
                <span className="text-[10px]">WhatsApp</span>
              </a>
            ) : <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30"><span className="text-base">💬</span><span className="text-[10px] text-slate-400">WhatsApp</span></div>}
            {callUrl ? (
              <a href={callUrl}
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 cursor-pointer">
                <Phone className="w-4 h-4" />
                <span className="text-[10px] font-semibold">Llamar</span>
              </a>
            ) : <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30"><Phone className="w-4 h-4 text-slate-400" /><span className="text-[10px] text-slate-400">Llamar</span></div>}
            {(job.direccion || job.localidad) ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-slate-700 active:bg-slate-100 cursor-pointer">
                <Navigation className="w-4 h-4" />
                <span className="text-[10px] font-semibold">GPS</span>
              </a>
            ) : <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 opacity-30"><Navigation className="w-4 h-4 text-slate-400" /><span className="text-[10px] text-slate-400">GPS</span></div>}
          </div>
        )}

        {/* Presupuesto vinculado */}
        {linkedPresupuesto && (() => {
          const p = linkedPresupuesto;
          const isAceptado  = p.estado === 'Aceptado';
          const isFacturado = p.estado === 'Facturado';
          return (
            <div className={`rounded-xl px-3 py-2.5 border text-xs space-y-1 ${
              isAceptado  ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700' :
              isFacturado ? 'bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-slate-700' :
                            'bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-700'
            }`}>
              {isAceptado && (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  PRESUPUESTO ACEPTADO — {p.fecha} por el cliente
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate font-medium ${isAceptado ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {p.descripcion || 'Presupuesto vinculado'}
                </span>
                <span className={`font-mono font-bold shrink-0 ${isAceptado ? 'text-emerald-700 dark:text-emerald-400' : 'text-violet-700 dark:text-violet-400'}`}>
                  {(p.total * 1.21).toFixed(0)}€
                </span>
              </div>
              {!isAceptado && !isFacturado && (
                <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                  p.estado === 'Enviado'  ? 'bg-amber-50 text-amber-600 border-amber-300' :
                                            'bg-slate-100 text-slate-500 border-slate-300'
                }`}>{p.estado}</span>
              )}
              {isFacturado && (
                <span className="inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 border border-slate-300">Facturado</span>
              )}
            </div>
          );
        })()}

        {/* Estado rápido + editar/borrar */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          {/* VISITA planificada: Presupuesto + Parte + Iniciar */}
          {isVisita && job.estado === 'planificado' && (
            <>
              {onCreatePresupuesto && (
                <button onClick={() => onCreatePresupuesto(job)}
                  className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-violet-100 transition-colors">
                  <Receipt className="w-3.5 h-3.5" /> Presupuesto
                </button>
              )}
              {onOpenParte && (
                <button onClick={() => onOpenParte(job)}
                  className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-blue-100 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Parte
                </button>
              )}
              <button onClick={() => onQuickStatus(job, 'en_curso')}
                className="flex items-center gap-1.5 bg-violet-600 active:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors">
                <Play className="w-3.5 h-3.5" /> Iniciar
              </button>
            </>
          )}
          {/* VISITA en curso: Presupuesto + Parte + Completar */}
          {isVisita && job.estado === 'en_curso' && (
            <>
              {onCreatePresupuesto && !linkedPresupuesto && (
                <button onClick={() => onCreatePresupuesto(job)}
                  className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-violet-100 transition-colors">
                  <Receipt className="w-3.5 h-3.5" /> Presupuesto
                </button>
              )}
              {onOpenParte && (
                <button onClick={() => onOpenParte(job)}
                  className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-blue-100 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Parte
                </button>
              )}
              <button onClick={() => onQuickStatus(job, 'completado')}
                className="flex items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                <CheckCircle className="w-3.5 h-3.5" /> Completar
              </button>
            </>
          )}
          {/* TRABAJO normal */}
          {!isVisita && (
            <>
              {job.estado === 'planificado' && !linkedPresupuesto && (
                <button onClick={() => onQuickStatus(job, 'en_curso')}
                  className="flex items-center gap-1.5 bg-amber-500 active:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                  <Play className="w-3.5 h-3.5" /> Iniciar
                </button>
              )}
              {job.estado === 'planificado' && linkedPresupuesto?.estado === 'Aceptado' && (
                <button onClick={() => onQuickStatus(job, 'en_curso')}
                  className="flex items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors shadow-sm">
                  <Play className="w-3.5 h-3.5" /> Iniciar trabajo
                </button>
              )}
              {job.estado === 'en_curso' && (
                <button onClick={() => onQuickStatus(job, 'completado')}
                  className="flex items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Completar
                </button>
              )}
              {onCreatePresupuesto && job.estado !== 'cancelado' && job.estado !== 'completado' && !linkedPresupuesto && (
                <button onClick={() => onCreatePresupuesto(job)}
                  className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-violet-100 transition-colors">
                  <Receipt className="w-3.5 h-3.5" /> Presupuesto
                </button>
              )}
              {onCreatePresupuesto && job.estado !== 'cancelado' && job.estado !== 'completado' && linkedPresupuesto && (
                <button onClick={() => onCreatePresupuesto(job)}
                  className="flex items-center gap-1.5 bg-white border border-violet-200 text-violet-500 text-[10px] font-bold px-2.5 py-1.5 rounded-xl cursor-pointer active:bg-violet-50 transition-colors">
                  <Receipt className="w-3 h-3" /> Nuevo pres.
                </button>
              )}
              {onOpenParte && job.estado !== 'cancelado' && (
                <button onClick={() => onOpenParte(job)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    linkedPresupuesto?.estado === 'Aceptado'
                      ? 'bg-blue-600 text-white active:bg-blue-700 shadow-sm'
                      : 'bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100'
                  }`}>
                  <FileText className="w-3.5 h-3.5" /> Parte
                </button>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => onEdit(job)} className="p-2 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors rounded-xl hover:bg-blue-50">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(job)} className="p-2 text-slate-400 hover:text-red-500 cursor-pointer transition-colors rounded-xl hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScreenPlanificacion({
  jobs: propJobs, workers, clientes, isLiveMode,
  presupuestosAceptados = [],
  presupuestosPorId = {},
  onCreateJob, onUpdateJob, onDeleteJob, onAssignWorker, onRemoveWorker,
  onOpenParte, onCreatePresupuesto, onViewRoute, showToast,
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
  const [geoStatus, setGeoStatus]                 = useState<GeoStatus>('idle');

  // Sincroniza el estado geo con el job que se está editando
  useEffect(() => {
    if (!showModal) return;
    setGeoStatus(editingJob?.latitud != null ? 'ok' : 'idle');
  }, [showModal, editingJob]);

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
    // Excluir campos de relación JOIN — no son columnas reales de trade_jobs
    const { trade_clients: _tc, trade_job_workers: _tjw, ...draftFields } = job;
    setDraft(draftFields);
    setSelectedWorkerIds(new Set(job.trade_job_workers?.map(jw => jw.worker_id) ?? []));
    setShowModal(true);
  };

  const handleGeolocate = async () => {
    if (!draft.direccion && !draft.localidad && !draft.cp) return;
    setGeoStatus('loading');
    try {
      const geo = await geocodeAddress({ direccion: draft.direccion, localidad: draft.localidad, cp: draft.cp });
      if (geo) {
        setDraft(d => ({ ...d, latitud: geo.latitud, longitud: geo.longitud, direccion_normalizada: geo.formatted_address }));
        setGeoStatus('ok');
      } else {
        setGeoStatus('not_found');
      }
    } catch {
      setGeoStatus('error');
    }
  };

  const handleSave = async () => {
    if (!draft.titulo?.trim()) { showToast('El título es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      // Geocodificar si la dirección cambió o el trabajo aún no tiene coordenadas
      const needsGeocode =
        (draft.direccion || draft.localidad || draft.cp) &&
        (draft.latitud == null || addressChanged(draft, editingJob));

      let geoExtras: Partial<TradeJob> = {};
      if (needsGeocode && isLiveMode) {
        setGeoStatus('loading');
        const geo = await geocodeAddress({ direccion: draft.direccion, localidad: draft.localidad, cp: draft.cp });
        if (geo) {
          geoExtras = { latitud: geo.latitud, longitud: geo.longitud, direccion_normalizada: geo.formatted_address };
          setGeoStatus('ok');
        } else {
          setGeoStatus('not_found');
          // Si la dirección cambió, borrar coords obsoletas
          if (addressChanged(draft, editingJob)) geoExtras = { latitud: null, longitud: null, direccion_normalizada: null };
        }
      }

      const finalDraft = { ...draft, ...geoExtras };

      if (editingJob) {
        await onUpdateJob(editingJob.id, finalDraft);
        const prevIds  = new Set(editingJob.trade_job_workers?.map(jw => jw.worker_id) ?? []);
        const toAdd    = [...selectedWorkerIds].filter(id => !prevIds.has(id));
        const toRemove = [...prevIds].filter(id => !selectedWorkerIds.has(id));
        await Promise.all([
          ...toAdd.map(id => onAssignWorker(editingJob.id, id, 'asignado')),
          ...toRemove.map(id => onRemoveWorker(editingJob.id, id)),
        ]);
        showToast('Trabajo actualizado ✓', 'success');
      } else {
        const saved = await onCreateJob(finalDraft as Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>);
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
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 space-y-3" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px) + 8px)' }}>

        {/* Filtros de estado + botones acción */}
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
          {onViewRoute && dayJobs.length > 0 && (
            <button
              onClick={() => onViewRoute(selectedDate)}
              className="ml-auto shrink-0 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            >
              <Navigation className="w-3 h-3" /> Ver ruta
            </button>
          )}
          <button
            onClick={() => {
              setEditingJob(null);
              setDraft({ ...EMPTY_DRAFT(), fecha_inicio: selectedDate, prioridad: 'urgente', titulo: '' });
              setSelectedWorkerIds(new Set());
              setShowModal(true);
            }}
            className={`${!onViewRoute || dayJobs.length === 0 ? 'ml-auto' : ''} shrink-0 flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold uppercase px-2.5 py-1 rounded-full cursor-pointer transition-colors`}
          >
            <Zap className="w-3 h-3" /> Urgente
          </button>
          <button
            onClick={openCreate}
            className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase px-2.5 py-1 rounded-full cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" /> Nuevo
          </button>
        </div>

        {/* Visitas pendientes (todas las fechas excepto el día seleccionado, que ya aparece abajo) */}
        {(() => {
          const dayJobIds = new Set(dayJobs.map(j => j.id));
          const visitasPendientes = jobs.filter(j =>
            j.tipo === 'visita' &&
            j.estado !== 'completado' &&
            j.estado !== 'cancelado' &&
            !dayJobIds.has(j.id),
          );
          if (visitasPendientes.length === 0) return null;
          return (
            <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" />
                {visitasPendientes.length} visita{visitasPendientes.length !== 1 ? 's' : ''} pendiente{visitasPendientes.length !== 1 ? 's' : ''} de valoración
              </p>
              <div className="space-y-2">
                {visitasPendientes.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onQuickStatus={handleQuickStatus}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onOpenParte={onOpenParte}
                    onCreatePresupuesto={onCreatePresupuesto}
                    linkedPresupuesto={job.quote_id ? presupuestosPorId[job.quote_id] : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Pipeline: presupuestos aceptados sin trabajo asignado */}
        {presupuestosAceptados.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              {presupuestosAceptados.length} presupuesto{presupuestosAceptados.length !== 1 ? 's' : ''} aceptado{presupuestosAceptados.length !== 1 ? 's' : ''} — pendiente de programar
            </p>
            <div className="space-y-1.5">
              {presupuestosAceptados.map(p => (
                <div
                  key={p.id}
                  className="bg-white border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-400 transition-colors"
                  onClick={() => {
                    setEditingJob(null);
                    setDraft({
                      ...EMPTY_DRAFT(),
                      fecha_inicio: selectedDate,
                      titulo: p.descripcion.slice(0, 80) || `Trabajo — ${p.nombreCliente}`,
                      client_id: p.client_id ?? null,
                      prioridad: 'normal',
                    });
                    setSelectedWorkerIds(new Set());
                    setShowModal(true);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-800 truncate">{p.nombreCliente}</p>
                    <p className="text-[9px] text-slate-500 truncate">{p.descripcion}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-700">{p.total.toFixed(0)}€</span>
                    <span className="text-[8px] font-bold uppercase text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">+ Programar</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                onOpenParte={onOpenParte}
                onCreatePresupuesto={onCreatePresupuesto}
                linkedPresupuesto={job.quote_id ? presupuestosPorId[job.quote_id] : undefined}
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
          geoStatus={geoStatus}
          onGeolocate={() => { void handleGeolocate(); }}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
