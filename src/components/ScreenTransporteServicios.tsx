import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Calendar, MapPin, Users, ChevronDown, X, Edit2,
  AlertTriangle, CheckCircle, Clock, Truck, UserCheck,
  Euro, FileText, PlusCircle, Trash2, ArrowRight, Loader2,
} from 'lucide-react';
import {
  TIPO_SERVICIO_OPTIONS,
  SERVICIO_ESTADOS,
  TIPO_SERVICIO_COLORS,
  validateStops,
  createTransportService,
  updateTransportService,
  cancelTransportService,
  confirmTransportService,
  updateTransportEstado,
  loadTransportServices,
  checkAvailability,
} from '../lib/transportServices';
import type {
  TradeTransportService,
  TradeTransportServiceInput,
  TransportStop,
  ConflictInfo,
  TipoServicio,
  ServicioEstado,
} from '../lib/transportServices';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { useSession } from '../context/SessionContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDT(iso: string): string {
  // "2026-10-23T10:30:00+02:00" → "2026-10-23T10:30" para datetime-local
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDT(local: string): string {
  // "2026-10-23T10:30" → ISO string en zona local del navegador
  if (!local) return '';
  return new Date(local).toISOString();
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

// ── Sub-componentes de módulo ─────────────────────────────────────────────────

interface EstadoBadgeProps { estado: ServicioEstado }
function EstadoBadge({ estado }: EstadoBadgeProps) {
  const cfg = SERVICIO_ESTADOS.find(e => e.value === estado);
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

interface TipoBadgeProps { tipo: TipoServicio }
function TipoBadge({ tipo }: TipoBadgeProps) {
  const label = TIPO_SERVICIO_OPTIONS.find(t => t.value === tipo)?.label ?? tipo;
  const color = TIPO_SERVICIO_COLORS[tipo] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${color}`}>
      {label}
    </span>
  );
}

interface ConflictAlertProps { conflicts: ConflictInfo[] }
function ConflictAlert({ conflicts }: ConflictAlertProps) {
  if (!conflicts.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-amber-800 mb-1">Conflicto de disponibilidad</p>
        {conflicts.map((c, i) => (
          <p key={i} className="text-xs text-amber-700">
            {c.tipo === 'conflicto_concurrente'
              ? c.titulo
              : `${c.tipo === 'vehiculo' ? 'Vehículo' : 'Conductor'} ya asignado en "${c.titulo}" (${fmtDateTime(c.fecha_inicio ?? '')})`}
          </p>
        ))}
      </div>
    </div>
  );
}

interface StopRowProps {
  stop: TransportStop;
  index: number;
  onChange: (i: number, s: TransportStop) => void;
  onRemove: (i: number) => void;
}
function StopRow({ stop, index, onChange, onRemove }: StopRowProps) {
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Nombre de la parada *"
          value={stop.nombre}
          onChange={e => onChange(index, { ...stop, nombre: e.target.value })}
          className="col-span-1 px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Hora (HH:MM)"
          value={stop.hora ?? ''}
          onChange={e => onChange(index, { ...stop, hora: e.target.value || undefined })}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          maxLength={5}
        />
        <input
          type="text"
          placeholder="Dirección (opcional)"
          value={stop.direccion ?? ''}
          onChange={e => onChange(index, { ...stop, direccion: e.target.value || undefined })}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ServicioModalProps {
  servicio: TradeTransportService | null;
  orgId: string;
  clients: TradeClient[];
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  onClose: () => void;
  onSaved: (s: TradeTransportService) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyForm(): TradeTransportServiceInput {
  return {
    titulo: '',
    tipo_servicio: 'excursion',
    estado: 'borrador',
    fecha_inicio: '',
    fecha_fin: null,
    origen: '',
    destino: '',
    paradas: [],
    num_viajeros: null,
    client_id: null,
    vehicle_id: null,
    conductor_id: null,
    precio_acordado: null,
    observaciones: '',
    quote_id: null,
  };
}

function ServicioModal({
  servicio, orgId, clients, vehicles, workers,
  onClose, onSaved, showToast,
}: ServicioModalProps) {
  const [form, setForm] = useState<TradeTransportServiceInput>(() =>
    servicio
      ? {
          titulo:          servicio.titulo,
          tipo_servicio:   servicio.tipo_servicio,
          estado:          servicio.estado,
          fecha_inicio:    servicio.fecha_inicio,
          fecha_fin:       servicio.fecha_fin ?? null,
          origen:          servicio.origen ?? '',
          destino:         servicio.destino ?? '',
          paradas:         servicio.paradas ?? [],
          num_viajeros:    servicio.num_viajeros ?? null,
          client_id:       servicio.client_id ?? null,
          vehicle_id:      servicio.vehicle_id ?? null,
          conductor_id:    servicio.conductor_id ?? null,
          precio_acordado: servicio.precio_acordado ?? null,
          observaciones:   servicio.observaciones ?? '',
          quote_id:        servicio.quote_id ?? null,
        }
      : emptyForm()
  );

  const [saving, setSaving]           = useState(false);
  const [stopError, setStopError]     = useState('');
  const [conflicts, setConflicts]     = useState<ConflictInfo[]>([]);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const availDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtros de vehículos aptos (viajeros o mixto, activos)
  const aptVehicles = vehicles.filter(v => v.activo && (v.modalidad === 'viajeros' || v.modalidad === 'mixto'));
  // Conductores habilitados y activos
  const aptWorkers  = workers.filter(w => w.es_conductor && w.activo !== false);

  const runAvailCheck = useCallback(() => {
    if (!form.fecha_inicio) return;
    if (!form.vehicle_id && !form.conductor_id) { setConflicts([]); return; }

    setCheckingAvail(true);
    checkAvailability(orgId, {
      vehicleId:   form.vehicle_id ?? undefined,
      conductorId: form.conductor_id ?? undefined,
      fechaInicio: form.fecha_inicio,
      fechaFin:    form.fecha_fin ?? undefined,
      excludeId:   servicio?.id,
    }).then(c => {
      setConflicts(c);
      setCheckingAvail(false);
    }).catch(() => setCheckingAvail(false));
  }, [orgId, form.vehicle_id, form.conductor_id, form.fecha_inicio, form.fecha_fin, servicio?.id]);

  useEffect(() => {
    if (availDebounce.current) clearTimeout(availDebounce.current);
    availDebounce.current = setTimeout(runAvailCheck, 500);
    return () => { if (availDebounce.current) clearTimeout(availDebounce.current); };
  }, [runAvailCheck]);

  const set = (k: keyof TradeTransportServiceInput, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  const addStop = () => setForm(f => ({ ...f, paradas: [...f.paradas, { nombre: '' }] }));
  const updateStop = (i: number, s: TransportStop) =>
    setForm(f => { const p = [...f.paradas]; p[i] = s; return { ...f, paradas: p }; });
  const removeStop = (i: number) =>
    setForm(f => ({ ...f, paradas: f.paradas.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStopError('');
    try { validateStops(form.paradas); }
    catch (err) { setStopError(errMsg(err)); return; }

    setSaving(true);
    try {
      const payload: TradeTransportServiceInput = {
        ...form,
        fecha_inicio: form.fecha_inicio ? fromLocalDT(form.fecha_inicio) : '',
        fecha_fin:    form.fecha_fin    ? fromLocalDT(form.fecha_fin)    : null,
        origen:       form.origen       || null,
        destino:      form.destino      || null,
        observaciones: form.observaciones || null,
      };

      let saved: TradeTransportService;
      if (servicio) {
        saved = await updateTransportService(servicio.id, orgId, payload);
        showToast('Servicio actualizado', 'success');
      } else {
        saved = await createTransportService(orgId, payload);
        showToast('Servicio creado', 'success');
      }
      onSaved(saved);
    } catch (err) {
      showToast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            {servicio ? 'Editar servicio' : 'Nuevo servicio de transporte'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {/* Fila 1: Título + Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Título *</label>
                <input
                  type="text" required
                  value={form.titulo}
                  onChange={e => set('titulo', e.target.value)}
                  placeholder="Ej. Excursión Picos de Europa"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Tipo de servicio</label>
                <select value={form.tipo_servicio} onChange={e => set('tipo_servicio', e.target.value)} className={inputCls}>
                  {/* Legacy option: visible solo al editar un servicio con valor no reconocido en el catálogo activo */}
                  {!TIPO_SERVICIO_OPTIONS.find(t => t.value === (form.tipo_servicio as string)) && (
                    <option value={form.tipo_servicio as string}>
                      {(form.tipo_servicio as string) === 'traslado_empresa' ? 'Traslado empresa (heredado)' : (form.tipo_servicio as string)}
                    </option>
                  )}
                  {TIPO_SERVICIO_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fila 2: Cliente */}
            <div>
              <label className={labelCls}>Cliente (opcional)</label>
              <select value={form.client_id ?? ''} onChange={e => set('client_id', e.target.value || null)} className={inputCls}>
                <option value="">Sin cliente asignado</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{getClientDisplayName(c)}</option>
                ))}
              </select>
            </div>

            {/* Fila 3: Origen → Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Origen</label>
                <input
                  type="text"
                  value={form.origen ?? ''}
                  onChange={e => set('origen', e.target.value)}
                  placeholder="Ciudad o punto de salida"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Destino</label>
                <input
                  type="text"
                  value={form.destino ?? ''}
                  onChange={e => set('destino', e.target.value)}
                  placeholder="Ciudad o punto de llegada"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Paradas intermedias */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls + ' mb-0'}>Paradas intermedias</label>
                <button type="button" onClick={addStop}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                  <PlusCircle className="w-3.5 h-3.5" /> Añadir parada
                </button>
              </div>
              {form.paradas.length === 0 && (
                <p className="text-xs text-slate-400 italic">Sin paradas intermedias</p>
              )}
              <div className="space-y-2">
                {form.paradas.map((s, i) => (
                  <StopRow key={i} stop={s} index={i} onChange={updateStop} onRemove={removeStop} />
                ))}
              </div>
              {stopError && <p className="text-xs text-red-600 mt-1">{stopError}</p>}
            </div>

            {/* Fechas y Viajeros */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Salida *</label>
                <input
                  type="datetime-local" required
                  value={toLocalDT(form.fecha_inicio)}
                  onChange={e => set('fecha_inicio', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Llegada prevista</label>
                <input
                  type="datetime-local"
                  value={toLocalDT(form.fecha_fin ?? '')}
                  onChange={e => set('fecha_fin', e.target.value || null)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nº viajeros</label>
                <input
                  type="number" min="1"
                  value={form.num_viajeros ?? ''}
                  onChange={e => set('num_viajeros', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="—"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Vehículo + Conductor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Vehículo (aptos para viajeros)</label>
                <select value={form.vehicle_id ?? ''} onChange={e => set('vehicle_id', e.target.value || null)} className={inputCls}>
                  <option value="">Sin vehículo asignado</option>
                  {aptVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} — {v.matricula}
                      {v.capacidad_viajeros ? ` (${v.capacidad_viajeros} plazas)` : ''}
                    </option>
                  ))}
                </select>
                {vehicles.length > 0 && aptVehicles.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No hay vehículos activos con modalidad viajeros/mixto</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Conductor</label>
                <select value={form.conductor_id ?? ''} onChange={e => set('conductor_id', e.target.value || null)} className={inputCls}>
                  <option value="">Sin conductor asignado</option>
                  {aptWorkers.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre}</option>
                  ))}
                </select>
                {workers.length > 0 && aptWorkers.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No hay conductores habilitados en esta organización</p>
                )}
              </div>
            </div>

            {/* Conflictos */}
            {checkingAvail && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando disponibilidad...
              </div>
            )}
            <ConflictAlert conflicts={conflicts} />

            {/* Precio + Observaciones */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Precio acordado (€)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.precio_acordado ?? ''}
                  onChange={e => set('precio_acordado', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0,00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value as ServicioEstado)} className={inputCls}>
                  {SERVICIO_ESTADOS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Observaciones</label>
              <textarea
                rows={2}
                value={form.observaciones ?? ''}
                onChange={e => set('observaciones', e.target.value)}
                placeholder="Notas internas del servicio..."
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center gap-3">
            <div>
              {conflicts.length > 0 && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Hay conflictos de disponibilidad
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60 flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {servicio ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fila de servicio en el listado ────────────────────────────────────────────

interface ServicioRowProps {
  s: TradeTransportService;
  clients: TradeClient[];
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  onEdit: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onIniciar: () => void;
  onOpenParte: (svcId: string) => void;
  canWrite: boolean;
}

function ServicioRow({
  s, clients, vehicles, workers,
  onEdit, onCancel, onConfirm, onIniciar, onOpenParte, canWrite,
}: ServicioRowProps) {
  const client   = clients.find(c => c.id === s.client_id);
  const vehicle  = vehicles.find(v => v.id === s.vehicle_id);
  const conductor = workers.find(w => w.id === s.conductor_id);

  const isTerminal = s.estado === 'completado' || s.estado === 'cancelado';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        {/* Columna izquierda: fecha + tipo + título */}
        <div className="flex gap-3 min-w-0">
          <div className="text-center shrink-0 w-12">
            <span className="block text-[11px] font-bold text-slate-400 uppercase">{fmtDate(s.fecha_inicio).split(' ')[0]}</span>
            <span className="block text-lg font-black text-slate-800 leading-tight">{new Date(s.fecha_inicio).getDate()}</span>
            <span className="block text-[10px] text-slate-500">{fmtTime(s.fecha_inicio)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <TipoBadge tipo={s.tipo_servicio} />
              <EstadoBadge estado={s.estado} />
            </div>
            <p className="font-semibold text-slate-900 text-sm truncate">{s.titulo}</p>
            {(s.origen || s.destino) && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{[s.origen, s.destino].filter(Boolean).join(' → ')}</span>
              </div>
            )}
            {client && (
              <p className="text-xs text-slate-500 mt-0.5">{getClientDisplayName(client)}</p>
            )}
          </div>
        </div>

        {/* Columna derecha: asignaciones + precio + acciones */}
        <div className="shrink-0 text-right space-y-1.5">
          {vehicle && (
            <div className="flex items-center justify-end gap-1 text-xs text-slate-600">
              <Truck className="w-3.5 h-3.5" />
              <span>{vehicle.nombre}</span>
            </div>
          )}
          {conductor && (
            <div className="flex items-center justify-end gap-1 text-xs text-slate-600">
              <UserCheck className="w-3.5 h-3.5" />
              <span>{conductor.nombre}</span>
            </div>
          )}
          {s.num_viajeros && (
            <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span>{s.num_viajeros} viajeros</span>
            </div>
          )}
          {s.precio_acordado != null && (
            <p className="text-sm font-bold text-slate-800">{s.precio_acordado.toFixed(2)} €</p>
          )}
          {canWrite && !isTerminal && (
            <div className="flex items-center justify-end gap-1 pt-1">
              {s.estado === 'borrador' && (
                <button onClick={onConfirm}
                  className="px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-md cursor-pointer">
                  Confirmar
                </button>
              )}
              {s.estado === 'confirmado' && (
                <button onClick={onIniciar}
                  className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer">
                  Iniciar
                </button>
              )}
              {s.estado === 'en_curso' && (
                <button onClick={() => onOpenParte(s.id)}
                  className="px-2 py-1 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-md cursor-pointer">
                  Cerrar parte
                </button>
              )}
              {s.estado === 'completado' && canWrite && (
                <button onClick={() => onOpenParte(s.id)}
                  className="px-2 py-1 text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer">
                  Ver parte
                </button>
              )}
              <button onClick={onEdit}
                className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onCancel}
                className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Props principales ─────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenParte?: (svcId: string) => void;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScreenTransporteServicios({ orgId, showToast, onOpenParte }: Props) {
  const { rol } = useSession();
  const canWrite = rol === 'owner' || rol === 'admin';

  // Data
  const [services,  setServices]  = useState<TradeTransportService[]>([]);
  const [clients,   setClients]   = useState<TradeClient[]>([]);
  const [vehicles,  setVehicles]  = useState<TradeVehicle[]>([]);
  const [workers,   setWorkers]   = useState<TradeWorker[]>([]);

  // UI state
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null);
  const [editing,   setEditing]   = useState<TradeTransportService | null>(null);
  const [canceling, setCanceling] = useState<TradeTransportService | null>(null);

  // Filtros
  const todayStr = new Date().toISOString().split('T')[0];
  const [filterDesde,  setFilterDesde]  = useState(todayStr);
  const [filterHasta,  setFilterHasta]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [filterEstado, setFilterEstado] = useState<ServicioEstado | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [svcs, cls, vhs, wks] = await Promise.all([
        loadTransportServices(orgId, {
          desde:  filterDesde  ? `${filterDesde}T00:00:00`  : undefined,
          hasta:  filterHasta  ? `${filterHasta}T23:59:59`  : undefined,
          estado: filterEstado || undefined,
        }),
        loadClients(orgId),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
      ]);
      setServices(svcs);
      setClients(cls);
      setVehicles(vhs);
      setWorkers(wks);
    } catch (err) {
      setLoadError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [orgId, filterDesde, filterHasta, filterEstado]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (s: TradeTransportService) => {
    setServices(prev => {
      const idx = prev.findIndex(x => x.id === s.id);
      return idx >= 0 ? prev.map((x, i) => i === idx ? s : x) : [s, ...prev];
    });
    setModal(null);
    setEditing(null);
  };

  const handleConfirm = async (s: TradeTransportService) => {
    try {
      const result = await confirmTransportService(s.id, orgId);
      if (result.ok) {
        setServices(prev => prev.map(x => x.id === s.id ? { ...x, estado: 'confirmado' } : x));
        showToast('Servicio confirmado', 'success');
      } else {
        const hasConcurrent = result.conflictos?.some(c => c.tipo === 'conflicto_concurrente');
        if (hasConcurrent) {
          showToast('Conflicto: recurso confirmado simultáneamente por otra sesión', 'error');
        } else {
          const tipos = [...new Set(result.conflictos?.map(c => c.tipo === 'vehiculo' ? 'vehículo' : 'conductor') ?? [])];
          showToast(`Conflicto: ${tipos.join(' y ')} ya asignado en otro servicio`, 'error');
        }
      }
    } catch (err) {
      showToast(errMsg(err), 'error');
    }
  };

  const handleEstado = async (s: TradeTransportService, estado: ServicioEstado) => {
    try {
      await updateTransportEstado(s.id, orgId, estado);
      setServices(prev => prev.map(x => x.id === s.id ? { ...x, estado } : x));
      showToast(`Servicio en estado: ${SERVICIO_ESTADOS.find(e => e.value === estado)?.label}`, 'success');
    } catch (err) {
      showToast(errMsg(err), 'error');
    }
  };

  const handleCancelConfirm = async () => {
    if (!canceling) return;
    try {
      await cancelTransportService(canceling.id, orgId);
      setServices(prev => prev.map(x => x.id === canceling.id ? { ...x, estado: 'cancelado' } : x));
      showToast('Servicio cancelado', 'success');
    } catch (err) {
      showToast(errMsg(err), 'error');
    } finally {
      setCanceling(null);
    }
  };

  const inputCls = "px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">Servicios de transporte</h2>
            <p className="text-xs text-slate-400">Gestión de servicios puntuales de viajeros</p>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={() => { setEditing(null); setModal('create'); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo servicio
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} className={inputCls} />
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} className={inputCls} />
        </div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as ServicioEstado | '')} className={inputCls}>
          <option value="">Todos los estados</option>
          {SERVICIO_ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Contenido */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando servicios...</span>
        </div>
      )}

      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Error al cargar servicios</p>
            <p className="text-xs text-red-600 mt-1">{loadError}</p>
            <button onClick={load} className="text-xs text-red-700 underline mt-2 cursor-pointer">Reintentar</button>
          </div>
        </div>
      )}

      {!loading && !loadError && services.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
            <Calendar className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Sin servicios en el rango seleccionado</p>
          <p className="text-xs text-slate-400">Prueba a cambiar las fechas o crea el primer servicio</p>
          {canWrite && (
            <button
              onClick={() => { setEditing(null); setModal('create'); }}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nuevo servicio
            </button>
          )}
        </div>
      )}

      {!loading && !loadError && services.length > 0 && (
        <div className="space-y-3">
          {services.map(s => (
            <ServicioRow
              key={s.id}
              s={s}
              clients={clients}
              vehicles={vehicles}
              workers={workers}
              canWrite={canWrite}
              onEdit={() => { setEditing(s); setModal('edit'); }}
              onCancel={() => setCanceling(s)}
              onConfirm={() => handleConfirm(s)}
              onIniciar={() => handleEstado(s, 'en_curso')}
              onOpenParte={(id) => onOpenParte?.(id)}
            />
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {modal && (
        <ServicioModal
          servicio={modal === 'edit' ? editing : null}
          orgId={orgId}
          clients={clients}
          vehicles={vehicles}
          workers={workers}
          onClose={() => { setModal(null); setEditing(null); }}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}

      {/* Diálogo de cancelación */}
      {canceling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-900 mb-2">Cancelar servicio</h3>
            <p className="text-sm text-slate-600 mb-4">
              ¿Seguro que quieres cancelar "{canceling.titulo}"?
              Esta acción no puede deshacerse.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCanceling(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg cursor-pointer">
                Volver
              </button>
              <button onClick={handleCancelConfirm}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg cursor-pointer hover:bg-red-700">
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
