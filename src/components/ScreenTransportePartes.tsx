/**
 * ScreenTransportePartes — Histórico de partes de servicio completados.
 * TX-PARTES-IMPL-1A: lectura pura, sin migraciones.
 * Reutiliza ScreenTransporteParteTrabajo vía onOpenParte callback.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileCheck, Search, Filter, Loader2, AlertTriangle, ChevronRight, X, BarChart2 } from 'lucide-react';
import { loadPartesCompletados, TIPO_SERVICIO_OPTIONS } from '../lib/transportServices';
import type { TradeTransportService, PartesFilter } from '../lib/transportServices';
import { loadWorkers, loadClients, getClientDisplayName } from '../lib/supabase';
import type { TradeWorker, TradeClient } from '../lib/supabase';
import { loadVehiclesAll } from '../lib/transport';
import type { TradeVehicle } from '../lib/transport';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tipoLabel(tipo: string): string {
  return TIPO_SERVICIO_OPTIONS.find(o => o.value === tipo)?.label ?? tipo;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-[100px]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-xl font-black text-slate-800">{value}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}

// ── Row (desktop) ─────────────────────────────────────────────────────────────

function ParteRow({
  s, workers, vehicles, clients, onOpenParte,
}: {
  s: TradeTransportService;
  workers: TradeWorker[];
  vehicles: TradeVehicle[];
  clients: TradeClient[];
  onOpenParte: (id: string) => void;
}) {
  const conductor = workers.find(w => w.id === s.conductor_id);
  const vehicle   = vehicles.find(v => v.id === s.vehicle_id);
  const client    = clients.find(c => c.id === s.client_id);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{fmt(s.fecha_inicio)}</td>
      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{fmtDatetime(s.cerrado_at)}</td>
      <td className="py-2.5 px-3 min-w-0">
        <div className="text-xs font-semibold text-slate-800 truncate max-w-[180px]" title={s.titulo}>{s.titulo}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{tipoLabel(s.tipo_servicio)}</div>
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
        {client ? getClientDisplayName(client) : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
        {conductor ? conductor.nombre : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
        {vehicle ? <span>{vehicle.matricula}</span> : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-xs text-right text-slate-700 whitespace-nowrap font-mono">
        {s.km_reales != null ? `${s.km_reales} km` : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-center">
        {s.incidencias
          ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Sí</span>
          : <span className="text-[10px] text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3">
        <button
          type="button"
          onClick={() => onOpenParte(s.id)}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          Ver parte <ChevronRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Card (mobile) ─────────────────────────────────────────────────────────────

function ParteCard({
  s, workers, vehicles, clients, onOpenParte,
}: {
  s: TradeTransportService;
  workers: TradeWorker[];
  vehicles: TradeVehicle[];
  clients: TradeClient[];
  onOpenParte: (id: string) => void;
}) {
  const conductor = workers.find(w => w.id === s.conductor_id);
  const vehicle   = vehicles.find(v => v.id === s.vehicle_id);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 leading-tight truncate">{s.titulo}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{tipoLabel(s.tipo_servicio)}</div>
        </div>
        {s.incidencias && (
          <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Incidencia</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 mb-3">
        <div><span className="text-slate-400">Servicio:</span> {fmt(s.fecha_inicio)}</div>
        <div><span className="text-slate-400">Cierre:</span> {fmtDatetime(s.cerrado_at)}</div>
        {conductor && <div><span className="text-slate-400">Conductor:</span> {conductor.nombre}</div>}
        {vehicle && <div><span className="text-slate-400">Vehículo:</span> {vehicle.matricula}</div>}
        {s.km_reales != null && <div><span className="text-slate-400">Km reales:</span> <span className="font-mono font-semibold">{s.km_reales}</span></div>}
      </div>
      <button
        type="button"
        onClick={() => onOpenParte(s.id)}
        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg py-2 transition-colors cursor-pointer"
      >
        <FileCheck className="w-3.5 h-3.5" />
        Ver parte completo
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ScreenTransportePartesProps {
  orgId: string;
  onOpenParte: (serviceId: string) => void;
  /** Pre-filtrar por conductor (para uso futuro desde ficha conductor). */
  conductorId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScreenTransportePartes({
  orgId,
  onOpenParte,
  conductorId,
}: ScreenTransportePartesProps) {
  // ── Lookup data ────────────────────────────────────────────────────────────
  const [workers,  setWorkers]  = useState<TradeWorker[]>([]);
  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [clients,  setClients]  = useState<TradeClient[]>([]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [desde,          setDesde]          = useState('');
  const [hasta,          setHasta]          = useState('');
  const [conductorFiltro, setConductorFiltro] = useState(conductorId ?? '');
  const [vehicleFiltro,  setVehicleFiltro]  = useState('');
  const [showFilters,    setShowFilters]    = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [partes,   setPartes]   = useState<TradeTransportService[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Load lookup data once
  useEffect(() => {
    if (!orgId) return;
    loadWorkers(orgId).then(setWorkers).catch(() => {});
    loadVehiclesAll(orgId).then(setVehicles).catch(() => {});
    loadClients(orgId).then(setClients).catch(() => {});
  }, [orgId]);

  // Load partes with filters
  const fetchPartes = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const filter: PartesFilter = {
        desde:       desde       || undefined,
        hasta:       hasta       || undefined,
        conductorId: conductorFiltro || undefined,
        vehicleId:   vehicleFiltro   || undefined,
        search:      search          || undefined,
      };
      const data = await loadPartesCompletados(orgId, filter);
      setPartes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los partes');
    } finally {
      setLoading(false);
    }
  }, [orgId, desde, hasta, conductorFiltro, vehicleFiltro, search]);

  useEffect(() => { fetchPartes(); }, [fetchPartes]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total   = partes.length;
    const totalKm = partes.reduce((acc, s) => acc + (s.km_reales ?? 0), 0);
    const conInc  = partes.filter(s => s.incidencias).length;
    const pctInc  = total > 0 ? Math.round((conInc / total) * 100) : 0;
    return { total, totalKm: Math.round(totalKm * 10) / 10, pctInc };
  }, [partes]);

  const conductores = workers.filter(w => w.es_conductor);

  const hasFilters = !!(desde || hasta || conductorFiltro || vehicleFiltro || search);

  function clearFilters() {
    setDesde('');
    setHasta('');
    setConductorFiltro(conductorId ?? '');
    setVehicleFiltro('');
    setSearch('');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-800">Histórico de Partes</h2>
              <p className="text-[11px] text-slate-400">Servicios de transporte completados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              showFilters || hasFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {hasFilters && (
              <span className="ml-0.5 bg-white/30 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black">
                {[desde, hasta, conductorFiltro, vehicleFiltro, search].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* Search */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por título..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
              />
            </div>
            {/* Desde */}
            <div>
              <input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                placeholder="Desde"
              />
            </div>
            {/* Hasta */}
            <div>
              <input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                placeholder="Hasta"
              />
            </div>
            {/* Conductor */}
            <div>
              <select
                value={conductorFiltro}
                onChange={e => setConductorFiltro(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
              >
                <option value="">Todos los conductores</option>
                {conductores.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre}</option>
                ))}
              </select>
            </div>
            {/* Vehículo */}
            <div>
              <select
                value={vehicleFiltro}
                onChange={e => setVehicleFiltro(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
              >
                <option value="">Todos los vehículos</option>
                {vehicles.filter(v => v.activo).map(v => (
                  <option key={v.id} value={v.id}>{v.matricula} — {v.nombre}</option>
                ))}
              </select>
            </div>
            {/* Clear filters */}
            {hasFilters && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      {!loading && partes.length > 0 && (
        <div className="px-4 sm:px-6 py-3 flex gap-3 overflow-x-auto scrollbar-hide shrink-0">
          <KpiCard label="Total partes" value={kpis.total} />
          <KpiCard label="Km totales" value={`${kpis.totalKm}`} sub="km recorridos" />
          <KpiCard label="Con incidencias" value={`${kpis.pctInc}%`} sub={`${partes.filter(s => s.incidencias).length} servicios`} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-500">Cargando partes...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && partes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BarChart2 className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">
              {hasFilters ? 'Sin partes para los filtros aplicados' : 'Sin partes cerrados todavía'}
            </p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              {hasFilters
                ? 'Prueba a ampliar el rango de fechas o a cambiar los filtros.'
                : 'Los partes aparecen aquí cuando se cierra un servicio en estado «En curso».'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}

        {!loading && !error && partes.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block mt-3">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Fecha serv.</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Cierre</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Servicio</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conductor</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vehículo</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Km</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Inc.</th>
                        <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partes.map(s => (
                        <ParteRow
                          key={s.id}
                          s={s}
                          workers={workers}
                          vehicles={vehicles}
                          clients={clients}
                          onOpenParte={onOpenParte}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-right">
                {partes.length} parte{partes.length !== 1 ? 's' : ''} mostrado{partes.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden mt-3 space-y-3">
              {partes.map(s => (
                <ParteCard
                  key={s.id}
                  s={s}
                  workers={workers}
                  vehicles={vehicles}
                  clients={clients}
                  onOpenParte={onOpenParte}
                />
              ))}
              <p className="text-[11px] text-slate-400 text-center pt-1">
                {partes.length} parte{partes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
