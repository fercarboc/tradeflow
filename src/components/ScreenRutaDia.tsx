import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Navigation, Clock, Zap, ChevronUp, ChevronDown,
  AlertTriangle, ExternalLink, Route, RefreshCw, Play,
  CheckCircle2, Circle, ArrowDown,
} from 'lucide-react';
import type { TradeJob } from '../lib/supabase';
import { updateJob } from '../lib/supabase';
import {
  optimizeDailyRoute,
  buildGoogleMapsUrl,
  estimateRouteDuration,
  type GeoLocation,
  type RouteJob,
} from '../lib/routeOptimizer';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ScreenRutaDiaProps {
  jobs: TradeJob[];
  orgId: string;
  /** Dirección / coords de inicio del técnico. Puede ser string "Dirección, Ciudad" o GeoLocation. */
  startLocation: string | GeoLocation;
  /** Destino final opcional. Si se omite, el último trabajo es el destino. */
  endLocation?: string | GeoLocation;
  /** Hora estimada de inicio de ruta en formato "HH:MM" (defecto 08:00). */
  horaInicio?: string;
  onUpdateJob: (id: string, updates: Partial<TradeJob>) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /** Cuando se llama, cierra este panel y vuelve a planificación. */
  onClose?: () => void;
}

// ── Constantes UI ─────────────────────────────────────────────────────────────

