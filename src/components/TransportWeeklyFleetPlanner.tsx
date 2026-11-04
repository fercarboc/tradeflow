/**
 * TransportWeeklyFleetPlanner.tsx
 * Vista semanal unificada de flota — TX-TRANSPORT-WEEKLY-FLEET-1 Fase 1
 *
 * Componente de presentación pura. No realiza consultas a Supabase.
 * El padre gestiona la carga de datos y pasa arrays ya filtrados por semana.
 * Soporta: empresas Viajeros, Mercancías y Combinadas.
 *
 * Diseño: filas=vehículos, columnas=días Lun–Dom.
 * Barras continuas para operaciones multidía via computeWeeklyBarSegments().
 */

import React, { useMemo } from 'react';
import { Bus, Truck, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  isVehiclePassenger,
  isoDate,
  type VehicleAlertItem,
} from '../lib/transportPanelHelpers';
import {
  computeWeeklyBarSegments,
  type WeeklyBarSegment,
} from '../lib/weeklyFleetHelpers';
import type { TradeVehicle } from '../lib/transport';
import type { TradeTransportService } from '../lib/transportServices';
import type { TradeTransportTrip } from '../lib/transportTrips';
import type { AgendaOccurrence } from './ScreenTransporteAgenda';

// ── Re-export pure types para acceso externo ──────────────────────────────────

export type { WeeklyBarSegment } from '../lib/weeklyFleetHelpers';
export { computeWeeklyBarSegments } from '../lib/weeklyFleetHelpers';

// ── Local vehicle helper (mirrors ScreenTransportePanel — no se extrae de allí) ─

function isVehicleCargo(v: Pick<TradeVehicle, 'modalidad'>): boolean {
  return v.modalidad === 'mercancias' || v.modalidad === 'reparto' || v.modalidad === 'mixto';
}

// ── Types ──────────────────────────────────────────────────────────────────────

/** Operación normalizada lista para renderizado en la grid semanal. */
export interface WeeklyPlotItem {
  id: string;
  kind: 'service' | 'trip' | 'occurrence';
  vehicleId: string | null;
  titulo: string;
  origen?: string | null;
  destino?: string | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null | undefined;
  segments: WeeklyBarSegment[];
  hasConflict: boolean;
  /** Solo para kind='occurrence': objeto completo para el callback onOccurrenceClick. */
  occurrenceRef?: AgendaOccurrence;
}

