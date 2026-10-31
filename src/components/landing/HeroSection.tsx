import {
  CheckCircle, ArrowRight, Download, Share2, Play, Wrench, Truck, User, type LucideIcon,
} from 'lucide-react';
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

// Imágenes del hero (WebP optimizadas, en public/).
const HERO_IMAGE = '/hero-ia-trabflow.webp';
const OFICIOS_IMAGE = '/hero-oficios.webp';
const TRANSPORTE_IMAGE = '/hero-transporte.webp';

const TRUST_POINTS = ['Sin tarjeta de crédito', 'Prueba gratuita sin compromiso', 'Sin permanencia'];

// Órdenes de voz de ejemplo sobre el visual (solo desde xl: en pantallas más
// estrechas taparían la imagen). Posiciones en % del bloque de imagen
// (aspect-ratio fijo, recortado por la derecha): el micrófono queda en torno
// a left 19% / top 53% y el panel empieza en left ~34%.
const VOICE_BUBBLES = [
  { text: '«Prepara un presupuesto para la instalación de aerotermia»', className: 'left-[1%] top-[5%]' },
  { text: '«Organiza las rutas de mañana y avisa a los conductores»', className: '-left-[3%] top-[74%]' },
  { text: '«Genera la factura del servicio de ayer y envíala al cliente»', className: 'left-[38%] bottom-[2%]' },
];

// Difumina los cuatro bordes de la imagen contra el fondo (intersección de dos degradados).
const HERO_IMAGE_MASK = {
  maskImage:
    'linear-gradient(to right, transparent 0%, #000 22%, #000 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, #000 22%, #000 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
} as const;

interface Vertical {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  image: string;
  imageAlt: string;
  features: string[];
  accent: { icon: string; check: string; button: string };
}

const VERTICALS: Vertical[] = [
  {
    title: 'Oficios e Instaladores',
    subtitle: 'Presupuestos, trabajos, materiales, partes y facturación.',
    icon: Wrench,
    image: OFICIOS_IMAGE,
    imageAlt: 'Instalador revisando una bomba de calor',
    features: [
      'Presupuestos con IA',
      'Gestión de trabajos y partes',
      'Catálogo de materiales y precios',
      'Facturación con VeriFactu',
      'Firma digital del cliente',
    ],
    accent: {
      icon: 'bg-[#1A5A96] text-white',
      check: 'text-[#00A8C6]',
      button: 'bg-[#1A5A96] hover:bg-[#1868B0] text-white focus-visible:ring-[#1A5A96]',
    },
  },
  {
    title: 'Transporte y Logística',
    subtitle: 'Viajeros, mercancías y reparto. Todo tu tráfico en un solo lugar.',
    icon: Truck,
    image: TRANSPORTE_IMAGE,
    imageAlt: 'Flota de autocar, camión y furgoneta',
    features: [
      'Rutas y agenda de servicios',
      'Gestión de flota y conductores',
      'Viajeros, mercancías y reparto',
      'Control de costes y tarifas',
      'Presupuestos de transporte con IA',
    ],
    accent: {
      icon: 'bg-[#FFC400] text-[#020B16]',
      check: 'text-[#D9A300]',
      button: 'bg-[#FFC400] hover:brightness-105 text-[#020B16] focus-visible:ring-[#FFC400]',
    },
  },
];

