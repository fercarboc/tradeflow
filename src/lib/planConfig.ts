export type PlanId = 'basico' | 'profesional' | 'empresa' | 'empresa_plus';

export interface PlanMeta {
  id: PlanId;
  label: string;
  monthlyPrice: number;
  annualTotal: number;
  annualMonthlyEquiv: number;
  users: string;
}

// Includes 'pro' as legacy alias for 'profesional' (3 orgs in prod)
export const PLAN_TIER: Record<string, number> = {
  basico: 0, pro: 1, profesional: 1, empresa: 2, empresa_plus: 3,
};

export const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico', pro: 'Profesional', profesional: 'Profesional',
  empresa: 'Empresa', empresa_plus: 'Empresa+',
};

// Annual = monthly × 10 (2 months free), billed as single payment
export const PLAN_META: Record<PlanId, PlanMeta> = {
  basico:       { id: 'basico',       label: 'Básico',      monthlyPrice: 29,  annualTotal: 290,  annualMonthlyEquiv: 24,  users: '1 usuario' },
  profesional:  { id: 'profesional',  label: 'Profesional', monthlyPrice: 49,  annualTotal: 490,  annualMonthlyEquiv: 41,  users: '1 usuario' },
  empresa:      { id: 'empresa',      label: 'Empresa',     monthlyPrice: 89,  annualTotal: 890,  annualMonthlyEquiv: 74,  users: 'Hasta 5 usuarios' },
  empresa_plus: { id: 'empresa_plus', label: 'Empresa+',    monthlyPrice: 179, annualTotal: 1790, annualMonthlyEquiv: 149, users: 'Hasta 15 usuarios' },
};

// Plans shown in public pricing page and registration
export const PUBLIC_PLAN_IDS: PlanId[] = ['basico', 'profesional', 'empresa'];

// For admin MRR calculations (monthly equivalent of each billing cycle)
export const ADMIN_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  basico:       { monthly: 29,  yearly: 24  },
  pro:          { monthly: 49,  yearly: 41  },
  profesional:  { monthly: 49,  yearly: 41  },
  empresa:      { monthly: 89,  yearly: 74  },
  empresa_plus: { monthly: 179, yearly: 149 },
};
