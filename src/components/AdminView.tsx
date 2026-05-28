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
  adminLoadNotes, adminAddNote, adminDeleteNote, adminLogAction, adminLoadActivityLog, adminSetOrgFlag,
  adminMarkInvoicePaid,
  adminLoadAutoConfig, adminSaveAutoConfig, adminGetTrialsExpiringSoon, adminRunChurnRiskNow,
  AdminOrgRow, TradeSubscription, TradePlatformInvoice, TradeWaitlistLead,
  WaitlistEstado, WaitlistPrioridad, TradeCatalogSuggestion, AdminSupportNote, AdminActivityLog,
  AdminAutoConfig, TrialExpiringSoon,
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
  X, StickyNote, Activity, Repeat, BarChart2, PackageOpen,
  Zap, Bell, BellOff, PlayCircle, Send,
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

// ── Modal: aprobar sugerencia al catálogo global (top-level) ─────────────────
const ALL_OFICIOS_ADMIN = [
  'Fontanería', 'Electricidad', 'Climatización / HVAC', 'Calefacción',
  'Albañilería', 'Reformas', 'Carpintería / Ventanas', 'Cerrajería',
  'Pintura', 'Suelos y Tarimas', 'Pladur / Escayola', 'Jardinería',
  'Cristalería', 'Persianas / Cierres', 'Telecomunicaciones',
  'Energía Solar', 'CCTV / Seguridad', 'Ascensores',
  'Taller Mecánico', 'Limpieza Industrial',
];

