import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide } from '../../lib/marketplace-ad-types';

// INVARIANTE: Las campañas/hero dan visibilidad comercial pero NUNCA alteran
// el orden del comparador, el precio, el score ni la recomendación de proveedor.
// Las posiciones en rankings se calculan exclusivamente por precio y disponibilidad.

// Re-exportamos HeroSlide para compatibilidad con importaciones antiguas.
export type { HeroSlide };

// Tipo legacy para compatibilidad interna (alias).
export type MarketplaceHeroItem = HeroSlide;

interface Props {
  slides:        HeroSlide[];
  onGoToCatalog: (oficio?: string | null, search?: string) => void;
  className?:    string;
}

export default function MarketplaceHeroCarousel({ slides, onGoToCatalog, className = '' }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused,  setPaused]  = useState(false);

  const total = slides.length;

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent(c => (c - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (paused || total < 2) return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next, paused, total]);

  // Clampar índice si slides cambian en runtime
  const idx   = Math.min(current, total - 1);
  const slide = slides[idx];

  if (!slide) return null;

  function handleCta() {
    if (slide.action === 'category') onGoToCatalog(slide.category ?? null);
    else if (slide.action === 'search') onGoToCatalog(null, slide.searchQuery);
    else onGoToCatalog();
  }

  const hasTextOverlay = !slide.imageUrl || Boolean(slide.price ?? slide.discount ?? false);
  const gradient = slide.gradient ?? 'linear-gradient(135deg, #1A5A96 0%, #2d7dd2 100%)';
  const patternColor = slide.patternColor ?? 'rgba(255,255,255,0.04)';

  return (
    <div
      className={`relative rounded-2xl overflow-hidden select-none ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Slide con imagen sin overlay de texto ──────────────────────────── */}
      {slide.imageUrl && !hasTextOverlay ? (
        <button
          onClick={handleCta}
          className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={slide.ctaLabel}
        >
          <img
            key={slide.imageUrl}
            src={slide.imageUrl}
            alt={slide.title}
            className="w-full object-cover"
            style={{ height: 'clamp(160px, 28vw, 280px)', display: 'block' }}
            draggable={false}
          />
        </button>
      ) : (
        /* ── Slide con texto superpuesto (imagen como bg o gradiente CSS) ─── */
        <div
          className="relative"
          style={{
            background:  slide.imageUrl ? undefined : gradient,
            minHeight:   'clamp(160px, 28vw, 280px)',
            transition:  'background 0.5s ease',
          }}
        >
          {/* Imagen como fondo si está disponible con texto overlay */}
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Overlay oscuro para legibilidad del texto */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Patrón decorativo (solo sin imagen) */}
          {!slide.imageUrl && (
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke={patternColor} strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hgrid)" />
              </svg>
            </div>
          )}

          {/* Contenido de texto */}
          <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8 flex flex-col justify-between gap-4"
            style={{ minHeight: 'clamp(160px, 28vw, 280px)' }}
          >
            <div className="space-y-2">
              {slide.eyebrow && (
                <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                  {slide.eyebrow}
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
              {/* Bloque de precio para slides de producto */}
              {slide.price && (
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-white">{slide.price}</span>
                  {slide.previousPrice && (
                    <span className="text-sm text-white/50 line-through">{slide.previousPrice}</span>
                  )}
                  {slide.discount && (
                    <span className="text-xs font-black bg-white text-[#1A5A96] px-2 py-0.5 rounded-lg">
                      {slide.discount}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleCta}
              className="self-start bg-white text-[#1A5A96] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/95 transition-colors shadow-sm min-h-[44px]"
            >
              {slide.ctaLabel}
            </button>
          </div>
        </div>
      )}

      {/* ── Flecha izquierda ─────────────────────────────────────────────── */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          aria-label="Anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* ── Flecha derecha ───────────────────────────────────────────────── */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          aria-label="Siguiente"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* ── Dots ─────────────────────────────────────────────────────────── */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
              aria-label={`Slide ${i + 1}`}
              className={`rounded-full transition-all min-w-[8px] min-h-[8px] ${
                i === idx
                  ? 'bg-white w-5 h-2'
                  : 'bg-white/50 w-2 h-2 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
