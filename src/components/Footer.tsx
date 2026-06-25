/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../types';
import {
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Zap,
  Snowflake,
  Hammer,
  Home,
  KeyRound,
  PaintRoller,
  BrickWall,
  PanelsTopLeft,
  Leaf,
  SquareStack,
  Blinds,
  RadioTower,
  Sun,
  ArrowUpDown,
  Car,
  Brush,
  Droplets,
  Camera,
  BatteryCharging,
} from 'lucide-react';

interface FooterProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function Footer({ setCurrentPage }: FooterProps) {
  const handleNavigate = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  const trades = [
    { label: 'Fontanería', icon: Wrench },
    { label: 'Electricidad', icon: Zap },
    { label: 'Climatización / HVAC', icon: Snowflake },
    { label: 'Reformas', icon: Home },
    { label: 'Carpintería', icon: Hammer },
    { label: 'Cerrajería', icon: KeyRound },
    { label: 'Pintura', icon: PaintRoller },
    { label: 'Albañilería', icon: BrickWall },
    { label: 'Suelos y Tarimas', icon: PanelsTopLeft },
    { label: 'Jardinería', icon: Leaf },
    { label: 'Cristalería', icon: SquareStack },
    { label: 'Persianas / Cierres', icon: Blinds },
    { label: 'Telecomunicaciones', icon: RadioTower },
    { label: 'Energía Solar', icon: Sun },
    { label: 'Vehículo Eléctrico', icon: BatteryCharging },
    { label: 'Ascensores', icon: ArrowUpDown },
    { label: 'Taller Mecánico', icon: Car },
    { label: 'Limpieza Industrial', icon: Brush },
    { label: 'Impermeabilización', icon: Droplets },
    { label: 'CCTV / Seguridad', icon: Camera },
  ];