interface SuggestionApproveModalProps {
  sug: TradeCatalogSuggestion;
  onClose: () => void;
  onApproved: (updatedSug: TradeCatalogSuggestion) => void;
}
function SuggestionApproveModal({ sug, onClose, onApproved }: SuggestionApproveModalProps) {
  const [form, setForm] = useState({
    oficio:     sug.oficio  ?? '',
    familia:    sug.familia ?? '',
    descripcion: sug.descripcion,
    unidad:     sug.unidad  ?? 'ud',
    precio:     sug.precio_indicado ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleApprove = async () => {
    if (!form.oficio || !form.familia) { setError('Oficio y familia son obligatorios'); return; }
    setLoading(true);
    setError(null);
    try {
      const updated: TradeCatalogSuggestion = {
        ...sug,
        oficio: form.oficio,
        familia: form.familia,
        descripcion: form.descripcion,
        unidad: form.unidad,
        precio_indicado: form.precio,
      };
      await adminApproveSuggestionToGlobal(updated);
      onApproved({ ...updated, estado: 'aprobado' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500';
  const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-emerald-400" /> Aprobar sugerencia
        </h3>
        <p className="text-slate-400 text-xs mb-4">Revisa y completa los datos antes de añadir al catálogo global</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Oficio *</label>
              <select value={form.oficio} onChange={e => set('oficio', e.target.value)} className={inputCls}>
                <option value="">Seleccionar…</option>
                {ALL_OFICIOS_ADMIN.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Familia *</label>
              <input value={form.familia} onChange={e => set('familia', e.target.value)} placeholder="ej. Tuberías" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Precio referencia (€)</label>
              <input type="number" step="0.01" min={0} value={form.precio} onChange={e => set('precio', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unidad</label>
              <input value={form.unidad} onChange={e => set('unidad', e.target.value)} placeholder="ud, m², h…" className={inputCls} />
            </div>
          </div>
        </div>
        {error && <div className="mt-3 bg-red-900/30 border border-red-700 text-red-300 rounded p-2 text-xs">{error}</div>}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer disabled:opacity-50 transition-colors">Cancelar</button>
          <button onClick={handleApprove} disabled={loading}
            className="px-4 py-2 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-colors">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
            {loading ? 'Añadiendo…' : 'Añadir al catálogo global'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel: detalle de org — slide-over lateral (top-level) ───────────────────
interface OrgDetailPanelProps {
  org: AdminOrgRow;
  adminEmail: string;
  onClose: () => void;
  onFlagChanged: (orgId: string, flag: 'churn_risk' | 'vip', value: boolean) => void;
  toast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

function OrgDetailPanel({ org, adminEmail, onClose, onFlagChanged, toast }: OrgDetailPanelProps) {
  const [notes, setNotes]               = useState<AdminSupportNote[]>([]);
  const [actLog, setActLog]             = useState<AdminActivityLog[]>([]);
  const [newNote, setNewNote]           = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingLog, setLoadingLog]     = useState(true);
  const [savingNote, setSavingNote]     = useState(false);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);
  const [flagLoading, setFlagLoading]   = useState<string | null>(null);

  useEffect(() => {
    setLoadingNotes(true);
    adminLoadNotes(org.id)
      .then(setNotes).catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
    setLoadingLog(true);
    adminLoadActivityLog(org.id)
      .then(setActLog).catch(() => setActLog([]))
      .finally(() => setLoadingLog(false));
  }, [org.id]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await adminAddNote(org.id, newNote.trim(), adminEmail);
      setNotes(prev => [{
        id: crypto.randomUUID(),
        org_id: org.id,
        admin_email: adminEmail,
        body: newNote.trim(),
        created_at: new Date().toISOString(),
      }, ...prev]);
      setNewNote('');
      toast('success', 'Nota añadida');
    } catch (e: unknown) {
      toast('error', 'Error al guardar nota: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingNote(noteId);
    try {
      await adminDeleteNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e: unknown) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeletingNote(null);
    }
  };

  const handleToggleFlag = async (flag: 'churn_risk' | 'vip') => {
    const current = flag === 'churn_risk' ? org.churn_risk : org.vip;
    setFlagLoading(flag);
    try {
      await adminSetOrgFlag(org.id, flag, !current);
      onFlagChanged(org.id, flag, !current);
      toast('success', `Flag "${flag}" ${!current ? 'activado' : 'desactivado'}`);
    } catch (e: unknown) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setFlagLoading(null);
    }
  };

  const sub = org.subscription;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 flex flex-col h-full shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base">{org.nombre}</span>
              {org.vip && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-yellow-700/40 border border-yellow-600 text-yellow-300">VIP</span>
              )}
              {org.churn_risk && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-900/40 border border-red-700 text-red-300">Churn</span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">{org.auth_email ?? org.email}</div>
          </div>
          <button onClick={onClose}
            className="text-slate-500 hover:text-white cursor-pointer p-1 rounded hover:bg-slate-800 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Org info + flags */}
        <div className="px-5 py-3 border-b border-slate-800 shrink-0">
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
            <div><span className="text-slate-500">Oficio:</span> <span className="text-slate-300">{org.oficio || '—'}</span></div>
            <div><span className="text-slate-500">Plan:</span> <span className="text-slate-300">{sub?.plan ?? '—'} / {sub?.billing_cycle ?? '—'}</span></div>
            <div className="flex items-center gap-1.5"><span className="text-slate-500">Estado:</span> <StatusBadge sub={sub} /></div>
            <div><span className="text-slate-500">Alta:</span> <span className="text-slate-300">{new Date(org.created_at).toLocaleDateString('es-ES')}</span></div>
            <div><span className="text-slate-500">Presupuestos:</span> <span className="text-slate-300">{org.quotes_count ?? 0}</span></div>
            <div><span className="text-slate-500">Clientes:</span> <span className="text-slate-300">{org.clients_count ?? 0}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleToggleFlag('vip')} disabled={flagLoading === 'vip'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors border disabled:opacity-50 ${
                org.vip
                  ? 'bg-yellow-700/40 border-yellow-600 text-yellow-300 hover:bg-yellow-900/40'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-yellow-600 hover:text-yellow-300'
              }`}>
              {flagLoading === 'vip' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
              VIP
            </button>
            <button onClick={() => handleToggleFlag('churn_risk')} disabled={flagLoading === 'churn_risk'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors border disabled:opacity-50 ${
                org.churn_risk
                  ? 'bg-red-900/40 border-red-700 text-red-300 hover:bg-red-900/60'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-red-700 hover:text-red-300'
              }`}>
              {flagLoading === 'churn_risk' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              Churn risk
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-3 border-b border-slate-800 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Notas internas</span>
          </div>
          <div className="flex gap-2 mb-3">
            <textarea rows={2} value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Añadir nota..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
            <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}
              className="shrink-0 px-3 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors self-stretch flex items-center">
              {savingNote ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Añadir'}
            </button>
          </div>
          {loadingNotes ? (
            <div className="text-center py-4"><RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500 inline-block" /></div>
          ) : notes.length === 0 ? (
            <p className="text-slate-600 text-xs italic text-center py-2">Sin notas</p>
          ) : (
            <div className="space-y-2">
              {notes.map(note => (
                <div key={note.id} className="bg-slate-800/70 rounded p-2.5 flex gap-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{note.body}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {new Date(note.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteNote(note.id)} disabled={deletingNote === note.id}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 cursor-pointer transition-all shrink-0 disabled:opacity-50">
                    {deletingNote === note.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div className="px-5 py-3 shrink-0 border-t border-slate-800 max-h-52 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Log de acciones</span>
          </div>
          {loadingLog ? (
            <div className="text-center py-4"><RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500 inline-block" /></div>
          ) : actLog.length === 0 ? (
            <p className="text-slate-600 text-xs italic text-center py-2">Sin acciones registradas</p>
          ) : (
            <div className="space-y-1.5">
              {actLog.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="text-slate-500 font-mono whitespace-nowrap text-[10px] shrink-0">
                    {new Date(entry.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-slate-300">{entry.action}</span>
                </div>
              ))}
            </div>
          )}
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
  const [detailOrg, setDetailOrg]     = useState<AdminOrgRow | null>(null);

  // Sección activa
  const [section, setSection] = useState<'dashboard' | 'orgs' | 'leads' | 'subscriptions' | 'invoices' | 'usage' | 'exports' | 'automations' | 'suggestions'>('dashboard');

  // Dashboard — datos de gráficos
  const [weeklyQuotes, setWeeklyQuotes] = useState<Array<{ week: string; count: number }>>([]);
  const [weeklyQuotesLoading, setWeeklyQuotesLoading] = useState(false);

  // Platform invoices
  const [invoices, setInvoices]               = useState<TradePlatformInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState<string>('all');
  const [markingPaidId, setMarkingPaidId]     = useState<string | null>(null);
  const [toggleLoading, setToggleLoading]     = useState<string | null>(null);

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

  // ── Catalog suggestions ────────────────────────────────────────────────
  const [suggestions, setSuggestions]           = useState<TradeCatalogSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFilter, setSuggestionsFilter]   = useState<string>('pendiente');
  const [approveModal, setApproveModal]             = useState<TradeCatalogSuggestion | null>(null);

  // ── Uso del producto ───────────────────────────────────────────────────
  const [usageSort, setUsageSort] = useState<'quotes' | 'activity'>('quotes');

  // ── Exportaciones avanzadas ────────────────────────────────────────────
  const [exportType,     setExportType]     = useState<'clientes' | 'leads' | 'suscripciones' | 'facturas'>('clientes');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo,   setExportDateTo]   = useState('');
  const [exportOficio,   setExportOficio]   = useState('todos');
  const [exportPlan,     setExportPlan]     = useState('todos');
  const [exportEstado,   setExportEstado]   = useState('todos');

  // ── Automatizaciones ──────────────────────────────────────────────────
  const [autoConfig, setAutoConfig]               = useState<AdminAutoConfig | null>(null);
  const [autoConfigLoading, setAutoConfigLoading] = useState(false);
  const [ntfyTopicInput, setNtfyTopicInput]       = useState('');
  const [savingNtfy, setSavingNtfy]               = useState(false);
  const [testingNtfy, setTestingNtfy]             = useState(false);
  const [expiringTrials, setExpiringTrials]       = useState<TrialExpiringSoon[]>([]);
  const [trialsLoading, setTrialsLoading]         = useState(false);
  const [runningChurn, setRunningChurn]           = useState(false);

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

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try { setSuggestions(await adminLoadCatalogSuggestions()); }
    catch { setSuggestions([]); }
    finally { setSuggestionsLoading(false); }
  };

  useEffect(() => { if (isAdmin) { loadOrgs(); loadWeeklyQuotes(); } }, [isAdmin]);
  useEffect(() => { if (isAdmin && section === 'leads') loadLeads(); }, [isAdmin, section]);
  useEffect(() => { if (isAdmin && section === 'invoices') loadInvoices(); }, [isAdmin, section]);
  useEffect(() => { if (isAdmin && section === 'suggestions') loadSuggestions(); }, [isAdmin, section]);
  useEffect(() => {
    if (!isAdmin || section !== 'automations') return;
    setAutoConfigLoading(true);
    adminLoadAutoConfig()
      .then(cfg => { setAutoConfig(cfg); setNtfyTopicInput(cfg.ntfy_topic); })
      .catch(() => {})
      .finally(() => setAutoConfigLoading(false));
    setTrialsLoading(true);
    adminGetTrialsExpiringSoon(7)
      .then(setExpiringTrials)
      .catch(() => setExpiringTrials([]))
      .finally(() => setTrialsLoading(false));
  }, [isAdmin, section]);

  // ── Handlers — clientes ────────────────────────────────────────────────
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleResetPassword = async (org: AdminOrgRow) => {
    const email = org.auth_email ?? org.email ?? '';
    if (!email) return;
    try {
      await adminSendPasswordReset(email);
      await adminLogAction('send_password_reset', org.id, { email });
      setResetSent(prev => new Set(prev).add(org.id));
      toast('success', `Email de reset enviado a ${email}`);
    }
    catch (e: unknown) { toast('error', 'Error al enviar reset: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const handleToggleSubscription = async (org: AdminOrgRow) => {
    const isActive = org.subscription?.status === 'active';
    setToggleLoading(org.id);
    try {
      await setSubscriptionActive(org.id, !isActive);
      await adminLogAction(isActive ? 'deactivate_subscription' : 'activate_subscription', org.id);
      await loadOrgs();
      toast('success', `Suscripción ${isActive ? 'desactivada' : 'activada'}`);
    }
    catch (e: unknown) { toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setToggleLoading(null); }
  };

  const handleOrgFlagChanged = (orgId: string, flag: 'churn_risk' | 'vip', value: boolean) => {
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, [flag]: value } : o));
    setDetailOrg(prev => prev?.id === orgId ? { ...prev, [flag]: value } : prev);
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

  const pendingSuggestions = suggestions.filter(s => s.estado === 'pendiente').length;

  // ── Cálculos suscripciones ─────────────────────────────────────────────────
  const subsOrgs = orgs.filter(o => o.subscription);
  const planCounts = { basico: 0, pro: 0, empresa: 0 } as Record<string, number>;
  const planMrr    = { basico: 0, pro: 0, empresa: 0 } as Record<string, number>;
  const monthlyCnt = orgs.filter(o => o.subscription?.status === 'active' && o.subscription.billing_cycle === 'monthly').length;
  const yearlyCnt  = orgs.filter(o => o.subscription?.status === 'active' && o.subscription.billing_cycle === 'yearly').length;
  for (const org of orgs.filter(o => o.subscription?.status === 'active')) {
    const plan = org.subscription!.plan;
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
    planMrr[plan]    = (planMrr[plan] ?? 0) + (PLAN_PRICES[plan]?.[org.subscription!.billing_cycle] ?? 0);
  }

  // ── Cálculos facturas ──────────────────────────────────────────────────────
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const currentYear      = new Date().getFullYear().toString();
  const invoicedThisMonth = invoices.filter(i => i.period_start.startsWith(currentYearMonth)).reduce((s, i) => s + i.amount_cents, 0);
  const invoicedYTD       = invoices.filter(i => i.period_start.startsWith(currentYear)).reduce((s, i) => s + i.amount_cents, 0);
  const pendingAmount     = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount_cents, 0);
  const paidCount         = invoices.filter(i => i.status === 'paid').length;
  const invoiceMonths     = [...new Set(invoices.map(i => i.period_start.slice(0, 7)))].sort().reverse();
  const filteredInvoices  = invoiceMonthFilter === 'all' ? invoices : invoices.filter(i => i.period_start.slice(0, 7) === invoiceMonthFilter);

  // ── Cálculos uso del producto ─────────────────────────────────────────────
  const noFirstQuote     = orgs.filter(o => (o.quotes_count ?? 0) === 0).length;
  const onboardingRate   = orgs.length > 0 ? Math.round((orgs.length - noFirstQuote) / orgs.length * 100) : 0;
  const powerUsers       = orgs.filter(o => (o.quotes_count ?? 0) >= 10).length;
  const activeThisWeek   = orgs.filter(o => {
    if (!o.last_sign_in) return false;
    return (Date.now() - new Date(o.last_sign_in).getTime()) < 7 * 86400000;
  }).length;

  const sortedByUsage = [...orgs].sort((a, b) => {
    if (usageSort === 'quotes') return (b.quotes_count ?? 0) - (a.quotes_count ?? 0);
    const aDate = a.last_sign_in ? new Date(a.last_sign_in).getTime() : 0;
    const bDate = b.last_sign_in ? new Date(b.last_sign_in).getTime() : 0;
    return bDate - aDate;
  });

  // ── Cohortes ─────────────────────────────────────────────────────────────
  const cohorts = (() => {
    const map = new Map<string, { total: number; paid: number; trial: number; other: number }>();
    for (const org of orgs) {
      const month = org.created_at.slice(0, 7);
      if (!map.has(month)) map.set(month, { total: 0, paid: 0, trial: 0, other: 0 });
      const c = map.get(month)!;
      c.total++;
      const st = org.subscription?.status;
      if (st === 'active') c.paid++;
      else if (st === 'trial') c.trial++;
      else c.other++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, d]) => ({
        month,
        ...d,
        pctPaid: d.total > 0 ? Math.round(d.paid / d.total * 100) : 0,
      }));
  })();

  // ── Cálculos exportaciones avanzadas ─────────────────────────────────────
  const exportRows = (() => {
    const inRange = (dateStr: string) => {
      if (exportDateFrom && dateStr < exportDateFrom) return false;
      if (exportDateTo   && dateStr > exportDateTo)   return false;
      return true;
    };
    if (exportType === 'clientes') {
      return orgs.filter(o => {
        if (!inRange(o.created_at)) return false;
        if (exportOficio !== 'todos' && o.oficio !== exportOficio) return false;
        if (exportPlan !== 'todos' && o.subscription?.plan !== exportPlan) return false;
        if (exportEstado !== 'todos' && o.subscription?.status !== exportEstado) return false;
        return true;
      }).map(o => ({
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
        VIP: o.vip ? 'Sí' : 'No',
        'Riesgo churn': o.churn_risk ? 'Sí' : 'No',
      }));
    }
    if (exportType === 'leads') {
      return leads.filter(l => {
        if (!inRange(l.created_at)) return false;
        if (exportOficio !== 'todos' && l.oficio !== exportOficio) return false;
        if (exportEstado !== 'todos' && l.estado !== exportEstado) return false;
        return true;
      }).map(l => ({
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
    }
    if (exportType === 'suscripciones') {
      return orgs.filter(o => {
        if (!o.subscription) return false;
        if (!inRange(o.created_at)) return false;
        if (exportPlan !== 'todos' && o.subscription.plan !== exportPlan) return false;
        if (exportEstado !== 'todos' && o.subscription.status !== exportEstado) return false;
        return true;
      }).map(o => ({
        Empresa: o.nombre,
        Email: o.auth_email ?? o.email ?? '',
        Plan: o.subscription!.plan,
        Ciclo: o.subscription!.billing_cycle,
        Estado: o.subscription!.status,
        'Fin trial': o.subscription!.trial_end ? new Date(o.subscription!.trial_end).toLocaleDateString('es-ES') : '',
        'MRR (€)': o.subscription!.status === 'active' ? (PLAN_PRICES[o.subscription!.plan]?.[o.subscription!.billing_cycle] ?? 0) : 0,
        'Fecha alta': new Date(o.created_at).toLocaleDateString('es-ES'),
      }));
    }
    // facturas
    return invoices.filter(i => {
      if (!inRange(i.created_at)) return false;
      if (exportEstado !== 'todos' && i.status !== exportEstado) return false;
      return true;
    }).map(i => {
      const org = orgs.find(o => o.id === i.org_id);
      return {
        Organización: org?.nombre ?? i.org_id.slice(0, 8),
        'Período inicio': new Date(i.period_start).toLocaleDateString('es-ES'),
        'Período fin': new Date(i.period_end).toLocaleDateString('es-ES'),
        'Importe (€)': (i.amount_cents / 100).toFixed(2),
        Estado: i.status,
        'Pagada el': i.paid_at ? new Date(i.paid_at).toLocaleDateString('es-ES') : '',
        'Stripe ID': i.stripe_invoice_id ?? '',
      };
    });
  })();

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
    { id: 'dashboard'     as const, label: 'Dashboard',      Icon: TrendingUp },
    { id: 'orgs'          as const, label: 'Clientes',        Icon: Users },
    { id: 'leads'         as const, label: 'Leads beta',      Icon: Inbox,       badge: nuevosLeads },
    { id: 'subscriptions' as const, label: 'Suscripciones',   Icon: Repeat },
    { id: 'invoices'      as const, label: 'Facturación',     Icon: CreditCard },
    { id: 'usage'         as const, label: 'Uso',             Icon: BarChart2 },
    { id: 'exports'       as const, label: 'Exportar',        Icon: PackageOpen },
    { id: 'automations'   as const, label: 'Automaciones',    Icon: Zap },
    { id: 'suggestions'   as const, label: 'Sugerencias',     Icon: Globe,       badge: pendingSuggestions },
  ];

  const handleMarkInvoicePaid = async (inv: TradePlatformInvoice) => {
    setMarkingPaidId(inv.id);
    try {
      await adminMarkInvoicePaid(inv.id);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
      toast('success', 'Factura marcada como pagada');
    } catch (e: unknown) {
      toast('error', 'Error al actualizar factura: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleExportInvoices = () => {
    const rows = filteredInvoices.map(inv => {
      const org = orgs.find(o => o.id === inv.org_id);
      return {
        Organización: org?.nombre ?? inv.org_id.slice(0, 8),
        'Período inicio': new Date(inv.period_start).toLocaleDateString('es-ES'),
        'Período fin': new Date(inv.period_end).toLocaleDateString('es-ES'),
        'Importe (€)': (inv.amount_cents / 100).toFixed(2),
        Estado: inv.status,
        'Pagada el': inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('es-ES') : '',
        'Stripe ID': inv.stripe_invoice_id ?? '',
        'Creada': new Date(inv.created_at).toLocaleDateString('es-ES'),
      };
    });
    exportToCsv(rows, `tradeflow_facturas_${invoiceMonthFilter !== 'all' ? invoiceMonthFilter : new Date().toISOString().slice(0, 10)}`);
  };

  const reloadCurrent = () => {
    if (section === 'leads') loadLeads();
    else if (section === 'invoices') loadInvoices();
    else if (section === 'suggestions') loadSuggestions();
    else if (section === 'subscriptions' || section === 'usage') loadOrgs();
    else if (section === 'exports') { loadOrgs(); loadLeads(); loadInvoices(); }
    else if (section === 'automations') {
      adminLoadAutoConfig().then(cfg => { setAutoConfig(cfg); setNtfyTopicInput(cfg.ntfy_topic); }).catch(() => {});
      adminGetTrialsExpiringSoon(7).then(setExpiringTrials).catch(() => {});
    }
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
                          <button onClick={() => setDetailOrg(org)}
                            className="font-semibold text-blue-300 hover:text-white text-xs truncate block w-full text-left cursor-pointer transition-colors">
                            {org.nombre}
                          </button>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {org.email_confirmed
                              ? <CheckCircle className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                              : <AlertTriangle className="h-2.5 w-2.5 text-yellow-400 shrink-0" />}
                            <span className="text-[9px] text-slate-500">{org.email_confirmed ? 'Confirmado' : 'Sin confirmar'}</span>
                            {org.vip && <span className="text-[8px] font-black uppercase px-1 py-px rounded bg-yellow-700/40 border border-yellow-700 text-yellow-300">VIP</span>}
                            {org.churn_risk && <span className="text-[8px] font-black uppercase px-1 py-px rounded bg-red-900/40 border border-red-800 text-red-300">Churn</span>}
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
            SECCIÓN: SUSCRIPCIONES
        ════════════════════════════════════════════════════════ */}
        {section === 'subscriptions' && (
          <div className="space-y-5">

            {/* KPI: totales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Activos (pago)',  value: active,     color: 'text-emerald-400' },
                { label: 'En prueba',       value: trialing,   color: 'text-yellow-400' },
                { label: 'MRR total',       value: `${mrr}€`,  color: 'text-purple-400' },
                { label: 'Sin suscripción', value: orgs.length - subsOrgs.length, color: 'text-slate-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Distribución por plan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['basico', 'pro', 'empresa'] as const).map(plan => {
                const count = planCounts[plan] ?? 0;
                const revenue = planMrr[plan] ?? 0;
                const pct = active > 0 ? Math.round(count / active * 100) : 0;
                const colors: Record<string, string> = { basico: 'bg-blue-500', pro: 'bg-purple-500', empresa: 'bg-emerald-500' };
                const labels: Record<string, string> = { basico: 'Básico', pro: 'Pro', empresa: 'Empresa' };
                return (
                  <div key={plan} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{labels[plan]}</span>
                      <span className="text-xs text-slate-400">{count} clientes · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full mb-2">
                      <div className={`h-full rounded-full ${colors[plan]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-400">MRR: <span className="text-white font-semibold">{revenue}€/mes</span></div>
                  </div>
                );
              })}
            </div>

            {/* Ciclo de facturación */}
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Mensual</div>
                <div className="text-xl font-bold text-blue-300">{monthlyCnt}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {active > 0 ? `${Math.round(monthlyCnt / active * 100)}% del total activo` : '—'}
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Anual</div>
                <div className="text-xl font-bold text-emerald-300">{yearlyCnt}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {active > 0 ? `${Math.round(yearlyCnt / active * 100)}% del total activo` : '—'}
                </div>
              </div>
            </div>

            {/* Tabla detallada */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Empresa', 'Plan', 'Ciclo', 'Estado', 'Trial / Renovación', 'MRR'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                        <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando...
                      </td></tr>
                    ) : subsOrgs.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center">
                        <Repeat className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">Sin suscripciones registradas</p>
                      </td></tr>
                    ) : subsOrgs.map(org => {
                      const sub = org.subscription!;
                      const planCls: Record<string, string> = {
                        basico:  'bg-blue-900/40 text-blue-300 border-blue-800',
                        pro:     'bg-purple-900/40 text-purple-300 border-purple-800',
                        empresa: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
                      };
                      const planLabel: Record<string, string> = { basico: 'Básico', pro: 'Pro', empresa: 'Empresa' };
                      const orgMrr = sub.status === 'active' ? (PLAN_PRICES[sub.plan]?.[sub.billing_cycle] ?? 0) : 0;
                      const trialDaysLeft = sub.status === 'trial'
                        ? Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000)
                        : null;
                      return (
                        <tr key={org.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                          <td className="px-3 py-1.5 max-w-[180px]">
                            <button onClick={() => setDetailOrg(org)}
                              className="font-semibold text-blue-300 hover:text-white text-xs truncate block w-full text-left cursor-pointer transition-colors">
                              {org.nombre}
                            </button>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{org.auth_email ?? org.email}</div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${planCls[sub.plan] ?? ''}`}>
                              {planLabel[sub.plan] ?? sub.plan}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-slate-300">{sub.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}</span>
                          </td>
                          <td className="px-3 py-1.5"><StatusBadge sub={sub} /></td>
                          <td className="px-3 py-1.5">
                            {trialDaysLeft !== null ? (
                              <span className={`text-xs font-mono ${trialDaysLeft <= 3 ? 'text-red-400' : trialDaysLeft <= 7 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                {trialDaysLeft <= 0 ? 'Vence hoy' : `${trialDaysLeft}d restantes`}
                              </span>
                            ) : sub.status === 'active' ? (
                              <span className="text-xs text-slate-500 italic">{sub.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}</span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`text-xs font-bold ${orgMrr > 0 ? 'text-purple-300' : 'text-slate-600'}`}>
                              {orgMrr > 0 ? `${orgMrr}€` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: FACTURAS PLATAFORMA
        ════════════════════════════════════════════════════════ */}
        {section === 'invoices' && (
          <div className="space-y-5">

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Facturado este mes', value: `${(invoicedThisMonth / 100).toFixed(0)}€`, color: 'text-blue-300' },
                { label: 'Total YTD',           value: `${(invoicedYTD / 100).toFixed(0)}€`,       color: 'text-purple-300' },
                { label: 'Pendiente cobro',     value: `${(pendingAmount / 100).toFixed(0)}€`,     color: pendingAmount > 0 ? 'text-yellow-400' : 'text-slate-500' },
                { label: 'Pagadas',             value: paidCount,                                  color: 'text-emerald-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filtros + acciones */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Facturas de plataforma</span>
              </div>
              <select value={invoiceMonthFilter} onChange={e => setInvoiceMonthFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
                <option value="all">Todos los meses</option>
                {invoiceMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-xs text-slate-500">{filteredInvoices.length} facturas</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={handleExportInvoices} title="Exportar CSV"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white hover:border-emerald-700 hover:bg-emerald-900/20 cursor-pointer transition-colors">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={loadInvoices} title="Recargar"
                  className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
                  <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${invoicesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Organización', 'Periodo', 'Importe', 'Estado', 'Pagada el', 'Stripe ID', 'Acciones'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesLoading ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-sm">
                        <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando facturas...
                      </td></tr>
                    ) : filteredInvoices.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center">
                        <CreditCard className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No hay facturas de plataforma aún</p>
                        <p className="text-slate-600 text-xs mt-1">Se generarán automáticamente cuando haya clientes activos</p>
                      </td></tr>
                    ) : filteredInvoices.map(inv => {
                      const org = orgs.find(o => o.id === inv.org_id);
                      const statusCfg = {
                        draft: { cls: 'bg-slate-700 text-slate-300 border-slate-600', label: 'Borrador' },
                        sent:  { cls: 'bg-blue-900/40 text-blue-300 border-blue-800', label: 'Enviada' },
                        paid:  { cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800', label: 'Pagada' },
                      };
                      const { cls, label } = statusCfg[inv.status];
                      return (
                        <tr key={inv.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                          <td className="px-3 py-1.5">
                            <span className="text-white text-xs font-medium">{org?.nombre ?? inv.org_id.slice(0, 8)}</span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                            {new Date(inv.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {' – '}
                            {new Date(inv.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-white font-semibold text-xs">{(inv.amount_cents / 100).toFixed(2)} €</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                              {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-slate-500 text-xs font-mono">{inv.stripe_invoice_id ?? '—'}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            {inv.status !== 'paid' && (
                              <button onClick={() => handleMarkInvoicePaid(inv)}
                                disabled={markingPaidId === inv.id}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-emerald-900/40 hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-50 transition-colors">
                                {markingPaidId === inv.id
                                  ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  : <CheckCircle className="h-2.5 w-2.5" />}
                                Pagada
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: USO DEL PRODUCTO
        ════════════════════════════════════════════════════════ */}
        {section === 'usage' && (
          <div className="space-y-6">

            {/* KPIs de uso */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Activos esta semana',     value: activeThisWeek,    color: 'text-emerald-400' },
                { label: 'Sin primer presupuesto',  value: noFirstQuote,      color: noFirstQuote > 0 ? 'text-yellow-400' : 'text-slate-500' },
                { label: 'Tasa onboarding',         value: `${onboardingRate}%`, color: onboardingRate >= 70 ? 'text-emerald-400' : 'text-yellow-400' },
                { label: 'Power users (≥10 presup.)', value: powerUsers,      color: 'text-purple-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1 leading-tight">{label}</div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Tabla de actividad */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Actividad por instalador</h3>
                <div className="flex gap-1">
                  {(['quotes', 'activity'] as const).map(s => (
                    <button key={s} onClick={() => setUsageSort(s)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        usageSort === s ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {s === 'quotes' ? 'Por presupuestos' : 'Por actividad'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Empresa', 'Plan', 'Presupuestos', 'Clientes', 'Último acceso', 'Último presupuesto', 'Actividad'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando...
                        </td></tr>
                      ) : sortedByUsage.map(org => {
                        const daysSince = org.last_sign_in
                          ? Math.floor((Date.now() - new Date(org.last_sign_in).getTime()) / 86400000)
                          : null;
                        const actColor = daysSince === null ? 'text-slate-600' :
                          daysSince <= 7 ? 'text-emerald-400' :
                          daysSince <= 30 ? 'text-yellow-400' : 'text-red-400';
                        const actLabel = daysSince === null ? 'Nunca' :
                          daysSince === 0 ? 'Hoy' :
                          daysSince === 1 ? 'Ayer' : `${daysSince}d`;
                        const noQuotes = (org.quotes_count ?? 0) === 0;
                        return (
                          <tr key={org.id} className={`border-b border-slate-700/50 transition-colors ${noQuotes ? 'bg-yellow-900/5 hover:bg-yellow-900/10' : 'hover:bg-slate-800/60'}`}>
                            <td className="px-3 py-1.5 max-w-[160px]">
                              <button onClick={() => setDetailOrg(org)}
                                className="font-semibold text-blue-300 hover:text-white text-xs truncate block w-full text-left cursor-pointer transition-colors">
                                {org.nombre}
                              </button>
                              {noQuotes && (
                                <span className="text-[9px] font-bold uppercase text-yellow-500">sin primer presupuesto</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-xs text-slate-400">{org.subscription?.plan ?? '—'}</span>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm font-bold ${(org.quotes_count ?? 0) >= 10 ? 'text-purple-300' : 'text-slate-300'}`}>
                                  {org.quotes_count ?? 0}
                                </span>
                                {(org.quotes_count ?? 0) >= 10 && (
                                  <span className="text-[8px] font-black uppercase px-1 py-px rounded bg-purple-900/40 border border-purple-800 text-purple-300">Power</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-xs text-slate-400">{org.clients_count ?? 0}</span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                {org.last_sign_in
                                  ? new Date(org.last_sign_in).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  : <span className="text-slate-600 italic">Nunca</span>}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                {org.last_quote_at
                                  ? new Date(org.last_quote_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  : <span className="text-slate-600 italic">—</span>}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`text-xs font-bold ${actColor}`}>{actLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Cohortes trial → pago */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Cohortes por mes de alta</h3>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Mes de alta', 'Altas', 'Activos pago', 'En trial', 'Expirado/Cancelado', '% pago'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600 text-sm italic">Sin datos</td></tr>
                      ) : cohorts.map(c => (
                        <tr key={c.month} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-mono text-slate-300">{c.month}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-bold text-slate-200">{c.total}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-bold text-emerald-400">{c.paid}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-yellow-400">{c.trial}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-slate-500">{c.other}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-700 rounded-full">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.pctPaid}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${c.pctPaid >= 30 ? 'text-emerald-400' : c.pctPaid > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                {c.pctPaid}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: EXPORTACIONES AVANZADAS
        ════════════════════════════════════════════════════════ */}
        {section === 'exports' && (
          <div className="space-y-5 max-w-2xl">

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">¿Qué quieres exportar?</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { id: 'clientes',       label: 'Clientes',       Icon: Users },
                  { id: 'leads',          label: 'Leads beta',      Icon: Inbox },
                  { id: 'suscripciones',  label: 'Suscripciones',  Icon: Repeat },
                  { id: 'facturas',       label: 'Facturas',       Icon: CreditCard },
                ] as const).map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setExportType(id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded text-xs font-semibold cursor-pointer transition-colors border ${
                      exportType === id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-blue-700'
                    }`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtros</h4>

              {/* Rango de fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Fecha desde</label>
                  <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Fecha hasta</label>
                  <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Oficio — solo para clientes y leads */}
              {(exportType === 'clientes' || exportType === 'leads') && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Oficio</label>
                  <select value={exportOficio} onChange={e => setExportOficio(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                    <option value="todos">Todos los oficios</option>
                    {OFICIOS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              )}

              {/* Plan — para clientes y suscripciones */}
              {(exportType === 'clientes' || exportType === 'suscripciones') && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Plan</label>
                  <select value={exportPlan} onChange={e => setExportPlan(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                    <option value="todos">Todos los planes</option>
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </div>
              )}

              {/* Estado */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Estado</label>
                <select value={exportEstado} onChange={e => setExportEstado(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                  <option value="todos">Todos los estados</option>
                  {exportType === 'leads' ? (
                    Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)
                  ) : exportType === 'facturas' ? (
                    <>
                      <option value="draft">Borrador</option>
                      <option value="sent">Enviada</option>
                      <option value="paid">Pagada</option>
                    </>
                  ) : (
                    <>
                      <option value="trial">En prueba</option>
                      <option value="active">Activo</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="expired">Expirado</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Preview y botón de descarga */}
            <div className="flex items-center justify-between bg-slate-800/30 border border-slate-700 rounded-lg px-5 py-4">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Registros que se exportarán</div>
                <div className="text-2xl font-bold text-white">{exportRows.length}</div>
              </div>
              <button
                onClick={() => {
                  if (exportRows.length === 0) { toast('warning', 'No hay registros con los filtros aplicados'); return; }
                  const prefix = exportType;
                  const suffix = exportDateFrom && exportDateTo
                    ? `_${exportDateFrom}_${exportDateTo}`
                    : `_${new Date().toISOString().slice(0, 10)}`;
                  exportToCsv(exportRows as Record<string, unknown>[], `tradeflow_${prefix}${suffix}`);
                  toast('success', `${exportRows.length} registros exportados`);
                }}
                disabled={exportRows.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Download className="h-4 w-4" />
                Descargar CSV
              </button>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: AUTOMATIZACIONES
        ════════════════════════════════════════════════════════ */}
        {section === 'automations' && (
          <div className="space-y-5 max-w-2xl">

            {autoConfigLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : (
              <>
                {/* ── Card 1: Auto churn_risk ───────────────────── */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-red-900/30 border border-red-800 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Auto-marcar riesgo de churn</div>
                        <div className="text-xs text-slate-400 mt-0.5">Marca instaladores sin acceso en 21+ días · Se ejecuta diariamente a las 3:00 UTC</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-900/30 border border-emerald-700 text-emerald-300 shrink-0">
                      Activo
                    </span>
                  </div>
                  {autoConfig?.last_churn_run && (
                    <div className="text-[10px] text-slate-500 mb-3">
                      Última ejecución: {new Date(autoConfig.last_churn_run).toLocaleString('es-ES')}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setRunningChurn(true);
                        try {
                          await adminRunChurnRiskNow();
                          await loadOrgs();
                          const cfg = await adminLoadAutoConfig();
                          setAutoConfig(cfg);
                          toast('success', 'Churn risk actualizado correctamente');
                        } catch (e: unknown) {
                          toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
                        } finally { setRunningChurn(false); }
                      }}
                      disabled={runningChurn}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 bg-slate-700 text-slate-300 hover:bg-red-900/30 hover:border-red-700 hover:text-red-300 cursor-pointer disabled:opacity-50 transition-colors">
                      {runningChurn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                      Ejecutar ahora
                    </button>
                    <span className="text-xs text-slate-500">
                      {orgs.filter(o => o.churn_risk).length} instaladores marcados actualmente
                    </span>
                  </div>
                </div>

                {/* ── Card 2: Trials próximos a vencer ─────────── */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-yellow-900/30 border border-yellow-800 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Recordatorio trials próximos a vencer</div>
                        <div className="text-xs text-slate-400 mt-0.5">Instaladores con trial que expira en los próximos 7 días</div>
                      </div>
                    </div>
                    {trialsLoading
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                      : <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${
                          expiringTrials.length > 0
                            ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300'
                            : 'bg-slate-700 border-slate-600 text-slate-400'
                        }`}>
                          {expiringTrials.length} pendientes
                        </span>
                    }
                  </div>
                  {expiringTrials.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No hay trials próximos a vencer</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {expiringTrials.map(t => (
                        <div key={t.org_id} className="flex items-center gap-3 py-1.5 px-3 rounded bg-yellow-900/10 border border-yellow-900/30">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{t.org_nombre}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{t.owner_email}</div>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${t.days_left <= 1 ? 'text-red-400' : t.days_left <= 3 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            {t.days_left === 0 ? 'Vence hoy' : `${t.days_left}d`}
                          </span>
                          <a href={`mailto:${t.owner_email}?subject=Tu periodo de prueba en TradeFlow está por terminar&body=Hola, te recordamos que tu prueba gratuita vence en ${t.days_left} día${t.days_left !== 1 ? 's' : ''}. ¿Tienes alguna duda antes de activar tu plan?`}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-blue-900/40 hover:border-blue-700 hover:text-blue-300 transition-colors"
                            title="Enviar email">
                            <Mail className="h-2.5 w-2.5" /> Email
                          </a>
                          <button onClick={() => setExtendOrg(orgs.find(o => o.id === t.org_id) ?? null)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-300 hover:bg-yellow-900/40 hover:border-yellow-700 hover:text-yellow-300 transition-colors">
                            <CalendarPlus className="h-2.5 w-2.5" /> +Trial
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Card 3: Notificaciones ntfy ───────────────── */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-900/30 border border-blue-800 flex items-center justify-center shrink-0">
                        <Bell className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Notificación nuevo cliente de pago</div>
                        <div className="text-xs text-slate-400 mt-0.5">Recibe una alerta en tu móvil cuando alguien activa una suscripción</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${
                      autoConfig?.ntfy_topic
                        ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                        : 'bg-slate-700 border-slate-600 text-slate-400'
                    }`}>
                      {autoConfig?.ntfy_topic ? 'Activo' : 'Sin configurar'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Topic de ntfy.sh
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={ntfyTopicInput}
                          onChange={e => setNtfyTopicInput(e.target.value)}
                          placeholder="ej. tradeflow-alertas-2026"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <button
                          onClick={async () => {
                            setSavingNtfy(true);
                            try {
                              await adminSaveAutoConfig('ntfy_topic', ntfyTopicInput.trim());
                              setAutoConfig(prev => prev ? { ...prev, ntfy_topic: ntfyTopicInput.trim() } : prev);
                              toast('success', 'Topic guardado correctamente');
                            } catch (e: unknown) {
                              toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
                            } finally { setSavingNtfy(false); }
                          }}
                          disabled={savingNtfy}
                          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50 transition-colors">
                          {savingNtfy ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Guardar'}
                        </button>
                      </div>
                      {ntfyTopicInput && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Suscríbete en: <span className="font-mono text-blue-400">ntfy.sh/{ntfyTopicInput}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const topic = ntfyTopicInput.trim();
                        if (!topic) { toast('warning', 'Introduce un topic antes de probar'); return; }
                        setTestingNtfy(true);
                        try {
                          await fetch('https://ntfy.sh', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              topic,
                              title: 'Test — TradeFlow Admin',
                              message: 'Prueba de notificación desde el panel de administración ✓',
                              tags: ['white_check_mark'],
                              priority: 3,
                            }),
                          });
                          toast('success', 'Notificación de prueba enviada a ntfy.sh/' + topic);
                        } catch {
                          toast('error', 'Error al enviar la notificación de prueba');
                        } finally { setTestingNtfy(false); }
                      }}
                      disabled={testingNtfy || !ntfyTopicInput.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 bg-slate-700 text-slate-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-300 cursor-pointer disabled:opacity-50 transition-colors">
                      {testingNtfy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Enviar notificación de prueba
                    </button>
                  </div>
                </div>

                {/* ── Card 4: Informe mensual ───────────────────── */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-purple-900/30 border border-purple-800 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Informe mensual</div>
                        <div className="text-xs text-slate-400 mt-0.5">CSV completo con métricas, clientes activos y estado de suscripciones</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const mes = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                      // Fila de KPIs
                      const kpiRows = [
                        { Métrica: 'MRR (€)', Valor: mrr },
                        { Métrica: 'ARR (€)', Valor: mrr * 12 },
                        { Métrica: 'Clientes activos (pago)', Valor: active },
                        { Métrica: 'Clientes en trial', Valor: trialing },
                        { Métrica: 'Total clientes', Valor: orgs.length },
                        { Métrica: 'Sin actividad 30d', Valor: inactive30 },
                        { Métrica: 'Sin primer presupuesto', Valor: noFirstQuote },
                        { Métrica: 'Tasa onboarding (%)', Valor: onboardingRate },
                        { Métrica: 'Leads nuevos', Valor: nuevosLeads },
                        { Métrica: 'Leads convertidos', Valor: convertidos },
                        { Métrica: 'Generado el', Valor: now.toLocaleString('es-ES') },
                      ];
                      exportToCsv(kpiRows as Record<string, unknown>[], `tradeflow_informe_${now.toISOString().slice(0, 7)}_kpis`);
                      // CSV de clientes activos
                      const clientRows = orgs.filter(o => o.subscription?.status === 'active').map(o => ({
                        Empresa: o.nombre,
                        Email: o.auth_email ?? o.email ?? '',
                        Oficio: o.oficio ?? '',
                        Plan: o.subscription!.plan,
                        Ciclo: o.subscription!.billing_cycle,
                        'MRR (€)': PLAN_PRICES[o.subscription!.plan]?.[o.subscription!.billing_cycle] ?? 0,
                        'Alta': new Date(o.created_at).toLocaleDateString('es-ES'),
                        'Último acceso': o.last_sign_in ? new Date(o.last_sign_in).toLocaleDateString('es-ES') : 'Nunca',
                        'Presupuestos': o.quotes_count ?? 0,
                        VIP: o.vip ? 'Sí' : 'No',
                      }));
                      exportToCsv(clientRows, `tradeflow_informe_${now.toISOString().slice(0, 7)}_clientes_activos`);
                      toast('success', `Informe de ${mes} generado — 2 archivos CSV descargados`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors">
                    <Download className="h-4 w-4" />
                    Generar informe de {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            SECCIÓN: SUGERENCIAS DE CATÁLOGO
        ════════════════════════════════════════════════════════ */}
        {section === 'suggestions' && (() => {
          const filteredSuggestions = suggestionsFilter === 'todos'
            ? suggestions
            : suggestions.filter(s => s.estado === suggestionsFilter);

          const ORIGEN_CFG = {
            voz:    { cls: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',     label: '🎙 Voz' },
            foto:   { cls: 'bg-purple-900/40 text-purple-300 border-purple-800', label: '📷 Foto' },
            manual: { cls: 'bg-slate-700 text-slate-300 border-slate-600',     label: '✏️ Manual' },
          };
          const ESTADO_S_CFG = {
            pendiente: { cls: 'bg-yellow-900/40 text-yellow-300 border-yellow-800', label: 'Pendiente' },
            aprobado:  { cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800', label: 'Aprobado' },
            rechazado: { cls: 'bg-red-900/40 text-red-300 border-red-800',     label: 'Rechazado' },
            fusionado: { cls: 'bg-blue-900/40 text-blue-300 border-blue-800',  label: 'Fusionado' },
          };

          const handleReject = async (sug: TradeCatalogSuggestion) => {
            try {
              await adminUpdateCatalogSuggestion(sug.id, { estado: 'rechazado' });
              setSuggestions(prev => prev.map(s => s.id === sug.id ? { ...s, estado: 'rechazado' } : s));
              toast('success', 'Sugerencia rechazada');
            } catch (e: unknown) { toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e))); }
          };

          return (
            <>
              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Pendientes',  value: suggestions.filter(s => s.estado === 'pendiente').length,  color: 'text-yellow-400' },
                  { label: 'Aprobadas',   value: suggestions.filter(s => s.estado === 'aprobado').length,   color: 'text-emerald-400' },
                  { label: 'Rechazadas',  value: suggestions.filter(s => s.estado === 'rechazado').length,  color: 'text-red-400' },
                  { label: 'Total',       value: suggestions.length,                                        color: 'text-slate-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Filtro estado */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['pendiente', 'aprobado', 'rechazado', 'todos'] as const).map(est => (
                  <button key={est} onClick={() => setSuggestionsFilter(est)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      suggestionsFilter === est
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {est === 'todos' ? 'Todas' : est.charAt(0).toUpperCase() + est.slice(1)}
                  </button>
                ))}
                <span className="text-xs text-slate-500 ml-auto">{filteredSuggestions.length} registros</span>
              </div>

              {/* Tabla */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Empresa', 'Descripción', 'Oficio / Familia', 'Precio indicado', 'Ud.', 'Origen', 'Estado', 'Fecha', 'Acciones'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {suggestionsLoading ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                          <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando sugerencias...
                        </td></tr>
                      ) : filteredSuggestions.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center">
                          <Globe className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                          <p className="text-slate-500 text-sm">No hay sugerencias en este estado</p>
                          <p className="text-slate-600 text-xs mt-1">Los instaladores sugieren productos cuando presupuestan artículos desconocidos</p>
                        </td></tr>
                      ) : filteredSuggestions.map(sug => {
                        const orig = ORIGEN_CFG[sug.origen] ?? ORIGEN_CFG.manual;
                        const est  = ESTADO_S_CFG[sug.estado] ?? ESTADO_S_CFG.pendiente;
                        return (
                          <tr key={sug.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                            <td className="px-3 py-2">
                              <span className="text-xs text-slate-300 font-medium">{sug.org_nombre ?? sug.org_id.slice(0, 8)}</span>
                            </td>
                            <td className="px-3 py-2 max-w-[200px]">
                              <span className="text-sm text-white">{sug.descripcion}</span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs text-slate-300">{sug.oficio ?? <span className="text-slate-600 italic">—</span>}</div>
                              <div className="text-[10px] text-slate-500">{sug.familia ?? '—'}</div>
                            </td>
                            <td className="px-3 py-2">
                              {sug.precio_indicado != null
                                ? <span className="text-sm font-bold text-yellow-400">{sug.precio_indicado.toFixed(2)} €</span>
                                : <span className="text-slate-600 italic text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-slate-400">{sug.unidad}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${orig.cls}`}>{orig.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${est.cls}`}>{est.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                                {new Date(sug.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {sug.estado === 'pendiente' && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setApproveModal(sug)} title="Aprobar y añadir al catálogo global"
                                    className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border bg-emerald-900/30 border-emerald-700 text-emerald-300 hover:bg-emerald-700 hover:text-white transition-colors">
                                    <ThumbsUp className="h-3 w-3" /> Aprobar
                                  </button>
                                  <button onClick={() => handleReject(sug)} title="Rechazar"
                                    className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer border bg-slate-700 border-slate-600 text-slate-400 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300 transition-colors">
                                    <ThumbsDown className="h-3 w-3" /> Rechazar
                                  </button>
                                </div>
                              )}
                              {sug.estado !== 'pendiente' && (
                                <span className="text-slate-600 text-xs italic">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}

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
            await adminLogAction('set_password', setPwdOrg.id);
            toast('success', `Contraseña cambiada para ${setPwdOrg.nombre}`);
          }}
        />
      )}

      {extendOrg && (
        <ExtendTrialModal
          org={extendOrg}
          onClose={() => setExtendOrg(null)}
          onSave={async (days) => {
            await adminExtendTrial(extendOrg.id, days);
            await adminLogAction('extend_trial', extendOrg.id, { days });
            await loadOrgs();
            toast('success', `Trial de ${extendOrg.nombre} extendido ${days} días`);
          }}
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

      {detailOrg && (
        <OrgDetailPanel
          org={detailOrg}
          adminEmail={session?.user?.email ?? ADMIN_EMAIL}
          onClose={() => setDetailOrg(null)}
          onFlagChanged={handleOrgFlagChanged}
          toast={toast}
        />
      )}

      {approveModal && (
        <SuggestionApproveModal
          sug={approveModal}
          onClose={() => setApproveModal(null)}
          onApproved={(updated) => {
            setSuggestions(prev => prev.map(s => s.id === updated.id ? updated : s));
            setApproveModal(null);
            toast('success', `"${updated.descripcion}" añadido al catálogo global`);
          }}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />

    </div>
  );
}
