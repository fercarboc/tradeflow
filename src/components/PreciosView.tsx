/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType } from '../types';
import { CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';

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
    desc: 'Para el instalador autónomo que quiere ahorrar tiempo en presupuestos y facturas.',
    features: [
      'Hasta 30 presupuestos PDF al mes',
      'Presupuestos por voz con IA',
      'Envío por WhatsApp y Email',
      'PDF profesional',
      'Gestión de clientes y cobros',
      'Soporte por Email',
    ],
    popular: false,
    highlight: false,
    cta: 'Empezar',
  },
  {
    key: 'profesional',
    name: 'Profesional',
    monthlyPrice: 49,
    users: '1 usuario',
    desc: 'Para el instalador autónomo con alta carga de trabajo que necesita agenda y sin límites.',
    features: [
      'Todo lo del plan Básico',
      'Presupuestos por voz e imagen sin límite',
      'Agenda y planificación de obras',
      'Gestión de trabajadores',
      'Recordatorios y vencimientos',
      'Soporte prioritario WhatsApp',
    ],
    popular: true,
    highlight: false,
    cta: 'Empezar',
  },
  {
    key: 'empresa',
    name: 'Empresa',
    monthlyPrice: 89,
    users: 'Hasta 5 usuarios',
    desc: 'Para instaladoras con equipo en campo que necesitan control total del negocio.',
    features: [
      'Todo lo del plan Profesional',
      'Hasta 5 usuarios simultáneos',
      'Panel de estadísticas avanzadas',
      'Módulo de contratos de mantenimiento',
      'Gestión avanzada de permisos',
      'Integraciones y API',
    ],
    popular: false,
    highlight: true,
    cta: 'Prueba gratis 15 días',
    badges: ['Sin permanencia', 'Actualizaciones incluidas', 'Soporte cercano'],
  },
];