const PRIORIDAD_CFG: Record<TradeJob['prioridad'], { label: string; dot: string; badge: string }> = {
  urgente: { label: 'Urgente', dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200' },
  alta:    { label: 'Alta',    dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  normal:  { label: 'Normal',  dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  baja:    { label: 'Baja',    dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const ESTADO_DONE: Set<TradeJob['estado']> = new Set(['completado', 'cancelado']);
const TRAVEL_MINS = 15; // minutos estimados por desplazamiento entre paradas

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHora(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: h ?? 8, m: m ?? 0 };
}

function addMinutes(base: { h: number; m: number }, mins: number): { h: number; m: number } {
  const total = base.h * 60 + base.m + mins;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

function formatHora({ h, m }: { h: number; m: number }): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(horas: number): string {
  const totalMins = Math.round(horas * 60);
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function addressLine(job: TradeJob): string {
  return [job.direccion, job.localidad, job.cp].filter(Boolean).join(', ') || '—';
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScreenRutaDia({
  jobs,
  orgId,
  startLocation,
  endLocation,
  horaInicio = '08:00',
  onUpdateJob,
  showToast,
  onClose,
}: ScreenRutaDiaProps) {
  const [routeJobs, setRouteJobs]     = useState<RouteJob[]>([]);
  const [optimized, setOptimized]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [dragIdx, setDragIdx]         = useState<number | null>(null);

  // ── Carga inicial: usa orden_ruta ya guardado si existe, si no ordena por hora ──
  useEffect(() => {
    const todayJobs = jobs.filter(
      j => !ESTADO_DONE.has(j.estado),
    );

    const alreadyOrdered = todayJobs.every(j => j.orden_ruta != null);
    if (alreadyOrdered && todayJobs.length > 0) {
      const sorted = [...todayJobs].sort((a, b) => (a.orden_ruta ?? 99) - (b.orden_ruta ?? 99));
      setRouteJobs(sorted.map((j, i) => ({ ...j, orden_ruta: i + 1 }) as RouteJob));
      setOptimized(true);
    } else {
      // Orden inicial por hora_inicio, sin optimizar
      const sorted = [...todayJobs].sort((a, b) => {
        const ha = a.hora_inicio ?? '23:59';
        const hb = b.hora_inicio ?? '23:59';
        return ha.localeCompare(hb);
      });
      setRouteJobs(sorted.map((j, i) => ({ ...j, orden_ruta: i + 1 }) as RouteJob));
    }
  }, [jobs]);

  // ── Calcular horas previstas para cada parada ─────────────────────────────
  const calcTimeline = useCallback(() => {
    const start = parseHora(horaInicio);
    let cursor = start;
    return routeJobs.map((job, i) => {
      if (i > 0) cursor = addMinutes(cursor, TRAVEL_MINS);
      const llegada = cursor;
      const durHoras = job.duracion_horas ?? 1;
      cursor = addMinutes(cursor, durHoras * 60);
      return {
        llegada: formatHora(llegada),
        salida:  formatHora(cursor),
        durMins: Math.round(durHoras * 60),
      };
    });
  }, [routeJobs, horaInicio]);

  const timeline = calcTimeline();

  // ── Optimizar ruta ────────────────────────────────────────────────────────
  function handleOptimize() {
    const geoStart: GeoLocation =
      typeof startLocation === 'string'
        ? { lat: 0, lng: 0, label: startLocation } // sin coords reales, nearest neighbor usará orden de prioridad
        : startLocation;

    const optimized = optimizeDailyRoute(routeJobs, geoStart);
    setRouteJobs(optimized);
    setOptimized(true);
    showToast('Ruta optimizada — guarda para persistir el orden', 'success');
  }

  // ── Guardar orden en BD ────────────────────────────────────────────────────
  async function handleSaveOrder() {
    if (!orgId) return;
    setSaving(true);
    try {
      await Promise.all(
        routeJobs.map(j => onUpdateJob(j.id, { orden_ruta: j.orden_ruta })),
      );
      showToast('Orden de ruta guardado', 'success');
    } catch {
      showToast('Error al guardar el orden', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Reordenación manual (subir / bajar) ───────────────────────────────────
  function moveJob(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= routeJobs.length) return;
    const next = [...routeJobs];
    [next[idx], next[target]] = [next[target], next[idx]];
    setRouteJobs(next.map((j, i) => ({ ...j, orden_ruta: i + 1 })));
  }

  // ── Abrir en Google Maps ───────────────────────────────────────────────────
  function handleOpenMaps() {
    const url = buildGoogleMapsUrl(routeJobs, startLocation, endLocation);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const totalMins = estimateRouteDuration(routeJobs);
  const totalHours = (totalMins / 60).toFixed(1);
  const jobsWithoutCoords = routeJobs.filter(j => j.latitud == null || j.longitud == null);
  const startIsGeo = typeof startLocation !== 'string';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-0">

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Route className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Ruta del día
              </h2>
            </div>
            <p className="text-[11px] text-slate-500">
              {routeJobs.length} paradas · ~{totalHours}h total · inicio {horaInicio}
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 shrink-0">
            {onClose && (
              <button
                onClick={onClose}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ← Volver
              </button>
            )}
            <button
              onClick={handleOptimize}
              disabled={routeJobs.length < 2}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Optimizar
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={saving || routeJobs.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              Guardar
            </button>
            <button
              onClick={handleOpenMaps}
              disabled={routeJobs.length === 0}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Maps
            </button>
          </div>
        </div>

        {/* Aviso: trabajos sin coordenadas */}
        {jobsWithoutCoords.length > 0 && (
          <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700">
              <strong>{jobsWithoutCoords.length} trabajo{jobsWithoutCoords.length > 1 ? 's' : ''}</strong> sin
              geolocalización:{' '}
              {jobsWithoutCoords.map(j => j.titulo).join(', ')}.
              La optimización los coloca al final. Añade lat/lng para mayor precisión.
            </p>
          </div>
        )}

        {/* Aviso: origen sin coords reales */}
        {!startIsGeo && (
          <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <Navigation className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700">
              Origen: <strong>{startLocation as string}</strong>. Sin coordenadas GPS, la
              optimización usa prioridad y no distancia real.
            </p>
          </div>
        )}
      </div>

      {/* ── Cuerpo: itinerario con línea de tiempo ───────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">

        {routeJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Route className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-400">No hay trabajos activos hoy</p>
            <p className="text-[11px] text-slate-400 mt-1">Añade trabajos en Planificación para ver la ruta</p>
          </div>
        ) : (
          <>
            {/* Punto de inicio */}
            <div className="flex items-start gap-3 pb-1">
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <div className="w-0.5 h-4 bg-blue-200 mt-1" />
              </div>
              <div className="pb-3 pt-1">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Salida · {horaInicio}</p>
                <p className="text-sm font-semibold text-slate-700">
                  {typeof startLocation === 'string' ? startLocation : `${startLocation.lat}, ${startLocation.lng}`}
                </p>
              </div>
            </div>

            {/* Paradas */}
            {routeJobs.map((job, idx) => {
              const time = timeline[idx];
              const pCfg = PRIORIDAD_CFG[job.prioridad];
              const isDone = ESTADO_DONE.has(job.estado);
              const isFirst = idx === 0;
              const isLast = idx === routeJobs.length - 1;
              const hasCoords = job.latitud != null && job.longitud != null;

              return (
                <div key={job.id} className="flex items-start gap-3">
                  {/* Línea de tiempo vertical */}
                  <div className="flex flex-col items-center shrink-0 w-8">
                    {/* Conector superior — desplazamiento */}
                    {idx > 0 && (
                      <div className="flex flex-col items-center">
                        <div className="w-0.5 h-3 bg-slate-200" />
                        <div className="flex items-center gap-1 py-0.5">
                          <div className="w-0.5 h-3 bg-slate-200" />
                        </div>
                        <div className="w-0.5 h-3 bg-slate-200" />
                      </div>
                    )}
                    {/* Punto de la parada */}
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-400'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <span className="text-[11px] font-black text-slate-600">{idx + 1}</span>
                      )}
                    </div>
                    {/* Conector inferior */}
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-slate-200 min-h-[2rem] mt-1" />
                    )}
                  </div>

                  {/* Tarjeta del trabajo */}
                  <div
                    className={`flex-1 mb-3 rounded-2xl border transition-shadow ${
                      isDone
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : dragIdx === idx
                        ? 'bg-blue-50 border-blue-300 shadow-md'
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Franja de prioridad superior */}
                    <div className={`h-1 rounded-t-2xl ${pCfg.dot}`} />

                    <div className="p-3">
                      {/* Hora + prioridad */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-700">
                              {time.llegada}
                            </span>
                            <span className="text-[10px] text-slate-400">→</span>
                            <span className="text-[11px] font-bold text-slate-700">
                              {time.salida}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({formatDuration(job.duracion_horas ?? 1)})
                            </span>
                          </div>
                          {idx > 0 && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Navigation className="w-2.5 h-2.5" />
                              ~{TRAVEL_MINS} min desplazamiento
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pCfg.badge}`}>
                          {pCfg.label}
                        </span>
                      </div>

                      {/* Título */}
                      <p className={`text-sm font-bold mb-1 ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {job.titulo}
                      </p>

                      {/* Dirección */}
                      <div className="flex items-start gap-1.5">
                        <MapPin className={`w-3 h-3 mt-0.5 shrink-0 ${hasCoords ? 'text-blue-400' : 'text-amber-400'}`} />
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {addressLine(job)}
                          {!hasCoords && (
                            <span className="ml-1 text-amber-500 font-semibold">· Sin geolocalizar</span>
                          )}
                        </p>
                      </div>

                      {/* Descripción breve */}
                      {job.descripcion && (
                        <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {job.descripcion}
                        </p>
                      )}

                      {/* Cliente */}
                      {job.trade_clients?.nombre && (
                        <p className="text-[11px] text-slate-500 mt-1.5 font-semibold">
                          👤 {job.trade_clients.nombre}
                          {job.trade_clients.telefono && (
                            <a
                              href={`tel:${job.trade_clients.telefono}`}
                              className="ml-2 text-blue-500 underline"
                            >
                              {job.trade_clients.telefono}
                            </a>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Controles de reordenación */}
                    {!isDone && (
                      <div className="flex items-center justify-end gap-1 px-3 pb-2">
                        <button
                          onClick={() => moveJob(idx, -1)}
                          disabled={isFirst}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors cursor-pointer"
                          title="Subir"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveJob(idx, 1)}
                          disabled={isLast}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors cursor-pointer"
                          title="Bajar"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Punto de fin */}
            <div className="flex items-start gap-3 mt-1">
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="w-0.5 h-3 bg-slate-200" />
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">
                  Fin estimado · {timeline.length > 0 ? timeline[timeline.length - 1].salida : horaInicio}
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {endLocation
                    ? typeof endLocation === 'string'
                      ? endLocation
                      : `${endLocation.lat}, ${endLocation.lng}`
                    : routeJobs[routeJobs.length - 1]
                      ? addressLine(routeJobs[routeJobs.length - 1])
                      : '—'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Duración total estimada: ~{totalHours}h
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Barra de resumen inferior ────────────────────────────────────── */}
      {routeJobs.length > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-black text-slate-800">{routeJobs.length}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">Paradas</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-lg font-black text-slate-800">{totalHours}h</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">Total</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-lg font-black text-slate-800">
                  {routeJobs.filter(j => j.prioridad === 'urgente').length}
                </p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">Urgentes</p>
              </div>
            </div>
            <button
              onClick={handleOpenMaps}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              Abrir ruta completa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
