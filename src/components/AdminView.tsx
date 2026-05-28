/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ActivePage } from '../types';
import {
  supabase,
  getAdminOrgs, adminUpdateOrgPlan, adminSendPasswordReset, adminSetPassword,
  adminExtendTrial, adminCreateInstaller, loadPlatformInvoices, setSubscriptionActive,
  getStripePortalUrl, getStripeCheckoutUrl,
  adminLoadWaitlist, adminUpdateWaitlistLead, adminDeleteWaitlistLead, adminConvertLeadToInstaller,
  adminLoadWeeklyQuotes,
  adminLoadCatalogSuggestions, adminUpdateCatalogSuggestion, adminApproveSuggestionToGlobal,
  AdminOrgRow, TradeSubscription, TradePlatformInvoice, TradeWaitlistLead,
  WaitlistEstado, WaitlistPrioridad, TradeCatalogSuggestion,
} from '../lib/supabase';
import { ADMIN_EMAIL } from '../lib/constants';
import { exportToCsv } from '../lib/exportCsv';
import { useToast, ToastContainer, ConfirmModal } from './ui/Toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Session } from '@supabase/supabase-js';
import {
  Users, CreditCard, TrendingUp, Clock, ArrowLeft, Search, RefreshCw,
  Shield, CheckCircle, AlertTriangle, Building2, ChevronDown,
  Mail, KeyRound, Copy, CheckCheck, UserPlus, CalendarPlus,
  FileText, Contact, Phone, MessageCircle, Star, Trash2, UserCheck,
  Inbox, Filter, LogOut, Download, WifiOff, Globe, ThumbsUp, ThumbsDown,
} from 'lucide-react';

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  basico: { monthly: 29, yearly: 23 },
  pro: { monthly: 49, yearly: 39 },
  empresa: { monthly: 89, yearly: 71 },
};

const OFICIOS = ['Fontanería', 'Electricidad', 'HVAC / Climatización', 'Construcción', 'Pintura', 'Carpintería', 'Cerrajería', 'Reformas', 'Otros'];

