import type { TradeInvoiceLine } from './supabase';

export type QuoteItemDetail = { descripcion: string | null; posicion: number | null; tipo: string | null; familia: string | null; marca: string | null; modelo: string | null; medidas: string | null; unidad: string | null };

/** Une a cada línea de factura el detalle de la partida del presupuesto (oficio, marca, modelo, medidas, unidad).
 *  Emparejado por descripción; si no coincide y hay el mismo nº de partidas, por posición. Nunca altera importes. */
export function mergeQuoteDetailIntoLines(lines: TradeInvoiceLine[], items: QuoteItemDetail[]): TradeInvoiceLine[] {
  if (!items.length) return lines;
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
  const used = new Set<number>();
  return lines.map((l, idx) => {
    let k = items.findIndex((it, i) => !used.has(i) && norm(it.descripcion) === norm(l.descripcion));
    // Mismo nº de partidas que líneas: emparejar por posición (descripción editada en el borrador)
    if (k < 0 && items.length === lines.length && !used.has(idx)) k = idx;
    if (k < 0) return l;
    used.add(k);
    const it = items[k];
    return {
      ...l,
      tipo: (it.tipo as TradeInvoiceLine['tipo']) ?? l.tipo,
      familia: it.familia, marca: it.marca, modelo: it.modelo, medidas: it.medidas, unidad: it.unidad,
    };
  });
}

