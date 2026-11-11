// Modo Exprés — plantillas de presupuesto por organización y seguimiento "visto".
// Módulo nuevo y aislado: no modifica funciones existentes de lib/supabase.ts.
import { supabase } from './supabase';
import type { PartidaPresupuesto } from '../types';
import type { QuoteLinkTracking } from './quoteTracking';
export { trackingState, daysSince } from './quoteTracking';
export type { QuoteLinkTracking, ExpressQuoteFilter } from './quoteTracking';

export interface QuoteTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  partidas: PartidaPresupuesto[];
  iva_pct: number | null;
  uso_count: number;
  last_used_at: string | null;
}

/** Limpia una partida para guardarla como plantilla (sin ids de BD ni estado de pedido). */
export function partidaForTemplate(p: PartidaPresupuesto): PartidaPresupuesto {
  return {
    descripcion: p.descripcion,
    tipo: p.tipo,
    cantidad: p.cantidad,
    precioUnitario: p.precioUnitario,
    total: Math.round(p.cantidad * p.precioUnitario * 100) / 100,
    ...(p.unidad ? { unidad: p.unidad } : {}),
    ...(p.precioCoste != null ? { precioCoste: p.precioCoste } : {}),
    ...(p.supplier_key ? { supplier_key: p.supplier_key } : {}),
    ...(p.supplier_name ? { supplier_name: p.supplier_name } : {}),
    ...(p.supplier_ref ? { supplier_ref: p.supplier_ref } : {}),
    ...(p.familia ? { familia: p.familia } : {}),
    ...(p.catalog_variant_id ? { catalog_variant_id: p.catalog_variant_id } : {}),
  };
}

/** Partidas de una plantilla listas para un presupuesto nuevo (total recalculado). */
export function partidasFromTemplate(t: QuoteTemplate): PartidaPresupuesto[] {
  return (t.partidas ?? []).map(p => ({
    ...p,
    cantidad: Number(p.cantidad) || 1,
    precioUnitario: Number(p.precioUnitario) || 0,
    total: Math.round((Number(p.cantidad) || 1) * (Number(p.precioUnitario) || 0) * 100) / 100,
    dbItemId: undefined,
    material_order_placed: undefined,
  }));
}

export async function loadQuoteTemplates(orgId: string): Promise<QuoteTemplate[]> {
  const { data, error } = await supabase
    .from('trade_quote_templates')
    .select('id, nombre, descripcion, partidas, iva_pct, uso_count, last_used_at')
    .eq('org_id', orgId)
    .order('uso_count', { ascending: false })
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as QuoteTemplate[];
}

export async function saveQuoteTemplate(
  orgId: string,
  nombre: string,
  descripcion: string,
  partidas: PartidaPresupuesto[],
  ivaPct: number | null,
): Promise<QuoteTemplate> {
  const { data, error } = await supabase
    .from('trade_quote_templates')
    .insert({
      org_id: orgId,
      nombre: nombre.trim().slice(0, 120) || 'Plantilla',
      descripcion: descripcion.trim(),
      partidas: partidas.map(partidaForTemplate),
      iva_pct: ivaPct,
    })
    .select('id, nombre, descripcion, partidas, iva_pct, uso_count, last_used_at')
    .single();
  if (error) throw error;
  return data as QuoteTemplate;
}

export async function deleteQuoteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('trade_quote_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function markQuoteTemplateUsed(t: QuoteTemplate): Promise<void> {
  await supabase
    .from('trade_quote_templates')
    .update({ uso_count: (t.uso_count ?? 0) + 1, last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', t.id);
}

/** Último enlace enviado por presupuesto (clave: número visible del presupuesto). */
export async function loadQuoteLinkTracking(orgId: string): Promise<Record<string, QuoteLinkTracking>> {
  const { data, error } = await supabase
    .from('trade_quote_tokens')
    .select('quote_numero, viewed_at, status, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const out: Record<string, QuoteLinkTracking> = {};
  for (const row of (data ?? []) as Array<{ quote_numero: string; viewed_at: string | null; status: QuoteLinkTracking['status'] }>) {
    const prev = out[row.quote_numero];
    if (!prev) {
      out[row.quote_numero] = { viewedAt: row.viewed_at ?? null, status: row.status };
    } else if (!prev.viewedAt && row.viewed_at) {
      // Si un enlace anterior ya se vio, cuenta como visto
      prev.viewedAt = row.viewed_at;
    }
  }
  return out;
}
