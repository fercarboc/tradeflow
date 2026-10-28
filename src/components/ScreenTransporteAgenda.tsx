import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Users, MapPin,
  Bus, Filter, X, Loader2, AlertTriangle, Clock, ArrowRight,
  Phone, Navigation, Repeat, CalendarX, AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  startOfWeek, addDays, isoDate, getServiceDays,
} from '../lib/transportPanelHelpers';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_OPTIONS,
  loadServicesOverlappingRange,
} from '../lib/transportServices';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
import { loadVehiclesAll, getVehicleDisplayImage } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeWorker } from '../lib/supabase';
import {
  locationToText, locationToAddress, hasContact, phoneHref,
} from '../lib/transportLocations';
import type { TransportContact } from '../lib/transportLocations';
import { usePermissions } from '../hooks/usePermissions';
import {
  loadSchedulesActive, loadExceptionsForRange, loadOccurrenceLinksForRange,
  materializeOccurrence, SCHEDULE_EXCEPTION_TIPO_LABELS,
  getExpectedOccurrences,
} from '../lib/transportSchedules';
import type {
  TradeTransportSchedule, TradeTransportScheduleException,
  TradeTransportOccurrenceLink, ScheduleSentido,
} from '../lib/transportSchedules';

// ── Tipos exportados para tests ───────────────────────────────────────────────

export type OccurrenceStatus =
  | 'pending'
  | 'suspended'
  | 'no_circula'
  | 'cambio_horario'
  | 'cambio_conductor'
  | 'cambio_vehiculo'
  | 'cambio_itinerario'
  | 'modificado';

export interface AgendaOccurrence {
  fecha: string;
  sentido: ScheduleSentido;
  status: OccurrenceStatus;
  schedule: TradeTransportSchedule;
  exception: TradeTransportScheduleException | null;
  effectiveHoraSalida: string | null;
  effectiveConductorId: string | null;
  effectiveVehicleId: string | null;
}

// ── Funciones puras exportadas para tests ────────────────────────────────────

export function buildAgendaOccurrences(
  schedules: TradeTransportSchedule[],
  exceptions: TradeTransportScheduleException[],
  links: TradeTransportOccurrenceLink[],
  desde: Date,
  hasta: Date,
): AgendaOccurrence[] {
  const exBySchedule = new Map<string, TradeTransportScheduleException[]>();
  for (const ex of exceptions) {
    const list = exBySchedule.get(ex.schedule_id) ?? [];
    list.push(ex);
    exBySchedule.set(ex.schedule_id, list);
  }
  const linkByKey = new Map<string, string>();
  for (const lk of links) {
    linkByKey.set(`${lk.schedule_id}:${lk.fecha}:${lk.sentido}`, lk.service_id);
  }

  const result: AgendaOccurrence[] = [];

  for (const schedule of schedules) {
    const fechas = getExpectedOccurrences(schedule, desde, hasta);
    const schedExceptions = exBySchedule.get(schedule.id) ?? [];
    const exMap = new Map<string, TradeTransportScheduleException>();
    for (const ex of schedExceptions) exMap.set(`${ex.fecha}:${ex.sentido}`, ex);

    const sentidos: ScheduleSentido[] = schedule.vuelta_habilitada ? ['ida', 'vuelta'] : ['unico'];

    for (const fecha of fechas) {
      for (const sentido of sentidos) {
        const exKey  = `${fecha}:${sentido}`;
        const lkKey  = `${schedule.id}:${fecha}:${sentido}`;
        const ex     = exMap.get(exKey) ?? null;
        const svcId  = linkByKey.get(lkKey) ?? null;

        // Already materialized → will appear as a regular service
        if (svcId !== null) continue;

        let status: OccurrenceStatus;
        if (!ex)                           status = 'pending';
        else if (ex.tipo === 'no_circula') status = 'no_circula';
        else if (ex.tipo === 'suspendido') status = 'suspended';
        else                               status = ex.tipo as OccurrenceStatus;

        const overrides = ex?.overrides ?? {};
        const effectiveHoraSalida =
          (overrides.hora_salida as string | undefined) ??
          (sentido === 'vuelta' ? (schedule.hora_salida_vuelta ?? null) : schedule.hora_salida_ida);
        const effectiveConductorId =
          (overrides.conductor_id as string | undefined) ?? schedule.conductor_id ?? null;
        const effectiveVehicleId =
          (overrides.vehicle_id as string | undefined) ?? schedule.vehicle_id ?? null;

        result.push({
          fecha,
          sentido,
          status,
          schedule,
          exception: ex,
          effectiveHoraSalida: effectiveHoraSalida ?? null,
          effectiveConductorId,
          effectiveVehicleId,
        });
      }
    }
  }

  result.sort((a, b) => {
    const d = a.fecha.localeCompare(b.fecha);
    if (d !== 0) return d;
    return (a.sentido === 'ida' ? 0 : 1) - (b.sentido === 'ida' ? 0 : 1);
  });

  return result;
}

export function getOccurrencesForDay(occs: AgendaOccurrence[], day: Date): AgendaOccurrence[] {
  const dayStr = isoDate(day);
  return occs.filter(o => o.fecha === dayStr);
}

export function detectConflicts(
  occ: AgendaOccurrence,
  services: TradeTransportService[],
): TradeTransportService[] {
  const sameDay = services.filter(
    s => s.estado !== 'cancelado' && s.fecha_inicio.startsWith(occ.fecha),
  );
  return sameDay.filter(
    s =>
      (occ.effectiveVehicleId   && s.vehicle_id   === occ.effectiveVehicleId) ||
      (occ.effectiveConductorId && s.conductor_id === occ.effectiveConductorId),
  );
}

// ── Helpers internos ─────────────────────────────────────────────────────────

function isModuleNotDeployedError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; message?: string };
  const code = err.code ?? '';
  const msg  = err.message ?? '';
  if (code === '42P01' || code === '42883') return true;
  if (code === 'PGRST202' || code === 'PGRST116') return true;
  if (msg.includes('does not exist')) return true;
  return false;
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

type ViewMode = 'weekly' | 'monthly' | 'interval';

type DetailState =
  | { kind: 'empty' }
  | { kind: 'day'; date: Date; services: TradeTransportService[]; occurrences: AgendaOccurrence[] }
  | { kind: 'service'; svc: TradeTransportService }
  | { kind: 'occurrence'; occ: AgendaOccurrence };

// ── UI Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtHora(hhmms: string | null | undefined): string {
  if (!hhmms) return '—';
  return hhmms.slice(0, 5);
}

