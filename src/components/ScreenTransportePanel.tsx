/**
 * ScreenTransportePanel — Centro de gestión de tráfico multimodal
 * TX-MC-0-FIX-3: tres pestañas (General · Viajeros · Mercancías),
 * Gantt de día, panel de pendientes y contenido contextual por modalidad.
 *
 * Datos reales de la organización autenticada. Sin valores ficticios.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bus, Truck, Package, Users, Calendar, AlertTriangle,
  MapPin, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Wrench, UserCheck, Plus, ArrowRight, Clock, Route,
  Shield, FileWarning, CheckCircle2, Lock, Layers,
} from 'lucide-react';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_COLORS,
  loadServicesOverlappingRange,
} from '../lib/transportServices';
import type { TradeTransportService } from '../lib/transportServices';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadWorkers } from '../lib/supabase';
import type { TradeWorker } from '../lib/supabase';
import {
  computeKpis,
  getVehicleFleetStatus,
  getProximasSalidas,
  isVehiclePassenger,
  isVehicleOutOfService,
  startOfWeek,
  addDays,
  isoDate,
  classifyTimeSlot,
  getServicesForDay,
  serviceOverlapsDay,
  computeVehicleAlerts,
  getAssignedConductorIds,
  type FleetStatus,
  type VehicleAlertItem,
  type OccurrenceForKpi,
} from '../lib/transportPanelHelpers';
import {
  buildAgendaOccurrences,
  type AgendaOccurrence,
} from './ScreenTransporteAgenda';
import ScreenTransporteViajes from './ScreenTransporteViajes';
import {
  loadSchedulesActive,
  loadExceptionsForRange,
  loadOccurrenceLinksForRange,
} from '../lib/transportSchedules';
import { loadTripsOverlappingRange } from '../lib/transportTrips';
import type { TradeTransportTrip } from '../lib/transportTrips';

// ── Vehicle helpers ────────────────────────────────────────────────────────────

function isVehicleCargo(v: Pick<TradeVehicle, 'modalidad'>): boolean {
  return v.modalidad === 'mercancias' || v.modalidad === 'reparto' || v.modalidad === 'mixto';
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function isModuleNotDeployed(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; message?: string };
  const code = err.code ?? '';
  const msg  = err.message ?? '';
  return ['42P01', '42883', 'PGRST202', 'PGRST116'].includes(code)
    || msg.includes('does not exist');
}

function estadoColor(estado: string): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.color
    ?? 'bg-slate-100 text-slate-600 border-slate-200';
}
function estadoLabel(estado: string): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.label ?? estado;
}

const DAYS_ES    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS_ES  = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtDayShort(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

// ── Gantt constants ────────────────────────────────────────────────────────────

const GANTT_START_H       = 0;   // 00:00
const GANTT_END_H         = 24;  // 24:00
const GANTT_RANGE_H       = 24;
const GANTT_HOUR_MARKS    = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
// Min-width of the scrollable timeline area — ensures ≥40px per 2-hour mark
const GANTT_TIMELINE_MIN_W = 960;

/**
 * Returns the Gantt position for a service, correctly handling:
 * - Services that start before the window (07:00): left=0, width clips to visible range.
 * - Services that end after the window (21:00): width clips at window end.
 * - Midnight-crossing services: end < start → add 24h to end.
 * - Services fully outside the window: width=0 (invisible).
 */
function servicePosition(start: string, end: string | null | undefined): { left: number; width: number } {
  const s = new Date(start);
  if (isNaN(s.getTime())) return { left: 0, width: 0 };

  const startH = s.getHours() + s.getMinutes() / 60;
  const endDate = end ? new Date(end) : new Date(s.getTime() + 2 * 3600 * 1000);
  let endH = endDate.getHours() + endDate.getMinutes() / 60;
  // Midnight-crossing: end of day appears as 0 or early next morning
  if (endH < startH) endH += 24;

  const visStart = Math.max(startH, GANTT_START_H);
  const visEnd   = Math.min(endH, GANTT_END_H);
  if (visEnd <= visStart) return { left: 0, width: 0 };

  return {
    left:  Math.max(0, (startH - GANTT_START_H) / GANTT_RANGE_H * 100),
    width: Math.max(1.5, (visEnd - visStart) / GANTT_RANGE_H * 100),
  };
}

function timeToPercent(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(100, (hours - GANTT_START_H) / GANTT_RANGE_H * 100));
}

// ── KPI card ──────────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: 'text-blue-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    icon: 'text-teal-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: 'text-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  icon: 'text-purple-500' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: 'text-red-500' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   icon: 'text-slate-400' },
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  badge?: string;
  sub?: string;
  accent?: keyof typeof ACCENT_MAP;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, badge, sub, accent = 'slate', onClick }: KpiCardProps) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.slate;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={`relative overflow-hidden rounded-xl border p-3.5 text-left transition-all shadow-xs ${a.border} ${a.bg}
        ${onClick ? 'cursor-pointer hover:shadow-sm hover:brightness-95' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`${a.icon}`}>{icon}</span>
        {badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${a.border} ${a.text} uppercase tracking-wide`}>
            {badge}
          </span>
        )}
      </div>
      <p className={`text-2xl font-black leading-none mb-0.5 ${a.text}`}>{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      {sub && <span className="text-[10px] opacity-60 leading-tight text-slate-500">{sub}</span>}
    </Tag>
  );
}

// ── Calendar service card ──────────────────────────────────────────────────────

function CalServiceCard({ svc, vehicleMap, workerMap, onClick }: {
  svc: TradeTransportService;
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  onClick?: () => void;
}) {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)   : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id)  : undefined;
  const typeColor = TIPO_SERVICIO_COLORS[svc.tipo_servicio] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const isEnCurso  = svc.estado === 'en_curso';
  const isCancelled = svc.estado === 'cancelado';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-2 py-1.5 text-[10.5px] leading-tight transition-all hover:shadow-sm ${
        isCancelled ? 'opacity-40 line-through bg-slate-50 border-slate-200' :
        isEnCurso   ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' :
                      `${typeColor} hover:opacity-90`
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="font-bold truncate">{fmtTime(svc.fecha_inicio)}</span>
        {vehicle && <span className="font-semibold shrink-0 opacity-75">{vehicle.matricula}</span>}
      </div>
      <p className="font-semibold truncate text-[11px]">{svc.titulo}</p>
      {(svc.origen || svc.destino) && (
        <p className="truncate opacity-70 mt-0.5">{[svc.origen, svc.destino].filter(Boolean).join(' → ')}</p>
      )}
      {conductor && (
        <p className="truncate opacity-70 flex items-center gap-0.5 mt-0.5">
          <UserCheck className="w-2.5 h-2.5 shrink-0" />{conductor.nombre}
        </p>
      )}
    </button>
  );
}

// ── Occurrence card ────────────────────────────────────────────────────────────

function CalOccurrenceCard({ occ, workerMap, vehicleMap, onClick }: {
  occ: AgendaOccurrence;
  workerMap: Map<string, TradeWorker>;
  vehicleMap: Map<string, TradeVehicle>;
  onClick?: () => void;
}) {
  const conductor = occ.effectiveConductorId ? workerMap.get(occ.effectiveConductorId) : undefined;
  const vehicle   = occ.effectiveVehicleId   ? vehicleMap.get(occ.effectiveVehicleId)  : undefined;
  const isSusp    = occ.status === 'suspended' || occ.status === 'no_circula';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-2 py-1.5 text-[10.5px] leading-tight transition-all hover:shadow-sm
        ${isSusp ? 'opacity-35 line-through bg-slate-50 border-slate-200' : 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="font-bold truncate">{occ.effectiveHoraSalida ?? '—'}</span>
        {vehicle && <span className="font-semibold shrink-0 opacity-75">{vehicle.matricula}</span>}
      </div>
      <p className="font-semibold truncate text-[11px]">{occ.schedule.nombre}</p>
      {conductor && (
        <p className="truncate opacity-70 flex items-center gap-0.5 mt-0.5">
          <UserCheck className="w-2.5 h-2.5 shrink-0" />{conductor.nombre}
        </p>
      )}
      <span className="text-[9px] opacity-60 uppercase tracking-wide">Ruta recurrente</span>
    </button>
  );
}

// ── Weekly calendar column ─────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
const SLOT_ORDER = ['manana', 'tarde', 'noche'] as const;
const SLOT_BG: Record<string, string> = { manana: 'bg-amber-50/50', tarde: 'bg-sky-50/50', noche: '' };

