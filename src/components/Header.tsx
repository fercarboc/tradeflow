/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ActivePage } from '../types';
import { Menu, X, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  currentPage: ActivePage;
  setCurrentPage: (page: ActivePage) => void;
  setInitialMobile?: (isMobile: boolean) => void;
  setLoginOnMount?: (v: boolean) => void;
}

const MOBILE_PANEL_ID = 'mobile-nav-panel';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] focus-visible:ring-offset-2';

// La navegación completa (9 enlaces + acceso) necesita ~1280 px: por debajo de
// xl se usa el menú desplegable. El eslogan del logo se oculta en xl (1280–1535)
// para dejar sitio a los enlaces.
export default function Header({ currentPage, setCurrentPage, setInitialMobile, setLoginOnMount }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const navItems = [
    { name: 'Inicio', page: ActivePage.Home },
    { name: 'Funciones', page: ActivePage.ComoFunciona },
    { name: 'Marketplace', page: ActivePage.MarketplacePublico },
    { name: 'Proveedores', page: ActivePage.Proveedores },
    { name: 'Transporte', page: ActivePage.Transporte },
    { name: 'Asistente IA', page: ActivePage.AsisTecnico },
    { name: 'Herramientas', page: ActivePage.Herramientas },
    { name: 'Precios', page: ActivePage.Precios },
    { name: 'Contacto', page: ActivePage.Contacto },
  ];

  const handleNavigate = (page: ActivePage, isMobile?: boolean) => {
    if (page === ActivePage.AppDashboard && setInitialMobile && isMobile !== undefined) {
      setInitialMobile(isMobile);
    }
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = () => {
    setLoginOnMount?.(true);
    handleNavigate(ActivePage.AppDashboard, false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md shadow-sm" id="main-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <button
          type="button"
          onClick={() => handleNavigate(ActivePage.Home)}
          className={`flex cursor-pointer items-center gap-2.5 shrink-0 rounded-lg text-left ${FOCUS_RING}`}
          id="header-logo-container"
          aria-label="TrabFlow — ir al inicio"
        >
          <img src="/tradeflow.png" alt="" className="h-8 w-auto" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-black tracking-widest text-[#1C2535] uppercase">
              TRABFLOW
            </span>
            <span className="block xl:hidden 2xl:block text-[8px] font-semibold tracking-[0.15em] text-[#1C2535]/40 uppercase">
              La herramienta que trabaja contigo
            </span>
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-4" id="desktop-nav" aria-label="Navegación principal">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                id={`nav-${item.page}`}
                onClick={() => handleNavigate(item.page)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative whitespace-nowrap rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer pb-0.5 ${FOCUS_RING} ${
                  isActive ? 'text-[#1A5A96]' : 'text-[#1C2535]/55 hover:text-[#1C2535]'
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-[#1A5A96]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden xl:flex items-center gap-2 shrink-0" id="desktop-cta">
          <button
            type="button"
            onClick={handleLogin}
            className={`whitespace-nowrap px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1C2535] border border-[#1C2535]/20 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
            id="header-login-button"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Iniciar sesión
          </button>
        </div>

        {/* Por debajo de xl: acceso visible (desde sm) + botón de menú */}
        <div className="flex xl:hidden items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLogin}
            className={`hidden sm:flex whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#1C2535] border border-[#1C2535]/20 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer items-center gap-1.5 ${FOCUS_RING}`}
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-[#1C2535]/70 hover:text-[#1C2535] hover:bg-gray-50 cursor-pointer ${FOCUS_RING}`}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
            aria-controls={MOBILE_PANEL_ID}
            id="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-gray-100 xl:hidden overflow-hidden"
            id={MOBILE_PANEL_ID}
          >
            <nav className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8" aria-label="Navegación principal">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {navItems.map((item) => {
                  const isActive = currentPage === item.page;
                  return (
                    <button
                      key={item.page}
                      type="button"
                      id={`mobile-nav-${item.page}`}
                      onClick={() => handleNavigate(item.page)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${FOCUS_RING} ${
                        isActive
                          ? 'bg-[#1A5A96]/8 text-[#1A5A96]'
                          : 'text-[#1C2535]/70 hover:text-[#1C2535] hover:bg-gray-50'
                      }`}
                    >
                      <span>{item.name}</span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#1A5A96]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleLogin}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#1C2535]/20 py-3 font-semibold text-sm text-[#1C2535] cursor-pointer hover:bg-gray-50 transition-colors ${FOCUS_RING}`}
                  id="mobile-login-btn"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Iniciar sesión
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
