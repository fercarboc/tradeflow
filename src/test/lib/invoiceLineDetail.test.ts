import { describe, it, expect } from 'vitest';
import { mergeQuoteDetailIntoLines, type QuoteItemDetail } from '../../lib/invoiceLineDetail';
import type { TradeInvoiceLine } from '../../lib/supabase';

const line = (descripcion: string, subtotal: number, orden: number): TradeInvoiceLine => ({
  id: `l${orden}`, factura_id: 'f', descripcion, cantidad: 1, precio_unitario: subtotal,
  descuento_pct: 0, subtotal, orden, tipo: 'material', created_at: '',
});
const item = (descripcion: string, posicion: number, extra: Partial<QuoteItemDetail> = {}): QuoteItemDetail => ({
  descripcion, posicion, tipo: 'material', familia: null, marca: null, modelo: null, medidas: null, unidad: null, ...extra,
});

describe('mergeQuoteDetailIntoLines', () => {
  it('sin partidas de presupuesto devuelve las líneas tal cual', () => {
    const lines = [line('A', 10, 0)];
    expect(mergeQuoteDetailIntoLines(lines, [])).toBe(lines);
  });

  it('empareja por descripción (sin distinguir mayúsculas/espacios) y añade el detalle', () => {
    const out = mergeQuoteDetailIntoLines(
      [line('Termo 80 L', 320, 0)],
      [item(' termo 80 l ', 0, { familia: 'fontaneria', marca: 'Thermor', modelo: 'Duralis', medidas: '50x75', unidad: 'ud' })],
    );
    expect(out[0]).toMatchObject({ familia: 'fontaneria', marca: 'Thermor', modelo: 'Duralis', medidas: '50x75', unidad: 'ud' });
  });

  it('nunca altera importes ni cantidades', () => {
    const out = mergeQuoteDetailIntoLines([line('A', 99, 0)], [item('A', 0, { marca: 'X' })]);
    expect(out[0]).toMatchObject({ subtotal: 99, precio_unitario: 99, cantidad: 1 });
  });

  it('hereda el tipo del presupuesto (mano de obra va a su sección)', () => {
    const out = mergeQuoteDetailIntoLines([line('Montaje', 300, 0)], [item('Montaje', 0, { tipo: 'mano_de_obra' })]);
    expect(out[0].tipo).toBe('mano_de_obra');
  });

  it('descripción editada: empareja por posición si hay el mismo nº de partidas', () => {
    const out = mergeQuoteDetailIntoLines(
      [line('Texto cambiado', 10, 0), line('B', 20, 1)],
      [item('Original', 0, { marca: 'M1' }), item('B', 1, { marca: 'M2' })],
    );
    expect(out.map(l => l.marca)).toEqual(['M1', 'M2']);
  });

  it('distinto nº de partidas y sin coincidencia: deja la línea sin detalle', () => {
    const out = mergeQuoteDetailIntoLines([line('Extra añadida', 50, 0)], [item('Otra', 0, { marca: 'M' }), item('Más', 1)]);
    expect(out[0].marca).toBeUndefined();
  });

  it('no asigna la misma partida a dos líneas', () => {
    const out = mergeQuoteDetailIntoLines(
      [line('Tubo', 5, 0), line('Tubo', 5, 1)],
      [item('Tubo', 0, { medidas: '16mm' }), item('Tubo', 1, { medidas: '20mm' })],
    );
    expect(out.map(l => l.medidas)).toEqual(['16mm', '20mm']);
  });
});
