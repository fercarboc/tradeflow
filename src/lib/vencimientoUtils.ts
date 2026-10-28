export type VencimientoState = 'no_informado' | 'vigente' | 'proximo' | 'vence_hoy' | 'vencido';

export const VENCIMIENTO_UMBRAL_DIAS = 30;

/**
 * Determina el estado de vencimiento a partir de una fecha ISO (YYYY-MM-DD).
 * - no_informado: fecha nula, vacía o no parseable
 * - vencido:   fecha < hoy  (ya superada)
 * - vence_hoy: fecha == hoy (vence durante el día de hoy; sin afirmación jurídica)
 * - proximo:   hoy < fecha <= hoy + umbralDias
 * - vigente:   fecha > hoy + umbralDias
 */
export function getVencimientoState(
  fechaVencimiento: string | null | undefined,
  hoy: Date = new Date(),
  umbralDias = VENCIMIENTO_UMBRAL_DIAS,
): VencimientoState {
  if (!fechaVencimiento || fechaVencimiento.trim() === '') return 'no_informado';
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  if (isNaN(venc.getTime())) return 'no_informado';
  const hoyNorm = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (venc < hoyNorm) return 'vencido';
  if (venc.getTime() === hoyNorm.getTime()) return 'vence_hoy';
  const umbral = new Date(hoyNorm);
  umbral.setDate(umbral.getDate() + umbralDias);
  if (venc <= umbral) return 'proximo';
  return 'vigente';
}

export interface VencimientoDisplay {
  label: string;
  colorClass: string;
  dotColorClass: string;
}

export const VENCIMIENTO_DISPLAY: Record<VencimientoState, VencimientoDisplay> = {
  no_informado: {
    label: 'Sin fecha',
    colorClass: 'bg-slate-100 text-slate-500 border-slate-200',
    dotColorClass: 'bg-slate-300',
  },
  vigente: {
    label: 'Vigente',
    colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotColorClass: 'bg-emerald-500',
  },
  proximo: {
    label: 'Próximo a vencer',
    colorClass: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColorClass: 'bg-amber-500',
  },
  vence_hoy: {
    label: 'Vence hoy',
    colorClass: 'bg-orange-100 text-orange-700 border-orange-200',
    dotColorClass: 'bg-orange-500',
  },
  vencido: {
    label: 'Vencido',
    colorClass: 'bg-red-100 text-red-700 border-red-200',
    dotColorClass: 'bg-red-500',
  },
};

/** Formatea una fecha ISO (YYYY-MM-DD) al formato dd/mm/aaaa, o '—' si es nula. */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.trim() === '') return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
