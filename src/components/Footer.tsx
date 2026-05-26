/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../types';
import { Phone, Mail, ShieldCheck, Zap, Wrench, Wind, Hammer } from 'lucide-react';

interface FooterProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function Footer({ setCurrentPage }: FooterProps) {
  const handleNavigate = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  const tradeIcons = [
    { icon: <Wrench className="h-3.5 w-3.5" />, label: 'Fontanería' },
    { icon: <Zap className="h-3.5 w-3.5" />, label: 'Electricidad' },
    { icon: <Wind className="h-3.5 w-3.5" />, label: 'Climatización' },
    { icon: <Hammer className="h-3.5 w-3.5" />, label: 'Reformas' },
  ];

  return (
    <footer className="bg-[#020B16] border-t border-white/8 text-white/45" id="app-footer">

      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4" id="footer-grid">

          {/* ── Columna 1: Brand ──────────────────────── */}
          <div className="space-y-5">
            <div
              onClick={() => handleNavigate(ActivePage.Home)}
              className="flex cursor-pointer items-center gap-2.5"
              id="footer-logo"
            >
              <img src="/tradeflow.png" alt="TRABFLOW" className="h-8 w-auto" />
              <div className="flex flex-col leading-none">
                <span className="font-display text-sm font-black tracking-widest text-[#FFC400] uppercase">TRABFLOW</span>
                <span className="text-[8px] font-semibold tracking-[0.15em] text-white/30 uppercase">La herramienta que trabaja contigo</span>
              </div>
            </div>

            <p className="text-xs text-white/40 leading-relaxed max-w-[220px]">
              La plataforma inteligente para instaladores y autónomos de España. Presupuestos por voz e imagen, directa por WhatsApp.
            </p>

            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <ShieldCheck className="h-3.5 w-3.5 text-[#00CFE8] shrink-0" />
              RGPD compliant · Facturación española
            </div>

            {/* Social icons */}
            <div className="flex gap-2.5 pt-1">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/35 hover:border-[#FFC400]/40 hover:text-[#FFC400] transition-colors"
                aria-label="Instagram"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/35 hover:border-[#FFC400]/40 hover:text-[#FFC400] transition-colors"
                aria-label="YouTube"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>

            {/* Mini trade icons */}
            <div className="pt-2 space-y-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-white/30">Ideal para:</div>
              <div className="flex flex-wrap gap-2">
                {tradeIcons.map((t) => (
                  <div key={t.label} className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] text-white/40">
                    {t.icon}
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Columna 2: Producto ───────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Producto</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Funciones', page: ActivePage.ComoFunciona },
                { label: 'Precios', page: ActivePage.Precios },
                { label: 'Acceso a demo móvil', page: ActivePage.AppDashboard },
                { label: 'Cómo funciona', page: ActivePage.ComoFunciona },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => handleNavigate(item.page)}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Columna 3: Empresa ────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Empresa</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Inicio', page: ActivePage.Home },
                { label: 'Contacto', page: ActivePage.Contacto },
                { label: 'Aviso legal', page: ActivePage.AvisoLegal },
                { label: 'Política de privacidad', page: ActivePage.Privacidad },
                { label: 'Política de cookies', page: ActivePage.Cookies },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => handleNavigate(item.page)}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Columna 4: ¿Hablamos? ─────────────────── */}
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">¿Hablamos?</h3>

            <div className="space-y-3">
              <a
                href="tel:+34672336572"
                className="flex items-center gap-2.5 text-sm text-white/50 hover:text-[#FFC400] transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#FFC400]/15 transition-colors">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="font-semibold">672 336 572</span>
              </a>
              <a
                href="mailto:hola@trabflow.com"
                className="flex items-center gap-2.5 text-sm text-white/50 hover:text-[#00CFE8] transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#00CFE8]/15 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <span>hola@trabflow.com</span>
              </a>
            </div>

            <button
              onClick={() => handleNavigate(ActivePage.Registro)}
              className="w-full rounded-xl bg-[#FFC400] py-3 text-sm font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-[#FFC400]/15"
            >
              Prueba gratis 15 días
            </button>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/25">
          <span>© {currentYear} TRABFLOW · Todos los derechos reservados · Made in Spain 🇪🇸</span>
          <div className="flex gap-4">
            <button onClick={() => handleNavigate(ActivePage.Privacidad)} className="hover:text-white/50 transition-colors cursor-pointer">Privacidad</button>
            <button onClick={() => handleNavigate(ActivePage.Cookies)} className="hover:text-white/50 transition-colors cursor-pointer">Cookies</button>
            <button onClick={() => handleNavigate(ActivePage.AvisoLegal)} className="hover:text-white/50 transition-colors cursor-pointer">Legal</button>
          </div>
        </div>
      </div>

    </footer>
  );
}
