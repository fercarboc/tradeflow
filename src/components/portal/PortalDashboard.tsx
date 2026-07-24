import React, { useEffect, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  getSupplierDashboardStats, getSupplierActionCenter, getSupplierAIInsights,
  PortalDashboardStats, PortalActionItem, PortalAIInsight,
} from '../../lib/api/marketplace-portal';
import { PortalTab } from './PortalContext';

interface Props {
  actorId:     string;
  membership:  MarketplaceMyMembership;
  setActiveTab: (tab: PortalTab) => void;
}

export default function PortalDashboard({ actorId, membership, setActiveTab }: Props) {
  const [stats,    setStats]    = useState<PortalDashboardStats | null>(null);
  const [actions,  setActions]  = useState<PortalActionItem[]>([]);
  const [insights, setInsights] = useState<PortalAIInsight[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSupplierDashboardStats(actorId),
      getSupplierActionCenter(actorId),
      getSupplierAIInsights(actorId),
    ]).then(([s, a, i]) => {
      setStats(s);
      setActions(a);
      setInsights(i);
    }).catch((e) => {
      setError(e.message ?? 'Error al cargar el dashboard');
    }).finally(() => setLoading(false));
  }, [actorId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Ofertas totales',
      value: stats?.total_offerings ?? 0,
      sub:   `${stats?.matched_offerings ?? 0} vinculadas`,
      color: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Pedidos activos',
      value: (stats?.pending_orders ?? 0) + (stats?.confirmed_orders ?? 0),
      sub:   `${stats?.pending_orders ?? 0} sin confirmar`,
      color: (stats?.pending_orders ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Cobertura catálogo',
      value: `${stats?.coverage_pct ?? 0}%`,
      sub:   `${stats?.unmatched_offerings ?? 0} sin vincular`,
      color: (stats?.coverage_pct ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600',
    },
    {
      label: 'Instaladores compradores',
      value: stats?.total_buyers ?? 0,
      sub:   `${stats?.completed_orders ?? 0} pedidos completados`,
      color: 'text-slate-900 dark:text-slate-100',
    },
  ];

  const severityConfig: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
    critical: {
      icon: (
        <svg className="h-4 w-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      ),
      bg:     'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-200 dark:border-red-800',
    },
    warning: {
      icon: (
        <svg className="h-4 w-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      ),
      bg:     'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-200 dark:border-amber-800',
    },
    info: {
      icon: (
        <svg className="h-4 w-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
        </svg>
      ),
      bg:     'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-200 dark:border-blue-800',
    },
  };

  return (
    <div className="min-h-full p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Buenos días, {membership.actor_nombre}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Portal del Proveedor · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Centro de Acción */}
      {actions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Centro de Acción
          </h2>
          <div className="space-y-2">
            {actions.map((action, i) => {
              const cfg = severityConfig[action.severidad];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 ${cfg.bg} ${cfg.border}`}
                >
                  {cfg.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {action.titulo}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {action.descripcion}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab(action.cta_target as PortalTab)}
                    className="shrink-0 text-xs font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300 transition-colors whitespace-nowrap"
                  >
                    {action.cta_label} →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Resumen
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
                {kpi.value}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Asistente IA */}
      {insights.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 rounded-full bg-teal-900/20 px-2.5 py-1">
              <svg className="h-3.5 w-3.5 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
              </svg>
              <span className="text-xs font-semibold text-teal-400">Asistente IA</span>
            </div>
            <span className="text-xs text-slate-500">Análisis automático de tu catálogo</span>
          </div>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-900/30 text-teal-400">
                  <span className="text-sm">
                    {ins.insight_type === 'cobertura_baja'          ? '📊' :
                     ins.insight_type === 'precio_superior'         ? '💰' :
                     ins.insight_type === 'precio_competitivo'      ? '🏆' :
                     ins.insight_type === 'referencias_duplicadas'  ? '🔁' :
                     ins.insight_type === 'tiempo_respuesta_lento'  ? '⏱️' : '💡'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ins.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ins.descripcion}</p>
                </div>
                {ins.valor !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-teal-500 tabular-nums leading-none">
                      {ins.valor}
                    </p>
                    <p className="text-xs text-slate-400">{ins.unidad}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Estado vacío cuando todo está bien */}
      {actions.length === 0 && insights.length === 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-6 text-center">
          <svg className="mx-auto h-8 w-8 text-emerald-500 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Todo en orden</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
            No tienes acciones pendientes ni alertas activas.
          </p>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-full p-6 space-y-6 bg-slate-50 dark:bg-slate-950 animate-pulse">
      <div className="h-7 w-64 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}