export interface TransportWeeklyFleetPlannerProps {
  /**
   * Exactamente 7 Date a medianoche local, Lun→Dom.
   * Calcular con: Array.from({length:7}, (_, i) => addDays(weekStart, i))
   */
  weekDays: Date[];
  /**
   * Todos los vehículos de la organización (activos + inactivos).
   * El componente filtra por `mode` y excluye baja/inactivos.
   */
  vehicles: TradeVehicle[];
  /**
   * Servicios de Viajeros que solapan con la semana.
   * Cargar con loadServicesOverlappingRange(orgId, desde, hasta).
   */
  services: TradeTransportService[];
  /**
   * Viajes de Mercancías que solapan con la semana.
   * Cargar con loadTripsOverlappingRange(orgId, desde, hasta).
   */
  trips: TradeTransportTrip[];
  /**
   * Ocurrencias de rutas recurrentes en el rango de la semana.
   * Construir con buildAgendaOccurrences(schedules, exceptions, links, desde, hasta).
   */
  occurrences: AgendaOccurrence[];
  /**
   * 'general'    — todos los vehículos activos, todos los tipos de operación
   * 'viajeros'   — vehículos de pasajeros + servicios + ocurrencias recurrentes
   * 'mercancias' — vehículos de carga + viajes de mercancías
   */
  mode: 'general' | 'viajeros' | 'mercancias';
  /**
   * Alertas de ITV, seguro y mantenimiento calculadas con computeVehicleAlerts().
   * Solo se muestran indicadores cuando existe información real que lo justifica.
   */
  alerts: VehicleAlertItem[];
  onServiceClick?: (id: string) => void;
  onTripClick?: (id: string) => void;
  onOccurrenceClick?: (occ: AgendaOccurrence) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_H   = 14; // px — altura de cada banda (mínimo táctil 14px)
const BAR_GAP = 3;  // px — separación vertical entre bandas
const ROW_PAD = 5;  // px — padding vertical mínimo por celda
const MIN_ROW_H = BAR_H + ROW_PAD * 2; // 24px

const DAYS_ES   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// ── Color helpers ─────────────────────────────────────────────────────────────

export function barColorClass(kind: WeeklyPlotItem['kind'], estado: string): string {
  if (kind === 'occurrence') {
    return estado === 'no_circula' || estado === 'suspended'
      ? 'bg-slate-300 opacity-60'
      : 'bg-teal-400 hover:bg-teal-500';
  }
  if (kind === 'trip') {
    if (estado === 'en_curso')   return 'bg-orange-500 hover:bg-orange-600';
    if (estado === 'confirmado') return 'bg-orange-400 hover:bg-orange-500';
    if (estado === 'completado') return 'bg-orange-300 opacity-70';
    if (estado === 'borrador')   return 'bg-orange-200 hover:bg-orange-300';
    return 'bg-orange-300';
  }
  // service (Viajeros)
  if (estado === 'en_curso')   return 'bg-blue-500 hover:bg-blue-600';
  if (estado === 'confirmado') return 'bg-blue-400 hover:bg-blue-500';
  if (estado === 'completado') return 'bg-blue-300 opacity-70';
  if (estado === 'borrador')   return 'bg-blue-200 hover:bg-blue-300';
  return 'bg-blue-300';
}

export function borderRadius(seg: WeeklyBarSegment): string {
  if (seg.isStart && seg.isEnd) return '4px';
  if (seg.isStart)              return '4px 0 0 4px';
  if (seg.isEnd)                return '0 4px 4px 0';
  return '0';
}

/**
 * Construye el texto del tooltip para una operación de la grid semanal.
 * Incluye título, ruta origen→destino, rango horario y estado (si no trivial).
 */
export function buildTooltip(item: WeeklyPlotItem): string {
  const parts: string[] = [item.titulo];
  if (item.origen && item.destino) parts.push(`${item.origen} → ${item.destino}`);
  const startTime = item.fechaInicio.includes('T')
    ? item.fechaInicio.split('T')[1]?.slice(0, 5) ?? null
    : null;
  if (startTime) {
    const endTime = item.fechaFin?.includes('T')
      ? item.fechaFin.split('T')[1]?.slice(0, 5) ?? null
      : null;
    parts.push(endTime ? `${startTime} – ${endTime}` : `${startTime} → ?`);
  }
  const hiddenEstados = new Set(['pending', 'confirmado']);
  if (item.estado && !hiddenEstados.has(item.estado)) parts.push(item.estado);
  return parts.filter(Boolean).join(' · ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransportWeeklyFleetPlanner({
  weekDays,
  vehicles,
  services,
  trips,
  occurrences,
  mode,
  alerts,
  onServiceClick,
  onTripClick,
  onOccurrenceClick,
}: TransportWeeklyFleetPlannerProps) {

  const todayStr = useMemo(() => isoDate(new Date()), []);

  // ── 1. Filtrar vehículos según mode ────────────────────────────────────────
  const filteredVehicles = useMemo(() => {
    // Excluir siempre dados de baja e inactivos
    const active = vehicles.filter(v => v.activo && v.estado !== 'baja');
    if (mode === 'viajeros')   return active.filter(v => isVehiclePassenger(v));
    if (mode === 'mercancias') return active.filter(v => isVehicleCargo(v));
    return active; // 'general' — toda la flota activa
  }, [vehicles, mode]);

  // ── 2. Construir PlotItems normalizados ────────────────────────────────────
  const allItems = useMemo((): WeeklyPlotItem[] => {
    const items: WeeklyPlotItem[] = [];

    // Servicios de Viajeros (azul)
    if (mode !== 'mercancias') {
      for (const svc of services) {
        if (svc.estado === 'cancelado') continue;
        const segs = computeWeeklyBarSegments(svc.fecha_inicio, svc.fecha_fin, weekDays);
        if (segs.length === 0) continue;
        items.push({
          id: svc.id, kind: 'service',
          vehicleId: svc.vehicle_id ?? null,
          titulo: svc.titulo, origen: svc.origen, destino: svc.destino,
          estado: svc.estado,
          fechaInicio: svc.fecha_inicio, fechaFin: svc.fecha_fin,
          segments: segs, hasConflict: false,
        });
      }
    }

    // Rutas recurrentes (teal) — solo para Viajeros y General
    if (mode !== 'mercancias') {
      for (const occ of occurrences) {
        if (occ.status === 'no_circula' || occ.status === 'suspended') continue;
        const dayStr = occ.fecha;
        if (!weekDays.some(d => isoDate(d) === dayStr)) continue;
        const hora        = occ.effectiveHoraSalida ?? occ.schedule.hora_salida_ida ?? null;
        const fechaInicio = hora ? `${dayStr}T${hora}:00` : `${dayStr}T00:00:00`;
        const segs = computeWeeklyBarSegments(fechaInicio, null, weekDays);
        if (segs.length === 0) continue;
        items.push({
          id: `occ:${occ.schedule.id}:${dayStr}:${occ.sentido}`,
          kind: 'occurrence',
          vehicleId: occ.effectiveVehicleId ?? null,
          titulo: occ.schedule.nombre,
          origen: null, destino: null,
          estado: occ.status,
          fechaInicio, fechaFin: null,
          segments: segs, hasConflict: false,
          occurrenceRef: occ,
        });
      }
    }

    // Viajes de Mercancías (naranja)
    if (mode !== 'viajeros') {
      for (const trip of trips) {
        if (trip.estado === 'cancelado') continue;
        const segs = computeWeeklyBarSegments(trip.fecha_inicio, trip.fecha_fin, weekDays);
        if (segs.length === 0) continue;
        items.push({
          id: trip.id, kind: 'trip',
          vehicleId: trip.vehicle_id ?? null,
          titulo: trip.titulo, origen: trip.origen, destino: trip.destino,
          estado: trip.estado,
          fechaInicio: trip.fecha_inicio, fechaFin: trip.fecha_fin,
          segments: segs, hasConflict: false,
        });
      }
    }

    // Detectar conflictos de solapamiento por vehículo
    const byVehicle = new Map<string, WeeklyPlotItem[]>();
    for (const it of items) {
      if (!it.vehicleId) continue;
      const lst = byVehicle.get(it.vehicleId) ?? [];
      lst.push(it);
      byVehicle.set(it.vehicleId, lst);
    }
    for (const lst of byVehicle.values()) {
      for (let i = 0; i < lst.length; i++) {
        for (let j = i + 1; j < lst.length; j++) {
          const a = lst[i], b = lst[j];
          const aS = new Date(a.fechaInicio).getTime();
          const aE = a.fechaFin ? new Date(a.fechaFin).getTime() : aS + 7_200_000;
          const bS = new Date(b.fechaInicio).getTime();
          const bE = b.fechaFin ? new Date(b.fechaFin).getTime() : bS + 7_200_000;
          if (aS < bE && aE > bS) {
            a.hasConflict = true;
            b.hasConflict = true;
          }
        }
      }
    }

    return items;
  }, [services, trips, occurrences, weekDays, mode]);

  // ── 3. Agrupar items por (vehicleId, dayIndex) ─────────────────────────────
  type CellKey = string; // `${vehicleId|'__none__'}:${dayIndex}`
  type CellEntry = { item: WeeklyPlotItem; seg: WeeklyBarSegment };

  const cellMap = useMemo((): Map<CellKey, CellEntry[]> => {
    const map = new Map<CellKey, CellEntry[]>();
    for (const item of allItems) {
      for (const seg of item.segments) {
        const key = `${item.vehicleId ?? '__none__'}:${seg.dayIndex}` as CellKey;
        const lst = map.get(key) ?? [];
        lst.push({ item, seg });
        map.set(key, lst);
      }
    }
    // Ordenar por hora de inicio para asignación de carril estable
    for (const lst of map.values()) {
      lst.sort((a, b) => new Date(a.item.fechaInicio).getTime() - new Date(b.item.fechaInicio).getTime());
    }
    return map;
  }, [allItems]);

  // ── 4. Altura de fila: máximo de carriles en cualquier celda de esa fila ────
  const rowHeightPx = useMemo((): Map<string | null, number> => {
    const result = new Map<string | null, number>();
    for (const v of filteredVehicles) result.set(v.id, 0);
    result.set(null, 0); // fila sin asignar

    for (const [key, lst] of cellMap.entries()) {
      const [vid] = key.split(':');
      const realVid = vid === '__none__' ? null : vid;
      // Solo actualizar si este vehículo está en la vista actual
      if (realVid !== null && !filteredVehicles.some(v => v.id === realVid)) continue;
      const cur = result.get(realVid) ?? 0;
      result.set(realVid, Math.max(cur, lst.length));
    }

    // Convertir lanes → px
    const pxMap = new Map<string | null, number>();
    for (const [vid, lanes] of result.entries()) {
      pxMap.set(vid, Math.max(MIN_ROW_H, lanes * (BAR_H + BAR_GAP) + ROW_PAD * 2));
    }
    return pxMap;
  }, [cellMap, filteredVehicles]);

  // ── 5. Alertas indexadas por vehicleId ─────────────────────────────────────
  const alertsByVehicle = useMemo((): Map<string, VehicleAlertItem[]> => {
    const map = new Map<string, VehicleAlertItem[]>();
    for (const a of alerts) {
      const lst = map.get(a.vehicleId) ?? [];
      lst.push(a);
      map.set(a.vehicleId, lst);
    }
    return map;
  }, [alerts]);

  const hasUnassigned = useMemo(() => allItems.some(it => it.vehicleId === null), [allItems]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderDayCell(vehicleId: string | null, dayIndex: number, rowH: number): React.ReactNode {
    const key      = `${vehicleId ?? '__none__'}:${dayIndex}` as CellKey;
    const entries  = cellMap.get(key) ?? [];
    const dayStr   = isoDate(weekDays[dayIndex]);
    const isToday  = dayStr === todayStr;
    const isWeekend = dayIndex >= 5;
    const vehicle  = vehicleId ? filteredVehicles.find(v => v.id === vehicleId) ?? null : null;
    const isInMaintenance = vehicle?.estado === 'en_mantenimiento';

    return (
      <div
        key={`c-${vehicleId ?? 'none'}-${dayIndex}`}
        className={`relative flex-1 border-r last:border-r-0 border-b
          border-slate-200
          ${isToday   ? 'bg-blue-50' :
            isWeekend ? 'bg-slate-50/60' :
                        'bg-white'}`}
        style={{ height: rowH, minWidth: 80 }}
        role="gridcell"
        aria-label={dayStr}
      >
        {isInMaintenance && (
          <div
            className="absolute inset-0 bg-slate-300/25 pointer-events-none"
            aria-hidden="true"
          />
        )}
        {entries.map(({ item, seg }, laneIdx) => {
          const color     = barColorClass(item.kind, item.estado);
          const radius    = borderRadius(seg);
          const topPx     = ROW_PAD + laneIdx * (BAR_H + BAR_GAP);
          const label     = seg.isStart ? item.titulo : '';
          const clickable = !!(
            (item.kind === 'service'    && onServiceClick) ||
            (item.kind === 'trip'       && onTripClick) ||
            (item.kind === 'occurrence' && onOccurrenceClick)
          );
          const tooltip = buildTooltip(item);

          return (
            <button
              key={`${item.id}-${laneIdx}`}
              type="button"
              title={tooltip}
              disabled={!clickable}
              onClick={() => {
                if (item.kind === 'service' && onServiceClick)
                  onServiceClick(item.id);
                else if (item.kind === 'trip' && onTripClick)
                  onTripClick(item.id);
                else if (item.kind === 'occurrence' && onOccurrenceClick && item.occurrenceRef)
                  onOccurrenceClick(item.occurrenceRef);
              }}
              className={`absolute ${color} text-white overflow-hidden
                truncate text-[8px] font-semibold leading-none
                ${item.hasConflict ? 'ring-1 ring-inset ring-red-400' : ''}
                ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                top:         topPx,
                left:        `${seg.leftPct}%`,
                // +2px en segmentos intermedios/inicio para cubrir el borde de columna (1px)
                // y lograr continuidad visual real en operaciones multidía.
                // No aplica a open-end (borde discontinuo intencionado) ni al día final.
                width:       (!seg.isEnd && !seg.isOpenEnd)
                               ? `calc(${seg.widthPct}% + 2px)`
                               : `${seg.widthPct}%`,
                height:      BAR_H,
                borderRadius: radius,
                // Borde discontinuo para operaciones sin hora de fin confirmada
                borderRight: seg.isOpenEnd ? '2px dashed rgba(255,255,255,0.55)' : undefined,
                paddingLeft: 3,
                paddingRight: seg.isOpenEnd ? 4 : 2,
              }}
              aria-label={tooltip}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderVehicleLabel(vehicle: TradeVehicle, rowH: number): React.ReactNode {
    const vAlerts    = alertsByVehicle.get(vehicle.id) ?? [];
    const hasError   = vAlerts.some(a => a.severity === 'error');
    const hasWarning = !hasError && vAlerts.some(a => a.severity === 'warning');
    const isOos      = vehicle.estado === 'en_mantenimiento' || !vehicle.activo;
    const Icon       = isVehiclePassenger(vehicle) ? Bus : Truck;

    return (
      <div
        className={`sticky left-0 z-10 flex items-start gap-2 px-3 py-1
          border-r border-b border-slate-200
          bg-white
          ${isOos ? 'opacity-50' : ''}`}
        style={{ height: rowH, minWidth: 160, width: 160 }}
        role="rowheader"
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 mt-1.5
          ${isVehiclePassenger(vehicle) ? 'text-blue-500' : 'text-orange-500'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-800 truncate leading-snug">
            {vehicle.nombre}
          </div>
          <div className="text-[10px] font-mono text-slate-500 truncate">
            {vehicle.matricula}
          </div>
          {(hasError || hasWarning) && (
            <div className="flex items-center gap-1 mt-0.5">
              {hasError
                ? <AlertCircle   className="w-3 h-3 text-red-500 shrink-0" />
                : <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
              <span className={`text-[9px] font-medium truncate
                ${hasError ? 'text-red-500' : 'text-amber-600'}`}>
                {vAlerts[0].label}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (filteredVehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Bus className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">
          {mode === 'viajeros'   ? 'Sin vehículos de viajeros activos.' :
           mode === 'mercancias' ? 'Sin vehículos de mercancías activos.' :
                                   'Sin vehículos activos.'}
        </p>
      </div>
    );
  }

  // ── Render principal ────────────────────────────────────────────────────────
  return (
    <div
      className="w-full overflow-x-auto rounded-lg border border-slate-200"
      role="grid"
      aria-label={`Planificación semanal${mode !== 'general' ? ` — ${mode}` : ''}`}
    >
      <div style={{ minWidth: 720 }}>

        {/* ── Cabecera (7 días) — sticky top para scroll vertical ──────────── */}
        <div
          className="flex sticky top-0 z-10 bg-slate-50 border-b border-slate-200"
          role="row"
        >
          {/* Celda vacía sobre la columna de nombres */}
          <div
            className="sticky left-0 z-20 bg-slate-50
              border-r border-slate-200 px-3 py-2"
            style={{ minWidth: 160, width: 160 }}
            role="columnheader"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {mode === 'viajeros'   ? 'Autocar / Bus'  :
               mode === 'mercancias' ? 'Camión / Furgón' :
                                       'Flota'}
            </span>
          </div>

          {weekDays.map((day, i) => {
            const isToday   = isoDate(day) === todayStr;
            const isWeekend = i >= 5;
            return (
              <div
                key={i}
                className={`flex-1 border-r last:border-r-0 px-2 py-2 text-center
                  border-slate-200
                  ${isToday   ? 'bg-blue-100/70' :
                    isWeekend ? 'bg-slate-100/60' : ''}`}
                style={{ minWidth: 80 }}
                role="columnheader"
                aria-label={`${DAYS_ES[i]} ${day.getDate()} de ${MONTHS_ES[day.getMonth()]}`}
              >
                <div className={`text-[10px] font-bold uppercase
                  ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                  {DAYS_ES[i]}
                </div>
                <div className={`text-[11px] font-semibold
                  ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                  {day.getDate()} {MONTHS_ES[day.getMonth()]}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Filas de vehículos ─────────────────────────────────────────────── */}
        {filteredVehicles.map(vehicle => {
          const rowH = rowHeightPx.get(vehicle.id) ?? MIN_ROW_H;
          return (
            <div key={vehicle.id} className="flex" role="row">
              {renderVehicleLabel(vehicle, rowH)}
              {weekDays.map((_, dayIndex) =>
                renderDayCell(vehicle.id, dayIndex, rowH)
              )}
            </div>
          );
        })}

        {/* ── Fila "Sin vehículo" (solo si hay operaciones no asignadas) ───── */}
        {hasUnassigned && (() => {
          const rowH = rowHeightPx.get(null) ?? MIN_ROW_H;
          return (
            <div className="flex" role="row">
              <div
                className="sticky left-0 z-10 flex items-center px-3
                  border-r border-b border-slate-200
                  bg-white"
                style={{ height: rowH, minWidth: 160, width: 160 }}
                role="rowheader"
              >
                <span className="text-[10px] italic text-slate-400">— Sin asignar</span>
              </div>
              {weekDays.map((_, dayIndex) =>
                renderDayCell(null, dayIndex, rowH)
              )}
            </div>
          );
        })()}

        {/* ── Leyenda (solo en modo General para mostrar los tres tipos) ────── */}
        {mode === 'general' && (
          <div
            className="flex flex-wrap items-center gap-4 px-4 py-2
              border-t border-slate-100
              text-[10px] text-slate-500"
            aria-label="Leyenda de colores"
          >
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-blue-400" aria-hidden="true"/>
              Viajeros
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-teal-400" aria-hidden="true"/>
              Rutas recurrentes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-orange-400" aria-hidden="true"/>
              Mercancías
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm border border-red-400" aria-hidden="true"/>
              Conflicto de horario
            </span>
            <span className="flex items-center gap-1.5 ml-auto text-slate-300">
              · · · fin desconocido
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransportWeeklyFleetPlanner;
