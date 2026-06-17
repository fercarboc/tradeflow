/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage } from '../types';
import { Menu, X, LogIn, Smartphone, Handshake } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  currentPage: ActivePage;
  setCurrentPage: (page: ActivePage) => void;
  setInitialMobile?: (isMobile: boolean) => void;
  setLoginOnMount?: (v: boolean) => void;
}

export default function Header({ currentPage, setCurrentPage, setInitialMobile, setLoginOnMount }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Inicio', page: ActivePage.Home },
    { name: 'Funciones', page: ActivePage.ComoFunciona },
    { name: 'Asistente IA', page: ActivePage.AsisTecnico },
    { name: 'Precios', page: ActivePage.Precios },
    { name: 'Demo', page: ActivePage.Demo },
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

  const handleScrollToProveedores = () => {
    setMobileMenuOpen(false);
    if (currentPage === ActivePage.Home) {
      document.getElementById('proveedores-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setCurrentPage(ActivePage.Home);
      setTimeout(() => {
        document.getElementById('proveedores-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    }
  };

  const handleLogin = () => {
    setLoginOnMount?.(true);
    handleNavigate(ActivePage.AppDashboard, false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020B16]/95 backdrop-blur-md" id="main-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <div
          onClick={() => handleNavigate(ActivePage.Home)}
          className="flex cursor-pointer items-center gap-2.5 shrink-0"
          id="header-logo-container"
        >
          <img src="/tradeflow.png" alt="TRABFLOW" className="h-8 w-auto" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-black tracking-widest text-[#FFC400] uppercase">
              TRABFLOW
            </span>
            <span className="text-[8px] font-semibold tracking-[0.15em] text-white/35 uppercase">
              La herramienta que trabaja contigo
            </span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-5" id="desktop-nav">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                id={`nav-${item.page}`}
                onClick={() => handleNavigate(item.page, item.page === ActivePage.AppDashboard ? false : undefined)}
                className={`relative text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer pb-0.5 ${
                  isActive ? 'text-[#00CFE8]' : 'text-white/60 hover:text-white'
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-[#00CFE8]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-2" id="desktop-cta">
          <button
            onClick={handleScrollToProveedores}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 text-[10px] font-bold uppercase tracking-widest text-[#FFC400] hover:bg-[#FFC400]/20 transition-all cursor-pointer"
          >
            <Handshake className="h-3 w-3" />
            Proveedores
          </button>
          <button
            onClick={handleLogin}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 border border-white/15 rounded-lg hover:border-white/40 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            id="header-login-button"
          >
            <LogIn className="h-3.5 w-3.5" />
            Iniciar sesión
          </button>
          <button
            onClick={() => setCurrentPage(ActivePage.Demo)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#020B16] bg-[#00CFE8] rounded-lg hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#00CFE8]/20"
            id="header-demo-button"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Acceso a demo móvil
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex lg:hidden h-10 w-10 items-center justify-center text-white/70 hover:text-white"
          aria-label="Toggle menu"
          id="mobile-menu-btn"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#020B16] border-b border-white/10 lg:hidden overflow-hidden"
            id="mobile-nav-panel"
          >
            <div className="px-4 pb-6 pt-2 space-y-1">
              {navItems.map((item) => {
                const isActive = currentPage === item.page;
                return (
                  <button
                    key={item.page}
                    id={`mobile-nav-${item.page}`}
                    onClick={() => handleNavigate(item.page, item.page === ActivePage.AppDashboard ? false : undefined)}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${
                      isActive ? 'bg-[#00CFE8]/10 text-[#00CFE8]' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{item.name}</span>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#00CFE8]" />}
                  </button>
                );
              })}
              <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={handleScrollToProveedores}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FFC400]/40 bg-[#FFC400]/10 py-3 font-bold text-sm text-[#FFC400] cursor-pointer hover:bg-[#FFC400]/20"
                >
                  <Handshake className="h-4 w-4" />
                  Gestión de Proveedores
                </button>
                <button
                  onClick={() => { setCurrentPage(ActivePage.Demo); setMobileMenuOpen(false); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00CFE8] py-3 font-bold text-sm text-[#020B16] cursor-pointer"
                  id="mobile-demo-btn"
                >
                  <Smartphone className="h-4 w-4" />
                  Acceso a demo móvil
                </button>
                <button
                  onClick={handleLogin}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-3 font-semibold text-sm text-white/70 cursor-pointer hover:bg-white/5"
                  id="mobile-login-btn"
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar sesión
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
