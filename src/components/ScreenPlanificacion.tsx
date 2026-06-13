import { useState, useEffect, useRef } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, MapPin, User, Users,
  CheckCircle, Play, Trash2, Edit3, Navigation, CalendarDays,
  AlertTriangle, X, Check, Zap, FileText, Phone, Receipt,
  Loader2, PauseCircle, Package, Clock, Ban, ChevronDown,
} from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import { loadWorkCalendar, getNextWorkingDay } from '../lib/workCalendar';
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
  /** Incrementar para abrir el modal de creación desde fuera. */
  triggerNew?: number;
}

const ESTADO_CFG: Record<TradeJob['estado'], { label: string; cls: string; dot: string }> = {
  planificado:               { label: 'Planificado',      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     dot: 'bg-blue-500' },
  en_curso:                  { label: 'En curso',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  completado:                { label: 'Completado',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelado:                 { label: 'Cancelado',        cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',         dot: 'bg-red-500' },
  pendiente_material:        { label: 'Pdte. material',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-500' },
  no_realizado:              { label: 'No realizado',     cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',    dot: 'bg-slate-400' },
  pausado_continua:          { label: 'Pausado',          cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', dot: 'bg-violet-500' },
  bloqueado_espera_material: { label: 'Espera material',  cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',     dot: 'bg-rose-500' },
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

// ── MaterialDisponibleButton ──────────────────────────────────────────────────
function MaterialDisponibleButton({ job, onConfirm }: { job: TradeJob; onConfirm: (job: TradeJob, fecha?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const handleConfirm = async () => {
    setSaving(true);
    try { await onConfirm(job, fecha || undefined); setOpen(false); }
    finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl cursor-pointer transition-colors">
        <Check className="w-3.5 h-3.5" /> Material disponible
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
      <span className="text-[10px] font-bold text-emerald-700">Fecha llegada (opcional):</span>
      <input type="date" value={fecha} min={today} onChange={e => setFecha(e.target.value)}
        className="text-xs border border-emerald-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-400 bg-white" />
      <button onClick={handleConfirm} disabled={saving}
        className="flex items-center gap-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Reprogramar
      </button>
      <button onClick={() => setOpen(false)} className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700">Cancelar</button>
    </div>
  );
}

// ── PreviousPendingModal ──────────────────────────────────────────────────────
type PrevResolutionAction = 'completado' | 'no_realizado' | 'reprogramar' | null;
interface PrevResolution { action: PrevResolutionAction; notas: string; fechaReprog: string; }
interface PreviousPendingModalProps {
  pendingJobs: TradeJob[];
  targetJob: TradeJob;
  onResolveAll: (resolutions: Record<string, PrevResolution>) => Promise<void>;
  onClose: () => void;
}

function PreviousPendingModal({ pendingJobs, targetJob, onResolveAll, onClose }: PreviousPendingModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const initResolutions = () => {
    const r: Record<string, PrevResolution> = {};
    pendingJobs.forEach(j => { r[j.id] = { action: null, notas: '', fechaReprog: today }; });
    return r;
  };
  const [resolutions, setResolutions] = useState<Record<string, PrevResolution>>(initResolutions);
  const [saving, setSaving] = useState(false);

  const setResolution = (id: string, patch: Partial<PrevResolution>) =>
    setResolutions(r => ({ ...r, [id]: { ...r[id], ...patch } }));

  const allResolved = pendingJobs.every(j => resolutions[j.id]?.action !== null);

  const handleConfirm = async () => {
    setSaving(true);
    try { await onResolveAll(resolutions); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-base">Visitas anteriores sin cerrar</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Antes de iniciar <strong>"{targetJob.titulo}"</strong>, resuelve {pendingJobs.length === 1 ? 'esta visita' : 'estas visitas'} del mismo día:
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {pendingJobs.map(job => {
            const res = resolutions[job.id];
            const wasStarted = job.estado === 'en_curso';
            return (
              <div key={job.id} className={`border rounded-xl p-3.5 space-y-3 transition-colors ${res.action ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${wasStarted ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                    {wasStarted ? 'EN CURSO' : 'PLANIFICADO'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{job.titulo}</p>
                    <p className="text-[10px] text-slate-500">
                      {job.hora_inicio && `${job.hora_inicio} · `}{job.trade_clients?.nombre}
                    </p>
                  </div>
                  {res.action && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                </div>

                <p className="text-xs text-slate-600 font-medium">
                  {wasStarted ? '¿Terminaste este trabajo?' : '¿Realizaste esta visita?'}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setResolution(job.id, { action: 'completado' })}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${res.action === 'completado' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'}`}>
                    <Check className="w-3.5 h-3.5" /> Sí, completada
                  </button>
                  <button onClick={() => setResolution(job.id, { action: 'no_realizado' })}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${res.action === 'no_realizado' ? 'bg-slate-600 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}>
                    <Ban className="w-3.5 h-3.5" /> No realizada
                  </button>
                  <button onClick={() => setResolution(job.id, { action: 'reprogramar' })}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${res.action === 'reprogramar' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'}`}>
                    <CalendarDays className="w-3.5 h-3.5" /> Reprogramar
                  </button>
                </div>

                {res.action === 'reprogramar' && (
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-[10px] text-slate-500 font-semibold shrink-0">Nueva fecha:</label>
                    <input type="date" value={res.fechaReprog} min={today}
                      onChange={e => setResolution(job.id, { fechaReprog: e.target.value })}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                )}

                {(res.action === 'no_realizado' || res.action === 'completado') && (
                  <textarea
                    placeholder={res.action === 'no_realizado' ? 'Motivo (opcional): cliente ausente, canceló...' : 'Notas de cierre (opcional)'}
                    value={res.notas}
                    onChange={e => setResolution(job.id, { notas: e.target.value })}
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white resize-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allResolved || saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Resolver e Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PauseJobModal ─────────────────────────────────────────────────────────────
interface PauseJobModalProps {
  job: TradeJob;
  nextWorkDay: string;
  onPause: (reason: 'falta_tiempo' | 'falta_material', material?: string, fechaEstimada?: string) => Promise<void>;
  onMarkNoRealizado: (notas: string) => Promise<void>;
  onClose: () => void;
}

function PauseJobModal({ job, nextWorkDay, onPause, onMarkNoRealizado, onClose }: PauseJobModalProps) {
  const [reason, setReason] = useState<'falta_tiempo' | 'falta_material' | 'no_realizado' | null>(null);
  const [material, setMaterial] = useState('');
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      if (reason === 'no_realizado') {
        await onMarkNoRealizado(notas);
      } else if (reason === 'falta_material') {
        if (!material.trim()) return;
        await onPause('falta_material', material.trim(), fechaEstimada || undefined);
      } else {
        await onPause('falta_tiempo');
      }
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = reason !== null && (reason !== 'falta_material' || material.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
              <PauseCircle className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-base">Cerrar jornada / pausar trabajo</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">"{job.titulo}"</p>
            </div>
            <button onClick={onClose} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">¿Qué ha ocurrido?</p>

          {/* Opción: Falta de tiempo */}
          <button
            onClick={() => setReason('falta_tiempo')}
            className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left ${reason === 'falta_tiempo' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300'}`}
          >
            <Clock className={`w-5 h-5 shrink-0 mt-0.5 ${reason === 'falta_tiempo' ? 'text-violet-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-bold ${reason === 'falta_tiempo' ? 'text-violet-900' : 'text-slate-700'}`}>No me ha dado tiempo</p>
              <p className="text-[11px] text-slate-500 mt-0.5">El trabajo se retomará como primera tarea el {nextWorkDay}</p>
            </div>
            {reason === 'falta_tiempo' && <Check className="w-4 h-4 text-violet-600 ml-auto shrink-0 mt-0.5" />}
          </button>

          {/* Opción: Falta de material */}
          <button
            onClick={() => setReason('falta_material')}
            className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left ${reason === 'falta_material' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-rose-300'}`}
          >
            <Package className={`w-5 h-5 shrink-0 mt-0.5 ${reason === 'falta_material' ? 'text-rose-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-bold ${reason === 'falta_material' ? 'text-rose-900' : 'text-slate-700'}`}>Falta material / pieza</p>
              <p className="text-[11px] text-slate-500 mt-0.5">El trabajo queda bloqueado hasta que llegue el material</p>
            </div>
            {reason === 'falta_material' && <Check className="w-4 h-4 text-rose-600 ml-auto shrink-0 mt-0.5" />}
          </button>

          {/* Opción: No realizado */}
          <button
            onClick={() => setReason('no_realizado')}
            className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left ${reason === 'no_realizado' ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <Ban className={`w-5 h-5 shrink-0 mt-0.5 ${reason === 'no_realizado' ? 'text-slate-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-bold ${reason === 'no_realizado' ? 'text-slate-900' : 'text-slate-700'}`}>No realizado</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Cliente ausente, cancelado u otro motivo</p>
            </div>
            {reason === 'no_realizado' && <Check className="w-4 h-4 text-slate-600 ml-auto shrink-0 mt-0.5" />}
          </button>

          {/* Detalles de material */}
          {reason === 'falta_material' && (
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Descripción del material *</label>
              <textarea
                placeholder="Ej: Válvula de 3/4&quot; para caldera Roca 24kW"
                value={material}
                onChange={e => setMaterial(e.target.value)}
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-rose-400 bg-white resize-none"
              />
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fecha estimada de llegada <span className="font-normal normal-case">(opcional — si no se sabe, dejar vacío)</span></label>
              <input type="date" value={fechaEstimada} onChange={e => setFechaEstimada(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-400 bg-white" />
              {fechaEstimada ? (
                <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">
                  El trabajo se reprogramará automáticamente el día siguiente a la llegada del material.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                  Sin fecha estimada: el trabajo quedará en "Pendientes de material" hasta que confirmes su llegada manualmente.
                </p>
              )}
            </div>
          )}

          {/* Notas para no_realizado */}
          {reason === 'no_realizado' && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Motivo (opcional)</label>
              <textarea placeholder="Cliente ausente, canceló, acceso denegado..."
                value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-400 bg-white resize-none" />
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── JobCard ───────────────────────────────────────────────────────────────────
interface JobCardProps {
  job: TradeJob;
  onIniciar: (job: TradeJob) => void;
  onPause: (job: TradeJob) => void;
  onQuickStatus: (job: TradeJob, estado: TradeJob['estado']) => void;
  onEdit: (job: TradeJob) => void;
  onDelete: (job: TradeJob) => void;
  onOpenParte?: (job: TradeJob) => void;
  onCreatePresupuesto?: (job: TradeJob) => void;
  linkedPresupuesto?: LinkedPresupuesto;
}

function JobCard({ job, onIniciar, onPause, onQuickStatus, onEdit, onDelete, onOpenParte, onCreatePresupuesto, linkedPresupuesto }: JobCardProps) {
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
          {/* Badges especiales para estados nuevos */}
          {job.estado === 'pausado_continua' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 bg-violet-100 text-violet-700 rounded-xl">
              <PauseCircle className="w-3.5 h-3.5" /> Retoma mañana
            </span>
          )}
          {job.estado === 'bloqueado_espera_material' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 bg-rose-100 text-rose-700 rounded-xl">
              <Package className="w-3.5 h-3.5" /> {job.material_pendiente ? job.material_pendiente.slice(0, 28) : 'Material pendiente'}
            </span>
          )}
          {job.estado === 'no_realizado' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 bg-slate-100 text-slate-500 rounded-xl">
              <Ban className="w-3.5 h-3.5" /> No realizado
            </span>
          )}

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
              <button onClick={() => onIniciar(job)}
                className="flex items-center gap-1.5 bg-violet-600 active:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors">
                <Play className="w-3.5 h-3.5" /> Iniciar
              </button>
            </>
          )}
          {/* VISITA en curso: Presupuesto + Parte + Completar + Pausar */}
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
              <button onClick={() => onPause(job)}
                className="flex items-center gap-1.5 bg-violet-100 border border-violet-300 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-violet-200 transition-colors">
                <PauseCircle className="w-3.5 h-3.5" /> Pausar
              </button>
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
                <button onClick={() => onIniciar(job)}
                  className="flex items-center gap-1.5 bg-amber-500 active:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                  <Play className="w-3.5 h-3.5" /> Iniciar
                </button>
              )}
              {job.estado === 'planificado' && linkedPresupuesto?.estado === 'Aceptado' && (
                <button onClick={() => onIniciar(job)}
                  className="flex items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors shadow-sm">
                  <Play className="w-3.5 h-3.5" /> Iniciar trabajo
                </button>
              )}
              {job.estado === 'en_curso' && (
                <>
                  <button onClick={() => onPause(job)}
                    className="flex items-center gap-1.5 bg-violet-100 border border-violet-300 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer active:bg-violet-200 transition-colors">
                    <PauseCircle className="w-3.5 h-3.5" /> Pausar
                  </button>
                  <button onClick={() => onOpenParte ? onOpenParte(job) : onQuickStatus(job, 'completado')}
                    className="flex items-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Completar
                  </button>
                </>
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
  onOpenParte, onCreatePresupuesto, onViewRoute, showToast, triggerNew,
}: ScreenPlanificacionProps) {
  const jobs  = isLiveMode ? propJobs : DEMO_JOBS;
  const today = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate]           = useState(today);
  const [weekOffset, setWeekOffset]               = useState(0);
  const [filterEstado, setFilterEstado]           = useState<'todos' | TradeJob['estado'] | 'materiales_pendientes'>('todos');
  const [showModal, setShowModal]                 = useState(false);
  const [editingJob, setEditingJob]               = useState<TradeJob | null>(null);
  const [draft, setDraft]                         = useState<Partial<TradeJob>>(EMPTY_DRAFT());
  const [saving, setSaving]                       = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [geoStatus, setGeoStatus]                 = useState<GeoStatus>('idle');
  const autoRescheduledRef                        = useRef(false);

  // Modal: visitas anteriores sin resolver
  const [pendingPrevJobs, setPendingPrevJobs]   = useState<TradeJob[]>([]);
  const [targetInitJob, setTargetInitJob]       = useState<TradeJob | null>(null);
  // Modal: pausar trabajo
  const [pausingJob, setPausingJob]             = useState<TradeJob | null>(null);

  // Sincroniza el estado geo con el job que se está editando
  useEffect(() => {
    if (!showModal) return;
    setGeoStatus(editingJob?.latitud != null ? 'ok' : 'idle');
  }, [showModal, editingJob]);

  // Auto-reprogramar trabajos atrasados al cargar — al siguiente día laborable
  useEffect(() => {
    if (!isLiveMode || autoRescheduledRef.current || propJobs.length === 0) return;
    autoRescheduledRef.current = true;

    const calendar = loadWorkCalendar();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const nextWorkDay = getNextWorkingDay(yesterday, calendar);

    // 1) Jobs genéricos atrasados (planificado/en_curso)
    const overdue = propJobs.filter(j =>
      j.fecha_inicio != null && j.fecha_inicio < today &&
      (j.estado === 'planificado' || j.estado === 'en_curso'),
    );

    // 2) Jobs en pausa (falta de tiempo) de días anteriores → primera tarea
    const pausados = propJobs.filter(j =>
      j.estado === 'pausado_continua' && j.fecha_inicio != null && j.fecha_inicio < today,
    );

    // 3) Jobs bloqueados por material cuya fecha estimada ya llegó → primera tarea
    const materialLlegado = propJobs.filter(j =>
      j.estado === 'bloqueado_espera_material' &&
      j.fecha_estimada_material != null &&
      j.fecha_estimada_material <= today,
    );

    const toReschedule = [
      ...overdue.map(j => ({ id: j.id, updates: { fecha_inicio: nextWorkDay } })),
      ...pausados.map(j => ({ id: j.id, updates: { fecha_inicio: nextWorkDay, estado: 'planificado' as const, priority_insert: true, pause_reason: null } })),
      ...materialLlegado.map(j => ({ id: j.id, updates: { fecha_inicio: getNextWorkingDay(today, calendar), estado: 'planificado' as const, priority_insert: true, fecha_estimada_material: null, pause_reason: null } })),
    ];

    if (toReschedule.length === 0) return;

    void Promise.all(toReschedule.map(({ id, updates }) => onUpdateJob(id, updates)))
      .then(() => {
        const n = toReschedule.length;
        const pausMsg = pausados.length > 0 ? ` (${pausados.length} pausado${pausados.length !== 1 ? 's' : ''} como 1ª tarea)` : '';
        showToast(`${n} trabajo${n !== 1 ? 's' : ''} reprogramado${n !== 1 ? 's' : ''} para el ${nextWorkDay}${pausMsg}`, 'info');
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveMode, propJobs]);

  const dayJobs = jobs
    .filter(j => j.fecha_inicio === selectedDate)
    .sort((a, b) => {
      if (a.priority_insert && !b.priority_insert) return -1;
      if (!a.priority_insert && b.priority_insert) return 1;
      return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
    });

  const materialesPendientes = jobs.filter(j => j.estado === 'bloqueado_espera_material');

  const FILTER_STATES: Array<'todos' | TradeJob['estado']> = [
    'todos', 'planificado', 'en_curso', 'pausado_continua', 'bloqueado_espera_material', 'pendiente_material', 'no_realizado', 'completado', 'cancelado',
  ];

  const filtered = filterEstado === 'todos'
    ? dayJobs
    : filterEstado === 'materiales_pendientes'
      ? []
      : dayJobs.filter(j => j.estado === filterEstado);

  const openCreate = () => {
    setEditingJob(null);
    setDraft({ ...EMPTY_DRAFT(), fecha_inicio: selectedDate });
    setSelectedWorkerIds(new Set());
    setShowModal(true);
  };

  const triggerNewRef = useRef(0);
  useEffect(() => {
    if (!triggerNew || triggerNew === triggerNewRef.current) return;
    triggerNewRef.current = triggerNew;
    openCreate();
  // openCreate reads state via closures; triggerNew is the only external dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerNew]);

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

  // Intercepta el botón "Iniciar": comprueba si hay visitas/trabajos anteriores sin cerrar
  const handleIniciar = (job: TradeJob) => {
    if (!isLiveMode) { showToast('Activa el modo real para cambiar estados', 'info'); return; }
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const pending = jobs.filter(j =>
      j.id !== job.id &&
      j.fecha_inicio === job.fecha_inicio &&
      (j.estado === 'planificado' || j.estado === 'en_curso') &&
      (j.hora_inicio ?? '00:00') < (job.hora_inicio ?? currentTime),
    );
    if (pending.length > 0) {
      setPendingPrevJobs(pending);
      setTargetInitJob(job);
    } else {
      void handleQuickStatus(job, 'en_curso').then(() =>
        onUpdateJob(job.id, { started_at: new Date().toISOString() }).catch(() => {})
      );
    }
  };

  // Resuelve las visitas anteriores y luego inicia el trabajo objetivo
  const handleResolvePrevAndStart = async (resolutions: Record<string, PrevResolution>) => {
    const calendar = loadWorkCalendar();
    const nextWorkDay = getNextWorkingDay(today, calendar);
    await Promise.all(Object.entries(resolutions).map(([id, res]) => {
      if (res.action === 'completado') {
        return onUpdateJob(id, { estado: 'completado', completado_at: new Date().toISOString(), notas_cierre: res.notas || undefined });
      } else if (res.action === 'no_realizado') {
        return onUpdateJob(id, { estado: 'no_realizado', notas_cierre: res.notas || undefined });
      } else {
        return onUpdateJob(id, { fecha_inicio: res.fechaReprog || nextWorkDay });
      }
    }));
    setPendingPrevJobs([]);
    if (targetInitJob) {
      const job = targetInitJob;
      setTargetInitJob(null);
      await handleQuickStatus(job, 'en_curso');
      await onUpdateJob(job.id, { started_at: new Date().toISOString() }).catch(() => {});
    }
  };

  // Pausa un trabajo en curso
  const handlePauseJob = async (reason: 'falta_tiempo' | 'falta_material', material?: string, fechaEstimada?: string) => {
    if (!pausingJob) return;
    const job = pausingJob;
    setPausingJob(null);
    const calendar = loadWorkCalendar();
    const nextWorkDay = getNextWorkingDay(today, calendar);
    try {
      if (reason === 'falta_tiempo') {
        await onUpdateJob(job.id, {
          estado: 'pausado_continua',
          pause_reason: 'falta_tiempo',
          fecha_inicio: nextWorkDay,
          priority_insert: true,
        });
        showToast(`Pausado — retomará el ${nextWorkDay} como primera tarea ✓`, 'info');
      } else {
        await onUpdateJob(job.id, {
          estado: 'bloqueado_espera_material',
          pause_reason: 'falta_material',
          material_pendiente: material ?? null,
          fecha_estimada_material: fechaEstimada ?? null,
        });
        if (fechaEstimada) {
          showToast(`Bloqueado — se reprogramará el día siguiente al ${fechaEstimada} ✓`, 'info');
        } else {
          showToast('Bloqueado — aparece en "Materiales pendientes" ✓', 'info');
        }
      }
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const handleMarkNoRealizado = async (notas: string) => {
    if (!pausingJob) return;
    const job = pausingJob;
    setPausingJob(null);
    try {
      await onUpdateJob(job.id, { estado: 'no_realizado', notas_cierre: notas || undefined });
      showToast('Marcado como no realizado ✓', 'info');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  // Reactiva un job bloqueado por material
  const handleMaterialDisponible = async (job: TradeJob, fechaEnt?: string) => {
    if (!isLiveMode) return;
    const calendar = loadWorkCalendar();
    const base = fechaEnt ?? today;
    const nextWorkDay = getNextWorkingDay(base, calendar);
    try {
      await onUpdateJob(job.id, {
        estado: 'planificado',
        fecha_inicio: nextWorkDay,
        priority_insert: true,
        pause_reason: null,
        material_pendiente: null,
        fecha_estimada_material: null,
      });
      showToast(`Reprogramado para el ${nextWorkDay} como primera tarea ✓`, 'success');
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
          {/* Botón especial: Materiales pendientes (cross-date) */}
          {materialesPendientes.length > 0 && (
            <button
              onClick={() => setFilterEstado(prev => prev === 'materiales_pendientes' ? 'todos' : 'materiales_pendientes')}
              className={`shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                filterEstado === 'materiales_pendientes'
                  ? 'bg-rose-700 text-white border-transparent'
                  : 'border-rose-300 text-rose-600 bg-rose-50 hover:border-rose-500'
              }`}
            >
              <Package className="w-3 h-3" /> Materiales <span className="opacity-60">{materialesPendientes.length}</span>
            </button>
          )}
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

        {/* ── Panel de carga del equipo (Dispatch Board) ───────────────────────── */}
        {workers.filter(w => w.activo).length > 0 && dayJobs.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Carga del equipo — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <div className="space-y-1.5">
              {workers.filter(w => w.activo).map(w => {
                const workerJobs = dayJobs.filter(j =>
                  j.trade_job_workers?.some(jw => jw.worker_id === w.id) &&
                  j.estado !== 'cancelado'
                );
                const maxJobs = 6;
                const pct = Math.min((workerJobs.length / maxJobs) * 100, 100);
                const barColor = pct >= 85 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <div key={w.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[9px] shrink-0">
                      {w.nombre.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold text-slate-700 truncate">{w.nombre}</span>
                        <span className={`text-[9px] font-bold ml-2 shrink-0 ${workerJobs.length >= maxJobs ? 'text-red-500' : 'text-slate-400'}`}>
                          {workerJobs.length}/{maxJobs}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {(() => {
                const unassigned = dayJobs.filter(j =>
                  j.estado !== 'cancelado' && (!j.trade_job_workers || j.trade_job_workers.length === 0)
                );
                if (!unassigned.length) return null;
                return (
                  <div className="pt-1 border-t border-slate-100 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      </div>
                      <span className="text-[10px] text-amber-600 font-semibold">{unassigned.length} trabajo{unassigned.length !== 1 ? 's' : ''} sin asignar</span>
                    </div>
                    {unassigned.map(j => (
                      <div key={j.id} className="ml-8 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-slate-500 truncate">{j.titulo}</span>
                        <button
                          onClick={() => openEdit(j)}
                          className="shrink-0 text-[8px] font-bold uppercase text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                        >
                          Asignar →
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

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
                    onIniciar={handleIniciar}
                    onPause={setPausingJob}
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

        {/* Sección: Materiales pendientes (cross-date) */}
        {filterEstado === 'materiales_pendientes' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900">Materiales pendientes</h3>
              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">{materialesPendientes.length}</span>
            </div>
            {materialesPendientes.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">No hay trabajos bloqueados por material.</p>
            ) : materialesPendientes.map(job => (
              <div key={job.id} className="bg-white border border-rose-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{job.titulo}</p>
                    <p className="text-[10px] text-slate-500">
                      {job.trade_clients?.nombre}
                      {job.fecha_inicio && ` · ${new Date(job.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                </div>
                <div className="bg-rose-50 rounded-xl px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Material que falta</p>
                  <p className="text-xs text-slate-800">{job.material_pendiente ?? '—'}</p>
                  {job.fecha_estimada_material ? (
                    <p className="text-[10px] text-rose-700">Estimado: {new Date(job.fecha_estimada_material + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Sin fecha estimada</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <MaterialDisponibleButton job={job} onConfirm={handleMaterialDisponible} />
                  <button onClick={() => openEdit(job)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-xl cursor-pointer transition-colors">
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Jobs del día */}
        {filterEstado !== 'materiales_pendientes' && (filtered.length === 0 ? (
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
          filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onIniciar={handleIniciar}
              onPause={setPausingJob}
              onQuickStatus={handleQuickStatus}
              onEdit={openEdit}
              onDelete={handleDelete}
              onOpenParte={onOpenParte}
              onCreatePresupuesto={onCreatePresupuesto}
              linkedPresupuesto={job.quote_id ? presupuestosPorId[job.quote_id] : undefined}
            />
          ))
        ))}
      </div>

      {/* Modales: visitas anteriores + pausa + create/edit */}
      {pendingPrevJobs.length > 0 && targetInitJob && (
        <PreviousPendingModal
          pendingJobs={pendingPrevJobs}
          targetJob={targetInitJob}
          onResolveAll={handleResolvePrevAndStart}
          onClose={() => { setPendingPrevJobs([]); setTargetInitJob(null); }}
        />
      )}
      {pausingJob && (() => {
        const calendar = loadWorkCalendar();
        const nextWorkDay = getNextWorkingDay(today, calendar);
        return (
          <PauseJobModal
            job={pausingJob}
            nextWorkDay={nextWorkDay}
            onPause={handlePauseJob}
            onMarkNoRealizado={handleMarkNoRealizado}
            onClose={() => setPausingJob(null)}
          />
        );
      })()}

      {/* Modal crear/editar */}
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
