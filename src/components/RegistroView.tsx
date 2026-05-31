/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage } from '../types';
import { supabase, registerUser, sendTrabflowEmail, applyReferralCode } from '../lib/supabase';
import {
  Droplets, Zap, Hammer, Wind, TreeDeciduous, KeyRound, Paintbrush,
  Layers, Wrench, Building2, ChevronRight, ChevronLeft, Check,
  ArrowRight, Eye, EyeOff, User, Mail, Phone, Lock, Building, Gift, Shield,
  Thermometer, Camera, Sun, Leaf, Wifi, Car, Sparkles, ArrowUpDown,
} from 'lucide-react';

interface RegistroViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

const TRADE_OPTIONS = [
  { id: 'Fontanería', label: 'Fontanería', Icon: Droplets },
  { id: 'Electricidad', label: 'Electricidad', Icon: Zap },
  { id: 'Climatización / HVAC', label: 'Climatización', Icon: Wind },
  { id: 'Calefacción', label: 'Calefacción', Icon: Thermometer },
  { id: 'Reformas', label: 'Reformas', Icon: Hammer },
  { id: 'Albañilería', label: 'Albañilería', Icon: Layers },
  { id: 'Carpintería / Ventanas', label: 'Carpintería', Icon: TreeDeciduous },
  { id: 'Cerrajería', label: 'Cerrajería', Icon: KeyRound },
  { id: 'Pintura', label: 'Pintura', Icon: Paintbrush },
  { id: 'Suelos y Tarimas', label: 'Suelos y Tarimas', Icon: Building2 },
  { id: 'Pladur / Escayola', label: 'Pladur / Escayola', Icon: Building },
  { id: 'Jardinería', label: 'Jardinería', Icon: Leaf },
  { id: 'Cristalería', label: 'Cristalería', Icon: Sparkles },
  { id: 'Persianas / Cierres', label: 'Persianas', Icon: Shield },
  { id: 'Telecomunicaciones', label: 'Telecom', Icon: Wifi },
  { id: 'CCTV / Seguridad', label: 'CCTV / Seguridad', Icon: Camera },
  { id: 'Energía Solar', label: 'Energía Solar', Icon: Sun },
  { id: 'Ascensores', label: 'Ascensores', Icon: ArrowUpDown },
  { id: 'Taller Mecánico', label: 'Taller Mecánico', Icon: Car },
  { id: 'Limpieza Industrial', label: 'Limpieza Industrial', Icon: Wrench },
];

const PLANS = [
  {
    id: 'basico' as const,
    name: 'Plan Básico',
    monthlyPrice: 29,
    yearlyPrice: 23,
    desc: 'Para autónomos con bajo volumen de trabajo.',
    features: ['Hasta 15 presupuestos/mes', 'Escáner foto IA (5/mes)', 'PDF profesional', 'Soporte por Email'],
  },
  {
    id: 'profesional' as const,
    name: 'Plan Profesional',
    monthlyPrice: 49,
    yearlyPrice: 39,
    desc: 'Para autónomos serios de alto volumen.',
    features: ['Presupuestos y facturas ilimitados', 'Voz + foto IA ilimitada', 'Planificación de trabajos', 'Soporte prioritario'],
    popular: true,
  },
  {
    id: 'empresa' as const,
    name: 'Plan Empresa',
    monthlyPrice: 89,
    yearlyPrice: 71,
    desc: 'Para microempresas con hasta 5 técnicos.',
    features: ['Todo lo del Plan Profesional', 'Hasta 5 usuarios en equipo', 'Roles y permisos', 'Soporte VIP'],
  },
  {
    id: 'empresa_plus' as const,
    name: 'Plan Empresa+',
    monthlyPrice: 179,
    yearlyPrice: 143,
    desc: 'Para empresas consolidadas con hasta 15 técnicos.',
    features: ['Todo lo del Plan Empresa', 'Hasta 15 usuarios', 'Módulo mantenimientos', 'Soporte 1-on-1 dedicado'],
  },
];

type Step = 1 | 2 | 3 | 4;

const inputClass =
  'w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 focus:border-[#00CFE8]/50 focus:outline-none transition-all';

