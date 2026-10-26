import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Route, MapPin, ChevronLeft, ChevronRight, Calendar, Clock, Users, Bus,
  PhoneCall, User, ExternalLink, AlertCircle,
} from 'lucide-react';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_OPTIONS,
  loadServicesOverlappingRange,
} from '../lib/transportServices';
import { loadVehiclesAll, getVehicleDisplayImage } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import { locationToText, locationToAddress, hasContact, geoValid } from '../lib/transportLocations';
import { isoDate } from '../lib/transportPanelHelpers';
import TransportServiceMap from './TransportServiceMap';

// ── Types ─────────────────────────────────────────────────────────────────────

type RangeMode = 'hoy' | 'semana' | 'intervalo';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
  initialServiceId?: string | null;
  onConsumeInitialServiceId?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateShort(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function estadoColor(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.color ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function estadoLabel(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.label ?? estado;
}

function tipoLabel(tipo: string): string {
  return TIPO_SERVICIO_OPTIONS.find(t => t.value === tipo)?.label ?? tipo;
}

function workerDisplayName(w: TradeWorker): string {
  return w.nombre;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

// ── Module-level sub-components ───────────────────────────────────────────────

interface ServicioRutaRowProps {
  service: TradeTransportService;
  selected: boolean;
  vehicleMap: Record<string, TradeVehicle>;
  workerMap: Record<string, TradeWorker>;
  onClick: () => void;
}

function ServicioRutaRow({ service, selected, vehicleMap, workerMap, onClick }: ServicioRutaRowProps) {
  const vehicle   = service.vehicle_id   ? vehicleMap[service.vehicle_id]   : null;
  const conductor = service.conductor_id ? workerMap[service.conductor_id] : null;
  const vehicleImg = vehicle ? getVehicleDisplayImage(vehicle.tipo, vehicle.image_path) : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all
        ${selected
          ? 'bg-blue-50 border-blue-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
    >
      <div className="flex items-start gap-2.5">
        {vehicleImg ? (
          <img
            src={vehicleImg}
            alt={vehicle?.nombre ?? ''}
            className="h-8 w-auto max-w-[52px] object-contain rounded mt-0.5 shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Bus className="w-4 h-4 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{service.titulo}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoColor(service.estado)}`}>
              {estadoLabel(service.estado)}
            </span>
            <span className="text-[10px] text-slate-500">
              {fmtTime(service.fecha_inicio)}
              {service.fecha_fin ? ` → ${fmtTime(service.fecha_fin)}` : ''}
            </span>
          </div>
          {(vehicle || conductor) && (
            <p className="mt-1 text-[10px] text-slate-400 leading-none truncate">
              {[vehicle?.nombre, conductor ? conductor.nombre : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{fmtDateShort(service.fecha_inicio)}</span>
      </div>
    </button>
  );
}

// ── Itinerary (timeline within detail panel) ──────────────────────────────────

interface ItinerarioSectionProps {
  service: TradeTransportService;
}

function ItinerarioSection({ service }: ItinerarioSectionProps) {
  type WP = { type: 'origin' | 'stop' | 'destination'; index?: number; label: string; address?: string; hora?: string };
  const wps: WP[] = [];

  const od = service.origen_detalle;
  const oLabel = (od ? locationToText(od) : null) || service.origen || 'Sin origen';
  const oAddr  = od ? locationToAddress(od) : service.origen || undefined;
  wps.push({ type: 'origin', label: oLabel, address: oAddr && oAddr !== oLabel ? oAddr : undefined });

  service.paradas.forEach((p, i) => {
    const loc = p.location;
    const addr = loc ? locationToAddress(loc) : p.direccion || undefined;
    wps.push({ type: 'stop', index: i + 1, label: p.nombre, address: addr, hora: p.hora });
  });

  const dd = service.destino_detalle;
  const dLabel = (dd ? locationToText(dd) : null) || service.destino || 'Sin destino';
  const dAddr  = dd ? locationToAddress(dd) : service.destino || undefined;
  wps.push({ type: 'destination', label: dLabel, address: dAddr && dAddr !== dLabel ? dAddr : undefined });

  return (
    <div>
      {wps.map((wp, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
              wp.type === 'origin' ? 'bg-blue-600' :
              wp.type === 'destination' ? 'bg-emerald-600' : 'bg-slate-500'}`}>
              {wp.type === 'origin' ? 'A' : wp.type === 'destination' ? 'B' : wp.index}
            </div>
            {i < wps.length - 1 && (
              <div className="w-0.5 bg-slate-200 my-1 flex-1" style={{ minHeight: 16 }} />
            )}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 leading-tight">{wp.label}</span>
              {wp.hora && (
                <span className="text-xs font-mono text-slate-500 shrink-0">{wp.hora}</span>
              )}
            </div>
            {wp.address && (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{wp.address}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

interface RutaDetailPanelProps {
  service: TradeTransportService;
  vehicleMap: Record<string, TradeVehicle>;
  workerMap: Record<string, TradeWorker>;
  clientMap: Record<string, TradeClient>;
  onNavigate?: (tab: string) => void;
  onBack?: () => void;   // mobile only
}

function RutaDetailPanel({ service, vehicleMap, workerMap, clientMap, onNavigate, onBack }: RutaDetailPanelProps) {
  const vehicle   = service.vehicle_id   ? vehicleMap[service.vehicle_id]   : null;
  const conductor = service.conductor_id ? workerMap[service.conductor_id] : null;
  const client    = service.client_id    ? clientMap[service.client_id]    : null;
  const vehicleImg = vehicle ? getVehicleDisplayImage(vehicle.tipo, vehicle.image_path) : null;
  const contacto   = service.contacto_principal;

  const multiDay = !!(service.fecha_fin &&
    new Date(service.fecha_fin).toDateString() !== new Date(service.fecha_inicio).toDateString());

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-4">
        {/* Mobile back button */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3 lg:hidden">
            <ChevronLeft className="w-4 h-4" />
            Volver a la lista
          </button>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight">{service.titulo}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoColor(service.estado)}`}>
                {estadoLabel(service.estado)}
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {tipoLabel(service.tipo_servicio)}
              </span>
              {service.num_viajeros != null && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3" />{service.num_viajeros} viajeros
                </span>
              )}
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('transporte_servicios')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en Servicios
            </button>
          )}
        </div>

        {/* Date/time row */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {multiDay ? (
            <span>
              {fmtDate(service.fecha_inicio)} {fmtTime(service.fecha_inicio)}
              {' → '}
              {fmtDate(service.fecha_fin!)} {fmtTime(service.fecha_fin!)}
            </span>
          ) : (
            <span>
              {fmtDate(service.fecha_inicio)}
              {fmtTime(service.fecha_inicio) && ` · ${fmtTime(service.fecha_inicio)}`}
              {service.fecha_fin && fmtTime(service.fecha_fin) && ` → ${fmtTime(service.fecha_fin)}`}
            </span>
          )}
        </div>

        {service.precio_acordado != null && (
          <p className="mt-1 text-xs text-slate-500">
            {service.precio_acordado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Map — when no coordinates, this already renders the full text itinerary */}
        <TransportServiceMap service={service} />

        {/* Itinerary with times — only shown when the map has actual points to display;
            avoids duplicating the text itinerary that TransportServiceMap shows as fallback */}
        {(
          geoValid(service.origen_detalle?.lat, service.origen_detalle?.lng) ||
          geoValid(service.destino_detalle?.lat, service.destino_detalle?.lng) ||
          service.paradas.some(p => geoValid(p.location?.lat, p.location?.lng))
        ) && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-3">Itinerario</h3>
            <ItinerarioSection service={service} />
          </div>
        )}

        {/* Vehicle + conductor */}
        {(vehicle || conductor || (!service.vehicle_id && !service.conductor_id)) && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-3">Asignación</h3>
            {!vehicle && !conductor ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">Sin vehículo ni conductor asignados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicle && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {vehicleImg ? (
                      <img
                        src={vehicleImg}
                        alt={vehicle.nombre}
                        className="h-10 w-auto max-w-[64px] object-contain rounded shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Bus className="w-5 h-5 text-blue-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{vehicle.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {vehicle.matricula}
                        {vehicle.capacidad_viajeros ? ` · ${vehicle.capacidad_viajeros} plazas` : ''}
                      </p>
                    </div>
                  </div>
                )}
                {conductor && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{workerDisplayName(conductor)}</p>
                      <p className="text-xs text-slate-500">Conductor</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contact */}
        {contacto && hasContact(contacto) && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-3">Contacto responsable</h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              {contacto.nombre && (
                <p className="text-sm font-semibold text-slate-800">{contacto.nombre}</p>
              )}
              {contacto.organizacion && (
                <p className="text-xs text-slate-500">{contacto.organizacion}</p>
              )}
              {contacto.funcion && (
                <p className="text-[10px] text-slate-400 capitalize">{contacto.funcion.replace(/_/g, ' ')}</p>
              )}
              {contacto.telefono && (
                <a
                  href={`tel:${contacto.telefono.replace(/[\s\-().]/g, '')}`}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors mt-1"
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  {contacto.telefono}
                </a>
              )}
              {contacto.telefono_alt && (
                <a
                  href={`tel:${contacto.telefono_alt.replace(/[\s\-().]/g, '')}`}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <PhoneCall className="w-3 h-3 shrink-0" />
                  {contacto.telefono_alt}
                </a>
              )}
              {contacto.observaciones && (
                <p className="text-xs text-slate-500 leading-relaxed mt-1">{contacto.observaciones}</p>
              )}
            </div>
          </div>
        )}

        {/* Client */}
        {client && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">Cliente</h3>
            <p className="text-sm text-slate-700">{getClientDisplayName(client)}</p>
          </div>
        )}

        {/* Instrucciones conductor */}
        {service.instrucciones_conductor && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">
              Instrucciones para el conductor
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{service.instrucciones_conductor}</p>
          </div>
        )}

        {/* Observaciones */}
        {service.observaciones && (
          <div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">Observaciones</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{service.observaciones}</p>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScreenTransporteRutas({ orgId, showToast, onNavigate, initialServiceId, onConsumeInitialServiceId }: Props) {
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [services,   setServices]   = useState<TradeTransportService[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<TradeTransportService | null>(null);
  const [vehicleMap, setVehicleMap] = useState<Record<string, TradeVehicle>>({});
  const [workerMap,  setWorkerMap]  = useState<Record<string, TradeWorker>>({});
  const [clientMap,  setClientMap]  = useState<Record<string, TradeClient>>({});

  // Filter state
  const [rangeMode,    setRangeMode]    = useState<RangeMode>('semana');
  const [weekStart,    setWeekStart]    = useState(() => startOfWeek(new Date()));
  const [filterDesde,  setFilterDesde]  = useState('');
  const [filterHasta,  setFilterHasta]  = useState('');
  const [filterEstado, setFilterEstado] = useState<ServicioEstado | ''>('');

  // Mobile: show list or detail
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Auto-select service when navigating from Agenda; consume once found so sidebar nav starts clean
  useEffect(() => {
    if (!initialServiceId || services.length === 0) return;
    const svc = services.find(s => s.id === initialServiceId);
    if (svc) {
      setSelected(svc);
      setMobileView('detail');
      onConsumeInitialServiceId?.();
    }
  }, [initialServiceId, services]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let desde: string, hasta: string;
      if (rangeMode === 'hoy') {
        const today = isoDate(new Date());
        desde = `${today}T00:00:00`;
        hasta = `${today}T23:59:59`;
      } else if (rangeMode === 'semana') {
        const wend = addDays(weekStart, 6);
        desde = `${isoDate(weekStart)}T00:00:00`;
        hasta = `${isoDate(wend)}T23:59:59`;
      } else {
        desde = filterDesde ? `${filterDesde}T00:00:00` : '2000-01-01T00:00:00';
        hasta = filterHasta ? `${filterHasta}T23:59:59` : '2099-12-31T23:59:59';
      }

      const [svcs, vhs, wks, cls] = await Promise.all([
        loadServicesOverlappingRange(orgId, desde, hasta),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
        loadClients(orgId),
      ]);

      const filtered = filterEstado ? svcs.filter(s => s.estado === filterEstado) : svcs;
      setServices(filtered);
      setVehicleMap(Object.fromEntries(vhs.map(v => [v.id, v])));
      setWorkerMap(Object.fromEntries(wks.map(w => [w.id, w])));
      setClientMap(Object.fromEntries(cls.map(c => [c.id, c])));
      // Keep selected service in sync with fresh data
      setSelected(prev => prev ? (filtered.find(s => s.id === prev.id) ?? null) : null);
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, rangeMode, weekStart, filterDesde, filterHasta, filterEstado]);

  // Clear all state synchronously when org changes — prevents transient display of data
  // from the previous org while the async load for the new org is in flight.
  // Declared before the load effect so it runs first in the same render cycle.
  useEffect(() => {
    setSelected(null);
    setServices([]);
    setVehicleMap({});
    setWorkerMap({});
    setClientMap({});
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);
  // Reset to list when selection is lost (filter change removed the selected service)
  useEffect(() => { if (!selected) setMobileView('list'); }, [selected]);

  function handleSelect(svc: TradeTransportService) {
    setSelected(svc);
    setMobileView('detail');
  }

  // Week label for navigation display
  const weekLabel = (() => {
    if (rangeMode !== 'semana') return '';
    const wend = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === wend.getMonth();
    return sameMonth
      ? `${weekStart.getDate()} — ${wend.getDate()} ${wend.toLocaleDateString('es-ES', { month: 'short' })}`
      : `${weekStart.getDate()} ${weekStart.toLocaleDateString('es-ES', { month: 'short' })} — ${wend.getDate()} ${wend.toLocaleDateString('es-ES', { month: 'short' })}`;
  })();

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
            <Route size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Rutas</h1>
            <p className="text-xs text-slate-400">Itinerario y mapa de servicios de transporte</p>
          </div>
          {/* Mobile: show count badge */}
          <div className="ml-auto lg:hidden">
            {!loading && services.length > 0 && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {services.length} servicio{services.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex gap-4">

        {/* LEFT COLUMN — service list + filters */}
        <div className={`
          w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-3 overflow-hidden
          ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}
        `}>
          {/* Filters card */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3 shrink-0">
            {/* Range mode */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {(['hoy', 'semana', 'intervalo'] as RangeMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setRangeMode(mode)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all
                    ${rangeMode === mode
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {mode === 'hoy' ? 'Hoy' : mode === 'semana' ? 'Semana' : 'Intervalo'}
                </button>
              ))}
            </div>

            {/* Week navigation */}
            {rangeMode === 'semana' && (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setWeekStart(d => addDays(d, -7))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600 flex-1 text-center">{weekLabel}</span>
                <button
                  onClick={() => setWeekStart(d => addDays(d, 7))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Interval inputs */}
            {rangeMode === 'intervalo' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Desde</label>
                  <input
                    type="date"
                    value={filterDesde}
                    onChange={e => setFilterDesde(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Hasta</label>
                  <input
                    type="date"
                    value={filterHasta}
                    onChange={e => setFilterHasta(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  />
                </div>
              </div>
            )}

            {/* Estado filter */}
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value as ServicioEstado | '')}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Todos los estados</option>
              {SERVICIO_ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          {/* Service list */}
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
            {!loading && services.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-500">Sin servicios</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  No hay servicios en el período seleccionado
                  {filterEstado ? ` con estado "${estadoLabel(filterEstado as ServicioEstado)}"` : ''}
                </p>
              </div>
            )}
            {!loading && services.map(svc => (
              <ServicioRutaRow
                key={svc.id}
                service={svc}
                selected={selected?.id === svc.id}
                vehicleMap={vehicleMap}
                workerMap={workerMap}
                onClick={() => handleSelect(svc)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — detail panel */}
        <div className={`
          flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden
          ${mobileView === 'list' ? 'hidden lg:block' : 'block'}
        `}>
          {selected ? (
            <RutaDetailPanel
              key={selected.id}
              service={selected}
              vehicleMap={vehicleMap}
              workerMap={workerMap}
              clientMap={clientMap}
              onNavigate={onNavigate}
              onBack={() => setMobileView('list')}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-500">Selecciona un servicio</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Elige un servicio de la lista para ver su itinerario, mapa y datos de asignación.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