function DayColumn({ day, today, services, occurrences, vehicleMap, workerMap, onNavigate }: {
  day: Date;
  today: string;
  services: TradeTransportService[];
  occurrences: AgendaOccurrence[];
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  onNavigate?: (tab: string, action?: string) => void;
}) {
  const dayStr  = isoDate(day);
  const isToday = dayStr === today;
  const isPast  = dayStr < today;
  const dayServices = getServicesForDay(services, dayStr);
  const dayOccs     = occurrences.filter(o => o.fecha === dayStr);

  type SlotKey = 'manana' | 'tarde' | 'noche';
  const slots: Record<SlotKey, TradeTransportService[]> = { manana: [], tarde: [], noche: [] };
  for (const s of dayServices) {
    const slot = classifyTimeSlot(s.fecha_inicio) as SlotKey;
    slots[slot].push(s);
  }
  const occSlots: Record<SlotKey, AgendaOccurrence[]> = { manana: [], tarde: [], noche: [] };
  for (const o of dayOccs) {
    const hora = o.effectiveHoraSalida ?? '06:00';
    const slot = classifyTimeSlot(`${o.fecha}T${hora}`) as SlotKey;
    occSlots[slot].push(o);
  }

  const totalItems = dayServices.length + dayOccs.length;

  return (
    <div className={`p-2 min-h-[120px] ${isPast ? 'opacity-60' : ''} ${isToday ? 'bg-blue-50/30' : ''}`}>
      <div className={`text-[10px] font-bold mb-1.5 flex items-center gap-1 ${isToday ? 'text-blue-700' : 'text-slate-500'}`}>
        <span>{DAYS_ES[(day.getDay() + 6) % 7]}</span>
        <span className={`${isToday ? 'bg-blue-600 text-white px-1.5 rounded-full' : ''}`}>
          {fmtDayShort(day)}
        </span>
        {totalItems > 0 && (
          <span className="ml-auto text-[9px] font-semibold bg-slate-200/80 text-slate-600 px-1.5 rounded-full">{totalItems}</span>
        )}
      </div>

      {totalItems === 0 ? (
        <p className="text-[9px] text-slate-300 italic">Sin servicios</p>
      ) : (
        SLOT_ORDER.map(slot => {
          const svcs = slots[slot];
          const occs = occSlots[slot];
          if (svcs.length === 0 && occs.length === 0) return null;
          return (
            <div key={slot} className={`rounded-lg mb-1 p-1 ${SLOT_BG[slot]}`}>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{SLOT_LABELS[slot]}</p>
              <div className="space-y-0.5">
                {svcs.map(s => (
                  <CalServiceCard key={s.id} svc={s} vehicleMap={vehicleMap} workerMap={workerMap}
                    onClick={() => onNavigate?.('transporte_servicios')} />
                ))}
                {occs.map((o, i) => (
                  <CalOccurrenceCard key={i} occ={o} workerMap={workerMap} vehicleMap={vehicleMap}
                    onClick={() => onNavigate?.('transporte_agenda')} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Vehicle alert icon ─────────────────────────────────────────────────────────

function AlertIcon({ type, severity }: { type: VehicleAlertItem['type']; severity: 'warning' | 'error' }) {
  const cls = severity === 'error' ? 'text-red-500' : 'text-amber-500';
  if (type === 'itv_proxima' || type === 'itv_vencida') return <FileWarning className={`w-4 h-4 shrink-0 ${cls}`} />;
  if (type === 'seguro_proximo' || type === 'seguro_vencido') return <Shield className={`w-4 h-4 shrink-0 ${cls}`} />;
  if (type === 'en_mantenimiento') return <Wrench className={`w-4 h-4 shrink-0 ${cls}`} />;
  return <AlertTriangle className={`w-4 h-4 shrink-0 ${cls}`} />;
}

// ── Gantt timeline ─────────────────────────────────────────────────────────────

interface GanttProps {
  services: TradeTransportService[];
  trips: TradeTransportTrip[];
  vehicles: TradeVehicle[];
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  isMercanciasPrimary: boolean;
  isCombinadaOrg: boolean;
  onNavigate?: (tab: string) => void;
}

function GanttTimeline({ services, trips, vehicles, vehicleMap, workerMap, isMercanciasPrimary, isCombinadaOrg, onNavigate }: GanttProps) {
  const activeVehicles = useMemo(() => {
    const active = vehicles.filter(v => v.activo);
    if (!isCombinadaOrg && isMercanciasPrimary) return active.filter(v => isVehicleCargo(v));
    if (!isCombinadaOrg && !isMercanciasPrimary) return active.filter(v => isVehiclePassenger(v));
    return active; // combinada: all vehicles
  }, [vehicles, isMercanciasPrimary, isCombinadaOrg]);

  // Group services by vehicle
  const servicesByVehicle = useMemo(() => {
    const map = new Map<string | null, TradeTransportService[]>();
    for (const svc of services) {
      const key = svc.vehicle_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    return map;
  }, [services]);

  const unassignedServices = servicesByVehicle.get(null) ?? [];

  // Group trips (TX-MC-1) by vehicle
  const tripsByVehicle = useMemo(() => {
    const map = new Map<string | null, TradeTransportTrip[]>();
    for (const t of trips) {
      const key = t.vehicle_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [trips]);

  const unassignedTrips = tripsByVehicle.get(null) ?? [];

  function vehicleColor(v: TradeVehicle): { block: string; dot: string } {
    if (isVehiclePassenger(v)) return { block: 'bg-blue-500 hover:bg-blue-600', dot: 'bg-blue-500' };
    return { block: 'bg-amber-500 hover:bg-amber-600', dot: 'bg-amber-500' };
  }

  function serviceBlockColor(v: TradeVehicle, svc: TradeTransportService): string {
    if (svc.estado === 'cancelado') return 'bg-slate-300 opacity-50';
    if (svc.estado === 'en_curso') return isVehiclePassenger(v) ? 'bg-blue-500' : 'bg-amber-500';
    if (svc.estado === 'borrador') return isVehiclePassenger(v) ? 'bg-blue-200' : 'bg-amber-200';
    if (svc.estado === 'confirmado') return isVehiclePassenger(v) ? 'bg-blue-300' : 'bg-amber-300';
    return isVehiclePassenger(v) ? 'bg-blue-400' : 'bg-amber-400';
  }

  const vehicleCapacityLabel = (v: TradeVehicle): string => {
    if (v.capacidad_viajeros) return `${v.capacidad_viajeros} plazas`;
    if (v.capacidad_carga_kg) {
      const t = (v.capacidad_carga_kg / 1000);
      return `${t % 1 === 0 ? t : t.toFixed(1)} t`;
    }
    return '';
  };

  if (activeVehicles.length === 0 && services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
        <Bus className="w-10 h-10 opacity-30" />
        <p className="text-sm text-center">No hay vehículos activos configurados</p>
        <button
          onClick={() => onNavigate?.('transporte_vehiculos')}
          className="text-xs text-blue-600 hover:underline font-semibold"
        >Añadir vehículos →</button>
      </div>
    );
  }

  const statusBadgeCls: Record<string, string> = {
    en_curso:   'bg-white/30 text-white',
    confirmado: 'bg-white/20 text-white/80',
    completado: 'bg-white/20 text-white/80',
    borrador:   'bg-white/15 text-white/70',
  };

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${GANTT_TIMELINE_MIN_W}px` }}>
        {/* Hour axis header */}
        <div className="flex text-[10px] text-slate-400 font-medium mb-1 pl-[168px] select-none">
          {GANTT_HOUR_MARKS.map(h => (
            <div key={h} className="flex-1 text-center">{h.toString().padStart(2, '0')}:00</div>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {activeVehicles.map(vehicle => {
            const svcs  = servicesByVehicle.get(vehicle.id) ?? [];
            const trps  = tripsByVehicle.get(vehicle.id) ?? [];
            const colors = vehicleColor(vehicle);
            const isOos  = isVehicleOutOfService(vehicle);
            const hasContent = svcs.some(s => s.estado !== 'cancelado') || trps.some(t => t.estado !== 'cancelado');

            return (
              <div key={vehicle.id} className={`flex items-start gap-0 min-h-[56px] ${isOos ? 'opacity-50' : ''}`}>
                {/* Vehicle label cell */}
                <div className="w-[168px] shrink-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{vehicle.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{vehicle.matricula}</p>
                    </div>
                  </div>
                  {vehicleCapacityLabel(vehicle) && (
                    <p className="text-[9px] text-slate-400 pl-4 mt-0.5">{vehicleCapacityLabel(vehicle)}</p>
                  )}
                </div>

                {/* Timeline cell — services (upper band) + trips (lower band) */}
                <div className="flex-1 relative h-[56px] bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                  {/* Grid lines */}
                  {GANTT_HOUR_MARKS.map(h => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px bg-slate-200/70"
                      style={{ left: `${(h - GANTT_START_H) / GANTT_RANGE_H * 100}%` }}
                    />
                  ))}

                  {/* Band separator (only when both types present) */}
                  {svcs.some(s => s.estado !== 'cancelado') && trps.some(t => t.estado !== 'cancelado') && (
                    <div className="absolute left-0 right-0 h-px bg-slate-200" style={{ top: '28px' }} />
                  )}

                  {/* Current time indicator */}
                  {(() => {
                    const now = new Date();
                    const pct = timeToPercent(now.toISOString());
                    if (pct <= 0 || pct >= 100) return null;
                    return <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${pct}%` }} />;
                  })()}

                  {/* Service blocks — upper band (top 1px → 27px) */}
                  {svcs.filter(s => s.estado !== 'cancelado').map(svc => {
                    const pos = servicePosition(svc.fecha_inicio, svc.fecha_fin);
                    if (pos.width === 0) return null;
                    const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
                    return (
                      <button
                        key={svc.id}
                        onClick={() => onNavigate?.('transporte_servicios')}
                        className={`absolute rounded px-2 py-0.5 text-left text-white text-[9px] font-semibold truncate transition-opacity hover:opacity-90 cursor-pointer z-5 ${serviceBlockColor(vehicle, svc)}`}
                        style={{ left: `${pos.left}%`, width: `${pos.width}%`, minWidth: '36px', top: '2px', height: '24px' }}
                        title={`${svc.titulo}${conductor ? ` · ${conductor.nombre}` : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1 leading-none h-full">
                          <span className="truncate font-bold">{svc.origen && svc.destino ? `${svc.origen} → ${svc.destino}` : svc.titulo}</span>
                          <span className={`shrink-0 text-[7px] px-1 rounded-full font-bold ${statusBadgeCls[svc.estado] ?? 'bg-white/20 text-white/80'}`}>
                            {estadoLabel(svc.estado)}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Trip blocks (TX-MC-1) — lower band (top 30px → bottom 2px) */}
                  {trps.filter(t => t.estado !== 'cancelado').map(trp => {
                    const pos = servicePosition(trp.fecha_inicio, trp.fecha_fin);
                    if (pos.width === 0) return null;
                    const conductor = trp.conductor_id ? workerMap.get(trp.conductor_id) : undefined;
                    const tripColor = trp.estado === 'en_curso' ? 'bg-orange-500 hover:bg-orange-600'
                      : trp.estado === 'confirmado' ? 'bg-orange-400 hover:bg-orange-500'
                      : trp.estado === 'completado' ? 'bg-orange-600 hover:bg-orange-700 opacity-70'
                      : 'bg-orange-200 hover:bg-orange-300 text-orange-800';
                    return (
                      <button
                        key={trp.id}
                        onClick={() => onNavigate?.('mercancias')}
                        className={`absolute rounded px-1.5 py-0 text-left text-[9px] font-semibold truncate transition-opacity hover:opacity-90 cursor-pointer z-5 text-white ${tripColor}`}
                        style={{ left: `${pos.left}%`, width: `${pos.width}%`, minWidth: '36px', top: '30px', height: '22px' }}
                        title={`📦 ${trp.titulo}${conductor ? ` · ${conductor.nombre}` : ''} (${trp.origen} → ${trp.destino})`}
                      >
                        <div className="flex items-center gap-1 leading-none h-full">
                          <Package className="w-2.5 h-2.5 shrink-0 opacity-80" />
                          <span className="truncate">{trp.origen && trp.destino ? `${trp.origen} → ${trp.destino}` : trp.titulo}</span>
                        </div>
                      </button>
                    );
                  })}

                  {!hasContent && !isOos && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] text-slate-300 font-medium">Libre</span>
                    </div>
                  )}
                  {isOos && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50">
                      <span className="text-[9px] text-slate-400 font-medium italic">No operativo</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned services row */}
          {unassignedServices.filter(s => s.estado !== 'cancelado').length > 0 && (
            <div className="flex items-start gap-0 min-h-[32px]">
              <div className="w-[168px] shrink-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500 truncate leading-tight">Sin vehículo</p>
                    <p className="text-[9px] text-blue-500 font-semibold">Servicios pdte.</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative h-[32px] bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                {GANTT_HOUR_MARKS.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 w-px bg-blue-200/50" style={{ left: `${(h - GANTT_START_H) / GANTT_RANGE_H * 100}%` }} />
                ))}
                {unassignedServices.filter(s => s.estado !== 'cancelado').map(svc => {
                  const pos = servicePosition(svc.fecha_inicio, svc.fecha_fin);
                  if (pos.width === 0) return null;
                  return (
                    <button key={svc.id} onClick={() => onNavigate?.('transporte_servicios')}
                      className="absolute top-1 bottom-1 rounded px-2 py-0.5 bg-blue-400 hover:bg-blue-500 text-white text-[9.5px] font-semibold truncate"
                      style={{ left: `${pos.left}%`, width: `${pos.width}%`, minWidth: '40px' }}
                      title={svc.titulo}
                    >
                      {svc.titulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unassigned trips row */}
          {unassignedTrips.filter(t => t.estado !== 'cancelado').length > 0 && (
            <div className="flex items-start gap-0 min-h-[32px]">
              <div className="w-[168px] shrink-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-orange-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500 truncate leading-tight">Sin vehículo</p>
                    <p className="text-[9px] text-orange-500 font-semibold">Viajes pdte.</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative h-[32px] bg-orange-50 rounded-lg border border-orange-200 overflow-hidden">
                {GANTT_HOUR_MARKS.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 w-px bg-orange-200/50" style={{ left: `${(h - GANTT_START_H) / GANTT_RANGE_H * 100}%` }} />
                ))}
                {unassignedTrips.filter(t => t.estado !== 'cancelado').map(trp => {
                  const pos = servicePosition(trp.fecha_inicio, trp.fecha_fin);
                  if (pos.width === 0) return null;
                  return (
                    <button key={trp.id} onClick={() => onNavigate?.('mercancias')}
                      className="absolute top-1 bottom-1 rounded px-2 py-0.5 bg-orange-400 hover:bg-orange-500 text-white text-[9.5px] font-semibold truncate flex items-center gap-1"
                      style={{ left: `${pos.left}%`, width: `${pos.width}%`, minWidth: '40px' }}
                      title={trp.titulo}
                    >
                      <Package className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{trp.titulo}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 pt-1 text-[9px] text-slate-400 font-medium pl-1">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" />Viajeros</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" />Servicios carga</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-orange-400 inline-block" />Viajes mercancías</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pending assignments panel ──────────────────────────────────────────────────

function PendingAssignmentsPanel({ services, vehicles, workers, vehicleMap, workerMap, isMercanciasPrimary, isCombinadaOrg, onNavigate }: {
  services: TradeTransportService[];
  vehicles: TradeVehicle[];
  workers: TradeWorker[];
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  isMercanciasPrimary: boolean;
  isCombinadaOrg: boolean;
  onNavigate?: (tab: string) => void;
}) {
  const pending = services.filter(s =>
    s.estado !== 'cancelado' && s.estado !== 'completado' &&
    (!s.conductor_id || !s.vehicle_id)
  );

  // Shared conductor availability conflicts: conductors assigned to >1 service at same time
  const conflicts: { conductor: TradeWorker; until: string }[] = useMemo(() => {
    const conductorWorkers = workers.filter(w => w.es_conductor);
    return conductorWorkers
      .filter(w => {
        const assigned = services.filter(s => s.conductor_id === w.id && s.estado === 'en_curso');
        return assigned.length > 0;
      })
      .map(w => {
        const latest = services
          .filter(s => s.conductor_id === w.id && s.estado === 'en_curso' && s.fecha_fin)
          .sort((a, b) => (b.fecha_fin ?? '').localeCompare(a.fecha_fin ?? ''));
        return { conductor: w, until: latest[0]?.fecha_fin ?? '' };
      });
  }, [services, workers]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">
          Pendientes de asignación
          {pending.length > 0 && (
            <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{pending.length}</span>
          )}
        </h3>

        {pending.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs">Todo asignado correctamente</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pending.slice(0, 5).map(svc => {
              const vehicle = svc.vehicle_id ? vehicleMap.get(svc.vehicle_id) : undefined;
              const isCargo = vehicle ? isVehicleCargo(vehicle) : false;
              const borderCls = isMercanciasPrimary || (isCombinadaOrg && isCargo)
                ? 'border-l-amber-400' : 'border-l-blue-400';
              return (
                <button key={svc.id} onClick={() => onNavigate?.('transporte_servicios')}
                  className={`w-full text-left border border-slate-100 border-l-4 ${borderCls} rounded-lg p-2.5 hover:bg-slate-50 transition-colors`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {(isMercanciasPrimary || (isCombinadaOrg && isCargo))
                      ? <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">Mercancías</span>
                      : <span className="text-[8px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full uppercase">Viajeros</span>
                    }
                    <span className="text-[8px] text-slate-400">{fmtTime(svc.fecha_inicio)}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate leading-tight">{svc.titulo}</p>
                  {(svc.origen || svc.destino) && (
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {[svc.origen, svc.destino].filter(Boolean).join(' → ')}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    {!svc.vehicle_id && (
                      <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Sin vehículo</span>
                    )}
                    {!svc.conductor_id && (
                      <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Sin conductor</span>
                    )}
                  </div>
                </button>
              );
            })}
            {pending.length > 5 && (
              <button onClick={() => onNavigate?.('transporte_servicios')}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold w-full text-center py-1">
                +{pending.length - 5} más →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conductor availability conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <h3 className="text-xs font-black text-amber-800">Disponibilidad compartida</h3>
          </div>
          {conflicts.map(({ conductor, until }) => (
            <div key={conductor.id} className="flex items-center gap-2 text-[10px] text-amber-700">
              <UserCheck className="w-3 h-3 shrink-0 text-amber-600" />
              <span className="font-semibold">{conductor.nombre}</span>
              <span className="text-amber-500">ocupado{until ? ` hasta las ${fmtTime(until)}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string | null;
  isViajerosPrimary?: boolean;
  isMercanciasPrimary?: boolean;
  isCombinadaOrg?: boolean;
  /** Legacy org with transport_enabled but no identifiable modality (e.g. oficio='mudanzas'). Shows informative banner. */
  isLegacyTransport?: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string, action?: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransportePanel({
  orgId,
  isViajerosPrimary = true,
  isMercanciasPrimary = false,
  isCombinadaOrg = false,
  isLegacyTransport = false,
  showToast,
  onNavigate,
}: Props) {
  const today = isoDate(new Date());

  // Tab access derived from modalidad (not localStorage — authoritative from props)
  const viajeroEnabled   = isViajerosPrimary || isCombinadaOrg;
  const mercanciasEnabled = isMercanciasPrimary || isCombinadaOrg;
  const defaultTab = 'general';

  type PanelTab = 'general' | 'viajeros' | 'mercancias';
  const [panelTab, setPanelTab] = useState<PanelTab>(defaultTab);

  // Guard: if active tab becomes disabled (org data changed), reset to general
  useEffect(() => {
    if (panelTab === 'viajeros' && !viajeroEnabled) setPanelTab('general');
    if (panelTab === 'mercancias' && !mercanciasEnabled) setPanelTab('general');
  }, [panelTab, viajeroEnabled, mercanciasEnabled]);

  // Day navigation for Gantt (relative to weekStart)
  const [ganttDayIdx, setGanttDayIdx] = useState<number>(() => {
    const todayDow = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
    return todayDow;
  });

  // ── Week navigation ──────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekEnd  = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Data state ───────────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [weekLoading,   setWeekLoading]   = useState(false);
  const [todayServices, setTodayServices] = useState<TradeTransportService[]>([]);
  const [weekServices,  setWeekServices]  = useState<TradeTransportService[]>([]);
  const [weekTrips,     setWeekTrips]     = useState<TradeTransportTrip[]>([]);
  const [occurrences,   setOccurrences]   = useState<AgendaOccurrence[]>([]);
  const [vehicles,      setVehicles]      = useState<TradeVehicle[]>([]);
  const [workers,       setWorkers]       = useState<TradeWorker[]>([]);
  const [vehicleMap,    setVehicleMap]    = useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap,     setWorkerMap]     = useState<Map<string, TradeWorker>>(new Map());
  const [error,         setError]         = useState<string | null>(null);

  // ── Load: vehicles + workers ─────────────────────────────────────────────────
  const loadBase = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [vehs, wrks] = await Promise.all([
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
      ]);
      setVehicles(vehs);
      setWorkers(wrks);
      const vm = new Map<string, TradeVehicle>();
      for (const v of vehs) vm.set(v.id, v);
      setVehicleMap(vm);
      const wm = new Map<string, TradeWorker>();
      for (const w of wrks) wm.set(w.id, w);
      setWorkerMap(wm);
    } catch (e) {
      const msg = errMsg(e);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // ── Load: week services + schedules ─────────────────────────────────────────
  const loadWeek = useCallback(async () => {
    if (!orgId) return;
    setWeekLoading(true);
    try {
      // Unified UTC boundaries for the week window.
      // weekStart/weekEnd have local midnight (startOfWeek → setHours(0,0,0,0) and addDays).
      // toISOString() converts each local instant to its UTC equivalent, so PostgREST/PG
      // compares timestamptz values correctly regardless of the Spain UTC+1/UTC+2 offset.
      const weekDesde = weekStart.toISOString();
      const weekHasta = new Date(
        weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999,
      ).toISOString();

      const [svcs, todaySvcs, trps, schedules, exceptions, links] = await Promise.all([
        loadServicesOverlappingRange(orgId, weekDesde, weekHasta),
        weekOffset === 0
          ? loadServicesOverlappingRange(orgId, `${today}T00:00:00`, `${today}T23:59:59`)
          : Promise.resolve([] as TradeTransportService[]),
        loadTripsOverlappingRange(orgId, weekDesde, weekHasta)
          .catch(e => isModuleNotDeployed(e) ? [] as TradeTransportTrip[] : Promise.reject(e)),
        loadSchedulesActive(orgId).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
        loadExceptionsForRange(orgId, isoDate(weekStart), isoDate(weekEnd)).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
        loadOccurrenceLinksForRange(orgId, isoDate(weekStart), isoDate(weekEnd)).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
      ]);

      setWeekServices(svcs);
      setWeekTrips(trps);
      if (weekOffset === 0) setTodayServices(todaySvcs);

      const occs = buildAgendaOccurrences(schedules, exceptions, links, weekStart, weekEnd);
      setOccurrences(occs);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setWeekLoading(false);
    }
  }, [orgId, weekStart, weekEnd, weekOffset, today]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (!loading) loadWeek(); }, [loadWeek, loading]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const passengerVehicles = useMemo(() => vehicles.filter(v => v.activo && isVehiclePassenger(v)), [vehicles]);
  const cargoVehicles     = useMemo(() => vehicles.filter(v => v.activo && isVehicleCargo(v)), [vehicles]);

  const displayVehicles = useMemo(() => {
    if (isCombinadaOrg) return vehicles.filter(v => v.activo);
    if (isMercanciasPrimary) return cargoVehicles;
    return passengerVehicles;
  }, [vehicles, passengerVehicles, cargoVehicles, isMercanciasPrimary, isCombinadaOrg]);

  const fleetStatuses = useMemo(
    () => passengerVehicles.map(v => ({ vehicle: v, status: getVehicleFleetStatus(v, todayServices) })),
    [passengerVehicles, todayServices],
  );

  const countByStatus = (s: FleetStatus) => fleetStatuses.filter(f => f.status === s).length;

  const assignedCount    = countByStatus('en_servicio') + countByStatus('programado');
  const availableCount   = countByStatus('sin_asignacion');
  const maintenanceVehicles = vehicles.filter(v => v.estado === 'en_mantenimiento' || v.estado === 'baja');

  const conductorWorkers = workers.filter(w => w.es_conductor);
  const kpis             = useMemo(() => computeKpis(todayServices), [todayServices]);

  const assignedConductorIds = useMemo(
    () => getAssignedConductorIds(todayServices, occurrences as OccurrenceForKpi[], today),
    [todayServices, occurrences, today],
  );
  const sinAsignacionHoy = conductorWorkers.filter(w => !assignedConductorIds.has(w.id)).length;

  const weekServicesCount = weekServices.filter(s => s.estado !== 'cancelado').length;

  const now              = new Date();
  const proximasSalidas  = getProximasSalidas(weekServices, now).slice(0, 6);

  const vehicleAlerts = useMemo(() => computeVehicleAlerts(vehicles, today), [vehicles, today]);
  const alertCount    = vehicleAlerts.length;

  // Gantt: services and trips for selected day
  const ganttDay     = weekDays[ganttDayIdx] ?? new Date();
  const ganttDayStr  = isoDate(ganttDay);
  const ganttServices = useMemo(
    () => getServicesForDay(weekServices, ganttDayStr).filter(s => s.estado !== 'cancelado'),
    [weekServices, ganttDayStr],
  );
  const ganttTrips = useMemo(
    () => weekTrips.filter(t => {
      if (t.estado === 'cancelado') return false;
      // Use serviceOverlapsDay (Date-based) instead of slice(0,10) to avoid
      // UTC vs local date mismatch for trips near midnight in UTC+1/UTC+2 (Spain).
      return serviceOverlapsDay(
        { fecha_inicio: t.fecha_inicio, fecha_fin: t.fecha_fin ?? null },
        ganttDayStr,
      );
    }),
    [weekTrips, ganttDayStr],
  );

  const weekLabel = (() => {
    const s  = weekStart;
    const e  = weekEnd;
    const sm = MONTHS_ES[s.getMonth()];
    const em = MONTHS_ES[e.getMonth()];
    if (sm === em) return `${s.getDate()} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${e.getFullYear()}`;
  })();

  const [mobileDay, setMobileDay] = useState(0);

  // ── Render helpers ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando panel...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
        <button onClick={loadBase} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  // ── Tab pill ─────────────────────────────────────────────────────────────────

  function TabPill({ id, label, icon, enabled }: { id: PanelTab; label: string; icon: React.ReactNode; enabled: boolean }) {
    const isActive = panelTab === id;
    if (!enabled) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 bg-slate-100 cursor-not-allowed select-none border border-slate-200"
          title="Modalidad no habilitada para esta organización">
          {icon}
          <span>{label}</span>
          <Lock className="w-3 h-3 ml-1 opacity-60" />
        </div>
      );
    }
    return (
      <button
        onClick={() => setPanelTab(id)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
          isActive
            ? id === 'general'
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
              : id === 'viajeros'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-amber-500 text-white shadow-sm shadow-amber-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  // ── Fleet status block (reusable) ────────────────────────────────────────────

  function FleetStatusBlock() {
    const showVehicles = isMercanciasPrimary ? cargoVehicles : passengerVehicles;
    const total = showVehicles.length;
    const emptyMsg = isMercanciasPrimary
      ? 'Sin vehículos de carga configurados'
      : 'Sin vehículos de viajeros configurados';

    // For cargo vehicles, fleet status is based on services too (same logic)
    const cargoStatuses = cargoVehicles.map(v => ({ vehicle: v, status: getVehicleFleetStatus(v, todayServices) }));
    const displayStatuses = isMercanciasPrimary ? cargoStatuses : fleetStatuses;
    const displayCount = (s: FleetStatus) => displayStatuses.filter(f => f.status === s).length;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            {isMercanciasPrimary
              ? <><Truck className="w-3.5 h-3.5 text-amber-500" /> Estado de la flota</>
              : <><Bus  className="w-3.5 h-3.5 text-blue-500"  /> Estado de la flota</>
            }
          </h3>
          <button onClick={() => onNavigate?.('transporte_vehiculos')}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800">Ver flota</button>
        </div>

        {total === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">{emptyMsg}</p>
        ) : (
          <div className="space-y-2.5">
            {[
              { label: 'Disponible',    count: displayCount('sin_asignacion'),              cls: 'bg-emerald-500' },
              { label: 'En servicio',   count: displayCount('en_servicio'),                 cls: 'bg-blue-500' },
              { label: 'Programado',    count: displayCount('programado'),                  cls: 'bg-sky-400' },
              { label: 'No disponible', count: maintenanceVehicles.length,                  cls: 'bg-amber-400' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-600 font-medium">{row.label}</span>
                  <span className="text-[11px] font-bold text-slate-800">{row.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${row.cls}`}
                    style={{ width: `${Math.min(100, Math.round((row.count / Math.max(total, 1)) * 100))}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-1 flex justify-between text-[10px] text-slate-400">
              <span>
                {isCombinadaOrg
                  ? `${passengerVehicles.length} viajeros · ${cargoVehicles.filter(v => v.modalidad !== 'mixto').length} carga`
                  : `${total} vehículos activos`}
              </span>
              <span>{vehicles.filter(v => v.activo).length} activos de {vehicles.length}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function ConductoresBlock() {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-500" />Conductores
          </h3>
          <button onClick={() => onNavigate?.('transporte_conductores')}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800">Ver todos</button>
        </div>
        {conductorWorkers.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Sin conductores registrados</p>
        ) : (
          <div className="space-y-2">
            {conductorWorkers.slice(0, 6).map(w => {
              const count      = todayServices.filter(s => s.conductor_id === w.id && s.estado !== 'cancelado').length;
              const isAssigned = assignedConductorIds.has(w.id);
              return (
                <div key={w.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-purple-700">
                      {w.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{w.nombre}</p>
                    <p className="text-[10px] text-slate-400">
                      {count > 0 ? `${count} servicio${count !== 1 ? 's' : ''} hoy` :
                       isAssigned ? 'Ruta recurrente hoy' : 'Sin asignación hoy'}
                    </p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isAssigned ? 'bg-blue-500' : 'bg-slate-300'}`} />
                </div>
              );
            })}
            {conductorWorkers.length > 6 && (
              <p className="text-[10px] text-slate-400 text-center">+{conductorWorkers.length - 6} más</p>
            )}
          </div>
        )}
      </div>
    );
  }

  function MantenimientoBlock() {
    const itvProximas = vehicleAlerts.filter(a => a.type === 'itv_proxima' || a.type === 'itv_vencida');
    const seguros     = vehicleAlerts.filter(a => a.type === 'seguro_proximo' || a.type === 'seguro_vencido');
    const enTaller    = vehicleAlerts.filter(a => a.type === 'en_mantenimiento');
    const averias     = vehicleAlerts.filter(a => a.type === 'baja');

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-amber-500" />Mantenimiento
          </h3>
          <button onClick={() => onNavigate?.('transporte_vehiculos')}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800">Ver mantenimiento</button>
        </div>
        <div className="space-y-2">
          {[
            { label: 'ITVs próximas',   count: itvProximas.length, icon: <FileWarning className="w-3.5 h-3.5" />, cls: itvProximas.length > 0 ? 'text-amber-600' : 'text-slate-400', future: false },
            { label: 'Revisiones',      count: null,               icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'text-slate-400', future: true },
            { label: 'Reparaciones',    count: enTaller.length + averias.length, icon: <Wrench className="w-3.5 h-3.5" />, cls: (enTaller.length + averias.length) > 0 ? 'text-red-500' : 'text-slate-400', future: false },
            { label: 'Documentos',      count: seguros.length,     icon: <Shield className="w-3.5 h-3.5" />, cls: seguros.length > 0 ? 'text-amber-600' : 'text-slate-400', future: false },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5 py-1">
              <span className={item.cls}>{item.icon}</span>
              <span className="text-xs text-slate-700 flex-1">{item.label}</span>
              {item.future
                ? <span className="text-[10px] text-slate-400 italic px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">Próximamente</span>
                : <span className={`text-xs font-bold ${(item.count ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{item.count}</span>
              }
            </div>
          ))}
        </div>
        {itvProximas.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            {itvProximas.slice(0, 2).map((a, i) => (
              <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                <span className="font-semibold">{a.matricula}</span>
                <span className="text-slate-400">·</span>
                <span>{a.label}</span>
              </p>
            ))}
            {itvProximas.length > 2 && <p className="text-[10px] text-slate-400">+{itvProximas.length - 2} más</p>}
          </div>
        )}
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-3 sm:p-4 space-y-4 max-w-[1440px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-slate-900 leading-tight">
            Centro de gestión de tráfico
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Toda tu operativa, en un solo lugar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Date pill */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5" />
            <span className="capitalize font-semibold">{fmtDateLong(new Date())}</span>
          </div>
          <button onClick={loadBase} title="Actualizar"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          {/* Contextual action button — only for Viajeros operations */}
          {!isMercanciasPrimary && viajeroEnabled && (
            <button
              onClick={() => onNavigate?.('transporte_servicios', 'new')}
              className="flex items-center gap-1.5 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo servicio
            </button>
          )}
        </div>
      </div>

      {/* ── Tab pills ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <TabPill id="general"    label="General"     icon={<Layers className="w-4 h-4" />}  enabled={true} />
        <TabPill id="viajeros"   label="Viajeros"    icon={<Bus    className="w-4 h-4" />}  enabled={viajeroEnabled} />
        <TabPill id="mercancias" label="Mercancías"  icon={<Truck  className="w-4 h-4" />}  enabled={mercanciasEnabled} />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: GENERAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {panelTab === 'general' && (
        <>
          {/* Legacy transport banner — org has transport enabled but modalidad not yet configured */}
          {isLegacyTransport && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
              <div>
                <p className="font-semibold">Modalidad de transporte pendiente de configurar o revisar</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Esta organización tiene el transporte activado pero no tiene una modalidad asignada (Viajeros, Mercancías o Combinada).
                  Contacta con soporte o con el administrador para completar la configuración.
                </p>
              </div>
            </div>
          )}

          {/* KPI cards — adapted to modalidad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={<Calendar className="w-4 h-4" />}
              label={isMercanciasPrimary ? 'Operaciones hoy' : 'Servicios hoy'}
              value={kpis.totalActiveServices}
              badge={kpis.serviciosEnCurso > 0 ? `${kpis.serviciosEnCurso} en curso` : undefined}
              sub={kpis.serviciosEnCurso === 0 && !isMercanciasPrimary
                ? (kpis.serviciosConfirmados > 0 ? `${kpis.serviciosConfirmados} confirmados` : 'Sin servicios activos')
                : isMercanciasPrimary ? 'servicios de hoy' : undefined}
              accent="teal"
            />
            {!isMercanciasPrimary && (
              <KpiCard
                icon={<Bus className="w-4 h-4" />}
                label="Viajeros"
                value={kpis.totalViajeros ?? todayServices.filter(s => s.num_viajeros).reduce((acc, s) => acc + (s.num_viajeros ?? 0), 0)}
                sub="pasajeros hoy"
                accent="blue"
                onClick={() => onNavigate?.('transporte_servicios')}
              />
            )}
            {(isMercanciasPrimary || isCombinadaOrg) && (
              <KpiCard
                icon={<Truck className="w-4 h-4" />}
                label="Mercancías"
                value={cargoVehicles.length}
                sub="vehículos de carga"
                accent="amber"
                onClick={() => onNavigate?.('transporte_vehiculos')}
              />
            )}
            <KpiCard
              icon={<UserCheck className="w-4 h-4" />}
              label="Sin asignación"
              value={`${sinAsignacionHoy} / ${conductorWorkers.length}`}
              sub={conductorWorkers.length === 0 ? 'sin conductores' : sinAsignacionHoy > 0 ? 'conductores libres' : 'todos asignados'}
              accent={sinAsignacionHoy > 0 ? 'amber' : 'emerald'}
              onClick={() => onNavigate?.('transporte_conductores')}
            />
            <KpiCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Alertas"
              value={alertCount}
              sub={alertCount === 0 ? 'sin incidencias' : 'requieren atención'}
              accent={alertCount > 0 ? 'red' : 'slate'}
              onClick={alertCount > 0 ? () => onNavigate?.('transporte_vehiculos') : undefined}
            />
          </div>

          {/* Main: Gantt + Pendientes */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">

            {/* Planificación del día (Gantt) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-500" />
                  <h2 className="text-sm font-black text-slate-800">Planificación del día</h2>
                  {weekLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
                {/* Day navigation (within current week) */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setGanttDayIdx(i => Math.max(0, i - 1)); if (ganttDayIdx === 0 && weekOffset > 0) setWeekOffset(o => o - 1); }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                    aria-label="Día anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 capitalize min-w-[160px] text-center">
                    {fmtDateLong(ganttDay).split(',').slice(0, 2).join(',')}
                  </span>
                  <button
                    onClick={() => { setGanttDayIdx(i => Math.min(6, i + 1)); if (ganttDayIdx === 6) setWeekOffset(o => o + 1); }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                    aria-label="Día siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <GanttTimeline
                  services={ganttServices}
                  trips={ganttTrips}
                  vehicles={vehicles}
                  vehicleMap={vehicleMap}
                  workerMap={workerMap}
                  isMercanciasPrimary={isMercanciasPrimary}
                  isCombinadaOrg={isCombinadaOrg}
                  onNavigate={onNavigate}
                />
              </div>
            </div>

            {/* Pendientes de asignación */}
            <PendingAssignmentsPanel
              services={ganttServices}
              vehicles={vehicles}
              workers={workers}
              vehicleMap={vehicleMap}
              workerMap={workerMap}
              isMercanciasPrimary={isMercanciasPrimary}
              isCombinadaOrg={isCombinadaOrg}
              onNavigate={onNavigate}
            />
          </div>

          {/* Bottom blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FleetStatusBlock />
            <ConductoresBlock />
            <MantenimientoBlock />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: VIAJEROS
          ═══════════════════════════════════════════════════════════════════════ */}
      {panelTab === 'viajeros' && viajeroEnabled && (
        <>
          {/* Viajeros KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              icon={<Calendar className="w-4 h-4" />}
              label="Servicios hoy"
              value={kpis.totalActiveServices}
              badge={kpis.serviciosEnCurso > 0 ? `${kpis.serviciosEnCurso} en curso` : undefined}
              sub={kpis.serviciosEnCurso === 0
                ? (kpis.serviciosConfirmados > 0 ? `${kpis.serviciosConfirmados} confirmados` : 'Sin servicios activos')
                : undefined}
              accent="blue"
              onClick={() => onNavigate?.('transporte_servicios')}
            />
            <KpiCard
              icon={<Route className="w-4 h-4" />}
              label="Programados"
              value={weekServicesCount}
              sub="servicios esta semana"
              accent="purple"
              onClick={() => onNavigate?.('transporte_servicios')}
            />
            <KpiCard
              icon={<Bus className="w-4 h-4" />}
              label="Vehículos disponibles"
              value={`${availableCount} / ${passengerVehicles.length}`}
              sub={passengerVehicles.length === 0 ? 'sin flota configurada' : `${assignedCount} asignados`}
              accent="emerald"
              onClick={() => onNavigate?.('transporte_vehiculos')}
            />
            <KpiCard
              icon={<UserCheck className="w-4 h-4" />}
              label="Sin asignación hoy"
              value={`${sinAsignacionHoy} / ${conductorWorkers.length}`}
              sub={conductorWorkers.length === 0 ? 'sin conductores' : sinAsignacionHoy > 0 ? 'sin servicio hoy' : 'todos asignados hoy'}
              accent="slate"
              onClick={() => onNavigate?.('transporte_conductores')}
            />
            <KpiCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Alertas"
              value={alertCount}
              sub={alertCount === 0 ? 'sin incidencias' : 'requieren atención'}
              accent={alertCount > 0 ? 'red' : 'slate'}
              onClick={alertCount > 0 ? () => onNavigate?.('transporte_vehiculos') : undefined}
            />
          </div>

          {/* Weekly calendar */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <h2 className="text-sm font-black text-slate-800">Planificación semanal de servicios</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekOffset(0)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      weekOffset === 0 ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    Hoy
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setWeekOffset(o => o - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors" aria-label="Semana anterior">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-slate-600 min-w-[140px] text-center">{weekLabel}</span>
                    <button onClick={() => setWeekOffset(o => o + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors" aria-label="Semana siguiente">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {weekLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Cargando semana...</span>
                </div>
              ) : (
                <>
                  {/* Desktop: 7-column grid */}
                  <div className="hidden md:grid grid-cols-7 divide-x divide-slate-100 max-h-[300px] overflow-y-auto">
                    {weekDays.map((day, i) => (
                      <DayColumn key={i} day={day} today={today} services={weekServices} occurrences={occurrences}
                        vehicleMap={vehicleMap} workerMap={workerMap} onNavigate={onNavigate} />
                    ))}
                  </div>

                  {/* Mobile: day tabs */}
                  <div className="md:hidden">
                    <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50">
                      {weekDays.map((day, i) => {
                        const ds    = isoDate(day);
                        const count = getServicesForDay(weekServices, ds).length + occurrences.filter(o => o.fecha === ds).length;
                        const isSelected = mobileDay === i;
                        const isToday    = ds === today;
                        return (
                          <button key={i} onClick={() => setMobileDay(i)}
                            className={`flex-1 min-w-[48px] py-2 px-1 flex flex-col items-center gap-0.5 text-center transition-colors ${isSelected ? 'bg-white border-b-2 border-blue-600' : 'hover:bg-slate-100'}`}
                          >
                            <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{DAYS_ES[i]}</span>
                            <span className={`text-sm font-black ${isToday ? 'w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto' : isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                              {day.getDate()}
                            </span>
                            {count > 0 && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 rounded-full">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const day    = weekDays[mobileDay];
                      const dayStr = isoDate(day);
                      const svcs   = getServicesForDay(weekServices, dayStr).filter(s => s.estado !== 'cancelado');
                      const occs   = occurrences.filter(o => o.fecha === dayStr && o.status !== 'no_circula' && o.status !== 'suspended');
                      if (svcs.length === 0 && occs.length === 0) {
                        return (
                          <div className="px-4 py-8 text-center text-slate-400">
                            <Calendar className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            <p className="text-sm">Sin servicios el {DAYS_FULL[mobileDay]} {fmtDayShort(day)}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{DAYS_FULL[mobileDay]}, {fmtDayShort(day)}</p>
                          {svcs.map(s => <CalServiceCard key={s.id} svc={s} vehicleMap={vehicleMap} workerMap={workerMap} onClick={() => onNavigate?.('transporte_servicios')} />)}
                          {occs.map((o, i) => <CalOccurrenceCard key={i} occ={o} workerMap={workerMap} vehicleMap={vehicleMap} onClick={() => onNavigate?.('transporte_agenda')} />)}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Right column: próximas salidas + vehicle alerts */}
            <div className="space-y-3">
              {/* Próximas salidas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />Próximas salidas
                  </h3>
                  <button onClick={() => onNavigate?.('transporte_servicios')}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                    Ver todas <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
                {proximasSalidas.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs">Sin salidas pendientes esta semana</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {proximasSalidas.map(s => {
                      const conductor = s.conductor_id ? workerMap.get(s.conductor_id) : undefined;
                      const vehicle   = s.vehicle_id   ? vehicleMap.get(s.vehicle_id)  : undefined;
                      return (
                        <button key={s.id} onClick={() => onNavigate?.('transporte_servicios')}
                          className="w-full flex items-start gap-2 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors group text-left">
                          <div className="flex flex-col items-center shrink-0 mt-0.5 w-10">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.estado === 'en_curso' ? 'bg-emerald-500 animate-pulse' : s.estado === 'confirmado' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">{fmtTime(s.fecha_inicio)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate leading-tight group-hover:text-blue-700">{s.titulo}</p>
                            {vehicle && <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><Bus className="w-2.5 h-2.5 shrink-0" />{vehicle.matricula} · {vehicle.nombre}</p>}
                            {conductor && <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1"><UserCheck className="w-2.5 h-2.5 shrink-0" />{conductor.nombre}</p>}
                          </div>
                          <div className="shrink-0"><span className="text-[9px] font-semibold text-slate-400">{fmtDate(s.fecha_inicio)}</span></div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vehicle alerts */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />Vehículos con atención
                  </h3>
                  {vehicleAlerts.length > 0 && (
                    <button onClick={() => onNavigate?.('transporte_vehiculos')}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                      Ver flota <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                {vehicleAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs">Flota en buen estado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vehicleAlerts.slice(0, 5).map((alert, i) => (
                      <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border ${alert.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        <AlertIcon type={alert.type} severity={alert.severity} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-tight truncate">{alert.vehicleName}<span className="font-normal text-slate-500"> · {alert.matricula}</span></p>
                          <p className={`text-[10.5px] font-semibold mt-0.5 ${alert.severity === 'error' ? 'text-red-600' : 'text-amber-700'}`}>{alert.label}</p>
                          <p className="text-[10px] text-slate-500 truncate">{alert.detail}</p>
                        </div>
                      </div>
                    ))}
                    {vehicleAlerts.length > 5 && (
                      <button onClick={() => onNavigate?.('transporte_vehiculos')} className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold w-full text-center py-1">
                        +{vehicleAlerts.length - 5} más → Ver flota
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: fleet + drivers + maintenance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FleetStatusBlock />
            <ConductoresBlock />
            <MantenimientoBlock />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: MERCANCÍAS
          ═══════════════════════════════════════════════════════════════════════ */}
      {panelTab === 'mercancias' && mercanciasEnabled && (
        <>
          {/* Cargo KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={<Truck className="w-4 h-4" />} label="Flota de carga" value={cargoVehicles.length}
              sub={`${cargoVehicles.filter(v => v.estado === 'disponible').length} disponibles`} accent="amber"
              onClick={() => onNavigate?.('transporte_vehiculos')} />
            <KpiCard icon={<Users className="w-4 h-4" />} label="Conductores" value={conductorWorkers.length}
              sub={`${sinAsignacionHoy} sin asignación`} accent="purple"
              onClick={() => onNavigate?.('transporte_conductores')} />
            <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Alertas flota" value={alertCount}
              sub={alertCount === 0 ? 'sin incidencias' : 'requieren atención'} accent={alertCount > 0 ? 'red' : 'slate'}
              onClick={alertCount > 0 ? () => onNavigate?.('transporte_vehiculos') : undefined} />
            <KpiCard icon={<Package className="w-4 h-4" />} label="Viajes activos" value="—"
              sub="disponible próximamente" accent="slate" />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
            {/* Viajes — coming soon */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                {orgId && <ScreenTransporteViajes orgId={orgId} />}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <Package className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-black text-slate-800">Expediciones y cargas</h2>
                </div>
                <div className="p-8 flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Gestión de expediciones</p>
                    <p className="text-xs text-slate-400 max-w-xs">Las expediciones, albaranes y documentos de carga estarán disponibles próximamente.</p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">Próximamente — TX-MC-2</span>
                </div>
              </div>
            </div>

            {/* Right: cargo vehicles + drivers */}
            <div className="space-y-3">
              {/* Cargo fleet */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-500" />Flota de carga
                  </h3>
                  <button onClick={() => onNavigate?.('transporte_vehiculos')}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800">Ver flota</button>
                </div>
                {cargoVehicles.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">Sin vehículos de carga configurados</p>
                ) : (
                  <div className="space-y-2">
                    {cargoVehicles.slice(0, 6).map(v => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${v.estado === 'disponible' ? 'bg-emerald-500' : v.estado === 'en_mantenimiento' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{v.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{v.matricula}
                            {v.capacidad_carga_kg && <span> · {(v.capacidad_carga_kg / 1000).toFixed(1)} t</span>}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${v.estado === 'disponible' ? 'bg-emerald-100 text-emerald-700' : v.estado === 'en_mantenimiento' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {v.estado === 'disponible' ? 'Disp.' : v.estado === 'en_mantenimiento' ? 'Taller' : v.estado}
                        </span>
                      </div>
                    ))}
                    {cargoVehicles.length > 6 && <p className="text-[10px] text-slate-400 text-center">+{cargoVehicles.length - 6} más</p>}
                  </div>
                )}
              </div>

              <ConductoresBlock />
              <MantenimientoBlock />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
