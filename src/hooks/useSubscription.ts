import { useSession } from '../context/SessionContext';
import type { Plan } from '../context/SessionContext';

const PLAN_RANK: Record<Plan, number> = {
  basico: 0,
  pro: 1,
  profesional: 2,
  empresa: 3,
  empresa_plus: 4,
};

export function useSubscription() {
  const { subscription, plan, org } = useSession();

  const rank = PLAN_RANK[plan] ?? 0;

  const isPremium = rank >= PLAN_RANK.empresa;
  const isPro = rank >= PLAN_RANK.pro;
  const isTrialing = !!subscription?.trial_end && new Date(subscription.trial_end) > new Date();

  const trialDaysLeft = (() => {
    if (!subscription?.trial_end) return 0;
    const ms = new Date(subscription.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  })();

  function hasFeature(feature: string): boolean {
    const features: Record<string, Plan[]> = {
      'ai.voice':       ['pro', 'profesional', 'empresa', 'empresa_plus'],
      'ai.photo':       ['pro', 'profesional', 'empresa', 'empresa_plus'],
      'ai.assistant':   ['pro', 'profesional', 'empresa', 'empresa_plus'],
      'team.unlimited': ['empresa', 'empresa_plus'],
      'catalogs.supplier': ['empresa', 'empresa_plus'],
      'maintenance':    ['empresa', 'empresa_plus'],
      'contracts':      ['empresa', 'empresa_plus'],
      'export.word':    ['profesional', 'empresa', 'empresa_plus'],
      'subcontratas':   ['empresa_plus'],
      'mayoristas':     ['empresa_plus'],
    };
    const required = features[feature];
    if (!required) return true;
    return required.some(p => PLAN_RANK[p] <= rank);
  }

  return {
    plan,
    subscription,
    org,
    isPremium,
    isPro,
    isTrialing,
    trialDaysLeft,
    hasFeature,
  };
}
