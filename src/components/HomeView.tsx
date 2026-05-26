/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage, TradeType } from '../types';
import {
  Mic, FileText, Send, CheckCircle, ArrowRight,
  Zap,
  Monitor, Star, ShieldCheck, Users, Phone,
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
  setInitialMobile?: (isMobile: boolean) => void;
}

export default function HomeView({ setCurrentPage, setPreselectedTrade: _sp, setInitialMobile }: HomeViewProps) {

  const go = (page: ActivePage, isMobile?: boolean) => {
    if (page === ActivePage.AppDashboard && setInitialMobile && isMobile !== undefined) {
      setInitialMobile(isMobile);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ─── data ─────────────────────────────────────── */

  const steps = [
    { n: '1', label: 'DICTAS', sub: 'Dices o dictas lo que necesitan.', icon: <Mic className="h-7 w-7" /> },
    { n: '2', label: 'IA LO PREPARA', sub: 'La IA entiende y prepara tu presupuesto al instante.', icon: <Zap className="h-7 w-7" /> },
    { n: '3', label: 'ENVÍAS', sub: 'Envías por WhatsApp, email o con un click.', icon: <Send className="h-7 w-7" /> },
    { n: '4', label: 'APRUEBAN', sub: 'Tu cliente aprueba desde el móvil con un clic.', icon: <CheckCircle className="h-7 w-7" /> },
    { n: '5', label: 'FACTURAS', sub: 'Se factura solo. Sin escribir nada. Así de fácil.', icon: <FileText className="h-7 w-7" /> },
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

  const empresaBadges = [
    'Sin permanencia',
    'Actualizaciones incluidas',
    'Soporte cercano',
    'Prueba gratis 15 días',
  ];


  /* ─── render ────────────────────────────────────── */

  return (
    <div className="font-sans" id="home-view-container">

      {/* ══════════════════════════════════════════════════════
          1. HERO  (dark navy)
      ══════════════════════════════════════════════════════ */}
      <section
        id="home-hero-section"
        className="relative bg-[#020B16] overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 100% 90% at 75% 50%, #0b1e3a 0%, #020B16 60%)' }}
      >
        {/* subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-0 lg:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">

            {/* ── Left ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="space-y-5 text-center lg:text-left pb-12 lg:pb-20 lg:pt-8"
            >
              {/* headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black uppercase leading-[1.0] tracking-tight">
                <span className="text-white block">DICTAS.</span>
                <span className="text-[#FFC400] block underline decoration-[#00CFE8] decoration-4 underline-offset-4">TRABFLOW</span>
                <span className="text-white block">HACE EL RESTO.</span>
              </h1>

              {/* subtitle */}
              <p className="text-white/55 text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                Menos escribir. Más trabajar. Más clientes.<br />Más tiempo para ti.
              </p>

              {/* feature description */}
              <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto lg:mx-0 border-l-2 border-[#00CFE8]/40 pl-3">
                La IA te prepara el presupuesto con todos los precios de tus tarifas y mano de obra — o súbele una foto y te lo prepara por partidas. Cuando lo confirmas, se envía automáticamente por WhatsApp al cliente.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button
                  onClick={() => go(ActivePage.Registro)}
                  className="group flex items-center justify-center gap-2 rounded-lg bg-[#FFC400] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all shadow-xl shadow-[#FFC400]/20 cursor-pointer"
                  id="hero-cta-register"
                >
                  Prueba gratis 15 días
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => go(ActivePage.AppDashboard, false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-white/80 hover:border-white/60 hover:text-white transition-colors cursor-pointer"
                  id="hero-cta-demo"
                >
                  <Monitor className="h-4 w-4" />
                  Ver Demo
                </button>
              </div>

              {/* badges row — text only */}
              <div className="flex flex-wrap gap-5 justify-center lg:justify-start">
                {['Fácil de usar', 'Ahorra tiempo', 'Más clientes'].map((label) => (
                  <span
                    key={label}
                    className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/65"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00CFE8] shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* ── Right — instalador.png ─────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="relative flex justify-center lg:justify-end items-end overflow-hidden pb-0"
            >
              {/* blend top edge */}
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#020B16] to-transparent z-10 pointer-events-none" />
              {/* blend left edge on desktop */}
              <div className="absolute top-0 left-0 inset-y-0 w-20 bg-gradient-to-r from-[#020B16] to-transparent z-10 pointer-events-none hidden lg:block" />
              <img
                src="/instalador.png"
                alt="TRABFLOW en acción"
                className="w-full max-w-2xl object-contain object-bottom"
                style={{ maxHeight: '600px' }}
                id="hero-instalador-img"
              />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          2. ASÍ DE FÁCIL  (white)
      ══════════════════════════════════════════════════════ */}
      <section id="steps-section" className="bg-white py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Header */}
          <div className="text-center mb-16">
            <span className="inline-block rounded-full bg-[#020B16] px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#00CFE8] mb-5">
              Así de fácil
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#020B16] uppercase tracking-tight leading-tight">
              Sin complicaciones.<br className="sm:hidden" /> Sin papel.
            </h2>
            <p className="text-slate-400 text-base mt-4 max-w-lg mx-auto">
              De la voz al presupuesto en segundos. Sin formularios, sin errores, sin pérdida de tiempo.
            </p>
          </div>

          {/* 5 steps — big cards */}
          <div className="relative mb-12">
            {/* connecting line desktop */}
            <div className="absolute top-[2.6rem] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent pointer-events-none hidden lg:block" />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {steps.map((step) => (
                <div key={step.n} className="group flex flex-col items-center text-center gap-3 relative">
                  {/* icon with numbered badge */}
                  <div className="relative">
                    <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[#00CFE8] text-[#020B16] text-[9px] font-black flex items-center justify-center z-10 shadow-sm">
                      {step.n}
                    </div>
                    <div className="h-[4.5rem] w-[4.5rem] flex items-center justify-center rounded-2xl bg-[#020B16] text-[#00CFE8] shadow-lg shadow-[#020B16]/15 group-hover:scale-105 transition-transform">
                      {step.icon}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-[#00CFE8] uppercase tracking-widest leading-tight">{step.label}</span>
                  <p className="text-xs text-slate-400 leading-snug max-w-[110px]">{step.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features — dark full-width card */}
          <div className="rounded-2xl bg-[#020B16] p-8 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-3">
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                  Todo lo que necesitas,<br />
                  <span className="text-[#FFC400]">en una sola herramienta</span>
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  Sin aprendizajes complicados. Sin instalaciones. Solo dicta y TRABFLOW genera el presupuesto al instante.
                </p>
              </div>
              <div className="space-y-4">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                      <span className="text-sm text-white/65">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => go(ActivePage.Registro)}
                  className="w-full rounded-xl bg-[#FFC400] py-3 text-sm font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-[#FFC400]/15"
                >
                  Empieza hoy gratis
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          3. DEMO SECTION  (dark)
      ══════════════════════════════════════════════════════ */}
      <section id="demo-section" className="bg-[#020B16] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">

          {/* Section header */}
          <div className="text-center">
            <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45 mb-4">
              Pruébalo ahora
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              Disponible en móvil y PC
            </h2>
          </div>

          {/* 3-card grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* ── Card 1: Móvil ─────────────────── */}
            <div className="rounded-2xl border border-[#00CFE8]/35 bg-[#020B16] flex flex-col overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#00CFE8] mb-1.5">Demo móvil</div>
                <h3 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                  Lleva TRABFLOW<br />en el bolsillo
                </h3>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">
                  Presupuestos, clientes y facturas desde el móvil. Sin papeles.
                </p>
              </div>

              {/* image flush to bottom */}
              <div className="flex-1 flex items-end justify-center overflow-hidden px-6">
                <img
                  src="/movil_torcido.png"
                  alt="TRABFLOW app móvil"
                  className="w-36 object-contain object-bottom"
                />
              </div>

              <div className="px-4 pb-4 pt-3">
                <button
                  onClick={() => go(ActivePage.AppDashboard, true)}
                  className="w-full rounded-xl bg-[#00CFE8] py-2.5 text-xs font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer"
                >
                  Acceder a demo móvil
                </button>
              </div>
            </div>

            {/* ── Card 2: PC ────────────────────── */}
            <div className="rounded-2xl border border-white/20 bg-[#020B16] flex flex-col overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">Demo escritorio</div>
                <h3 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                  Panel completo<br />desde el ordenador
                </h3>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">
                  Gestión de obras, clientes, facturación y estadísticas en un solo lugar.
                </p>
              </div>

              <div className="flex-1 flex items-end justify-center overflow-hidden px-4">
                <img
                  src="/ORDENADOR.png"
                  alt="TRABFLOW escritorio"
                  className="w-full object-contain object-bottom"
                />
              </div>

              <div className="px-4 pb-4 pt-3">
                <button
                  onClick={() => go(ActivePage.AppDashboard, false)}
                  className="w-full rounded-xl border border-white/25 py-2.5 text-xs font-black uppercase tracking-widest text-white/65 hover:border-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  Ver demo en PC
                </button>
              </div>
            </div>

            {/* ── Card 3: Resultados ────────────── */}
            <div className="rounded-2xl border border-[#FFC400]/30 bg-[#020B16] flex flex-col overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#FFC400] mb-1.5">Resultados reales</div>
                <h3 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                  Lo que consiguen<br />nuestros instaladores
                </h3>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {[
                    { val: '3h', label: 'ahorradas al día' },
                    { val: '+120', label: 'instaladores activos' },
                    { val: '90s', label: 'por presupuesto' },
                    { val: '4.9★', label: 'valoración media' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 text-center">
                      <div className="text-lg font-black text-[#FFC400] leading-none">{s.val}</div>
                      <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5 leading-tight">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex items-end justify-center overflow-hidden px-6">
                <img
                  src="/movil_recto.png"
                  alt="TRABFLOW app resultados"
                  className="w-32 object-contain object-bottom"
                />
              </div>

              <div className="px-4 pb-4 pt-3">
                <button
                  onClick={() => go(ActivePage.Registro)}
                  className="w-full rounded-xl bg-[#FFC400] py-2.5 text-xs font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer"
                >
                  Empieza gratis 15 días
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          4. ELIGE TU PLAN  (dark navy)
      ══════════════════════════════════════════════════════ */}
      <section id="pricing-section" className="bg-[#030d1e] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center mb-12">
            <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45 mb-4">
              Elige tu plan
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              Sin letra pequeña
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">

            {/* Básico */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 flex flex-col gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Básico</div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white leading-none">29€</span>
                  <span className="text-sm text-white/35 mb-1">/mes</span>
                </div>
                <p className="text-xs text-white/35 mt-1">Individual · 1 usuario</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {basicFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/65">
                    <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => go(ActivePage.Registro)}
                className="w-full rounded-xl border border-white/20 py-3 text-sm font-bold uppercase tracking-wider text-white/60 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Empezar
              </button>
            </div>

            {/* Profesional */}
            <div className="rounded-2xl bg-[#0d1f38] border border-[#00CFE8]/30 p-7 flex flex-col gap-5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="rounded-full bg-[#00CFE8] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                  Más popular
                </span>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#00CFE8] mb-2">Profesional</div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white leading-none">49€</span>
                  <span className="text-sm text-white/35 mb-1">/mes</span>
                </div>
                <p className="text-xs text-white/35 mt-1">3-5 usuarios</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/65">
                    <CheckCircle className="h-4 w-4 text-[#00CFE8] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => go(ActivePage.Registro)}
                className="w-full rounded-xl bg-[#00CFE8]/15 border border-[#00CFE8]/40 py-3 text-sm font-bold uppercase tracking-wider text-[#00CFE8] hover:bg-[#00CFE8]/25 transition-colors cursor-pointer"
              >
                Empezar
              </button>
            </div>

            {/* Empresa — yellow */}
            <div className="rounded-2xl bg-[#FFC400] p-7 flex flex-col gap-5 shadow-2xl shadow-[#FFC400]/15">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#020B16]/55 mb-2">Empresa</div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-[#020B16] leading-none">89€</span>
                  <span className="text-sm text-[#020B16]/50 mb-1">/mes</span>
                </div>
                <p className="text-xs text-[#020B16]/50 mt-1">6-10 usuarios</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {empresaFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#020B16]/80">
                    <CheckCircle className="h-4 w-4 text-[#020B16] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {/* highlight badges */}
              <div className="rounded-xl bg-[#020B16]/10 p-4 space-y-2">
                {empresaBadges.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-xs font-bold text-[#020B16]">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
              <button
                onClick={() => go(ActivePage.Registro)}
                className="w-full rounded-xl bg-[#020B16] py-3 text-sm font-black uppercase tracking-widest text-[#FFC400] hover:bg-[#020B16]/80 transition-colors cursor-pointer shadow-md"
              >
                Prueba gratis 15 días
              </button>
            </div>

          </div>

          <p className="text-center text-xs text-white/30 mt-6">
            Prueba gratis 15 días sin tarjeta de crédito · Cancela cuando quieras
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          5. IDEAL PARA PROFESIONALES DE  (light)
      ══════════════════════════════════════════════════════ */}
      <section id="trades-section" className="bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* botones_profesionales.png — banner completo */}
          <div className="mb-12">
            <img
              src="/botones_profesionales.png"
              alt="Ideal para profesionales de: Reformas, Fontanería, Electricidad, Aire acondicionado, Carpintería, Pintura y muchos más"
              className="w-full object-contain rounded-2xl"
            />
          </div>

          {/* Google reviews + social proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-[#FFC400] text-[#FFC400]" />)}
              </div>
              <div>
                <div className="text-sm font-black text-[#020B16]">4.9 / 5.0</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">KRJ (221 valoraciones)</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5">
              <Users className="h-5 w-5 text-[#00CFE8]" />
              <div>
                <div className="text-sm font-black text-[#020B16]">+120 instaladores</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Beta activa</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5">
              <ShieldCheck className="h-5 w-5 text-[#FFC400]" />
              <div>
                <div className="text-sm font-black text-[#020B16]">RGPD compliant</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">100% legal España</div>
              </div>
            </div>
          </div>

          {/* DESCUBRE TRABFLOW — QR + phone */}
          <div className="rounded-2xl bg-[#020B16] p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Left: QR + text */}
              <div className="flex items-center gap-5">
                {/* QR code placeholder */}
                <div className="h-20 w-20 shrink-0 rounded-lg bg-white p-1.5">
                  <svg viewBox="0 0 40 40" className="h-full w-full">
                    {/* Simple QR-like grid */}
                    {[0,1,2,3,4,5,6].map(r => [0,1,2,3,4,5,6].map(c => {
                      const isCorner = (r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3);
                      const rand = ((r * 7 + c) * 131) % 17;
                      const fill = isCorner || rand < 8 ? '#020B16' : '#fff';
                      return <rect key={`${r}-${c}`} x={c*5.5+1} y={r*5.5+1} width={4.5} height={4.5} fill={fill} rx="0.5" />;
                    }))}
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-black uppercase tracking-wider text-[#FFC400]">Descubre TRABFLOW</div>
                  <p className="text-xs text-white/50 leading-tight">Escanea el QR o entra en<br /><span className="text-white/70 font-semibold">trabflow.com</span></p>
                </div>
              </div>

              {/* Center: phone number */}
              <div className="text-center">
                <a href="tel:+34672336572" className="flex items-center justify-center gap-2 group">
                  <Phone className="h-5 w-5 text-[#00CFE8]" />
                  <span className="text-2xl font-black text-white group-hover:text-[#FFC400] transition-colors tracking-wider">
                    672 336 572
                  </span>
                </a>
                <p className="text-[10px] text-white/35 mt-1 uppercase tracking-widest">Llámanos ahora</p>
              </div>

              {/* Right: CTA */}
              <div className="text-center md:text-right">
                <div className="inline-flex items-center gap-3 rounded-2xl bg-[#FFC400]/10 border border-[#FFC400]/20 px-5 py-3">
                  <img src="/tradeflow.png" alt="TRABFLOW" className="h-8 w-auto" />
                  <div className="text-left">
                    <div className="text-sm font-black text-[#FFC400] uppercase tracking-widest">TRABFLOW</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-wider">La herramienta que trabaja contigo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
