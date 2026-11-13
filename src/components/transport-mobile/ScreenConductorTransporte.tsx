/**
 * TX-CIERRE-1 — Vista del conductor (rol «tecnico» en una empresa de transporte).
 * Muestra sus viajes de mercancías y sus servicios de viajeros asignados y le
 * deja: empezar (con km del cuentakilómetros), marcar recogidas y entregas con
 * prueba de entrega, registrar incidencias, enseñar el DeCA u hoja de ruta en
 * un control y terminar con el parte.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Truck, Bus, MapPin, Navigation, Play, Flag, Loader2, Package, CheckCircle2, AlertTriangle,
  FileText, ChevronDown, ChevronUp, RefreshCw, Gauge,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  startTransportTrip, completeTransportTrip, type TradeTransportTrip,
} from '../../lib/transportTrips';
import {
  startTransportService, completeTransportService, type TradeTransportService,
} from '../../lib/transportServices';
import {
  loadShipments, markPicked, markIncident, shipmentEstadoMeta, canPick, canDeliver,
  type TradeTransportShipment,
} from '../../lib/transportShipments';
import { loadVehiclesAll, type TradeVehicle } from '../../lib/transport';
import { publicDocUrl } from '../../lib/transportDocs';
import { DeliveryProofForm } from '../transport-shipments/DeliveryProof';

type Toast = (msg: string, type?: 'success' | 'error' | 'info') => void;

type Trabajo =
  | { kind: 'trip'; id: string; fecha: string; estado: string; titulo: string; origen: string; destino: string; vehicle_id: string | null; odometro_inicio: number | null; row: TradeTransportTrip }
  | { kind: 'service'; id: string; fecha: string; estado: string; titulo: string; origen: string; destino: string; vehicle_id: string | null; odometro_inicio: number | null; row: TradeTransportService };

interface ControlDocLite { id: string; numero: string; tipo: string; public_token: string; trip_id: string | null; service_id: string | null }

const ESTADO_LABEL: Record<string, string> = {
  confirmado: 'Por empezar', en_curso: 'En curso', completado: 'Terminado', borrador: 'Pendiente de confirmar', cancelado: 'Cancelado',
};

const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none';

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function mapsUrl(destino: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
  .replace(/^TRANSPORT_[A-Z_]+:\s*/, '');

