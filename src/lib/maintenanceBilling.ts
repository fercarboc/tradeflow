// Canonical billing frequency configuration for maintenance contracts.
// Used by: supabase.ts, ScreenMantenimiento, ScreenContratos, billing cron.

export type BillingFrequency = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export interface BillingFrequencyConfig {
  intervalMonths: number;
  invoicesPerYear: number;
  label: string;
}

export const BILLING_FREQUENCY_CONFIG: Record<BillingFrequency, BillingFrequencyConfig> = {
  mensual:    { intervalMonths: 1,  invoicesPerYear: 12, label: 'Mensual' },
  trimestral: { intervalMonths: 3,  invoicesPerYear: 4,  label: 'Trimestral' },
  semestral:  { intervalMonths: 6,  invoicesPerYear: 2,  label: 'Semestral' },
  anual:      { intervalMonths: 12, invoicesPerYear: 1,  label: 'Anual' },
};

export function getFrequencyConfig(freq: string): BillingFrequencyConfig {
  return BILLING_FREQUENCY_CONFIG[freq as BillingFrequency] ?? BILLING_FREQUENCY_CONFIG.mensual;
}

/** Returns the period base amount (cuota_mensual × intervalMonths). */
export function billingAmountForPeriod(cuotaMensual: number, freq: string): number {
  return cuotaMensual * getFrequencyConfig(freq).intervalMonths;
}

/** Advances a date string by the frequency's interval. Returns ISO date string. */
export function advanceBillingDate(dateStr: string, freq: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const result = new Date(Date.UTC(y, mo - 1 + getFrequencyConfig(freq).intervalMonths, d));
  return result.toISOString().split('T')[0];
}

/** Formats a period label (e.g. "Enero 2026", "T1 2026", "S1 2026", "Año 2026"). */
export function formatPeriodLabel(periodoInicio: string, freq: string): string {
  const [y, mo] = periodoInicio.split('-').map(Number);
  const month0 = mo - 1; // 0-indexed UTC month
  const { intervalMonths } = getFrequencyConfig(freq);
  if (intervalMonths === 12) return `Año ${y}`;
  if (intervalMonths === 6) {
    const semestre = month0 < 6 ? 1 : 2;
    return `S${semestre} ${y}`;
  }
  if (intervalMonths === 3) {
    const trimestre = Math.ceil(mo / 3);
    return `T${trimestre} ${y}`;
  }
  const d = new Date(Date.UTC(y, month0, 1));
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
