/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType } from '../types';
import {
  CheckCircle, ArrowRight, ShieldCheck, User, Users, Building2, Truck,
  Gift, CreditCard, BadgeCheck, CalendarX, type LucideIcon,
} from 'lucide-react';

interface PreciosViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
}

const PLANS = [
  {
    key: 'basico',
    name: 'Básico',
    monthlyPrice: 29,
    users: '1 usuario',
    desc: 'Para el instalador autónomo que quiere organizar su negocio sin papel.',
    features: [
      'Hasta 30 presupuestos/mes',
      'Clientes ilimitados',
      'Facturas ilimitadas',
      'Planificación de trabajos',
      'Catálogo de tarifas propio',
      'Soporte estándar',
    ],
    popular: false,
    highlight: false,
    cta: 'Activar Básico',
  },
  {
    key: 'profesional',
    name: 'Profesional',
    monthlyPrice: 49,
    users: '1 usuario',
    desc: 'Para el autónomo serio con alta carga de trabajo que necesita todo sin límites.',
    features: [
      'Presupuestos ilimitados',
      'Clientes ilimitados',
      'Facturas ilimitadas',
      'Foto IA ilimitada',
      'Planificación de trabajos',
      'Catálogo ilimitado',
      'Soporte prioritario',
    ],
    popular: true,
    highlight: false,
    cta: 'Activar Profesional',
  },
  {
    key: 'empresa',
    name: 'Empresa',
    monthlyPrice: 89,
    users: 'Hasta 5 usuarios',
    desc: 'Para microempresas instaladoras con equipo en campo que necesitan control total.',
    features: [
      'Todo lo del plan Profesional',
      'Hasta 5 usuarios en equipo',
      'Roles y permisos granulares',
      'Módulo Ingresos y rentabilidad',
      'Panel Equipo y Permisos',
      'Trabajos externalizados (proveedores)',
      'Soporte VIP',
    ],
    popular: false,
    highlight: true,
    cta: 'Activar Empresa',
    badges: ['Sin permanencia', 'Actualizaciones incluidas', 'Soporte cercano'],
  },
];

const PLAN_ICONS: Record<string, LucideIcon> = {
  basico: User,
  profesional: Users,
  empresa: Building2,
};

// Fotos propias de cada plan (copias WebP sin el rótulo incrustado del original).
const PLAN_IMAGES: Record<string, { src: string; alt: string }> = {
  basico: { src: '/precios-basico.webp', alt: 'Instalador autónomo consultando una tableta junto a su furgoneta' },
  profesional: { src: '/precios-profesional.webp', alt: 'Dos instaladores revisando un trabajo en una tableta' },
  empresa: { src: '/precios-empresa.webp', alt: 'Responsable de una empresa de servicios con su equipo y furgonetas' },
};

// Transporte Pro: tarifa definida (29 €/vehículo/mes, hasta 2 conductores por
// vehículo), solo mensual. La contratación online aún no está habilitada: sin
// checkout, el CTA lleva a Contacto. Solo funciones ya disponibles en el producto.
const TRANSPORT_PRICE_PER_VEHICLE = 29;
const TRANSPORT_DRIVERS_PER_VEHICLE = 2;
const TRANSPORT_FEATURES = [
  'Vehículos y conductores',
  'Rutas y agenda de servicios',
  'Partes de servicio y kilometraje',
  'Control de costes y tarifas',
  'Presupuestos de transporte con IA',
];

const TRUST_ITEMS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gift, title: 'Prueba gratuita', text: 'Sin compromiso' },
  { icon: CreditCard, title: 'Sin tarjeta', text: 'No pedimos tarjeta para empezar' },
  { icon: BadgeCheck, title: 'Sin permanencia', text: 'Sin contratos de exclusividad' },
  { icon: CalendarX, title: 'Cancela cuando quieras', text: 'Sin tarifas ocultas' },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030d1e]';

function GroupHeading({ id, title, subtitle, accent }: {
  id: string; title: string; subtitle: string; accent: 'cyan' | 'yellow';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id={id} className="text-lg font-black tracking-tight text-white">{title}</h2>
      <p className={`text-sm font-semibold ${accent === 'cyan' ? 'text-[#00CFE8]' : 'text-[#FFC400]'}`}>{subtitle}</p>
    </div>
  );
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="aspect-[5/3] w-full rounded-xl object-cover object-top"
    />
  );
}

