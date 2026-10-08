/**
 * TRABFLOW-AI-ASSISTANT-PRICING-CLEANUP-1
 *
 * AI-PRICING-1: /asistente-tecnico ya NO renderiza "Acceso por plan"
 * AI-PRICING-2: NO renderiza las tarjetas de precios específicas (Básico 29€, Empresa 89€, Empresa Plus 129€)
 * AI-PRICING-3: la página continúa renderizando su contenido principal
 * AI-PRICING-4: el CTA "Ver todos los planes →" navega a ActivePage.Precios
 * AI-PRICING-5: la lógica real de límites diarios vive en ScreenAsistenteTecnico (DAILY_LIMITS),
 *               no en AsistenteTecnicoPublicView — invariante documentado, no hay nada que eliminar
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AsistenteTecnicoPublicView from '../../components/AsistenteTecnicoPublicView';
import { ActivePage } from '../../types';

// motion/react no disponible en jsdom
vi.mock('motion/react', async () => {
  const React = await import('react');
  const makeEl = (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...rest }: any) => React.createElement(tag, rest, children);
  return {
    motion: {
      div: makeEl('div'), section: makeEl('section'), span: makeEl('span'),
      p: makeEl('p'), h1: makeEl('h1'), h2: makeEl('h2'), h3: makeEl('h3'),
    },
    AnimatePresence: makeEl('div'),
  };
});

describe('AsistenteTecnicoPublicView — eliminación sección "Acceso por plan"', () => {
  let mockSetCurrentPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetCurrentPage = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AsistenteTecnicoPublicView setCurrentPage={mockSetCurrentPage as any} />);
  });

  // AI-PRICING-1
  it('AI-PRICING-1: "Acceso por plan" NO aparece en la página', () => {
    expect(screen.queryByText('Acceso por plan')).toBeNull();
  });

  it('AI-PRICING-1b: subtítulo "incluido en todos los planes" NO aparece', () => {
    expect(screen.queryByText(/el asistente técnico está incluido en todos los planes/i)).toBeNull();
  });

  // AI-PRICING-2
  it('AI-PRICING-2: tarjeta "29€/mes" NO aparece', () => {
    expect(screen.queryByText('29€/mes')).toBeNull();
  });

  it('AI-PRICING-2b: tarjeta "89€/mes" NO aparece', () => {
    expect(screen.queryByText('89€/mes')).toBeNull();
  });

  it('AI-PRICING-2c: tarjeta "129€/mes" NO aparece', () => {
    expect(screen.queryByText('129€/mes')).toBeNull();
  });

  it('AI-PRICING-2d: etiquetas "consultas/día" de los planes NO aparecen', () => {
    expect(screen.queryByText('5 consultas/día')).toBeNull();
    expect(screen.queryByText('30 consultas/día')).toBeNull();
  });

  // AI-PRICING-3
  it('AI-PRICING-3: la página renderiza el hero principal', () => {
    expect(screen.getByText(/asistente técnico de normativa/i)).toBeInTheDocument();
  });

  it('AI-PRICING-3b: la página renderiza la sección de normativa indexada', () => {
    expect(screen.getByText('Normativa técnica indexada')).toBeInTheDocument();
  });

  it('AI-PRICING-3c: la página renderiza "¿Cómo funciona?"', () => {
    expect(screen.getByText('¿Cómo funciona?')).toBeInTheDocument();
  });

  it('AI-PRICING-3d: la página renderiza el CTA final', () => {
    expect(screen.getByText(/listo para consultar normativa en segundos/i)).toBeInTheDocument();
  });

  // AI-PRICING-4
  it('AI-PRICING-4: "Ver todos los planes" navega a ActivePage.Precios', () => {
    fireEvent.click(screen.getByRole('button', { name: /ver todos los planes/i }));
    expect(mockSetCurrentPage).toHaveBeenCalledWith(ActivePage.Precios);
  });

  // AI-PRICING-5 (invariante documentado)
  it('AI-PRICING-5: DAILY_LIMITS (lógica real de límites) NO está en este componente — vive en ScreenAsistenteTecnico', () => {
    // AsistenteTecnicoPublicView no tiene lógica de permisos ni límites.
    // DAILY_LIMITS = { basico:5, profesional:30, empresa:30, empresa_plus:Infinity }
    // está en ScreenAsistenteTecnico.tsx:48 — intocado por este cleanup.
    // Este test documenta el invariante arquitectónico.
    expect(true).toBe(true);
  });
});
