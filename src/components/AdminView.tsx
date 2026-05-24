/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ActivePage } from '../types';
import { getAdminOrgs, adminUpdateOrgPlan, AdminOrgRow, TradeSubscription } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Users, CreditCard, TrendingUp, Clock, ArrowLeft, Search, RefreshCw,
  Shield, CheckCircle, AlertTriangle, Building2, ChevronDown,
} from 'lucide-react';

const ADMIN_EMAIL = 'fercarboc@gmail.com';

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  basico: { monthly: 29, yearly: 23 },
  pro: { monthly: 49, yearly: 39 },
  empresa: { monthly: 89, yearly: 71 },
};

interface AdminViewProps {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

function StatusBadge({ sub }: { sub?: TradeSubscription }) {
  if (!sub) return <span className="text-xs text-slate-500">—</span>;
  const cfg = {
    trial: { cls: 'bg-blue-900/40 text-blue-300 border-blue-800', label: 'Prueba' },
    active: { cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800', label: 'Activo' },
    cancelled: { cls: 'bg-red-900/40 text-red-300 border-red-800', label: 'Cancelado' },
    expired: { cls: 'bg-slate-700 text-slate-400 border-slate-600', label: 'Expirado' },
  };
  const { cls, label } = cfg[sub.status] ?? cfg.expired;
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function PlanSelect({ org, onUpdate }: { org: AdminOrgRow; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false);
  const currentPlan = org.subscription?.plan ?? (org.plan as TradeSubscription['plan']) ?? 'pro';
  const currentCycle = org.subscription?.billing_cycle ?? 'monthly';

  const handleChange = async (plan: TradeSubscription['plan']) => {
    setUpdating(true);
    await adminUpdateOrgPlan(org.id, plan, currentCycle);
    await onUpdate();
    setUpdating(false);
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentPlan}
        onChange={e => handleChange(e.target.value as TradeSubscription['plan'])}
        disabled={updating}
        className="appearance-none bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 pr-6 py-1 cursor-pointer focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value="basico">Básico</option>
        <option value="pro">Pro</option>
        <option value="empresa">Empresa</option>
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function AdminView({ setCurrentPage, session }: AdminViewProps) {
  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) loadOrgs();
  }, [isAdmin]);

  const loadOrgs = async () => {
    setLoading(true);
    const data = await getAdminOrgs();
    setOrgs(data);
    setLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Acceso denegado</h2>
          <p className="text-slate-400 text-sm mb-6">No tienes permisos de administrador.</p>
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer transition-colors"
          >
            ← Volver al panel
          </button>
        </div>
      </div>
    );
  }

  // Computed stats
  const totalOrgs = orgs.length;
  const trialing = orgs.filter(o => o.subscription?.status === 'trial').length;
  const active = orgs.filter(o => o.subscription?.status === 'active').length;
  const mrr = orgs
    .filter(o => o.subscription?.status === 'active')
    .reduce((sum, o) => {
      const sub = o.subscription!;
      const prices = PLAN_PRICES[sub.plan] ?? PLAN_PRICES.pro;
      return sum + (sub.billing_cycle === 'monthly' ? prices.monthly : prices.yearly);
    }, 0);

  const filtered = orgs.filter(o => {
    const matchesSearch =
      o.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (o.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.oficio ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.subscription?.status === statusFilter || (!o.subscription && statusFilter === 'none');
    return matchesSearch && matchesStatus;
  });

  const STATS = [
    { label: 'Total clientes', value: totalOrgs, Icon: Users, color: 'text-blue-400' },
    { label: 'En prueba', value: trialing, Icon: Clock, color: 'text-yellow-400' },
    { label: 'Activos (pago)', value: active, Icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'MRR estimado', value: `${mrr}€`, Icon: TrendingUp, color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Panel
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-sm uppercase tracking-wider text-white">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block">{session?.user?.email}</span>
          <button
            onClick={loadOrgs}
            title="Recargar"
            className="h-8 w-8 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {STATS.map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-2xl font-display font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar nombre, email u oficio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="trial">En prueba</option>
            <option value="active">Activos</option>
            <option value="cancelled">Cancelados</option>
            <option value="expired">Expirados</option>
          </select>

          <span className="text-xs text-slate-500 ml-auto">{filtered.length} registros</span>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Empresa / Instalador', 'Oficio(s)', 'Plan', 'Estado', 'Prueba hasta', 'Ciclo', 'Alta'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" />
                      Cargando datos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <Building2 className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No se encontraron registros</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(org => {
                    const sub = org.subscription;
                    const trialEnd = sub?.trial_end
                      ? new Date(sub.trial_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—';
                    const createdAt = new Date(org.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

                    return (
                      <tr key={org.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="font-semibold text-white text-sm truncate">{org.nombre}</div>
                          {org.email && <div className="text-[11px] text-slate-400 truncate">{org.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs">{org.oficio || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <PlanSelect org={org} onUpdate={loadOrgs} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge sub={sub} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${sub?.status === 'trial' ? 'text-yellow-300' : 'text-slate-500'}`}>
                            {sub?.status === 'trial' ? trialEnd : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs capitalize">
                            {sub?.billing_cycle === 'monthly' ? 'Mensual' : sub?.billing_cycle === 'yearly' ? 'Anual' : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-500 text-xs">{createdAt}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trial expiry alerts */}
        {orgs.some(o => {
          if (o.subscription?.status !== 'trial') return false;
          const daysLeft = Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000);
          return daysLeft <= 7 && daysLeft >= 0;
        }) && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-300 font-semibold text-sm">Pruebas próximas a vencer</span>
            </div>
            {orgs
              .filter(o => {
                if (o.subscription?.status !== 'trial') return false;
                const daysLeft = Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000);
                return daysLeft <= 7 && daysLeft >= 0;
              })
              .map(o => {
                const daysLeft = Math.ceil((new Date(o.subscription!.trial_end).getTime() - Date.now()) / 86400000);
                return (
                  <div key={o.id} className="text-xs text-yellow-200/70 flex gap-2">
                    <span className="font-semibold">{o.nombre}</span>
                    <span>—</span>
                    <span>{daysLeft === 0 ? 'vence hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}</span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Stripe placeholder */}
        <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center">
          <CreditCard className="h-6 w-6 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-semibold">Gestión de pagos Stripe</p>
          <p className="text-slate-600 text-xs mt-1">La integración con Stripe se configurará en la siguiente fase del proyecto.</p>
        </div>
      </div>
    </div>
  );
}
