import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// INVARIANT: Las campañas/hero dan visibilidad comercial pero NUNCA alteran
// el orden del comparador, el precio, el score ni la recomendación de proveedor.
// Las posiciones en rankings se calculan exclusivamente por precio y disponibilidad.

export interface MarketplaceHeroItem {
  id:           string;
  title:        string;
  subtitle?:    string;
  badge?:       string;
  ctaLabel:     string;
  action:       'catalog' | 'category' | 'search';
  category?:    string;
  searchQuery?: string;
  gradient:     string;
  patternColor: string;
}

const RC1_SLIDES: MarketplaceHeroItem[] = [
  {
    id:           'hero-general',
    title:        'Todo lo que necesitas para tu obra',
    subtitle:     'Compara precios entre distribuidores y elige el mejor proveedor al instante',
    badge:        'Materiales profesionales',
    ctaLabel:     'Ver catálogo completo',
    action:       'catalog',
    gradient:     'linear-gradient(135deg, #1A5A96 0%, #2d7dd2 60%, #1a9dd9 100%)',
    patternColor: 'rgba(255,255,255,0.04)',
  },
  {
    id:           'hero-fontaneria',
    title:        'Fontanería y saneamiento',
    subtitle:     'Tubería, valvulería, accesorios y más. Disponibilidad inmediata.',
    badge:        'Categoría destacada',
    ctaLabel:     'Ver fontanería',
    action:       'category',
    category:     'fontaneria',
    gradient:     'linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)',
    patternColor: 'rgba(255,255,255,0.05)',
  },
  {
    id:           'hero-electricidad',
    title:        'Electricidad e instalaciones',
    subtitle:     'Cable, cuadros, iluminación, automatización. Todo en un pedido.',
    badge:        'Categoría destacada',
    ctaLabel:     'Ver electricidad',
    action:       'category',
    category:     'electricidad',
    gradient:     'linear-gradient(135deg, #78350f 0%, #b45309 60%, #d97706 100%)',
    patternColor: 'rgba(255,255,255,0.05)',
  },
];

interface Props {
  onGoToCatalog: (oficio?: string | null, search?: string) => void;
  className?:    string;
}

export default function MarketplaceHeroCarousel({ onGoToCatalog, className = '' }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused,  setPaused]  = useState(false);

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % RC1_SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent(c => (c - 1 + RC1_SLIDES.length) % RC1_SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next, paused]);

  const slide = RC1_SLIDES[current];

  function handleCta() {
    if (slide.action === 'category') onGoToCatalog(slide.category ?? null);
    else if (slide.action === 'search') onGoToCatalog(null, slide.searchQuery);
    else onGoToCatalog();
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden select-none ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ background: slide.gradient, transition: 'background 0.5s ease' }}
    >
      {/* Patrón de fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hgrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke={slide.patternColor} strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hgrid)" />
        </svg>
      </div>

      {/* Contenido */}
      <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8 min-h-[160px] sm:min-h-[200px] flex flex-col justify-between">
        <div className="space-y-2">
          {slide.badge && (
            <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              {slide.badge}
            </span>
          )}
          <h2 className="text-white font-black text-xl sm:text-2xl leading-tight max-w-xs sm:max-w-md">
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-white/80 text-xs sm:text-sm leading-relaxed max-w-xs sm:max-w-sm">
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={handleCta}
            className="bg-white text-[#1A5A96] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/95 transition-colors shadow-sm min-h-[44px]"
          >
            {slide.ctaLabel}
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5 mr-1">
            {RC1_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Slide ${i + 1}`}
                className={`rounded-full transition-all min-w-[8px] min-h-[8px] ${
                  i === current
                    ? 'bg-white w-5 h-2'
                    : 'bg-white/40 w-2 h-2 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Flecha izquierda */}
      <button
        onClick={prev}
        aria-label="Anterior"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Flecha derecha */}
      <button
        onClick={next}
        aria-label="Siguiente"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
