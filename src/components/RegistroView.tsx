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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-12 px-4 font-sans">
      {/* Top bar */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <button
          onClick={() => setCurrentPage(ActivePage.Home)}
          className="text-slate-500 hover:text-slate-900 text-sm font-medium flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="font-bold tracking-tight">TrabFlow</span>
        </button>
        {step < 4 && (
          <span className="text-xs text-slate-400 font-mono">Paso {step} de 3</span>
        )}
      </div>

      {/* Progress bar */}
      {step < 4 && (
        <div className="w-full max-w-2xl mb-8">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Step 1: Sector ── */}
      {step === 1 && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">¿En qué sector trabajas?</h1>
            <p className="text-slate-500 mt-2 text-sm">Selecciona tu oficio o especialidad. Puedes elegir varios.</p>
          </div>

          {/* Business type */}
          <div className="flex gap-3 mb-6 justify-center">
            {([['autonomo', 'Autónomo', User], ['empresa', 'Empresa', Building2]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                onClick={() => setBusinessType(val)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded border text-sm font-semibold cursor-pointer transition-all ${
                  businessType === val
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
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
                  className={`relative flex flex-col items-center gap-2 p-4 rounded border-2 text-sm font-semibold cursor-pointer transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2 right-2 h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
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
            className="w-full py-3.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Plan ── */}
      {step === 2 && (
        <div className="w-full max-w-3xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5 text-xs font-bold text-emerald-700 mb-3">
              <Gift className="h-3.5 w-3.5" />
              3 meses completamente gratis
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Elige tu plan</h1>
            <p className="text-slate-500 mt-2 text-sm">Sin tarjeta hasta el 4º mes. Cancela cuando quieras en plan mensual.</p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  billingCycle === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Anual <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded">-20%</span>
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
                  className={`relative flex flex-col p-5 rounded border-2 text-left cursor-pointer transition-all ${
                    selected ? 'border-blue-600 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                      Más popular
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-3 right-3 h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{plan.name}</div>
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className="text-3xl font-display font-bold text-slate-900">{price}€</span>
                    <span className="text-[10px] text-slate-400 font-mono">/mes+IVA</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{plan.desc}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Check className="h-3 w-3 text-emerald-600 shrink-0" />
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
              className="px-6 py-3.5 rounded border border-slate-200 text-slate-600 font-bold text-sm flex items-center gap-2 cursor-pointer hover:border-slate-400 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Crea tu cuenta</h1>
            <p className="text-slate-500 mt-2 text-sm">Empezarás tu período de prueba gratuito de 3 meses.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            {/* Full name */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                {businessType === 'empresa' ? 'Nombre de contacto' : 'Nombre completo'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej. Juan García"
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Company name (empresa only) */}
            {businessType === 'empresa' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Nombre de empresa</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Instalaciones García S.L."
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                Teléfono <span className="text-slate-400 normal-case font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+34 600 000 000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className={`w-full pl-9 pr-9 py-2.5 border rounded text-sm focus:outline-none focus:ring-1 ${
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-500 text-[11px] mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-xs text-slate-500 leading-relaxed">
                Acepto los{' '}
                <button
                  type="button"
                  onClick={() => setCurrentPage(ActivePage.AvisoLegal)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Términos de servicio
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  onClick={() => setCurrentPage(ActivePage.Privacidad)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Política de privacidad
                </button>
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{error}</div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3.5 rounded border border-slate-200 text-slate-600 font-bold text-sm flex items-center gap-2 cursor-pointer hover:border-slate-400 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canProceedStep3 || loading}
              className="flex-1 py-3.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
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

          <p className="text-center text-xs text-slate-400 mt-4">
            ¿Ya tienes cuenta?{' '}
            <button
              onClick={() => setCurrentPage(ActivePage.AppDashboard)}
              className="text-blue-600 hover:underline cursor-pointer font-semibold"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && (
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-6">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight mb-3">¡Cuenta creada!</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            Tu período de prueba gratuito de <strong>3 meses</strong> ha comenzado.
          </p>
          <p className="text-slate-400 text-xs mb-8">
            Si tu proveedor requiere verificación, revisa tu bandeja de entrada antes de continuar.
          </p>

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
              3 meses gratis — sin tarjeta de crédito requerida
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Gift className="h-4 w-4 text-blue-600 shrink-0" />
              Plan {PLANS.find(p => p.id === selectedPlan)?.name} activado
            </div>
          </div>

          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="w-full py-3.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            Ir al panel <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