export default function PreciosView({ setCurrentPage }: PreciosViewProps) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const go = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const yearly = cycle === 'yearly';

  return (
    <div className="bg-[#030d1e] min-h-screen font-sans" id="precios-view-container">

      {/* Hero header */}
      <div className="bg-[#020B16] border-b border-white/10 py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45">
            Precios transparentes
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
            Sin letra pequeña
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-xl mx-auto">
            Sin contratos de exclusividad ni tarifas ocultas. Elige el plan que mejor se adapte a tu negocio instalador.
          </p>

          {/* Free trial banner */}
          <div className="inline-flex items-center gap-3 rounded-2xl bg-[#FFC400]/10 border border-[#FFC400]/25 px-6 py-3 mt-2">
            <span className="text-[#FFC400] text-lg">🎁</span>
            <span className="text-sm font-bold text-white/80">
              <span className="text-[#FFC400]">15 días gratis</span> — Sin tarjeta de crédito. Cancela cuando quieras.
            </span>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center pt-4">
            <div className="flex items-center rounded-full bg-white/5 border border-white/10 p-1 gap-1">
              <button
                onClick={() => setCycle('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  cycle === 'monthly' ? 'bg-white text-[#020B16]' : 'text-white/50 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setCycle('yearly')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  cycle === 'yearly' ? 'bg-white text-[#020B16]' : 'text-white/50 hover:text-white'
                }`}
              >
                Anual
                <span className="bg-[#FFC400] text-[#020B16] text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  2 MESES GRATIS
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const annualTotal = plan.monthlyPrice * 10;
            const monthlyEquiv = Math.round(annualTotal / 12);

            return (
              <div
                key={plan.key}
                id={`pricing-card-${plan.key}`}
                className={`relative rounded-2xl p-8 flex flex-col gap-6 transition-all ${
                  plan.highlight
                    ? 'bg-[#FFC400] shadow-2xl shadow-[#FFC400]/20'
                    : plan.popular
                    ? 'bg-[#0d1f38] border border-[#00CFE8]/30'
                    : 'bg-[#0d1f38] border border-white/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="rounded-full bg-[#00CFE8] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-[#020B16]">
                      Más popular
                    </span>
                  </div>
                )}

                {/* Plan name + price */}
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${
                    plan.highlight ? 'text-[#020B16]/55' : plan.popular ? 'text-[#00CFE8]' : 'text-white/40'
                  }`}>
                    {plan.name}
                  </div>

                  {yearly ? (
                    /* Annual: show total/año in big + monthly equivalent below */
                    <div>
                      <div className="flex items-end gap-1.5">
                        <span className={`text-5xl font-black leading-none ${plan.highlight ? 'text-[#020B16]' : 'text-white'}`}>
                          {annualTotal}€
                        </span>
                        <span className={`text-sm mb-1 font-medium ${plan.highlight ? 'text-[#020B16]/50' : 'text-white/35'}`}>
                          /año
                        </span>
                      </div>
                      <p className={`text-xs mt-1.5 font-medium ${plan.highlight ? 'text-[#020B16]/60' : 'text-white/45'}`}>
                        {monthlyEquiv}€/mes · facturado anualmente
                      </p>
                    </div>
                  ) : (
                    /* Monthly: show price/mes */
                    <div className="flex items-end gap-1.5">
                      <span className={`text-5xl font-black leading-none ${plan.highlight ? 'text-[#020B16]' : 'text-white'}`}>
                        {plan.monthlyPrice}€
                      </span>
                      <span className={`text-sm mb-1 font-medium ${plan.highlight ? 'text-[#020B16]/50' : 'text-white/35'}`}>
                        /mes
                      </span>
                    </div>
                  )}

                  <p className={`text-xs mt-2 ${plan.highlight ? 'text-[#020B16]/50' : 'text-white/35'}`}>
                    {plan.users}
                  </p>
                  <p className={`text-sm mt-3 leading-relaxed ${plan.highlight ? 'text-[#020B16]/70' : 'text-white/50'}`}>
                    {plan.desc}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                        plan.highlight ? 'text-[#020B16]' : 'text-[#00CFE8]'
                      }`} />
                      <span className={`text-sm leading-snug ${plan.highlight ? 'text-[#020B16]/80' : 'text-white/65'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Highlight badges (Empresa only) */}
                {plan.badges && (
                  <div className="rounded-xl bg-[#020B16]/10 p-4 space-y-2">
                    {plan.badges.map((b) => (
                      <div key={b} className="flex items-center gap-2 text-xs font-bold text-[#020B16]">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        {b}
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA button */}
                <button
                  onClick={() => go(ActivePage.Registro)}
                  className={`w-full rounded-xl py-3.5 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    plan.highlight
                      ? 'bg-[#020B16] text-[#FFC400] hover:bg-[#020B16]/80 shadow-md'
                      : plan.popular
                      ? 'bg-[#00CFE8]/15 border border-[#00CFE8]/40 text-[#00CFE8] hover:bg-[#00CFE8]/25'
                      : 'border border-white/20 text-white/60 hover:border-white/40 hover:text-white'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          {yearly
            ? 'Facturación anual · Equivale a pagar 10 meses · Los precios no incluyen IVA · Cancela cuando quieras'
            : 'Prueba gratis 15 días sin tarjeta de crédito · Sin permanencias · Cancela cuando quieras'}
        </p>

        {/* Compliance banner */}
        <div className="mt-12 rounded-2xl bg-[#0d1f38] border border-white/10 p-6 flex flex-col md:flex-row items-center gap-5 max-w-4xl mx-auto">
          <div className="h-12 w-12 rounded-xl bg-[#00CFE8]/10 border border-[#00CFE8]/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-[#00CFE8]" />
          </div>
          <div className="space-y-1 text-center md:text-left">
            <div className="text-sm font-black uppercase tracking-wide text-white">
              Facturación segura — Ley Antifraude España
            </div>
            <p className="text-xs text-white/45 leading-relaxed">
              PDFs y formatos que cumplen con la normativa tributaria de la Agencia Tributaria Española. RGPD compliant.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
