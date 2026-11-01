/**
 * Header de las páginas públicas.
 *
 * jsdom no aplica CSS: la navegación de escritorio (xl) y el panel móvil
 * pueden coexistir en el DOM, por eso se acotan las consultas con `within`.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Header from '../../components/Header';
import { ActivePage } from '../../types';

// motion/react: sin animaciones en jsdom (AnimatePresence retiraría el panel con retraso).
vi.mock('motion/react', async () => {
  const React = await import('react');
  const makeEl = (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, initial, animate, exit, layoutId, transition, ...rest }: any) =>
      React.createElement(tag, rest, children);
  return {
    motion: { div: makeEl('div') },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

const setCurrentPage = vi.fn();
const setInitialMobile = vi.fn();
const setLoginOnMount = vi.fn();

beforeEach(() => {
  setCurrentPage.mockClear();
  setInitialMobile.mockClear();
  setLoginOnMount.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <Header
      currentPage={ActivePage.Precios}
      setCurrentPage={setCurrentPage}
      setInitialMobile={setInitialMobile}
      setLoginOnMount={setLoginOnMount}
    />,
  );
});

const desktopNav = () => document.getElementById('desktop-nav')!;
const menuButton = () => document.getElementById('mobile-menu-btn')!;
const panel = () => document.getElementById('mobile-nav-panel');

describe('Header — navegación de escritorio', () => {
  it('el logo es un botón accesible que lleva al inicio', () => {
    fireEvent.click(screen.getByRole('button', { name: /ir al inicio/i }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.Home);
  });

  it('mantiene los 9 enlaces y sus destinos', () => {
    const expected: [string, ActivePage][] = [
      ['Inicio', ActivePage.Home],
      ['Funciones', ActivePage.ComoFunciona],
      ['Marketplace', ActivePage.MarketplacePublico],
      ['Proveedores', ActivePage.Proveedores],
      ['Transporte', ActivePage.Transporte],
      ['Asistente IA', ActivePage.AsisTecnico],
      ['Herramientas', ActivePage.Herramientas],
      ['Precios', ActivePage.Precios],
      ['Contacto', ActivePage.Contacto],
    ];
    const nav = desktopNav();
    expect(within(nav).getAllByRole('button')).toHaveLength(expected.length);
    for (const [label, page] of expected) {
      fireEvent.click(within(nav).getByRole('button', { name: label }));
      expect(setCurrentPage).toHaveBeenLastCalledWith(page);
    }
  });

  it('marca la página actual con aria-current', () => {
    expect(within(desktopNav()).getByRole('button', { name: 'Precios' })).toHaveAttribute('aria-current', 'page');
    expect(within(desktopNav()).getByRole('button', { name: 'Contacto' })).not.toHaveAttribute('aria-current');
  });

  it('"Iniciar sesión" activa el login y abre el panel de la app', () => {
    fireEvent.click(document.getElementById('header-login-button')!);
    expect(setLoginOnMount).toHaveBeenCalledWith(true);
    expect(setInitialMobile).toHaveBeenCalledWith(false);
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.AppDashboard);
  });
});

describe('Header — menú móvil', () => {
  it('empieza cerrado con aria-expanded=false y aria-controls', () => {
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveAttribute('aria-controls', 'mobile-nav-panel');
    expect(menuButton()).toHaveAccessibleName('Abrir menú');
    expect(panel()).toBeNull();
  });

  it('se abre con los 9 enlaces y el acceso', () => {
    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAccessibleName('Cerrar menú');
    expect(within(panel()!).getAllByRole('button')).toHaveLength(10);
  });

  it('se cierra con el botón y con Escape', () => {
    fireEvent.click(menuButton());
    fireEvent.click(menuButton());
    expect(panel()).toBeNull();

    fireEvent.click(menuButton());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel()).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('al elegir un enlace navega y cierra el panel', () => {
    fireEvent.click(menuButton());
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Funciones' }));
    expect(setCurrentPage).toHaveBeenCalledWith(ActivePage.ComoFunciona);
    expect(panel()).toBeNull();
  });
});
