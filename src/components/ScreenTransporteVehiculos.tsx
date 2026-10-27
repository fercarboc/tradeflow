import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bus, Plus, X, Edit2, Trash2, Save, AlertCircle,
  CheckCircle2, Wrench, AlertTriangle, CircleOff,
  ChevronDown, Gauge, Loader2, History,
} from 'lucide-react';
import {
  loadVehiclesAll,
  createVehicle,
  updateVehicle,
  deactivateVehicle,
  setVehicleEstado,
  validateMatricula,
  needsPassengerCapacity,
  getVehicleDisplayImage,
  VEHICLE_SELECTABLE_IMAGES,
  VEHICLE_TIPOS,
  VEHICLE_ESTADOS,
  VEHICLE_MODALIDADES,
} from '../lib/transport';
import { loadTransportServices } from '../lib/transportServices';
import type { TradeTransportService } from '../lib/transportServices';
import { loadVehicleKmHistory } from '../lib/vehicleKm';
import type { VehicleKmReadingWithAnulada } from '../lib/vehicleKm';
import { useSession } from '../context/SessionContext';
import type { TradeVehicle, TradeVehicleInput, VehicleEstado, VehicleModalidad } from '../lib/transport';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_ICON: Record<VehicleEstado, React.ReactNode> = {
  disponible:       <CheckCircle2 size={14} />,
  en_servicio:      <Bus size={14} />,
  en_mantenimiento: <Wrench size={14} />,
  baja:             <CircleOff size={14} />,
};

const CURRENT_YEAR = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyForm(): TradeVehicleInput {
  return {
    nombre: '',
    matricula: '',
    tipo: 'furgoneta',
    modalidad: 'viajeros',
    capacidad_viajeros: 8,
    capacidad_carga_kg: null,
    estado: 'disponible',
    marca: null,
    modelo_vehiculo: null,
    anno: null,
    color: null,
    notas: null,
    image_path: null,
  };
}

function modalidadCfg(modalidad: VehicleModalidad) {
  return VEHICLE_MODALIDADES.find(m => m.value === modalidad) ?? VEHICLE_MODALIDADES[0];
}

function estadoCfg(estado: VehicleEstado) {
  return VEHICLE_ESTADOS.find(e => e.value === estado) ?? VEHICLE_ESTADOS[0];
}