export default function PreciosView({ setCurrentPage }: PreciosViewProps) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const go = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const yearly = cycle === 'yearly';

  return (
    <div className="bg-[#030d1e] min-h-screen font-sans" id="precios-view-container">

      {/* Cabecera */}
      <div className="bg-[#020B16] border-b border-white/10 py-14 px-4 sm:px-6 lg:px-8 text-center sm:py-16">
        <div className="mx-auto max-w-4xl space-y-5">
          <span className="inline-block rounded-full border border-[#00CFE8]/40 bg-[#00CFE8]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#00CFE8]">
            Precios transparentes
          </span>
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl">
            Planes claros <span className="text-[#00CFE8]">para cada tipo de negocio</span>
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/55">
            Sin contratos de exclusividad ni tarifas ocultas. Elige el plan que mejor se adapte a tu negocio.
          </p>

          <div className="inline-flex items-center gap-3 rounded-2xl border border-[#FFC400]/25 bg-[#FFC400]/10 px-5 py-3">
            <Gift className="h-5 w-5 shrink-0 text-[#FFC400]" aria-hidden="true" />
            <span className="text-sm font-bold text-white/80">
              <span className="text-[#FFC400]">Prueba gratuita sin compromiso</span> — Sin tarjeta de crédito. Cancela cuando quieras.
            </span>
          </div>

          {/* Selector de ciclo de facturación */}
          <div className="flex justify-center pt-2">
            <div
              role="group"
              aria-label="Ciclo de facturación"
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1"
            >
              <button
                type="button"
                aria-pressed={!yearly}
                onClick={() => setCycle('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all cursor-pointer focus-visible:ring-[#00CFE8] ${FOCUS_RING} ${
                  !yearly ? 'bg-white text-[#020B16]' : 'text-white/55 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                aria-pressed={yearly}
                onClick={() => setCycle('yearly')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all cursor-pointer focus-visible:ring-[#00CFE8] ${FOCUS_RING} ${
                  yearly ? 'bg-white text-[#020B16]' : 'text-white/55 hover:text-white'
                }`}
              >
                Anual
                <span className="whitespace-nowrap rounded-full bg-[#FFC400] px-1.5 py-0.5 text-[9px] font-black text-[#020B16]">
                  2 MESES GRATIS
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-[3fr_auto_1fr] xl:gap-8">

          {/* ── Oficios e instaladores ───────────────────────────────────── */}
          <section aria-labelledby="precios-oficios" className="flex flex-col gap-6">
            <GroupHeading
              id="precios-oficios"
              title="Oficios e instaladores"
              subtitle="Presupuestos, trabajos, partes y facturación"
              accent="cyan"
            />

            <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-2 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const annualTotal = plan.monthlyPrice * 10;
                const Icon = PLAN_ICONS[plan.key] ?? User;
                const image = PLAN_IMAGES[plan.key];

                return (
                  <article
                    key={plan.key}
                    id={`pricing-card-${plan.key}`}
                    aria-labelledby={`pricing-name-${plan.key}`}
                    className={`relative flex flex-col gap-5 rounded-2xl p-4 pb-6 transition-all ${
                      plan.popular
                        ? 'border-2 border-[#00CFE8] bg-[#0b1d36] shadow-[0_0_40px_-8px_rgba(0,207,232,0.45)]'
                        : 'border border-white/10 bg-[#0b1a30]'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="rounded-full bg-[#00CFE8] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                          Más popular
                        </span>
                      </div>
                    )}

                    {image && <CardImage src={image.src} alt={image.alt} />}

                    <div className="flex flex-1 flex-col gap-5 px-2">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00CFE8]/30 bg-[#00CFE8]/10 text-[#00CFE8]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 id={`pricing-name-${plan.key}`} className="text-xl font-black tracking-tight text-white">
                            {plan.name}
                          </h3>
                          <p className="text-xs text-white/45">{plan.users}</p>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed text-white/55">{plan.desc}</p>

                      {yearly ? (
                        <div>
                          <div className="flex items-end gap-1.5">
                            <span className="text-5xl font-black leading-none text-white">{annualTotal}€</span>
                            <span className="mb-1 text-sm font-medium text-white/40">/año</span>
                          </div>
                          <p className="mt-1.5 text-xs font-medium text-white/50">Un único pago anual · 2 meses gratis</p>
                        </div>
                      ) : (
                        <div className="flex items-end gap-1.5">
                          <span className="text-5xl font-black leading-none text-white">{plan.monthlyPrice}€</span>
                          <span className="mb-1 text-sm font-medium text-white/40">/mes</span>
                        </div>
                      )}

                      <ul className="flex-1 space-y-2.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00CFE8]" aria-hidden="true" />
                            <span className="text-sm leading-snug text-white/70">{f}</span>
                          </li>
                        ))}
                      </ul>

                      {plan.badges && (
                        <ul className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-3.5">
                          {plan.badges.map((b) => (
                            <li key={b} className="flex items-center gap-2 text-xs font-bold text-white/80">
                              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#00CFE8]" aria-hidden="true" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}

                      <button
                        type="button"
                        onClick={() => go(ActivePage.Registro)}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all cursor-pointer ${FOCUS_RING} ${
                          plan.popular
                            ? 'bg-[#00CFE8] text-[#020B16] hover:brightness-110 focus-visible:ring-[#00CFE8]'
                            : 'bg-white text-[#020B16] hover:bg-white/90 focus-visible:ring-white'
                        }`}
                      >
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Separador vertical entre verticales (solo escritorio ancho) */}
          <div className="hidden w-px bg-white/10 xl:block" aria-hidden="true" />

          {/* ── Transporte ───────────────────────────────────────────────── */}
          <section aria-labelledby="precios-transporte" className="flex flex-col gap-6">
            <GroupHeading
              id="precios-transporte"
              title="Transporte y logística"
              subtitle="Flotas y servicios de transporte"
              accent="yellow"
            />

            <article
              id="pricing-card-transporte"
              aria-labelledby="pricing-name-transporte"
              className="relative mt-3 flex flex-1 flex-col gap-5 rounded-2xl border-2 border-[#FFC400]/70 bg-[#141a24] p-4 pb-6 shadow-[0_0_40px_-12px_rgba(255,196,0,0.35)] md:mx-auto md:w-full md:max-w-md xl:max-w-none"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="rounded-full bg-[#FFC400] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                  Nueva vertical
                </span>
              </div>

              <CardImage src="/precios-transporte.webp" alt="Camión y autocar circulando por carretera" />

              <div className="flex flex-1 flex-col gap-5 px-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FFC400]/40 bg-[#FFC400]/10 text-[#FFC400]">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id="pricing-name-transporte" className="text-xl font-black tracking-tight text-white">
                      Transporte Pro
                    </h3>
                    <p className="text-xs text-white/45">Viajeros, mercancías y reparto</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-white/55">
                  Gestión de flota, conductores, rutas y servicios para empresas de transporte.
                </p>

                {/* Precio por vehículo, siempre mensual (no participa en el selector anual). */}
                <div>
                  <div className="flex flex-wrap items-end gap-x-1.5">
                    <span className="text-5xl font-black leading-none text-white">{`${TRANSPORT_PRICE_PER_VEHICLE}\u00A0€`}</span>
                    <span className="mb-1 text-sm font-medium text-white/40">/ vehículo / mes</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#FFC400]">
                    Incluye hasta {TRANSPORT_DRIVERS_PER_VEHICLE} conductores por vehículo
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-white/50">
                    La contratación online todavía no está habilitada: solicita información a nuestro equipo.
                  </p>
                </div>

                <ul className="flex-1 space-y-2.5">
                  {TRANSPORT_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
                      <span className="text-sm leading-snug text-white/70">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => go(ActivePage.Transporte)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFC400] py-3.5 text-sm font-black text-[#020B16] transition-all hover:brightness-105 cursor-pointer focus-visible:ring-[#FFC400] ${FOCUS_RING}`}
                >
                  Ver Transporte Pro
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          </section>
        </div>

        {/* Franja de garantías (solo afirmaciones ya publicadas en la web) */}
        <ul className="mt-12 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-[#0b1a30] p-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <Icon className="h-7 w-7 shrink-0 text-[#00CFE8]" aria-hidden="true" />
              <div>
                <div className="text-sm font-bold text-white">{title}</div>
                <div className="text-xs text-white/45">{text}</div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-white/35">
          {yearly
            ? 'Facturación anual · Equivale a pagar 10 meses · Los precios no incluyen IVA · Cancela cuando quieras'
            : 'Prueba gratuita sin compromiso · Sin tarjeta de crédito · Sin permanencias · Cancela cuando quieras'}
        </p>

        {/* Compliance banner */}
        <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-5 rounded-2xl border border-white/10 bg-[#0d1f38] p-6 md:flex-row">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00CFE8]/20 bg-[#00CFE8]/10">
            <ShieldCheck className="h-6 w-6 text-[#00CFE8]" aria-hidden="true" />
          </div>
          <div className="space-y-1 text-center md:text-left">
            <div className="text-sm font-black uppercase tracking-wide text-white">
              Facturación segura — Ley Antifraude España
            </div>
            <p className="text-xs leading-relaxed text-white/45">
              PDFs y formatos que cumplen con la normativa tributaria de la Agencia Tributaria Española. RGPD compliant.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
