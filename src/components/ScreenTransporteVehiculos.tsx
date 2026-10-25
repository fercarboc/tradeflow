import React, { useState, useEffect, useCallback } from 'react';
import {
  Bus, Plus, X, Edit2, Trash2, Save, AlertCircle,
  CheckCircle2, Wrench, AlertTriangle, CircleOff,
  ChevronDown,
} from 'lucide-react';
import {
  loadVehiclesAll,
  createVehicle,
  updateVehicle,
  deactivateVehicle,
  setVehicleEstado,
  validateMatricula,
  needsPassengerCapacity,
  VEHICLE_TIPOS,
  VEHICLE_ESTADOS,
  VEHICLE_MODALIDADES,
} from '../lib/transport';
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

// ── Modal de formulario — definido a nivel de módulo ─────────────────────────

interface VehicleFormModalProps {
  vehicle: TradeVehicle | null;   // null = crear
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bus size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {vehicle ? 'Editar vehículo' : 'Nuevo vehículo'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nombre del vehículo *
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Bus Escolar 1"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              required
            />
          </div>

          {/* Matrícula */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Matrícula *
            </label>
            <input
              type="text"
              value={form.matricula}
              onChange={e => set('matricula', e.target.value.toUpperCase())}
              placeholder="Ej: 1234-ABC"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
                matriculaError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {matriculaError && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {matriculaError}
              </p>
            )}
          </div>

          {/* Tipo + Modalidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Tipo
              </label>
              <div className="relative">
                <select
                  value={form.tipo}
                  onChange={e => set('tipo', e.target.value as TradeVehicleInput['tipo'])}
                  className="w-full appearance-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white pr-8"
                >
                  {VEHICLE_TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Modalidad *
              </label>
              <div className="relative">
                <select
                  value={form.modalidad}
                  onChange={e => handleModalidadChange(e.target.value as VehicleModalidad)}
                  className="w-full appearance-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white pr-8"
                >
                  {VEHICLE_MODALIDADES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Capacidades — condicionales según modalidad */}
          {(needsPassengerCapacity(form.modalidad) || form.modalidad === 'mercancias' || form.modalidad === 'reparto') && (
            <div className={`grid gap-3 ${
              form.modalidad === 'mixto'
                ? 'grid-cols-2'
                : 'grid-cols-1'
            }`}>
              {needsPassengerCapacity(form.modalidad) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Capacidad de viajeros *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.capacidad_viajeros ?? ''}
                    onChange={e => set('capacidad_viajeros', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    placeholder="Ej: 20"
                  />
                </div>
              )}
              {(form.modalidad === 'mercancias' || form.modalidad === 'reparto' || form.modalidad === 'mixto') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Carga máx. (kg)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    value={form.capacidad_carga_kg ?? ''}
                    onChange={e => set('capacidad_carga_kg', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    placeholder="Ej: 3500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Estado operativo
            </label>
            <div className="relative">
              <select
                value={form.estado}
                onChange={e => set('estado', e.target.value as VehicleEstado)}
                className="w-full appearance-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white pr-8"
              >
                {VEHICLE_ESTADOS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Marca + Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Marca
              </label>
              <input
                type="text"
                value={form.marca ?? ''}
                onChange={e => set('marca', e.target.value || null)}
                placeholder="Ej: Mercedes"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={form.modelo_vehiculo ?? ''}
                onChange={e => set('modelo_vehiculo', e.target.value || null)}
                placeholder="Ej: Sprinter"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Año + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Año
              </label>
              <input
                type="number"
                min={1950}
                max={CURRENT_YEAR + 1}
                value={form.anno ?? ''}
                onChange={e => set('anno', e.target.value ? Number(e.target.value) : null)}
                placeholder={String(CURRENT_YEAR)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Color
              </label>
              <input
                type="text"
                value={form.color ?? ''}
                onChange={e => set('color', e.target.value || null)}
                placeholder="Ej: Blanco"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Notas
            </label>
            <textarea
              value={form.notas ?? ''}
              onChange={e => set('notas', e.target.value || null)}
              rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Guardando…' : vehicle ? 'Guardar cambios' : 'Añadir vehículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de confirmación de baja — definido a nivel de módulo ───────────────

interface ConfirmDeactivateModalProps {
  vehicle: TradeVehicle;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ConfirmDeactivateModal({ vehicle, onClose, onConfirm, loading }: ConfirmDeactivateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Dar de baja</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Esta acción es reversible</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          ¿Dar de baja el vehículo <strong>{vehicle.nombre}</strong> ({vehicle.matricula})?
          Quedará inactivo pero no se eliminará.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
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
  // DB RLS: INSERT/UPDATE solo para owner o admin (vehicles_insert / vehicles_update)
  const canWrite = rol === 'owner' || rol === 'admin';

  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TradeVehicle | null | undefined>(undefined);
  // undefined = modal cerrado, null = crear nuevo, TradeVehicle = editar existente
  const [deactivating, setDeactivating] = useState<TradeVehicle | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadVehiclesAll(orgId);
      setVehicles(data);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => { void load(); }, [load]);

  function handleSaved(v: TradeVehicle) {
    setVehicles(prev => {
      const idx = prev.findIndex(x => x.id === v.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = v;
        return next;
      }
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

  const visible = showInactive ? vehicles : vehicles.filter(v => v.activo);
  const activos  = vehicles.filter(v => v.activo).length;
  const disponibles = vehicles.filter(v => v.activo && v.estado === 'disponible').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Bus size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white">Flota de vehículos</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activos} activo{activos !== 1 ? 's' : ''} · {disponibles} disponible{disponibles !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {canWrite && (
            <button
              onClick={() => setEditingVehicle(null)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo vehículo</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Filtro inactivos */}
        {vehicles.some(v => !v.activo) && (
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setShowInactive(s => !s)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
            >
              <span className={`w-3 h-3 rounded border ${showInactive ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`} />
              Mostrar vehículos dados de baja
            </button>
          </div>
        )}

        {/* Estado de carga */}
        {loading && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
            Cargando flota…
          </div>
        )}

        {/* Lista vacía */}
        {!loading && visible.length === 0 && (
          <div className="text-center py-20">
            <Bus size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {showInactive ? 'No hay vehículos registrados' : 'No hay vehículos activos'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Añade tu primer vehículo para empezar a gestionar la flota
            </p>
            {canWrite && (
            <button
              onClick={() => setEditingVehicle(null)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} /> Añadir vehículo
            </button>
            )}
          </div>
        )}

        {/* Tabla desktop */}
        {!loading && visible.length > 0 && (
          <>
            {/* Desktop */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vehículo</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Matrícula</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tipo / Modalidad</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">Capacidad</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visible.map(v => {
                    const ec = estadoCfg(v.estado);
                    return (
                      <tr key={v.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!v.activo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{v.nombre}</div>
                          {(v.marca || v.modelo_vehiculo) && (
                            <div className="text-xs text-gray-400">{[v.marca, v.modelo_vehiculo].filter(Boolean).join(' ')}{v.anno ? ` · ${v.anno}` : ''}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{v.matricula}</td>
                        <td className="px-4 py-3">
                          <div className="text-gray-600 dark:text-gray-400 text-sm">{tipoLabel(v.tipo)}</div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border mt-0.5 ${modalidadCfg(v.modalidad).color}`}>
                            {modalidadCfg(v.modalidad).label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 text-xs space-y-0.5">
                          {v.capacidad_viajeros != null && (
                            <div className="font-medium">{v.capacidad_viajeros} plz.</div>
                          )}
                          {v.capacidad_carga_kg != null && (
                            <div className="text-gray-500">{v.capacidad_carga_kg} kg</div>
                          )}
                          {v.capacidad_viajeros == null && v.capacidad_carga_kg == null && (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {v.activo ? (
                            canWrite ? (
                            <div className="relative group">
                              <button className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${ec.color}`}>
                                {ESTADO_ICON[v.estado]}
                                {ec.label}
                                <ChevronDown size={10} />
                              </button>
                              {/* Dropdown de estado */}
                              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 hidden group-hover:block min-w-[160px]">
                                {VEHICLE_ESTADOS.map(s => (
                                  <button
                                    key={s.value}
                                    onClick={() => handleEstadoChange(v, s.value)}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${v.estado === s.value ? 'font-semibold' : ''}`}
                                  >
                                    {ESTADO_ICON[s.value]}
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${ec.color}`}>
                                {ESTADO_ICON[v.estado]}{ec.label}
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                              <CircleOff size={12} /> Baja
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canWrite && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setEditingVehicle(v)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            {v.activo && (
                              <button
                                onClick={() => setDeactivating(v)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                title="Dar de baja"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          )}
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
                  <div key={v.id} className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${!v.activo ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{v.nombre}</div>
                        <div className="text-xs text-gray-500 font-mono">{v.matricula}</div>
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${v.activo ? ec.color : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {v.activo ? ESTADO_ICON[v.estado] : <CircleOff size={12} />}
                        {v.activo ? ec.label : 'Baja'}
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span>{tipoLabel(v.tipo)}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${modalidadCfg(v.modalidad).color}`}>
                        {modalidadCfg(v.modalidad).label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {v.capacidad_viajeros != null && <span>{v.capacidad_viajeros} plazas</span>}
                      {v.capacidad_carga_kg != null && <span>{v.capacidad_carga_kg} kg carga</span>}
                      {(v.marca || v.anno) && (
                        <>
                          {(v.capacidad_viajeros != null || v.capacidad_carga_kg != null) && <span>·</span>}
                          <span>{[v.marca, v.anno].filter(Boolean).join(' ')}</span>
                        </>
                      )}
                    </div>
                    {v.notas && (
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{v.notas}</p>
                    )}
                    <div className="flex items-center justify-between">
                      {v.activo && canWrite && (
                        <select
                          value={v.estado}
                          onChange={e => handleEstadoChange(v, e.target.value as VehicleEstado)}
                          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 dark:bg-gray-800 dark:text-white"
                        >
                          {VEHICLE_ESTADOS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                      {canWrite && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => setEditingVehicle(v)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          <Edit2 size={15} />
                        </button>
                        {v.activo && (
                          <button
                            onClick={() => setDeactivating(v)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
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
