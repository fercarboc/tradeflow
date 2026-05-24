/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType } from '../types';
import { Check, ArrowRight, ShieldCheck, Gift } from 'lucide-react';

interface PreciosViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
}

export default function PreciosView({ setCurrentPage }: PreciosViewProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Plan Básico',
      price: billingCycle === 'monthly' ? 29 : 23,
      desc: 'Ideal para autónomos técnicos que realizan trabajos puntuales y quieren simplificar.',
      features: [
        'Creación de presupuestos por voz ilimitados',
        'Hasta 15 presupuestos PDF al mes',
        'Conversión básica a factura (1 click)',
        'Envío inmediato por WhatsApp',
        'Soporte técnico básico por Email',
      ],
      cta: 'Empezar gratis 3 meses',
      popular: false,
    },
    {
      name: 'Plan Profesional (Pro)',
      price: billingCycle === 'monthly' ? 49 : 39,
      desc: 'Pensado para autónomos de alto volumen y microempresas instaladoras con operarios.',
      features: [
        'Presupuestos por voz e imagen (Foto del lugar)',
        'Presupuestos PDF ilimitados oficiales',
        'Control de aceptación online del cliente',
        'Exportación automatizada para asesor contable',
        'Módulo de gastos (Foto de tíquets de compra)',
        'Soporte prioritario 1-on-1 por WhatsApp',
      ],
      cta: 'Empezar gratis 3 meses',
      popular: true,
    },
    {
      name: 'Plan Empresa',
      price: billingCycle === 'monthly' ? 89 : 71,
      desc: 'Para instaladoras en crecimiento con oficinas y varios operarios en calle.',
      features: [
        'Todo lo incluido en el Plan Pro',
        'Multi-operario (Hasta 5 cuentas de técnicos)',
        'Sincronización de tarifas grupales en la nube',
        'Panel de estadísticas financieras avanzadas',
        'Módulo de contratos de mantenimiento',
        'Revisión legal de facturas por gestor asignado',
      ],
      cta: 'Empezar gratis 3 meses',
      popular: false,
    },
  ];

  const handleSelectPlan = () => {
    setCurrentPage(ActivePage.Registro);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 font-sans" id="precios-view-container">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-705 border border-slate-200 rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-3">
          Precios transparentes
        </span>
        <h1 className="text-3.5xl sm:text-5xl font-display font-bold text-slate-905 tracking-tight leading-tight">
          Planes adaptados a tu ritmo de trabajo
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
          Sin contratos de exclusividad ni tarifas ocultas. Elige el plan que mejor se adapte al volumen de tu negocio instalador.
        </p>

        {/* 3-month free trial banner */}
        <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-3 bg-emerald-50/70 border border-emerald-200 rounded p-4 max-w-2xl text-left">
          <div className="h-8 w-8 rounded bg-emerald-100 flex items-center justify-center shrink-0">
            <Gift className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="text-xs text-emerald-900 leading-normal">
            <strong>3 meses completamente gratis</strong> — Sin tarjeta de crédito hasta el 4º mes. Sin permanencias en plan mensual. Cancela cuando quieras.
          </div>
        </div>

        {/* Billing Toggle button */}
        <div className="mt-10 flex justify-center" id="billing-toggle-container">
          <div className="relative flex items-center bg-slate-100 p-1 rounded border border-slate-200 shadow-xs">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-blue-650 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Pago Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-blue-650 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Pago Anual</span>
              <span className="bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wide">
                -20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-16" id="pricing-matrix">
        {plans.map((plan, idx) => {
          return (
            <div
              key={idx}
              className={`rounded border bg-white p-6 sm:p-8 flex flex-col justify-between relative shadow-xs hover:border-slate-350 transition-colors h-full ${
                plan.popular 
                  ? 'border-2 border-blue-600 scale-100 md:scale-105 z-10' 
                  : 'border-slate-200'
              }`}
              id={`pricing-card-${idx}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-3 py-1 rounded uppercase tracking-wider font-mono">
                  El más elegido ★
                </span>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">{plan.name}</h3>
                  <p className="text-xs text-slate-550 mt-1 leading-relaxed">{plan.desc}</p>
                </div>

                {/* Price tag */}
                <div id={`card-price-container-${idx}`}>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-bold text-slate-950 tracking-tight">
                      {plan.price}€
                    </span>
                    <span className="text-slate-400 font-bold uppercase text-[9px] font-mono tracking-wider">/mes + IVA</span>
                  </div>
                  <span className="mt-1.5 inline-block bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded">
                    Gratis los primeros 3 meses
                  </span>
                </div>

                {/* Separator */}
                <div className="h-px bg-slate-150" />

                {/* Features item checklist */}
                <ul className="space-y-3.5 text-xs text-slate-600" id={`feature-list-${idx}`}>
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5">
                      <div className="h-4.5 w-4.5 rounded bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="pt-6 mt-6 border-t border-slate-150">
                <button
                  onClick={handleSelectPlan}
                  className={`w-full py-3.5 px-4 rounded flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                  id={`pricing-btn-${idx}`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <span className="text-[10px] text-center text-slate-405 block mt-2.5 font-mono">
                  {billingCycle === 'monthly' ? 'Sin permanencias · Cancela cuando quieras' : 'Facturación anual · Incluye 3 meses gratis'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compliance banner */}
      <div className="rounded border border-slate-200 bg-slate-50/50 p-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 bg-white border border-slate-200 rounded flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="space-y-0.5">
            <span className="font-display font-bold uppercase tracking-wide text-slate-900 text-xs">Facturación segura bajo Ley de Presupuestos de España</span>
            <p className="text-xs text-slate-500 leading-relaxed">Nuestros PDFs y codificaciones cumplen estrictamente la Ley Antifraude y los formatos tributarios de la Agencia Tributaria Española.</p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest whitespace-nowrap">Secured Cloud Ingress</div>
      </div>
    </div>
  );
}
