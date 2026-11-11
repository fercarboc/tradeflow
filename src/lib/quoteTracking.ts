// Modo Exprés — lógica pura de seguimiento de presupuestos (sin acceso a BD).

export interface QuoteLinkTracking {
  viewedAt: string | null;
  status: 'pending' | 'accepted' | 'rejected';
}

export type ExpressQuoteFilter = 'todos' | 'borrador' | 'enviado' | 'visto' | 'aceptado' | 'facturado';

/** Estado de seguimiento que ve el instalador (añade "Visto" sobre los estados existentes). */
export function trackingState(
  estado: string,
  tracking: QuoteLinkTracking | undefined,
): Exclude<ExpressQuoteFilter, 'todos'> {
  if (estado === 'Facturado') return 'facturado';
  if (estado === 'Aceptado') return 'aceptado';
  if (estado === 'Enviado') return tracking?.viewedAt ? 'visto' : 'enviado';
  return 'borrador';
}

/** Días transcurridos desde una fecha ISO (YYYY-MM-DD o timestamp). */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
