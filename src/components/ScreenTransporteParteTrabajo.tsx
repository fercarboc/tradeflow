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
import { phoneHref, locationToAddress, hasAddress, hasContact, TIPO_OPERACION_OPTIONS } from '../lib/transportLocations';
import { calcOdoEstimado, calcDistanciaOdo, validateOdometroFinal, fmtKm, resolveOdometroFinal } from '../lib/odometroUtils';
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
  const [odoFinal,      setOdoFinal]      = useState('');
  const [incidencias,   setIncidencias]   = useState('');
  const [obscierre,     setObscierre]     = useState('');
  const [odoConfirmado, setOdoConfirmado] = useState(false);

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
        if (s.km_reales != null)    setKm(String(s.km_reales));
        if (s.odometro_final != null) setOdoFinal(String(s.odometro_final));
        if (s.incidencias)          setIncidencias(s.incidencias);
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
    const odoErrMsg = validateOdometroFinal(svc?.odometro_inicio, odoFinal);
    if (odoErrMsg) return odoErrMsg;
    return null;
  }

  function handleKmChange(val: string) {
    setKm(val);
    // km changes update the estimate display only — never overwrite a confirmed reading
  }

  function handleOdoFinalChange(val: string) {
    setOdoFinal(val);
    setOdoConfirmado(false);
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
        odometro_final:      resolveOdometroFinal(odoFinal, odoConfirmado),
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

  const estimado      = calcOdoEstimado(svc.odometro_inicio, km);
  const distanciaOdo  = calcDistanciaOdo(svc.odometro_inicio, odoFinal);
  const odoErr        = validateOdometroFinal(svc.odometro_inicio, odoFinal);
  const estadoCfg     = SERVICIO_ESTADOS.find(e => e.value === svc.estado);
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
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 leading-tight truncate">
              Parte de servicio
            </h1>
            <p className="text-xs text-slate-400 truncate">{svc.titulo}</p>
          </div>
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
            {(svc.origen_detalle || svc.origen) && (
              <InfoRow icon={<MapPin />} label="Origen"
                value={hasAddress(svc.origen_detalle) ? locationToAddress(svc.origen_detalle) : (svc.origen ?? '')} />
            )}
            {(svc.destino_detalle || svc.destino) && (
              <InfoRow icon={<ChevronRight />} label="Destino"
                value={hasAddress(svc.destino_detalle) ? locationToAddress(svc.destino_detalle) : (svc.destino ?? '')} />
            )}
            {svc.instrucciones_conductor && (
              <InfoRow icon={<FileText />} label="Instrucciones conductor" value={svc.instrucciones_conductor} />
            )}
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
              <ol className="space-y-3 pl-3 border-l-2 border-slate-200">
                {svc.paradas.map((p, i) => {
                  const tipoLabel = TIPO_OPERACION_OPTIONS.find(t => t.value === p.tipo_operacion)?.label;
                  const addr = hasAddress(p.location) ? locationToAddress(p.location) : p.direccion;
                  const tel = p.contacto?.telefono ? phoneHref(p.contacto.telefono) : null;
                  return (
                    <li key={i} className="text-sm text-slate-600 space-y-0.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {p.hora && <span className="font-mono text-slate-400">{p.hora}</span>}
                        <span className="font-medium text-slate-800">{p.nombre}</span>
                        {tipoLabel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{tipoLabel}</span>
                        )}
                      </div>
                      {addr && <p className="text-xs text-slate-400 pl-0.5">{addr}</p>}
                      {hasContact(p.contacto) && (
                        <div className="text-xs text-slate-500 pl-0.5 flex items-center gap-1.5 flex-wrap">
                          {p.contacto?.nombre && <span>{p.contacto.nombre}</span>}
                          {tel ? (
                            <a href={tel} className="font-semibold text-blue-600 hover:underline">
                              {p.contacto!.telefono}
                            </a>
                          ) : p.contacto?.telefono && (
                            <span>{p.contacto.telefono}</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Contacto principal del servicio */}
          {hasContact(svc.contacto_principal) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Contacto del servicio</h2>
              <div className="space-y-1">
                {svc.contacto_principal?.nombre && (
                  <p className="text-sm font-semibold text-slate-800">{svc.contacto_principal.nombre}</p>
                )}
                {svc.contacto_principal?.organizacion && (
                  <p className="text-xs text-slate-500">{svc.contacto_principal.organizacion}</p>
                )}
                {svc.contacto_principal?.telefono && (() => {
                  const href = phoneHref(svc.contacto_principal.telefono);
                  return href ? (
                    <a href={href}
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      Llamar: {svc.contacto_principal.telefono}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-700">{svc.contacto_principal.telefono}</p>
                  );
                })()}
                {svc.contacto_principal?.telefono_alt && (
                  <p className="text-xs text-slate-500">Alt: {svc.contacto_principal.telefono_alt}</p>
                )}
                {svc.contacto_principal?.observaciones && (
                  <p className="text-xs text-slate-400 mt-1 italic">{svc.contacto_principal.observaciones}</p>
                )}
              </div>
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
                  label="Km recorridos"
                  previsto="—"
                  real={svc.km_reales != null ? `${svc.km_reales} km` : '—'}
                />
                {(svc.odometro_inicio != null || svc.odometro_final != null) && (
                  <DiffRow
                    label="Odómetro"
                    previsto={svc.odometro_inicio != null ? `Inicio: ${svc.odometro_inicio.toLocaleString()} km` : '—'}
                    real={svc.odometro_final != null
                      ? `${svc.odometro_final.toLocaleString()} km${svc.odometro_recorridos != null ? ` (+${svc.odometro_recorridos})` : ''}`
                      : '—'
                    }
                  />
                )}
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

                {svc.odometro_inicio != null ? (
                  /* ── Cuentakilómetros del vehículo (con lectura inicial) ─── */
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                    <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-wide">
                      Cuentakilómetros del vehículo
                    </h3>

                    {/* Km comerciales declarados */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Km recorridos <span className="font-normal normal-case text-slate-400">(comercial)</span>
                      </label>
                      <input
                        type="number" min="0" step="0.1" placeholder="0.0"
                        value={km} onChange={e => handleKmChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Inicio / Estimado */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Cuentakilómetros al salir
                        </p>
                        <p className="text-sm font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">
                          {fmtKm(svc.odometro_inicio)} km
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                          Estimado al llegar
                        </p>
                        <p className={`text-sm font-mono rounded-lg px-3 py-2 border ${
                          estimado != null
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : 'text-slate-400 bg-white border-slate-200'
                        }`}>
                          {estimado != null ? `${fmtKm(estimado)} km` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Lectura real al llegar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Lectura real al llegar
                        </label>
                        {estimado != null && !odoConfirmado && (
                          <button
                            type="button"
                            onClick={() => setOdoFinal(String(estimado))}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold hover:underline shrink-0 ml-2"
                          >
                            Usar estimación ({fmtKm(estimado)} km)
                          </button>
                        )}
                        {odoConfirmado && (
                          <button
                            type="button"
                            onClick={() => setOdoConfirmado(false)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 underline shrink-0 ml-2"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                      <input
                        type="number" min="0" step="1"
                        placeholder={`Ej. ${fmtKm(svc.odometro_inicio + 120)}`}
                        value={odoFinal}
                        readOnly={odoConfirmado}
                        onChange={e => handleOdoFinalChange(e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          odoConfirmado
                            ? 'bg-emerald-50 border-emerald-300 cursor-default'
                            : odoErr
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      />
                      {odoFinal.trim() !== '' && !odoErr && !odoConfirmado && (
                        <label className="flex items-start gap-2 mt-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={odoConfirmado}
                            onChange={e => setOdoConfirmado(e.target.checked)}
                            className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0"
                          />
                          <span className="text-[11px] text-slate-600 leading-snug">
                            Confirmo que <span className="font-semibold">{fmtKm(parseInt(odoFinal, 10))} km</span> es la lectura real del cuentakilómetros
                          </span>
                        </label>
                      )}
                      {odoConfirmado && (
                        <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1 font-semibold">
                          <CheckCircle className="w-3 h-3 shrink-0" />
                          Lectura confirmada — se registrará en Flota
                        </p>
                      )}
                      {odoErr && (
                        <p className="text-[10px] text-red-600 mt-1 flex items-start gap-1">
                          <span>⚠</span><span>{odoErr}</span>
                        </p>
                      )}
                      {!odoFinal.trim() && !odoErr && (
                        <p className="text-[10px] text-amber-600 mt-1">
                          Sin lectura: el cuentakilómetros del vehículo no se actualizará en Flota.
                        </p>
                      )}
                    </div>

                    {/* Diferencia por odómetro */}
                    {distanciaOdo != null && (
                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Diferencia por odómetro
                        </span>
                        <span className={`text-sm font-bold font-mono ${distanciaOdo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {distanciaOdo >= 0 ? '+' : ''}{fmtKm(distanciaOdo)} km
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Cuentakilómetros del vehículo (sin lectura inicial) ─── */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Km recorridos <span className="font-normal normal-case text-slate-400">(comercial)</span>
                      </label>
                      <input
                        type="number" min="0" step="0.1" placeholder="0.0"
                        value={km} onChange={e => handleKmChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Lectura del cuentakilómetros <span className="font-normal normal-case text-slate-400">(opcional)</span>
                      </label>
                      <input
                        type="number" min="0" step="1" placeholder="Ej. 124850"
                        value={odoFinal} onChange={e => handleOdoFinalChange(e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          odoErr ? 'border-red-300 bg-red-50' : 'border-slate-200'
                        }`}
                      />
                      {odoErr && (
                        <p className="text-[10px] text-red-600 mt-1">{odoErr}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        Sin lectura inicial registrada. Se guardará como lectura de cierre.
                      </p>
                    </div>
                  </div>
                )}

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
