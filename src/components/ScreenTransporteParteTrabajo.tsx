import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle, Clock, MapPin, Users, Bus,
  AlertTriangle, Loader2, FileText, Euro, Calendar,
  ChevronRight,
} from 'lucide-react';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_OPTIONS,
  loadServiceById, completeTransportService,
} from '../lib/transportServices';
import type { TradeTransportService, TradeTransportParteInput } from '../lib/transportServices';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeWorker, TradeClient } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function toLocalDT(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fromLocalDT(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-300 mt-0.5 shrink-0 w-4 h-4">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Diff row (previsto vs real) ───────────────────────────────────────────────

function DiffRow({ label, previsto, real }: { label: string; previsto: React.ReactNode; real: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-50 last:border-0 items-start">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-xs text-slate-600">{previsto}</p>
      <p className="text-xs font-semibold text-slate-800">{real}</p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  serviceId: string;
  onClose: (refreshed?: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransporteParteTrabajo({ orgId, serviceId, onClose, showToast }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [svc,        setSvc]        = useState<TradeTransportService | null>(null);
  const [vehicle,    setVehicle]    = useState<TradeVehicle | null>(null);
  const [conductor,  setConductor]  = useState<TradeWorker | null>(null);
  const [client,     setClient]     = useState<string | null>(null);

  // Parte form state
  const [horaSalida,    setHoraSalida]    = useState('');
  const [horaLlegada,   setHoraLlegada]   = useState('');
  const [km,            setKm]            = useState('');
  const [incidencias,   setIncidencias]   = useState('');
  const [obscierre,     setObscierre]     = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, vehs, wrks, clients] = await Promise.all([
          loadServiceById(serviceId, orgId),
          loadVehiclesAll(orgId),
          loadWorkers(orgId),
          loadClients(orgId),
        ]);
        if (!s) { setError('Servicio no encontrado'); setLoading(false); return; }
        setSvc(s);

        if (s.vehicle_id)   setVehicle(vehs.find(v => v.id === s.vehicle_id) ?? null);
        if (s.conductor_id) setConductor(wrks.find(w => w.id === s.conductor_id) ?? null);
        const foundClient = (clients as TradeClient[]).find(c => c.id === s.client_id);
        if (s.client_id && foundClient) setClient(getClientDisplayName(foundClient));

        // Pre-fill parte fields if already partially set (e.g. re-opening)
        if (s.hora_real_salida)  setHoraSalida(toLocalDT(s.hora_real_salida));
        if (s.hora_real_llegada) setHoraLlegada(toLocalDT(s.hora_real_llegada));
        if (s.km_reales != null) setKm(String(s.km_reales));
        if (s.incidencias)       setIncidencias(s.incidencias);
        if (s.observaciones_cierre) setObscierre(s.observaciones_cierre);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [serviceId, orgId]);

  // ── Validate form ─────────────────────────────────────────────────────────

  function validateForm(): string | null {
    const kmNum = km.trim() === '' ? null : parseFloat(km);
    if (kmNum !== null && (isNaN(kmNum) || kmNum < 0)) {
      return 'Los kilómetros deben ser un número positivo';
    }
    const sal = horaSalida ? fromLocalDT(horaSalida) : null;
    const lle = horaLlegada ? fromLocalDT(horaLlegada) : null;
    if (sal && lle && new Date(lle) <= new Date(sal)) {
      return 'La hora de llegada debe ser posterior a la hora de salida';
    }
    return null;
  }

  // ── Submit (close service) ─────────────────────────────────────────────────

  const handleClose = async () => {
    const err = validateForm();
    if (err) { showToast(err, 'error'); return; }

    setSubmitting(true);
    try {
      const parte: TradeTransportParteInput = {
        hora_real_salida:    horaSalida  ? fromLocalDT(horaSalida)  : null,
        hora_real_llegada:   horaLlegada ? fromLocalDT(horaLlegada) : null,
        km_reales:           km.trim() !== '' ? parseFloat(km) : null,
        incidencias:         incidencias.trim() || null,
        observaciones_cierre: obscierre.trim() || null,
      };
      await completeTransportService(serviceId, orgId, parte);
      showToast('Servicio cerrado correctamente', 'success');
      onClose(true);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando parte...</span>
      </div>
    );
  }

  if (error || !svc) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm">{error ?? 'Servicio no encontrado'}</p>
        <button onClick={() => onClose(false)} className="text-sm text-blue-600 hover:underline">Volver</button>
      </div>
    );
  }

  const estadoCfg   = SERVICIO_ESTADOS.find(e => e.value === svc.estado);
  const tipoLabel   = TIPO_SERVICIO_OPTIONS.find(t => t.value === svc.tipo_servicio)?.label ?? svc.tipo_servicio;
  const isEnCurso   = svc.estado === 'en_curso';
  const isCompletado = svc.estado === 'completado';
  const canClose    = isEnCurso;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onClose(false)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Servicios
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate">
            Parte de servicio
          </h1>
          <p className="text-xs text-slate-400 truncate">{svc.titulo}</p>
        </div>
        <div className="ml-auto shrink-0">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${estadoCfg?.color ?? ''}`}>
            {isEnCurso && <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
            {estadoCfg?.label ?? svc.estado}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Columna izquierda: datos previstos ─────────────────────────── */}
        <div className="space-y-4">

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
              Datos previstos del servicio
            </h2>
            <InfoRow icon={<FileText />}      label="Tipo"      value={tipoLabel} />
            {client && <InfoRow icon={<Users />} label="Cliente" value={client} />}
            <InfoRow icon={<Calendar />} label="Inicio previsto" value={fmtDT(svc.fecha_inicio)} />
            {svc.fecha_fin && <InfoRow icon={<Calendar />} label="Fin previsto" value={fmtDT(svc.fecha_fin)} />}
            {svc.origen  && <InfoRow icon={<MapPin />} label="Origen"  value={svc.origen} />}
            {svc.destino && <InfoRow icon={<ChevronRight />} label="Destino" value={svc.destino} />}
            {svc.num_viajeros != null && (
              <InfoRow icon={<Users />} label="Viajeros previstos" value={`${svc.num_viajeros} personas`} />
            )}
            {vehicle && (
              <InfoRow icon={<Bus />} label="Vehículo asignado"
                value={`${vehicle.nombre} (${vehicle.matricula})`} />
            )}
            {conductor && (
              <InfoRow icon={<Users />} label="Conductor asignado" value={conductor.nombre} />
            )}
            {svc.precio_acordado != null && (
              <InfoRow icon={<Euro />} label="Precio acordado"
                value={svc.precio_acordado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
            )}
            {svc.observaciones && (
              <InfoRow icon={<FileText />} label="Observaciones" value={svc.observaciones} />
            )}
          </div>

          {svc.paradas.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Paradas previstas</h2>
              <ol className="space-y-2 pl-3 border-l-2 border-slate-200">
                {svc.paradas.map((p, i) => (
                  <li key={i} className="text-sm text-slate-600">
                    {p.hora && <span className="font-mono text-slate-400 mr-1.5">{p.hora}</span>}
                    {p.nombre}
                    {p.direccion && <span className="text-slate-400 ml-1">· {p.direccion}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── Columna derecha: parte real ────────────────────────────────── */}
        <div className="space-y-4">

          {/* Datos reales — formulario (en_curso) o visualización (completado) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
              Datos reales de ejecución
            </h2>

            {isCompletado ? (
              // Read-only view
              <div>
                <DiffRow label="" previsto="Previsto" real="Real" />
                <DiffRow
                  label="Salida"
                  previsto={fmtDT(svc.fecha_inicio)}
                  real={fmtDT(svc.hora_real_salida)}
                />
                <DiffRow
                  label="Llegada"
                  previsto={fmtDT(svc.fecha_fin)}
                  real={fmtDT(svc.hora_real_llegada)}
                />
                <DiffRow
                  label="Kilómetros"
                  previsto="—"
                  real={svc.km_reales != null ? `${svc.km_reales} km` : '—'}
                />
                {svc.incidencias && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Incidencias</p>
                    <p className="text-sm text-amber-800">{svc.incidencias}</p>
                  </div>
                )}
                {svc.observaciones_cierre && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Observaciones de cierre</p>
                    <p className="text-sm text-slate-700">{svc.observaciones_cierre}</p>
                  </div>
                )}
              </div>
            ) : isEnCurso ? (
              // Editable form for closure
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Hora real de salida
                    </label>
                    <input
                      type="datetime-local"
                      value={horaSalida}
                      onChange={e => setHoraSalida(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Hora real de llegada
                    </label>
                    <input
                      type="datetime-local"
                      value={horaLlegada}
                      onChange={e => setHoraLlegada(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Kilómetros recorridos
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.0"
                    value={km}
                    onChange={e => setKm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Incidencias <span className="font-normal normal-case text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe incidencias ocurridas durante el servicio..."
                    value={incidencias}
                    onChange={e => setIncidencias(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Observaciones finales <span className="font-normal normal-case text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Cualquier observación relevante para el registro..."
                    value={obscierre}
                    onChange={e => setObscierre(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                El servicio está en estado {estadoCfg?.label ?? svc.estado} — no hay parte disponible.
              </p>
            )}
          </div>

          {/* Cierre info (completado) */}
          {isCompletado && svc.cerrado_at && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Servicio cerrado</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Cierre registrado el {fmtDT(svc.cerrado_at)}
                </p>
              </div>
            </div>
          )}

          {/* Firma diferida */}
          {(isEnCurso || isCompletado) && (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-4 flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-600">Firma del cliente</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  La recogida de firma requiere almacenamiento privado. Disponible en la próxima versión.
                </p>
              </div>
            </div>
          )}

          {/* Action button */}
          {canClose && (
            <button
              onClick={handleClose}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-2xl shadow-sm cursor-pointer transition-colors disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cerrando servicio…</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Cerrar y registrar parte</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
