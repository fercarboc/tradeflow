import React, { useState } from 'react';
import { X, Check, Zap, Shield } from 'lucide-react';
import { initiateStripeUpgrade } from '../lib/supabase';
import type { TradeSubscription } from '../lib/supabase';

interface Props {
  orgId: string;
  subscription: TradeSubscription | null;
  onClose: () => void;
  onUpgraded?: (plan: string, billingCycle: string) => void;
}

const PRO_FEATURES = [
  'Presupuestos ilimitados',
  'Clientes ilimitados',
  'Facturas ilimitadas',
  'Escaneo foto IA ilimitado',
  'Planificacion de trabajos',
  'Catalogo ilimitado',
  'Soporte prioritario',
];

const EMPRESA_FEATURES = [
  'Todo lo de Pro',
  'Hasta 20 usuarios en equipo',
  'Roles y permisos granulares',
  'Modulo Ingresos y rentabilidad',
  'Panel Equipo y Permisos',
  'Soporte VIP',
];

export default function PlanUpgradeModal({ orgId, subscription, onClose, onUpgraded }: Props) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  const prices = {
    pro:     { monthly: 29,  yearly: 24  },
    empresa: { monthly: 79,  yearly: 66  },
  };

  async function handleUpgrade(plan: 'pro' | 'empresa') {
    setLoading(plan);
    try {
      const result = await initiateStripeUpgrade(orgId, plan === 'pro' ? 'profesional' : 'empresa', cycle);
      if (result.upgraded) {
        setUpgraded(true);
        onUpgraded?.(result.plan ?? plan, result.billing_cycle ?? cycle);
        setTimeout(onClose, 2000);
      } else if (result.url) {
        window.open(result.url, '_blank', 'noopener');
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  }

  const currentPlan = subscription?.plan ?? 'basico';
  const isPro     = currentPlan === 'profesional' && subscription?.status === 'active';
  const isEmpresa = (currentPlan === 'empresa' || currentPlan === 'empresa_plus') && subscription?.status === 'active';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="text-white font-bold text-lg">Elige tu plan</h2>
            <p className="text-slate-400 text-sm">Sin compromiso. Cancela cuando quieras.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upgrade directo confirmado */}
        {upgraded && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">¡Plan actualizado!</h3>
            <p className="text-slate-400 text-sm">Tu suscripción ha sido cambiada. Los cambios ya están activos.</p>
          </div>
        )}

        {/* Selector de ciclo + cards (ocultos tras upgrade directo) */}
        {!upgraded && (<>
          <div className="flex justify-center pt-5 pb-1">
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setCycle('monthly')}
                className={`text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer ${
                  cycle === 'monthly'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setCycle('yearly')}
                className={`text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  cycle === 'yearly'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anual
                <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase">
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-2 gap-4 p-6">

          {/* Pro */}
          <div className={`border rounded-xl p-5 space-y-4 flex flex-col ${
            isPro
              ? 'border-blue-500/50 bg-blue-500/5'
              : 'border-slate-700 bg-slate-800/50'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Pro</span>
                {isPro && (
                  <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase">
                    Plan actual
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{prices.pro[cycle]}€</span>
                <span className="text-slate-400 text-sm">/mes</span>
              </div>
              {cycle === 'yearly' && (
                <p className="text-xs text-emerald-400 mt-0.5">Facturado {prices.pro.yearly * 12}€/año</p>
              )}
            </div>

            <ul className="space-y-2 flex-grow">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={!!loading || isPro}
              className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                isPro
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60'
              }`}
            >
              {loading === 'pro' ? 'Redirigiendo...' : isPro ? 'Plan actual' : 'Activar Profesional'}
            </button>
          </div>

          {/* Empresa */}
          <div className={`border rounded-xl p-5 space-y-4 flex flex-col relative ${
            isEmpresa
              ? 'border-purple-500/50 bg-purple-500/5'
              : 'border-purple-500/30 bg-slate-800/50'
          }`}>
            {!isEmpresa && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                Mas popular
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Empresa</span>
                {isEmpresa && (
                  <span className="text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full uppercase">
                    Plan actual
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{prices.empresa[cycle]}€</span>
                <span className="text-slate-400 text-sm">/mes</span>
              </div>
              {cycle === 'yearly' && (
                <p className="text-xs text-emerald-400 mt-0.5">Facturado {prices.empresa.yearly * 12}€/año</p>
              )}
            </div>

            <ul className="space-y-2 flex-grow">
              {EMPRESA_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade('empresa')}
              disabled={!!loading || isEmpresa}
              className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                isEmpresa
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-60'
              }`}
            >
              {loading === 'empresa' ? 'Redirigiendo...' : isEmpresa ? 'Plan actual' : 'Activar Empresa'}
            </button>
          </div>
        </div>

          <p className="text-center text-xs text-slate-500 pb-5">
            Pago seguro con Stripe · IVA no incluido · Cancela en cualquier momento
          </p>
        </>)}
      </div>
    </div>
  );
}
