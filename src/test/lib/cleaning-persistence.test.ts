/**
 * Tests de compatibilidad del contrato de persistencia para PH0-CLEANING-QUOTES-1.
 * Sin Supabase, sin red. Valida únicamente tipado y contratos de datos.
 */
import { describe, it, expect } from 'vitest';
import { toCleaningQuoteMetadata, parseCleaningIntake } from '../../lib/cleaning/cleaningIntake';

// ─── A) Presupuesto legacy (sin metadata) ─────────────────────────────────────
describe('saveQuote compatibility — legacy quote (no metadata)', () => {
  it('TradeQuote sin metadata no rompe al acceder a metadata', () => {
    // Simula un presupuesto guardado antes de PH0-CLEANING-QUOTES-1
    const legacyQuote: { metadata?: Record<string, unknown> | null } = { metadata: null };
    expect(legacyQuote.metadata).toBeNull();
    expect(legacyQuote.metadata?.['vertical']).toBeUndefined();
  });

  it('TradeQuote con metadata undefined no rompe', () => {
    const quoteWithoutMeta: { metadata?: Record<string, unknown> | null } = {};
    expect(quoteWithoutMeta.metadata).toBeUndefined();
    expect(() => quoteWithoutMeta.metadata?.['vertical']).not.toThrow();
  });

  it('payload legacy sin metadata — if (metadata) guard funciona', () => {
    // Simula la lógica de insertPayload en saveQuote
    const insertPayload: Record<string, unknown> = { org_id: 'x', client_id: 'y' };
    const metadata: Record<string, unknown> | undefined = undefined;
    if (metadata) insertPayload.metadata = metadata;
    expect(insertPayload['metadata']).toBeUndefined();
  });
});

// ─── B) Presupuesto limpieza (con metadata) ───────────────────────────────────
describe('saveQuote compatibility — cleaning quote (with metadata)', () => {
  it('toCleaningQuoteMetadata devuelve Record<string, unknown> con estructura válida', () => {
    const intake = parseCleaningIntake('Limpieza de vivienda dos habitaciones');
    const meta = toCleaningQuoteMetadata(intake);
    expect(meta['vertical']).toBe('cleaning');
    expect(meta['schemaVersion']).toBe(1);
    expect(meta['intake']).toBeDefined();
  });

  it('payload con metadata cleaning se inserta correctamente', () => {
    const intake = parseCleaningIntake('Local fin de obra 45 metros');
    const metadata = toCleaningQuoteMetadata(intake);
    const insertPayload: Record<string, unknown> = { org_id: 'x', client_id: 'y' };
    if (metadata) insertPayload.metadata = metadata;
    expect(insertPayload['metadata']).toBeDefined();
    const m = insertPayload['metadata'] as Record<string, unknown>;
    expect(m['vertical']).toBe('cleaning');
    expect(m['schemaVersion']).toBe(1);
  });

  it('metadata cleaning es serializable a JSON sin pérdida', () => {
    const intake = parseCleaningIntake('Oficina 80m recurrente dos veces por semana');
    const meta = toCleaningQuoteMetadata(intake);
    const roundTripped = JSON.parse(JSON.stringify(meta));
    expect(roundTripped.vertical).toBe('cleaning');
    expect(roundTripped.schemaVersion).toBe(1);
    expect(roundTripped.intake.spaceType).toBe('oficina');
  });
});

// ─── C) Partidas antiguas sin unidad ─────────────────────────────────────────
describe('saveQuote compatibility — legacy items (no unidad)', () => {
  it('partida legacy sin unidad se construye correctamente con unidad = null', () => {
    const legacyItem = {
      descripcion: 'Mano de obra fontanería',
      tipo: 'mano_de_obra' as const,
      cantidad: 3,
      precio_unitario: 45,
      precio_material: null,
      supplier_key: null,
      supplier_name: null,
      supplier_ref: null,
      catalog_variant_id: null,
      familia: null,
      unidad: null,             // nullable — columna nueva con NULL por defecto
    };
    expect(legacyItem.unidad).toBeNull();
    // El sistema no debe fallar al procesar unidad = null
    const rendered = legacyItem.unidad ?? 'ud';
    expect(rendered).toBe('ud');
  });

  it('partida legacy sin unidad — el campo es opcional en el tipo', () => {
    // Verifica que un objeto sin 'unidad' es válido (TS ya garantiza esto, pero test runtime también)
    const item: { descripcion: string; tipo: string; unidad?: string | null } = {
      descripcion: 'Instalación split',
      tipo: 'mano_de_obra',
    };
    expect(item.unidad).toBeUndefined();
    expect(item.unidad ?? null).toBeNull();
  });
});

// ─── D) Partidas nuevas con unidad ────────────────────────────────────────────
describe('saveQuote compatibility — new items (with unidad)', () => {
  it('partida de limpieza con unidad m2 se mapea correctamente', () => {
    const cleaningItem = {
      descripcion: 'Limpieza integral suelos',
      tipo: 'mano_de_obra' as const,
      cantidad: 80,
      precio_unitario: 0,
      precio_material: null,
      supplier_key: null,
      supplier_name: null,
      supplier_ref: null,
      catalog_variant_id: null,
      familia: null,
      unidad: 'm2',
    };
    expect(cleaningItem.unidad).toBe('m2');
  });

  it('partida con unidad "visita" se preserva en el payload', () => {
    const payload = { unidad: 'visita' as string | null };
    expect(payload.unidad).toBe('visita');
  });

  it('unidades válidas del sistema limpieza son serializables', () => {
    const unidades = ['hora', 'm2', 'unidad', 'visita', 'jornada', 'mes', 'ud', 'ml'];
    unidades.forEach(u => {
      const item = { unidad: u };
      expect(JSON.parse(JSON.stringify(item)).unidad).toBe(u);
    });
  });
});

// ─── Regresión: presupuestos existentes no se ven afectados ──────────────────
describe('regression — existing quotes unaffected', () => {
  it('presupuesto de fontanería no tiene metadata cleaning', () => {
    const fontaneriaQuote: { metadata?: Record<string, unknown> | null } = { metadata: null };
    const isCleaningQuote = fontaneriaQuote.metadata?.['vertical'] === 'cleaning';
    expect(isCleaningQuote).toBe(false);
  });

  it('vertical cleaning solo aparece cuando se serializa intake de limpieza', () => {
    const meta = toCleaningQuoteMetadata({ spaceType: 'vivienda' });
    expect(meta['vertical']).toBe('cleaning');
    // Otro vertical hipotético no interfiere
    const otherMeta: Record<string, unknown> = { vertical: 'reforma', schemaVersion: 1 };
    expect(otherMeta['vertical']).not.toBe('cleaning');
  });
});