function VerticalCard({ vertical, onCta }: { vertical: Vertical; onCta: () => void }) {
  const Icon = vertical.icon;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Imagen: banda superior en móvil; fondo a la derecha desde sm (se funde a blanco por la izquierda). */}
      <div className="relative h-44 sm:absolute sm:inset-0 sm:h-auto">
        <img
          src={vertical.image}
          alt={vertical.imageAlt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-right"
        />
        <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-white via-white/85 to-transparent" />
      </div>

      <div className="relative p-6 sm:w-[62%] lg:p-7">
        <div className="flex items-start gap-3.5">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${vertical.accent.icon}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-black tracking-tight text-[#020B16]">{vertical.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{vertical.subtitle}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          {vertical.features.map(f => (
            <li key={f} className="flex items-start gap-2.5">
              <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${vertical.accent.check}`} aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={onCta}
          className={`group mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${vertical.accent.button}`}
        >
          Ver planes
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

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
    <>
      {/* ── Banda principal: IA aplicada al trabajo ─────────────────────────── */}
      <section
        className="relative overflow-hidden bg-[#020B16]"
        style={{ background: 'radial-gradient(ellipse 90% 90% at 70% 50%, #0b1e3a 0%, #020B16 62%)' }}
      >
        <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-8 px-4 pt-10 pb-10 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:px-10 lg:pt-14 lg:pb-14">

          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="relative z-10 space-y-6 text-center lg:text-left"
          >
            <div className="flex justify-center lg:justify-start">
              <span className="inline-block rounded-full border border-[#00CFE8]/30 bg-[#00CFE8]/10 px-4 py-1.5 text-xs font-semibold text-[#00CFE8]">
                IA aplicada a tu negocio
              </span>
            </div>

            <h1 className="text-[2rem] font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[2.75rem] xl:text-[3.25rem] 2xl:text-[3.75rem]">
              Díselo a <span className="text-[#00CFE8]">TrabFlow</span>
              <span className="block">y deja que se encargue</span>
            </h1>

            <p className="mx-auto max-w-xl text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
              Gestiona presupuestos, trabajos, rutas, flota y facturación con un asistente
              de inteligencia artificial que entiende tu negocio.
            </p>

            {/* CTAs */}
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="group flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#FFC400] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#020B16] shadow-xl shadow-[#FFC400]/20 transition-all hover:brightness-110 cursor-pointer"
              >
                Empezar gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={handleVerComoFunciona}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-white/10 cursor-pointer"
              >
                Ver cómo funciona
              </button>
            </div>

            {/* Sellos de confianza */}
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/75 lg:justify-start">
              {TRUST_POINTS.map(t => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>

            {/* Demo y vídeo + instalación de la app (discreto) */}
            <div className="space-y-3 border-t border-white/10 pt-5">
              <div
                id="demo-cta-strip"
                className="flex flex-col items-center gap-x-5 gap-y-2 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start"
              >
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-white/35">
                  Conoce TrabFlow en acción
                </span>
                <button
                  id="demo-cta-strip-demo"
                  onClick={() => setCurrentPage(ActivePage.PartnerDemo)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-bold text-[#00CFE8] transition-colors hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00CFE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020B16]"
                  aria-label="Ver demo guiada de TrabFlow — 5 minutos"
                >
                  <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Ver demo guiada
                </button>
                <a
                  id="demo-cta-strip-video"
                  href="/trabflow.mp4"
                  download
                  className="flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-bold text-white/60 transition-colors hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020B16]"
                  aria-label="Descargar vídeo de presentación de TrabFlow"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Descargar vídeo
                </a>
              </div>

              {!isPWAInstalled && (installPrompt || isIOS) && (
                <div className="flex flex-col items-center gap-2 lg:items-start">
                  {installPrompt ? (
                    <button
                      onClick={handleInstallAndroid}
                      className="flex items-center gap-2 text-xs font-semibold text-white/50 transition-colors hover:text-white cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Instala la app gratis, sin tiendas
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowIOSInstructions(v => !v)}
                      aria-expanded={showIOSInstructions}
                      className="flex items-center gap-2 text-xs font-semibold text-white/50 transition-colors hover:text-white cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Instalar la app en iPhone / iPad
                    </button>
                  )}
                  {showIOSInstructions && (
                    <div className="max-w-xs space-y-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-xs text-white/65">
                      <p className="flex items-start gap-2"><Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00CFE8]" /> Pulsa <strong className="text-white">Compartir</strong> en Safari</p>
                      <p className="flex items-start gap-2"><span className="h-3.5 w-3.5 shrink-0 text-center font-black text-[#00CFE8]">+</span> Selecciona <strong className="text-white">"Añadir a pantalla de inicio"</strong></p>
                      <p className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00CFE8]" /> Pulsa <strong className="text-white">Añadir</strong></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Visual: asistente de voz + panel de TrabFlow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="relative"
          >
            <div className="relative aspect-[186/100]">
              <img
                src={HERO_IMAGE}
                alt="Profesional dando una orden de voz al asistente de TrabFlow"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-right"
                style={HERO_IMAGE_MASK}
              />

              {VOICE_BUBBLES.map((b, i) => (
                <motion.div
                  key={b.text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.5 + i * 0.25 }}
                  className={`absolute hidden max-w-[13.5rem] items-center gap-2 rounded-2xl border border-white/40 bg-white/90 px-3 py-2 text-xs font-medium leading-snug text-[#0B1B33] shadow-xl shadow-[#00CFE8]/10 backdrop-blur xl:flex ${b.className}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A5A96] text-white">
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {b.text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Dos verticales ─────────────────────────────────────────────────── */}
      <section className="bg-[#F4F7FB] py-10 lg:py-14" aria-label="Soluciones por sector">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-10">
          {VERTICALS.map(v => (
            <VerticalCard key={v.title} vertical={v} onCta={() => setCurrentPage(ActivePage.Precios)} />
          ))}
        </div>
      </section>
    </>
  );
}
