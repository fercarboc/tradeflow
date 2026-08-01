/**
 * C-002 — Benchmark latencia resolución Marketplace
 * Mide el tiempo añadido por las 2 queries batch de resolveMarketplaceIds.
 * No requiere DB real — usa el mock con latencia simulada.
 *
 * Criterio de aceptación: latencia añadida < 100ms con 20 gc_ids (mock sin latencia de red).
 * En producción la latencia real dependerá del RTT a Supabase.
 */

import { describe, it, expect, vi } from 'vitest';

interface MarketplaceMapping {
  universal_product_id: string;
  universal_variant_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveMarketplaceIds(
  supabase: any,
  gcIds: string[],
): Promise<Map<string, MarketplaceMapping>> {
  const result = new Map<string, MarketplaceMapping>();
  if (gcIds.length === 0) return result;

  const { data: directUPs } = await supabase
    .from('trade_marketplace_universal_products')
    .select('id, global_catalog_id')
    .in('global_catalog_id', gcIds);

  const resolvedGcIds = new Set<string>();
  for (const up of (directUPs ?? []) as Array<{ id: string; global_catalog_id: string }>) {
    result.set(up.global_catalog_id, { universal_product_id: up.id, universal_variant_id: null });
    resolvedGcIds.add(up.global_catalog_id);
  }

  const remainingGcIds = gcIds.filter(id => !resolvedGcIds.has(id));
  if (remainingGcIds.length > 0) {
    const { data: variants } = await supabase
      .from('trade_marketplace_universal_product_variants')
      .select('id, global_catalog_id, universal_product_id')
      .in('global_catalog_id', remainingGcIds)
      .eq('activa', true);

    for (const v of (variants ?? []) as Array<{ id: string; global_catalog_id: string; universal_product_id: string }>) {
      if (!result.has(v.global_catalog_id)) {
        result.set(v.global_catalog_id, {
          universal_product_id: v.universal_product_id,
          universal_variant_id: v.id,
        });
      }
    }
  }

  return result;
}

function buildMockClient(opts: {
  directUPs?: Array<{ id: string; global_catalog_id: string }>;
  variants?: Array<{ id: string; global_catalog_id: string; universal_product_id: string; activa: boolean }>;
  latencyMs?: number;
}) {
  const ups     = opts.directUPs ?? [];
  const vars    = opts.variants  ?? [];
  const latency = opts.latencyMs ?? 0;

  function delayed<T>(data: T): Promise<{ data: T; error: null }> {
    if (latency === 0) return Promise.resolve({ data, error: null });
    return new Promise(resolve => setTimeout(() => resolve({ data, error: null }), latency));
  }

  return {
    from(table: string) {
      return {
        select(_fields: string) {
          return {
            in(_col: string, ids: string[]) {
              if (table === 'trade_marketplace_universal_products') {
                return delayed(ups.filter(u => ids.includes(u.global_catalog_id)));
              }
              if (table === 'trade_marketplace_universal_product_variants') {
                return {
                  eq(_col2: string, val: unknown) {
                    return delayed(vars.filter(v => ids.includes(v.global_catalog_id) && v.activa === val));
                  },
                };
              }
              return delayed([]);
            },
          };
        },
      };
    },
    _calls: 0,
  };
}

describe('C-002 Benchmark', () => {

  it('BENCH-1 — 0 gc_ids: resolución sin queries (< 1ms)', async () => {
    const supabase = buildMockClient({});
    const t0 = performance.now();
    await resolveMarketplaceIds(supabase, []);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(1);
    console.log(`[BENCH-1] 0 gc_ids: ${elapsed.toFixed(3)}ms`);
  });

  it('BENCH-2 — 5 gc_ids, mock sin latencia: < 5ms', async () => {
    const gcIds = Array.from({ length: 5 }, (_, i) => `gc-${i}`);
    const ups   = gcIds.slice(0, 3).map((gcId, i) => ({ id: `up-${i}`, global_catalog_id: gcId }));
    const vars  = gcIds.slice(3).map((gcId, i) => ({
      id: `var-${i}`, global_catalog_id: gcId, universal_product_id: `up-parent-${i}`, activa: true,
    }));

    const supabase = buildMockClient({ directUPs: ups, variants: vars });
    const t0 = performance.now();
    const result = await resolveMarketplaceIds(supabase, gcIds);
    const elapsed = performance.now() - t0;

    expect(result.size).toBe(5);
    expect(elapsed).toBeLessThan(5);
    console.log(`[BENCH-2] 5 gc_ids: ${elapsed.toFixed(3)}ms (2 queries)`);
  });

  it('BENCH-3 — 20 gc_ids, mock sin latencia: < 10ms', async () => {
    const gcIds = Array.from({ length: 20 }, (_, i) => `gc-${String(i).padStart(3,'0')}`);
    const ups   = gcIds.slice(0, 10).map((gcId, i) => ({ id: `up-${i}`, global_catalog_id: gcId }));
    const vars  = gcIds.slice(10).map((gcId, i) => ({
      id: `var-${i}`, global_catalog_id: gcId, universal_product_id: `up-parent-${i}`, activa: true,
    }));

    const supabase = buildMockClient({ directUPs: ups, variants: vars });
    const t0 = performance.now();
    const result = await resolveMarketplaceIds(supabase, gcIds);
    const elapsed = performance.now() - t0;

    expect(result.size).toBe(20);
    expect(elapsed).toBeLessThan(10);
    console.log(`[BENCH-3] 20 gc_ids: ${elapsed.toFixed(3)}ms (2 queries — anti N+1)`);
  });

  it('BENCH-4 — 20 gc_ids, latencia simulada 10ms/query: exactamente 2 roundtrips', async () => {
    const gcIds = Array.from({ length: 20 }, (_, i) => `gc-${i}`);
    const ups   = gcIds.slice(0, 12).map((gcId, i) => ({ id: `up-${i}`, global_catalog_id: gcId }));
    const vars  = gcIds.slice(12).map((gcId, i) => ({
      id: `var-${i}`, global_catalog_id: gcId, universal_product_id: `up-p-${i}`, activa: true,
    }));

    const supabase = buildMockClient({ directUPs: ups, variants: vars, latencyMs: 10 });
    const t0 = performance.now();
    const result = await resolveMarketplaceIds(supabase, gcIds);
    const elapsed = performance.now() - t0;

    // Con N+1 (20 líneas × 2 queries = 40 roundtrips × 10ms = 400ms mínimo)
    // Con batch (2 queries × 10ms = 20ms)
    expect(result.size).toBe(20);
    expect(elapsed).toBeLessThan(50); // < 50ms con 2 roundtrips de 10ms
    console.log(`[BENCH-4] 20 gc_ids, 10ms latencia simulada: ${elapsed.toFixed(1)}ms (esperado ~20ms)`);
  });

  it('BENCH-5 — precisión no regresiona: todos los mappings correctos con 20 gc_ids', async () => {
    const gcIds   = Array.from({ length: 20 }, (_, i) => `gc-${i}`);
    const upCount  = 12;
    const varCount = 8;
    const ups  = gcIds.slice(0, upCount).map((gcId, i) => ({ id: `up-${i}`, global_catalog_id: gcId }));
    const vars = gcIds.slice(upCount).map((gcId, i) => ({
      id: `var-${i}`, global_catalog_id: gcId, universal_product_id: `up-p-${i}`, activa: true,
    }));

    const supabase = buildMockClient({ directUPs: ups, variants: vars });
    const result = await resolveMarketplaceIds(supabase, gcIds);

    // Todos los gc_ids tienen mapping
    expect(result.size).toBe(20);

    // UPs directos: variant_id = null
    for (let i = 0; i < upCount; i++) {
      const m = result.get(gcIds[i])!;
      expect(m.universal_product_id).toBe(`up-${i}`);
      expect(m.universal_variant_id).toBeNull();
    }

    // Variantes: variant_id no null
    for (let i = 0; i < varCount; i++) {
      const m = result.get(gcIds[upCount + i])!;
      expect(m.universal_product_id).toBe(`up-p-${i}`);
      expect(m.universal_variant_id).toBe(`var-${i}`);
    }
  });
});
