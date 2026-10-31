/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../../types';
import {
  ArrowRight, Bus, Users, CalendarDays, Route, FileText,
  Euro, Zap, CheckCircle, Phone, Mail,
} from 'lucide-react';

interface TransporteLandingViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

// Precio oficial Transporte Pro — misma fuente que PreciosView.tsx
const PRICE_PER_VEHICLE = 29;
const DRIVERS_PER_VEHICLE = 2;

// Solo funcionalidades verificadas y disponibles en el producto
const FEATURES = [
  {
    icon: Bus,
    title: 'Flota y vehículos',
    desc: 'Registra cada autobus o autocar con sus datos, documentación y estado operativo.',
  },
  {
    icon: Users,
    title: 'Conductores',
    desc: `Hasta ${DRIVERS_PER_VEHICLE} conductores por vehículo con su perfil, disponibilidad y asignación de servicios.`,
  },
  {
    icon: CalendarDays,
    title: 'Agenda y planificación',
    desc: 'Organiza los servicios día a día. Asigna vehículo, conductor y ruta en segundos.',
  },
  {
    icon: Route,
    title: 'Rutas y partes de servicio',
    desc: 'Define rutas habituales y emite partes de servicio con kilometraje y horas de conducción.',
  },
  {
    icon: FileText,
    title: 'Presupuestos con IA',
    desc: 'Genera presupuestos de transporte dictando por voz. La IA estructura la oferta al instante.',
  },
  {
    icon: Euro,
    title: 'Control de costes y tarifas',
    desc: 'Define tarifas por kilómetro, hora o servicio. Controla los costes reales de cada operación.',
  },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020B16]';

export default function TransporteLandingView({ setCurrentPage }: TransporteLandingViewProps) {
  const go = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans bg-[#020B16]" id="transporte-landing">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 110% 90% at 70% 50%, #1a1400 0%, #020B16 65%)',
        }}
      >
        {/* subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFC400]/30 bg-[#FFC400]/10 px-4 py-1.5">
              <Bus className="h-3.5 w-3.5 text-[#FFC400]" aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-widest text-[#FFC400]">
                Transporte de Viajeros
              </span>
            </div>

            <h1 className="text-4xl font-black leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Gestión digital para{' '}
              <span className="text-[#FFC400]">empresas de transporte</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Software específico para autobuses y autocares. Flota, conductores,
              agenda de servicios, rutas y facturación — todo en una sola plataforma.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => go(ActivePage.Contacto)}
                className={`inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-7 py-3.5 text-sm font-black text-[#020B16] shadow-[0_0_32px_-8px_rgba(255,196,0,0.6)] transition hover:brightness-110 cursor-pointer ${FOCUS_RING}`}
              >
                Solicitar acceso
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(ActivePage.Demo)}
                className={`inline-flex items-center gap-2 rounded-xl border border-white/15 px-7 py-3.5 text-sm font-bold text-white/80 transition hover:border-white/30 hover:text-white cursor-pointer ${FOCUS_RING}`}
              >
                Ver demostración
              </button>
            </div>

            <p className="mt-5 text-xs text-white/30">
              Fase piloto activa · Activación bajo solicitud · Sin permanencia
            </p>
          </div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────── */}
      <section className="bg-[#0b0e14] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-2xl font-black text-white mb-2">
            Todo lo que necesita tu empresa de transporte
          </h2>
          <p className="text-center text-sm text-white/40 mb-12">
            Funcionalidades diseñadas para operadores de autobuses y autocares
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/8 bg-[#111520] p-6 transition hover:border-[#FFC400]/25"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#FFC400]/25 bg-[#FFC400]/10 text-[#FFC400]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────── */}
      <section className="bg-[#020B16] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-2xl font-black text-white mb-2">
            Precio transparente
          </h2>
          <p className="text-center text-sm text-white/40 mb-12">
            Sin sorpresas. Pagas por lo que usas.
          </p>

          <div className="mx-auto max-w-md">
            <div className="relative rounded-2xl border-2 border-[#FFC400]/60 bg-[#141a24] p-8 shadow-[0_0_48px_-12px_rgba(255,196,0,0.30)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="rounded-full bg-[#FFC400] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                  Transporte Pro
                </span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FFC400]/30 bg-[#FFC400]/10 text-[#FFC400]">
                  <Bus className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-base font-black text-white">Transporte Pro</div>
                  <div className="text-xs text-white/40">Viajeros · Autobuses · Autocares</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-end gap-1.5">
                  <span className="text-5xl font-black leading-none text-white">
                    {PRICE_PER_VEHICLE} €
                  </span>
                  <span className="mb-1 text-sm font-medium text-white/40">
                    / vehículo / mes
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-[#FFC400]">
                  Hasta {DRIVERS_PER_VEHICLE} conductores por vehículo incluidos
                </p>
              </div>

              <ul className="mb-6 space-y-2.5">
                {FEATURES.map(({ title }) => (
                  <li key={title} className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
                    <span className="text-sm text-white/70">{title}</span>
                  </li>
                ))}
              </ul>

              <p className="mb-5 text-xs text-white/35">
                La contratación online no está habilitada aún. Durante la fase piloto, el acceso se activa bajo solicitud.
              </p>

              <button
                type="button"
                onClick={() => go(ActivePage.Contacto)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFC400] py-3.5 text-sm font-black text-[#020B16] transition hover:brightness-110 cursor-pointer ${FOCUS_RING}`}
              >
                Solicitar acceso
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="bg-[#0d1117] py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full border border-[#FFC400]/20 bg-[#FFC400]/8 p-3">
            <Zap className="h-6 w-6 text-[#FFC400]" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">
            Únete a la fase piloto
          </h2>
          <p className="text-sm leading-relaxed text-white/50 mb-8 max-w-lg mx-auto">
            TrabFlow Transporte está en programa piloto. Escríbenos o llámanos y activamos tu acceso sin permanencia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Phone className="h-4 w-4 text-[#FFC400]" aria-hidden="true" />
              <span className="font-bold text-white/80 tracking-wider select-all">672 336 572</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Mail className="h-4 w-4 text-[#FFC400]" aria-hidden="true" />
              <span className="font-bold text-white/80 select-all">hola@trabflow.com</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => go(ActivePage.Contacto)}
            className={`inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-8 py-3.5 text-sm font-black text-[#020B16] transition hover:brightness-110 cursor-pointer ${FOCUS_RING}`}
          >
            Contactar con el equipo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

    </div>
  );
}
