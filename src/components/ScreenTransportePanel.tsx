import React, { useState, useEffect } from 'react';
import {
  Bus, Users, Calendar, AlertTriangle,
  MapPin, ArrowRight, Loader2, RefreshCw, TrendingUp,
  Plane, Car, Star, BookOpen, Briefcase, Compass,
  Wrench, UserCheck, Plus, ChevronRight, Route,
} from 'lucide-react';
import {
  SERVICIO_ESTADOS,
  loadServicesOverlappingDay,
} from '../lib/transportServices';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
import { loadVehiclesAll, getVehicleDisplayImage } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import {
  computeKpis,
  getVehicleFleetStatus,
  getProximasSalidas,
  getSinItinerario,
  isVehiclePassenger,
  isoDate,
  type FleetStatus,
} from '../lib/transportPanelHelpers';

// ── UI helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateLong(): string {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function estadoColor(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.color ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function estadoLabel(estado: ServicioEstado): string {
  return SERVICIO_ESTADOS.find(e => e.value === estado)?.label ?? estado;
}

const TIPO_ICONS: Partial<Record<string, React.ComponentType<{ className?: string }>>> = {
  excursion:               Compass,
  circuito:                Compass,
  viaje_multidia:          Calendar,
  ruta_escolar:            BookOpen,
  transporte_trabajadores: Briefcase,
  traslado_privado:        Car,
  aeropuerto:              Plane,
  lanzadera:               ChevronRight,
  congreso_evento:         Star,
  servicio_deportivo:      TrendingUp,
  asociacion_grupo:        Users,
  otro:                    Bus,
  traslado_empresa:        Briefcase,
};

function TipoIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_ICONS[tipo] ?? Bus;
  return (
    <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

const FLEET_STATUS_CONFIG: Record<FleetStatus, { label: string; dot: string; card: string }> = {
  en_servicio:       { label: 'En servicio',   dot: 'bg-emerald-500 animate-pulse', card: 'border-emerald-200 bg-emerald-50'  },
  programado:        { label: 'Programado',    dot: 'bg-blue-500',                  card: 'border-blue-200 bg-blue-50'        },
  sin_asignacion:    { label: 'Disponible',    dot: 'bg-slate-400',                 card: 'border-slate-200 bg-white'         },
  fuera_de_servicio: { label: 'No disponible', dot: 'bg-amber-400',                 card: 'border-amber-200 bg-amber-50'      },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}

function KpiCard({ icon, label, value, sub, accent = 'blue' }: KpiCardProps) {
  const accentMap: Record<string, string> = {
    blue:    'from-blue-50 to-blue-100/60 border-blue-200 text-blue-700',
    emerald: 'from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-700',
    amber:   'from-amber-50 to-amber-100/60 border-amber-200 text-amber-700',
    purple:  'from-purple-50 to-purple-100/60 border-purple-200 text-purple-700',
    slate:   'from-slate-50 to-slate-100/60 border-slate-200 text-slate-600',
  };
  const cls = accentMap[accent] ?? accentMap.blue;
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-2xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70 leading-tight">{label}</span>
        <span className="opacity-50">{icon}</span>
      </div>
      <span className="text-3xl font-black mt-1">{value}</span>
      {sub && <span className="text-[11px] opacity-60 leading-tight">{sub}</span>}
    </div>
  );
}

// ── Rutas y planificación (right panel) ───────────────────────────────────────

interface RutasPlanProps {
  services: TradeTransportService[];
  now: Date;
  onNavigate?: (tab: string) => void;
}

