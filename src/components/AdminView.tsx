/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ActivePage } from '../types';
import {
  getAdminOrgs, adminUpdateOrgPlan, adminSendPasswordReset, adminSetPassword,
  adminExtendTrial, adminCreateInstaller,
  AdminOrgRow, TradeSubscription,
} from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Users, CreditCard, TrendingUp, Clock, ArrowLeft, Search, RefreshCw,
  Shield, CheckCircle, AlertTriangle, Building2, ChevronDown,
  Mail, KeyRound, Copy, CheckCheck, UserPlus, CalendarPlus,
  FileText, Contact,
} from 'lucide-react';

const ADMIN_EMAIL = 'fercarboc@gmail.com';

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  basico: { monthly: 29, yearly: 23 },
  pro: { monthly: 49, yearly: 39 },
  empresa: { monthly: 89, yearly: 71 },
};

const OFICIOS = ['Fontanería', 'Electricidad', 'HVAC / Climatización', 'Construcción', 'Pintura', 'Carpintería', 'Cerrajería', 'Reformas', 'Otros'];

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
    onUpdate();
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

// ── Nuevo instalador — estado inicial del formulario ─────────────────────────
const EMPTY_NEW = {
  email: '',
  password: '',
  nombre: '',
  company_name: '',
  oficio: 'Fontanería',
  plan: 'pro' as TradeSubscription['plan'],
  billing_cycle: 'monthly' as TradeSubscription['billing_cycle'],
  telefono: '',
  trial_days: 90,
};

