/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ActivePage, TradeType } from '../types';
import {
  Mic, FileText, Send, CheckCircle, ArrowRight,
  Zap, Wrench, Snowflake, Home as HomeIcon, Hammer, KeyRound,
  PaintRoller, BrickWall, PanelsTopLeft, Leaf, SquareStack,
  Blinds, RadioTower, Sun, ArrowUpDown, Car, Brush, Droplets, Camera,
  Monitor, Star, ShieldCheck, Users, Phone, Download, Share2,
  Handshake, PackageCheck, TrendingUp, Clock, EuroIcon, Lock,
} from 'lucide-react';
import { motion } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPWAInstalled(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallAndroid = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsPWAInstalled(true);
      setInstallPrompt(null);
    }
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

  const trades = [
    { label: 'Fontanería',           icon: Wrench },
    { label: 'Electricidad',         icon: Zap },
    { label: 'Climatización / HVAC', icon: Snowflake },
    { label: 'Reformas',             icon: HomeIcon },
    { label: 'Carpintería',          icon: Hammer },
    { label: 'Cerrajería',           icon: KeyRound },
    { label: 'Pintura',              icon: PaintRoller },
    { label: 'Albañilería',          icon: BrickWall },
    { label: 'Suelos y Tarimas',     icon: PanelsTopLeft },
    { label: 'Jardinería',           icon: Leaf },
    { label: 'Cristalería',          icon: SquareStack },
    { label: 'Persianas / Cierres',  icon: Blinds },
    { label: 'Telecomunicaciones',   icon: RadioTower },
    { label: 'Energía Solar',        icon: Sun },
    { label: 'Ascensores',           icon: ArrowUpDown },
    { label: 'Taller Mecánico',      icon: Car },
    { label: 'Limpieza Industrial',  icon: Brush },
    { label: 'Impermeabilización',   icon: Droplets },
    { label: 'CCTV / Seguridad',     icon: Camera },
  ];

  const proFeatures = [
    'Presupuestos ilimitados',
    'Clientes ilimitados',
    'Facturas ilimitadas',
    'Foto IA ilimitada',
    'Catálogo ilimitado',
  ];

  const empresaFeatures = [
    'Todo lo del plan Profesional',
    'Hasta 5 usuarios en equipo',
    'Roles y permisos granulares',
    'Módulo Ingresos y rentabilidad',
    'Trabajos externalizados + proveedores',
    'Gastos: material, facturas, mayoristas',
  ];

  const empresaPlusFeatures = [
    'Todo lo del plan Empresa',
    'Hasta 15 usuarios en equipo',
    'Módulo Contratos y mantenimientos',
    'Dashboard gastos y rentabilidad avanzado',
    'Soporte dedicado 1-on-1',
  ];

  const empresaPlusBadges = [
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
                  onClick={() => go(ActivePage.Demo)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-white/80 hover:border-white/60 hover:text-white transition-colors cursor-pointer"
                  id="hero-cta-demo"
                >
                  <Monitor className="h-4 w-4" />
                  Ver Demo
                </button>
              </div>

              {/* PWA install buttons */}
              {!isPWAInstalled && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center lg:text-left">
                    Instala la app gratis — sin tiendas
                  </span>
                  <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                    {/* Android/Chrome — prompt nativo si disponible */}
                    {installPrompt ? (
                      <button
                        onClick={handleInstallAndroid}
                        className="flex items-center gap-3 rounded-xl border border-[#00CFE8]/40 bg-[#00CFE8]/10 px-4 py-2.5 hover:bg-[#00CFE8]/20 transition-all cursor-pointer"
                        id="hero-install-android"
                      >
                        <Download className="h-5 w-5 text-[#00CFE8] shrink-0" />
                        <div className="text-left leading-tight">
                          <div className="text-[9px] text-white/45 uppercase tracking-wider">Android / Chrome</div>
                          <div className="text-sm font-black text-white">Instalar app gratis</div>
                        </div>
                      </button>
                    ) : !isIOS && (
                      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5">
                        <Download className="h-5 w-5 text-white/40 shrink-0" />
                        <div className="text-left leading-tight">
                          <div className="text-[9px] text-white/35 uppercase tracking-wider">Android / Chrome</div>
                          <div className="text-xs font-bold text-white/50">Abre en Chrome → Instalar</div>
                        </div>
                      </div>
                    )}
                    {/* Proveedores scroll CTA */}
                    <button
                      onClick={() => document.getElementById('proveedores-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="flex items-center gap-3 rounded-xl border border-[#FFC400]/35 bg-[#FFC400]/10 px-4 py-2.5 hover:bg-[#FFC400]/20 transition-all cursor-pointer"
                    >
                      <Handshake className="h-5 w-5 text-[#FFC400] shrink-0" />
                      <div className="text-left leading-tight">
                        <div className="text-[9px] text-[#FFC400]/70 uppercase tracking-wider">Empresas</div>
                        <div className="text-sm font-black text-white">Gestiona proveedores</div>
                      </div>
                    </button>
                    {/* iOS — instrucciones Share → Añadir a pantalla de inicio */}
                    <button
                      onClick={() => setShowIOSInstructions(!showIOSInstructions)}
                      className="flex items-center gap-3 rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 hover:border-white/45 hover:bg-black/60 transition-all cursor-pointer"
                      id="hero-install-ios"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white shrink-0">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.38.07 2.33.75 3.13.8 1.19-.24 2.33-.98 3.6-.84 1.54.18 2.69.87 3.44 2.17-3.13 1.87-2.38 5.98.48 7.13-.57 1.35-1.32 2.69-2.65 3.62zm-2.97-15c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <div className="text-left leading-tight">
                        <div className="text-[9px] text-white/45 uppercase tracking-wider">iPhone / iPad (iOS)</div>
                        <div className="text-sm font-black text-white">Instalar en iOS</div>
                      </div>
                    </button>
                  </div>
                  {/* Instrucciones iOS desplegables */}
                  {showIOSInstructions && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 space-y-1.5 text-xs text-white/65 max-w-xs"
                    >
                      <p className="font-bold text-white/80 text-[11px] uppercase tracking-wider mb-2">Cómo instalar en iPhone / iPad:</p>
                      <p className="flex items-start gap-2"><Share2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#00CFE8]" /> Pulsa el botón <strong className="text-white">Compartir</strong> de Safari (icono cuadrado con flecha)</p>
                      <p className="flex items-start gap-2"><span className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#00CFE8] text-center font-black">+</span> Selecciona <strong className="text-white">"Añadir a pantalla de inicio"</strong></p>
                      <p className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#00CFE8]" /> Pulsa <strong className="text-white">Añadir</strong> — ¡listo!</p>
                    </motion.div>
                  )}
                </div>
              )}
              {isPWAInstalled && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                  <CheckCircle className="h-4 w-4" />
                  App instalada en tu dispositivo
                </div>
              )}

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

              <div className="px-4 pb-4 pt-3 space-y-2">
                <button
                  onClick={() => go(ActivePage.Demo)}
                  className="w-full rounded-xl bg-[#00CFE8] py-2.5 text-xs font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer"
                >
                  Acceder a demo móvil
                </button>
                {installPrompt ? (
                  <button
                    onClick={handleInstallAndroid}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00CFE8]/30 bg-[#00CFE8]/10 py-2 hover:bg-[#00CFE8]/20 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#00CFE8]" />
                    <span className="text-[10px] font-bold text-[#00CFE8]">Instalar app en Android</span>
                  </button>
                ) : (
                  <p className="text-center text-[9px] text-white/30 leading-relaxed">
                    Android: Chrome → menú ⋮ → "Instalar app" · iOS: Safari → <Share2 className="inline h-2.5 w-2.5" /> → "Añadir a pantalla"
                  </p>
                )}
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
                  onClick={() => go(ActivePage.Demo)}
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
          3b. TRABAJA CON PROVEEDORES  (white)
      ══════════════════════════════════════════════════════ */}
      <section id="proveedores-section" className="bg-white py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-16">

          {/* Header */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block rounded-full bg-[#020B16] px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#FFC400] mb-5">
              Planes Empresa y Empresa+
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#020B16] uppercase tracking-tight leading-tight mb-4">
              ¿Te quedas sin manos?<br />
              <span className="text-[#00CFE8]">Subcontrata sin perder el control.</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Cuando tu equipo está completo o necesitas una especialidad puntual, delega el trabajo a otro instalador o empresa. TrabFlow gestiona todo el ciclo — desde pedir precio hasta pagar la factura — sin que tu cliente sepa que lo has externalizado.
            </p>
          </div>

          {/* Benefit rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Benefit 1 — Tiempo */}
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-7 flex gap-5">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#020B16] text-[#00CFE8] flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-[#020B16] mb-2">Ahorra horas de gestión manual</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Sin emails sueltos ni hojas de cálculo. Cada trabajo externalizado tiene su propia ficha con 10 estados de seguimiento: desde que contactas al proveedor hasta que pagas su factura. Todo en un solo lugar.
                </p>
              </div>
            </div>

            {/* Benefit 2 — Margen */}
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-7 flex gap-5">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#020B16] text-[#FFC400] flex items-center justify-center">
                <EuroIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-[#020B16] mb-2">Tu margen, siempre asegurado</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  La calculadora de margen integrada te muestra el precio al cliente en función de lo que te cobra el proveedor. Botones rápidos del 15 al 40% — el precio al cliente se calcula solo. Tú siempre sabes cuánto ganas.
                </p>
              </div>
            </div>

            {/* Benefit 3 — Cliente no lo ve */}
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-7 flex gap-5">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#020B16] text-[#00CFE8] flex items-center justify-center">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-[#020B16] mb-2">Tu cliente solo ve la partida de obra</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  En el presupuesto del cliente aparece la partida como cualquier otra. Nunca se menciona "subcontrata". Tú mantienes la relación con el cliente y la imagen de empresa que lo hace todo.
                </p>
              </div>
            </div>

            {/* Benefit 4 — Proveedores */}
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-7 flex gap-5">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#020B16] text-[#FFC400] flex items-center justify-center">
                <Handshake className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-[#020B16] mb-2">Directorio de proveedores colaboradores</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Da de alta a los instaladores y empresas con los que colaboras habitual­mente. Datos fiscales, área de cobertura, valoración y historial de trabajos. Siempre sabes a quién llamar según la especialidad.
                </p>
              </div>
            </div>

          </div>

          {/* Dark banner — material y gastos */}
          <div className="rounded-2xl bg-[#020B16] p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="inline-block rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#FFC400]">
                Además — Control de gastos
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-tight">
                Registra tus facturas<br />
                <span className="text-[#FFC400]">de material y proveedores</span>
              </h3>
              <p className="text-sm text-white/50 leading-relaxed max-w-md">
                En la sección Gastos puedes dar de alta a tus mayoristas y distribuidores de material, registrar sus facturas con el IVA correcto y ver en un vistazo cuánto tienes pendiente de pagar. Todo integrado con el panel de rentabilidad.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: <PackageCheck className="h-5 w-5" />, color: 'text-[#00CFE8]', title: 'Facturas de material', desc: 'IVA 0/10/21%, fecha de vencimiento, estado pagado/pendiente' },
                { icon: <TrendingUp className="h-5 w-5" />, color: 'text-[#FFC400]', title: 'Rentabilidad real', desc: 'Ingresos cobrados menos todos tus gastos = margen bruto real' },
                { icon: <Handshake className="h-5 w-5" />, color: 'text-[#00CFE8]', title: 'Directorio mayoristas', desc: 'Ficha fiscal completa de cada proveedor de material' },
                { icon: <CheckCircle className="h-5 w-5" />, color: 'text-[#FFC400]', title: 'Sin duplicidades', desc: 'Todo vinculado al trabajo o presupuesto correspondiente' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/8 p-4 space-y-1.5">
                  <div className={`${item.color}`}>{item.icon}</div>
                  <div className="text-sm font-black text-white">{item.title}</div>
                  <p className="text-xs text-white/40 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-4">Disponible en los planes Empresa (89€/mes) y Empresa+ (179€/mes)</p>
            <button
              onClick={() => go(ActivePage.Registro)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#020B16] px-8 py-4 text-sm font-black uppercase tracking-widest text-[#FFC400] hover:bg-[#0d1f38] transition-colors shadow-lg cursor-pointer"
            >
              Empieza gratis 15 días
              <ArrowRight className="h-4 w-4" />
            </button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">

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
                <p className="text-xs text-white/35 mt-1">Autónomo · 1 usuario</p>
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

            {/* Empresa — dark neutral */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 flex flex-col gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Empresa</div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white leading-none">89€</span>
                  <span className="text-sm text-white/35 mb-1">/mes</span>
                </div>
                <p className="text-xs text-white/35 mt-1">Hasta 5 usuarios</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {empresaFeatures.map((f) => (
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

            {/* Empresa+ — yellow highlight */}
            <div className="rounded-2xl bg-[#FFC400] p-7 flex flex-col gap-5 shadow-2xl shadow-[#FFC400]/15">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#020B16]/55 mb-2">Empresa+</div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-[#020B16] leading-none">179€</span>
                  <span className="text-sm text-[#020B16]/50 mb-1">/mes</span>
                </div>
                <p className="text-xs text-[#020B16]/50 mt-1">Hasta 15 usuarios</p>
              </div>
              <ul className="space-y-2.5 flex-1">
                {empresaPlusFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#020B16]/80">
                    <CheckCircle className="h-4 w-4 text-[#020B16] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-[#020B16]/10 p-4 space-y-2">
                {empresaPlusBadges.map((b) => (
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

          {/* Grid de oficios — igual que footer */}
          <div className="rounded-2xl bg-[#020B16] px-8 pt-8 pb-10 mb-12">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.28em] text-white mb-7">
              Ideal para{' '}
              <span className="text-[#00CFE8]">todo tipo de oficios</span>
            </p>
            <div className="grid grid-cols-3 gap-y-7 gap-x-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10">
              {trades.map(({ label, icon: Icon }) => (
                <div key={label} className="group flex flex-col items-center justify-start gap-2 px-1 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#00CFE8] group-hover:border-[#FFC400]/40 group-hover:text-[#FFC400] group-hover:bg-[#FFC400]/10 transition-all">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] leading-tight text-white/55 group-hover:text-white transition-colors max-w-[90px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
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

          {/* Banner invita a un colega */}
          <div className="mb-8 rounded-2xl overflow-hidden border border-[#FFC400]/20 cursor-pointer hover:border-[#FFC400]/50 transition-all" onClick={() => go(ActivePage.Registro)}>
            <img src="/invitacolega.png" alt="Invita a un colega y gana 1 mes gratis" className="w-full h-auto block" />
          </div>

          {/* Llamada + logo */}
          <div className="rounded-2xl bg-[#020B16] p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Phone */}
              <div className="text-center sm:text-left">
                <a href="tel:+34672336572" className="flex items-center gap-2 group">
                  <Phone className="h-5 w-5 text-[#00CFE8]" />
                  <span className="text-2xl font-black text-white group-hover:text-[#FFC400] transition-colors tracking-wider">
                    672 336 572
                  </span>
                </a>
                <p className="text-[10px] text-white/35 mt-1 uppercase tracking-widest">Llámanos ahora</p>
              </div>

              {/* Logo */}
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
      </section>

    </div>
  );
}
