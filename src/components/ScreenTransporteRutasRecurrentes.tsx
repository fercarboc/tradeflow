import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Route, Clock, Bus, User, AlertCircle, Search,
  ChevronLeft, Plus, X, Pause, Play, Square,
  ExternalLink, AlertTriangle, CalendarDays,
} from 'lucide-react';
import type {
  TradeTransportSchedule,
  TradeTransportScheduleException,
  TradeTransportOccurrenceLink,
  ScheduleEstado,
  ScheduleExceptionTipo,
  ScheduleSentido,
  DiaSemanaISO,
} from '../lib/transportSchedules';
import {
  loadSchedules,
  loadExceptions,
  loadOccurrenceLinks,
  updateSchedule,
  createException,
  getExpectedOccurrences,
  validateExceptionOverrides,
  SCHEDULE_ESTADO_LABELS,
  SCHEDULE_EXCEPTION_TIPO_LABELS,
  SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED,
  DIA_SEMANA_LABELS,
} from '../lib/transportSchedules';
import { loadVehiclesAll, getVehicleDisplayImage } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import { TIPO_SERVICIO_OPTIONS, TIPO_SERVICIO_COLORS } from '../lib/transportServices';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'resumen' | 'calendario' | 'historial';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
  initialServiceId?: string | null;
  onConsumeInitialServiceId?: () => void;
}

// ── Pure exports (for testing) ────────────────────────────────────────────────

export interface CalendarOccurrence {
  fecha: string;
  sentido: ScheduleSentido;
  status:
    | 'pending'
    | 'materialized'
    | 'suspended'
    | 'no_circula'
    | 'cambio_horario'
    | 'cambio_conductor'
    | 'cambio_vehiculo'
    | 'cambio_itinerario'
    | 'modificado';
  service_id: string | null;
  exception: TradeTransportScheduleException | null;
}

export type ScheduleTransition = 'activar' | 'pausar' | 'reanudar' | 'finalizar';

export function buildCalendarProjection(
  schedule: Pick<TradeTransportSchedule, 'periodo_inicio' | 'periodo_fin' | 'dias_semana' | 'vuelta_habilitada'>,
  exceptions: TradeTransportScheduleException[],
  links: TradeTransportOccurrenceLink[],
  desde: Date,
  hasta: Date,
): CalendarOccurrence[] {
  const fechas = getExpectedOccurrences(schedule, desde, hasta);

  const exMap = new Map<string, TradeTransportScheduleException>();
  for (const ex of exceptions) exMap.set(`${ex.fecha}:${ex.sentido}`, ex);

  const linkMap = new Map<string, string>();
  for (const lk of links) linkMap.set(`${lk.fecha}:${lk.sentido}`, lk.service_id);

  const result: CalendarOccurrence[] = [];
  for (const fecha of fechas) {
    const sentidos: ScheduleSentido[] = schedule.vuelta_habilitada ? ['ida', 'vuelta'] : ['unico'];

    for (const sentido of sentidos) {
      const key = `${fecha}:${sentido}`;
      const ex  = exMap.get(key);
      const svc = linkMap.get(key) ?? null;

      let status: CalendarOccurrence['status'];
      if (svc)                         status = 'materialized';
      else if (!ex)                    status = 'pending';
      else if (ex.tipo === 'no_circula') status = 'no_circula';
      else if (ex.tipo === 'suspendido') status = 'suspended';
      else                             status = ex.tipo;

      result.push({ fecha, sentido, status, service_id: svc, exception: ex ?? null });
    }
  }
  return result;
}

export function getAvailableTransitions(estado: ScheduleEstado): ScheduleTransition[] {
  switch (estado) {
    case 'borrador':   return ['activar'];
    case 'activo':     return ['pausar', 'finalizar'];
    case 'pausado':    return ['reanudar', 'finalizar'];
    case 'finalizado': return [];
  }
}

export function applyTransition(estado: ScheduleEstado, transition: ScheduleTransition): ScheduleEstado {
  const MAP: Partial<Record<string, ScheduleEstado>> = {
    'borrador:activar':  'activo',
    'activo:pausar':     'pausado',
    'activo:finalizar':  'finalizado',
    'pausado:reanudar':  'activo',
    'pausado:finalizar': 'finalizado',
  };
  const next = MAP[`${estado}:${transition}`];
  if (!next) throw new Error(`Transición "${transition}" inválida desde estado "${estado}"`);
  return next;
}

export function fmtHora(hhmms: string | null | undefined): string {
  if (!hhmms) return '—';
  return hhmms.slice(0, 5);
}

