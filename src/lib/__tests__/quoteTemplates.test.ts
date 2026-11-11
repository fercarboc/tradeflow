import { describe, it, expect } from 'vitest';
import { trackingState, daysSince, partidasFromTemplate, partidaForTemplate } from '../quoteTemplates';
import type { QuoteTemplate } from '../quoteTemplates';
import type { PartidaPresupuesto } from '../../types';

describe('trackingState (Modo Exprés)', () => {
  it('mantiene los estados existentes', () => {
    expect(trackingState('Borrador', undefined)).toBe('borrador');
    expect(trackingState('Aceptado', undefined)).toBe('aceptado');
    expect(trackingState('Facturado', { viewedAt: '2026-11-01', status: 'accepted' })).toBe('facturado');
  });
  it('un enviado abierto por el cliente pasa a «visto»', () => {
    expect(trackingState('Enviado', undefined)).toBe('enviado');
    expect(trackingState('Enviado', { viewedAt: null, status: 'pending' })).toBe('enviado');
    expect(trackingState('Enviado', { viewedAt: '2026-11-10T10:00:00Z', status: 'pending' })).toBe('visto');
  });
});

describe('daysSince', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  it('cuenta días desde una fecha', () => {
    expect(daysSince('2026-11-08', now)).toBe(3);
    expect(daysSince('2026-11-11T11:00:00Z', now)).toBe(0);
  });
  it('devuelve null si no hay fecha válida', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('no-fecha', now)).toBeNull();
  });
});

describe('plantillas', () => {
  const partida: PartidaPresupuesto = {
    descripcion: 'Plato de ducha 120x80', tipo: 'material', cantidad: 2, precioUnitario: 95.5, total: 191,
    dbItemId: 'abc', material_order_placed: true, precioCoste: 60,
  };
  it('al guardar quita ids de BD y estado de pedido', () => {
    const p = partidaForTemplate(partida);
    expect(p.dbItemId).toBeUndefined();
    expect(p.material_order_placed).toBeUndefined();
    expect(p.precioCoste).toBe(60);
  });
  it('al usarla recalcula el total de cada partida', () => {
    const t: QuoteTemplate = {
      id: 't1', nombre: 'Cambio bañera', descripcion: '', iva_pct: 10, uso_count: 0, last_used_at: null,
      partidas: [{ ...partida, total: 999 }, { descripcion: 'Mano de obra', tipo: 'mano_de_obra', cantidad: 6, precioUnitario: 0, total: 0 }],
    };
    const out = partidasFromTemplate(t);
    expect(out[0].total).toBe(191);
    expect(out[1].total).toBe(0);
  });
});
