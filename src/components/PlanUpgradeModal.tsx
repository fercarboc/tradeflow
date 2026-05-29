import { useState } from 'react';
import { X, Check, AlertTriangle, ChevronUp, ChevronDown, Users } from 'lucide-react';
import { initiateStripeUpgrade, supabase } from '../lib/supabase';
import type { TradeSubscription } from '../lib/supabase';

interface Props {
  orgId: string;
  subscription: TradeSubscription | null;
  onClose: () => void;
  onUpgraded?: (plan: string, billingCycle: string) => void;
}

const PLANS = [
  {
    id: 'basico',
    label: 'Básico',
    tier: 0,
    monthly: 29,
    yearly: 23,
    color: 'slate' as const,
    features: ['Hasta 15 presupuestos/mes', 'Escaneo foto IA (5/mes)', 'PDF profesional', 'Soporte email'],
  },
  {
    id: 'profesional',
    label: 'Profesional',
    tier: 1,
    monthly: 49,
    yearly: 39,
    color: 'blue' as const,
    features: ['Presupuestos ilimitados', 'Voz + foto IA ilimitada', 'Planificación de trabajos', 'Soporte prioritario'],
  },
  {
    id: 'empresa',
    label: 'Empresa',
    tier: 2,
    monthly: 89,
    yearly: 71,
    color: 'purple' as const,
    features: ['Todo lo de Profesional', 'Hasta 5 técnicos en equipo', 'Roles y permisos', 'Soporte VIP'],
  },
  {
    id: 'empresa_plus',
    label: 'Empresa+',
    tier: 3,
    monthly: 179,
    yearly: 143,
    color: 'amber' as const,
    features: ['Todo lo de Empresa', 'Hasta 15 técnicos', 'Módulo mantenimientos', 'Soporte 1-on-1 dedicado'],
  },
] as const;

type PlanId = (typeof PLANS)[number]['id'];

const TIER: Record<string, number> = { basico: 0, profesional: 1, empresa: 2, empresa_plus: 3 };

const colorMap = {
  slate:  { border: 'border-slate-600/50',  bg: 'bg-slate-700/30',   btn: 'bg-slate-600 hover:bg-slate-500',   badge: 'bg-slate-600/30 text-slate-300 border-slate-500/30',   check: 'text-slate-400' },
  blue:   { border: 'border-blue-500/50',   bg: 'bg-blue-500/5',    btn: 'bg-blue-600 hover:bg-blue-500',     badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     check: 'text-blue-400'  },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/5',  btn: 'bg-purple-600 hover:bg-purple-500', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', check: 'text-purple-400' },
  amber:  { border: 'border-amber-500/50',  bg: 'bg-amber-500/5',   btn: 'bg-amber-600 hover:bg-amber-500',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   check: 'text-amber-400'  },
};

type ModalView = 'plans' | 'confirm-downgrade' | 'success';

