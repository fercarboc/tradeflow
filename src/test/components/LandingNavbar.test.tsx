/**
 * Navbar de la web pública (landing).
 *
 * jsdom no aplica CSS: la navegación de escritorio (xl) y el menú desplegable
 * existen a la vez en el DOM, por eso se usan getAllBy* donde hay duplicados.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Navbar from '../../components/landing/Navbar';
import { ActivePage } from '../../types';

const setCurrentPage = vi.fn();

beforeEach(() => {
  setCurrentPage.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<Navbar setCurrentPage={setCurrentPage} />);
});

const menuButton = () => screen.getByRole('button', { name: /abrir menú|cerrar menú/i });

describe('Navbar — navegación', () => {
  it('el logo es un botón accesible que lleva al inicio', () => {
    fireEvent.click(screen.getByRole('button', { name: /ir al inicio/i }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Home);
  });

  it('los enlaces principales navegan a su página', () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Precios' })[0]);
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Precios);
  });

  it('"Empezar gratis" lleva al registro', () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Empezar gratis' })[0]);
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Registro);
  });
});

describe('Navbar — menú desplegable', () => {
  it('empieza cerrado y con aria-expanded=false', () => {
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveAccessibleName('Abrir menú');
    expect(document.getElementById('landing-mobile-menu')).toBeNull();
  });

  it('se abre, actualiza aria y vincula el panel con aria-controls', () => {
    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAccessibleName('Cerrar menú');
    const panel = document.getElementById(menuButton().getAttribute('aria-controls')!);
    expect(panel).not.toBeNull();
    expect(within(panel!).getAllByRole('button')).toHaveLength(9); // 7 enlaces + login + registro
  });

  it('se cierra con el botón y con Escape', () => {
    fireEvent.click(menuButton());
    fireEvent.click(menuButton());
    expect(document.getElementById('landing-mobile-menu')).toBeNull();

    fireEvent.click(menuButton());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.getElementById('landing-mobile-menu')).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('al elegir un enlace del menú navega y cierra el panel', () => {
    fireEvent.click(menuButton());
    const panel = document.getElementById('landing-mobile-menu')!;
    fireEvent.click(within(panel).getByRole('button', { name: 'Contacto' }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Contacto);
    expect(document.getElementById('landing-mobile-menu')).toBeNull();
  });
});
