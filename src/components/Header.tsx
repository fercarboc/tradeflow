/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage } from '../types';
import { Menu, X, LogIn, UserPlus } from 'lucide-react';
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
    { name: 'Cómo funciona', page: ActivePage.ComoFunciona },
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

  const handleRegister = () => {
    handleNavigate(ActivePage.Registro);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div 
          onClick={() => handleNavigate(ActivePage.Home)}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-95"
          id="header-logo-container"
        >
          <img
            src="/tradeflow.png"
            alt="TradeFlow AI"
            className="h-9 w-auto"
          />
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 uppercase">
              TradeFlow <span className="text-blue-600">AI</span>
            </span>
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">Beta de Instaladores</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6" id="desktop-nav">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                id={`nav-${item.page}`}
                onClick={() => handleNavigate(item.page)}
                className={`relative px-1 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-blue-600"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2" id="desktop-cta">
          <button
            onClick={() => handleNavigate(ActivePage.AppDashboard, false)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 cursor-pointer shadow-xs"
            id="header-app-pc-button"
          >
            Demo
          </button>
          <button
            onClick={handleLogin}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-500 cursor-pointer shadow-xs"
            id="header-login-button"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Acceder</span>
          </button>
          <button
            onClick={handleRegister}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-blue-700 cursor-pointer shadow-sm"
            id="header-register-button"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Empezar gratis</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden" id="mobile-menu-toggle-container">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Toggle menu"
            id="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
            className="border-b border-slate-200 bg-white md:hidden overflow-hidden"
            id="mobile-nav-panel"
          >
            <div className="space-y-1.5 px-4 pt-2 pb-6">
              {navItems.map((item) => {
                const isActive = currentPage === item.page;
                return (
                  <button
                    key={item.page}
                    id={`mobile-nav-${item.page}`}
                    onClick={() => handleNavigate(item.page)}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-base font-semibold cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.name}</span>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>}
                  </button>
                );
              })}
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={handleRegister}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white cursor-pointer"
                  id="mobile-register-btn"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Empezar gratis — 3 meses</span>
                </button>
                <button
                  onClick={handleLogin}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  id="mobile-login-btn"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Acceder a mi cuenta</span>
                </button>
                <button
                  onClick={() => handleNavigate(ActivePage.AppDashboard, false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-200"
                  id="mobile-demo-btn"
                >
                  <span>Ver demo</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