export default function PlanUpgradeModal({ orgId, subscription, onClose, onUpgraded }: Props) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [view, setView] = useState<ModalView>('plans');
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);

  const currentPlan = (subscription?.plan ?? 'basico') as string;
  const currentTier = TIER[currentPlan] ?? 0;
  const hasWorkers  = currentTier >= 2; // empresa o empresa_plus tiene/puede tener técnicos

  async function handlePlanClick(planId: PlanId) {
    const targetTier = TIER[planId];
    if (targetTier === currentTier) return;

    if (targetTier < currentTier && hasWorkers) {
      // Downgrade desde plan con trabajadores → confirmación
      setPendingPlan(planId);
      setView('confirm-downgrade');
      return;
    }
    await executePlanChange(planId);
  }

  async function confirmDowngrade() {
    if (!pendingPlan) return;
    // Bloquear todos los técnicos de la org antes de bajar de plan
    await supabase.from('trade_workers').update({ activo: false }).eq('org_id', orgId);
    await executePlanChange(pendingPlan);
  }

  async function executePlanChange(planId: PlanId) {
    setLoading(planId);
    try {
      const result = await initiateStripeUpgrade(orgId, planId, cycle);
      if (result.upgraded) {
        setView('success');
        onUpgraded?.(result.plan ?? planId, result.billing_cycle ?? cycle);
        setTimeout(onClose, 2500);
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

  const targetPlanData = pendingPlan ? PLANS.find(p => p.id === pendingPlan) : null;
  const currentPlanData = PLANS.find(p => p.id === currentPlan);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          {view === 'confirm-downgrade' ? (
            <div>
              <h2 className="text-white font-bold text-lg">Confirmar cambio de plan</h2>
              <p className="text-slate-400 text-sm">Lee bien antes de continuar</p>
            </div>
          ) : view === 'success' ? (
            <h2 className="text-white font-bold text-lg">¡Plan actualizado!</h2>
          ) : (
            <div>
              <h2 className="text-white font-bold text-lg">Elige tu plan</h2>
              <p className="text-slate-400 text-sm">Sin compromiso · Cancela cuando quieras</p>
            </div>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Vista éxito ── */}
        {view === 'success' && (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">¡Plan actualizado!</h3>
            <p className="text-slate-400 text-sm">Tu suscripción ha sido cambiada. Los cambios ya están activos.</p>
          </div>
        )}

        {/* ── Vista confirmación downgrade ── */}
        {view === 'confirm-downgrade' && targetPlanData && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4 bg-orange-500/10 border border-orange-500/25 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-orange-300 font-semibold text-sm">
                  Vas a reducir de <span className="font-black">{currentPlanData?.label}</span> a <span className="font-black">{targetPlanData.label}</span>
                </p>
                <p className="text-orange-300/70 text-xs leading-relaxed">
                  El plan {targetPlanData.label} no incluye acceso para técnicos adicionales.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users className="w-4 h-4 text-slate-400" />
                ¿Qué ocurre con tus técnicos?
              </div>
              <ul className="space-y-2 text-xs text-slate-400 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 shrink-0 mt-0.5">•</span>
                  Todos tus técnicos quedarán <strong className="text-slate-300">bloqueados</strong> de inmediato. No podrán acceder a la app.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0 mt-0.5">•</span>
                  Solo tú (el administrador) seguirás con acceso completo.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                  Si en el futuro vuelves al Plan Empresa, podrás reactivarlos desde <strong className="text-slate-300">Equipo</strong> sin perder sus datos.
                </li>
              </ul>
            </div>

            <p className="text-xs text-slate-500 text-center">
              ¿Seguro que quieres continuar? Esta acción bloqueará a tus técnicos.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setPendingPlan(null); setView('plans'); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:border-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDowngrade}
                disabled={!!loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Procesando...
                  </>
                ) : `Sí, entiendo. Reducir a ${targetPlanData.label}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Vista principal: 4 planes ── */}
        {view === 'plans' && (
          <>
            {/* Ciclo */}
            <div className="flex justify-center pt-4 pb-1">
              <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                {(['monthly', 'yearly'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    className={`text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      cycle === c ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c === 'monthly' ? 'Mensual' : 'Anual'}
                    {c === 'yearly' && (
                      <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase">-20%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
              {PLANS.map(plan => {
                const tier = plan.tier;
                const isCurrent = plan.id === currentPlan;
                const isUpgrade = tier > currentTier;
                const c = isCurrent ? colorMap[plan.color] : colorMap[plan.color];

                let btnLabel = '';
                let btnIcon = null;
                if (isCurrent) {
                  btnLabel = 'Plan actual';
                } else if (isUpgrade) {
                  btnLabel = `Subir a ${plan.label}`;
                  btnIcon = <ChevronUp className="w-3.5 h-3.5" />;
                } else {
                  btnLabel = `Reducir a ${plan.label}`;
                  btnIcon = <ChevronDown className="w-3.5 h-3.5" />;
                }

                return (
                  <div
                    key={plan.id}
                    className={`border rounded-xl p-4 flex flex-col gap-3 ${
                      isCurrent ? `${c.border} ${c.bg}` : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    {/* Plan header */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white">{plan.label}</span>
                        {isCurrent && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase border ${c.badge}`}>
                            Actual
                          </span>
                        )}
                        {!isCurrent && isUpgrade && tier === currentTier + 1 && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-black text-white">{plan[cycle]}€</span>
                        <span className="text-slate-400 text-xs ml-0.5">/mes</span>
                      </div>
                      {cycle === 'yearly' && (
                        <p className="text-[10px] text-emerald-400 mt-0.5">{plan.yearly * 12}€/año</p>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-1.5 flex-grow">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <Check className={`w-3 h-3 shrink-0 mt-0.5 ${isCurrent ? c.check : 'text-slate-500'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <button
                      onClick={() => handlePlanClick(plan.id)}
                      disabled={isCurrent || !!loading}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                        isCurrent
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : isUpgrade
                          ? `${c.btn} text-white disabled:opacity-60`
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-60'
                      }`}
                    >
                      {loading === plan.id ? (
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <>{btnIcon}{btnLabel}</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-slate-500 pb-4">
              Pago seguro con Stripe · IVA no incluido · Cancela cuando quieras
            </p>
          </>
        )}
      </div>
    </div>
  );
}
