import { CheckCircle, ArrowRight, Download, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ActivePage } from '../../types';

interface HeroSectionProps {
  setCurrentPage: (page: ActivePage) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BENEFITS = [
  'Presupuestos profesionales en minutos',
  'Materiales y proveedores integrados',
  'Partes de trabajo con fotos y firma',
  'Control total: planificación, equipo y facturación',
];

const SECTOR_BADGES = ['Reformas', 'Instalaciones', 'Jardinería', 'Limpieza', 'y más oficios'];

export default function HeroSection({ setCurrentPage }: HeroSectionProps) {
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

  const handleVerComoFunciona = () => {
    const el = document.getElementById('landing-como-funciona');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setCurrentPage(ActivePage.ComoFunciona);
    }
  };

  return (
    <section
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

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pt-6 pb-0 lg:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-4 lg:gap-8 items-start">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="space-y-5 text-center lg:text-left pb-12 lg:pb-20 lg:pt-8"
          >
            {/* eyebrow */}
            <div className="flex justify-center lg:justify-start">
              <span className="inline-block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#00CFE8] border border-[#00CFE8]/30 bg-[#00CFE8]/8 rounded-full px-4 py-1.5">
                La plataforma todo en uno para profesionales
              </span>
            </div>

            {/* headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black leading-[1.05] tracking-tight">
              <span className="text-white block">Tu trabajo más fácil.</span>
              <span className="text-[#00CFE8] block">En cualquier sector.</span>
            </h1>

            {/* subtitle */}
            <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
              Presupuestos, materiales, partes de trabajo, fotos, firma y facturación. Todo conectado, con la ayuda de la IA.
            </p>

            {/* benefits */}
            <ul className="space-y-2.5 text-sm text-white/80 max-w-md mx-auto lg:mx-0">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-start gap-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="group flex items-center justify-center gap-2 rounded-lg bg-[#FFC400] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all shadow-xl shadow-[#FFC400]/20 cursor-pointer"
              >
                Empezar gratis
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={handleVerComoFunciona}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                Ver cómo funciona
              </button>
            </div>
            <p className="text-[11px] text-white/35 text-center lg:text-left">
              Sin tarjeta de crédito · Prueba gratuita 3 meses
            </p>

            {/* PWA install */}
            {!isPWAInstalled && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center lg:text-left">
                  Instala la app gratis — sin tiendas
                </span>
                <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                  {installPrompt ? (
                    <button
                      onClick={handleInstallAndroid}
                      className="flex items-center gap-3 rounded-xl border border-[#00CFE8]/40 bg-[#00CFE8]/10 px-4 py-2.5 hover:bg-[#00CFE8]/20 transition-all cursor-pointer"
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
                        <div className="text-[9px] text-white/30 uppercase tracking-wider">Android / Chrome</div>
                        <div className="text-sm font-black text-white/50">Instalar app gratis</div>
                      </div>
                    </div>
                  )}
                  {isIOS && (
                    <button
                      onClick={() => setShowIOSInstructions(v => !v)}
                      className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <Share2 className="h-5 w-5 text-white/60 shrink-0" />
                      <div className="text-left leading-tight">
                        <div className="text-[9px] text-white/40 uppercase tracking-wider">iPhone / iPad</div>
                        <div className="text-sm font-black text-white">Instalar en iPhone</div>
                      </div>
                    </button>
                  )}
                </div>
                {showIOSInstructions && (
                  <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 space-y-1.5 text-xs text-white/65 max-w-xs">
                    <p className="font-bold text-white/80 text-[11px] uppercase tracking-wider mb-2">Cómo instalar en iPhone / iPad:</p>
                    <p className="flex items-start gap-2"><Share2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#00CFE8]" /> Pulsa <strong className="text-white">Compartir</strong> en Safari</p>
                    <p className="flex items-start gap-2"><span className="h-3.5 w-3.5 shrink-0 text-[#00CFE8] text-center font-black">+</span> Selecciona <strong className="text-white">"Añadir a pantalla de inicio"</strong></p>
                    <p className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#00CFE8]" /> Pulsa <strong className="text-white">Añadir</strong></p>
                  </div>
                )}
              </div>
            )}
            {isPWAInstalled && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                <CheckCircle className="h-4 w-4" />
                App instalada en tu dispositivo
              </div>
            )}

            {/* sector badges */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {SECTOR_BADGES.map(label => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/55"
                >
                  <span className="h-1 w-1 rounded-full bg-[#00CFE8] shrink-0" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — portadaoficios.png */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="relative flex justify-center lg:justify-end items-start overflow-hidden pb-0"
          >
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#020B16] to-transparent z-10 pointer-events-none" />
            <div className="absolute top-0 left-0 inset-y-0 w-28 bg-gradient-to-r from-[#020B16] to-transparent z-10 pointer-events-none hidden lg:block" />
            <img
              src="/portadaoficios.png"
              alt="TrabFlow para profesionales de distintos sectores"
              className="w-full h-auto object-contain object-top"
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
