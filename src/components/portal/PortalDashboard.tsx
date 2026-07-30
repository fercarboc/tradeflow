import React, { useEffect, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  getSupplierDashboardStats,
  getSupplierActionCenter,
  getCatalogQualityStats,
  getSupplierHealthScore,
  getSupplierActivityFeed,
  getSupplierIAStats,
  PortalDashboardStats,
  PortalActionItem,
  CatalogQualityStats,
  SupplierHealthScore,
  ActivityFeedItem,
  PortalIAStats,
} from '../../lib/api/marketplace-portal';
import { PortalTab } from './PortalContext';

interface Props {
  actorId:      string;
  membership:   MarketplaceMyMembership;
  setActiveTab: (tab: PortalTab) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora';
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatEur(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + ' k€';
  return n.toFixed(0) + ' €';
}

function formatHours(h: number | null | undefined): string {
  if (h == null) return '—';
  if (h < 1)     return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

// ── Subcomponentes (módulo, no anidados) ──────────────────────────────────────

interface KPICardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  color?:   string;
  onClick?: () => void;
  icon?:    React.ReactNode;
}

function KPICard({ label, value, sub, color = 'text-slate-900 dark:text-slate-100', onClick, icon }: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-150 ${onClick ? 'hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-500 leading-tight">{label}</p>
        {icon && <span className="text-slate-400 group-hover:text-teal-500 transition-colors">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums leading-none ${color}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400 leading-tight">{sub}</p>}
      {onClick && (
        <span className="absolute bottom-3 right-3 text-[10px] text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity">
          Ver →
        </span>
      )}
    </button>
  );
}

interface AlertChipProps {
  label:     string;
  severity:  'critical' | 'warning' | 'info';
  onClick?:  () => void;
}

function AlertChip({ label, severity, onClick }: AlertChipProps) {
  const cfg = {
    critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    warning:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    info:     'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  }[severity];

  const dot = {
    critical: 'bg-red-500',
    warning:  'bg-amber-500',
    info:     'bg-blue-500',
  }[severity];

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${cfg} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </button>
  );
}

interface FeedItemProps {
  item:    ActivityFeedItem;
  onClick?: () => void;
}

function FeedItem({ item, onClick }: FeedItemProps) {
  const iconMap: Record<string, string> = {
    precio:          '💰',
    stock:           '📦',
    estado:          '⚡',
    imagen:          '🖼️',
    ia_vinculado:    '🔗',
    ia_desvinculado: '🔓',
    completado:      '✅',
    error:           '❌',
    cancelado:       '🚫',
  };

  const isError = item.tipo === 'error';
  const isImport = item.event_source === 'import';

  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${isError ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-sm">
        {iconMap[item.tipo] ?? (isImport ? '📥' : '📋')}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${isError ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
          {item.titulo}
        </p>
        {item.descripcion && (
          <p className="mt-0.5 text-xs text-slate-500 truncate leading-tight">
            {item.descripcion}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
        {timeAgo(item.created_at)}
      </span>
    </button>
  );
}

// ── Sección header ──

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {children}
      </h2>
      {action}
    </div>
  );
}

// ── Skeleton ──

function DashboardSkeleton() {
  return (
    <div className="min-h-full p-5 space-y-5 bg-slate-50 dark:bg-slate-950 animate-pulse">
      <div className="h-6 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-7 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="lg:col-span-2 space-y-4">
          <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function PortalDashboard({ actorId, membership, setActiveTab }: Props) {
  const [stats,    setStats]    = useState<PortalDashboardStats | null>(null);
  const [quality,  setQuality]  = useState<CatalogQualityStats | null>(null);
  const [health,   setHealth]   = useState<SupplierHealthScore | null>(null);
  const [actions,  setActions]  = useState<PortalActionItem[]>([]);
  const [feed,     setFeed]     = useState<ActivityFeedItem[]>([]);
  const [iaStats,  setIaStats]  = useState<PortalIAStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getSupplierDashboardStats(actorId),
      getCatalogQualityStats(actorId),
      getSupplierHealthScore(actorId),
      getSupplierActionCenter(actorId),
      getSupplierActivityFeed(actorId, 15),
      getSupplierIAStats(actorId),
    ]).then(([s, q, h, a, f, ia]) => {
      if (!mountedRef.current) return;
      setStats(s);
      setQuality(q);
      setHealth(h);
      setActions(a);
      setFeed(f);
      setIaStats(ia);
    }).catch((e) => {
      if (!mountedRef.current) return;
      setError(e.message ?? 'Error al cargar el dashboard');
    }).finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [actorId]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  // ── Valores derivados ──
  const activos    = (quality?.total ?? 0) - (quality?.inactivos ?? 0);
  const inactivos  = quality?.inactivos ?? 0;
  const conStock   = (quality?.total ?? 0) - (quality?.sin_stock ?? 0);
  const sinStock   = quality?.sin_stock ?? 0;
  const sinImagen  = quality?.sin_imagen ?? 0;
  const sinVincular = stats?.unmatched_offerings ?? 0;
  const coveragePct = stats?.coverage_pct ?? 0;
  const pedidosPendientes = stats?.pending_orders ?? 0;

  // ── Alertas computadas ──
  const alertas: { label: string; severity: 'critical' | 'warning' | 'info'; tab: PortalTab }[] = [];
  if (sinVincular > 0) alertas.push({ label: `${sinVincular} sin vincular`, severity: 'critical', tab: 'catalogo' });
  if (sinImagen > 0)   alertas.push({ label: `${sinImagen} sin imagen`,    severity: 'warning',  tab: 'catalogo' });
  if (sinStock > 0)    alertas.push({ label: `${sinStock} sin stock`,       severity: 'warning',  tab: 'catalogo' });
  if (pedidosPendientes > 0) alertas.push({ label: `${pedidosPendientes} pedido${pedidosPendientes > 1 ? 's' : ''} pendiente${pedidosPendientes > 1 ? 's' : ''}`, severity: 'warning', tab: 'pedidos' });
  const hasImportError = actions.some((a) => a.tipo?.includes('error') || a.severidad === 'critical');
  if (hasImportError) alertas.push({ label: 'Error en importación', severity: 'critical', tab: 'catalogo' });

  // ── Hora del día ──
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const dateStr  = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  // ── KPIs: 9 tarjetas ──
  const kpis: KPICardProps[] = [
    // Catálogo
    {
      label:   'Activos',
      value:   activos,
      sub:     `de ${quality?.total ?? 0} totales`,
      color:   activos > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label:   'Inactivos',
      value:   inactivos,
      sub:     inactivos > 0 ? 'requieren revisión' : 'todo activo',
      color:   inactivos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" />
        </svg>
      ),
    },
    {
      label:   'Cobertura IA',
      value:   `${coveragePct}%`,
      sub:     `${stats?.matched_offerings ?? 0} vinculados`,
      color:   coveragePct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : coveragePct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      ),
    },
    // Stock
    {
      label:   'Con stock',
      value:   conStock,
      sub:     `disponibles`,
      color:   conStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label:   'Sin stock',
      value:   sinStock,
      sub:     sinStock > 0 ? 'requieren atención' : 'todo disponible',
      color:   sinStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      label:   'Sin imagen',
      value:   sinImagen,
      sub:     sinImagen > 0 ? 'mejoran la visibilidad' : 'todas tienen imagen',
      color:   sinImagen > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500',
      onClick: () => setActiveTab('catalogo'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="8.5" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
        </svg>
      ),
    },
    // Pedidos
    {
      label:   'Pedidos pendientes',
      value:   pedidosPendientes,
      sub:     pedidosPendientes > 0 ? 'requieren respuesta' : 'al día',
      color:   pedidosPendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500',
      onClick: () => setActiveTab('pedidos'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:   'Completados',
      value:   stats?.completed_orders ?? 0,
      sub:     `${stats?.total_buyers ?? 0} compradores`,
      color:   'text-slate-900 dark:text-slate-100',
      onClick: () => setActiveTab('pedidos'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:   'Ventas del mes',
      value:   formatEur(stats?.month_revenue ?? 0),
      sub:     'período actual',
      color:   (stats?.month_revenue ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500',
      onClick: () => setActiveTab('pedidos'),
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-full p-5 space-y-5 bg-slate-50 dark:bg-slate-950">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {greeting}, {membership.actor_nombre}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* ── MVP-3.5: Alertas ── */}
      {alertas.length > 0 && (
        <section aria-label="Alertas">
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => (
              <AlertChip
                key={i}
                label={a.label}
                severity={a.severity}
                onClick={() => setActiveTab(a.tab)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── MVP-3.1: KPIs ── */}
      <section aria-label="Indicadores">
        <SectionTitle>Indicadores</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      </section>

      {/* ── Columnas inferiores ── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ── MVP-3.2: Actividad reciente ── */}
        <section className="lg:col-span-3" aria-label="Actividad reciente">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actividad reciente
              </h2>
              <button
                onClick={() => setActiveTab('catalogo')}
                className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors"
              >
                Ver catálogo →
              </button>
            </div>

            {feed.length === 0 ? (
              <div className="py-10 text-center">
                <svg className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm text-slate-400">Sin actividad reciente</p>
                <p className="text-xs text-slate-400 mt-1">Las acciones sobre el catálogo aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {feed.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onClick={() => setActiveTab(item.event_source === 'import' ? 'catalogo' : 'catalogo')}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Columna derecha ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── MVP-3.3: Panel Motor IA ── */}
          <section aria-label="Motor IA">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 rounded-full bg-teal-900/20 px-2.5 py-1">
                  <svg className="h-3.5 w-3.5 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-teal-400">Motor IA</span>
                </div>
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className="ml-auto text-xs text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors"
                >
                  Gestionar →
                </button>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3">
                {/* Vinculados */}
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className="group rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-3 text-left hover:border-teal-400 transition-colors"
                >
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Vinculados</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {iaStats?.linked ?? '—'}
                  </p>
                  <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 mt-0.5">al catálogo universal</p>
                </button>

                {/* Pendientes */}
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className="group rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-teal-400 transition-colors"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sin vincular</p>
                  <p className={`text-2xl font-bold tabular-nums mt-0.5 ${(iaStats?.pending ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {iaStats?.pending ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">pendientes de análisis</p>
                </button>

                {/* Confianza media */}
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className="group rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-teal-400 transition-colors"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Confianza media</p>
                  <p className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400 mt-0.5">
                    {iaStats?.avg_confidence != null ? `${iaStats.avg_confidence}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">en coincidencias</p>
                </button>

                {/* A revisar */}
                <button
                  onClick={() => setActiveTab('catalogo')}
                  className="group rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-teal-400 transition-colors"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">A revisar</p>
                  <p className={`text-2xl font-bold tabular-nums mt-0.5 ${(iaStats?.to_review ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {iaStats?.to_review ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">confianza baja (&lt;70%)</p>
                </button>
              </div>

              {/* Tiempo de respuesta (del health score) */}
              <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                <button
                  onClick={() => setActiveTab('pedidos')}
                  className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs text-slate-500">Tiempo medio de respuesta</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    health?.avg_confirm_h == null ? 'text-slate-400' :
                    health.avg_confirm_h < 24     ? 'text-emerald-600 dark:text-emerald-400' :
                    health.avg_confirm_h < 48     ? 'text-amber-600 dark:text-amber-400' :
                                                    'text-red-600 dark:text-red-400'
                  }`}>
                    {formatHours(health?.avg_confirm_h)}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* ── MVP-3.4: Panel de acciones ── */}
          <section aria-label="Acciones rápidas">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Acciones rápidas
                </h2>
              </div>
              <div className="p-3 grid grid-cols-1 gap-1.5">
                <ActionBtn
                  label="Importar catálogo"
                  onClick={() => setActiveTab('catalogo')}
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  }
                />
                <ActionBtn
                  label="Exportar CSV"
                  onClick={() => setActiveTab('catalogo')}
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  }
                />
                <ActionBtn
                  label="Gestionar catálogo"
                  onClick={() => setActiveTab('catalogo')}
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
                <ActionBtn
                  label="Ver pedidos"
                  onClick={() => setActiveTab('pedidos')}
                  badge={pedidosPendientes > 0 ? String(pedidosPendientes) : undefined}
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  }
                />
                <ActionBtn
                  label="Gestionar equipo"
                  onClick={() => setActiveTab('equipo')}
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  }
                />
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ── ActionBtn (módulo, no anidado) ────────────────────────────────────────────

interface ActionBtnProps {
  label:    string;
  onClick:  () => void;
  icon?:    React.ReactNode;
  badge?:   string;
}

function ActionBtn({ label, onClick, icon, badge }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-700 dark:hover:text-teal-300 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <span className="text-slate-400 group-hover:text-teal-500 transition-colors">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
      <svg className="h-3.5 w-3.5 text-slate-300 group-hover:text-teal-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
