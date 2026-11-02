import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, MapPin, Package, ChevronLeft, X, Edit2,
  AlertTriangle, CheckCircle, Clock, Truck,
  Loader2, ArrowRight, Weight, FileText,
} from 'lucide-react';
import {
  TIPO_CARGA_OPTIONS,
  TRIP_ESTADOS,
  TIPO_CARGA_COLORS,
  validateTripInput,
  createTransportTrip,
  updateTransportTrip,
  cancelTransportTrip,
  confirmTransportTrip,
  startTransportTrip,
  completeTransportTrip,
  loadTransportTrips,
  getTripEstadoMeta,
  isTripEditable,
  canConfirmTrip,
  canStartTrip,
  canCompleteTrip,
  canCancelTrip,
} from '../lib/transportTrips';
import type {
  TradeTransportTrip,
  TradeTransportTripInput,
  TripConflictInfo,
  TripEstado,
  TipoCarga,
  TripParteInput,
} from '../lib/transportTrips';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadWorkers } from '../lib/supabase';
import type { TradeWorker } from '../lib/supabase';
// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDT(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = -d.getTimezoneOffset();
  const local = new Date(d.getTime() + off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDT(local: string): string {
  if (!local) return '';
  return new Date(local).toISOString();
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// Vehículos aptos para mercancías
function mercVehicles(vehicles: TradeVehicle[]): TradeVehicle[] {
  return vehicles.filter(v => ['mercancias', 'reparto', 'mixto'].includes(v.modalidad) && v.activo);
}

// Conductores aptos
function conductores(workers: TradeWorker[]): TradeWorker[] {
  return workers.filter(w => (w as TradeWorker & { es_conductor?: boolean }).es_conductor);
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface EstadoBadgeProps { estado: TripEstado }
function EstadoBadge({ estado }: EstadoBadgeProps) {
  const meta = getTripEstadoMeta(estado);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

interface TipoCargaBadgeProps { tipo: TipoCarga }
function TipoCargaBadge({ tipo }: TipoCargaBadgeProps) {
  const label = TIPO_CARGA_OPTIONS.find(t => t.value === tipo)?.label ?? tipo;
  const color = TIPO_CARGA_COLORS[tipo] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${color}`}>
      {label}
    </span>
  );
}

interface ConflictAlertProps { conflicts: TripConflictInfo[] }
function ConflictAlert({ conflicts }: ConflictAlertProps) {
  if (!conflicts.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-amber-800 mb-1">Conflicto de disponibilidad</p>
        {conflicts.map((c, i) => (
          <p key={i} className="text-xs text-amber-700">
            {`${c.tipo === 'vehiculo' ? 'Vehículo' : 'Conductor'} ya asignado en "${c.titulo}" (${fmtDateTime(c.fecha_inicio)})`}
            {c.tabla === 'servicios' && <span className="ml-1 text-amber-600">[servicio de viajeros]</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Formulario de viaje ───────────────────────────────────────────────────────

interface TripFormProps {
  orgId: string;
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  initial?: Partial<TradeTransportTripInput>;
  onSave: (trip: TradeTransportTrip) => void;
  onCancel: () => void;
  editingId?: string;
}

function TripForm({ orgId, vehicles, workers, initial, onSave, onCancel, editingId }: TripFormProps) {
  const [titulo, setTitulo]           = useState(initial?.titulo ?? '');
  const [referencia, setReferencia]   = useState(initial?.referencia ?? '');
  const [origen, setOrigen]           = useState(initial?.origen ?? '');
  const [destino, setDestino]         = useState(initial?.destino ?? '');
  const [fechaInicio, setFechaInicio] = useState(initial?.fecha_inicio ? toLocalDT(initial.fecha_inicio) : '');
  const [fechaFin, setFechaFin]       = useState(initial?.fecha_fin ? toLocalDT(initial.fecha_fin) : '');
  const [vehicleId, setVehicleId]     = useState(initial?.vehicle_id ?? '');
  const [conductorId, setConductorId] = useState(initial?.conductor_id ?? '');
  const [tipoCarga, setTipoCarga]     = useState<TipoCarga>(initial?.tipo_carga ?? 'carga_general');
  const [pesoKg, setPesoKg]           = useState(initial?.peso_kg?.toString() ?? '');
  const [volumenM3, setVolumenM3]     = useState(initial?.volumen_m3?.toString() ?? '');
  const [numBultos, setNumBultos]     = useState(initial?.num_bultos?.toString() ?? '');
  const [precio, setPrecio]           = useState(initial?.precio_acordado?.toString() ?? '');
  const [clienteNombre, setClienteNombre] = useState(initial?.cliente_nombre ?? '');
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const aptVehicles = mercVehicles(vehicles);
  const aptConductores = conductores(workers);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: TradeTransportTripInput = {
      titulo,
      referencia: referencia || null,
      origen,
      destino,
      fecha_inicio: fromLocalDT(fechaInicio),
      fecha_fin: fechaFin ? fromLocalDT(fechaFin) : null,
      vehicle_id: vehicleId || null,
      conductor_id: conductorId || null,
      tipo_carga: tipoCarga,
      peso_kg: pesoKg ? parseFloat(pesoKg) : null,
      volumen_m3: volumenM3 ? parseFloat(volumenM3) : null,
      num_bultos: numBultos ? parseInt(numBultos, 10) : null,
      precio_acordado: precio ? parseFloat(precio) : null,
      cliente_nombre: clienteNombre || null,
      observaciones: observaciones || null,
      estado: initial?.estado ?? 'borrador',
    };

    try {
      validateTripInput(input);
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    setSaving(true);
    try {
      let trip: TradeTransportTrip;
      if (editingId) {
        trip = await updateTransportTrip(editingId, orgId, input);
      } else {
        trip = await createTransportTrip(orgId, input);
      }
      onSave(trip);
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar el viaje');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Descripción del viaje"
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Referencia</label>
          <input
            type="text"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Nº pedido, CMR…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Cliente</label>
          <input
            type="text"
            value={clienteNombre}
            onChange={e => setClienteNombre(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Origen *</label>
          <input
            type="text"
            value={origen}
            onChange={e => setOrigen(e.target.value)}
            placeholder="Ciudad, dirección de recogida"
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Destino *</label>
          <input
            type="text"
            value={destino}
            onChange={e => setDestino(e.target.value)}
            placeholder="Ciudad, dirección de entrega"
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Salida prevista *</label>
          <input
            type="datetime-local"
            value={fechaInicio}
            onChange={e => setFechaInicio(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Llegada prevista</label>
          <input
            type="datetime-local"
            value={fechaFin}
            onChange={e => setFechaFin(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Vehículo</label>
          <select
            value={vehicleId}
            onChange={e => setVehicleId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Sin asignar</option>
            {aptVehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.nombre} — {v.matricula} ({v.modalidad})
              </option>
            ))}
          </select>
          {aptVehicles.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No hay vehículos de mercancías/reparto/mixto activos.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Conductor</label>
          <select
            value={conductorId}
            onChange={e => setConductorId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Sin asignar</option>
            {aptConductores.map(w => (
              <option key={w.id} value={w.id}>{w.nombre}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de carga *</label>
          <select
            value={tipoCarga}
            onChange={e => setTipoCarga(e.target.value as TipoCarga)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {TIPO_CARGA_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Peso (kg)</label>
          <input
            type="number"
            value={pesoKg}
            onChange={e => setPesoKg(e.target.value)}
            placeholder="0"
            min="0"
            max="50000"
            step="0.01"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Volumen (m³)</label>
          <input
            type="number"
            value={volumenM3}
            onChange={e => setVolumenM3(e.target.value)}
            placeholder="0"
            min="0"
            step="0.001"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nº bultos</label>
          <input
            type="number"
            value={numBultos}
            onChange={e => setNumBultos(e.target.value)}
            placeholder="0"
            min="1"
            step="1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Precio acordado (€)</label>
          <input
            type="number"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Instrucciones, condiciones especiales…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editingId ? 'Guardar cambios' : 'Crear viaje'}
        </button>
      </div>
    </form>
  );
}

// ── Modal de cierre (parte real) ──────────────────────────────────────────────

interface ParteModalProps {
  trip: TradeTransportTrip;
  orgId: string;
  onClose: () => void;
  onCompleted: () => void;
}
function ParteModal({ trip, orgId, onClose, onCompleted }: ParteModalProps) {
  const [kmInicio, setKmInicio]   = useState(trip.km_inicio?.toString() ?? '');
  const [kmFin, setKmFin]         = useState(trip.km_fin?.toString() ?? '');
  const [incidencias, setIncidencias]     = useState(trip.incidencias ?? '');
  const [obsCierre, setObsCierre]         = useState(trip.observaciones_cierre ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const parte: TripParteInput = {
      km_inicio:   kmInicio ? parseInt(kmInicio, 10) : null,
      km_fin:      kmFin ? parseInt(kmFin, 10) : null,
      incidencias: incidencias || null,
      observaciones_cierre: obsCierre || null,
    };
    try {
      await completeTransportTrip(trip.id, orgId, parte);
      onCompleted();
    } catch (err) {
      setError((err as Error).message ?? 'Error al cerrar el viaje');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Cerrar viaje — Parte real</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Km inicio</label>
              <input type="number" value={kmInicio} onChange={e => setKmInicio(e.target.value)}
                min="0" placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Km fin</label>
              <input type="number" value={kmFin} onChange={e => setKmFin(e.target.value)}
                min="0" placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Incidencias</label>
            <textarea value={incidencias} onChange={e => setIncidencias(e.target.value)}
              rows={2} placeholder="Ninguna…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones de cierre</label>
            <textarea value={obsCierre} onChange={e => setObsCierre(e.target.value)}
              rows={2} placeholder="Notas finales…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Completar viaje
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Vista de detalle ──────────────────────────────────────────────────────────

interface TripDetailProps {
  trip: TradeTransportTrip;
  orgId: string;
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  onBack: () => void;
  onUpdated: (trip: TradeTransportTrip) => void;
  onDeleted: (id: string) => void;
}

function TripDetail({ trip, orgId, vehicles, workers, onBack, onUpdated, onDeleted }: TripDetailProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting]     = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showParte, setShowParte]   = useState(false);
  const [conflicts, setConflicts]   = useState<TripConflictInfo[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const vehicle   = vehicles.find(v => v.id === trip.vehicle_id);
  const conductor = workers.find(w => w.id === trip.conductor_id);

  async function handleConfirm() {
    setConfirming(true);
    setConflicts([]);
    setActionError(null);
    try {
      const result = await confirmTransportTrip(trip.id, orgId);
      if (result.ok) {
        onUpdated({ ...trip, estado: 'confirmado' });
      } else {
        setConflicts(result.conflictos ?? []);
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    setActionError(null);
    try {
      await startTransportTrip(trip.id, orgId);
      onUpdated({ ...trip, estado: 'en_curso' });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar este viaje?')) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelTransportTrip(trip.id, orgId);
      onDeleted(trip.id);
      onBack();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h3 className="text-sm font-semibold text-slate-800">Editar viaje</h3>
        </div>
        <TripForm
          orgId={orgId}
          vehicles={vehicles}
          workers={workers}
          initial={trip}
          editingId={trip.id}
          onSave={updated => { onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{trip.titulo}</h3>
            {trip.referencia && (
              <p className="text-xs text-slate-500">{trip.referencia}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={trip.estado} />
          {isTripEditable(trip.estado) && (
            <button onClick={() => setEditing(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Ruta */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-600 font-medium">{trip.origen}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-600 font-medium">{trip.destino}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {fmtDateTime(trip.fecha_inicio)}
          </span>
          {trip.fecha_fin && (
            <span>→ {fmtDateTime(trip.fecha_fin)}</span>
          )}
        </div>
      </div>

      {/* Carga */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          <p className="text-amber-600 font-medium mb-1 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" /> Tipo de carga
          </p>
          <TipoCargaBadge tipo={trip.tipo_carga} />
        </div>
        {(trip.peso_kg || trip.volumen_m3 || trip.num_bultos) ? (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-slate-500 font-medium mb-1 flex items-center gap-1">
              <Weight className="w-3.5 h-3.5" /> Dimensiones
            </p>
            <div className="space-y-0.5 text-slate-600">
              {trip.peso_kg && <p>{trip.peso_kg} kg</p>}
              {trip.volumen_m3 && <p>{trip.volumen_m3} m³</p>}
              {trip.num_bultos && <p>{trip.num_bultos} bultos</p>}
            </div>
          </div>
        ) : null}
      </div>

      {/* Recursos */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="border border-slate-100 rounded-lg p-2.5">
          <p className="text-slate-500 font-medium mb-1 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> Vehículo
          </p>
          {vehicle ? (
            <p className="text-slate-700">{vehicle.nombre}<br /><span className="text-slate-400">{vehicle.matricula}</span></p>
          ) : (
            <p className="text-slate-400 italic">Sin asignar</p>
          )}
        </div>
        <div className="border border-slate-100 rounded-lg p-2.5">
          <p className="text-slate-500 font-medium mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Conductor
          </p>
          {conductor ? (
            <p className="text-slate-700">{conductor.nombre}</p>
          ) : (
            <p className="text-slate-400 italic">Sin asignar</p>
          )}
        </div>
      </div>

      {/* Cliente y precio */}
      {(trip.cliente_nombre || trip.precio_acordado) && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {trip.cliente_nombre && (
            <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              Cliente: <span className="font-medium">{trip.cliente_nombre}</span>
            </span>
          )}
          {trip.precio_acordado && (
            <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              Precio: <span className="font-medium">{trip.precio_acordado.toFixed(2)} €</span>
            </span>
          )}
        </div>
      )}

      {trip.observaciones && (
        <p className="text-xs text-slate-500 italic">{trip.observaciones}</p>
      )}

      {/* Parte real (completado) */}
      {trip.estado === 'completado' && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-1 text-xs">
          <p className="text-purple-700 font-semibold mb-2">Parte de cierre</p>
          {trip.km_inicio != null && trip.km_fin != null && (
            <p className="text-purple-600">Km realizados: <span className="font-medium">{(trip.km_fin - trip.km_inicio).toLocaleString()} km</span></p>
          )}
          {trip.incidencias && <p className="text-purple-600">Incidencias: {trip.incidencias}</p>}
          {trip.cerrado_at && <p className="text-purple-500">Cerrado: {fmtDateTime(trip.cerrado_at)}</p>}
        </div>
      )}

      {/* Conflictos */}
      <ConflictAlert conflicts={conflicts} />

      {actionError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{actionError}</p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 pt-1">
        {canConfirmTrip(trip.estado) && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 min-w-[120px] py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirmar
          </button>
        )}
        {canStartTrip(trip.estado) && (
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex-1 min-w-[120px] py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Iniciar
          </button>
        )}
        {canCompleteTrip(trip.estado) && (
          <button
            onClick={() => setShowParte(true)}
            className="flex-1 min-w-[120px] py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Completar
          </button>
        )}
        {canCancelTrip(trip.estado) && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="px-4 py-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancelar viaje'}
          </button>
        )}
      </div>

      {showParte && (
        <ParteModal
          trip={trip}
          orgId={orgId}
          onClose={() => setShowParte(false)}
          onCompleted={() => {
            setShowParte(false);
            onUpdated({ ...trip, estado: 'completado' });
          }}
        />
      )}
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export interface ScreenTransporteViajesProps {
  orgId: string;
}

export default function ScreenTransporteViajes({ orgId }: ScreenTransporteViajesProps) {
  const [trips, setTrips]         = useState<TradeTransportTrip[]>([]);
  const [vehicles, setVehicles]   = useState<TradeVehicle[]>([]);
  const [workers, setWorkers]     = useState<TradeWorker[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<TradeTransportTrip | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [filterEstado, setFilterEstado] = useState<TripEstado | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripsData, vehiclesData, workersData] = await Promise.all([
        loadTransportTrips(orgId, filterEstado ? { estado: filterEstado as TripEstado } : {}),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
      ]);
      setTrips(tripsData);
      setVehicles(vehiclesData);
      setWorkers(workersData);
    } catch (err) {
      setError((err as Error).message ?? 'Error al cargar los viajes');
    } finally {
      setLoading(false);
    }
  }, [orgId, filterEstado]);

  useEffect(() => { load(); }, [load]);

  function handleTripUpdated(updated: TradeTransportTrip) {
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selected?.id === updated.id) setSelected(updated);
  }

  function handleTripDeleted(id: string) {
    setTrips(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function handleTripCreated(trip: TradeTransportTrip) {
    setTrips(prev => [trip, ...prev]);
    setShowForm(false);
    setSelected(trip);
  }

  if (selected) {
    return (
      <div className="p-4">
        <TripDetail
          trip={selected}
          orgId={orgId}
          vehicles={vehicles}
          workers={workers}
          onBack={() => setSelected(null)}
          onUpdated={handleTripUpdated}
          onDeleted={handleTripDeleted}
        />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h3 className="text-sm font-semibold text-slate-800">Nuevo viaje de mercancías</h3>
        </div>
        <TripForm
          orgId={orgId}
          vehicles={vehicles}
          workers={workers}
          onSave={handleTripCreated}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Viajes de mercancías</h2>
          <p className="text-xs text-slate-500">{trips.length} viaje{trips.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo viaje
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as TripEstado | '')}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
        >
          <option value="">Todos los estados</option>
          {TRIP_ESTADOS.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin viajes registrados</p>
          <p className="text-xs mt-1">Crea el primer viaje de mercancías con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map(trip => {
            const vehicle = vehicles.find(v => v.id === trip.vehicle_id);
            const meta = getTripEstadoMeta(trip.estado);
            return (
              <button
                key={trip.id}
                onClick={() => setSelected(trip)}
                className="w-full text-left border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-sm font-medium text-slate-800 truncate">{trip.titulo}</span>
                  <EstadoBadge estado={trip.estado} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{trip.origen}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{trip.destino}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {fmtDate(trip.fecha_inicio)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TipoCargaBadge tipo={trip.tipo_carga} />
                    {vehicle && (
                      <span className="text-xs text-slate-400">{vehicle.matricula}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