export default function AdminView({ setCurrentPage, session }: AdminViewProps) {
  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resetSent, setResetSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  // Modal: cambiar contraseña
  const [setPwdOrg, setSetPwdOrg] = useState<AdminOrgRow | null>(null);
  const [setPwdValue, setSetPwdValue] = useState('');
  const [setPwdLoading, setSetPwdLoading] = useState(false);
  const [setPwdError, setSetPwdError] = useState<string | null>(null);

  // Modal: extender prueba
  const [extendOrg, setExtendOrg] = useState<AdminOrgRow | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendLoading, setExtendLoading] = useState(false);

  // Modal: nuevo instalador
  const [showNewInstaller, setShowNewInstaller] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW });
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [newSuccess, setNewSuccess] = useState<string | null>(null);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSetPasswordSubmit = async () => {
    if (!setPwdOrg) return;
    if (setPwdValue.length < 8) { setSetPwdError('La contraseña debe tener al menos 8 caracteres'); return; }
    setSetPwdLoading(true);
    setSetPwdError(null);
    try {
      const target = setPwdOrg.owner_id ?? setPwdOrg.auth_email ?? setPwdOrg.email ?? '';
      await adminSetPassword(target, setPwdValue);
      setSetPwdOrg(null);
      setSetPwdValue('');
    } catch (e: unknown) {
      setSetPwdError(e instanceof Error ? e.message : String(e));
    } finally {
      setSetPwdLoading(false);
    }
  };

  const handleResetPassword = async (org: AdminOrgRow) => {
    const email = org.auth_email ?? org.email ?? '';
    if (!email) return;
    try {
      await adminSendPasswordReset(email);
      setResetSent(prev => new Set(prev).add(org.id));
    } catch (e: unknown) {
      alert('Error al enviar reset: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleExtendTrial = async () => {
    if (!extendOrg) return;
    setExtendLoading(true);
    try {
      await adminExtendTrial(extendOrg.id, extendDays);
      setExtendOrg(null);
      await loadOrgs();
    } catch (e: unknown) {
      alert('Error al extender prueba: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExtendLoading(false);
    }
  };

  const handleCreateInstaller = async () => {
    setNewError(null);
    setNewSuccess(null);
    if (!newForm.email || !newForm.password || !newForm.nombre) {
      setNewError('Email, contraseña y nombre son obligatorios');
      return;
    }
    setNewLoading(true);
    try {
      const result = await adminCreateInstaller({
        email: newForm.email,
        password: newForm.password,
        nombre: newForm.nombre,
        company_name: newForm.company_name || newForm.nombre,
        oficio: newForm.oficio,
        plan: newForm.plan,
        billing_cycle: newForm.billing_cycle,
        telefono: newForm.telefono || undefined,
        trial_days: newForm.trial_days,
      });
      setNewSuccess(`Instalador creado. ID: ${result.user_id}`);
      setNewForm({ ...EMPTY_NEW });
      await loadOrgs();
    } catch (e: unknown) {
      setNewError(e instanceof Error ? e.message : String(e));
    } finally {
      setNewLoading(false);
    }
  };

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

  // Stats
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
            onClick={() => { setShowNewInstaller(true); setNewError(null); setNewSuccess(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo instalador
          </button>
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
                  {['Empresa / Instalador', 'Email login', 'Oficio(s)', 'Uso', 'Plan', 'Estado', 'Último acceso', 'Alta', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" />
                      Cargando datos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center">
                      <Building2 className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No se encontraron registros</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(org => {
                    const sub = org.subscription;
                    const loginEmail = org.auth_email ?? org.email ?? '—';
                    const trialEnd = sub?.trial_end
                      ? new Date(sub.trial_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—';
                    const createdAt = new Date(org.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const lastSignIn = org.last_sign_in
                      ? new Date(org.last_sign_in).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : 'Nunca';
                    const isCopied = copied === loginEmail;
                    const isResetSent = resetSent.has(org.id);

                    return (
                      <tr key={org.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        {/* Empresa */}
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="font-semibold text-white text-sm truncate">{org.nombre}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {org.email_confirmed
                              ? <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                              : <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />}
                            <span className="text-[10px] text-slate-500">
                              {org.email_confirmed ? 'Email confirmado' : 'Sin confirmar'}
                            </span>
                          </div>
                        </td>

                        {/* Email login */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-300 font-mono truncate max-w-[160px]">{loginEmail}</span>
                            <button
                              onClick={() => handleCopyEmail(loginEmail)}
                              title="Copiar email"
                              className="shrink-0 text-slate-500 hover:text-white cursor-pointer transition-colors"
                            >
                              {isCopied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* Oficio */}
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs">{org.oficio || '—'}</span>
                        </td>

                        {/* Uso */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-slate-400" title="Presupuestos">
                              <FileText className="h-3 w-3 text-slate-500" />
                              {org.quotes_count ?? 0}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-400" title="Clientes">
                              <Contact className="h-3 w-3 text-slate-500" />
                              {org.clients_count ?? 0}
                            </span>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3">
                          <PlanSelect org={org} onUpdate={loadOrgs} />
                        </td>

                        {/* Estado suscripción */}
                        <td className="px-4 py-3">
                          <StatusBadge sub={sub} />
                          {sub?.status === 'trial' && (
                            <div className="text-[10px] text-yellow-300/70 mt-0.5">hasta {trialEnd}</div>
                          )}
                        </td>

                        {/* Último acceso */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{lastSignIn}</span>
                        </td>

                        {/* Alta */}
                        <td className="px-4 py-3">
                          <span className="text-slate-500 text-xs font-mono whitespace-nowrap">{createdAt}</span>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleResetPassword(org)}
                              disabled={isResetSent}
                              title="Enviar email de reset de contraseña"
                              className={`flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all border ${
                                isResetSent
                                  ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400 cursor-default'
                                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-blue-700 hover:border-blue-600 hover:text-white'
                              }`}
                            >
                              {isResetSent
                                ? <><CheckCheck className="h-3 w-3" /> Enviado</>
                                : <><KeyRound className="h-3 w-3" /> Reset</>}
                            </button>
                            <button
                              onClick={() => { setSetPwdOrg(org); setSetPwdValue(''); setSetPwdError(null); }}
                              title="Cambiar contraseña directamente"
                              className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all border bg-slate-700 border-slate-600 text-slate-300 hover:bg-purple-700 hover:border-purple-600 hover:text-white"
                            >
                              <KeyRound className="h-3 w-3" /> Pwd
                            </button>
                            {(sub?.status === 'trial' || sub?.status === 'expired') && (
                              <button
                                onClick={() => { setExtendOrg(org); setExtendDays(30); }}
                                title="Extender periodo de prueba"
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all border bg-slate-700 border-slate-600 text-slate-300 hover:bg-yellow-700 hover:border-yellow-600 hover:text-white"
                              >
                                <CalendarPlus className="h-3 w-3" /> +Trial
                              </button>
                            )}
                            <a
                              href={`mailto:${loginEmail}`}
                              title="Enviar email"
                              className="flex items-center justify-center h-7 w-7 rounded bg-slate-700 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          </div>
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

      {/* ── Modal: cambiar contraseña ─────────────────────────────────────────── */}
      {setPwdOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-base mb-1">Cambiar contraseña</h3>
            <p className="text-slate-400 text-xs mb-4">
              {setPwdOrg.nombre} · <span className="font-mono">{setPwdOrg.auth_email ?? setPwdOrg.email}</span>
            </p>
            <input
              type="password"
              value={setPwdValue}
              onChange={e => { setSetPwdValue(e.target.value); setSetPwdError(null); }}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSetPasswordSubmit()}
            />
            {setPwdError && <p className="text-red-400 text-xs mb-3">{setPwdError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setSetPwdOrg(null); setSetPwdValue(''); setSetPwdError(null); }}
                disabled={setPwdLoading}
                className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetPasswordSubmit}
                disabled={setPwdLoading || setPwdValue.length < 8}
                className="px-4 py-2 rounded text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default flex items-center gap-2"
              >
                {setPwdLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                {setPwdLoading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: extender prueba ────────────────────────────────────────────── */}
      {extendOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-base mb-1">Extender periodo de prueba</h3>
            <p className="text-slate-400 text-xs mb-4">
              {extendOrg.nombre} · vence {extendOrg.subscription?.trial_end
                ? new Date(extendOrg.subscription.trial_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
            </p>
            <div className="flex gap-2 mb-4">
              {[7, 15, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setExtendDays(d)}
                  className={`flex-1 py-2 rounded text-xs font-bold border cursor-pointer transition-all ${
                    extendDays === d
                      ? 'bg-yellow-600 border-yellow-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-yellow-600'
                  }`}
                >
                  +{d}d
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setExtendOrg(null)}
                disabled={extendLoading}
                className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={extendLoading}
                className="px-4 py-2 rounded text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {extendLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                {extendLoading ? 'Guardando…' : `Extender +${extendDays} días`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: nuevo instalador ───────────────────────────────────────────── */}
      {showNewInstaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-400" />
                <h3 className="text-white font-bold text-base">Nuevo instalador</h3>
              </div>
              <button
                onClick={() => { setShowNewInstaller(false); setNewError(null); setNewSuccess(null); setNewForm({ ...EMPTY_NEW }); }}
                className="text-slate-500 hover:text-white cursor-pointer transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {newSuccess ? (
                <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-300 font-semibold text-sm">Instalador creado con éxito</p>
                  <p className="text-slate-400 text-xs mt-1">{newSuccess}</p>
                  <button
                    onClick={() => { setNewSuccess(null); }}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    Crear otro instalador
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Email de acceso *</label>
                      <input
                        type="email"
                        value={newForm.email}
                        onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="instalador@empresa.com"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Contraseña inicial *</label>
                      <input
                        type="text"
                        value={newForm.password}
                        onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Mín. 8 caracteres"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre contacto *</label>
                      <input
                        type="text"
                        value={newForm.nombre}
                        onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Juan García"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre empresa</label>
                      <input
                        type="text"
                        value={newForm.company_name}
                        onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))}
                        placeholder="García Instalaciones"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={newForm.telefono}
                        onChange={e => setNewForm(f => ({ ...f, telefono: e.target.value }))}
                        placeholder="600 000 000"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Oficio *</label>
                      <div className="relative">
                        <select
                          value={newForm.oficio}
                          onChange={e => setNewForm(f => ({ ...f, oficio: e.target.value }))}
                          className="appearance-none w-full bg-slate-700 border border-slate-600 rounded px-3 pr-8 py-2 text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500"
                        >
                          {OFICIOS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Plan</label>
                      <div className="relative">
                        <select
                          value={newForm.plan}
                          onChange={e => setNewForm(f => ({ ...f, plan: e.target.value as TradeSubscription['plan'] }))}
                          className="appearance-none w-full bg-slate-700 border border-slate-600 rounded px-3 pr-8 py-2 text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500"
                        >
                          <option value="basico">Básico (29€/mes)</option>
                          <option value="pro">Pro (49€/mes)</option>
                          <option value="empresa">Empresa (89€/mes)</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Facturación</label>
                      <div className="relative">
                        <select
                          value={newForm.billing_cycle}
                          onChange={e => setNewForm(f => ({ ...f, billing_cycle: e.target.value as TradeSubscription['billing_cycle'] }))}
                          className="appearance-none w-full bg-slate-700 border border-slate-600 rounded px-3 pr-8 py-2 text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500"
                        >
                          <option value="monthly">Mensual</option>
                          <option value="yearly">Anual</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Días de prueba</label>
                      <div className="flex gap-1.5">
                        {[30, 60, 90].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setNewForm(f => ({ ...f, trial_days: d }))}
                            className={`flex-1 py-2 rounded text-xs font-bold border cursor-pointer transition-all ${
                              newForm.trial_days === d
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-blue-500'
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {newError && (
                    <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-xs">
                      {newError}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => { setShowNewInstaller(false); setNewError(null); setNewForm({ ...EMPTY_NEW }); }}
                      disabled={newLoading}
                      className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateInstaller}
                      disabled={newLoading}
                      className="px-5 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {newLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {newLoading ? 'Creando…' : 'Crear instalador'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