function RutasPlanificacion({ services, now, onNavigate }: RutasPlanProps) {
  const proximas  = getProximasSalidas(services, now).slice(0, 4);
  const sinItin   = getSinItinerario(services).slice(0, 3);
  const hayAlerta = sinItin.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-5">
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Rutas y planificación</h3>

      {/* Próximas salidas */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Próximas salidas</span>
          {proximas.length > 0 && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
              {proximas.length}
            </span>
          )}
        </div>
        {proximas.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-1">Sin salidas pendientes hoy</p>
        ) : (
          <div className="space-y-2.5">
            {proximas.map(s => (
              <div key={s.id} className="flex items-start gap-2">
                <span className="text-xs font-mono font-semibold text-slate-600 w-11 shrink-0 pt-0.5">
                  {fmtTime(s.fecha_inicio)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{s.titulo}</p>
                  {(s.origen || s.destino) && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {[s.origen, s.destino].filter(Boolean).join(' → ')}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoColor(s.estado as ServicioEstado)}`}>
                  {estadoLabel(s.estado as ServicioEstado)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Itinerario pendiente */}
      {hayAlerta && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex-1">Sin itinerario</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              {sinItin.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {sinItin.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                <p className="flex-1 text-xs font-medium text-slate-700 truncate">{s.titulo}</p>
                <span className="text-[10px] text-amber-600 font-medium shrink-0">Ruta pendiente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!proximas.length && !hayAlerta && (
        <p className="text-xs text-slate-400 italic text-center py-1">Planificación al día ✓</p>
      )}

      {/* Ver todas las rutas */}
      {onNavigate && (
        <button
          onClick={() => onNavigate('transporte_rutas')}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Route className="w-3.5 h-3.5 text-blue-500" />
            Ver todas las rutas
          </div>
          <ArrowRight className="w-3 h-3 text-slate-400" />
        </button>
      )}
    </div>
  );
}

// ── Fleet tab type ─────────────────────────────────────────────────────────────

type FleetTab = FleetStatus | 'mantenimiento';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransportePanel({ orgId, showToast, onNavigate }: Props) {
  const today = isoDate(new Date());

  const [loading,    setLoading]    = useState(true);
  const [services,   setServices]   = useState<TradeTransportService[]>([]);
  const [vehicles,   setVehicles]   = useState<TradeVehicle[]>([]);
  const [workers,    setWorkers]    = useState<TradeWorker[]>([]);
  const [clientMap,  setClientMap]  = useState<Map<string, string>>(new Map());
  const [vehicleMap, setVehicleMap] = useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap,  setWorkerMap]  = useState<Map<string, TradeWorker>>(new Map());
  const [error,      setError]      = useState<string | null>(null);
  const [fleetTab,   setFleetTab]   = useState<FleetTab>('en_servicio');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [svcs, vehs, wrks, clients] = await Promise.all([
        loadServicesOverlappingDay(orgId, today),
        loadVehiclesAll(orgId),
        loadWorkers(orgId),
        loadClients(orgId),
      ]);
      setServices(svcs);
      setVehicles(vehs);
      setWorkers(wrks);
      const cm = new Map<string, string>();
      for (const c of clients as TradeClient[]) cm.set(c.id, getClientDisplayName(c));
      setClientMap(cm);
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
  };

  useEffect(() => { load(); }, [orgId, today]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const kpis = computeKpis(services);
  const passengerVehicles = vehicles.filter(v => v.activo && isVehiclePassenger(v));

  const fleetStatuses = passengerVehicles.map(v => ({
    vehicle: v,
    status:  getVehicleFleetStatus(v, services),
  }));

  const countByStatus     = (s: FleetStatus) => fleetStatuses.filter(f => f.status === s).length;
  const assignedCount     = countByStatus('en_servicio') + countByStatus('programado');
  const availableCount    = countByStatus('sin_asignacion');
  const maintenanceVehicles  = vehicles.filter(v => v.estado === 'en_mantenimiento' || v.estado === 'baja');
  const maintenanceCount     = maintenanceVehicles.length;
  const enMantenimientoCount = vehicles.filter(v => v.estado === 'en_mantenimiento').length;
  const enBajaCount          = vehicles.filter(v => v.estado === 'baja').length;

  const conductorWorkers     = workers.filter(w => w.es_conductor);
  const assignedConductors   = conductorWorkers.filter(w => kpis.assignedConductorIds.has(w.id));
  const disponibleConductores = conductorWorkers.length - assignedConductors.length;

  const tableServices = services.filter(s => s.estado !== 'cancelado');

  const fleetTabDef: { key: FleetTab; label: string; count: number }[] = [
    { key: 'en_servicio',    label: 'En servicio',   count: countByStatus('en_servicio')   },
    { key: 'programado',     label: 'Programados',   count: countByStatus('programado')    },
    { key: 'sin_asignacion', label: 'Disponibles',   count: availableCount                 },
    { key: 'mantenimiento',  label: 'En taller',     count: maintenanceCount               },
  ];

  const fleetTabVehicles: TradeVehicle[] = fleetTab === 'mantenimiento'
    ? maintenanceVehicles
    : fleetStatuses.filter(f => f.status === fleetTab).map(f => f.vehicle);

  // ── Render ─────────────────────────────────────────────────────────────────────

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
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Transporte y Logística</h1>
            <p className="text-xs text-slate-400 capitalize">{fmtDateLong()}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* KPIs — 4 cards
          1. Servicios hoy:     tableServices.length (non-cancelled overlapping today)
          2. Flota asignada:    (en_servicio + programado) / total passenger vehicles
          3. Conductores:       disponibles / total conductores
          4. No disponibles:    en_mantenimiento + baja (any activo value)
      */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<Calendar className="w-4 h-4" />}
          label="Servicios hoy"
          value={kpis.totalActiveServices}
          sub={kpis.serviciosEnCurso > 0 ? `${kpis.serviciosEnCurso} en curso` : `${kpis.serviciosConfirmados} confirmados`}
          accent="blue"
        />
        <KpiCard
          icon={<Bus className="w-4 h-4" />}
          label="Flota asignada"
          value={`${assignedCount} / ${passengerVehicles.length}`}
          sub={assignedCount > 0
            ? `${Math.round(assignedCount / Math.max(passengerVehicles.length, 1) * 100)}% operativa`
            : 'sin asignaciones'}
          accent="emerald"
        />
        <KpiCard
          icon={<UserCheck className="w-4 h-4" />}
          label="Conductores libres"
          value={`${disponibleConductores} / ${conductorWorkers.length}`}
          sub={disponibleConductores > 0 ? 'disponibles ahora' : conductorWorkers.length > 0 ? 'todos asignados' : 'sin conductores'}
          accent="slate"
        />
        <KpiCard
          icon={<Wrench className="w-4 h-4" />}
          label="No disponibles"
          value={maintenanceCount}
          sub={maintenanceCount === 0
            ? 'flota operativa'
            : enBajaCount > 0
              ? `${enMantenimientoCount} mant. · ${enBajaCount} baja`
              : 'en mantenimiento'}
          accent={maintenanceCount > 0 ? 'amber' : 'slate'}
        />
      </div>

      {/* Main 2-column: Servicios del día (left) + Rutas y planificación (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Servicios del día ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Servicios del día</h2>
              {tableServices.length > 0 && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                  {tableServices.length}
                </span>
              )}
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('transporte_servicios')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {tableServices.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
              <Calendar className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Sin servicios para hoy</p>
              <p className="text-xs opacity-70">Los servicios programados aparecerán aquí</p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('transporte_servicios')}
                  className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-white rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear servicio
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table (md+) */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-3 w-10" />
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Hora</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Servicio</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Ruta</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Vehículo</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Conductor</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableServices.map((svc, idx) => {
                      const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
                      const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
                      const client    = svc.client_id    ? clientMap.get(svc.client_id)    : undefined;
                      const isEnCurso = svc.estado === 'en_curso';
                      return (
                        <tr
                          key={svc.id}
                          onClick={() => onNavigate?.('transporte_servicios')}
                          className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                            isEnCurso ? 'bg-emerald-50/40' : idx % 2 !== 0 ? 'bg-slate-50/20' : ''
                          }`}
                        >
                          <td className="px-3 py-3">
                            <TipoIcon tipo={svc.tipo_servicio ?? ''} />
                          </td>
                          <td className="px-3 py-3 font-mono whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-700 text-sm">{fmtTime(svc.fecha_inicio)}</span>
                              {svc.fecha_fin && (
                                <span className="text-[10px] text-slate-400">{fmtTime(svc.fecha_fin)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800 leading-tight text-sm">{svc.titulo}</span>
                              {client && (
                                <span className="text-[11px] text-slate-500 truncate">{client}</span>
                              )}
                              {svc.num_viajeros != null && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <Users className="w-3 h-3" />{svc.num_viajeros} viajeros
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            {svc.origen || svc.destino ? (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3 shrink-0 text-slate-300" />
                                <span className="truncate max-w-[150px]">
                                  {svc.origen ?? '?'} → {svc.destino ?? '?'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-400 font-medium">Sin ruta</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden xl:table-cell">
                            {vehicle ? (
                              <div className="flex items-center gap-2">
                                {getVehicleDisplayImage(vehicle.tipo, vehicle.image_path)
                                  ? (
                                    <img
                                      src={getVehicleDisplayImage(vehicle.tipo, vehicle.image_path)!}
                                      alt={vehicle.tipo}
                                      className="w-6 h-6 object-contain rounded"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                      <Bus className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                  )}
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-700 leading-tight">{vehicle.nombre}</span>
                                  <span className="text-[10px] text-slate-400">{vehicle.matricula}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-500 font-medium">Sin asignar</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden xl:table-cell text-xs text-slate-600">
                            {conductor
                              ? <span className="font-medium">{conductor.nombre}</span>
                              : <span className="text-amber-500 font-medium">Sin asignar</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${estadoColor(svc.estado as ServicioEstado)}`}>
                              {isEnCurso && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                              )}
                              {estadoLabel(svc.estado as ServicioEstado)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards (< md) */}
              <div className="md:hidden space-y-2">
                {tableServices.map(svc => {
                  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)  : undefined;
                  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
                  const client    = svc.client_id    ? clientMap.get(svc.client_id)    : undefined;
                  const isEnCurso = svc.estado === 'en_curso';
                  return (
                    <button
                      key={svc.id}
                      onClick={() => onNavigate?.('transporte_servicios')}
                      className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                        isEnCurso
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TipoIcon tipo={svc.tipo_servicio ?? ''} />
                          <span className="text-xs font-mono font-semibold text-slate-600 truncate">
                            {fmtTime(svc.fecha_inicio)}
                            {svc.fecha_fin ? ` – ${fmtTime(svc.fecha_fin)}` : ''}
                          </span>
                        </div>
                        <span className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${estadoColor(svc.estado as ServicioEstado)}`}>
                          {isEnCurso && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                          )}
                          {estadoLabel(svc.estado as ServicioEstado)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{svc.titulo}</p>
                      {client && <p className="text-xs text-slate-500">{client}</p>}
                      {(svc.origen || svc.destino) && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {[svc.origen, svc.destino].filter(Boolean).join(' → ')}
                        </p>
                      )}
                      {(vehicle || conductor) && (
                        <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5 border-t border-slate-100">
                          {vehicle && <span>{vehicle.nombre}</span>}
                          {conductor && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />{conductor.nombre}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Rutas y planificación (right column) ── */}
        <RutasPlanificacion
          services={tableServices}
          now={new Date()}
          onNavigate={onNavigate}
        />
      </div>

      {/* ── Flota operativa ── */}
      {passengerVehicles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Flota operativa</h2>
            {onNavigate && (
              <button
                onClick={() => onNavigate('transporte_vehiculos')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver toda la flota <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 overflow-x-auto">
            {fleetTabDef.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFleetTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  fleetTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  fleetTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {fleetTabVehicles.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 flex items-center justify-center text-slate-400 text-xs">
              Sin vehículos en esta categoría
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {fleetTabVehicles.slice(0, 8).map(v => {
                const entry        = fleetStatuses.find(f => f.vehicle.id === v.id);
                const status       = entry?.status ?? 'fuera_de_servicio';
                const cfg          = FLEET_STATUS_CONFIG[status as FleetStatus] ?? FLEET_STATUS_CONFIG.fuera_de_servicio;
                const assignedSvc  = services.find(s => s.vehicle_id === v.id && s.conductor_id && s.estado !== 'cancelado');
                const assignedCond = assignedSvc?.conductor_id ? workerMap.get(assignedSvc.conductor_id) : undefined;
                return (
                  <div key={v.id} className={`rounded-2xl border p-3 flex flex-col gap-2 ${cfg.card}`}>
                    {getVehicleDisplayImage(v.tipo, v.image_path)
                      ? (
                        <img
                          src={getVehicleDisplayImage(v.tipo, v.image_path)!}
                          alt={v.nombre}
                          className="w-full h-16 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-16 bg-slate-100/60 rounded-lg flex items-center justify-center">
                          <Bus className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight truncate">{v.nombre}</p>
                      <p className="text-[10px] text-slate-500">{v.matricula}</p>
                      {v.capacidad_viajeros != null && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                          <Users className="w-2.5 h-2.5" /> {v.capacidad_viajeros} plazas
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-[10px] font-semibold text-slate-600">{cfg.label}</span>
                    </div>
                    {assignedCond && (
                      <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                        <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-500 truncate">{assignedCond.nombre}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Prompt when no passenger fleet is configured */}
      {passengerVehicles.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4">
          <TrendingUp className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Flota no configurada</p>
            <p className="text-xs text-blue-600 mt-1">
              Añade vehículos con modalidad <em>viajeros</em> o <em>mixto</em> para ver los indicadores de flota.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('transporte_vehiculos')}
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Ir a Flota <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
