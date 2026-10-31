/**
 * Página pública de precios: presentación y navegación.
 * Los precios mostrados son informativos; la contratación real ocurre en el registro/checkout.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PreciosView from '../../components/PreciosView';
import { ActivePage } from '../../types';

const setCurrentPage = vi.fn();

beforeEach(() => {
  setCurrentPage.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<PreciosView setCurrentPage={setCurrentPage} setPreselectedTrade={vi.fn()} />);
});

const card = (key: string) => document.getElementById(`pricing-card-${key}`)!;

describe('PreciosView — planes de oficios', () => {
  it('mantiene los identificadores de las tres tarjetas y del contenedor', () => {
    expect(document.getElementById('precios-view-container')).not.toBeNull();
    for (const key of ['basico', 'profesional', 'empresa']) expect(card(key)).not.toBeNull();
  });

  it('muestra los precios mensuales actuales', () => {
    expect(within(card('basico')).getByText('29€')).toBeInTheDocument();
    expect(within(card('profesional')).getByText('49€')).toBeInTheDocument();
    expect(within(card('empresa')).getByText('89€')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mensual' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('al cambiar a anual muestra el total anual (10 mensualidades)', () => {
    fireEvent.click(screen.getByRole('button', { name: /anual/i }));
    expect(screen.getByRole('button', { name: /anual/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card('basico')).getByText('290€')).toBeInTheDocument();
    expect(within(card('profesional')).getByText('490€')).toBeInTheDocument();
    expect(within(card('empresa')).getByText('890€')).toBeInTheDocument();
  });

  it('cada tarjeta muestra su foto con texto alternativo', () => {
    for (const [key, src] of [
      ['basico', '/precios-basico.webp'],
      ['profesional', '/precios-profesional.webp'],
      ['empresa', '/precios-empresa.webp'],
      ['transporte', '/precios-transporte.webp'],
    ]) {
      const img = within(card(key)).getByRole('img');
      expect(img).toHaveAttribute('src', src);
      expect(img.getAttribute('alt')).not.toBe('');
    }
  });

  it('marca Profesional como "Más popular"', () => {
    expect(within(card('profesional')).getByText(/más popular/i)).toBeInTheDocument();
  });

  it.each([
    ['basico', 'Activar Básico'],
    ['profesional', 'Activar Profesional'],
    ['empresa', 'Activar Empresa'],
  ])('el CTA de %s lleva al registro', (key, label) => {
    fireEvent.click(within(card(key)).getByRole('button', { name: label }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Registro);
  });
});

describe('PreciosView — Transporte Pro', () => {
  it('se muestra como "Próximamente" y sin contratación online', () => {
    const t = card('transporte');
    expect(within(t).getByText('Transporte Pro')).toBeInTheDocument();
    expect(within(t).getByText(/próximamente/i)).toBeInTheDocument();
    expect(within(t).getByText(/todavía no está habilitada/i)).toBeInTheDocument();
  });

  it('no muestra ningún importe', () => {
    expect(card('transporte').textContent).not.toMatch(/€/);
  });

  it('su CTA lleva a Contacto y no al registro', () => {
    fireEvent.click(within(card('transporte')).getByRole('button', { name: /consultar disponibilidad/i }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Contacto);
    expect(setCurrentPage).not.toHaveBeenCalledWith(ActivePage.Registro);
  });
});

describe('PreciosView — afirmaciones comerciales', () => {
  it('usa "Prueba gratuita sin compromiso" y no menciona 15 días ni 3 meses', () => {
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/prueba gratuita sin compromiso/i);
    expect(text).not.toMatch(/15 d[ií]as/i);
    expect(text).not.toMatch(/3 meses/i);
  });

  it('no incluye afirmaciones no verificadas', () => {
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/miles de profesionales/i);
    expect(text).not.toMatch(/soporte telef[oó]nico/i);
    expect(text).not.toMatch(/\/veh[ií]culo/i);
  });

  it('mantiene el bloque de facturación segura', () => {
    expect(screen.getByText(/Facturación segura — Ley Antifraude España/)).toBeInTheDocument();
  });
});