function tipoLabel(tipo: string) {
  return VEHICLE_TIPOS.find(t => t.value === tipo)?.label ?? tipo;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Modal de formulario ───────────────────────────────────────────────────────

interface VehicleFormModalProps {
  vehicle: TradeVehicle | null;
  onClose: () => void;
  onSaved: (v: TradeVehicle) => void;
  orgId: string;
  showToast: Props['showToast'];
}

function VehicleFormModal({ vehicle, onClose, onSaved, orgId, showToast }: VehicleFormModalProps) {
  const [form, setForm] = useState<TradeVehicleInput>(
    vehicle
      ? {
          nombre: vehicle.nombre,
          matricula: vehicle.matricula,
          tipo: vehicle.tipo,
          modalidad: vehicle.modalidad,
          capacidad_viajeros: vehicle.capacidad_viajeros,
          capacidad_carga_kg: vehicle.capacidad_carga_kg,
          estado: vehicle.estado,
          marca: vehicle.marca ?? null,
          modelo_vehiculo: vehicle.modelo_vehiculo ?? null,
          anno: vehicle.anno ?? null,
          color: vehicle.color ?? null,
          notas: vehicle.notas ?? null,
          image_path: vehicle.image_path ?? null,
        }
      : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [matriculaError, setMatriculaError] = useState('');

  function set<K extends keyof TradeVehicleInput>(key: K, val: TradeVehicleInput[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
    if (key === 'matricula') setMatriculaError('');
  }

  function handleModalidadChange(val: VehicleModalidad) {
    setForm(prev => ({
      ...prev,
      modalidad: val,
      capacidad_viajeros: (val === 'viajeros' || val === 'mixto')
        ? (prev.capacidad_viajeros ?? 8)
        : null,
      capacidad_carga_kg: (val === 'mercancias' || val === 'reparto' || val === 'mixto')
        ? (prev.capacidad_carga_kg ?? null)
        : null,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!validateMatricula(form.matricula)) {
      setMatriculaError('Matrícula inválida (mínimo 4 caracteres, solo letras y números)');
      return;
    }
    if (needsPassengerCapacity(form.modalidad)) {
      if (!form.capacidad_viajeros || form.capacidad_viajeros < 1 || form.capacidad_viajeros > 90) {
        showToast('La capacidad de viajeros debe estar entre 1 y 90', 'error');
        return;
      }
    }
    if (form.capacidad_carga_kg != null && (form.capacidad_carga_kg < 1 || form.capacidad_carga_kg > 50000)) {
      showToast('La capacidad de carga debe estar entre 1 y 50.000 kg', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = vehicle
        ? await updateVehicle(vehicle.id, orgId, form)
        : await createVehicle(orgId, form);
      onSaved(saved);
      showToast(vehicle ? 'Vehículo actualizado' : 'Vehículo añadido', 'success');
      onClose();
    } catch (e) {
      const msg = errMsg(e);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('vehicles_org_matricula')) {
        setMatriculaError('Esta matrícula ya está registrada en tu flota');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bus size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">
              {vehicle ? 'Editar vehículo' : 'Nuevo vehículo'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Nombre del vehículo *
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Bus Escolar 1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Matrícula *
            </label>
            <input
              type="text"
              value={form.matricula}
              onChange={e => set('matricula', e.target.value.toUpperCase())}
              placeholder="Ej: 1234-ABC"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                matriculaError ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            {matriculaError && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {matriculaError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Tipo
              </label>
              <div className="relative">
                <select
                  value={form.tipo}
                  onChange={e => set('tipo', e.target.value as TradeVehicleInput['tipo'])}
                  className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {VEHICLE_TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Modalidad *
              </label>
              <div className="relative">
                <select
                  value={form.modalidad}
                  onChange={e => handleModalidadChange(e.target.value as VehicleModalidad)}
                  className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {VEHICLE_MODALIDADES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {(needsPassengerCapacity(form.modalidad) || form.modalidad === 'mercancias' || form.modalidad === 'reparto') && (
            <div className={`grid gap-3 ${form.modalidad === 'mixto' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {needsPassengerCapacity(form.modalidad) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Capacidad de viajeros *
                  </label>
                  <input
                    type="number" min={1} max={90}
                    value={form.capacidad_viajeros ?? ''}
                    onChange={e => set('capacidad_viajeros', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 20"
                  />
                </div>
              )}
              {(form.modalidad === 'mercancias' || form.modalidad === 'reparto' || form.modalidad === 'mixto') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Carga máx. (kg)
                  </label>
                  <input
                    type="number" min={1} max={50000}
                    value={form.capacidad_carga_kg ?? ''}
                    onChange={e => set('capacidad_carga_kg', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 3500"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Estado operativo
            </label>
            <div className="relative">
              <select
                value={form.estado}
                onChange={e => set('estado', e.target.value as VehicleEstado)}
                className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              >
                {VEHICLE_ESTADOS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Marca</label>
              <input type="text" value={form.marca ?? ''} onChange={e => set('marca', e.target.value || null)}
                placeholder="Ej: Mercedes"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Modelo</label>
              <input type="text" value={form.modelo_vehiculo ?? ''} onChange={e => set('modelo_vehiculo', e.target.value || null)}
                placeholder="Ej: Sprinter"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Año</label>
              <input type="number" min={1950} max={CURRENT_YEAR + 1} value={form.anno ?? ''}
                onChange={e => set('anno', e.target.value ? Number(e.target.value) : null)}
                placeholder={String(CURRENT_YEAR)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Color</label>
              <input type="text" value={form.color ?? ''} onChange={e => set('color', e.target.value || null)}
                placeholder="Ej: Blanco"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notas</label>
            <textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value || null)} rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Imagen del vehículo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Imagen del vehículo
            </label>
            {/* Preview de imagen actual */}
            <div className="flex items-center gap-3 mb-2">
              {getVehicleDisplayImage(form.tipo, form.image_path) ? (
                <img
                  src={getVehicleDisplayImage(form.tipo, form.image_path)!}
                  alt="Vista previa"
                  className="w-20 h-12 object-contain rounded border border-slate-200 bg-slate-50"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-20 h-12 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-300">
                  <Bus size={22} />
                </div>
              )}
              <div className="text-xs text-slate-500">
                {form.image_path
                  ? <span>Imagen personalizada</span>
                  : <span className="italic">Automática según tipo</span>}
              </div>
            </div>
            {/* Selector de imagen */}
            <div className="grid grid-cols-5 gap-1.5">
              {/* Opción: automática */}
              <button
                type="button"
                onClick={() => set('image_path', null)}
                className={`flex flex-col items-center p-1.5 rounded-lg border text-[10px] text-center cursor-pointer transition-all ${
                  !form.image_path
                    ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Bus size={16} className="mb-0.5 opacity-60" />
                Auto
              </button>
              {/* Opciones de imágenes disponibles */}
              {VEHICLE_SELECTABLE_IMAGES.map(img => (
                <button
                  key={img.path}
                  type="button"
                  onClick={() => set('image_path', img.path)}
                  title={img.label}
                  className={`flex flex-col items-center p-1 rounded-lg border cursor-pointer transition-all ${
                    form.image_path === img.path
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <img src={img.path} alt={img.label} className="w-10 h-6 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save size={15} />
              {saving ? 'Guardando…' : vehicle ? 'Guardar cambios' : 'Añadir vehículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de confirmación de baja ─────────────────────────────────────────────

interface ConfirmDeactivateModalProps {
  vehicle: TradeVehicle;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ConfirmDeactivateModal({ vehicle, onClose, onConfirm, loading }: ConfirmDeactivateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Dar de baja</h3>
            <p className="text-sm text-slate-500">Esta acción es reversible</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-6">
          ¿Dar de baja el vehículo <strong>{vehicle.nombre}</strong> ({vehicle.matricula})?
          Quedará inactivo pero no se eliminará.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Procesando…' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function ScreenTransporteVehiculos({ orgId, showToast }: Props) {
  const { rol } = useSession();
  const canWrite = rol === 'owner' || rol === 'admin';

  const loadIdRef = useRef(0);

  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [activeServices, setActiveServices] = useState<TradeTransportService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TradeVehicle | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<TradeVehicle | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [kmPanelVehicle, setKmPanelVehicle] = useState<TradeVehicle | null>(null);
  const [kmReadings, setKmReadings] = useState<VehicleKmReadingWithAnulada[]>([]);
  const [kmLoading, setKmLoading] = useState(false);

  // Ref estable para showToast — evita que useCallback de load cambie cada vez
  // que el padre re-renderiza al mostrar un toast (causa del bucle de carga).
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; });

  const load = useCallback(async () => {
    const myId = ++loadIdRef.current;
    setLoading(true);
    try {
      const [data, activeSvcs] = await Promise.all([
        loadVehiclesAll(orgId),
        loadTransportServices(orgId, { estado: 'en_curso' }),
      ]);
      if (loadIdRef.current !== myId) return; // discard stale response
      setVehicles(data);
      setActiveServices(activeSvcs);
    } catch (e) {
      if (loadIdRef.current !== myId) return;
      showToastRef.current(errMsg(e), 'error');
    } finally {
      if (loadIdRef.current === myId) setLoading(false);
    }
  }, [orgId]); // showToast excluido: ref estable evita reload innecesario

  useEffect(() => { void load(); }, [load]);

  function handleSaved(v: TradeVehicle) {
    setVehicles(prev => {
      const idx = prev.findIndex(x => x.id === v.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = v; return next; }
      return [...prev, v];
    });
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    setDeactivateLoading(true);
    try {
      await deactivateVehicle(deactivating.id, orgId);
      setVehicles(prev => prev.map(v => v.id === deactivating.id ? { ...v, activo: false } : v));
      showToast('Vehículo dado de baja', 'success');
      setDeactivating(null);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function handleEstadoChange(v: TradeVehicle, estado: VehicleEstado) {
    try {
      await setVehicleEstado(v.id, orgId, estado);
      setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, estado } : x));
    } catch (e) {
      showToast(errMsg(e), 'error');
    }
  }

  async function handleOpenKmPanel(v: TradeVehicle) {
    setKmPanelVehicle(v);
    setKmReadings([]);
    setKmLoading(true);
    try {
      const readings = await loadVehicleKmHistory(orgId, v.id);
      setKmReadings(readings);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setKmLoading(false);
    }
  }

  const activeVehicleIds = useMemo(
    () => new Set(activeServices.filter(s => s.vehicle_id).map(s => s.vehicle_id!)),
    [activeServices],
  );

  const visible     = showInactive ? vehicles : vehicles.filter(v => v.activo);
  const activos     = vehicles.filter(v => v.activo).length;
  const disponibles = vehicles.filter(v => v.activo && v.estado === 'disponible' && !activeVehicleIds.has(v.id)).length;
  const enCursoAhora = activeVehicleIds.size > 0
    ? vehicles.filter(v => v.activo && activeVehicleIds.has(v.id)).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Bus size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Flota de vehículos</h1>
              <p className="text-xs text-slate-500">
                {activos} activo{activos !== 1 ? 's' : ''} · {disponibles} disponible{disponibles !== 1 ? 's' : ''}
                {enCursoAhora > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                    · <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    {enCursoAhora} en curso
                  </span>
                )}
              </p>
            </div>
          </div>
          {canWrite && (
            <button onClick={() => setEditingVehicle(null)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo vehículo</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {vehicles.some(v => !v.activo) && (
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => setShowInactive(s => !s)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <span className={`w-3 h-3 rounded border ${showInactive ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`} />
              Mostrar vehículos dados de baja
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-slate-400 text-sm">Cargando flota…</div>
        )}

        {!loading && visible.length === 0 && (
          <div className="text-center py-20">
            <Bus size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">
              {showInactive ? 'No hay vehículos registrados' : 'No hay vehículos activos'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Añade tu primer vehículo para empezar a gestionar la flota
            </p>
            {canWrite && (
              <button onClick={() => setEditingVehicle(null)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus size={16} /> Añadir vehículo
              </button>
            )}
          </div>
        )}

        {!loading && visible.length > 0 && (
          <>
            {/* Desktop */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehículo</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Matrícula</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo / Modalidad</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Capacidad</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map(v => {
                    const ec = estadoCfg(v.estado);
                    return (
                      <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${!v.activo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {getVehicleDisplayImage(v.tipo, v.image_path)
                              ? <img src={getVehicleDisplayImage(v.tipo, v.image_path)!} alt={tipoLabel(v.tipo)} className="w-12 h-9 object-contain rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : <div className="w-12 h-9 rounded bg-slate-100 flex items-center justify-center shrink-0"><Bus className="w-5 h-5 text-slate-400" /></div>
                            }
                            <div>
                              <div className="font-medium text-slate-900">{v.nombre}</div>
                              {(v.marca || v.modelo_vehiculo) && (
                                <div className="text-xs text-slate-400">
                                  {[v.marca, v.modelo_vehiculo].filter(Boolean).join(' ')}{v.anno ? ` · ${v.anno}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{v.matricula}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-600 text-sm">{tipoLabel(v.tipo)}</div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border mt-0.5 ${modalidadCfg(v.modalidad).color}`}>
                            {modalidadCfg(v.modalidad).label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 text-xs space-y-0.5">
                          {v.capacidad_viajeros != null && <div className="font-medium">{v.capacidad_viajeros} plz.</div>}
                          {v.capacidad_carga_kg != null && <div className="text-slate-500">{v.capacidad_carga_kg} kg</div>}
                          {v.capacidad_viajeros == null && v.capacidad_carga_kg == null && <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {v.activo ? (
                            <div className="space-y-1">
                              {canWrite ? (
                                <select
                                  value={v.estado}
                                  onChange={e => handleEstadoChange(v, e.target.value as VehicleEstado)}
                                  className={`cursor-pointer px-2 py-1 rounded-full text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500 ${ec.color}`}
                                >
                                  {VEHICLE_ESTADOS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${ec.color}`}>
                                  {ESTADO_ICON[v.estado]}{ec.label}
                                </span>
                              )}
                              {activeVehicleIds.has(v.id) && (() => {
                                const isRestricted = v.estado === 'en_mantenimiento' || v.estado === 'baja';
                                return isRestricted ? (
                                  <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                                    <AlertTriangle size={11} className="shrink-0" />
                                    En curso (restringido)
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    En curso ahora
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <CircleOff size={12} /> Baja
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleOpenKmPanel(v)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                              title={v.km_actual != null ? `${v.km_actual.toLocaleString()} km` : 'Odómetro'}>
                              <Gauge size={14} />
                            </button>
                            {canWrite && (
                              <>
                                <button onClick={() => setEditingVehicle(v)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar">
                                  <Edit2 size={14} />
                                </button>
                                {v.activo && (
                                  <button onClick={() => setDeactivating(v)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Dar de baja">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {visible.map(v => {
                const ec = estadoCfg(v.estado);
                return (
                  <div key={v.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${!v.activo ? 'opacity-50' : ''}`}>
                    {/* Imagen del vehículo */}
                    <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                      {getVehicleDisplayImage(v.tipo, v.image_path)
                        ? <img src={getVehicleDisplayImage(v.tipo, v.image_path)!} alt={tipoLabel(v.tipo)} className="w-16 h-10 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="w-16 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0"><Bus className="w-6 h-6 text-slate-400" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{v.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono">{v.matricula}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${v.activo ? ec.color : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {v.activo ? ESTADO_ICON[v.estado] : <CircleOff size={12} />}
                          {v.activo ? ec.label : 'Baja'}
                        </div>
                        {v.activo && activeVehicleIds.has(v.id) && (() => {
                          const isRestricted = v.estado === 'en_mantenimiento' || v.estado === 'baja';
                          return isRestricted ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                              <AlertTriangle size={10} />
                              En curso (restringido)
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              En curso
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 mb-2">
                        <span>{tipoLabel(v.tipo)}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${modalidadCfg(v.modalidad).color}`}>
                          {modalidadCfg(v.modalidad).label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        {v.capacidad_viajeros != null && <span>{v.capacidad_viajeros} plazas</span>}
                        {v.capacidad_carga_kg != null && <span>{v.capacidad_carga_kg} kg carga</span>}
                        {(v.marca || v.anno) && (
                          <><span>·</span><span>{[v.marca, v.anno].filter(Boolean).join(' ')}</span></>
                        )}
                      </div>
                      {v.notas && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{v.notas}</p>}
                      <div className="flex items-center justify-between">
                        {v.activo && canWrite && (
                          <select value={v.estado}
                            onChange={e => handleEstadoChange(v, e.target.value as VehicleEstado)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                            {VEHICLE_ESTADOS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                        {canWrite && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button onClick={() => setEditingVehicle(v)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Edit2 size={15} />
                            </button>
                            {v.activo && (
                              <button onClick={() => setDeactivating(v)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Panel de historial de kilómetros del vehículo */}
      {kmPanelVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Gauge size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{kmPanelVehicle.nombre}</h3>
                  <p className="text-xs text-slate-400 font-mono">{kmPanelVehicle.matricula}</p>
                </div>
              </div>
              <button onClick={() => setKmPanelVehicle(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* km_actual summary */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Odómetro actual</p>
                  {kmPanelVehicle.km_actual != null ? (
                    <p className="text-2xl font-black text-emerald-700">
                      {kmPanelVehicle.km_actual.toLocaleString('es-ES')} <span className="text-base font-semibold text-slate-500">km</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Sin lecturas registradas</p>
                  )}
                  {kmPanelVehicle.km_actualizado_at && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Actualizado: {new Date(kmPanelVehicle.km_actualizado_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <History size={20} className="text-slate-200" />
              </div>
            </div>

            {/* Historial */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Historial de lecturas</p>
              {kmLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Cargando...</span>
                </div>
              ) : kmReadings.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">
                  No hay lecturas registradas para este vehículo
                </p>
              ) : (
                <div className="space-y-2">
                  {kmReadings.map(r => {
                    const TIPO_LABELS: Record<string, string> = {
                      inicio_servicio: 'Inicio de servicio',
                      final_servicio:  'Final de servicio',
                      manual:          'Manual',
                      sustitucion:     'Sustitución odómetro',
                      correccion:      'Corrección',
                    };
                    return (
                      <div key={r.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-sm
                          ${r.anulada ? 'bg-red-50 border-red-100 opacity-60' : 'bg-white border-slate-100'}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${r.anulada ? 'bg-red-400' : 'bg-emerald-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{r.km.toLocaleString('es-ES')} km</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                              {TIPO_LABELS[r.tipo] ?? r.tipo}
                            </span>
                            {r.anulada && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Anulada</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(r.leido_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                          {r.notas && <p className="text-xs text-slate-500 mt-0.5 italic">{r.notas}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end">
              <button onClick={() => setKmPanelVehicle(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg cursor-pointer hover:bg-slate-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVehicle !== undefined && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(undefined)}
          onSaved={handleSaved}
          orgId={orgId}
          showToast={showToast}
        />
      )}

      {deactivating && (
        <ConfirmDeactivateModal
          vehicle={deactivating}
          onClose={() => setDeactivating(null)}
          onConfirm={handleDeactivate}
          loading={deactivateLoading}
        />
      )}
    </div>
  );
}
