/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage, TradeType } from '../types';
import {
  Mic, FileText, Send, CheckCircle, ArrowRight,
  Zap, Wind, Wrench, Hammer, Paintbrush, KeyRound, HardHat,
  Smartphone, Monitor, Star, ShieldCheck, Clock, Users, TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
  setInitialMobile?: (isMobile: boolean) => void;
}

export default function HomeView({ setCurrentPage, setPreselectedTrade: _setPreselectedTrade, setInitialMobile }: HomeViewProps) {
  const handleGoToApp = (isMobile: boolean) => {
    setInitialMobile?.(isMobile);
    setCurrentPage(ActivePage.AppDashboard);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToRegister = () => {
    setCurrentPage(ActivePage.Registro);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToWaitlist = () => {
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToPricing = () => {
    setCurrentPage(ActivePage.Precios);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const steps = [
    { n: '1', label: 'DICTAS', sub: 'Dices o dictas lo que necesitan.', icon: <Mic className="h-6 w-6" /> },
    { n: '2', label: 'IA LO PREPARA', sub: 'La IA entiende y prepara tu presupuesto al instante.', icon: <Zap className="h-6 w-6" /> },
    { n: '3', label: 'ENVÍAS', sub: 'Envías por WhatsApp, email o con un click.', icon: <Send className="h-6 w-6" /> },
    { n: '4', label: 'APRUEBAN', sub: 'Tu cliente aprueba desde el móvil con un clic.', icon: <CheckCircle className="h-6 w-6" /> },
    { n: '5', label: 'FACTURAS', sub: 'Se factura solo. Sin escribir nada. Así de fácil.', icon: <FileText className="h-6 w-6" /> },
  ];

  const trades = [
    { label: 'Reformas y construcción', icon: <HardHat className="h-6 w-6" /> },
    { label: 'Fontanería', icon: <Wrench className="h-6 w-6" /> },
    { label: 'Electricidad', icon: <Zap className="h-6 w-6" /> },
    { label: 'Aire acondicionado y climatización', icon: <Wind className="h-6 w-6" /> },
    { label: 'Carpinteros y aluminio', icon: <Hammer className="h-6 w-6" /> },
    { label: 'Pintura', icon: <Paintbrush className="h-6 w-6" /> },
    { label: 'Cerrajería', icon: <KeyRound className="h-6 w-6" /> },
  ];

  const features = [
    'Dicta con IA',
    'Presupuesto en segundos',
    'Envío por WhatsApp y email',
    'Control total de tu negocio',
    'Más tiempo para ti',
  ];

  const basicFeatures = [
    'Presupuestos con IA',
    'Envío por WhatsApp y Email',
    'PDF profesional',
    'Gestión clientes y pagos',
  ];

  const proFeatures = [
    'Todo lo del plan Básico',
    'Trabajadores y equipos',
    'Agenda de obras',
    'Recordatorios y vencimientos',
  ];

  const empresaFeatures = [
    'Todo lo del plan Profesional',
    'Multiempresa',
    'Gestión avanzada de permisos',
    'Integraciones y API',
  ];

  const empresaHighlights = [
    'Sin permanencia',
    'Actualizaciones incluidas',
    'Soporte cercano',
    'Prueba gratis 15 días',
  ];

  return (
    <div className="font-sans" id="home-view-container">

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 1 — HERO (dark)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="home-hero-section"
        className="relative bg-[#020B16] overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 120% 80% at 70% 30%, #0a1f3a 0%, #020B16 65%)' }}
      >
        {/* Subtle grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-7"
            >
              {/* Beta badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00CFE8]/30 bg-[#00CFE8]/10 px-4 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#00CFE8] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#00CFE8]">Beta pública · Prueba gratis 15 días</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05] uppercase">
                DICTAS.<br />
                <span className="text-[#FFC400]">TRABFLOW</span><br />
                HACE EL RESTO.
              </h1>

              {/* Subtext */}
              <p className="text-base sm:text-lg text-white/55 max-w-lg leading-relaxed">
                Menos escribir. Más trabajar. Más clientes.<br />Más tiempo para ti.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={handleGoToRegister}
                  className="group flex items-center justify-center gap-2.5 rounded-xl bg-[#FFC400] px-7 py-3.5 text-sm font-black uppercase tracking-widest text-[#020B16] hover:bg-[#ffd740] transition-colors shadow-xl shadow-[#FFC400]/25 cursor-pointer"
                  id="hero-cta-register"
                >
                  Prueba gratis 15 días
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => handleGoToApp(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-white/80 hover:border-white/50 hover:text-white transition-colors cursor-pointer"
                  id="hero-cta-demo"
                >
                  <Monitor className="h-4 w-4" />
                  Ver Demo
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                {[
                  { icon: <Zap className="h-4 w-4 text-[#FFC400]" />, label: 'Inteligencia Artificial' },
                  { icon: <Clock className="h-4 w-4 text-[#00CFE8]" />, label: 'Ahorra tiempo' },
                  { icon: <TrendingUp className="h-4 w-4 text-[#FFC400]" />, label: 'Más clientes, más ingresos' },
                  { icon: <ShieldCheck className="h-4 w-4 text-[#00CFE8]" />, label: 'Seguro y confiable' },
                ].map((b) => (
                  <span key={b.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    {b.icon}
                    {b.label}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Right column — device mockup */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative flex justify-center items-start"
            >
              {/* Desktop card behind */}
              <div className="hidden lg:block absolute top-8 right-0 w-[68%] rounded-2xl border border-white/10 bg-[#0d1f38] shadow-2xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#08111e] border-b border-white/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-[10px] text-white/30 font-mono">trabflow.app</span>
                </div>
                <img
                  src="/Screenshot_20260524_182756.jpg"
                  alt="TRABFLOW en escritorio"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '280px' }}
                />
              </div>

              {/* Phone frame in front */}
              <div className="relative z-10 w-44 sm:w-52 rounded-[2rem] border-4 border-[#1a2a40] bg-[#08111e] shadow-2xl overflow-hidden lg:translate-x-[-30%] lg:translate-y-8">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="h-1.5 w-12 rounded-full bg-white/20" />
                </div>
                <img
                  src="/Screenshot_20260524_182738.jpg"
                  alt="TRABFLOW en móvil"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '320px' }}
                />
              </div>

              {/* Floating stat badge */}
              <div className="absolute bottom-6 right-4 rounded-xl border border-[#FFC400]/30 bg-[#020B16]/80 backdrop-blur-sm px-4 py-3 shadow-xl">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Por cobrar</div>
                <div className="text-2xl font-black text-[#FFC400]">1.437€</div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <TrendingUp className="h-3 w-3" />
                  +18% este mes
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 2 — ASÍ DE FÁCIL (light)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="steps-section" className="bg-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center mb-14">
            <span className="inline-block rounded-full bg-[#020B16] px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#00CFE8] mb-4">
              Así de fácil
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#020B16] uppercase tracking-tight">
              Sin complicaciones. Sin papel.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">

            {/* 5 Steps */}
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row flex-wrap gap-0">
                {steps.map((step, i) => (
                  <div key={step.n} className="flex flex-row sm:flex-col items-start sm:items-center sm:text-center gap-4 sm:gap-3 flex-1 min-w-[120px] py-4 sm:py-0">
                    {/* Icon circle */}
                    <div className="shrink-0 flex flex-col sm:flex-row items-center gap-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#020B16] text-[#00CFE8] shadow-lg shadow-[#020B16]/20">
                        {step.icon}
                      </div>
                      {i < steps.length - 1 && (
                        <ArrowRight className="hidden sm:block h-5 w-5 text-slate-300 mx-1 shrink-0" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-[#00CFE8] uppercase tracking-widest">{step.n}. {step.label}</div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-[140px] mx-auto">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features list */}
            <div className="rounded-2xl bg-[#020B16] p-6 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">
                Todo lo que necesitas,<br />
                <span className="text-[#FFC400]">en una sola herramienta</span>
              </h3>
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                    <span className="text-sm text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleGoToRegister}
                className="mt-2 w-full rounded-xl bg-[#FFC400] py-3 text-sm font-black uppercase tracking-wider text-[#020B16] hover:bg-[#ffd740] transition-colors cursor-pointer"
              >
                Empieza hoy gratis
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 3 — DEMO (dark)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="demo-section" className="bg-[#020B16] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center mb-14">
            <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/50 mb-4">
              Pruébalo ahora
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              Elige cómo probarlo
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Mobile Demo */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1f38] p-8 flex flex-col items-center text-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-[#FFC400]/10 border border-[#FFC400]/20 flex items-center justify-center">
                <Smartphone className="h-7 w-7 text-[#FFC400]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Acceso a demo móvil</h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                  Lleva tu negocio en el bolsillo. Gestiona clientes, presupuestos y facturas desde cualquier lugar.
                </p>
              </div>
              <div className="w-36 rounded-[1.5rem] border-4 border-[#1a2a40] overflow-hidden shadow-xl">
                <img
                  src="/Screenshot_20260524_182738.jpg"
                  alt="Demo móvil TRABFLOW"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '220px' }}
                />
              </div>
              <button
                onClick={() => handleGoToApp(true)}
                className="w-full rounded-xl bg-[#FFC400] py-3 text-sm font-black uppercase tracking-widest text-[#020B16] hover:bg-[#ffd740] transition-colors cursor-pointer shadow-lg shadow-[#FFC400]/15"
              >
                Acceder a demo móvil
              </button>
            </div>

            {/* PC Demo */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1f38] p-8 flex flex-col items-center text-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-[#00CFE8]/10 border border-[#00CFE8]/20 flex items-center justify-center">
                <Monitor className="h-7 w-7 text-[#00CFE8]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Demo en PC</h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                  Accede desde tu ordenador y contrasta la herramienta completa. Prueba sin compromisos.
                </p>
              </div>
              <div className="w-full rounded-xl border-2 border-[#1a2a40] overflow-hidden shadow-xl">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#08111e]">
                  <div className="h-2 w-2 rounded-full bg-red-500/60" />
                  <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
                  <div className="h-2 w-2 rounded-full bg-green-500/60" />
                  <span className="ml-2 text-[9px] text-white/30 font-mono">trabflow.app</span>
                </div>
                <img
                  src="/Screenshot_20260524_182756.jpg"
                  alt="Demo escritorio TRABFLOW"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '180px' }}
                />
              </div>
              <button
                onClick={() => handleGoToApp(false)}
                className="w-full rounded-xl border border-[#00CFE8]/40 py-3 text-sm font-black uppercase tracking-widest text-[#00CFE8] hover:bg-[#00CFE8]/10 transition-colors cursor-pointer"
              >
                Ver demo en PC
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 4 — PRECIOS (dark navy)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="pricing-section" className="bg-[#030d1e] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center mb-14">
            <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/50 mb-4">
              Elige tu plan
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              Sin letra pequeña
            </h2>
            <p className="text-white/40 text-sm mt-3 max-w-md mx-auto">
              Planes diseñados para autónomos en solitario y empresas instaladoras. Prueba 15 días sin tarjeta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">

            {/* Básico */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 flex flex-col gap-6">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-white/40 mb-1">Básico</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">29€</span>
                  <span className="text-sm text-white/40 font-medium">/mes</span>
                </div>
                <p className="text-xs text-white/40 mt-1">Individual · 1 usuario</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {basicFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleGoToRegister}
                className="w-full rounded-xl border border-white/20 py-3 text-sm font-bold uppercase tracking-wider text-white/70 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Empezar
              </button>
            </div>

            {/* Profesional */}
            <div className="rounded-2xl bg-[#0d1f38] border border-[#00CFE8]/30 p-7 flex flex-col gap-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-[#00CFE8] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                  Más popular
                </span>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#00CFE8] mb-1">Profesional</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">49€</span>
                  <span className="text-sm text-white/40 font-medium">/mes</span>
                </div>
                <p className="text-xs text-white/40 mt-1">3-5 trabajadores</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleGoToRegister}
                className="w-full rounded-xl border border-[#00CFE8]/50 bg-[#00CFE8]/10 py-3 text-sm font-bold uppercase tracking-wider text-[#00CFE8] hover:bg-[#00CFE8]/20 transition-colors cursor-pointer"
              >
                Empezar
              </button>
            </div>

            {/* Empresa — highlighted yellow */}
            <div className="rounded-2xl bg-[#FFC400] p-7 flex flex-col gap-6 relative shadow-xl shadow-[#FFC400]/20">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#020B16]/60 mb-1">Empresa</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#020B16]">89€</span>
                  <span className="text-sm text-[#020B16]/60 font-medium">/mes</span>
                </div>
                <p className="text-xs text-[#020B16]/60 mt-1">6-10 trabajadores</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {empresaFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#020B16]/80">
                    <CheckCircle className="h-4 w-4 text-[#020B16] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-[#020B16]/15 pt-4 space-y-1.5">
                {empresaHighlights.map((h) => (
                  <div key={h} className="flex items-center gap-2 text-xs font-bold text-[#020B16]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#020B16]" />
                    {h}
                  </div>
                ))}
              </div>
              <button
                onClick={handleGoToRegister}
                className="w-full rounded-xl bg-[#020B16] py-3 text-sm font-black uppercase tracking-widest text-[#FFC400] hover:bg-[#020B16]/80 transition-colors cursor-pointer shadow-md"
              >
                Prueba gratis 15 días
              </button>
            </div>

          </div>

          <div className="mt-8 text-center">
            <button
              onClick={handleGoToPricing}
              className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            >
              Ver todos los detalles de precios →
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 5 — PROFESIONALES (light)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="trades-section" className="bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center mb-14">
            <span className="inline-block rounded-full bg-[#020B16] px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#FFC400] mb-4">
              Ideal para profesionales de:
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#020B16] uppercase tracking-tight">
              Hecho para tu oficio
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {trades.map((trade) => (
              <div
                key={trade.label}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center hover:border-[#FFC400]/50 hover:shadow-lg transition-all cursor-default"
              >
                <div className="h-12 w-12 rounded-xl bg-[#020B16] text-[#00CFE8] flex items-center justify-center group-hover:bg-[#FFC400] group-hover:text-[#020B16] transition-colors">
                  {trade.icon}
                </div>
                <span className="text-xs font-bold text-[#020B16] uppercase tracking-wide leading-tight">{trade.label}</span>
              </div>
            ))}
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-transparent p-6 text-center">
              <div className="h-12 w-12 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-2xl">
                ➕
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Y muchos más</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-[#FFC400] text-[#FFC400]" />)}
              </div>
              <div>
                <div className="text-sm font-black text-[#020B16]">4.9 / 5.0</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Valoraciones</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4">
              <Users className="h-6 w-6 text-[#00CFE8]" />
              <div>
                <div className="text-sm font-black text-[#020B16]">+120 instaladores</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Beta activa</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4">
              <ShieldCheck className="h-6 w-6 text-[#FFC400]" />
              <div>
                <div className="text-sm font-black text-[#020B16]">RGPD compliant</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">100% legal España</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN 6 — CTA FINAL (dark)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="final-cta-section" className="bg-[#020B16] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Empieza hoy.<br />
            <span className="text-[#FFC400]">Sin compromisos.</span>
          </h2>
          <p className="text-white/50 text-base leading-relaxed">
            15 días gratis, sin tarjeta. Cancela cuando quieras. Más de 120 instaladores ya lo usan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleGoToRegister}
              className="group flex items-center justify-center gap-2.5 rounded-xl bg-[#FFC400] px-8 py-4 text-sm font-black uppercase tracking-widest text-[#020B16] hover:bg-[#ffd740] transition-colors shadow-xl shadow-[#FFC400]/25 cursor-pointer"
            >
              Prueba gratis 15 días
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={handleGoToWaitlist}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white/70 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
            >
              Contactar con ventas
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