  return (
    <footer
      id="app-footer"
      className="relative overflow-hidden border-t border-white/10 bg-[#020B16] text-white/45"
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(0,207,232,0.10),transparent_32%),radial-gradient(circle_at_80%_40%,rgba(255,196,0,0.08),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-3 space-y-5">
            <div
              onClick={() => handleNavigate(ActivePage.Home)}
              className="flex cursor-pointer items-center gap-2.5"
              id="footer-logo"
            >
              <img src="/tradeflow.png" alt="TrabFlow AI" className="h-9 w-auto" />
              <div className="flex flex-col leading-none">
                <span className="font-display text-base font-black tracking-widest text-[#FFC400] uppercase">
                  TRABFLOW
                </span>
                <span className="text-[8px] font-semibold tracking-[0.15em] text-white/30 uppercase">
                  La herramienta que trabaja contigo
                </span>
              </div>
            </div>

            <p className="text-sm text-white/45 leading-relaxed max-w-[280px]">
              Plataforma inteligente para instaladores y autónomos en España.
              Presupuestos por voz e imagen, facturación y envío por WhatsApp.
            </p>

            <div className="flex items-center gap-1.5 text-xs text-white/35">
              <ShieldCheck className="h-3.5 w-3.5 text-[#00CFE8] shrink-0" />
              RGPD · LSSI-CE · SaaS para profesionales
            </div>

            <div className="flex items-start gap-2 text-[11px] text-[#FFC400]/80 leading-relaxed max-w-[285px]">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                La IA puede generar errores. Revisa siempre presupuestos, precios,
                impuestos y facturas antes de enviarlos.
              </span>
            </div>

            <div className="inline-flex rounded-full border border-[#00CFE8]/25 bg-[#00CFE8]/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#00CFE8]">
              Beta privada · Funcionalidades sujetas a cambios
            </div>

            <div className="flex gap-2.5 pt-1">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/40 hover:border-[#FFC400]/40 hover:text-[#FFC400] transition-colors"
                aria-label="Instagram de TrabFlow"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/40 hover:border-[#FFC400]/40 hover:text-[#FFC400] transition-colors"
                aria-label="YouTube de TrabFlow"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Producto
            </h3>

            <ul className="space-y-3 text-sm">
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

          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Empresa
            </h3>

            <ul className="space-y-3 text-sm">
              {[
                { label: 'Inicio', page: ActivePage.Home },
                { label: 'Contacto', page: ActivePage.Contacto },
                { label: 'Términos y condiciones', page: ActivePage.Terminos },
                { label: 'Política de privacidad', page: ActivePage.Privacidad },
                { label: 'Política de cookies', page: ActivePage.Cookies },
                { label: 'Aviso legal', page: ActivePage.AvisoLegal },
                { label: 'Acuerdo beta', page: ActivePage.Beta },
                { label: 'Disclaimer de IA', page: ActivePage.IADisclaimer },
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

          <div className="lg:col-span-3 space-y-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              ¿Hablamos?
            </h3>

            <div className="space-y-3">
              <a
                href="tel:+34672336572"
                className="flex items-center gap-2.5 text-sm text-white/55 hover:text-[#FFC400] transition-colors group"
              >
                <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#FFC400]/15 transition-colors">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="font-semibold">672 336 572</span>
              </a>

              <a
                href="mailto:contacto@trabflow.com"
                className="flex items-center gap-2.5 text-sm text-white/55 hover:text-[#00CFE8] transition-colors group"
              >
                <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#00CFE8]/15 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <span>contacto@trabflow.com</span>
              </a>
            </div>

            <button
              onClick={() => handleNavigate(ActivePage.Registro)}
              className="w-full rounded-xl bg-[#FFC400] py-3 text-sm font-black uppercase tracking-widest text-[#020B16] hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-[#FFC400]/15"
            >
              Prueba gratis 15 días
            </button>

            <p className="text-[10.5px] text-white/30 leading-relaxed">
              Al registrarte aceptas los Términos y Condiciones, la Política de
              Privacidad y el uso responsable de funcionalidades basadas en IA.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white">
              Ideal para{' '}
              <span className="text-[#00CFE8]">todo tipo de oficios</span>
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-y-7 gap-x-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10">
            {trades.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className="group relative flex flex-col items-center justify-start gap-2 px-2 text-center"
              >
                {index % 10 !== 0 && (
                  <span className="hidden xl:block absolute left-0 top-1/2 h-12 w-px -translate-y-1/2 bg-white/10" />
                )}

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#00CFE8] group-hover:border-[#FFC400]/40 group-hover:text-[#FFC400] group-hover:bg-[#FFC400]/10 transition-all">
                  <Icon className="h-5 w-5" />
                </div>

                <span className="text-[11px] leading-tight text-white/55 group-hover:text-white transition-colors max-w-[90px]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between text-xs text-white/30">
          <span>
            © {currentYear} TrabFlow Technologies S.L. Todos los derechos reservados.
            <span className="mx-2 text-white/15">·</span>
            🇪🇸 Hecho en España
          </span>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <button onClick={() => handleNavigate(ActivePage.Terminos)} className="hover:text-white/60 transition-colors cursor-pointer">
              Términos y condiciones
            </button>
            <button onClick={() => handleNavigate(ActivePage.Privacidad)} className="hover:text-white/60 transition-colors cursor-pointer">
              Política de privacidad
            </button>
            <button onClick={() => handleNavigate(ActivePage.Cookies)} className="hover:text-white/60 transition-colors cursor-pointer">
              Política de cookies
            </button>
            <button onClick={() => handleNavigate(ActivePage.AvisoLegal)} className="hover:text-white/60 transition-colors cursor-pointer">
              Aviso legal
            </button>
            <button onClick={() => handleNavigate(ActivePage.Beta)} className="hover:text-white/60 transition-colors cursor-pointer">
              Acuerdo beta
            </button>
            <button onClick={() => handleNavigate(ActivePage.IADisclaimer)} className="hover:text-white/60 transition-colors cursor-pointer">
              Disclaimer IA
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}