const ESTADO_CFG: Record<WaitlistEstado, { label: string; cls: string }> = {
  nuevo:      { label: 'Nuevo',      cls: 'bg-blue-900/40 text-blue-300 border-blue-800' },
  contactado: { label: 'Contactado', cls: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  interesado: { label: 'Interesado', cls: 'bg-purple-900/40 text-purple-300 border-purple-800' },
  beta_activa:{ label: 'Beta activa',cls: 'bg-cyan-900/40 text-cyan-300 border-cyan-800' },
  convertido: { label: 'Convertido', cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' },
  descartado: { label: 'Descartado', cls: 'bg-slate-700 text-slate-400 border-slate-600' },
};

const PRIORIDAD_CFG: Record<WaitlistPrioridad, { label: string; cls: string }> = {
  alta:  { label: '🔴 Alta',  cls: 'bg-red-900/40 text-red-300 border-red-800' },
  media: { label: '🟡 Media', cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' },
  baja:  { label: '⚪ Baja',  cls: 'bg-slate-700 text-slate-400 border-slate-600' },
};

// ── Top-level helper components ────────────────────────────────────────────

function StatusBadge({ sub }: { sub?: TradeSubscription }) {
  if (!sub) return <span className="text-xs text-slate-500">—</span>;
  const cfg = {
    trial:     { cls: 'bg-blue-900/40 text-blue-300 border-blue-800',       label: 'Prueba' },
    active:    { cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800', label: 'Activo' },
    cancelled: { cls: 'bg-red-900/40 text-red-300 border-red-800',           label: 'Cancelado' },
    expired:   { cls: 'bg-slate-700 text-slate-400 border-slate-600',        label: 'Expirado' },
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

// ── Modal: cambiar contraseña (top-level, evita re-mount en typing) ──────────
interface SetPwdModalProps {
  org: AdminOrgRow;
  onClose: () => void;
  onSave: (pwd: string) => Promise<void>;
}
function SetPwdModal({ org, onClose, onSave }: SetPwdModalProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (value.length < 8) { setError('Mínimo 8 caracteres'); return; }
    setLoading(true);
    setError(null);
    try { await onSave(value); onClose(); } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1">Cambiar contraseña</h3>
        <p className="text-slate-400 text-xs mb-4">{org.nombre} · <span className="font-mono">{org.auth_email ?? org.email}</span></p>
        <input type="password" value={value} onChange={e => { setValue(e.target.value); setError(null); }}
          placeholder="Nueva contraseña (mín. 8 caracteres)"
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
          autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={handleSave} disabled={loading || value.length < 8}
            className="px-4 py-2 rounded text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: extender prueba (top-level) ────────────────────────────────────────
interface ExtendTrialModalProps {
  org: AdminOrgRow;
  onClose: () => void;
  onSave: (days: number) => Promise<void>;
  onError?: (msg: string) => void;
}
function ExtendTrialModal({ org, onClose, onSave, onError }: ExtendTrialModalProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    try { await onSave(days); onClose(); } catch (e: unknown) { onError?.(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1">Extender periodo de prueba</h3>
        <p className="text-slate-400 text-xs mb-4">{org.nombre}</p>
        <div className="flex items-center gap-3 mb-4">
          <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))}
            className="w-24 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <span className="text-slate-400 text-sm">días adicionales</span>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 rounded text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            {loading ? 'Guardando…' : 'Extender'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: nuevo instalador (top-level) ───────────────────────────────────────
const EMPTY_NEW = {
  email: '', password: '', nombre: '', company_name: '',
  oficio: 'Fontanería', plan: 'pro' as TradeSubscription['plan'],
  billing_cycle: 'monthly' as TradeSubscription['billing_cycle'],
  telefono: '', trial_days: 90,
};

interface NewInstallerModalProps {
  initialData?: Partial<typeof EMPTY_NEW>;
  onClose: () => void;
  onCreated: () => void;
}
function NewInstallerModal({ initialData, onClose, onCreated }: NewInstallerModalProps) {
  const [form, setForm] = useState({ ...EMPTY_NEW, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  const set = (k: keyof typeof EMPTY_NEW, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    setError(null); setSuccess(null); setEmailExists(false);
    if (!form.email || !form.password || !form.nombre) { setError('Email, contraseña y nombre son obligatorios'); return; }
    setLoading(true);
    try {
      const result = await adminCreateInstaller({
        email: form.email, password: form.password,
        nombre: form.nombre, company_name: form.company_name || form.nombre,
        oficio: form.oficio, plan: form.plan, billing_cycle: form.billing_cycle,
        telefono: form.telefono || undefined, trial_days: form.trial_days,
      });
      setSuccess(`Instalador creado · ID: ${result.user_id}`);
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isExisting = /already registered|already exists|ya existe|duplicate/i.test(msg);
      setEmailExists(isExisting);
      setError(isExisting
        ? `El email ${form.email} ya tiene una cuenta registrada. Puedes extender su trial o cambiar el plan desde la pestaña Clientes.`
        : msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500';
  const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-blue-400" /> Nuevo instalador
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan García" className={inputCls} /></div>
            <div><label className={labelCls}>Empresa</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Fontanería García" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Email *</label>
            <input type="email" value={form.email} onChange={e => { set('email', e.target.value); setEmailExists(false); setError(null); }} placeholder="instalador@email.com" className={`${inputCls} ${emailExists ? 'border-orange-500' : ''}`} /></div>
          <div><label className={labelCls}>Contraseña *</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mín. 8 caracteres" className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="612 345 678" className={inputCls} /></div>
            <div><label className={labelCls}>Oficio</label>
              <select value={form.oficio} onChange={e => set('oficio', e.target.value)} className={inputCls}>
                {OFICIOS.map(o => <option key={o}>{o}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Plan</label>
              <select value={form.plan} onChange={e => set('plan', e.target.value)} className={inputCls}>
                <option value="basico">Básico</option>
                <option value="pro">Pro</option>
                <option value="empresa">Empresa</option>
              </select></div>
            <div><label className={labelCls}>Ciclo</label>
              <select value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value)} className={inputCls}>
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </select></div>
            <div><label className={labelCls}>Días trial</label>
              <input type="number" min={1} max={365} value={form.trial_days} onChange={e => set('trial_days', Number(e.target.value))} className={inputCls} /></div>
          </div>
        </div>
        {error && (
          <div className={`mt-4 rounded-lg p-3 text-xs leading-relaxed ${emailExists ? 'bg-orange-900/30 border border-orange-700 text-orange-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {emailExists && <p className="font-bold mb-1">⚠ Email ya registrado</p>}
            {error}
          </div>
        )}
        {success && <div className="mt-4 bg-emerald-900/30 border border-emerald-700 text-emerald-300 rounded-lg p-3 text-xs">{success}</div>}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={handleCreate} disabled={loading}
            className="px-4 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            {loading ? 'Creando…' : 'Crear instalador'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: nota interna de lead (top-level — tiene textarea controlado) ───────
interface LeadNoteModalProps {
  lead: TradeWaitlistLead;
  onClose: () => void;
  onSave: (id: string, nota: string) => Promise<void>;
  onError?: (msg: string) => void;
}
function LeadNoteModal({ lead, onClose, onSave, onError }: LeadNoteModalProps) {
  const [nota, setNota] = useState(lead.notas ?? '');
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    try { await onSave(lead.id, nota); onClose(); }
    catch (e: unknown) { onError?.(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1">Nota interna</h3>
        <p className="text-slate-400 text-xs mb-3">{lead.nombre} · {lead.email}</p>
        <textarea rows={5} value={nota} onChange={e => setNota(e.target.value)}
          placeholder="Escribe aquí tu nota sobre este lead..."
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none mb-4"
          autoFocus />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: convertir lead en instalador (top-level) ───────────────────────────
interface LeadConvertModalProps {
  lead: TradeWaitlistLead;
  onClose: () => void;
  onConverted: () => void;
}
function LeadConvertModal({ lead, onClose, onConverted }: LeadConvertModalProps) {
  const [form, setForm] = useState({
    email: lead.email,
    password: '',
    plan: 'pro' as TradeSubscription['plan'],
    billing_cycle: 'monthly' as TradeSubscription['billing_cycle'],
    trial_days: 90,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleConvert = async () => {
    setError(null); setEmailExists(false);
    if (!form.password) { setError('La contraseña es obligatoria'); return; }
    setLoading(true);
    try {
      await adminConvertLeadToInstaller(lead, form);
      onConverted();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isExisting = /already registered|already exists|ya existe|duplicate/i.test(msg);
      setEmailExists(isExisting);
      setError(isExisting
        ? `El email ${form.email} ya tiene cuenta. Ve a la pestaña Clientes para extender su trial o cambiar el plan.`
        : msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500';
  const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-400" /> Convertir en instalador
        </h3>
        <p className="text-slate-400 text-xs mb-4">{lead.nombre} · {lead.telefono ?? ''}</p>
        <div className="space-y-3">
          <div><label className={labelCls}>Email de acceso</label>
            <input type="email" value={form.email} onChange={e => { set('email', e.target.value); setEmailExists(false); setError(null); }}
              className={`${inputCls} ${emailExists ? 'border-orange-500' : ''}`} /></div>
          <div><label className={labelCls}>Contraseña *</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mín. 8 caracteres" className={inputCls} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>Plan</label>
              <select value={form.plan} onChange={e => set('plan', e.target.value as TradeSubscription['plan'])} className={inputCls}>
                <option value="basico">Básico</option>
                <option value="pro">Pro</option>
                <option value="empresa">Empresa</option>
              </select></div>
            <div><label className={labelCls}>Ciclo</label>
              <select value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value as TradeSubscription['billing_cycle'])} className={inputCls}>
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </select></div>
            <div><label className={labelCls}>Días trial</label>
              <input type="number" min={1} max={365} value={form.trial_days} onChange={e => set('trial_days', Number(e.target.value))} className={inputCls} /></div>
          </div>
        </div>
        {error && (
          <div className={`mt-3 rounded-lg p-3 text-xs leading-relaxed ${emailExists ? 'bg-orange-900/30 border border-orange-700 text-orange-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {emailExists && <p className="font-bold mb-1">⚠ Email ya registrado</p>}
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
          <button onClick={handleConvert} disabled={loading}
            className="px-4 py-2 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            {loading ? 'Convirtiendo…' : 'Crear cuenta instalador'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface AdminViewProps {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

export default function AdminView({ setCurrentPage, session }: AdminViewProps) {

  // ── Clientes / orgs ────────────────────────────────────────────────────
  const [orgs, setOrgs]               = useState<AdminOrgRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resetSent, setResetSent]     = useState<Set<string>>(new Set());
  const [copied, setCopied]           = useState<string | null>(null);

  // Modales clientes
  const [setPwdOrg, setSetPwdOrg]     = useState<AdminOrgRow | null>(null);
  const [extendOrg, setExtendOrg]     = useState<AdminOrgRow | null>(null);
  const [showNewInstaller, setShowNewInstaller] = useState(false);

  // Sección activa
  const [section, setSection] = useState<'dashboard' | 'orgs' | 'leads' | 'invoices' | 'suggestions'>('dashboard');

  // Dashboard — datos de gráficos
  const [weeklyQuotes, setWeeklyQuotes] = useState<Array<{ week: string; count: number }>>([]);
  const [weeklyQuotesLoading, setWeeklyQuotesLoading] = useState(false);

  // Platform invoices
  const [invoices, setInvoices]           = useState<TradePlatformInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [toggleLoading, setToggleLoading]   = useState<string | null>(null);

  // Stripe
  const [stripeLoading, setStripeLoading]   = useState<string | null>(null);
  const [checkoutCopied, setCheckoutCopied] = useState<string | null>(null);

  // ── Leads / CRM ────────────────────────────────────────────────────────
  const [leads, setLeads]                 = useState<TradeWaitlistLead[]>([]);
  const [leadsLoading, setLeadsLoading]   = useState(false);
  const [leadsSearch, setLeadsSearch]     = useState('');
  const [leadsEstado, setLeadsEstado]     = useState<string>('todos');
  const [leadsOficio, setLeadsOficio]     = useState<string>('todos');
  const [leadsPrioridad, setLeadsPrioridad] = useState<string>('todos');
  const [noteModal, setNoteModal]         = useState<TradeWaitlistLead | null>(null);
  const [convertModal, setConvertModal]   = useState<TradeWaitlistLead | null>(null);
  const [leadFromConvert, setLeadFromConvert] = useState<Partial<typeof EMPTY_NEW> | undefined>(undefined);
  const [copiedField, setCopiedField]     = useState<string | null>(null);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const { toasts, toast, dismiss } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<TradeWaitlistLead | null>(null);

  // ── Load functions ─────────────────────────────────────────────────────
  const loadOrgs = async () => {
    setLoading(true);
    const data = await getAdminOrgs();
    setOrgs(data);
    setLoading(false);
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    try { setLeads(await adminLoadWaitlist()); }
    catch { setLeads([]); }
    finally { setLeadsLoading(false); }
  };

  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try { setInvoices(await loadPlatformInvoices()); }
    catch { setInvoices([]); }
    finally { setInvoicesLoading(false); }
  };

  const loadWeeklyQuotes = async () => {
    setWeeklyQuotesLoading(true);
    try { setWeeklyQuotes(await adminLoadWeeklyQuotes()); }
    catch { setWeeklyQuotes([]); }
    finally { setWeeklyQuotesLoading(false); }
  };

  useEffect(() => { if (isAdmin) { loadOrgs(); loadWeeklyQuotes(); } }, [isAdmin]);
  useEffect(() => { if (isAdmin && section === 'leads') loadLeads(); }, [isAdmin, section]);
  useEffect(() => { if (isAdmin && section === 'invoices') loadInvoices(); }, [isAdmin, section]);

  // ── Handlers — clientes ────────────────────────────────────────────────
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleResetPassword = async (org: AdminOrgRow) => {
    const email = org.auth_email ?? org.email ?? '';
    if (!email) return;
    try { await adminSendPasswordReset(email); setResetSent(prev => new Set(prev).add(org.id)); toast('success', `Email de reset enviado a ${email}`); }
    catch (e: unknown) { toast('error', 'Error al enviar reset: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const handleToggleSubscription = async (org: AdminOrgRow) => {
    const isActive = org.subscription?.status === 'active';
    setToggleLoading(org.id);
    try { await setSubscriptionActive(org.id, !isActive); await loadOrgs(); toast('success', `Suscripción ${isActive ? 'desactivada' : 'activada'}`); }
    catch (e: unknown) { toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setToggleLoading(null); }
  };

  const handleOpenPortal = async (org: AdminOrgRow) => {
    setStripeLoading(`portal-${org.id}`);
    try { window.open(await getStripePortalUrl(org.id), '_blank', 'noopener'); }
    catch (e: unknown) { toast('error', 'Error portal Stripe: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setStripeLoading(null); }
  };

  const handleCopyCheckout = async (org: AdminOrgRow) => {
    setStripeLoading(`checkout-${org.id}`);
    try {
      const url = await getStripeCheckoutUrl(org.id);
      await navigator.clipboard.writeText(url);
      setCheckoutCopied(org.id);
      setTimeout(() => setCheckoutCopied(null), 3000);
    } catch (e: unknown) { toast('error', 'Error checkout Stripe: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setStripeLoading(null); }
  };

  // ── Handlers — leads ───────────────────────────────────────────────────
  const handleCopyField = (val: string, key: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleWhatsApp = (lead: TradeWaitlistLead) => {
    const phone = (lead.telefono ?? '').replace(/\D/g, '');
    if (!phone) { toast('warning', 'Este lead no tiene teléfono registrado'); return; }
    const msg = encodeURIComponent(
      `Hola ${lead.nombre.split(' ')[0]}, soy Fernando de TrabFlow. Vi que solicitaste acceso a nuestra plataforma para instaladores. ¿Te parece si te comento cómo funciona? 👷`
    );
    window.open(`https://wa.me/${phone.startsWith('34') ? phone : '34' + phone}?text=${msg}`, '_blank', 'noopener');
  };

  const handleLeadEstado = async (lead: TradeWaitlistLead, estado: WaitlistEstado) => {
    const updates: Parameters<typeof adminUpdateWaitlistLead>[1] = { estado };
    if (estado === 'contactado' && !lead.contacted_at) updates.contacted_at = new Date().toISOString();
    try { await adminUpdateWaitlistLead(lead.id, updates); setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l)); }
    catch (e: unknown) { toast('error', 'Error al actualizar estado: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const handleLeadPrioridad = async (lead: TradeWaitlistLead, prioridad: WaitlistPrioridad) => {
    try { await adminUpdateWaitlistLead(lead.id, { prioridad }); setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, prioridad } : l)); }
    catch (e: unknown) { toast('error', 'Error al actualizar prioridad: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const handleSaveNote = async (id: string, notas: string) => {
    await adminUpdateWaitlistLead(id, { notas });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notas } : l));
  };

  const handleDeleteLead = (lead: TradeWaitlistLead) => {
    setConfirmDelete(lead);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const lead = confirmDelete;
    setConfirmDelete(null);
    try { await adminDeleteWaitlistLead(lead.id); setLeads(prev => prev.filter(l => l.id !== lead.id)); toast('success', `Lead de ${lead.nombre} eliminado`); }
    catch (e: unknown) { toast('error', 'Error al eliminar: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const handleOpenConvert = (lead: TradeWaitlistLead) => {
    setConvertModal(lead);
  };

  // ── Guard ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Acceso denegado</h2>
          <p className="text-slate-400 text-sm mb-6">No tienes permisos de administrador.</p>
          <button onClick={() => setCurrentPage(ActivePage.Home)} className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer transition-colors">← Volver a la web</button>
        </div>
      </div>
    );
  }

  // ── Exportaciones ──────────────────────────────────────────────────────
  const handleExportClients = () => {
    const rows = filteredOrgs.map(o => ({
      Nombre: o.nombre,
      Email: o.auth_email ?? o.email ?? '',
      Oficio: o.oficio ?? '',
      Plan: o.subscription?.plan ?? '',
      Estado: o.subscription?.status ?? '',
      'Fecha alta': new Date(o.created_at).toLocaleDateString('es-ES'),
      'Último acceso': o.last_sign_in ? new Date(o.last_sign_in).toLocaleDateString('es-ES') : 'Nunca',
      'Último presupuesto': o.last_quote_at ? new Date(o.last_quote_at).toLocaleDateString('es-ES') : 'Nunca',
      Presupuestos: o.quotes_count ?? 0,
      Clientes: o.clients_count ?? 0,
      'Email confirmado': o.email_confirmed ? 'Sí' : 'No',
    }));
    exportToCsv(rows, `tradeflow_clientes_${new Date().toISOString().slice(0, 10)}`);
  };

  const handleExportLeads = () => {
    const rows = filteredLeads.map(l => ({
      Nombre: l.nombre,
      Email: l.email,
      Teléfono: l.telefono ?? '',
      Oficio: l.oficio ?? '',
      Ciudad: l.ciudad ?? '',
      'Presup./mes': l.presupuestos_al_mes ?? '',
      Estado: l.estado,
      Prioridad: l.prioridad,
      Fuente: l.fuente ?? '',
      'Fecha alta': new Date(l.created_at).toLocaleDateString('es-ES'),
      Notas: l.notas ?? '',
    }));
    exportToCsv(rows, `tradeflow_leads_${new Date().toISOString().slice(0, 10)}`);
  };

  // ── Stats clientes ──────────────────────────────────────────────────────
  const totalOrgs = orgs.length;
  const trialing  = orgs.filter(o => o.subscription?.status === 'trial').length;
  const active    = orgs.filter(o => o.subscription?.status === 'active').length;
  const mrr = orgs
    .filter(o => o.subscription?.status === 'active')
    .reduce((sum, o) => {
      const sub = o.subscription!;
      const prices = PLAN_PRICES[sub.plan] ?? PLAN_PRICES.pro;
      return sum + (sub.billing_cycle === 'monthly' ? prices.monthly : prices.yearly);
    }, 0);

  const filteredOrgs = orgs.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.nombre.toLowerCase().includes(q) || (o.email ?? '').toLowerCase().includes(q) || (o.oficio ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.subscription?.status === statusFilter || (!o.subscription && statusFilter === 'none');
    return matchSearch && matchStatus;
  });

  // ── Stats leads ────────────────────────────────────────────────────────
  const totalLeads    = leads.length;
  const nuevosLeads   = leads.filter(l => l.estado === 'nuevo').length;
  const contactados   = leads.filter(l => l.estado === 'contactado').length;
  const betaActiva    = leads.filter(l => l.estado === 'beta_activa').length;
  const convertidos   = leads.filter(l => l.estado === 'convertido').length;
  const tasaBeta      = totalLeads ? Math.round((betaActiva + convertidos) / totalLeads * 100) : 0;
  const tasaConv      = (betaActiva + convertidos) ? Math.round(convertidos / (betaActiva + convertidos) * 100) : 0;

  const filteredLeads = leads.filter(l => {
    const q = leadsSearch.toLowerCase();
    const matchSearch = !q || l.nombre.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.telefono ?? '').includes(q);
    const matchEstado    = leadsEstado === 'todos' || l.estado === leadsEstado;
    const matchOficio    = leadsOficio === 'todos' || l.oficio === leadsOficio;
    const matchPrioridad = leadsPrioridad === 'todos' || l.prioridad === leadsPrioridad;
    return matchSearch && matchEstado && matchOficio && matchPrioridad;
  });

  const arr  = mrr * 12;
  const arpu = active > 0 ? Math.round(mrr / active) : 0;
  const inactive30 = orgs.filter(o => {
    if (!o.last_sign_in) return true;
    return (Date.now() - new Date(o.last_sign_in).getTime()) > 30 * 86400000;
  }).length;
  const trialToPaidPct = (betaActiva + convertidos) > 0
    ? Math.round(convertidos / (betaActiva + convertidos) * 100)
    : 0;

  // Altas por mes — últimos 12 meses
  const monthlySignups = (() => {
    const map = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      map.set(d.toISOString().slice(0, 7), 0);
    }
    for (const org of orgs) {
      const key = org.created_at.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([month, count]) => ({
      month: month.slice(5), count,
    }));
  })();

  const STATS = [
    { label: 'Total clientes', value: totalOrgs, Icon: Users,      color: 'text-blue-400' },
    { label: 'En prueba',      value: trialing,  Icon: Clock,      color: 'text-yellow-400' },
    { label: 'Activos (pago)', value: active,    Icon: CheckCircle,color: 'text-emerald-400' },
    { label: 'MRR estimado',   value: `${mrr}€`, Icon: TrendingUp, color: 'text-purple-400' },
  ];

  // ── NAV items ──────────────────────────────────────────────────────────
  const NAV = [
    { id: 'dashboard' as const, label: 'Dashboard',          Icon: TrendingUp },
    { id: 'orgs'      as const, label: 'Clientes',           Icon: Users },
    { id: 'leads'     as const, label: 'Leads beta',         Icon: Inbox,    badge: nuevosLeads },
    { id: 'invoices'  as const, label: 'Facturación',        Icon: CreditCard },
  ];

  const reloadCurrent = () => {
    if (section === 'leads') loadLeads();
    else if (section === 'invoices') loadInvoices();
    else { loadOrgs(); loadWeeklyQuotes(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">

      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage(ActivePage.Home)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs cursor-pointer transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a la web
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-sm uppercase tracking-wider text-white">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:block">{session?.user?.email}</span>
          <button onClick={() => { setShowNewInstaller(true); setLeadFromConvert(undefined); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors">
            <UserPlus className="h-3.5 w-3.5" /> Nuevo instalador
          </button>
          <button onClick={reloadCurrent} title="Recargar"
            className="h-8 w-8 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-800 cursor-pointer transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${(loading || leadsLoading || weeklyQuotesLoading) ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); setCurrentPage(ActivePage.Home); }}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white hover:border-red-700 hover:bg-red-900/20 cursor-pointer transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-slate-800 bg-slate-900/80 py-4 px-2">
          <nav className="flex flex-col gap-0.5 flex-1">
            {NAV.map(({ id, label, Icon, badge }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                  section === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge != null && badge > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="px-3 pt-4 border-t border-slate-800 mt-4">
            <p className="text-[10px] text-slate-500 truncate mb-2">{session?.user?.email}</p>
            <button onClick={async () => { await supabase.auth.signOut(); setCurrentPage(ActivePage.Home); }}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 cursor-pointer transition-colors w-full">
              <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Mobile tabs (solo visible en < md) */}
        <div className="md:hidden flex gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900 overflow-x-auto">
          {NAV.map(({ id, label, Icon, badge }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                section === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              <Icon className="h-3 w-3" /> {label}
              {badge != null && badge > 0 && (
                <span className="bg-red-600 text-white text-[9px] font-black px-1 py-0.5 rounded-full">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-5 py-6">

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: DASHBOARD
        ════════════════════════════════════════════════════════ */}
        {section === 'dashboard' && (
          <div className="space-y-6">

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'MRR',             value: `${mrr}€`,        color: 'text-purple-400',  Icon: TrendingUp },
                { label: 'ARR',             value: `${arr}€`,        color: 'text-purple-300',  Icon: TrendingUp },
                { label: 'ARPU',            value: `${arpu}€`,       color: 'text-blue-400',    Icon: Users },
                { label: 'Activos pago',    value: active,           color: 'text-emerald-400', Icon: CheckCircle },
                { label: 'En trial',        value: trialing,         color: 'text-yellow-400',  Icon: Clock },
                { label: 'Sin actividad 30d', value: inactive30,     color: inactive30 > 0 ? 'text-red-400' : 'text-slate-400', Icon: WifiOff },
              ].map(({ label, value, color, Icon }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Segunda fila KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total clientes',  value: totalOrgs,           color: 'text-slate-300' },
                { label: 'Trial → pago %',  value: `${trialToPaidPct}%`,color: 'text-pink-400' },
                { label: 'Leads nuevos',    value: nuevosLeads,         color: 'text-blue-400' },
                { label: 'Leads convertidos', value: convertidos,       color: 'text-emerald-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Altas por mes */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Altas por mes (12 meses)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlySignups} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Altas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Presupuestos por semana */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Presupuestos por semana (8 semanas)</h3>
                {weeklyQuotesLoading ? (
                  <div className="h-[180px] flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-slate-500 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weeklyQuotes} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2}
                        dot={{ fill: '#10b981', r: 3 }} name="Presupuestos" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Trials urgentes */}
            {orgs.some(o => {
              if (o.subscription?.status !== 'trial') return false;
              return Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000) <= 7;
            }) && (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-yellow-300 font-semibold text-sm">Trials próximos a vencer</span>
                </div>
                <div className="space-y-1.5">
                  {orgs.filter(o => {
                    if (o.subscription?.status !== 'trial') return false;
                    return Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000) <= 7;
                  }).map(o => {
                    const d = Math.ceil((new Date(o.subscription!.trial_end).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={o.id} className="flex items-center gap-3">
                        <span className="text-xs text-yellow-200/80 font-semibold w-40 truncate">{o.nombre}</span>
                        <span className="text-xs text-yellow-300/60">{d <= 0 ? 'Vence hoy' : `${d} día${d !== 1 ? 's' : ''}`}</span>
                        <button onClick={() => setExtendOrg(o)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-700/50 border border-yellow-700 text-yellow-200 hover:bg-yellow-600 cursor-pointer transition-colors">
                          <CalendarPlus className="h-3 w-3" /> Extender
                        </button>
                        <button onClick={() => setSection('orgs')}
                          className="text-[10px] text-slate-400 hover:text-white cursor-pointer transition-colors">
                          Ver →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: CLIENTES
        ════════════════════════════════════════════════════════ */}
        {section === 'orgs' && (<>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input type="text" placeholder="Buscar nombre, email u oficio..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
              <option value="all">Todos los estados</option>
              <option value="trial">En prueba</option>
              <option value="active">Activos</option>
              <option value="cancelled">Cancelados</option>
              <option value="expired">Expirados</option>
            </select>
            <span className="text-xs text-slate-500 ml-auto">{filteredOrgs.length} registros</span>
            <button onClick={handleExportClients} title="Exportar CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white hover:border-emerald-700 hover:bg-emerald-900/20 cursor-pointer transition-colors">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Empresa / Instalador', 'Email login', 'Oficio(s)', 'Uso', 'Últ. presup.', 'Plan', 'Estado', 'Último acceso', 'Alta', 'Acciones'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando datos...
                    </td></tr>
                  ) : filteredOrgs.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center">
                      <Building2 className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No se encontraron registros</p>
                    </td></tr>
                  ) : filteredOrgs.map(org => {
                    const sub        = org.subscription;
                    const loginEmail = org.auth_email ?? org.email ?? '—';
                    const trialEnd   = sub?.trial_end ? new Date(sub.trial_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                    const createdAt  = new Date(org.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const lastSignIn = org.last_sign_in ? new Date(org.last_sign_in).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca';
                    const isCopied   = copied === loginEmail;
                    const isResetSent = resetSent.has(org.id);

                    return (
                      <tr key={org.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <td className="px-3 py-1.5 max-w-[180px]">
                          <div className="font-semibold text-white text-xs truncate">{org.nombre}</div>
                          <div className="flex items-center gap-1">
                            {org.email_confirmed
                              ? <CheckCircle className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                              : <AlertTriangle className="h-2.5 w-2.5 text-yellow-400 shrink-0" />}
                            <span className="text-[9px] text-slate-500">{org.email_confirmed ? 'Confirmado' : 'Sin confirmar'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 max-w-[200px]">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-300 font-mono truncate max-w-[150px]">{loginEmail}</span>
                            <button onClick={() => handleCopyEmail(loginEmail)} title="Copiar email" className="shrink-0 text-slate-500 hover:text-white cursor-pointer">
                              {isCopied ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-1.5"><span className="text-slate-300 text-xs">{org.oficio || '—'}</span></td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5 text-xs text-slate-400" title="Presupuestos"><FileText className="h-3 w-3 text-slate-500" />{org.quotes_count ?? 0}</span>
                            <span className="flex items-center gap-0.5 text-xs text-slate-400" title="Clientes"><Contact className="h-3 w-3 text-slate-500" />{org.clients_count ?? 0}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          {(() => {
                            const daysSinceLogin = org.last_sign_in
                              ? Math.floor((Date.now() - new Date(org.last_sign_in).getTime()) / 86400000)
                              : null;
                            const lastQuote = org.last_quote_at
                              ? new Date(org.last_quote_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                              : null;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                  {lastQuote ?? <span className="text-slate-600 italic">Ninguno</span>}
                                </span>
                                {(daysSinceLogin === null || daysSinceLogin > 30) && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1 py-px rounded bg-red-900/30 border border-red-800 text-red-400 w-fit">
                                    <WifiOff className="h-2 w-2" />
                                    {daysSinceLogin === null ? 'Nunca' : `${daysSinceLogin}d`}
                                  </span>
                                )}
                                {daysSinceLogin !== null && daysSinceLogin > 15 && daysSinceLogin <= 30 && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1 py-px rounded bg-yellow-900/30 border border-yellow-800 text-yellow-400 w-fit">
                                    <WifiOff className="h-2 w-2" />{daysSinceLogin}d
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-1.5"><PlanSelect org={org} onUpdate={loadOrgs} /></td>
                        <td className="px-3 py-1.5">
                          <StatusBadge sub={sub} />
                          {sub?.status === 'trial' && <div className="text-[9px] text-yellow-300/70">hasta {trialEnd}</div>}
                        </td>
                        <td className="px-3 py-1.5"><span className="text-xs text-slate-400 font-mono whitespace-nowrap">{lastSignIn}</span></td>
                        <td className="px-3 py-1.5"><span className="text-slate-500 text-xs font-mono whitespace-nowrap">{createdAt}</span></td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button onClick={() => handleResetPassword(org)} disabled={isResetSent} title="Reset contraseña"
                              className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer transition-all border ${isResetSent ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-blue-700 hover:border-blue-600 hover:text-white'}`}>
                              {isResetSent ? <><CheckCheck className="h-2.5 w-2.5" /> OK</> : <><KeyRound className="h-2.5 w-2.5" /> Reset</>}
                            </button>
                            <button onClick={() => setSetPwdOrg(org)} title="Cambiar contraseña"
                              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-purple-700 hover:border-purple-600 hover:text-white">
                              <KeyRound className="h-2.5 w-2.5" /> Pwd
                            </button>
                            {(sub?.status === 'trial' || sub?.status === 'expired') && (
                              <button onClick={() => setExtendOrg(org)} title="Extender trial"
                                className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-yellow-700 hover:border-yellow-600 hover:text-white">
                                <CalendarPlus className="h-2.5 w-2.5" /> +Trial
                              </button>
                            )}
                            <button onClick={() => handleToggleSubscription(org)} disabled={toggleLoading === org.id} title={sub?.status === 'active' ? 'Desactivar' : 'Activar'}
                              className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border disabled:opacity-50 ${sub?.status === 'active' ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-emerald-900/40 hover:border-emerald-700 hover:text-emerald-300'}`}>
                              {toggleLoading === org.id ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : sub?.status === 'active' ? <><CheckCircle className="h-2.5 w-2.5" /> ON</> : <><CheckCircle className="h-2.5 w-2.5" /> OFF</>}
                            </button>
                            <button onClick={() => handleCopyCheckout(org)} disabled={stripeLoading === `checkout-${org.id}`} title="Copiar link de pago"
                              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-violet-700 hover:border-violet-600 hover:text-white disabled:opacity-50">
                              {stripeLoading === `checkout-${org.id}` ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : checkoutCopied === org.id ? <><CheckCheck className="h-2.5 w-2.5 text-emerald-400" /> OK</> : <><CreditCard className="h-2.5 w-2.5" /> Link</>}
                            </button>
                            {org.subscription?.stripe_customer_id && (
                              <button onClick={() => handleOpenPortal(org)} disabled={stripeLoading === `portal-${org.id}`} title="Portal Stripe"
                                className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-indigo-700 hover:border-indigo-600 hover:text-white disabled:opacity-50">
                                {stripeLoading === `portal-${org.id}` ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <><CreditCard className="h-2.5 w-2.5" /> Portal</>}
                              </button>
                            )}
                            <a href={`mailto:${loginEmail}`} title="Enviar email"
                              className="flex items-center justify-center h-6 w-6 rounded bg-slate-700 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors">
                              <Mail className="h-3 w-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alertas trial próximo a vencer */}
          {orgs.some(o => {
            if (o.subscription?.status !== 'trial') return false;
            return Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000) <= 7;
          }) && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-300 font-semibold text-sm">Pruebas próximas a vencer</span>
              </div>
              {orgs.filter(o => {
                if (o.subscription?.status !== 'trial') return false;
                return Math.ceil((new Date(o.subscription.trial_end).getTime() - Date.now()) / 86400000) <= 7;
              }).map(o => {
                const d = Math.ceil((new Date(o.subscription!.trial_end).getTime() - Date.now()) / 86400000);
                return (
                  <div key={o.id} className="text-xs text-yellow-200/70 flex gap-2">
                    <span className="font-semibold">{o.nombre}</span>
                    <span>—</span>
                    <span>{d === 0 ? 'vence hoy' : `${d} día${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>)}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: SOLICITUDES BETA (CRM)
        ════════════════════════════════════════════════════════ */}
        {section === 'leads' && (<>

          {/* Métricas CRM */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total leads',      value: totalLeads,  color: 'text-slate-300' },
              { label: 'Nuevos',           value: nuevosLeads, color: 'text-blue-400' },
              { label: 'Contactados',      value: contactados, color: 'text-yellow-400' },
              { label: 'Beta activa',      value: betaActiva,  color: 'text-cyan-400' },
              { label: 'Convertidos',      value: convertidos, color: 'text-emerald-400' },
              { label: 'Lead → beta',      value: `${tasaBeta}%`, color: 'text-purple-400' },
              { label: 'Beta → pago',      value: `${tasaConv}%`, color: 'text-pink-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input type="text" placeholder="Nombre, email o teléfono..." value={leadsSearch}
                onChange={e => setLeadsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <select value={leadsEstado} onChange={e => setLeadsEstado(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
              <option value="todos">Todos los estados</option>
              {(Object.entries(ESTADO_CFG) as [WaitlistEstado, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={leadsOficio} onChange={e => setLeadsOficio(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
              <option value="todos">Todos los oficios</option>
              {OFICIOS.map(o => <option key={o}>{o}</option>)}
            </select>
            <select value={leadsPrioridad} onChange={e => setLeadsPrioridad(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
              <option value="todos">Todas las prioridades</option>
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">⚪ Baja</option>
            </select>
            <span className="text-xs text-slate-500 ml-auto flex items-center gap-1"><Filter className="h-3 w-3" />{filteredLeads.length} leads</span>
            <button onClick={handleExportLeads} title="Exportar CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white hover:border-emerald-700 hover:bg-emerald-900/20 cursor-pointer transition-colors">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          {/* Tabla de leads */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Nombre', 'Contacto', 'Oficio / Ciudad', 'Presup./mes', 'Estado', 'Prioridad', 'Alta', 'Notas', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando leads...
                    </td></tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center">
                      <Inbox className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">Sin solicitudes aún</p>
                    </td></tr>
                  ) : filteredLeads.map(lead => {
                    const est = ESTADO_CFG[lead.estado];
                    const pri = PRIORIDAD_CFG[lead.prioridad];
                    const createdAt = new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const keyTel = `tel-${lead.id}`;
                    const keyEmail = `email-${lead.id}`;
                    return (
                      <tr key={lead.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">

                        {/* Nombre */}
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="font-semibold text-white text-sm">{lead.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{lead.fuente}</div>
                        </td>

                        {/* Contacto */}
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs text-slate-300 font-mono truncate max-w-[140px]">{lead.email}</span>
                            <button onClick={() => handleCopyField(lead.email, keyEmail)} title="Copiar email" className="text-slate-500 hover:text-white cursor-pointer shrink-0">
                              {copiedField === keyEmail ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          {lead.telefono && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400 font-mono">{lead.telefono}</span>
                              <button onClick={() => handleCopyField(lead.telefono!, keyTel)} title="Copiar teléfono" className="text-slate-500 hover:text-white cursor-pointer shrink-0">
                                {copiedField === keyTel ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Phone className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Oficio / Ciudad */}
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-300">{lead.oficio ?? '—'}</div>
                          <div className="text-[10px] text-slate-500">{lead.ciudad ?? '—'}</div>
                        </td>

                        {/* Presupuestos/mes */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-400">{lead.presupuestos_al_mes ?? '—'}</span>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select value={lead.estado}
                              onChange={e => handleLeadEstado(lead, e.target.value as WaitlistEstado)}
                              className={`appearance-none text-[10px] font-bold uppercase tracking-wider px-2 pr-5 py-0.5 rounded border cursor-pointer focus:outline-none ${est.cls} bg-transparent`}>
                              {(Object.entries(ESTADO_CFG) as [WaitlistEstado, { label: string }][]).map(([k, v]) => (
                                <option key={k} value={k} className="bg-slate-800 text-white normal-case">{v.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none opacity-60" />
                          </div>
                        </td>

                        {/* Prioridad */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select value={lead.prioridad}
                              onChange={e => handleLeadPrioridad(lead, e.target.value as WaitlistPrioridad)}
                              className={`appearance-none text-[10px] font-bold px-2 pr-5 py-0.5 rounded border cursor-pointer focus:outline-none ${pri.cls} bg-transparent`}>
                              {(Object.entries(PRIORIDAD_CFG) as [WaitlistPrioridad, { label: string }][]).map(([k, v]) => (
                                <option key={k} value={k} className="bg-slate-800 text-white">{v.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none opacity-60" />
                          </div>
                        </td>

                        {/* Alta */}
                        <td className="px-4 py-3">
                          <span className="text-slate-500 text-xs font-mono whitespace-nowrap">{createdAt}</span>
                        </td>

                        {/* Notas */}
                        <td className="px-4 py-3 max-w-[140px]">
                          {lead.notas
                            ? <p className="text-xs text-slate-300 truncate" title={lead.notas}>{lead.notas}</p>
                            : <span className="text-slate-600 text-xs italic">—</span>}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* WhatsApp */}
                            {lead.telefono && (
                              <button onClick={() => handleWhatsApp(lead)} title="Abrir WhatsApp con mensaje prellenado"
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border bg-emerald-900/30 border-emerald-700 text-emerald-300 hover:bg-emerald-700 hover:text-white transition-colors">
                                <MessageCircle className="h-3 w-3" /> WA
                              </button>
                            )}
                            {/* Email */}
                            <a href={`mailto:${lead.email}`} title="Enviar email"
                              className="flex items-center justify-center h-7 w-7 rounded bg-slate-700 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors">
                              <Mail className="h-3 w-3" />
                            </a>
                            {/* Nota */}
                            <button onClick={() => setNoteModal(lead)} title="Añadir/editar nota"
                              className={`flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border transition-colors ${lead.notas ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300 hover:bg-yellow-700 hover:text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-yellow-700 hover:border-yellow-600 hover:text-white'}`}>
                              <Star className="h-3 w-3" /> Nota
                            </button>
                            {/* Convertir */}
                            {lead.estado !== 'convertido' && lead.estado !== 'descartado' && (
                              <button onClick={() => handleOpenConvert(lead)} title="Convertir en instalador"
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border bg-cyan-900/30 border-cyan-700 text-cyan-300 hover:bg-cyan-600 hover:text-white transition-colors">
                                <UserCheck className="h-3 w-3" /> Convertir
                              </button>
                            )}
                            {/* Descartar */}
                            {lead.estado !== 'descartado' && (
                              <button onClick={() => handleLeadEstado(lead, 'descartado')} title="Marcar como descartado"
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-400 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300 transition-colors">
                                Descartar
                              </button>
                            )}
                            {/* Eliminar */}
                            <button onClick={() => handleDeleteLead(lead)} title="Eliminar lead"
                              className="flex items-center justify-center h-7 w-7 rounded bg-slate-700 border border-slate-600 text-slate-500 hover:text-red-400 hover:bg-red-900/20 hover:border-red-800 transition-colors cursor-pointer">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: FACTURAS PLATAFORMA
        ════════════════════════════════════════════════════════ */}
        {section === 'invoices' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Facturas de plataforma</span>
              </div>
              <button onClick={loadInvoices} title="Recargar"
                className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${invoicesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Organización', 'Periodo', 'Importe', 'Estado', 'Stripe ID', 'Creada'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoicesLoading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando facturas...
                    </td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center">
                      <CreditCard className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No hay facturas de plataforma aún</p>
                      <p className="text-slate-600 text-xs mt-1">Se generarán automáticamente cuando haya clientes activos</p>
                    </td></tr>
                  ) : invoices.map(inv => {
                    const org = orgs.find(o => o.id === inv.org_id);
                    const statusCfg = {
                      draft: { cls: 'bg-slate-700 text-slate-300 border-slate-600', label: 'Borrador' },
                      sent:  { cls: 'bg-blue-900/40 text-blue-300 border-blue-800', label: 'Enviada' },
                      paid:  { cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800', label: 'Pagada' },
                    };
                    const { cls, label } = statusCfg[inv.status];
                    return (
                      <tr key={inv.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <td className="px-4 py-3"><span className="text-white text-sm font-medium">{org?.nombre ?? inv.org_id.slice(0, 8)}</span></td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {new Date(inv.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          {' – '}
                          {new Date(inv.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3"><span className="text-white font-semibold">{(inv.amount_cents / 100).toFixed(2)} €</span></td>
                        <td className="px-4 py-3"><span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>{label}</span></td>
                        <td className="px-4 py-3"><span className="text-slate-500 text-xs font-mono">{inv.stripe_invoice_id ?? '—'}</span></td>
                        <td className="px-4 py-3"><span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                          {new Date(inv.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        </div>{/* max-w-6xl */}
        </main>
      </div>{/* flex body */}

      {/* ── Modales ───────────────────────────────────────────────────────── */}

      {setPwdOrg && (
        <SetPwdModal
          org={setPwdOrg}
          onClose={() => setSetPwdOrg(null)}
          onSave={async (pwd) => {
            const target = setPwdOrg.owner_id ?? setPwdOrg.auth_email ?? setPwdOrg.email ?? '';
            await adminSetPassword(target, pwd);
          }}
        />
      )}

      {extendOrg && (
        <ExtendTrialModal
          org={extendOrg}
          onClose={() => setExtendOrg(null)}
          onSave={async (days) => { await adminExtendTrial(extendOrg.id, days); await loadOrgs(); toast('success', `Trial de ${extendOrg.nombre} extendido ${days} días`); }}
          onError={(msg) => toast('error', msg)}
        />
      )}

      {showNewInstaller && (
        <NewInstallerModal
          initialData={leadFromConvert}
          onClose={() => { setShowNewInstaller(false); setLeadFromConvert(undefined); }}
          onCreated={loadOrgs}
        />
      )}

      {noteModal && (
        <LeadNoteModal
          lead={noteModal}
          onClose={() => setNoteModal(null)}
          onSave={async (id, nota) => { await handleSaveNote(id, nota); toast('success', 'Nota guardada'); }}
          onError={(msg) => toast('error', msg)}
        />
      )}

      {convertModal && (
        <LeadConvertModal
          lead={convertModal}
          onClose={() => setConvertModal(null)}
          onConverted={() => { loadOrgs(); loadLeads(); toast('success', `Instalador creado desde lead`); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar el lead de ${confirmDelete.nombre}? Esta acción no se puede deshacer.`}
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />

    </div>
  );
}