export default function ScreenConductorTransporte({ orgId, workerId, nombre, showToast }: {
  orgId: string;
  workerId: string | null;
  nombre?: string | null;
  showToast: Toast;
}) {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [docs, setDocs] = useState<ControlDocLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verTerminados, setVerTerminados] = useState(false);

  const load = useCallback(async () => {
    if (!workerId) { setLoading(false); return; }
    setLoading(true);
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - 1); desde.setHours(0, 0, 0, 0);
      const hasta = new Date(); hasta.setDate(hasta.getDate() + 14);
      const [tr, sv, ve] = await Promise.all([
        supabase.from('trade_transport_trips').select('*').eq('org_id', orgId).eq('conductor_id', workerId)
          .in('estado', ['confirmado', 'en_curso', 'completado'])
          .lte('fecha_inicio', hasta.toISOString()).order('fecha_inicio'),
        supabase.from('trade_transport_services').select('*').eq('org_id', orgId).eq('conductor_id', workerId)
          .in('estado', ['confirmado', 'en_curso', 'completado'])
          .lte('fecha_inicio', hasta.toISOString()).order('fecha_inicio'),
        loadVehiclesAll(orgId).catch(() => [] as TradeVehicle[]),
      ]);
      const viajes = ((tr.data ?? []) as TradeTransportTrip[])
        .filter(t => t.estado !== 'completado' || (t.cerrado_at ?? t.fecha_inicio) >= desde.toISOString());
      const servicios = ((sv.data ?? []) as TradeTransportService[])
        .filter(s => s.estado !== 'completado' || (s.cerrado_at ?? s.fecha_inicio) >= desde.toISOString());
      const lista: Trabajo[] = [
        ...viajes.map(t => ({ kind: 'trip' as const, id: t.id, fecha: t.fecha_inicio, estado: t.estado, titulo: t.titulo, origen: t.origen, destino: t.destino, vehicle_id: t.vehicle_id ?? null, odometro_inicio: t.odometro_inicio ?? null, row: t })),
        ...servicios.map(s => ({ kind: 'service' as const, id: s.id, fecha: s.fecha_inicio, estado: s.estado, titulo: s.titulo, origen: s.origen ?? '', destino: s.destino ?? '', vehicle_id: s.vehicle_id ?? null, odometro_inicio: s.odometro_inicio ?? null, row: s })),
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));
      setTrabajos(lista);
      setVehicles(ve);
      const tripIds = viajes.map(t => t.id); const svcIds = servicios.map(s => s.id);
      const dq = await supabase.from('trade_transport_control_docs').select('id, numero, tipo, public_token, trip_id, service_id')
        .eq('org_id', orgId).eq('estado', 'vigente')
        .or([tripIds.length ? `trip_id.in.(${tripIds.join(',')})` : '', svcIds.length ? `service_id.in.(${svcIds.join(',')})` : ''].filter(Boolean).join(',') || 'id.is.null');
      setDocs((dq.data ?? []) as ControlDocLite[]);
      setAbierto(prev => prev ?? lista.find(x => x.estado === 'en_curso')?.id ?? lista.find(x => x.estado === 'confirmado')?.id ?? null);
    } catch (e) {
      showToast(errMsg(e) || 'No se pudieron cargar tus trabajos', 'error');
    } finally { setLoading(false); }
  }, [orgId, workerId, showToast]);

  useEffect(() => { load(); }, [load]);

  const activos = useMemo(() => trabajos.filter(t => t.estado !== 'completado'), [trabajos]);
  const terminados = useMemo(() => trabajos.filter(t => t.estado === 'completado'), [trabajos]);

  if (!workerId) {
    return (
      <div className="p-6 text-center text-gray-600">
        <Truck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="font-bold text-gray-900">Tu usuario no está vinculado a una ficha de conductor</p>
        <p className="mt-1 text-sm">Pide a la oficina que te asocie a tu ficha en Conductores para ver tus viajes.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-black text-gray-900">Mis viajes</p>
          <p className="text-sm text-gray-500">{nombre ? `${nombre} · ` : ''}hoy y próximos 14 días</p>
        </div>
        <button type="button" onClick={load} aria-label="Actualizar" className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600">
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && trabajos.length === 0 ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : activos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          <CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-emerald-500" />
          <p className="font-semibold text-gray-800">No tienes viajes pendientes</p>
          <p className="text-sm">Cuando la oficina te asigne uno aparecerá aquí.</p>
        </div>
      ) : (
        activos.map(t => (
          <TrabajoCard key={`${t.kind}-${t.id}`} t={t} orgId={orgId}
            vehicle={vehicles.find(v => v.id === t.vehicle_id) ?? null}
            docs={docs.filter(d => (t.kind === 'trip' ? d.trip_id : d.service_id) === t.id)}
            abierto={abierto === t.id} onToggle={() => setAbierto(abierto === t.id ? null : t.id)}
            onChanged={load} showToast={showToast} />
        ))
      )}

      {terminados.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerTerminados(v => !v)} className="flex w-full items-center justify-between py-2 text-sm font-bold text-gray-600">
            Terminados ({terminados.length}) {verTerminados ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {verTerminados && terminados.map(t => (
            <div key={`${t.kind}-${t.id}`} className="mb-2 rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">{t.titulo}</p>
              <p>{fmtDia(t.fecha)} · Terminado</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrabajoCard({ t, orgId, vehicle, docs, abierto, onToggle, onChanged, showToast }: {
  t: Trabajo; orgId: string; vehicle: TradeVehicle | null; docs: ControlDocLite[];
  abierto: boolean; onToggle: () => void; onChanged: () => void; showToast: Toast;
}) {
  const [accion, setAccion] = useState<null | 'empezar' | 'terminar'>(null);
  const [km, setKm] = useState('');
  const [incidencias, setIncidencias] = useState('');
  const [busy, setBusy] = useState(false);
  const Icono = t.kind === 'trip' ? Truck : Bus;
  const tono = t.kind === 'trip' ? 'text-amber-600' : 'text-blue-600';

  const empezar = async () => {
    const odo = km.trim() ? parseInt(km.replace(/\D/g, ''), 10) : null;
    setBusy(true);
    try {
      if (t.kind === 'trip') await startTransportTrip(t.id, orgId, odo);
      else await startTransportService(t.id, orgId, { odometro_inicio: odo, hora_inicio_real: new Date().toISOString() });
      showToast('¡Buen viaje! Trabajo empezado', 'success');
      setAccion(null); setKm(''); onChanged();
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const terminar = async () => {
    const odo = km.trim() ? parseInt(km.replace(/\D/g, ''), 10) : null;
    if (odo != null && t.odometro_inicio != null && odo < t.odometro_inicio) {
      showToast(`Los km de llegada no pueden ser menores que los de salida (${t.odometro_inicio})`, 'error'); return;
    }
    setBusy(true);
    try {
      const ahora = new Date().toISOString();
      if (t.kind === 'trip') {
        await completeTransportTrip(t.id, orgId, {
          hora_real_llegada: ahora,
          ...(odo != null ? { odometro_final: odo, km_fin: odo, ...(t.odometro_inicio != null ? { km_inicio: t.odometro_inicio } : {}) } : {}),
          ...(incidencias.trim() ? { incidencias: incidencias.trim() } : {}),
        });
      } else {
        await completeTransportService(t.id, orgId, {
          hora_real_llegada: ahora,
          odometro_final: odo,
          km_reales: odo != null && t.odometro_inicio != null ? odo - t.odometro_inicio : null,
          incidencias: incidencias.trim() || null,
        });
      }
      showToast('Trabajo terminado. Parte enviado a la oficina', 'success');
      setAccion(null); setKm(''); setIncidencias(''); onChanged();
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${t.estado === 'en_curso' ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-gray-200'}`}>
      <button type="button" onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center gap-2">
          <Icono className={`h-5 w-5 ${tono}`} />
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.estado === 'en_curso' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{ESTADO_LABEL[t.estado] ?? t.estado}</span>
          <span className="ml-auto text-sm font-semibold text-gray-600">{fmtDia(t.fecha)}</span>
        </div>
        <p className="mt-1.5 text-lg font-bold text-gray-900">{t.titulo}</p>
        {(t.origen || t.destino) && <p className="text-gray-600">{t.origen}{t.destino ? ` → ${t.destino}` : ''}</p>}
        {vehicle && <p className="mt-0.5 text-sm text-gray-500">{vehicle.nombre} · <span className="font-mono">{vehicle.matricula}</span></p>}
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-gray-100 p-4">
          <div className="grid grid-cols-2 gap-2">
            {t.destino && (
              <a href={mapsUrl(t.estado === 'en_curso' ? t.destino : (t.origen || t.destino))} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-blue-200 py-3 font-bold text-blue-800">
                <Navigation className="h-5 w-5" /> Cómo llegar
              </a>
            )}
            {docs.map(d => (
              <a key={d.id} href={publicDocUrl(d.public_token)} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-300 py-3 font-bold text-amber-900">
                <FileText className="h-5 w-5" /> {d.tipo === 'deca' ? 'DeCA' : 'Hoja de ruta'}
              </a>
            ))}
          </div>
          {docs.length === 0 && (
            <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Sin {t.kind === 'trip' ? 'DeCA' : 'hoja de ruta'} emitido todavía. Pídelo a la oficina antes de salir.
            </p>
          )}

          {t.kind === 'trip' && t.estado === 'en_curso' && (
            <TripCargas orgId={orgId} tripId={t.id} showToast={showToast} />
          )}

          {accion ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                <Gauge className="h-4 w-4" /> Km del cuentakilómetros {accion === 'empezar' ? 'al salir' : 'al llegar'} (opcional)
              </label>
              <input inputMode="numeric" className={inputCls} value={km} onChange={e => setKm(e.target.value)} placeholder={t.odometro_inicio != null && accion === 'terminar' ? `Salida: ${t.odometro_inicio}` : 'Ej. 125430'} />
              {accion === 'terminar' && (
                <textarea className={`${inputCls} min-h-[70px] text-base`} value={incidencias} onChange={e => setIncidencias(e.target.value)} placeholder="Incidencias (opcional)" />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAccion(null)} disabled={busy} className="rounded-xl border border-gray-200 bg-white py-3 font-semibold text-gray-700">Volver</button>
                <button type="button" onClick={accion === 'empezar' ? empezar : terminar} disabled={busy}
                  className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-50 ${accion === 'empezar' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : accion === 'empezar' ? <Play className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
                  {accion === 'empezar' ? 'Empezar' : 'Terminar'}
                </button>
              </div>
            </div>
          ) : t.estado === 'confirmado' ? (
            <button type="button" onClick={() => setAccion('empezar')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white"><Play className="h-6 w-6" /> Empezar {t.kind === 'trip' ? 'viaje' : 'servicio'}</button>
          ) : t.estado === 'en_curso' ? (
            <button type="button" onClick={() => setAccion('terminar')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-lg font-bold text-white"><Flag className="h-6 w-6" /> Terminar y enviar parte</button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TripCargas({ orgId, tripId, showToast }: { orgId: string; tripId: string; showToast: Toast }) {
  const [items, setItems] = useState<TradeTransportShipment[] | null>(null);
  const [entregando, setEntregando] = useState<TradeTransportShipment | null>(null);
  const [incidencia, setIncidencia] = useState<{ s: TradeTransportShipment; texto: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    loadShipments(orgId, { tripId }).then(sh => setItems(sh.filter(s => s.estado !== 'cancelada'))).catch(() => setItems([]));
  }, [orgId, tripId]);
  useEffect(() => { load(); }, [load]);

  const replace = (s: TradeTransportShipment) => setItems(prev => (prev ?? []).map(x => x.id === s.id ? s : x));

  if (items === null) return <div className="flex justify-center py-3 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (items.length === 0) return <p className="text-sm text-gray-500">Este viaje no tiene cargas detalladas.</p>;

  if (entregando) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
        <p className="mb-2 font-bold text-gray-900">Entrega {entregando.referencia} · {entregando.destino}</p>
        <DeliveryProofForm orgId={orgId} shipment={entregando} onCancel={() => setEntregando(null)}
          onDone={s => { replace(s); setEntregando(null); showToast('Entrega registrada', 'success'); }} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-700"><Package className="h-4 w-4" /> Cargas ({items.length})</p>
      {items.map(s => {
        const meta = shipmentEstadoMeta(s.estado);
        return (
          <div key={s.id} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-500">{s.referencia}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
            </div>
            <p className="font-semibold text-gray-900">{s.naturaleza}{s.num_bultos ? ` · ${s.num_bultos} bultos` : ''}</p>
            <p className="flex items-start gap-1 text-sm text-gray-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" /> {s.origen}</p>
            <p className="flex items-start gap-1 text-sm text-gray-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {s.destino}{s.destinatario_nombre ? ` · ${s.destinatario_nombre}` : ''}</p>
            {s.destinatario_telefono && <a href={`tel:${s.destinatario_telefono}`} className="text-sm font-semibold text-blue-700">{s.destinatario_telefono}</a>}
            {incidencia?.s.id === s.id ? (
              <div className="mt-2 space-y-2">
                <input autoFocus className={`${inputCls} text-base`} value={incidencia.texto} onChange={e => setIncidencia({ s, texto: e.target.value })} placeholder="Qué ha pasado" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setIncidencia(null)} className="rounded-xl border border-gray-200 py-2.5 font-semibold text-gray-700">Volver</button>
                  <button type="button" disabled={!incidencia.texto.trim() || busy === s.id}
                    onClick={async () => { setBusy(s.id); try { replace(await markIncident(orgId, s.id, incidencia.texto.trim())); setIncidencia(null); showToast('Incidencia enviada a la oficina', 'success'); } catch (e) { showToast(errMsg(e), 'error'); } finally { setBusy(null); } }}
                    className="rounded-xl bg-amber-500 py-2.5 font-bold text-white disabled:opacity-50">Enviar</button>
                </div>
              </div>
            ) : s.estado !== 'entregada' && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {canPick(s) && (
                  <button type="button" disabled={busy === s.id}
                    onClick={async () => { setBusy(s.id); try { replace(await markPicked(orgId, s.id)); showToast('Recogida registrada', 'success'); } catch (e) { showToast(errMsg(e), 'error'); } finally { setBusy(null); } }}
                    className="rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Recogida</button>
                )}
                {canDeliver(s) && (
                  <button type="button" onClick={() => setEntregando(s)} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white">Entregar</button>
                )}
                <button type="button" onClick={() => setIncidencia({ s, texto: '' })} className="rounded-xl border-2 border-amber-300 py-2 text-sm font-bold text-amber-800">Incidencia</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