function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function estadoColor(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.color ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function estadoLabel(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.label ?? estado;
}

const LEFT_ACCENT: Record<ServicioEstado, string> = {
  borrador:   'border-l-slate-300',
  confirmado: 'border-l-blue-400',
  en_curso:   'border-l-emerald-500',
  completado: 'border-l-purple-400',
  cancelado:  'border-l-red-300',
};

const OCC_STATUS_CFG: Record<OccurrenceStatus, { label: string; bg: string; text: string; border: string; leftAccent: string }> = {
  pending:           { label: 'Pendiente',         bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-200',  leftAccent: 'border-l-blue-400' },
  suspended:         { label: 'Suspendido',         bg: 'bg-slate-100', text: 'text-slate-400', border: 'border-slate-200', leftAccent: 'border-l-slate-300' },
  no_circula:        { label: 'No circula',         bg: 'bg-red-50',    text: 'text-red-500',   border: 'border-red-200',   leftAccent: 'border-l-red-400' },
  cambio_horario:    { label: 'Cambio horario',     bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', leftAccent: 'border-l-amber-400' },
  cambio_conductor:  { label: 'Cambio conductor',  bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', leftAccent: 'border-l-amber-400' },
  cambio_vehiculo:   { label: 'Cambio vehículo',   bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', leftAccent: 'border-l-amber-400' },
  cambio_itinerario: { label: 'Cambio itinerario', bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', leftAccent: 'border-l-amber-400' },
  modificado:        { label: 'Modificado',         bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', leftAccent: 'border-l-amber-400' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenParte?: (svcId: string) => void;
  onNavigate?: (tab: string, serviceId?: string) => void;
}

interface MapsProps {
  vehicleMap: Map<string, TradeVehicle>;
  workerMap:  Map<string, TradeWorker>;
  clientMap:  Map<string, string>;
}

// ── AgendaServiceCard ─────────────────────────────────────────────────────────

interface AgendaServiceCardProps extends MapsProps {
  svc:      TradeTransportService;
  selected: boolean;
  onClick:  () => void;
}

function AgendaServiceCard({ svc, vehicleMap, workerMap, selected, onClick }: AgendaServiceCardProps) {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
  const statusCfg = SERVICIO_ESTADOS.find(e => e.value === svc.estado);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border border-l-4 px-2 py-1.5 transition-all ${LEFT_ACCENT[svc.estado]} ${
        selected
          ? 'bg-blue-50 border-blue-200 shadow-md'
          : svc.estado === 'cancelado'
            ? 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100'
            : 'bg-white border-slate-200 hover:shadow-sm hover:border-slate-300'
      }`}
    >
      <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{svc.titulo}</p>
      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
        {fmtTime(svc.fecha_inicio)}{svc.fecha_fin ? `–${fmtTime(svc.fecha_fin)}` : ''}
      </p>
      <div className="mt-1">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border max-w-full truncate ${statusCfg?.color}`}>
          {svc.estado === 'en_curso' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
          <span className="truncate">{statusCfg?.label}</span>
        </span>
      </div>
      {(vehicle || conductor) && (
        <p className="mt-0.5 text-[10px] text-slate-500 truncate">
          {[vehicle?.nombre, conductor?.nombre].filter(Boolean).join(' · ')}
        </p>
      )}
    </button>
  );
}

// ── AgendaOccurrenceCard ──────────────────────────────────────────────────────

interface AgendaOccurrenceCardProps {
  occ:      AgendaOccurrence;
  selected: boolean;
  onClick:  () => void;
}

function AgendaOccurrenceCard({ occ, selected, onClick }: AgendaOccurrenceCardProps) {
  const cfg = OCC_STATUS_CFG[occ.status];
  const sentidoLabel = occ.sentido === 'ida' ? '→' : '←';
  const isPending  = occ.status === 'pending';
  const isCanceled = occ.status === 'no_circula' || occ.status === 'suspended';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border border-l-4 ${cfg.leftAccent} ${cfg.border} px-2 py-1.5 transition-all ${
        isPending ? 'border-dashed' : ''
      } ${
        selected
          ? `${cfg.bg} shadow-md ring-1 ring-blue-400`
          : `${cfg.bg} hover:shadow-sm`
      }`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Repeat className={`w-2.5 h-2.5 shrink-0 ${cfg.text}`} />
        <p className={`text-xs font-bold leading-tight line-clamp-1 flex-1 min-w-0 ${
          isCanceled ? 'line-through opacity-60' : cfg.text
        }`}>
          {sentidoLabel} {occ.schedule.nombre}
        </p>
      </div>
      {occ.effectiveHoraSalida && (
        <p className={`text-[10px] font-mono mt-0.5 truncate ${cfg.text} opacity-80`}>
          {fmtHora(occ.effectiveHoraSalida)}
        </p>
      )}
      <div className="mt-1">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border max-w-full truncate ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

// ── MonthDayCell ──────────────────────────────────────────────────────────────

interface MonthDayCellProps {
  day:         Date;
  services:    TradeTransportService[];
  occurrences: AgendaOccurrence[];
  todayStr:    string;
  onClickDay:  (day: Date, svcs: TradeTransportService[], occs: AgendaOccurrence[]) => void;
  onClickSvc:  (svc: TradeTransportService) => void;
  onClickOcc:  (occ: AgendaOccurrence) => void;
  selectedSvc: string | null;
}

function MonthDayCell({ day, services, occurrences, todayStr, onClickDay, onClickSvc, onClickOcc, selectedSvc }: MonthDayCellProps) {
  const dayStr    = isoDate(day);
  const isToday   = dayStr === todayStr;
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const totalItems = services.length + occurrences.length;
  const visibleSvcs = services.slice(0, 2);
  const visibleOccs = totalItems > 2 ? [] : occurrences.slice(0, 2 - visibleSvcs.length);
  const overflow = totalItems - visibleSvcs.length - visibleOccs.length;

  return (
    <div className={`min-h-[72px] p-1 rounded-lg border transition-colors ${
      isToday ? 'border-blue-300 bg-blue-50' : isWeekend ? 'border-slate-100 bg-slate-50' : 'border-slate-100 bg-white'
    }`}>
      <button
        onClick={() => totalItems > 0 && onClickDay(day, services, occurrences)}
        className={`block w-full text-left ${totalItems > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      >
        <span className={`block text-[11px] font-bold leading-tight ${
          isToday ? 'text-blue-600' : isWeekend ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {day.getDate()}
        </span>
      </button>
      {visibleSvcs.map(svc => {
        const cfg = SERVICIO_ESTADOS.find(e => e.value === svc.estado);
        return (
          <button
            key={svc.id}
            onClick={() => onClickSvc(svc)}
            className={`mt-0.5 w-full text-left text-[9px] truncate px-1 py-0.5 rounded border leading-tight transition-colors ${
              selectedSvc === svc.id ? 'ring-1 ring-blue-400' : ''
            } ${cfg?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
          >
            {svc.titulo}
          </button>
        );
      })}
      {visibleOccs.map((occ, i) => {
        const cfg = OCC_STATUS_CFG[occ.status];
        return (
          <button
            key={`${occ.schedule.id}-${occ.sentido}-${i}`}
            onClick={() => onClickOcc(occ)}
            className={`mt-0.5 w-full text-left text-[9px] truncate px-1 py-0.5 rounded border leading-tight transition-colors ${cfg.bg} ${cfg.text} ${cfg.border}`}
          >
            ↻ {occ.schedule.nombre}
          </button>
        );
      })}
      {overflow > 0 && (
        <button
          onClick={() => onClickDay(day, services, occurrences)}
          className="mt-0.5 text-[9px] text-blue-500 hover:underline pl-0.5"
        >
          +{overflow} más
        </button>
      )}
    </div>
  );
}

// ── ContactCard ───────────────────────────────────────────────────────────────

function ContactCard({ label, contact }: { label: string; contact: TransportContact }) {
  const phone    = phoneHref(contact.telefono);
  const phoneAlt = phoneHref(contact.telefono_alt);
  return (
    <div className="bg-slate-50 rounded-lg p-2.5 space-y-0.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
      {contact.nombre       && <p className="text-xs font-semibold text-slate-800">{contact.nombre}</p>}
      {contact.organizacion && <p className="text-[11px] text-slate-500">{contact.organizacion}</p>}
      {contact.telefono && (
        <a href={phone ?? `tel:${contact.telefono}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Phone className="w-3 h-3" />{contact.telefono}
        </a>
      )}
      {contact.telefono_alt && (
        <a href={phoneAlt ?? `tel:${contact.telefono_alt}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600">
          <Phone className="w-3 h-3" />{contact.telefono_alt} (alt)
        </a>
      )}
    </div>
  );
}

// ── DetailRow ─────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-300 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{label}</span>
        <span className="text-slate-700 text-sm">{children}</span>
      </div>
    </div>
  );
}

// ── AgendaDetailEmpty ─────────────────────────────────────────────────────────

function AgendaDetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-16">
      <Calendar className="w-10 h-10 opacity-20" />
      <p className="text-sm font-medium">Selecciona un servicio</p>
      <p className="text-xs opacity-60">Haz clic en cualquier tarjeta del calendario</p>
    </div>
  );
}

// ── AgendaDetailDayList ───────────────────────────────────────────────────────

interface AgendaDetailDayListProps extends MapsProps {
  date:        Date;
  services:    TradeTransportService[];
  occurrences: AgendaOccurrence[];
  onSelectSvc: (svc: TradeTransportService) => void;
  onSelectOcc: (occ: AgendaOccurrence) => void;
  onBack:      () => void;
}

function AgendaDetailDayList({ date, services, occurrences, vehicleMap, workerMap, onSelectSvc, onSelectOcc, onBack }: AgendaDetailDayListProps) {
  const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const total = services.length + occurrences.length;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div>
          <p className="text-xs font-black text-slate-800 capitalize">{label}</p>
          <p className="text-[11px] text-slate-400">{total} elemento{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {services.map(svc => {
          const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
          const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
          const statusCfg = SERVICIO_ESTADOS.find(e => e.value === svc.estado);
          return (
            <button
              key={svc.id}
              onClick={() => onSelectSvc(svc)}
              className={`w-full text-left rounded-xl border border-l-4 px-3 py-2.5 bg-white hover:shadow-sm transition-all ${LEFT_ACCENT[svc.estado]} border-slate-200`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-800 leading-tight">{svc.titulo}</p>
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg?.color}`}>
                  {statusCfg?.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {fmtTime(svc.fecha_inicio)}{svc.fecha_fin ? ` – ${fmtTime(svc.fecha_fin)}` : ''}
              </p>
              {vehicle   && <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><Bus className="w-2.5 h-2.5" />{vehicle.nombre}</p>}
              {conductor && <p className="text-[10px] text-slate-500 flex items-center gap-1"><Users className="w-2.5 h-2.5" />{conductor.nombre}</p>}
            </button>
          );
        })}
        {occurrences.map((occ, i) => {
          const cfg = OCC_STATUS_CFG[occ.status];
          return (
            <button
              key={`${occ.schedule.id}-${occ.sentido}-${i}`}
              onClick={() => onSelectOcc(occ)}
              className={`w-full text-left rounded-xl border border-l-4 ${cfg.leftAccent} ${cfg.border} px-3 py-2.5 ${cfg.bg} hover:shadow-sm transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Repeat className={`w-3 h-3 shrink-0 ${cfg.text}`} />
                  <p className={`text-xs font-bold leading-tight truncate ${cfg.text}`}>
                    {occ.sentido === 'ida' ? '→' : '←'} {occ.schedule.nombre}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>
              {occ.effectiveHoraSalida && (
                <p className={`text-[10px] font-mono mt-0.5 ${cfg.text} opacity-80`}>
                  {fmtHora(occ.effectiveHoraSalida)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AgendaDetailServicePanel ──────────────────────────────────────────────────

interface AgendaDetailServicePanelProps extends MapsProps {
  svc:           TradeTransportService;
  onClose:       () => void;
  onOpenParte?:  (svcId: string) => void;
  onNavigate?:   (tab: string, serviceId?: string) => void;
  canViewPrecio: boolean;
}

function AgendaDetailServicePanel({ svc, vehicleMap, workerMap, clientMap, onClose, onOpenParte, onNavigate, canViewPrecio }: AgendaDetailServicePanelProps) {
  const vehicle    = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
  const conductor  = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
  const client     = svc.client_id    ? clientMap.get(svc.client_id)    : undefined;
  const tipoLabel  = TIPO_SERVICIO_OPTIONS.find(t => t.value === svc.tipo_servicio)?.label ?? svc.tipo_servicio;
  const vehicleImg = vehicle ? getVehicleDisplayImage(vehicle.tipo, vehicle.image_path) : null;

  const origenText  = (svc.origen_detalle ? locationToText(svc.origen_detalle)  : null) || svc.origen  || null;
  const destinoText = (svc.destino_detalle ? locationToText(svc.destino_detalle) : null) || svc.destino || null;
  const origenAddr  = svc.origen_detalle  ? locationToAddress(svc.origen_detalle)  : null;
  const destinoAddr = svc.destino_detalle ? locationToAddress(svc.destino_detalle) : null;

  const hasStopsOrDest = svc.paradas.length > 0 || !!destinoText;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 leading-tight text-sm">{svc.titulo}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{tipoLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${estadoColor(svc.estado)}`}>
          {svc.estado === 'en_curso' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
          {estadoLabel(svc.estado)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Inicio">{fmtDateFull(svc.fecha_inicio)}</DetailRow>
          {svc.fecha_fin && (
            <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Fin">{fmtDateFull(svc.fecha_fin)}</DetailRow>
          )}
        </div>

        {client && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Cliente">{client}</DetailRow>
        )}

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Itinerario</p>
          <div className="flex gap-2.5">
            <div className="flex flex-col items-center pt-0.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">A</div>
              {hasStopsOrDest && <div className="w-0.5 bg-slate-200 flex-1 my-1" style={{ minHeight: 16 }} />}
            </div>
            <div className="pb-3 min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{origenText ?? 'Sin origen'}</p>
              {origenAddr && origenAddr !== origenText && <p className="text-xs text-slate-400 mt-0.5">{origenAddr}</p>}
            </div>
          </div>
          {svc.paradas.map((p, i) => {
            const isLastStop = i === svc.paradas.length - 1;
            return (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">{i + 1}</div>
                  {(!isLastStop || !!destinoText) && <div className="w-0.5 bg-slate-200 flex-1 my-1" style={{ minHeight: 16 }} />}
                </div>
                <div className="pb-3 min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{p.nombre}</p>
                    {p.hora && <span className="text-[10px] font-mono text-slate-400 shrink-0">{p.hora}</span>}
                  </div>
                  {p.direccion && <p className="text-xs text-slate-400 mt-0.5">{p.direccion}</p>}
                </div>
              </div>
            );
          })}
          {destinoText && (
            <div className="flex gap-2.5">
              <div className="flex flex-col items-center pt-0.5">
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">B</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{destinoText}</p>
                {destinoAddr && destinoAddr !== destinoText && <p className="text-xs text-slate-400 mt-0.5">{destinoAddr}</p>}
              </div>
            </div>
          )}
        </div>

        {vehicle && (
          <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
            {vehicleImg && (
              <img
                src={vehicleImg}
                alt={vehicle.nombre}
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 leading-tight">{vehicle.nombre}</p>
              <p className="text-[11px] text-slate-500">{vehicle.matricula}</p>
              {vehicle.capacidad_viajeros != null && (
                <p className="text-[11px] text-slate-400">{vehicle.capacidad_viajeros} viajeros</p>
              )}
            </div>
          </div>
        )}

        {conductor && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Conductor">{conductor.nombre}</DetailRow>
        )}

        {svc.num_viajeros != null && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Viajeros">{svc.num_viajeros}</DetailRow>
        )}

        {svc.contacto_principal && hasContact(svc.contacto_principal) && (
          <ContactCard label="Contacto principal" contact={svc.contacto_principal} />
        )}

        {svc.instrucciones_conductor && (
          <DetailRow icon={<Navigation className="w-3.5 h-3.5" />} label="Instrucciones conductor">
            <span className="whitespace-pre-line">{svc.instrucciones_conductor}</span>
          </DetailRow>
        )}

        {svc.observaciones && (
          <DetailRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Notas">
            <span className="whitespace-pre-line">{svc.observaciones}</span>
          </DetailRow>
        )}

        {canViewPrecio && svc.precio_acordado != null && (
          <DetailRow icon={<span className="text-xs font-bold">€</span>} label="Precio acordado">
            {svc.precio_acordado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </DetailRow>
        )}

        {onNavigate && (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => onNavigate('transporte_servicios', svc.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Ver en Servicios
            </button>
            <button
              onClick={() => onNavigate('transporte_rutas', svc.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Ver Ruta
            </button>
          </div>
        )}

        {onOpenParte && (svc.estado === 'en_curso' || svc.estado === 'completado') && (
          <button
            onClick={() => onOpenParte(svc.id)}
            className={`w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
              svc.estado === 'en_curso'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {svc.estado === 'en_curso' ? 'Cerrar parte de servicio' : 'Ver parte de servicio'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── OccurrenceDetailPanel ─────────────────────────────────────────────────────

interface OccurrenceDetailPanelProps extends MapsProps {
  occ:           AgendaOccurrence;
  services:      TradeTransportService[];
  onClose:       () => void;
  onNavigate?:   (tab: string, serviceId?: string) => void;
  onPrepare:     (occ: AgendaOccurrence) => void;
  preparing:     boolean;
  canViewPrecio: boolean;
}

function OccurrenceDetailPanel({ occ, services, vehicleMap, workerMap, clientMap, onClose, onNavigate, onPrepare, preparing, canViewPrecio }: OccurrenceDetailPanelProps) {
  const cfg       = OCC_STATUS_CFG[occ.status];
  const vehicle   = occ.effectiveVehicleId   ? vehicleMap.get(occ.effectiveVehicleId)   : undefined;
  const conductor = occ.effectiveConductorId ? workerMap.get(occ.effectiveConductorId) : undefined;
  const client    = occ.schedule.client_id   ? clientMap.get(occ.schedule.client_id)    : undefined;
  const vehicleImg = vehicle ? getVehicleDisplayImage(vehicle.tipo, vehicle.image_path) : null;
  const sentidoLabel = occ.sentido === 'ida' ? 'Ida' : 'Vuelta';

  const conflicts = useMemo(
    () => detectConflicts(occ, services),
    [occ, services], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dateLabel = new Date(occ.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Repeat className={`w-3.5 h-3.5 shrink-0 ${cfg.text}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ruta recurrente · {sentidoLabel}</span>
            </div>
            <h3 className={`font-black text-slate-900 leading-tight text-sm`}>{occ.schedule.nombre}</h3>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Excepción activa */}
        {occ.exception && (
          <div className={`rounded-xl border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
            <p className={`text-xs font-bold ${cfg.text}`}>
              {SCHEDULE_EXCEPTION_TIPO_LABELS[occ.exception.tipo]}
            </p>
            {occ.exception.motivo && (
              <p className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>{occ.exception.motivo}</p>
            )}
          </div>
        )}

        {/* Conflictos informativos */}
        {conflicts.length > 0 && occ.status === 'pending' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700">Posible conflicto de recursos</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {vehicle && conflicts.some(s => s.vehicle_id === occ.effectiveVehicleId) && `El vehículo ya tiene un servicio este día. `}
                {conductor && conflicts.some(s => s.conductor_id === occ.effectiveConductorId) && `El conductor ya tiene un servicio este día.`}
              </p>
            </div>
          </div>
        )}

        <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Hora salida">
          {occ.effectiveHoraSalida ? fmtHora(occ.effectiveHoraSalida) : '—'}
        </DetailRow>

        {client && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Cliente">{client}</DetailRow>
        )}

        {canViewPrecio && occ.schedule.precio_referencia != null && (
          <DetailRow icon={<span className="text-xs font-bold">€</span>} label="Precio referencia">
            {occ.schedule.precio_referencia.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </DetailRow>
        )}

        {/* Vehículo */}
        {vehicle ? (
          <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
            {vehicleImg && (
              <img
                src={vehicleImg}
                alt={vehicle.nombre}
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 leading-tight">{vehicle.nombre}</p>
              <p className="text-[11px] text-slate-500">{vehicle.matricula}</p>
              {vehicle.capacidad_viajeros != null && (
                <p className="text-[11px] text-slate-400">{vehicle.capacidad_viajeros} viajeros</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">Sin vehículo asignado</p>
          </div>
        )}

        {conductor && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Conductor">{conductor.nombre}</DetailRow>
        )}

        {occ.schedule.num_viajeros != null && (
          <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Viajeros">{occ.schedule.num_viajeros}</DetailRow>
        )}

        {occ.schedule.observaciones && (
          <DetailRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Notas">
            <span className="whitespace-pre-line">{occ.schedule.observaciones}</span>
          </DetailRow>
        )}

        {/* Acciones */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          {occ.status === 'pending' && (
            <button
              onClick={() => onPrepare(occ)}
              disabled={preparing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {preparing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle className="w-4 h-4" />
              }
              {preparing ? 'Preparando servicio…' : 'Preparar servicio'}
            </button>
          )}

          {occ.status !== 'pending' && occ.status !== 'no_circula' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <CalendarX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500">No se puede preparar: {cfg.label.toLowerCase()}</p>
            </div>
          )}

          {occ.status === 'no_circula' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <CalendarX className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-600">Este día no circula según el calendario</p>
            </div>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate('transporte_rutas_recurrentes')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Gestionar ruta recurrente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AgendaDetailPanel ─────────────────────────────────────────────────────────

interface AgendaDetailPanelProps extends MapsProps {
  state:           DetailState;
  services:        TradeTransportService[];
  onClear:         () => void;
  onOpenParte?:    (svcId: string) => void;
  onNavigate?:     (tab: string, serviceId?: string) => void;
  onSelectFromDay: (svc: TradeTransportService) => void;
  onSelectOccFromDay: (occ: AgendaOccurrence) => void;
  onPrepare:       (occ: AgendaOccurrence) => void;
  preparing:       boolean;
  canViewPrecio:   boolean;
}

function AgendaDetailPanel({
  state, services, vehicleMap, workerMap, clientMap,
  onClear, onOpenParte, onNavigate,
  onSelectFromDay, onSelectOccFromDay,
  onPrepare, preparing, canViewPrecio,
}: AgendaDetailPanelProps) {
  if (state.kind === 'empty') return <AgendaDetailEmpty />;

  if (state.kind === 'day') {
    return (
      <AgendaDetailDayList
        date={state.date}
        services={state.services}
        occurrences={state.occurrences}
        vehicleMap={vehicleMap}
        workerMap={workerMap}
        clientMap={clientMap}
        onSelectSvc={onSelectFromDay}
        onSelectOcc={onSelectOccFromDay}
        onBack={onClear}
      />
    );
  }

  if (state.kind === 'occurrence') {
    return (
      <OccurrenceDetailPanel
        occ={state.occ}
        services={services}
        vehicleMap={vehicleMap}
        workerMap={workerMap}
        clientMap={clientMap}
        onClose={onClear}
        onNavigate={onNavigate}
        onPrepare={onPrepare}
        preparing={preparing}
        canViewPrecio={canViewPrecio}
      />
    );
  }

  return (
    <AgendaDetailServicePanel
      svc={state.svc}
      vehicleMap={vehicleMap}
      workerMap={workerMap}
      clientMap={clientMap}
      onClose={onClear}
      onOpenParte={onOpenParte}
      onNavigate={onNavigate}
      canViewPrecio={canViewPrecio}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScreenTransporteAgenda({ orgId, showToast, onOpenParte, onNavigate }: Props) {
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const loadIdRef     = useRef(0);
  const materializeRef = useRef(false);

  const { can } = usePermissions();
  const canViewPrecio = can('ingresos.view');

  const [viewMode,     setViewMode]     = useState<ViewMode>('weekly');
  const [weekStart,    setWeekStart]    = useState(() => startOfWeek(new Date()));
  const [monthStart,   setMonthStart]   = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [intervalFrom, setIntervalFrom] = useState(() => isoDate(new Date()));
  const [intervalTo,   setIntervalTo]   = useState(() => isoDate(addDays(new Date(), 6)));
  const [mobileDayIdx, setMobileDayIdx] = useState<number>(() => {
    const today = new Date();
    const ws = startOfWeek(today);
    return Math.min(6, Math.round((today.getTime() - ws.getTime()) / 86400000));
  });

  const [services,   setServices]   = useState<TradeTransportService[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap,  setWorkerMap]  = useState<Map<string, TradeWorker>>(new Map());
  const [clientMap,  setClientMap]  = useState<Map<string, string>>(new Map());
  const [vehicles,   setVehicles]   = useState<TradeVehicle[]>([]);
  const [workers,    setWorkers]    = useState<TradeWorker[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadedOrgId,  setLoadedOrgId]  = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [detail,       setDetail]       = useState<DetailState>({ kind: 'empty' });
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [filterVehicle,   setFilterVehicle]   = useState('');
  const [filterConductor, setFilterConductor] = useState('');

  // Recurring schedules state
  const [schedules,         setSchedules]         = useState<TradeTransportSchedule[]>([]);
  const [scheduleExceptions, setScheduleExceptions] = useState<TradeTransportScheduleException[]>([]);
  const [scheduleLinks,      setScheduleLinks]      = useState<TradeTransportOccurrenceLink[]>([]);
  const [schedulesAvailable, setSchedulesAvailable] = useState(true);
  const [preparing,          setPreparing]           = useState(false);

  // Security: sync clear on org change
  useEffect(() => {
    setLoadedOrgId(null);
    setDetail({ kind: 'empty' });
    setServices([]);
    setVehicleMap(new Map());
    setWorkerMap(new Map());
    setClientMap(new Map());
    setVehicles([]);
    setWorkers([]);
    setSchedules([]);
    setScheduleExceptions([]);
    setScheduleLinks([]);
  }, [orgId]);

  useEffect(() => {
    if (detail.kind === 'empty') setMobileView('list');
  }, [detail]);

  const { desde, hasta } = useMemo(() => {
    if (viewMode === 'weekly') {
      const end = addDays(weekStart, 6);
      return { desde: isoDate(weekStart) + 'T00:00:00', hasta: isoDate(end) + 'T23:59:59' };
    }
    if (viewMode === 'monthly') {
      const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      return { desde: isoDate(monthStart) + 'T00:00:00', hasta: isoDate(end) + 'T23:59:59' };
    }
    const from = intervalFrom || isoDate(new Date());
    const to   = intervalTo   || from;
    return { desde: from + 'T00:00:00', hasta: to + 'T23:59:59' };
  }, [viewMode, weekStart, monthStart, intervalFrom, intervalTo]);

  const desdeDate = useMemo(() => new Date(desde), [desde]);
  const hastaDate = useMemo(() => new Date(hasta), [hasta]);
  const desdeDateISO = desde.slice(0, 10);
  const hastaDateISO = hasta.slice(0, 10);

  const load = useCallback(async () => {
    const myId = ++loadIdRef.current;
    const capturedOrgId = orgId;
    setLoading(true);
    setError(null);
    try {
      const [svcs, vehs, wrks, clients] = await Promise.all([
        loadServicesOverlappingRange(capturedOrgId, desde, hasta),
        loadVehiclesAll(capturedOrgId),
        loadWorkers(capturedOrgId),
        loadClients(capturedOrgId),
      ]);
      if (loadIdRef.current !== myId) return;
      svcs.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
      setServices(svcs);
      setVehicles(vehs);
      setWorkers(wrks);

      const cm = new Map<string, string>();
      for (const c of clients) cm.set(c.id, getClientDisplayName(c));
      setClientMap(cm);

      const vm = new Map<string, TradeVehicle>();
      for (const v of vehs) vm.set(v.id, v);
      setVehicleMap(vm);

      const wm = new Map<string, TradeWorker>();
      for (const w of wrks) wm.set(w.id, w);
      setWorkerMap(wm);

      setLoadedOrgId(capturedOrgId);
    } catch (e) {
      if (loadIdRef.current !== myId) return;
      const msg = e instanceof Error ? e.message : 'Error cargando agenda';
      setError(msg);
      showToastRef.current(msg, 'error');
    } finally {
      if (loadIdRef.current === myId) setLoading(false);
    }
  }, [orgId, desde, hasta]);

  const loadRecurring = useCallback(async () => {
    const capturedOrgId = orgId;
    try {
      const [scheds, excs, lks] = await Promise.all([
        loadSchedulesActive(capturedOrgId),
        loadExceptionsForRange(capturedOrgId, desdeDateISO, hastaDateISO),
        loadOccurrenceLinksForRange(capturedOrgId, desdeDateISO, hastaDateISO),
      ]);
      if (orgId !== capturedOrgId) return;
      setSchedules(scheds);
      setScheduleExceptions(excs);
      setScheduleLinks(lks);
      setSchedulesAvailable(true);
    } catch (e: unknown) {
      if (isModuleNotDeployedError(e)) {
        // F1/F2 tables not yet deployed — degrade silently
        setSchedules([]);
        setScheduleExceptions([]);
        setScheduleLinks([]);
        setSchedulesAvailable(false);
      } else {
        // Real error: network, permissions, query → notify user
        const msg = (e as { message?: string })?.message ?? 'Error al cargar rutas recurrentes';
        showToastRef.current(msg, 'error');
      }
    }
  }, [orgId, desdeDateISO, hastaDateISO]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadRecurring(); }, [loadRecurring]);

  // Build occurrences memo
  const allOccurrences = useMemo(
    () => buildAgendaOccurrences(schedules, scheduleExceptions, scheduleLinks, desdeDate, hastaDate),
    [schedules, scheduleExceptions, scheduleLinks, desdeDate, hastaDate],
  );

  // Filters
  const filteredServices = useMemo(() =>
    services.filter(svc => {
      if (filterVehicle   && svc.vehicle_id   !== filterVehicle)   return false;
      if (filterConductor && svc.conductor_id !== filterConductor) return false;
      return true;
    }),
  [services, filterVehicle, filterConductor]);

  const filteredOccurrences = useMemo(() =>
    allOccurrences.filter(occ => {
      if (filterVehicle   && occ.effectiveVehicleId   !== filterVehicle)   return false;
      if (filterConductor && occ.effectiveConductorId !== filterConductor) return false;
      return true;
    }),
  [allOccurrences, filterVehicle, filterConductor]);

  const showLoading = loading || loadedOrgId !== orgId;

  const weekEnd = addDays(weekStart, 6);
  const days    = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  function getServicesForDay(day: Date): TradeTransportService[] {
    const dayStr = isoDate(day);
    return filteredServices.filter(svc => getServiceDays(svc).has(dayStr));
  }

  // Monthly grid
  const monthYear     = monthStart.getFullYear();
  const monthMonthIdx = monthStart.getMonth();
  const monthLastDay  = new Date(monthYear, monthMonthIdx + 1, 0).getDate();
  const monthFirstDow = (new Date(monthYear, monthMonthIdx, 1).getDay() + 6) % 7;

  const monthGridCells = useMemo<(Date | null)[]>(() => {
    const cells: (Date | null)[] = [
      ...Array(monthFirstDow).fill(null),
      ...Array.from({ length: monthLastDay }, (_, i) => new Date(monthYear, monthMonthIdx, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthYear, monthMonthIdx, monthLastDay, monthFirstDow]);

  const intervalDays = useMemo<Date[]>(() => {
    if (!intervalFrom || !intervalTo) return [];
    const from = new Date(intervalFrom + 'T00:00:00');
    const to   = new Date(intervalTo   + 'T00:00:00');
    if (from > to) return [];
    const result: Date[] = [];
    const cur = new Date(from);
    while (cur <= to && result.length < 62) {
      result.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [intervalFrom, intervalTo]);

  const todayStr = isoDate(new Date());

  const passengerVehicles = useMemo(() =>
    vehicles.filter(v => v.activo && (v.modalidad === 'viajeros' || v.modalidad === 'mixto')),
  [vehicles]);

  const conductorWorkers = useMemo(() => workers.filter(w => w.es_conductor), [workers]);
  const hasFilters = filterVehicle !== '' || filterConductor !== '';

  function goToToday() {
    const now = new Date();
    if (viewMode === 'weekly') {
      setWeekStart(startOfWeek(now));
      const ws = startOfWeek(now);
      setMobileDayIdx(Math.min(6, Math.round((now.getTime() - ws.getTime()) / 86400000)));
    } else if (viewMode === 'monthly') {
      setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1));
    } else {
      setIntervalFrom(isoDate(now));
      setIntervalTo(isoDate(addDays(now, 6)));
    }
    setDetail({ kind: 'empty' });
  }

  function goPrev() {
    if (viewMode === 'weekly') setWeekStart(w => addDays(w, -7));
    else if (viewMode === 'monthly')  setMonthStart(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else {
      const from = new Date(intervalFrom + 'T00:00:00');
      const to   = new Date(intervalTo   + 'T00:00:00');
      const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      setIntervalFrom(isoDate(addDays(from, -span)));
      setIntervalTo(isoDate(addDays(to,   -span)));
    }
  }

  function goNext() {
    if (viewMode === 'weekly') setWeekStart(w => addDays(w, 7));
    else if (viewMode === 'monthly')  setMonthStart(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else {
      const from = new Date(intervalFrom + 'T00:00:00');
      const to   = new Date(intervalTo   + 'T00:00:00');
      const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      setIntervalFrom(isoDate(addDays(from, span)));
      setIntervalTo(isoDate(addDays(to,   span)));
    }
  }

  function switchMode(m: ViewMode) {
    if (m === 'weekly'   && viewMode === 'monthly')  setWeekStart(startOfWeek(monthStart));
    if (m === 'monthly'  && viewMode === 'weekly')   setMonthStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
    if (m === 'interval') {
      const ref = viewMode === 'weekly' ? weekStart : monthStart;
      setIntervalFrom(isoDate(ref));
      setIntervalTo(isoDate(addDays(ref, 6)));
    }
    setMobileDayIdx(0);
    setViewMode(m);
    setDetail({ kind: 'empty' });
  }

  function selectService(svc: TradeTransportService) {
    setDetail({ kind: 'service', svc });
    setMobileView('detail');
  }

  function selectOccurrence(occ: AgendaOccurrence) {
    setDetail({ kind: 'occurrence', occ });
    setMobileView('detail');
  }

  function selectDay(day: Date, svcs: TradeTransportService[], occs: AgendaOccurrence[]) {
    if (svcs.length === 1 && occs.length === 0) { selectService(svcs[0]!); return; }
    if (svcs.length === 0 && occs.length === 1) { selectOccurrence(occs[0]!); return; }
    setDetail({ kind: 'day', date: day, services: svcs, occurrences: occs });
    setMobileView('detail');
  }

  function clearDetail() { setDetail({ kind: 'empty' }); }

  const selectedSvcId = detail.kind === 'service' ? detail.svc.id : null;

  async function handlePrepare(occ: AgendaOccurrence) {
    if (materializeRef.current) return;
    materializeRef.current = true;
    setPreparing(true);
    try {
      const utcOffset = -(new Date().getTimezoneOffset());
      const result = await materializeOccurrence(orgId, occ.schedule.id, occ.fecha, occ.sentido, utcOffset);
      if (result.error === 'TRANSPORT_DST_AMBIGUOUS') {
        showToastRef.current('Hora ambigua por cambio de hora. Contacta con soporte.', 'error');
        return;
      }
      if (!result.ok) {
        showToastRef.current(result.error ?? 'Error preparando servicio', 'error');
        return;
      }
      if (result.idempotent) {
        showToastRef.current('El servicio ya estaba preparado', 'info');
      } else {
        showToastRef.current('Servicio creado correctamente', 'success');
      }
      void load();
      void loadRecurring();
      clearDetail();
      if (result.service_id) {
        onNavigate?.('transporte_servicios', result.service_id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      // Table/function not found = F1/F2 not deployed
      if (msg.includes('does not exist') || msg.includes('PGRST') || msg.includes('42P01') || msg.includes('42883')) {
        showToastRef.current('Las rutas recurrentes requieren aplicar las migraciones F1/F2 en producción', 'error');
      } else {
        showToastRef.current(msg, 'error');
      }
    } finally {
      materializeRef.current = false;
      setPreparing(false);
    }
  }

  const currentPeriodLabel = useMemo(() => {
    if (viewMode === 'weekly')  return `${fmtDayShort(weekStart)} – ${fmtDayShort(weekEnd)}`;
    if (viewMode === 'monthly') return fmtMonthYear(monthStart);
    if (!intervalFrom || !intervalTo) return 'Selecciona rango';
    return `${new Date(intervalFrom + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${new Date(intervalTo + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [viewMode, weekStart, weekEnd, monthStart, intervalFrom, intervalTo]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">Agenda</h1>
              <p className="text-xs text-slate-400 capitalize">{currentPeriodLabel}</p>
            </div>
            {schedulesAvailable && schedules.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                <Repeat className="w-2.5 h-2.5" />
                {schedules.length} ruta{schedules.length !== 1 ? 's' : ''} activa{schedules.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold shrink-0">
            {(['weekly', 'monthly', 'interval'] as const).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-2 transition-colors ${viewMode === m ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {m === 'weekly' ? 'Semanal' : m === 'monthly' ? 'Mensual' : 'Intervalo'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={goToToday}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
          >
            Hoy
          </button>

          {viewMode !== 'interval' && (
            <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden shrink-0">
              <button onClick={goPrev} className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {viewMode === 'interval' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={intervalFrom}
                max={intervalTo}
                onChange={e => setIntervalFrom(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                value={intervalTo}
                min={intervalFrom}
                onChange={e => setIntervalTo(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                <button onClick={goPrev} className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={goNext} className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          {passengerVehicles.length > 0 && (
            <select
              value={filterVehicle}
              onChange={e => setFilterVehicle(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los vehículos</option>
              {passengerVehicles.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          )}
          {conductorWorkers.length > 0 && (
            <select
              value={filterConductor}
              onChange={e => setFilterConductor(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los conductores</option>
              {conductorWorkers.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setFilterVehicle(''); setFilterConductor(''); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1.5"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {showLoading && (
        <div className="flex items-center justify-center flex-1 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando agenda...</span>
        </div>
      )}

      {/* Error */}
      {!showLoading && error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-red-500">
          <AlertTriangle className="w-8 h-8" />
          <p className="text-sm">{error}</p>
          <button onClick={load} className="text-sm text-blue-600 hover:underline">Reintentar</button>
        </div>
      )}

      {/* Two-column layout */}
      {!showLoading && !error && (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: calendar */}
          <div className={`flex-1 min-w-0 overflow-y-auto p-4 ${mobileView === 'detail' ? 'hidden sm:block' : ''}`}>

            {/* Weekly */}
            {viewMode === 'weekly' && (
              <>
                {/* ── Móvil ── */}
                <div className="sm:hidden space-y-3">
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                      const dayStr    = isoDate(day);
                      const isToday   = dayStr === todayStr;
                      const isSelected = idx === mobileDayIdx;
                      const count     = getServicesForDay(day).length + getOccurrencesForDay(filteredOccurrences, day).length;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <button
                          key={dayStr}
                          onClick={() => setMobileDayIdx(idx)}
                          className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : isToday
                                ? 'bg-blue-50 text-blue-700'
                                : isWeekend
                                  ? 'bg-slate-50 text-slate-400'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                            {day.toLocaleDateString('es-ES', { weekday: 'narrow' })}
                          </span>
                          <span className="text-base font-black leading-tight">{day.getDate()}</span>
                          {count > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white/70' : 'bg-blue-400'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const selectedDay = days[mobileDayIdx];
                      if (!selectedDay) return null;
                      const daySvcs = getServicesForDay(selectedDay);
                      const dayOccs = getOccurrencesForDay(filteredOccurrences, selectedDay);
                      if (daySvcs.length === 0 && dayOccs.length === 0) {
                        return (
                          <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
                            <Calendar className="w-6 h-6 opacity-30" />
                            <p className="text-xs">Sin servicios este día</p>
                          </div>
                        );
                      }
                      return (
                        <>
                          {daySvcs.map(svc => (
                            <AgendaServiceCard
                              key={`${svc.id}-${isoDate(selectedDay)}`}
                              svc={svc}
                              vehicleMap={vehicleMap}
                              workerMap={workerMap}
                              clientMap={clientMap}
                              selected={selectedSvcId === svc.id}
                              onClick={() => selectService(svc)}
                            />
                          ))}
                          {dayOccs.map((occ, i) => (
                            <AgendaOccurrenceCard
                              key={`${occ.schedule.id}-${occ.sentido}-${i}`}
                              occ={occ}
                              selected={detail.kind === 'occurrence' && detail.occ.fecha === occ.fecha && detail.occ.schedule.id === occ.schedule.id && detail.occ.sentido === occ.sentido}
                              onClick={() => selectOccurrence(occ)}
                            />
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Desktop: grid 7 columnas ── */}
                <div className="hidden sm:grid grid-cols-7 gap-1.5 min-w-0">
                  {days.map(day => {
                    const dayStr      = isoDate(day);
                    const isToday     = dayStr === todayStr;
                    const dayServices = getServicesForDay(day);
                    const dayOccs     = getOccurrencesForDay(filteredOccurrences, day);
                    const isWeekend   = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={dayStr} className="flex flex-col gap-1 min-w-0">
                        <div className={`px-1 py-1 rounded-lg text-center text-[10px] font-bold uppercase tracking-wide leading-tight ${
                          isToday ? 'bg-blue-600 text-white' : isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'
                        }`}>
                          {fmtDayShort(day)}
                          {(dayServices.length + dayOccs.length) > 0 && (
                            <span className={`ml-0.5 text-[9px] px-1 rounded-full font-black ${isToday ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                              {dayServices.length + dayOccs.length}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                          {dayServices.length === 0 && dayOccs.length === 0
                            ? <div className={`min-h-[48px] rounded-lg border-dashed border ${isWeekend ? 'border-slate-100' : 'border-slate-200'}`} />
                            : (
                              <>
                                {dayServices.map(svc => (
                                  <AgendaServiceCard
                                    key={`${svc.id}-${dayStr}`}
                                    svc={svc}
                                    vehicleMap={vehicleMap}
                                    workerMap={workerMap}
                                    clientMap={clientMap}
                                    selected={selectedSvcId === svc.id}
                                    onClick={() => selectService(svc)}
                                  />
                                ))}
                                {dayOccs.map((occ, i) => (
                                  <AgendaOccurrenceCard
                                    key={`${occ.schedule.id}-${occ.sentido}-${i}`}
                                    occ={occ}
                                    selected={detail.kind === 'occurrence' && detail.occ.fecha === occ.fecha && detail.occ.schedule.id === occ.schedule.id && detail.occ.sentido === occ.sentido}
                                    onClick={() => selectOccurrence(occ)}
                                  />
                                ))}
                              </>
                            )
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Monthly */}
            {viewMode === 'monthly' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                    <div key={d} className="text-center text-[11px] font-bold text-slate-400 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthGridCells.map((day, i) =>
                    !day
                      ? <div key={`empty-${i}`} className="min-h-[72px]" />
                      : (
                        <MonthDayCell
                          key={isoDate(day)}
                          day={day}
                          services={filteredServices.filter(svc => getServiceDays(svc).has(isoDate(day)))}
                          occurrences={getOccurrencesForDay(filteredOccurrences, day)}
                          todayStr={todayStr}
                          onClickDay={(d, svcs, occs) => selectDay(d, svcs, occs)}
                          onClickSvc={selectService}
                          onClickOcc={selectOccurrence}
                          selectedSvc={selectedSvcId}
                        />
                      )
                  )}
                </div>
                {filteredServices.length === 0 && filteredOccurrences.length === 0 && (
                  <div className="mt-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
                    <Calendar className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">Sin servicios este mes</p>
                  </div>
                )}
              </>
            )}

            {/* Interval */}
            {viewMode === 'interval' && (
              <div className="space-y-3">
                {(!intervalFrom || !intervalTo || intervalDays.length === 0) && (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
                    <Calendar className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">
                      {intervalFrom && intervalTo && intervalDays.length === 0
                        ? 'Fecha inicio posterior a fecha fin'
                        : 'Selecciona un intervalo de fechas'}
                    </p>
                  </div>
                )}
                {intervalDays.map(day => {
                  const dayStr    = isoDate(day);
                  const isToday   = dayStr === todayStr;
                  const daySvcs   = getServicesForDay(day);
                  const dayOccs   = getOccurrencesForDay(filteredOccurrences, day);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div key={dayStr} className="space-y-1">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                        isToday ? 'bg-blue-600 text-white' : isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {(daySvcs.length + dayOccs.length) > 0 && (
                          <span className={`ml-2 text-[10px] px-1.5 rounded-full font-black ${isToday ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                            {daySvcs.length + dayOccs.length}
                          </span>
                        )}
                      </div>
                      {daySvcs.length === 0 && dayOccs.length === 0
                        ? <div className={`min-h-[32px] rounded-lg border-dashed border ${isWeekend ? 'border-slate-100' : 'border-slate-200'}`} />
                        : (
                          <>
                            {daySvcs.map(svc => (
                              <AgendaServiceCard
                                key={`${svc.id}-${dayStr}`}
                                svc={svc}
                                vehicleMap={vehicleMap}
                                workerMap={workerMap}
                                clientMap={clientMap}
                                selected={selectedSvcId === svc.id}
                                onClick={() => selectService(svc)}
                              />
                            ))}
                            {dayOccs.map((occ, i) => (
                              <AgendaOccurrenceCard
                                key={`${occ.schedule.id}-${occ.sentido}-${i}`}
                                occ={occ}
                                selected={detail.kind === 'occurrence' && detail.occ.fecha === occ.fecha && detail.occ.schedule.id === occ.schedule.id && detail.occ.sentido === occ.sentido}
                                onClick={() => selectOccurrence(occ)}
                              />
                            ))}
                          </>
                        )
                      }
                    </div>
                  );
                })}
                {intervalDays.length > 0 && filteredServices.length === 0 && filteredOccurrences.length === 0 && (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
                    <Calendar className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">Sin servicios en este intervalo</p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right: detail panel */}
          <div className={`shrink-0 border-l border-slate-100 flex flex-col min-h-0 bg-white ${
            mobileView === 'detail'
              ? 'flex-1 w-full sm:flex-none sm:w-72 xl:w-80'
              : 'hidden sm:flex sm:w-72 xl:w-80'
          }`}>
            {mobileView === 'detail' && detail.kind !== 'empty' && (
              <button
                onClick={() => { clearDetail(); }}
                className="sm:hidden flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-blue-600 border-b border-slate-100 hover:bg-blue-50 shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Volver al calendario
              </button>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AgendaDetailPanel
                state={detail}
                services={services}
                vehicleMap={vehicleMap}
                workerMap={workerMap}
                clientMap={clientMap}
                onClear={clearDetail}
                onOpenParte={onOpenParte}
                onNavigate={onNavigate}
                onSelectFromDay={selectService}
                onSelectOccFromDay={selectOccurrence}
                onPrepare={handlePrepare}
                preparing={preparing}
                canViewPrecio={canViewPrecio}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
