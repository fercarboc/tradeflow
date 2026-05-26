/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage } from '../types';
import { registerUser, sendTrabflowEmail } from '../lib/supabase';
import {
  Droplets, Zap, Hammer, Wind, TreeDeciduous, KeyRound, Paintbrush,
  Layers, Wrench, Building2, ChevronRight, ChevronLeft, Check,
  ArrowRight, Eye, EyeOff, User, Mail, Phone, Lock, Building, Gift, Shield,
} from 'lucide-react';

interface RegistroViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

const TRADE_OPTIONS = [
  { id: 'Fontanería', label: 'Fontanería', Icon: Droplets },
  { id: 'Electricidad', label: 'Electricidad', Icon: Zap },
  { id: 'Reformas', label: 'Reformas', Icon: Hammer },
  { id: 'Climatización / HVAC', label: 'Climatización', Icon: Wind },
  { id: 'Madera / Carpintería', label: 'Madera / Carpintería', Icon: TreeDeciduous },
  { id: 'Cerrajería', label: 'Cerrajería', Icon: KeyRound },
  { id: 'Pintura', label: 'Pintura', Icon: Paintbrush },
  { id: 'Albañilería', label: 'Albañilería', Icon: Layers },
  { id: 'Otros', label: 'Otros oficios', Icon: Wrench },
];

const PLANS = [
  {
    id: 'basico' as const,
    name: 'Plan Básico',
    monthlyPrice: 29,
    yearlyPrice: 23,
    desc: 'Para autónomos con bajo volumen de trabajo.',
    features: ['Hasta 15 presupuestos PDF al mes', 'Conversión a factura básica', 'Envío por WhatsApp', 'Soporte por Email'],
  },
  {
    id: 'pro' as const,
    name: 'Plan Pro',
    monthlyPrice: 49,
    yearlyPrice: 39,
    desc: 'Para autónomos de alto volumen y microempresas.',
    features: ['Presupuestos por voz e imagen', 'PDFs ilimitados', 'Módulo de gastos', 'Soporte 1-on-1 WhatsApp'],
    popular: true,
  },
  {
    id: 'empresa' as const,
    name: 'Plan Empresa',
    monthlyPrice: 89,
    yearlyPrice: 71,
    desc: 'Para instaladoras con varios técnicos.',
    features: ['Todo lo del Plan Pro', 'Hasta 5 cuentas de técnicos', 'Panel financiero avanzado', 'Contratos de mantenimiento'],
  },
];

type Step = 1 | 2 | 3 | 4;

const inputClass =
  'w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 focus:border-[#00CFE8]/50 focus:outline-none transition-all';

export default function RegistroView({ setCurrentPage }: RegistroViewProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<'autonomo' | 'empresa'>('autonomo');
  const [selectedPlan, setSelectedPlan] = useState<'basico' | 'pro' | 'empresa'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: regError } = await registerUser({
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
      setStep(4);
      sendTrabflowEmail({
        type: 'welcome',
        nombre: (businessType === 'empresa' ? form.companyName.trim() : form.fullName.trim()) || form.fullName.trim(),
        email: form.email.trim(),
      });
    } finally {
      setLoading(false);
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
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[#FFC400]/10 border border-[#FFC400]/25 rounded-xl px-3 py-1.5 text-xs font-bold text-[#FFC400] mb-3">
              <Gift className="h-3.5 w-3.5" />
              3 meses completamente gratis
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Elige tu plan</h1>
            <p className="text-white/40 mt-2 text-sm">Sin tarjeta hasta el 4º mes. Cancela cuando quieras.</p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-full gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest cursor-pointer transition-all ${
                  billingCycle === 'monthly' ? 'bg-white text-[#020B16]' : 'text-white/50 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest cursor-pointer transition-all ${
                  billingCycle === 'yearly' ? 'bg-white text-[#020B16]' : 'text-white/50 hover:text-white'
                }`}
              >
                Anual
                <span className="bg-[#FFC400] text-[#020B16] text-[9px] font-black px-1.5 py-0.5 rounded-full">-20%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {PLANS.map(plan => {
              const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
              const selected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative flex flex-col p-5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                    selected
                      ? 'border-[#FFC400] bg-[#FFC400]/8'
                      : 'border-white/10 bg-white/5 hover:border-white/25'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#00CFE8] text-[#020B16] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                      Más popular
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-3 right-3 h-5 w-5 bg-[#FFC400] rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-[#020B16]" />
                    </span>
                  )}
                  <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${selected ? 'text-[#FFC400]' : 'text-white/40'}`}>
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className="text-3xl font-black text-white leading-none">{price}€</span>
                    <span className="text-[10px] text-white/35 ml-1">/mes+IVA</span>
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
              Continuar con {PLANS.find(p => p.id === selectedPlan)?.name}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Account ── */}
      {step === 3 && (
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Crea tu cuenta</h1>
            <p className="text-white/40 mt-2 text-sm">Empezarás tu período de prueba gratuito de 3 meses.</p>
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
            <Check className="h-8 w-8 text-[#00CFE8]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">¡Cuenta creada!</h1>
          <p className="text-white/45 text-sm leading-relaxed mb-2">
            Tu período de prueba gratuito de <strong className="text-white">3 meses</strong> ha comenzado.
          </p>
          <p className="text-white/30 text-xs mb-8">
            Si tu proveedor requiere verificación, revisa tu bandeja de entrada antes de continuar.
          </p>

          <div className="rounded-2xl border border-white/10 bg-[#0d1f38] p-5 mb-6 text-left space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-white/55">
              <Shield className="h-4 w-4 text-[#00CFE8] shrink-0" />
              3 meses gratis — sin tarjeta de crédito requerida
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/55">
              <Gift className="h-4 w-4 text-[#FFC400] shrink-0" />
              {PLANS.find(p => p.id === selectedPlan)?.name} activado
            </div>
          </div>

          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="w-full py-3.5 rounded-xl bg-[#FFC400] hover:brightness-110 text-[#020B16] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#FFC400]/15"
          >
            Ir al panel <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
