import React, { useState, useEffect } from 'react';
import {
  Bus, Users, Calendar, Clock, AlertTriangle,
  MapPin, ArrowRight, TrendingUp, Loader2, RefreshCw,
} from 'lucide-react';
import {
  SERVICIO_ESTADOS,
  loadServicesOverlappingDay,
} from '../lib/transportServices';
import type { TradeTransportService, ServicioEstado } from '../lib/transportServices';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';
import { loadClients, loadWorkers, getClientDisplayName } from '../lib/supabase';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import {
  computeKpis,
  getVehicleFleetStatus,
  isVehiclePassenger,
  isoDate,
  type FleetStatus,
} from '../lib/transportPanelHelpers';

// ── Helpers de UI ─────────────────────────────────────────────────────────────

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

const VEHICLE_IMAGES: Record<string, string> = {
  autocar:        '/autocar.png',
  microbus:       '/minibus.png',
  furgoneta:      '/furgonetatrabajo.png',
  sedan:          '/furgonetatrabajo.png',
  minivan:        '/minibus.png',
  camion_rigido:  '/camionreparto.png',
  cabeza_tractora:'/camionarticulado.png',
  otro:           '/autocar.png',
};

function getVehicleImage(tipo: string): string {
  return VEHICLE_IMAGES[tipo] ?? '/autocar.png';
}

