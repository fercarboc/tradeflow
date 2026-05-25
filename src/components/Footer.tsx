/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../types';
import { Wrench, PhoneCall, Mail, MapPin, ShieldCheck } from 'lucide-react';

interface FooterProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function Footer({ setCurrentPage }: FooterProps) {
  const handleNavigate = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800" id="app-footer">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4" id="footer-grid">
          {/* Logo Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div 
              onClick={() => handleNavigate(ActivePage.Home)}
              className="flex cursor-pointer items-center gap-2.5"
              id="footer-logo"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md">
                <Wrench className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                TrabFlow <span className="text-emerald-400">AI</span>
              </span>
            </div>
            
            <p className="max-w-md text-sm text-slate-400 leading-relaxed font-sans">
              La plataforma inteligente diseñada específicamente para instaladores y autónomos del sector de reformas de España. Creación de presupuestos por voz e imagen, directa por WhatsApp. Alivia el 90% de tu papeleo diario.
            </p>

            <div className="flex flex-col gap-2 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Cumple con el RGPD y la normativa de facturación de España.</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-white font-display">Navegación</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.Home)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Inicio
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.ComoFunciona)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Cómo funciona
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.Precios)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Precios y Planes
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.Contacto)}
                  className="hover:text-white transition-colors cursor-pointer text-left font-medium text-emerald-400"
                >
                  Unirse a la Beta
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-white font-display">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.AvisoLegal)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Aviso legal
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.Privacidad)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Política de privacidad
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNavigate(ActivePage.Cookies)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Política de cookies
                </button>
              </li>
              <li className="pt-2 text-[11px] text-slate-500">
                <span>Made in Spain 🇪🇸 para autónomos trabajadores.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} TrabFlow AI. Todos los derechos reservados. Las marcas WhatsApp® y PDF® corresponden a sus respectivos propietarios.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 transition-colors">TrabFlow AI Beta 1.2.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
