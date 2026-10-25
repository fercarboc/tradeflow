import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Users, MapPin,
  Bus, Filter, X, Loader2, AlertTriangle, Clock, ArrowRight,
} from 'lucide-react';
import {
  startOfWeek, addDays, isoDate, getServiceDays,
} from '../lib/transportPanelHelpers';
import {
  SERVICIO_ESTADOS, TIPO_SERVICIO_OPTIONS,
  loadServicesOverlappingRange,
} from '../lib/transportServices';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function estadoColor(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.color ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function estadoLabel(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.label ?? estado;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSelectService?: (svc: TradeTransportService) => void;
  onOpenParte?: (svcId: string) => void;
}

// ── Service detail panel ──────────────────────────────────────────────────────

interface DetailPanelProps {
  svc: TradeTransportService;
  vehicleMap:  Map<string, TradeVehicle>;
  workerMap:   Map<string, TradeWorker>;
  clientMap:   Map<string, string>;
  onClose:     () => void;
  onOpenParte?: (svcId: string) => void;
}

function DetailPanel({ svc, vehicleMap, workerMap, clientMap, onClose, onOpenParte }: DetailPanelProps) {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
  const client    = svc.client_id    ? clientMap.get(svc.client_id)    : undefined;
  const tipoLabel = TIPO_SERVICIO_OPTIONS.find(t => t.value === svc.tipo_servicio)?.label ?? svc.tipo_servicio;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-5 w-full max-w-sm flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-black text-slate-900 leading-tight">{svc.titulo}</h3>
          <span className="text-xs text-slate-400">{tipoLabel}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <span className={`inline-flex items-center self-start px-2.5 py-1 rounded-full text-[11px] font-semibold border ${estadoColor(svc.estado)}`}>
        {svc.estado === 'en_curso' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
        {estadoLabel(svc.estado)}
      </span>

      <div className="space-y-2.5 text-sm">
        <Row icon={<Clock className="w-3.5 h-3.5" />} label="Inicio">
          {new Date(svc.fecha_inicio).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
        </Row>
        {svc.fecha_fin && (
          <Row icon={<Clock className="w-3.5 h-3.5" />} label="Fin">
            {new Date(svc.fecha_fin).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
          </Row>
        )}
        {client && <Row icon={<Users className="w-3.5 h-3.5" />} label="Cliente">{client}</Row>}
        {svc.origen  && <Row icon={<MapPin className="w-3.5 h-3.5" />} label="Origen">{svc.origen}</Row>}
        {svc.destino && <Row icon={<ArrowRight className="w-3.5 h-3.5" />} label="Destino">{svc.destino}</Row>}
        {svc.num_viajeros != null && (
          <Row icon={<Users className="w-3.5 h-3.5" />} label="Viajeros">{svc.num_viajeros}</Row>
        )}
        {vehicle && (
          <Row icon={<Bus className="w-3.5 h-3.5" />} label="Vehículo">
            {vehicle.nombre} <span className="text-slate-400">({vehicle.matricula})</span>
          </Row>
        )}
        {conductor && (
          <Row icon={<Users className="w-3.5 h-3.5" />} label="Conductor">{conductor.nombre}</Row>
        )}
        {svc.paradas.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Paradas</p>
            <ol className="space-y-1 pl-3 border-l-2 border-slate-200">
              {svc.paradas.map((p, i) => (
                <li key={i} className="text-xs text-slate-600">
                  {p.hora && <span className="font-mono text-slate-400 mr-1.5">{p.hora}</span>}
                  {p.nombre}
                  {p.direccion && <span className="text-slate-400 ml-1">· {p.direccion}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {svc.observaciones && (
          <Row icon={<Calendar className="w-3.5 h-3.5" />} label="Notas">{svc.observaciones}</Row>
        )}
        {svc.precio_acordado != null && (
          <Row icon={<span className="text-xs font-bold">€</span>} label="Precio">
            {svc.precio_acordado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </Row>
        )}
      </div>

      {onOpenParte && (svc.estado === 'en_curso' || svc.estado === 'completado') && (
        <button
          onClick={() => onOpenParte(svc.id)}
          className={`w-full mt-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
            svc.estado === 'en_curso'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          {svc.estado === 'en_curso' ? 'Cerrar parte de servicio' : 'Ver parte de servicio'}
        </button>
      )}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-300 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{label}</span>
        <span className="text-slate-700">{children}</span>
      </div>
    </div>
  );
}

// ── Agenda item ───────────────────────────────────────────────────────────────

interface AgendaItemProps {
  svc: TradeTransportService;
  vehicleMap: Map<string, TradeVehicle>;
  workerMap:  Map<string, TradeWorker>;
  clientMap:  Map<string, string>;
  selected:   boolean;
  onClick:    () => void;
}

function AgendaItem({ svc, vehicleMap, workerMap, clientMap, selected, onClick }: AgendaItemProps) {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
  const client    = svc.client_id    ? clientMap.get(svc.client_id)    : undefined;
  const statusCfg = SERVICIO_ESTADOS.find(e => e.value === svc.estado);

  const leftAccent: Record<ServicioEstado, string> = {
    borrador:   'border-l-slate-300',
    confirmado: 'border-l-blue-400',
    en_curso:   'border-l-emerald-500',
    completado: 'border-l-purple-400',
    cancelado:  'border-l-red-300',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border border-l-4 px-3 py-2.5 transition-all ${leftAccent[svc.estado]} ${
        selected
          ? 'bg-blue-50 border-blue-200 shadow-md'
          : svc.estado === 'cancelado'
            ? 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100'
            : 'bg-white border-slate-200 hover:shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate leading-tight">{svc.titulo}</p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {fmtTime(svc.fecha_inicio)}
            {svc.fecha_fin ? ` – ${fmtTime(svc.fecha_fin)}` : ''}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg?.color}`}>
          {svc.estado === 'en_curso' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />}
          {statusCfg?.label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
        {client && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{client}</span>}
        {vehicle && <span className="flex items-center gap-0.5"><Bus className="w-2.5 h-2.5" />{vehicle.nombre}</span>}
        {conductor && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{conductor.nombre}</span>}
        {svc.origen && svc.destino && (
          <span className="flex items-center gap-0.5 truncate max-w-[160px]">
            <MapPin className="w-2.5 h-2.5 shrink-0" />{svc.origen} → {svc.destino}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScreenTransporteAgenda({ orgId, showToast, onOpenParte }: Props) {
  const [weekStart, setWeekStart]   = useState(() => startOfWeek(new Date()));
  const [services,  setServices]    = useState<TradeTransportService[]>([]);
  const [vehicles,  setVehicles]    = useState<TradeVehicle[]>([]);
  const [workers,   setWorkers]     = useState<TradeWorker[]>([]);
  const [clientMap, setClientMap]   = useState<Map<string, string>>(new Map());
  const [vehicleMap,setVehicleMap]  = useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap, setWorkerMap]   = useState<Map<string, TradeWorker>>(new Map());
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState<string | null>(null);
  const [selected,  setSelected]    = useState<TradeTransportService | null>(null);

  // Filters
  const [filterVehicle,   setFilterVehicle]   = useState('');
  const [filterConductor, setFilterConductor] = useState('');

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const desde = isoDate(weekStart) + 'T00:00:00';
      const hasta = isoDate(weekEnd)   + 'T23:59:59';
      const [svcs, vehs, wrks, clients] = await Promise.all([
        loadServicesOverlappingRange(orgId, desde, hasta),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
        loadClients(orgId),
      ]);

      // Sort by fecha_inicio ascending
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando agenda';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, weekStart]);

  useEffect(() => { load(); }, [load]);

  // Apply filters
  const filteredServices = services.filter(svc => {
    if (filterVehicle   && svc.vehicle_id   !== filterVehicle)   return false;
    if (filterConductor && svc.conductor_id !== filterConductor) return false;
    return true;
  });

  // Group by day, handling midnight-crossing services
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function getServicesForDay(day: Date): TradeTransportService[] {
    const dayStr = isoDate(day);
    return filteredServices.filter(svc => getServiceDays(svc).has(dayStr));
  }

  const todayStr = isoDate(new Date());
  const passengerVehicles = vehicles.filter(
    v => v.activo && (v.modalidad === 'viajeros' || v.modalidad === 'mixto'),
  );
  const conductorWorkers = workers.filter(w => w.es_conductor);

  const clearFilters = () => { setFilterVehicle(''); setFilterConductor(''); };
  const hasFilters   = filterVehicle !== '' || filterConductor !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando agenda...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header + week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Agenda Semanal</h1>
            <p className="text-xs text-slate-400 capitalize">{fmtMonthYear(weekStart)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWeekStart(startOfWeek(new Date())); setSelected(null); }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            Hoy
          </button>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setWeekStart(w => addDays(w, -7)); setSelected(null); }}
              className="px-2.5 py-2 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
              {fmtDayShort(weekStart)} – {fmtDayShort(weekEnd)}
            </span>
            <button
              onClick={() => { setWeekStart(w => addDays(w, 7)); setSelected(null); }}
              className="px-2.5 py-2 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />

        {passengerVehicles.length > 0 && (
          <select
            value={filterVehicle}
            onChange={e => { setFilterVehicle(e.target.value); setSelected(null); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los vehículos</option>
            {passengerVehicles.map(v => (
              <option key={v.id} value={v.id}>{v.nombre} ({v.matricula})</option>
            ))}
          </select>
        )}

        {conductorWorkers.length > 0 && (
          <select
            value={filterConductor}
            onChange={e => { setFilterConductor(e.target.value); setSelected(null); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los conductores</option>
            {conductorWorkers.map(w => (
              <option key={w.id} value={w.id}>{w.nombre}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2.5 py-2"
          >
            <X className="w-3 h-3" /> Limpiar filtros
          </button>
        )}

        {hasFilters && (
          <span className="text-xs text-slate-400">
            {filteredServices.length} servicio{filteredServices.length !== 1 ? 's' : ''} filtrado{filteredServices.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Weekly grid + detail panel */}
      <div className="flex gap-4">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 gap-2">
            {days.map(day => {
              const dayStr    = isoDate(day);
              const isToday   = dayStr === todayStr;
              const dayServices = getServicesForDay(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <div key={dayStr} className={`min-h-[200px] flex flex-col gap-1`}>
                  {/* Day header */}
                  <div className={`px-2 py-1.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wide ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : isWeekend
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-slate-50 text-slate-600'
                  }`}>
                    {fmtDayShort(day)}
                    {dayServices.length > 0 && (
                      <span className={`ml-1 text-[9px] px-1 py-0.5 rounded-full font-black ${
                        isToday ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {dayServices.length}
                      </span>
                    )}
                  </div>

                  {/* Service items */}
                  <div className="flex flex-col gap-1">
                    {dayServices.length === 0 ? (
                      <div className={`flex-1 min-h-[60px] rounded-lg border-dashed border ${isWeekend ? 'border-slate-100' : 'border-slate-200'}`} />
                    ) : (
                      dayServices.map(svc => (
                        <AgendaItem
                          key={`${svc.id}-${dayStr}`}
                          svc={svc}
                          vehicleMap={vehicleMap}
                          workerMap={workerMap}
                          clientMap={clientMap}
                          selected={selected?.id === svc.id}
                          onClick={() => setSelected(s => s?.id === svc.id ? null : svc)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredServices.length === 0 && !hasFilters && (
            <div className="mt-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
              <Calendar className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Sin servicios esta semana</p>
              <p className="text-xs opacity-70">Los servicios confirmados aparecerán aquí</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 shrink-0 sticky top-4 self-start">
            <DetailPanel
              svc={selected}
              vehicleMap={vehicleMap}
              workerMap={workerMap}
              clientMap={clientMap}
              onClose={() => setSelected(null)}
              onOpenParte={onOpenParte}
            />
          </div>
        )}
      </div>
    </div>
  );
}
