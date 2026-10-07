/**
 * CTAs Demo y Vídeo de Presentación — tests de la composición real de producción.
 *
 * HOME-CTA-1: #demo-cta-strip existe dentro de HeroSection (columna derecha, bajo portadaoficios.png)
 * HOME-CTA-2: solo existe UNA instancia de #demo-cta-strip en la Home real
 * HOME-CTA-3: "Ver demo guiada" → setCurrentPage(ActivePage.PartnerDemo)
 * HOME-CTA-4: enlace vídeo href = /trabflow.mp4
 * HOME-CTA-5: enlace vídeo tiene atributo download
 * HOME-CTA-6: LandingPage NO monta DemoCTAStrip como sección independiente
 *
 * Arquitectura real: ActivePage.Home → LandingPage → HeroSection (contiene #demo-cta-strip)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HeroSection from '../../components/landing/HeroSection';
import LandingPage from '../../pages/LandingPage';
import { ActivePage } from '../../types';

// ── motion/react: browser animation APIs no disponibles en jsdom ──────────────
vi.mock('motion/react', async () => {
  const React = await import('react');
  const makeEl = (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...rest }: any) => React.createElement(tag, rest, children);
  return {
    motion: { div: makeEl('div'), section: makeEl('section'), span: makeEl('span'), p: makeEl('p') },
    AnimatePresence: makeEl('div'),
  };
});

// ── Mocks para sub-componentes de LandingPage (HOME-CTA-6) ───────────────────
// Solo HeroSection queda real; el resto se neutraliza para estabilidad en jsdom.
vi.mock('../../components/landing/Navbar', () => ({ default: () => null }));
vi.mock('../../components/landing/PlanificacionSection', () => ({ default: () => null }));
vi.mock('../../components/landing/FuncionesSection', () => ({ default: () => null }));
vi.mock('../../components/landing/EcosistemaSection', () => ({ default: () => null }));
vi.mock('../../components/landing/DashboardSection', () => ({ default: () => null }));
vi.mock('../../components/landing/ProveedoresStrip', () => ({ default: () => null }));
vi.mock('../../components/landing/PartnerDemoStrip', () => ({ default: () => null }));
vi.mock('../../components/landing/PartnersSection', () => ({ default: () => null }));
vi.mock('../../components/landing/BetaSection', () => ({ default: () => null }));
vi.mock('../../components/landing/LandingFooter', () => ({ default: () => null }));

// ── Browser APIs requeridas por HeroSection ───────────────────────────────────
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

// ════════════════════════════════════════════════════════════════════════════════
// HOME-CTA-1 a HOME-CTA-5 — HeroSection renderiza el strip correctamente
// ════════════════════════════════════════════════════════════════════════════════
describe('HeroSection — Demo & Vídeo CTA strip (#demo-cta-strip)', () => {
  let mockSetCurrentPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetCurrentPage = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<HeroSection setCurrentPage={mockSetCurrentPage as any} />);
  });

  // HOME-CTA-1
  it('HOME-CTA-1: #demo-cta-strip existe en HeroSection (columna derecha, bajo imagen)', () => {
    expect(document.getElementById('demo-cta-strip')).not.toBeNull();
  });

  // HOME-CTA-3
  it('HOME-CTA-3: click "Ver demo guiada" navega a ActivePage.PartnerDemo (/demo-socios)', () => {
    fireEvent.click(screen.getByRole('button', { name: /ver demo guiada/i }));
    expect(mockSetCurrentPage).toHaveBeenCalledWith(ActivePage.PartnerDemo);
  });

  // HOME-CTA-4
  it('HOME-CTA-4: href del enlace de vídeo = /trabflow.mp4', () => {
    const link = screen.getByRole('link', { name: /descargar vídeo de presentación/i });
    expect(link).toHaveAttribute('href', '/trabflow.mp4');
  });

  // HOME-CTA-5
  it('HOME-CTA-5: enlace de vídeo tiene atributo download', () => {
    const link = screen.getByRole('link', { name: /descargar vídeo de presentación/i });
    expect(link).toHaveAttribute('download');
  });

  it('botón demo tiene aria-label correcto', () => {
    expect(
      screen.getByRole('button', { name: /ver demo guiada de trabflow/i }),
    ).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// HOME-CTA-2 & HOME-CTA-6 — LandingPage monta exactamente UN #demo-cta-strip
// ════════════════════════════════════════════════════════════════════════════════
describe('LandingPage — una sola instancia de #demo-cta-strip', () => {
  it('HOME-CTA-2 + HOME-CTA-6: exactamente 1 #demo-cta-strip en toda la LandingPage (no sección independiente)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<LandingPage setCurrentPage={vi.fn() as any} />);
    // HeroSection (real) produce 1 instancia; DemoCTAStrip ya no existe en LandingPage.
    // Si alguien reintrodujera DemoCTAStrip standalone, el conteo pasaría a 2 → fallo.
    expect(document.querySelectorAll('[id="demo-cta-strip"]')).toHaveLength(1);
  });
});
