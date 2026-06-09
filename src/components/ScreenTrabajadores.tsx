import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, X, Trash2, Edit2, Phone, Mail, MapPin,
  Clock, Star, CheckCircle2, Circle, Wrench, Car, Calendar,
  Save, ChevronDown, ChevronUp, Route,
} from 'lucide-react';
import {
  supabase, loadWorkers, addWorker, deleteWorker, updateWorker,
  loadWorkerSchedules, saveWorkerSchedules,
} from '../lib/supabase';
import type { TradeWorker, TradeWorkerSchedule } from '../lib/supabase';
import { useSession } from '../context/SessionContext';

// ── Constantes ────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LABEL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ESPECIALIDADES_DISPONIBLES = [
  'Electricidad', 'Fontanería', 'Climatización', 'Gas', 'Carpintería',
  'Pintura', 'Albañilería', 'Cerrajería', 'Instalaciones', 'Mantenimiento',
  'Telecomunicaciones', 'Energía solar', 'Calderas', 'Frío industrial',
];

const ROL_CFG: Record<string, { label: string; color: string }> = {
  tecnico:        { label: 'Técnico',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  oficial:        { label: 'Oficial',       color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  ayudante:       { label: 'Ayudante',      color: 'bg-slate-100 text-slate-600 border-slate-200' },
  subcontratado:  { label: 'Subcontratado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  coordinador:    { label: 'Coordinador',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const ESTADO_CFG: Record<string, { label: string; dot: string }> = {
  disponible: { label: 'Disponible', dot: 'bg-emerald-400' },
  ocupado:    { label: 'Ocupado',    dot: 'bg-amber-400' },
  libre:      { label: 'Libre',      dot: 'bg-slate-300' },
  inactivo:   { label: 'Inactivo',   dot: 'bg-red-300' },
};

function colorFromName(name: string) {
  const colors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-indigo-500'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff;
  return colors[h % colors.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ── Formulario vacío ──────────────────────────────────────────────────────

function emptyForm(): Partial<TradeWorker> {
  return {
    nombre: '', telefono: '', email: '', rol: 'tecnico',
    especialidades: [], max_trabajos_dia: 6,
    buffer_desplazamiento_min: 15, tiene_vehiculo: true,
    horario_inicio: '08:00', horario_fin: '18:00',
    estado_actual: 'disponible',
  };
}

function defaultSchedules(orgId: string, workerId: string): Omit<TradeWorkerSchedule, 'id'>[] {
  return [1,2,3,4,5].map(d => ({
    worker_id: workerId,
    org_id: orgId,
    dia_semana: d,
    activo: true,
    hora_inicio: '08:00',
    hora_fin: '18:00',
  }));
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ScreenTrabajadores({ showToast, isLiveMode }: Props) {
  const { org } = useSession();
  const [workers, setWorkers] = useState<TradeWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<TradeWorker | null>(null);
  const [schedules, setSchedules] = useState<TradeWorkerSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TradeWorker | null>(null);
  const [form, setForm] = useState<Partial<TradeWorker>>(emptyForm());
  const [formSchedules, setFormSchedules] = useState<Omit<TradeWorkerSchedule,'id'>[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSpecialityPicker, setShowSpecialityPicker] = useState(false);

  const fetch = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const data = await loadWorkers(org.id);
      setWorkers(data);
    } catch {
      showToast('Error cargando trabajadores', 'error');
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { fetch(); }, [fetch]);

  async function openWorker(w: TradeWorker) {
    setSelectedWorker(w);
    try {
      const scheds = await loadWorkerSchedules(w.id);
      setSchedules(scheds);
    } catch {
      setSchedules([]);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setFormSchedules(
      [1,2,3,4,5].map(d => ({
        worker_id: '', org_id: org?.id ?? '',
        dia_semana: d, activo: true,
        hora_inicio: '08:00', hora_fin: '18:00',
      }))
    );
    setShowForm(true);
  }

  async function openEdit(w: TradeWorker) {
    setEditing(w);
    setForm({ ...w });
    try {
      const scheds = await loadWorkerSchedules(w.id);
      setFormSchedules(scheds.map(s => ({ ...s })));
      if (!scheds.length) {
        setFormSchedules([1,2,3,4,5].map(d => ({
          worker_id: w.id, org_id: org?.id ?? '',
          dia_semana: d, activo: true,
          hora_inicio: '08:00', hora_fin: '18:00',
        })));
      }
    } catch {
      setFormSchedules([]);
    }
    setShowForm(true);
  }

  async function handleSave() {
    if (!org || !form.nombre?.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateWorker(editing.id, form);
        await saveWorkerSchedules(editing.id, org.id, formSchedules.map(s => ({
          ...s, worker_id: editing.id, org_id: org.id,
        })));
        showToast('Trabajador actualizado', 'success');
      } else {
        const newW = await addWorker(org.id, {
          nombre: form.nombre!,
          telefono: form.telefono,
          email: form.email,
          rol: form.rol ?? 'tecnico',
        });
        // Save extended fields
        await updateWorker(newW.id, {
          especialidades: form.especialidades,
          max_trabajos_dia: form.max_trabajos_dia,
          buffer_desplazamiento_min: form.buffer_desplazamiento_min,
          tiene_vehiculo: form.tiene_vehiculo,
          horario_inicio: form.horario_inicio,
          horario_fin: form.horario_fin,
          estado_actual: form.estado_actual,
        });
        await saveWorkerSchedules(newW.id, org.id, formSchedules.map(s => ({
          ...s, worker_id: newW.id, org_id: org.id,
        })));
        showToast('Trabajador creado', 'success');
      }
      setShowForm(false);
      await fetch();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(w: TradeWorker) {
    if (!confirm(`¿Dar de baja a ${w.nombre}?`)) return;
    try {
      await deleteWorker(w.id);
      setWorkers(prev => prev.filter(x => x.id !== w.id));
      if (selectedWorker?.id === w.id) setSelectedWorker(null);
      showToast(`${w.nombre} dado de baja`, 'info');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  }

  function toggleEspecialidad(esp: string) {
    setForm(prev => {
      const current = prev.especialidades ?? [];
      return {
        ...prev,
        especialidades: current.includes(esp)
          ? current.filter(e => e !== esp)
          : [...current, esp],
      };
    });
  }

  function updateSchedule(idx: number, field: keyof Omit<TradeWorkerSchedule,'id'>, value: unknown) {
    setFormSchedules(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Equipo de trabajo</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{workers.length} trabajador{workers.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Añadir trabajador
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-slate-400 p-4">Cargando...</div>
      ) : workers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Sin trabajadores</p>
          <p className="text-xs text-slate-400 mt-1">Añade los técnicos de tu equipo para asignarles trabajos y rutas.</p>
          <button onClick={openNew} className="mt-4 text-sm font-semibold text-blue-600 hover:underline cursor-pointer">
            + Añadir primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {workers.map(w => {
            const estadoCfg = ESTADO_CFG[w.estado_actual ?? 'disponible'] ?? ESTADO_CFG.disponible;
            const rolCfg = ROL_CFG[w.rol] ?? { label: w.rol, color: 'bg-slate-100 text-slate-600 border-slate-200' };
            return (
              <div
                key={w.id}
                onClick={() => openWorker(w)}
                className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full ${colorFromName(w.nombre)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {initials(w.nombre)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{w.nombre}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rolCfg.color}`}>{rolCfg.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
                      <span className="text-[10px] text-slate-400">{estadoCfg.label}</span>
                      {w.especialidades && w.especialidades.length > 0 && (
                        <span className="text-[10px] text-slate-400">· {w.especialidades.slice(0,2).join(', ')}{w.especialidades.length > 2 ? ` +${w.especialidades.length-2}` : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(w); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(w); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick info */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                  {w.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{w.telefono}</span>}
                  {w.tiene_vehiculo !== false && <span className="flex items-center gap-1"><Car className="w-3 h-3" />Vehículo</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Máx. {w.max_trabajos_dia ?? 6} trabajos/día</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel detalle trabajador */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${colorFromName(selectedWorker.nombre)} flex items-center justify-center text-white font-bold`}>
                  {initials(selectedWorker.nombre)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selectedWorker.nombre}</p>
                  <p className="text-xs text-slate-400">{ROL_CFG[selectedWorker.rol]?.label ?? selectedWorker.rol}</p>
                </div>
              </div>
              <button onClick={() => setSelectedWorker(null)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Contacto */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {selectedWorker.telefono && (
                  <a href={`tel:${selectedWorker.telefono}`} className="flex items-center gap-2 text-slate-700 hover:text-blue-600">
                    <Phone className="w-4 h-4 text-slate-400" />{selectedWorker.telefono}
                  </a>
                )}
                {selectedWorker.email && (
                  <a href={`mailto:${selectedWorker.email}`} className="flex items-center gap-2 text-slate-700 hover:text-blue-600">
                    <Mail className="w-4 h-4 text-slate-400" />{selectedWorker.email}
                  </a>
                )}
              </div>

              {/* Especialidades */}
              {selectedWorker.especialidades && selectedWorker.especialidades.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorker.especialidades.map(esp => (
                      <span key={esp} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                        {esp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Configuración */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Carga máx. día</p>
                  <p className="text-slate-900 font-bold">{selectedWorker.max_trabajos_dia ?? 6} trabajos</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Buffer desplaz.</p>
                  <p className="text-slate-900 font-bold">{selectedWorker.buffer_desplazamiento_min ?? 15} min</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Horario</p>
                  <p className="text-slate-900 font-bold">{selectedWorker.horario_inicio ?? '08:00'} – {selectedWorker.horario_fin ?? '18:00'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Vehículo propio</p>
                  <p className={`font-bold ${selectedWorker.tiene_vehiculo !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedWorker.tiene_vehiculo !== false ? 'Sí' : 'No'}
                  </p>
                </div>
              </div>

              {/* Horario semanal */}
              {schedules.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Horario semanal</p>
                  <div className="space-y-1">
                    {[0,1,2,3,4,5,6].map(d => {
                      const s = schedules.find(sc => sc.dia_semana === d);
                      return (
                        <div key={d} className="flex items-center gap-3 text-xs">
                          <span className={`w-8 font-bold text-[10px] ${s?.activo ? 'text-slate-700' : 'text-slate-300'}`}>{DIAS_SEMANA[d]}</span>
                          {s?.activo ? (
                            <span className="text-slate-600">{s.hora_inicio} – {s.hora_fin}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => { setSelectedWorker(null); openEdit(selectedWorker); }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                Editar trabajador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar trabajador */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg border border-slate-200 shadow-2xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900">{editing ? 'Editar trabajador' : 'Nuevo trabajador'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Datos básicos */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre ?? ''}
                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Juan García"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={form.telefono ?? ''}
                      onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                      placeholder="600 000 000"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email ?? ''}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="tecnico@empresa.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Rol</label>
                    <select
                      value={form.rol ?? 'tecnico'}
                      onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {Object.entries(ROL_CFG).map(([v, cfg]) => (
                        <option key={v} value={v}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select
                      value={form.estado_actual ?? 'disponible'}
                      onChange={e => setForm(p => ({ ...p, estado_actual: e.target.value as TradeWorker['estado_actual'] }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {Object.entries(ESTADO_CFG).map(([v, cfg]) => (
                        <option key={v} value={v}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Especialidades */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Especialidades</label>
                <div className="flex flex-wrap gap-1.5">
                  {ESPECIALIDADES_DISPONIBLES.map(esp => {
                    const active = (form.especialidades ?? []).includes(esp);
                    return (
                      <button
                        key={esp}
                        type="button"
                        onClick={() => toggleEspecialidad(esp)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {esp}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Config capacidad */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Máx. trabajos/día</label>
                  <input
                    type="number"
                    min={1} max={20}
                    value={form.max_trabajos_dia ?? 6}
                    onChange={e => setForm(p => ({ ...p, max_trabajos_dia: parseInt(e.target.value) || 6 }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Buffer (min)</label>
                  <input
                    type="number"
                    min={0} max={60}
                    value={form.buffer_desplazamiento_min ?? 15}
                    onChange={e => setForm(p => ({ ...p, buffer_desplazamiento_min: parseInt(e.target.value) || 15 }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehículo</label>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tiene_vehiculo: !p.tiene_vehiculo }))}
                    className={`w-full py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                      form.tiene_vehiculo !== false
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {form.tiene_vehiculo !== false ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* Horario semanal */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Horario semanal</label>
                <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                  {formSchedules.map((s, idx) => (
                    <div key={s.dia_semana} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateSchedule(idx, 'activo', !s.activo)}
                        className={`w-5 h-5 rounded cursor-pointer border-2 flex items-center justify-center shrink-0 ${s.activo ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}
                      >
                        {s.activo && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-xs font-bold text-slate-600 w-8">{DIAS_SEMANA[s.dia_semana]}</span>
                      {s.activo ? (
                        <>
                          <input
                            type="time"
                            value={s.hora_inicio}
                            onChange={e => updateSchedule(idx, 'hora_inicio', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 bg-white"
                          />
                          <span className="text-xs text-slate-400">–</span>
                          <input
                            type="time"
                            value={s.hora_fin}
                            onChange={e => updateSchedule(idx, 'hora_fin', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No trabaja</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre?.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear trabajador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
