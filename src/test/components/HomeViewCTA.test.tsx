/**
 * DemoCTAStrip — CTAs Demo y Vídeo de Presentación
 *
 * Nota: el componente producción se muestra en LandingPage (la Home pública real).
 * Se testea DemoCTAStrip directamente para evitar el coste de montar LandingPage completa.
 *
 * HOME-CTA-1: botón "Ver demo guiada" existe
 * HOME-CTA-2: click → setCurrentPage(ActivePage.PartnerDemo) (/demo-socios)
 * HOME-CTA-3: enlace "Descargar vídeo de presentación" existe
 * HOME-CTA-4: href = /trabflow.mp4
 * HOME-CTA-5: enlace tiene atributo download
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DemoCTAStrip from '../../components/landing/DemoCTAStrip';
import { ActivePage } from '../../types';

describe('DemoCTAStrip — Demo & Vídeo CTA strip (#demo-cta-strip)', () => {
  let mockSetCurrentPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetCurrentPage = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<DemoCTAStrip setCurrentPage={mockSetCurrentPage as any} />);
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
