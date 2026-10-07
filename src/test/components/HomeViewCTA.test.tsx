/**
 * HomeView — CTAs Demo y Vídeo de Presentación
 *
 * HOME-CTA-1: botón "Ver demo guiada" existe
 * HOME-CTA-2: click → setCurrentPage(ActivePage.PartnerDemo) (/demo-socios)
 * HOME-CTA-3: enlace "Descargar vídeo de presentación" existe
 * HOME-CTA-4: href = /trabflow.mp4
 * HOME-CTA-5: enlace tiene atributo download
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HomeView from '../../components/HomeView';
import { ActivePage } from '../../types';

// motion/react uses browser animation APIs not available in jsdom — replace with plain HTML
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

// Minimal mocks required for HomeView to render in jsdom
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

describe('HomeView — Demo & Vídeo CTA strip (#demo-cta-strip)', () => {
  let mockSetCurrentPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetCurrentPage = vi.fn();
    render(
      <HomeView
        setCurrentPage={mockSetCurrentPage}
        setPreselectedTrade={vi.fn()}
      />,
    );
  });

  // HOME-CTA-1
  it('HOME-CTA-1: existe botón "Ver demo guiada"', () => {
    expect(screen.getByRole('button', { name: /ver demo guiada/i })).toBeInTheDocument();
  });

  // HOME-CTA-2
  it('HOME-CTA-2: click en demo guiada navega a ActivePage.PartnerDemo (/demo-socios)', () => {
    fireEvent.click(screen.getByRole('button', { name: /ver demo guiada/i }));
    expect(mockSetCurrentPage).toHaveBeenCalledWith(ActivePage.PartnerDemo);
  });

  // HOME-CTA-3
  it('HOME-CTA-3: existe enlace "Descargar vídeo de presentación"', () => {
    expect(screen.getByRole('link', { name: /descargar vídeo de presentación/i })).toBeInTheDocument();
  });

  // HOME-CTA-4
  it('HOME-CTA-4: href del enlace de vídeo = /trabflow.mp4', () => {
    const link = screen.getByRole('link', { name: /descargar vídeo de presentación/i });
    expect(link).toHaveAttribute('href', '/trabflow.mp4');
  });

  // HOME-CTA-5
  it('HOME-CTA-5: enlace de vídeo tiene atributo download (descarga, no reproducción embebida)', () => {
    const link = screen.getByRole('link', { name: /descargar vídeo de presentación/i });
    expect(link).toHaveAttribute('download');
  });

  // Verificación extra: sección tiene id correcto
  it('la sección CTA tiene id="demo-cta-strip"', () => {
    expect(document.getElementById('demo-cta-strip')).not.toBeNull();
  });
});