// Fleet status display config
const FLEET_STATUS_CONFIG: Record<FleetStatus, { label: string; dot: string; card: string }> = {
  en_servicio:      { label: 'En servicio',   dot: 'bg-emerald-500 animate-pulse', card: 'border-emerald-200 bg-emerald-50' },
  programado:       { label: 'Programado',    dot: 'bg-blue-500',                  card: 'border-blue-200 bg-blue-50'       },
  sin_asignacion:   { label: 'Disponible',    dot: 'bg-slate-400',                 card: 'border-slate-200 bg-white'        },
  fuera_de_servicio:{ label: 'No disponible', dot: 'bg-amber-400',                 card: 'border-amber-200 bg-amber-50'     },
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
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <span className="text-3xl font-black">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (tab: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransportePanel({ orgId, showToast, onNavigate }: Props) {
  const today = isoDate(new Date());

  const [loading,   setLoading]   = useState(true);
  const [services,  setServices]  = useState<TradeTransportService[]>([]);
  const [vehicles,  setVehicles]  = useState<TradeVehicle[]>([]);
  const [workers,   setWorkers]   = useState<TradeWorker[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, string>>(new Map());
  const [vehicleMap,setVehicleMap]= useState<Map<string, TradeVehicle>>(new Map());
  const [workerMap, setWorkerMap] = useState<Map<string, TradeWorker>>(new Map());
  const [error,     setError]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // loadServicesOverlappingDay fetches services where the interval covers today,
      // including overnight services that started yesterday.
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

  // ── KPIs and fleet status ─────────────────────────────────────────────────

  const kpis = computeKpis(services);

  const passengerVehicles = vehicles.filter(v => v.activo && isVehiclePassenger(v));

  const fleetStatuses = passengerVehicles.map(v => ({
    vehicle: v,
    status:  getVehicleFleetStatus(v, services),
  }));

  const countByStatus = (s: FleetStatus) => fleetStatuses.filter(f => f.status === s).length;

  const assignedCount    = countByStatus('en_servicio') + countByStatus('programado');
  const availableCount   = countByStatus('sin_asignacion');
  const maintenanceCount = vehicles.filter(v => v.estado === 'en_mantenimiento' || v.estado === 'baja').length;

  // Also include inactive vehicles in maintenance count for KPI sub-label
  const conductorWorkers = workers.filter(w => w.es_conductor);
  const assignedConductors = conductorWorkers.filter(w => kpis.assignedConductorIds.has(w.id));

  const fleetCards = passengerVehicles.slice(0, 6);

  // Sorted table (already sorted by fecha_inicio ASC from DB)
  const tableServices = services.filter(s => s.estado !== 'cancelado');

  // ── Render ────────────────────────────────────────────────────────────────

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
    <div className="p-6 space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Panel de Transporte</h1>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{fmtDateLong()}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={<Calendar className="w-4 h-4" />}
          label="Servicios hoy"
          value={kpis.totalActiveServices}
          sub={`${kpis.serviciosConfirmados} confirmados`}
          accent="blue"
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Viajeros previstos"
          value={kpis.totalViajeros}
          sub={kpis.totalViajeros === 0 ? 'sin datos' : 'total acumulado'}
          accent="purple"
        />
        <KpiCard
          icon={<Bus className="w-4 h-4" />}
          label="Vehículos asignados"
          value={assignedCount}
          sub={`de ${passengerVehicles.length} en flota`}
          accent="emerald"
        />
        <KpiCard
          icon={<Bus className="w-4 h-4" />}
          label="Disponibles"
          value={availableCount}
          sub={maintenanceCount > 0 ? `${maintenanceCount} en mant./baja` : 'todos operativos'}
          accent={availableCount === 0 && passengerVehicles.length > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Conductores asignados"
          value={assignedConductors.length}
          sub="con servicio hoy"
          accent="slate"
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="En curso ahora"
          value={kpis.serviciosEnCurso}
          sub={kpis.serviciosEnCurso > 0 ? 'servicio activo' : 'sin servicios activos'}
          accent={kpis.serviciosEnCurso > 0 ? 'emerald' : 'slate'}
        />
      </div>

      {/* Today's services table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Servicios del día</h2>
          {onNavigate && (
            <button onClick={() => onNavigate('transporte_servicios')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {tableServices.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
            <Calendar className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">Sin servicios para hoy</p>
            <p className="text-xs opacity-70">Los servicios activos aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Hora</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Servicio</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Ruta</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Vehículo</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Conductor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tableServices.map((svc, idx) => {
                  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)   : undefined;
                  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id)  : undefined;
                  const client    = svc.client_id    ? clientMap.get(svc.client_id)     : undefined;
                  const isEnCurso = svc.estado === 'en_curso';
                  return (
                    <tr key={svc.id}
                      className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${isEnCurso ? 'bg-emerald-50/40' : idx % 2 !== 0 ? 'bg-slate-50/20' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{fmtTime(svc.fecha_inicio)}</span>
                          {svc.fecha_fin && (
                            <span className="text-[10px] text-slate-400">{fmtTime(svc.fecha_fin)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 leading-tight">{svc.titulo}</span>
                          {svc.num_viajeros != null && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Users className="w-3 h-3" />{svc.num_viajeros} viajeros
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {client ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {svc.origen || svc.destino ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3 shrink-0 text-slate-300" />
                            <span className="truncate max-w-[140px]">
                              {svc.origen ?? '?'} → {svc.destino ?? '?'}
                            </span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {vehicle ? (
                          <div className="flex items-center gap-2">
                            <img src={getVehicleImage(vehicle.tipo)} alt={vehicle.tipo}
                              className="w-7 h-7 object-contain rounded"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-700 leading-tight">{vehicle.nombre}</span>
                              <span className="text-[10px] text-slate-400">{vehicle.matricula}</span>
                            </div>
                          </div>
                        ) : <span className="text-xs text-amber-500 font-medium">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {conductor
                          ? <span className="font-medium">{conductor.nombre}</span>
                          : <span className="text-amber-500 font-medium">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${estadoColor(svc.estado as ServicioEstado)}`}>
                          {isEnCurso && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                          {estadoLabel(svc.estado as ServicioEstado)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fleet cards */}
      {fleetCards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Flota operativa</h2>
            {onNavigate && (
              <button onClick={() => onNavigate('transporte_vehiculos')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                Ver flota completa <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {fleetCards.map(v => {
              const { status } = fleetStatuses.find(f => f.vehicle.id === v.id)!;
              const cfg = FLEET_STATUS_CONFIG[status];
              return (
                <div key={v.id} className={`rounded-2xl border p-3 flex flex-col gap-2 ${cfg.card}`}>
                  <img src={getVehicleImage(v.tipo)} alt={v.nombre}
                    className="w-full h-20 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight truncate">{v.nombre}</p>
                    <p className="text-[10px] text-slate-500">{v.matricula}</p>
                    {v.capacidad_viajeros && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                        <Users className="w-2.5 h-2.5" /> {v.capacidad_viajeros} plazas
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[10px] font-semibold text-slate-600">{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty fleet prompt */}
      {passengerVehicles.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4">
          <TrendingUp className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Flota no configurada</p>
            <p className="text-xs text-blue-600 mt-1">
              Añade vehículos con modalidad <em>viajeros</em> o <em>mixto</em> para ver los indicadores de flota.
            </p>
            {onNavigate && (
              <button onClick={() => onNavigate('transporte_vehiculos')}
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
                Ir a Flota <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