export default function RegistroView({ setCurrentPage }: RegistroViewProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<'autonomo' | 'empresa'>('autonomo');
  const [selectedPlan, setSelectedPlan] = useState<'basico' | 'profesional' | 'empresa' | 'empresa_plus'>('profesional');
  const [billingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const toggleTrade = (id: string) => {
    setSelectedTrades(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const canProceedStep1 = selectedTrades.length > 0;
  const canProceedStep3 =
    form.fullName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.acceptTerms;

  const displayName = (businessType === 'empresa' ? form.companyName.trim() : form.fullName.trim()) || form.fullName.trim();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: regError, needsConfirmation: nc } = await registerUser({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        companyName: businessType === 'empresa' ? form.companyName.trim() : undefined,
        phone: form.phone.trim() || undefined,
        tradeTypes: selectedTrades,
        plan: selectedPlan,
        billingCycle,
      });
      if (regError) {
        setError(regError);
        return;
      }
      const code = form.referralCode.trim().toUpperCase();
      if (code) {
        if (!nc) {
          // Session available immediately — apply now
          await applyReferralCode(code);
        } else {
          // Confirmation required — apply after login
          localStorage.setItem('trabflow_pending_referral', code);
        }
      }
      setNeedsConfirmation(nc);
      setStep(4);
      if (!nc) {
        sendTrabflowEmail({ type: 'welcome', nombre: displayName, email: form.email.trim() });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendDone(false);
    try {
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: form.email.trim(), options: { emailRedirectTo: 'https://www.trabflow.com/auth/callback' } });
      if (!resendErr) setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020B16] flex flex-col items-center justify-start py-12 px-4 font-sans">

      {/* Top bar */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <button
          onClick={() => setCurrentPage(ActivePage.Home)}
          className="text-white/50 hover:text-white text-sm font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <img src="/tradeflow.png" alt="TRABFLOW" className="h-6 w-auto" />
          <span className="text-[#FFC400] font-black tracking-widest uppercase text-xs">TRABFLOW</span>
        </button>
        {step < 4 && (
          <span className="text-xs text-white/30 font-mono uppercase tracking-widest">Paso {step} de 3</span>
        )}
      </div>

      {/* Progress bar */}
      {step < 4 && (
        <div className="w-full max-w-2xl mb-10">
          <div className="h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00CFE8] rounded-full transition-all duration-500 shadow-sm shadow-[#00CFE8]/40"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {['Sector', 'Plan', 'Cuenta'].map((label, i) => (
              <span key={label} className={`text-[10px] uppercase tracking-widest font-bold ${step > i ? 'text-[#00CFE8]' : 'text-white/25'}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Sector ── */}
      {step === 1 && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">¿En qué sector trabajas?</h1>
            <p className="text-white/40 mt-2 text-sm">Selecciona tu oficio o especialidad. Puedes elegir varios.</p>
          </div>

          {/* Business type */}
          <div className="flex gap-3 mb-6 justify-center">
            {([['autonomo', 'Autónomo', User], ['empresa', 'Empresa', Building2]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                onClick={() => setBusinessType(val)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all border ${
                  businessType === val
                    ? 'bg-[#00CFE8] text-[#020B16] border-[#00CFE8]'
                    : 'bg-white/5 text-white/60 border-white/15 hover:border-white/35 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Trade type grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {TRADE_OPTIONS.map(({ id, label, Icon }) => {
              const selected = selectedTrades.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTrade(id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${
                    selected
                      ? 'border-[#00CFE8] bg-[#00CFE8]/10 text-[#00CFE8]'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2 right-2 h-4 w-4 bg-[#00CFE8] rounded-full flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-[#020B16]" />
                    </span>
                  )}
                  <Icon className="h-6 w-6" />
                  <span className="text-center text-xs leading-tight">{label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="w-full py-3.5 rounded-xl bg-[#FFC400] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[#020B16] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#FFC400]/15"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Plan ── */}
      {step === 2 && (
        <div className="w-full max-w-3xl">

          {/* Header BETA */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 bg-[#00CFE8]/15 border border-[#00CFE8]/40 rounded-2xl px-4 py-2 text-xs font-black text-[#00CFE8] mb-3 uppercase tracking-widest">
              <span>🚧</span>
              Versión Beta — En pruebas
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Elige tu plan</h1>
            <p className="text-white/40 mt-1.5 text-sm">Todos los planes son <span className="text-[#FFC400] font-black">completamente gratis</span> durante la Beta.</p>
          </div>

          {/* Aviso Beta — 2 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Gratis total */}
            <div className="bg-[#00CFE8]/8 border border-[#00CFE8]/25 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-xl shrink-0 mt-0.5">🎁</span>
              <div>
                <p className="text-[#00CFE8] font-black text-[11px] uppercase tracking-wider mb-1">Acceso 100% gratuito</p>
                <p className="text-white/50 text-[11px] leading-relaxed">
                  No se pide tarjeta de crédito. No se cobra nada. Puedes acceder incluso al <strong className="text-white/75">Plan Empresa+</strong> sin ningún coste durante la Beta.
                </p>
              </div>
            </div>
            {/* Puede tener errores */}
            <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-xl shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-amber-400 font-black text-[11px] uppercase tracking-wider mb-1">Versión en pruebas</p>
                <p className="text-white/50 text-[11px] leading-relaxed">
                  La app puede tener errores o cambios inesperados. Tu <strong className="text-white/75">feedback es muy valioso</strong> para mejorarla. Gracias por ser Beta tester.
                </p>
              </div>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {PLANS.map(plan => {
              const selected = selectedPlan === plan.id;
              const isTop = plan.id === 'empresa_plus';
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative flex flex-col p-4 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                    selected
                      ? 'border-[#FFC400] bg-[#FFC400]/8'
                      : isTop
                        ? 'border-[#00CFE8]/30 bg-[#00CFE8]/5 hover:border-[#00CFE8]/60'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#00CFE8] text-[#020B16] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                      Más popular
                    </span>
                  )}
                  {isTop && !selected && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#FFC400] text-[#020B16] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                      ⭐ Gratis en Beta
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-3 right-3 h-5 w-5 bg-[#FFC400] rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-[#020B16]" />
                    </span>
                  )}
                  <div className={`text-[10px] font-black uppercase tracking-wider mb-2 ${selected ? 'text-[#FFC400]' : isTop ? 'text-[#00CFE8]' : 'text-white/40'}`}>
                    {plan.name}
                  </div>
                  {/* Precio tachado + GRATIS */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-black text-white/20 line-through leading-none">{plan.monthlyPrice}€/mes</span>
                  </div>
                  <div className="mb-2">
                    <span className="bg-[#00CFE8]/20 text-[#00CFE8] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                      🎁 Gratis durante Beta
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 mb-3 leading-relaxed">{plan.desc}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[11px] text-white/55">
                        <Check className="h-3 w-3 text-[#00CFE8] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Nota reactivación */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-white/30 mb-6 text-center">
            <span>📞</span>
            <span>
              ¿Termina tu acceso? <strong className="text-white/50">Llámanos y te lo reactivamos gratis</strong> mientras sigamos en Beta. Sin tarjeta. Sin compromiso.
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-bold text-sm flex items-center gap-2 cursor-pointer hover:border-white/35 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3.5 rounded-xl bg-[#FFC400] hover:brightness-110 text-[#020B16] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#FFC400]/15"
            >
              Continuar — Acceso Gratis
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Account ── */}
      {step === 3 && (
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#00CFE8]/15 border border-[#00CFE8]/35 rounded-xl px-3 py-1.5 text-[10px] font-black text-[#00CFE8] mb-3 uppercase tracking-widest">
              🎁 Beta — Sin tarjeta de crédito
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Crea tu cuenta</h1>
            <p className="text-white/40 mt-2 text-sm">Acceso inmediato y gratuito. No se cobra nada.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d1f38] p-6 space-y-4">

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                {businessType === 'empresa' ? 'Nombre de contacto' : 'Nombre completo'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input type="text" placeholder="Ej. Juan García" value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>

            {businessType === 'empresa' && (
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">Nombre de empresa</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                  <input type="text" placeholder="Ej. Instalaciones García S.L." value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input type="email" placeholder="tucorreo@ejemplo.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                Teléfono <span className="text-white/25 normal-case font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input type="tel" placeholder="+34 600 000 000" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                Código de invitación <span className="text-white/25 normal-case font-normal">(opcional — 1 mes gratis)</span>
              </label>
              <div className="relative">
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFC400]/60" />
                <input type="text" placeholder="Ej. AB12CD" value={form.referralCode}
                  onChange={e => setForm(f => ({ ...f, referralCode: e.target.value.toUpperCase() }))}
                  maxLength={6}
                  className={inputClass + ' tracking-widest font-mono placeholder:font-sans placeholder:tracking-normal'} />
              </div>
              <p className="text-[10px] text-white/30 mt-1">Si un instalador te lo pasó, ganaréis un mes gratis cada uno.</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={inputClass + ' pr-9'} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input type={showConfirm ? 'text' : 'password'} placeholder="Repite la contraseña" value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className={inputClass + ' pr-9 ' + (form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500/50' : '')} />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-400 text-[11px] mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.acceptTerms}
                onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                className="mt-0.5 accent-[#00CFE8]" />
              <span className="text-xs text-white/35 leading-relaxed">
                Acepto los{' '}
                <button type="button" onClick={() => setCurrentPage(ActivePage.AvisoLegal)}
                  className="text-[#00CFE8] hover:underline cursor-pointer">Términos de servicio</button>
                {' '}y la{' '}
                <button type="button" onClick={() => setCurrentPage(ActivePage.Privacidad)}
                  className="text-[#00CFE8] hover:underline cursor-pointer">Política de privacidad</button>
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(2)}
              className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-bold text-sm flex items-center gap-2 cursor-pointer hover:border-white/35 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button onClick={handleSubmit} disabled={!canProceedStep3 || loading}
              className="flex-1 py-3.5 rounded-xl bg-[#FFC400] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[#020B16] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#FFC400]/15">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando cuenta...
                </span>
              ) : (
                <>Crear cuenta y empezar gratis <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-white/30 mt-4">
            ¿Ya tienes cuenta?{' '}
            <button onClick={() => setCurrentPage(ActivePage.AppDashboard)}
              className="text-[#00CFE8] hover:underline cursor-pointer font-bold">
              Inicia sesión
            </button>
          </p>
        </div>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && (
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[#00CFE8]/15 border border-[#00CFE8]/30 mb-6">
            {needsConfirmation ? <Mail className="h-8 w-8 text-[#00CFE8]" /> : <Check className="h-8 w-8 text-[#00CFE8]" />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
            {needsConfirmation ? '¡Revisa tu email!' : '¡Cuenta creada!'}
          </h1>
          <p className="text-white/45 text-sm leading-relaxed mb-2">
            {needsConfirmation
              ? <>Hemos enviado un enlace de confirmación a <strong className="text-white">{form.email.trim()}</strong>. Pulsa el enlace para activar tu cuenta.</>
              : <>Tu período de prueba gratuito de <strong className="text-white">15 días</strong> ha comenzado.</>}
          </p>
          {needsConfirmation && (
            <p className="text-white/30 text-xs mb-2">Si no lo ves, revisa la carpeta de spam.</p>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#0d1f38] p-5 mb-6 text-left space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-white/55">
              <Shield className="h-4 w-4 text-[#00CFE8] shrink-0" />
              15 días gratis — sin tarjeta de crédito requerida
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/55">
              <Gift className="h-4 w-4 text-[#FFC400] shrink-0" />
              {PLANS.find(p => p.id === selectedPlan)?.name} activado
            </div>
          </div>

          {needsConfirmation ? (
            <div className="space-y-3">
              <button
                onClick={handleResend}
                disabled={resendLoading || resendDone}
                className="w-full py-3.5 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/10"
              >
                {resendLoading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : resendDone ? (
                  <><Check className="h-4 w-4 text-emerald-400" /> Email reenviado</>
                ) : (
                  <>Reenviar email de activación</>
                )}
              </button>
              <button
                onClick={() => setCurrentPage(ActivePage.Login)}
                className="w-full py-3 text-white/40 hover:text-white text-xs transition-colors cursor-pointer"
              >
                Volver al login
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentPage(ActivePage.AppDashboard)}
              className="w-full py-3.5 rounded-xl bg-[#FFC400] hover:brightness-110 text-[#020B16] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#FFC400]/15"
            >
              Ir al panel <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
