/**
 * ScreenTransportePanel — Centro de gestión de tráfico
 * PH0-TX-DASHBOARD-REDESIGN-1: rediseño completo del panel de transporte.
 *
 * Datos reales de la organización autenticada. Sin valores ficticios.
 * Reutiliza lógica de Agenda (buildAgendaOccurrences), helpers puros de
 * transportPanelHelpers y los loaders existentes de transportServices/transport.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bus, Users, Calendar, AlertTriangle,
  MapPin, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Wrench, UserCheck, Plus, ArrowRight, Clock, Route,
  Shield, FileWarning, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_COLORS,
  loadServicesOverlappingRange,
} from '../lib/transportServices';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
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
import {
  loadSchedulesActive,
  loadExceptionsForRange,
  loadOccurrenceLinksForRange,
} from '../lib/transportSchedules';

// ── UI helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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

const DAYS_ES  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtDayShort(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

// ── Calendar service card ──────────────────────────────────────────────────────

interface CalServiceCardProps {
  svc: TradeTransportService;
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  onClick?: () => void;
}

function CalServiceCard({ svc, vehicleMap, workerMap, onClick }: CalServiceCardProps) {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)   : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id)  : undefined;
  const typeColor = TIPO_SERVICIO_COLORS[svc.tipo_servicio] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const isEnCurso = svc.estado === 'en_curso';
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
        {vehicle && (
          <span className="font-semibold shrink-0 opacity-75">{vehicle.matricula}</span>
        )}
      </div>
      <p className="font-semibold truncate text-[11px]">{svc.titulo}</p>
      {(svc.origen || svc.destino) && (
        <p className="truncate opacity-70 mt-0.5">
          {[svc.origen, svc.destino].filter(Boolean).join(' → ')}
        </p>
      )}
      {conductor && (
        <p className="truncate opacity-70 flex items-center gap-0.5 mt-0.5">
          <UserCheck className="w-2.5 h-2.5 shrink-0" />{conductor.nombre}
        </p>
      )}
    </button>
  );
}

// ── Occurrence card (recurring route) ─────────────────────────────────────────

interface CalOccurrenceCardProps {
  occ: AgendaOccurrence;
  workerMap: Map<string, TradeWorker>;
  vehicleMap: Map<string, TradeVehicle>;
  onClick?: () => void;
}

function CalOccurrenceCard({ occ, workerMap, vehicleMap, onClick }: CalOccurrenceCardProps) {
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

// ── Weekly calendar day column ─────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  manana: 'Mañana',
  tarde:  'Tarde',
  noche:  'Noche',
};
const SLOT_ORDER = ['manana', 'tarde', 'noche'] as const;

interface DayColumnProps {
  day: Date;
  today: string;
  services: TradeTransportService[];
  occurrences: AgendaOccurrence[];
  vehicleMap: Map<string, TradeVehicle>;
  workerMap: Map<string, TradeWorker>;
  onNavigate?: (tab: string) => void;
}

function DayColumn({ day, today, services, occurrences, vehicleMap, workerMap, onNavigate }: DayColumnProps) {
  const dayStr   = isoDate(day);
  const isToday  = dayStr === today;
  const isPast   = dayStr < today;
  const dayServices = getServicesForDay(services, dayStr);
  const dayOccs    = occurrences.filter(o => o.fecha === dayStr);

  // Group by slot
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
  const hasNoche   = slots.noche.length + occSlots.noche.length > 0;
  const activeSlots = SLOT_ORDER.filter(s => s !== 'noche' || hasNoche);

  return (
    <div className={`min-w-0 flex flex-col border-r border-slate-100 last:border-r-0 ${isPast ? 'opacity-60' : ''}`}>
      {/* Day header */}
      <div className={`px-1.5 py-2 text-center border-b border-slate-100 ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-50'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
          {DAYS_ES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
        </p>
        <p className={`text-sm font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>
          {day.getDate()}
        </p>
        {totalItems > 0 && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            isToday ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            {totalItems}
          </span>
        )}
      </div>

      {/* Slots */}
      <div className="flex-1 divide-y divide-slate-50">
        {activeSlots.map(slotKey => {
          const svcs = slots[slotKey];
          const occs = occSlots[slotKey];
          if (svcs.length === 0 && occs.length === 0) {
            return (
              <div key={slotKey} className="px-1 py-2 min-h-[52px]">
                <p className="text-[9px] text-slate-300 uppercase tracking-wide mb-1">{SLOT_LABELS[slotKey]}</p>
              </div>
            );
          }
          return (
            <div key={slotKey} className="px-1 py-1.5 space-y-1">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">{SLOT_LABELS[slotKey]}</p>
              {svcs.map(s => (
                <CalServiceCard
                  key={s.id}
                  svc={s}
                  vehicleMap={vehicleMap}
                  workerMap={workerMap}
                  onClick={() => onNavigate?.('transporte_servicios')}
                />
              ))}
              {occs.map((o, i) => (
                <CalOccurrenceCard
                  key={`${o.schedule.id}-${o.sentido}-${i}`}
                  occ={o}
                  workerMap={workerMap}
                  vehicleMap={vehicleMap}
                  onClick={() => onNavigate?.('transporte_agenda')}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vehicle alert icon ─────────────────────────────────────────────────────────

function AlertIcon({ type, severity }: { type: VehicleAlertItem['type']; severity: VehicleAlertItem['severity'] }) {
  const cls = severity === 'error' ? 'text-red-500' : 'text-amber-500';
  if (type === 'en_mantenimiento') return <Wrench className={`w-3.5 h-3.5 ${cls}`} />;
  if (type === 'baja')             return <XCircle className={`w-3.5 h-3.5 ${cls}`} />;
  if (type === 'itv_vencida' || type === 'itv_proxima')
                                    return <FileWarning className={`w-3.5 h-3.5 ${cls}`} />;
  return <Shield className={`w-3.5 h-3.5 ${cls}`} />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  badge?: string;
  accent?: string;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, sub, badge, accent = 'blue', onClick }: KpiCardProps) {
  const accentCls: Record<string, string> = {
    blue:    'from-blue-50 to-blue-100/60 border-blue-200',
    emerald: 'from-emerald-50 to-emerald-100/60 border-emerald-200',
    amber:   'from-amber-50 to-amber-100/60 border-amber-200',
    purple:  'from-purple-50 to-purple-100/60 border-purple-200',
    slate:   'from-slate-50 to-slate-100/60 border-slate-200',
    red:     'from-red-50 to-red-100/60 border-red-200',
  };
  const textCls: Record<string, string> = {
    blue: 'text-blue-700', emerald: 'text-emerald-700', amber: 'text-amber-700',
    purple: 'text-purple-700', slate: 'text-slate-600', red: 'text-red-700',
  };
  const bg  = accentCls[accent] ?? accentCls.blue;
  const txt = textCls[accent]   ?? textCls.blue;

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={`bg-gradient-to-br ${bg} border rounded-2xl p-4 flex flex-col gap-1 text-left w-full ${
        onClick ? 'hover:shadow-md transition-shadow cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wider opacity-70 leading-tight ${txt}`}>{label}</span>
        <span className={`opacity-50 ${txt}`}>{icon}</span>
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span className={`text-3xl font-black ${txt}`}>{value}</span>
        {badge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5 ${
            accent === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>{badge}</span>
        )}
      </div>
      {sub && <span className={`text-[11px] opacity-60 leading-tight ${txt}`}>{sub}</span>}
    </Tag>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string, action?: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransportePanel({ orgId, showToast, onNavigate }: Props) {
  const today = isoDate(new Date());

  // ── Week navigation ─────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekEnd   = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays  = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true);
  const [weekLoading,  setWeekLoading]  = useState(false);
  const [todayServices, setTodayServices] = useState<TradeTransportService[]>([]);
  const [weekServices,  setWeekServices]  = useState<TradeTransportService[]>([]);
  const [occurrences,   setOccurrences]   = useState<AgendaOccurrence[]>([]);
  const [vehicles,      setVehicles]      = useState<TradeVehicle[]>([]);
  const [workers,       setWorkers]       = useState<TradeWorker[]>([]);
  const [vehicleMap,    setVehicleMap]    = useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap,     setWorkerMap]     = useState<Map<string, TradeWorker>>(new Map());
  const [error,         setError]         = useState<string | null>(null);

  // ── Initial load: vehicles + workers + today services ──────────────────────
  const loadBase = useCallback(async () => {
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

  // ── Week load: services + schedules for the week ────────────────────────────
  const loadWeek = useCallback(async () => {
    setWeekLoading(true);
    try {
      const desde = `${isoDate(weekStart)}T00:00:00`;
      const hasta = `${isoDate(weekEnd)}T23:59:59`;

      const [svcs, todaySvcs, schedules, exceptions, links] = await Promise.all([
        loadServicesOverlappingRange(orgId, desde, hasta),
        weekOffset === 0
          ? loadServicesOverlappingRange(orgId, `${today}T00:00:00`, `${today}T23:59:59`)
          : Promise.resolve([] as TradeTransportService[]),
        loadSchedulesActive(orgId).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
        loadExceptionsForRange(orgId, isoDate(weekStart), isoDate(weekEnd)).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
        loadOccurrenceLinksForRange(orgId, isoDate(weekStart), isoDate(weekEnd)).catch(e => isModuleNotDeployed(e) ? [] : Promise.reject(e)),
      ]);

      setWeekServices(svcs);
      if (weekOffset === 0) setTodayServices(todaySvcs);

      const occs = buildAgendaOccurrences(schedules, exceptions, links, weekStart, weekEnd);
      setOccurrences(occs);
    } catch (e) {
      const msg = errMsg(e);
      showToast(msg, 'error');
    } finally {
      setWeekLoading(false);
    }
  }, [orgId, weekStart, weekEnd, weekOffset, today]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (!loading) loadWeek(); }, [loadWeek, loading]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const passengerVehicles = useMemo(
    () => vehicles.filter(v => v.activo && isVehiclePassenger(v)),
    [vehicles],
  );

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

  // Conductores asignados hoy: combina servicios puntuales + rutas recurrentes del día.
  const assignedConductorIds = useMemo(
    () => getAssignedConductorIds(
      todayServices,
      occurrences as OccurrenceForKpi[],
      today,
    ),
    [todayServices, occurrences, today],
  );
  const sinAsignacionHoy = conductorWorkers.filter(w => !assignedConductorIds.has(w.id)).length;

  // Week services count (non-cancelled)
  const weekServicesCount = weekServices.filter(s => s.estado !== 'cancelado').length;

  // Upcoming departures: from now, ascending
  const now            = new Date();
  const proximasSalidas = getProximasSalidas(weekServices, now).slice(0, 6);

  // Vehicle alerts
  const vehicleAlerts = useMemo(
    () => computeVehicleAlerts(vehicles, today),
    [vehicles, today],
  );
  const alertCount = vehicleAlerts.length;

  // Week label
  const weekLabel = (() => {
    const s = weekStart;
    const e = weekEnd;
    const sm = MONTHS_ES[s.getMonth()];
    const em = MONTHS_ES[e.getMonth()];
    if (sm === em) return `${s.getDate()} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${e.getFullYear()}`;
  })();

  // Mobile: selected day
  const [mobileDay, setMobileDay] = useState(0); // index 0-6

  // ── Render ──────────────────────────────────────────────────────────────────

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

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1440px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">
            Centro de gestión de tráfico
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Planificación, flota y operativa en un solo lugar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadBase}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={() => onNavigate?.('transporte_servicios', 'new')}
            className="flex items-center gap-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Programar servicio
          </button>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
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

      {/* ── Main area: calendario + columna derecha ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ── Planificación semanal ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">

          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-black text-slate-800">Planificación semanal de servicios</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset(0)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  weekOffset === 0
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Hoy
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWeekOffset(o => o - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold text-slate-600 min-w-[140px] text-center">{weekLabel}</span>
                <button
                  onClick={() => setWeekOffset(o => o + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                  aria-label="Semana siguiente"
                >
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
              <div className="hidden md:grid grid-cols-7 divide-x divide-slate-100 min-h-[280px]">
                {weekDays.map((day, i) => (
                  <DayColumn
                    key={i}
                    day={day}
                    today={today}
                    services={weekServices}
                    occurrences={occurrences}
                    vehicleMap={vehicleMap}
                    workerMap={workerMap}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              {/* Mobile: day tabs + list */}
              <div className="md:hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50">
                  {weekDays.map((day, i) => {
                    const ds    = isoDate(day);
                    const count = getServicesForDay(weekServices, ds).length
                                + occurrences.filter(o => o.fecha === ds).length;
                    const isSelected = mobileDay === i;
                    const isToday    = ds === today;
                    return (
                      <button
                        key={i}
                        onClick={() => setMobileDay(i)}
                        className={`flex-1 min-w-[48px] py-2 px-1 flex flex-col items-center gap-0.5 text-center transition-colors ${
                          isSelected ? 'bg-white border-b-2 border-blue-600' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                          {DAYS_ES[i]}
                        </span>
                        <span className={`text-sm font-black ${
                          isToday ? 'w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto' :
                          isSelected ? 'text-blue-700' : 'text-slate-700'
                        }`}>
                          {day.getDate()}
                        </span>
                        {count > 0 && (
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 rounded-full">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Selected day detail */}
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
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {DAYS_FULL[mobileDay]}, {fmtDayShort(day)}
                      </p>
                      {svcs.map(s => (
                        <CalServiceCard key={s.id} svc={s} vehicleMap={vehicleMap} workerMap={workerMap}
                          onClick={() => onNavigate?.('transporte_servicios')} />
                      ))}
                      {occs.map((o, i) => (
                        <CalOccurrenceCard key={i} occ={o} workerMap={workerMap} vehicleMap={vehicleMap}
                          onClick={() => onNavigate?.('transporte_agenda')} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* ── Columna derecha ── */}
        <div className="space-y-4">

          {/* Próximas salidas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Próximas salidas
              </h3>
              <button
                onClick={() => onNavigate?.('transporte_servicios')}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
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
                    <button
                      key={s.id}
                      onClick={() => onNavigate?.('transporte_servicios')}
                      className="w-full flex items-start gap-2 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors group text-left"
                    >
                      <div className="flex flex-col items-center shrink-0 mt-0.5 w-10">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          s.estado === 'en_curso' ? 'bg-emerald-500 animate-pulse' :
                          s.estado === 'confirmado' ? 'bg-blue-500' : 'bg-slate-300'
                        }`} />
                        <span className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">{fmtTime(s.fecha_inicio)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate leading-tight group-hover:text-blue-700">
                          {s.titulo}
                        </p>
                        {vehicle && (
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Bus className="w-2.5 h-2.5 shrink-0" />
                            {vehicle.matricula} · {vehicle.nombre}
                          </p>
                        )}
                        {conductor && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5 shrink-0" />{conductor.nombre}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span className="text-[9px] font-semibold text-slate-400">
                          {fmtDate(s.fecha_inicio)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vehículos que requieren atención */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                Vehículos con atención
              </h3>
              {vehicleAlerts.length > 0 && (
                <button
                  onClick={() => onNavigate?.('transporte_vehiculos')}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                >
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
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border ${
                      alert.severity === 'error'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <AlertIcon type={alert.type} severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                        {alert.vehicleName}
                        <span className="font-normal text-slate-500"> · {alert.matricula}</span>
                      </p>
                      <p className={`text-[10.5px] font-semibold mt-0.5 ${
                        alert.severity === 'error' ? 'text-red-600' : 'text-amber-700'
                      }`}>{alert.label}</p>
                      <p className="text-[10px] text-slate-500 truncate">{alert.detail}</p>
                    </div>
                  </div>
                ))}
                {vehicleAlerts.length > 5 && (
                  <button
                    onClick={() => onNavigate?.('transporte_vehiculos')}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold w-full text-center py-1"
                  >
                    +{vehicleAlerts.length - 5} más → Ver flota
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bloques inferiores ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Estado de la flota */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-blue-500" />
              Estado de la flota
            </h3>
            <button
              onClick={() => onNavigate?.('transporte_vehiculos')}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
            >
              Ver flota
            </button>
          </div>

          {passengerVehicles.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">Sin vehículos de viajeros configurados</p>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: 'Disponible',   count: availableCount,              cls: 'bg-emerald-500', total: passengerVehicles.length },
                { label: 'En servicio',  count: countByStatus('en_servicio'),cls: 'bg-blue-500',    total: passengerVehicles.length },
                { label: 'Programado',   count: countByStatus('programado'), cls: 'bg-sky-400',     total: passengerVehicles.length },
                { label: 'No disponible',count: maintenanceVehicles.length,  cls: 'bg-amber-400',   total: Math.max(vehicles.length, 1) },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-600 font-medium">{row.label}</span>
                    <span className="text-[11px] font-bold text-slate-800">{row.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${row.cls}`}
                      style={{ width: `${Math.min(100, Math.round((row.count / row.total) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-1 flex justify-between text-[10px] text-slate-400">
                <span>{passengerVehicles.length} viajeros · {vehicles.filter(v => v.activo && !isVehiclePassenger(v)).length} carga</span>
                <span>{vehicles.filter(v => v.activo).length} activos de {vehicles.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Conductores y asignaciones */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-500" />
              Conductores
            </h3>
            <button
              onClick={() => onNavigate?.('transporte_conductores')}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
            >
              Ver todos
            </button>
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

        {/* Mantenimiento */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              Mantenimiento
            </h3>
            <button
              onClick={() => onNavigate?.('transporte_vehiculos')}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
            >
              Ver mantenimiento
            </button>
          </div>

          {(() => {
            const itvProximas = vehicleAlerts.filter(a => a.type === 'itv_proxima' || a.type === 'itv_vencida');
            const seguros     = vehicleAlerts.filter(a => a.type === 'seguro_proximo' || a.type === 'seguro_vencido');
            const enTaller    = vehicleAlerts.filter(a => a.type === 'en_mantenimiento');
            const averias     = vehicleAlerts.filter(a => a.type === 'baja');

            return (
              <div className="space-y-2">
                {[
                  {
                    label: 'ITVs próximas',
                    count: itvProximas.length,
                    icon: <FileWarning className="w-3.5 h-3.5" />,
                    cls: itvProximas.length > 0 ? 'text-amber-600' : 'text-slate-400',
                    future: false,
                  },
                  {
                    label: 'Revisiones',
                    count: null,
                    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                    cls: 'text-slate-400',
                    future: true,
                  },
                  {
                    label: 'Reparaciones',
                    count: enTaller.length + averias.length,
                    icon: <Wrench className="w-3.5 h-3.5" />,
                    cls: (enTaller.length + averias.length) > 0 ? 'text-red-500' : 'text-slate-400',
                    future: false,
                  },
                  {
                    label: 'Documentos',
                    count: seguros.length,
                    icon: <Shield className="w-3.5 h-3.5" />,
                    cls: seguros.length > 0 ? 'text-amber-600' : 'text-slate-400',
                    future: false,
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2.5 py-1">
                    <span className={item.cls}>{item.icon}</span>
                    <span className="text-xs text-slate-700 flex-1">{item.label}</span>
                    {item.future ? (
                      <span className="text-[10px] text-slate-400 italic px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                        Próximamente
                      </span>
                    ) : (
                      <span className={`text-xs font-bold ${
                        (item.count ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </div>
                ))}

                {itvProximas.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {itvProximas.slice(0, 2).map((a, i) => (
                      <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                        <span className="font-semibold">{a.matricula}</span>
                        <span className="text-slate-400">·</span>
                        <span>{a.label}</span>
                      </p>
                    ))}
                    {itvProximas.length > 2 && (
                      <p className="text-[10px] text-slate-400">+{itvProximas.length - 2} más</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