export interface ScheduleFilterOptions {
  query: string;
  tipo: string;
  estado: ScheduleEstado | '';
}

export function filterSchedules(
  schedules: TradeTransportSchedule[],
  opts: ScheduleFilterOptions,
  clientNames: Record<string, string>,
): TradeTransportSchedule[] {
  let r = schedules;
  if (opts.estado) r = r.filter(s => s.estado === opts.estado);
  if (opts.tipo)   r = r.filter(s => s.tipo_servicio === opts.tipo);
  if (opts.query.trim()) {
    const q = opts.query.toLowerCase().trim();
    r = r.filter(s =>
      s.nombre.toLowerCase().includes(q) ||
      (s.client_id && (clientNames[s.client_id] ?? '').toLowerCase().includes(q))
    );
  }
  return r;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function estadoScheduleColor(estado: ScheduleEstado): string {
  const map: Record<ScheduleEstado, string> = {
    borrador:   'bg-slate-100 text-slate-600 border-slate-200',
    activo:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    pausado:    'bg-amber-100 text-amber-700 border-amber-200',
    finalizado: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return map[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function tipoLabel(tipo: string): string {
  return TIPO_SERVICIO_OPTIONS.find(t => t.value === tipo)?.label ?? tipo;
}

function tipoColor(tipo: string): string {
  return TIPO_SERVICIO_COLORS[tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtPeriodo(inicio: string, fin: string | null): string {
  const s = new Date(inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!fin) return `Desde ${s}`;
  const e = new Date(fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${s} — ${e}`;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysToIso(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DiasWeekBadgesProps {
  dias: DiaSemanaISO[];
  compact?: boolean;
}
function DiasWeekBadges({ dias, compact }: DiasWeekBadgesProps) {
  const ALL: DiaSemanaISO[] = [1, 2, 3, 4, 5, 6, 7];
  const labels = compact
    ? ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return (
    <div className="flex gap-0.5">
      {ALL.map((d, i) => (
        <span
          key={d}
          className={`text-[10px] font-bold px-1 py-0.5 rounded ${
            (dias as number[]).includes(d)
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-300'
          }`}
        >
          {labels[i]}
        </span>
      ))}
    </div>
  );
}

interface ScheduleListRowProps {
  schedule: TradeTransportSchedule;
  selected: boolean;
  clientMap: Record<string, TradeClient>;
  vehicleMap: Record<string, TradeVehicle>;
  workerMap: Record<string, TradeWorker>;
  onClick: () => void;
}
function ScheduleListRow({ schedule, selected, clientMap, vehicleMap, workerMap, onClick }: ScheduleListRowProps) {
  const client    = schedule.client_id    ? clientMap[schedule.client_id]     : null;
  const vehicle   = schedule.vehicle_id   ? vehicleMap[schedule.vehicle_id]   : null;
  const conductor = schedule.conductor_id ? workerMap[schedule.conductor_id]  : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? 'bg-blue-50 border-blue-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight flex-1 min-w-0 truncate">
          {schedule.nombre}
        </p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${estadoScheduleColor(schedule.estado)}`}>
          {SCHEDULE_ESTADO_LABELS[schedule.estado]}
        </span>
      </div>

      {client && (
        <p className="mt-1 text-[11px] text-slate-500 truncate">{getClientDisplayName(client)}</p>
      )}

      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${tipoColor(schedule.tipo_servicio)}`}>
          {tipoLabel(schedule.tipo_servicio)}
        </span>
        <DiasWeekBadges dias={schedule.dias_semana} compact />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
        <Clock className="w-3 h-3 shrink-0" />
        <span>{fmtHora(schedule.hora_salida_ida)}</span>
        {vehicle && (
          <>
            <Bus className="w-3 h-3 shrink-0 ml-1" />
            <span className="truncate max-w-[80px]">{vehicle.nombre}</span>
          </>
        )}
        {conductor && (
          <>
            <User className="w-3 h-3 shrink-0 ml-1" />
            <span className="truncate max-w-[80px]">{conductor.nombre}</span>
          </>
        )}
      </div>
    </button>
  );
}

interface ItinerarioLinesProps {
  origen: Record<string, unknown>;
  destino: Record<string, unknown>;
  paradas: unknown[];
}
function ItinerarioLines({ origen, destino, paradas }: ItinerarioLinesProps) {
  const origenLabel  = (origen?.display_name  as string) || (origen?.nombre  as string) || 'Origen';
  const destinoLabel = (destino?.display_name as string) || (destino?.nombre as string) || 'Destino';
  const stops = paradas as Array<{ nombre?: string; hora?: string }>;

  return (
    <div>
      <div className="flex gap-3 items-start">
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">A</div>
          <div className="w-0.5 bg-slate-200 my-1" style={{ minHeight: 12 }} />
        </div>
        <p className="text-sm text-slate-800 leading-tight pb-2 flex-1 min-w-0">{origenLabel}</p>
      </div>
      {stops.map((p, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-[10px] font-black text-white">{i + 1}</div>
            <div className="w-0.5 bg-slate-200 my-1" style={{ minHeight: 12 }} />
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <p className="text-sm text-slate-700 leading-tight">{p.nombre ?? `Parada ${i + 1}`}</p>
            {p.hora && <p className="text-[10px] text-slate-400 font-mono">{p.hora}</p>}
          </div>
        </div>
      ))}
      <div className="flex gap-3 items-start">
        <div className="shrink-0 pt-1">
          <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white">B</div>
        </div>
        <p className="text-sm text-slate-800 leading-tight flex-1 min-w-0">{destinoLabel}</p>
      </div>
    </div>
  );
}

interface ResumenTabProps {
  schedule: TradeTransportSchedule;
  clientMap: Record<string, TradeClient>;
  vehicleMap: Record<string, TradeVehicle>;
  workerMap: Record<string, TradeWorker>;
}
function ResumenTab({ schedule, clientMap, vehicleMap, workerMap }: ResumenTabProps) {
  const client     = schedule.client_id    ? clientMap[schedule.client_id]     : null;
  const vehicle    = schedule.vehicle_id   ? vehicleMap[schedule.vehicle_id]   : null;
  const conductor  = schedule.conductor_id ? workerMap[schedule.conductor_id]  : null;
  const vehicleImg = vehicle ? getVehicleDisplayImage(vehicle.tipo, vehicle.image_path) : null;

  return (
    <div className="space-y-5 px-5 py-4">
      <div>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-3">Datos generales</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="text-slate-500 w-24 shrink-0">Período</span>
            <span className="text-slate-800">{fmtPeriodo(schedule.periodo_inicio, schedule.periodo_fin)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 w-24 shrink-0">Circula</span>
            <DiasWeekBadges dias={schedule.dias_semana} />
          </div>
          {client && (
            <div className="flex gap-3">
              <span className="text-slate-500 w-24 shrink-0">Cliente</span>
              <span className="text-slate-800">{getClientDisplayName(client)}</span>
            </div>
          )}
          {schedule.num_viajeros != null && (
            <div className="flex gap-3">
              <span className="text-slate-500 w-24 shrink-0">Viajeros</span>
              <span className="text-slate-800">{schedule.num_viajeros}</span>
            </div>
          )}
          {schedule.precio_referencia != null && (
            <div className="flex gap-3">
              <span className="text-slate-500 w-24 shrink-0">Precio ref.</span>
              <span className="text-slate-800">
                {schedule.precio_referencia.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-3">Horarios</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-[10px] font-black text-blue-600 uppercase w-12 shrink-0">IDA</span>
            <span className="text-sm font-semibold text-blue-900">{fmtHora(schedule.hora_salida_ida)}</span>
            {schedule.hora_llegada_ida && (
              <>
                <span className="text-xs text-blue-400">→</span>
                <span className="text-sm text-blue-700">{fmtHora(schedule.hora_llegada_ida)}</span>
              </>
            )}
          </div>
          {schedule.vuelta_habilitada && (
            <div className="flex items-center gap-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[10px] font-black text-emerald-600 uppercase w-12 shrink-0">VUELTA</span>
              <span className="text-sm font-semibold text-emerald-900">{fmtHora(schedule.hora_salida_vuelta)}</span>
              {schedule.hora_llegada_vuelta && (
                <>
                  <span className="text-xs text-emerald-400">→</span>
                  <span className="text-sm text-emerald-700">{fmtHora(schedule.hora_llegada_vuelta)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-3">Itinerario (ida)</h3>
        <ItinerarioLines
          origen={schedule.origen_ida}
          destino={schedule.destino_ida}
          paradas={schedule.paradas_ida}
        />
      </div>

      {(vehicle || conductor) && (
        <div>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-3">Recursos habituales</h3>
          <div className="space-y-2">
            {vehicle && (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                {vehicleImg ? (
                  <img
                    src={vehicleImg}
                    alt={vehicle.nombre}
                    className="h-8 w-auto max-w-[48px] object-contain rounded shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Bus className="w-4 h-4 text-blue-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{vehicle.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {vehicle.matricula}
                    {vehicle.capacidad_viajeros ? ` · ${vehicle.capacidad_viajeros} plazas` : ''}
                  </p>
                </div>
              </div>
            )}
            {conductor && (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{conductor.nombre}</p>
                  <p className="text-xs text-slate-500">Conductor habitual</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {schedule.observaciones && (
        <div>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-2">Observaciones</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{schedule.observaciones}</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

function occStatusColor(status: CalendarOccurrence['status']): string {
  if (status === 'materialized') return 'bg-emerald-50 border-emerald-200';
  if (status === 'no_circula')   return 'bg-slate-50 border-slate-200 opacity-50';
  if (status === 'suspended')    return 'bg-amber-50 border-amber-200';
  if (status === 'pending')      return 'bg-white border-slate-200';
  return 'bg-blue-50 border-blue-200';
}

function occStatusTextColor(status: CalendarOccurrence['status']): string {
  if (status === 'materialized') return 'text-emerald-700';
  if (status === 'no_circula')   return 'text-slate-400 line-through';
  if (status === 'suspended')    return 'text-amber-700';
  if (status === 'pending')      return 'text-slate-600';
  return 'text-blue-700';
}

function occStatusLabel(status: CalendarOccurrence['status']): string {
  const MAP: Record<CalendarOccurrence['status'], string> = {
    pending:            'Pendiente',
    materialized:       'Servicio creado',
    suspended:          'Suspendido',
    no_circula:         'No circula',
    cambio_horario:     'Cambio de horario',
    cambio_conductor:   'Cambio de conductor',
    cambio_vehiculo:    'Cambio de vehículo',
    cambio_itinerario:  'Cambio de itinerario',
    modificado:         'Modificado',
  };
  return MAP[status] ?? status;
}

interface CalendarioTabProps {
  schedule: TradeTransportSchedule;
  occurrences: CalendarOccurrence[];
  onAddException: (fecha: string, sentido: ScheduleSentido) => void;
  onNavigate?: (tab: string) => void;
}
function CalendarioTab({ schedule, occurrences, onAddException, onNavigate }: CalendarioTabProps) {
  const today  = isoToday();
  const future = occurrences.filter(o => o.fecha >= today);

  if (future.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-5 gap-3">
        <CalendarDays className="w-8 h-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Sin ocurrencias próximas</p>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          {schedule.estado === 'finalizado'
            ? 'La ruta está finalizada.'
            : 'No hay días activos en las próximas 8 semanas.'}
        </p>
      </div>
    );
  }

  const byWeek = new Map<string, CalendarOccurrence[]>();
  for (const occ of future) {
    const d   = new Date(occ.fecha + 'T12:00:00');
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    const wKey = monday.toISOString().slice(0, 10);
    if (!byWeek.has(wKey)) byWeek.set(wKey, []);
    byWeek.get(wKey)!.push(occ);
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {[...byWeek.entries()].map(([wKey, occs]) => {
        const wStart = new Date(wKey + 'T12:00:00');
        const wEnd   = new Date(wKey + 'T12:00:00');
        wEnd.setDate(wEnd.getDate() + 6);
        const wLabel = `${wStart.getDate()} ${wStart.toLocaleDateString('es-ES', { month: 'short' })} — ${wEnd.getDate()} ${wEnd.toLocaleDateString('es-ES', { month: 'short' })}`;

        return (
          <div key={wKey}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">{wLabel}</p>
            <div className="space-y-1.5">
              {occs.map((occ, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border ${occStatusColor(occ.status)}`}
                >
                  <span className={`text-xs font-semibold w-24 shrink-0 ${occStatusTextColor(occ.status)}`}>
                    {fmtDateShort(occ.fecha)}
                  </span>
                  <span className="text-[10px] font-black uppercase shrink-0 w-10 text-slate-400">
                    {occ.sentido === 'ida' ? 'IDA' : 'VTA'}
                  </span>
                  <span className={`flex-1 min-w-0 truncate text-xs ${occStatusTextColor(occ.status)}`}>
                    {occStatusLabel(occ.status)}
                    {occ.exception?.motivo && (
                      <span className="text-slate-400"> · {occ.exception.motivo}</span>
                    )}
                  </span>
                  {occ.status === 'materialized' && onNavigate && (
                    <button
                      onClick={() => onNavigate('transporte_servicios')}
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 shrink-0"
                      title="Ver en Servicios"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {occ.status !== 'materialized' &&
                   occ.status !== 'no_circula' &&
                   schedule.estado !== 'finalizado' && (
                    <button
                      onClick={() => onAddException(occ.fecha, occ.sentido)}
                      className="text-slate-300 hover:text-slate-600 shrink-0 transition-colors"
                      title="Añadir excepción"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="h-4" />
    </div>
  );
}

interface HistorialTabProps {
  occurrenceLinks: TradeTransportOccurrenceLink[];
  onNavigate?: (tab: string) => void;
}
function HistorialTab({ occurrenceLinks, onNavigate }: HistorialTabProps) {
  const today = isoToday();
  const past  = [...occurrenceLinks]
    .filter(l => l.fecha < today)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (past.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-5 gap-3">
        <CalendarDays className="w-8 h-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Sin historial</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Los viajes materializados completados aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-1.5">
      {past.map(lk => (
        <div key={lk.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{fmtDateShort(lk.fecha)}</p>
            <p className="text-[10px] text-slate-500">{lk.sentido === 'ida' ? 'Ida' : 'Vuelta'}</p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('transporte_servicios')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver servicio
            </button>
          )}
        </div>
      ))}
      <div className="h-4" />
    </div>
  );
}

interface ExceptionModalProps {
  schedule: TradeTransportSchedule;
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  existingExceptions: TradeTransportScheduleException[];
  initFecha?: string;
  initSentido?: ScheduleSentido;
  saving: boolean;
  onSave: (input: Omit<TradeTransportScheduleException, 'id' | 'org_id' | 'created_at'>) => void;
  onClose: () => void;
}
function ExceptionModal({
  schedule, vehicles, workers, existingExceptions,
  initFecha, initSentido, saving, onSave, onClose,
}: ExceptionModalProps) {
  const today = isoToday();
  const until = addDaysToIso(today, 56);
  const futureExpected = getExpectedOccurrences(
    schedule,
    new Date(today + 'T00:00:00'),
    new Date(until + 'T23:59:59'),
  );

  const firstFecha   = initFecha ?? futureExpected[0] ?? today;
  const [fecha,      setFecha]      = useState(firstFecha);
  const [sentido,    setSentido]    = useState<ScheduleSentido>(initSentido ?? 'ida');
  const [tipo,       setTipo]       = useState<ScheduleExceptionTipo>('no_circula');
  const [motivo,     setMotivo]     = useState('');
  const [oConductor, setOConductor] = useState('');
  const [oVehicle,   setOVehicle]   = useState('');
  const [oSalida,    setOSalida]    = useState('');
  const [oLlegada,   setOLlegada]   = useState('');

  const allowed  = SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED[tipo];
  const existing = existingExceptions.find(ex => ex.fecha === fecha && ex.sentido === sentido);
  const conductors = workers.filter(w => w.es_conductor);

  function buildOverrides(): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    if (allowed.includes('conductor_id') && oConductor) o.conductor_id = oConductor;
    if (allowed.includes('vehicle_id')   && oVehicle)   o.vehicle_id   = oVehicle;
    if (allowed.includes('hora_salida')  && oSalida)    o.hora_salida  = oSalida + ':00';
    if (allowed.includes('hora_llegada') && oLlegada)   o.hora_llegada = oLlegada + ':00';
    return o;
  }

  function handleSubmit() {
    const overrides = buildOverrides();
    const err = validateExceptionOverrides(tipo, overrides);
    if (err) return;
    onSave({
      schedule_id: schedule.id,
      fecha,
      sentido,
      tipo,
      overrides,
      motivo: motivo.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Nueva excepción</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha</label>
            <select
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {futureExpected.slice(0, 60).map(f => (
                <option key={f} value={f}>{fmtDateShort(f)}</option>
              ))}
              {!futureExpected.includes(fecha) && (
                <option value={fecha}>{fecha}</option>
              )}
            </select>
          </div>

          {schedule.vuelta_habilitada && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Sentido</label>
              <div className="flex gap-2">
                {(['ida', 'vuelta'] as ScheduleSentido[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSentido(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      sentido === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s === 'ida' ? 'Ida' : 'Vuelta'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo de excepción</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as ScheduleExceptionTipo)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {Object.entries(SCHEDULE_EXCEPTION_TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {allowed.includes('conductor_id') && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Conductor alternativo</label>
              <select
                value={oConductor}
                onChange={e => setOConductor(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— mismo conductor habitual —</option>
                {conductors.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}

          {allowed.includes('vehicle_id') && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Vehículo alternativo</label>
              <select
                value={oVehicle}
                onChange={e => setOVehicle(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— mismo vehículo habitual —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre} · {v.matricula}</option>
                ))}
              </select>
            </div>
          )}

          {allowed.includes('hora_salida') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Hora salida</label>
                <input
                  type="time"
                  value={oSalida}
                  onChange={e => setOSalida(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              {allowed.includes('hora_llegada') && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Hora llegada</label>
                  <input
                    type="time"
                    value={oLlegada}
                    onChange={e => setOLlegada(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              )}
            </div>
          )}

          {(tipo === 'cambio_itinerario' || tipo === 'modificado') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Para modificar el itinerario completo crea una nueva ruta con el asistente y ajusta el período.
              </p>
            </div>
          )}

          {existing && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Ya existe una excepción «{SCHEDULE_EXCEPTION_TIPO_LABELS[existing.tipo]}» para esta fecha y sentido.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej: Festivo local, huelga de conductores..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar excepción'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface EstadoActionsBarProps {
  schedule: TradeTransportSchedule;
  saving: boolean;
  onTransition: (t: ScheduleTransition) => void;
}
function EstadoActionsBar({ schedule, saving, onTransition }: EstadoActionsBarProps) {
  const transitions = getAvailableTransitions(schedule.estado);
  if (transitions.length === 0) return null;

  const config: Record<ScheduleTransition, { label: string; icon: React.ReactNode; cls: string }> = {
    activar:   { label: 'Activar',   icon: <Play  className="w-3.5 h-3.5" />, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    pausar:    { label: 'Pausar',    icon: <Pause className="w-3.5 h-3.5" />, cls: 'bg-amber-500 hover:bg-amber-600 text-white' },
    reanudar:  { label: 'Reanudar',  icon: <Play  className="w-3.5 h-3.5" />, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    finalizar: { label: 'Finalizar', icon: <Square className="w-3.5 h-3.5" />, cls: 'bg-slate-700 hover:bg-slate-800 text-white' },
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {transitions.map(t => {
        const c = config[t];
        return (
          <button
            key={t}
            onClick={() => onTransition(t)}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${c.cls}`}
          >
            {c.icon}{c.label}
          </button>
        );
      })}
    </div>
  );
}

interface ScheduleDetailPanelProps {
  schedule: TradeTransportSchedule;
  orgId: string;
  activeTab: ActiveTab;
  onTabChange: (t: ActiveTab) => void;
  clientMap: Record<string, TradeClient>;
  vehicleMap: Record<string, TradeVehicle>;
  workerMap: Record<string, TradeWorker>;
  exceptions: TradeTransportScheduleException[];
  occurrences: CalendarOccurrence[];
  occurrenceLinks: TradeTransportOccurrenceLink[];
  loadingDetail: boolean;
  onBack?: () => void;
  onNavigate?: (tab: string) => void;
  onTransition: (t: ScheduleTransition) => void;
  onAddException: (fecha?: string, sentido?: ScheduleSentido) => void;
  transitionSaving: boolean;
}
function ScheduleDetailPanel({
  schedule, activeTab, onTabChange,
  clientMap, vehicleMap, workerMap,
  exceptions, occurrences, occurrenceLinks,
  loadingDetail, onBack, onNavigate,
  onTransition, onAddException, transitionSaving,
}: ScheduleDetailPanelProps) {
  const today = isoToday();
  const pastCount = occurrenceLinks.filter(l => l.fecha < today).length;

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'resumen',    label: 'Resumen' },
    { key: 'calendario', label: 'Calendario' },
    { key: 'historial',  label: 'Historial' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 bg-white border-b border-slate-100 px-5 pt-4 pb-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3 lg:hidden"
          >
            <ChevronLeft className="w-4 h-4" />Volver
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">{schedule.nombre}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoScheduleColor(schedule.estado)}`}>
                {SCHEDULE_ESTADO_LABELS[schedule.estado]}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tipoColor(schedule.tipo_servicio)}`}>
                {tipoLabel(schedule.tipo_servicio)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>{fmtPeriodo(schedule.periodo_inicio, schedule.periodo_fin)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <EstadoActionsBar
            schedule={schedule}
            saving={transitionSaving}
            onTransition={onTransition}
          />
          {schedule.estado !== 'finalizado' && (
            <button
              onClick={() => onAddException(undefined, undefined)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Excepción
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-100 bg-white px-4">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.key === 'historial' && pastCount > 0 && (
                <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 rounded-full">
                  {pastCount}
                </span>
              )}
              {t.key === 'calendario' && exceptions.length > 0 && (
                <span className="ml-1 text-[9px] bg-amber-100 text-amber-600 px-1 rounded-full">
                  {exceptions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'resumen' ? (
          <ResumenTab
            schedule={schedule}
            clientMap={clientMap}
            vehicleMap={vehicleMap}
            workerMap={workerMap}
          />
        ) : activeTab === 'calendario' ? (
          <CalendarioTab
            schedule={schedule}
            occurrences={occurrences}
            onAddException={onAddException}
            onNavigate={onNavigate}
          />
        ) : (
          <HistorialTab
            occurrenceLinks={occurrenceLinks}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScreenTransporteRutasRecurrentes({ orgId, showToast, onNavigate }: Props) {
  const showToastRef       = useRef(showToast);
  showToastRef.current     = showToast;
  const transitionSavingRef = useRef(false);
  const exceptionSavingRef  = useRef(false);

  const [schedules,       setSchedules]       = useState<TradeTransportSchedule[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [vehicleMap,      setVehicleMap]      = useState<Record<string, TradeVehicle>>({});
  const [workerMap,       setWorkerMap]       = useState<Record<string, TradeWorker>>({});
  const [clientMap,       setClientMap]       = useState<Record<string, TradeClient>>({});
  const [vehicles,        setVehicles]        = useState<TradeVehicle[]>([]);
  const [workers,         setWorkers]         = useState<TradeWorker[]>([]);

  const [filterQuery,     setFilterQuery]     = useState('');
  const [filterTipo,      setFilterTipo]      = useState('');
  const [filterEstado,    setFilterEstado]    = useState<ScheduleEstado | ''>('');

  const [selected,        setSelected]        = useState<TradeTransportSchedule | null>(null);
  const [activeTab,       setActiveTab]       = useState<ActiveTab>('resumen');
  const [mobileView,      setMobileView]      = useState<'list' | 'detail'>('list');

  const [exceptions,      setExceptions]      = useState<TradeTransportScheduleException[]>([]);
  const [occurrenceLinks, setOccurrenceLinks] = useState<TradeTransportOccurrenceLink[]>([]);
  const [loadingDetail,   setLoadingDetail]   = useState(false);

  const [transitionSaving, setTransitionSaving] = useState(false);
  const [exceptionSaving,  setExceptionSaving]  = useState(false);
  const [showExModal,      setShowExModal]      = useState(false);
  const [exModalFecha,     setExModalFecha]     = useState<string | undefined>(undefined);
  const [exModalSentido,   setExModalSentido]   = useState<ScheduleSentido | undefined>(undefined);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [schs, vhs, wks, cls] = await Promise.all([
        loadSchedules(orgId),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
        loadClients(orgId),
      ]);
      setSchedules(schs);
      setVehicles(vhs);
      setWorkers(wks);
      setVehicleMap(Object.fromEntries(vhs.map(v => [v.id, v])));
      setWorkerMap(Object.fromEntries(wks.map(w => [w.id, w])));
      setClientMap(Object.fromEntries(cls.map(c => [c.id, c])));
      setSelected(prev => prev ? (schs.find(s => s.id === prev.id) ?? null) : null);
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    setSelected(null);
    setSchedules([]);
    setExceptions([]);
    setOccurrenceLinks([]);
    setVehicleMap({});
    setWorkerMap({});
    setClientMap({});
    setVehicles([]);
    setWorkers([]);
  }, [orgId]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => { if (!selected) setMobileView('list'); }, [selected]);

  useEffect(() => {
    if (!selected) {
      setExceptions([]);
      setOccurrenceLinks([]);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    Promise.all([
      loadExceptions(selected.id, orgId),
      loadOccurrenceLinks(selected.id, orgId),
    ])
      .then(([exs, lks]) => {
        if (cancelled) return;
        setExceptions(exs);
        setOccurrenceLinks(lks);
      })
      .catch(e => { if (!cancelled) showToastRef.current(errMsg(e), 'error'); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selected?.id, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientNames = useMemo(
    () => Object.fromEntries(
      Object.entries(clientMap).map(([id, c]) => [id, getClientDisplayName(c)])
    ),
    [clientMap],
  );

  const filtered = useMemo(
    () => filterSchedules(schedules, { query: filterQuery, tipo: filterTipo, estado: filterEstado }, clientNames),
    [schedules, filterQuery, filterTipo, filterEstado, clientNames],
  );

  const occurrences = useMemo<CalendarOccurrence[]>(() => {
    if (!selected) return [];
    const from  = new Date();
    from.setHours(0, 0, 0, 0);
    const until = new Date(from);
    until.setDate(until.getDate() + 56);
    return buildCalendarProjection(selected, exceptions, occurrenceLinks, from, until);
  }, [selected, exceptions, occurrenceLinks]);

  function handleSelect(s: TradeTransportSchedule) {
    setSelected(s);
    setActiveTab('resumen');
    setMobileView('detail');
  }

  async function handleTransition(transition: ScheduleTransition) {
    if (!selected || transitionSavingRef.current) return;
    if (transition === 'finalizar') {
      if (!confirm(`¿Finalizar la ruta "${selected.nombre}"? Esta acción no se puede deshacer.`)) return;
    }
    transitionSavingRef.current = true;
    setTransitionSaving(true);
    try {
      const newEstado = applyTransition(selected.estado, transition);
      const updated   = await updateSchedule(selected.id, orgId, { estado: newEstado });
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelected(updated);
      const labels: Record<ScheduleTransition, string> = {
        activar:   'Ruta activada',
        pausar:    'Ruta pausada',
        reanudar:  'Ruta reanudada',
        finalizar: 'Ruta finalizada',
      };
      showToastRef.current(labels[transition], 'success');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      transitionSavingRef.current = false;
      setTransitionSaving(false);
    }
  }

  function handleAddExceptionClick(fecha?: string, sentido?: ScheduleSentido) {
    setExModalFecha(fecha);
    setExModalSentido(sentido);
    setShowExModal(true);
  }

  async function handleSaveException(
    input: Omit<TradeTransportScheduleException, 'id' | 'org_id' | 'created_at'>,
  ) {
    if (exceptionSavingRef.current) return;
    exceptionSavingRef.current = true;
    setExceptionSaving(true);
    try {
      const saved = await createException(orgId, input);
      setExceptions(prev => [...prev, saved]);
      setShowExModal(false);
      showToastRef.current('Excepción guardada', 'success');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      exceptionSavingRef.current = false;
      setExceptionSaving(false);
    }
  }

  const TIPO_RECURRENTE = TIPO_SERVICIO_OPTIONS.filter(t =>
    ['ruta_escolar', 'transporte_trabajadores', 'lanzadera', 'servicio_deportivo', 'asociacion_grupo'].includes(t.value)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex gap-4">
        <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-3 overflow-hidden ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Buscar ruta o cliente..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterTipo}
                onChange={e => setFilterTipo(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Todos los tipos</option>
                {TIPO_RECURRENTE.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterEstado}
                onChange={e => setFilterEstado(e.target.value as ScheduleEstado | '')}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Todos los estados</option>
                {(Object.entries(SCHEDULE_ESTADO_LABELS) as [ScheduleEstado, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-3">
                <CalendarDays className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">Sin rutas</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {filterQuery || filterTipo || filterEstado
                    ? 'Ninguna ruta coincide con los filtros.'
                    : 'Crea rutas desde Servicios → "Ruta recurrente".'}
                </p>
              </div>
            )}
            {!loading && filtered.map(s => (
              <ScheduleListRow
                key={s.id}
                schedule={s}
                selected={selected?.id === s.id}
                clientMap={clientMap}
                vehicleMap={vehicleMap}
                workerMap={workerMap}
                onClick={() => handleSelect(s)}
              />
            ))}
          </div>
        </div>

        <div className={`flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {selected ? (
            <ScheduleDetailPanel
              key={selected.id}
              schedule={selected}
              orgId={orgId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              clientMap={clientMap}
              vehicleMap={vehicleMap}
              workerMap={workerMap}
              exceptions={exceptions}
              occurrences={occurrences}
              occurrenceLinks={occurrenceLinks}
              loadingDetail={loadingDetail}
              onBack={() => setMobileView('list')}
              onNavigate={onNavigate}
              onTransition={handleTransition}
              onAddException={handleAddExceptionClick}
              transitionSaving={transitionSaving}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Route className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-500">Selecciona una ruta</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Elige una ruta de la lista para ver su configuración, calendario y historial.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showExModal && selected && (
        <ExceptionModal
          schedule={selected}
          vehicles={vehicles}
          workers={workers}
          existingExceptions={exceptions}
          initFecha={exModalFecha}
          initSentido={exModalSentido}
          saving={exceptionSaving}
          onSave={handleSaveException}
          onClose={() => setShowExModal(false)}
        />
      )}
    </div>
  );
}
