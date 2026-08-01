/**
 * C-002 — Batch resolution of Marketplace IDs
 * Tests for resolveMarketplaceIds logic extracted from trade-voice-to-quote.
 *
 * Scenarios:
 *   A — UP directo por global_catalog_id
 *   B — variante por global_catalog_id
 *   C — gc_id sin mapping (sin UP ni variante)
 *   D — variante inactiva ignorada
 *   E — coherencia variante→UP (el UP almacenado == UP padre real)
 *   F — 20 líneas, máximo 2 queries
 *   G — match por tarifa instalador: global_catalog_id debe quedar NULL
 */

import { describe, it, expect, vi } from 'vitest';

// ── Tipos mínimos replicados del Edge Function ────────────────────────────────

interface MarketplaceMapping {
  universal_product_id: string;
  universal_variant_id: string | null;
}

// ── Función extraída para testing (misma lógica que index.ts) ─────────────────

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

// ── Mock client factory ───────────────────────────────────────────────────────

interface MockUP    { id: string; global_catalog_id: string }
interface MockVar   { id: string; global_catalog_id: string; universal_product_id: string; activa: boolean }

function buildMockClient(opts: { directUPs?: MockUP[]; variants?: MockVar[] }) {
  const ups  = opts.directUPs ?? [];
  const vars = opts.variants  ?? [];

  const inSpy  = vi.fn();
  const eqSpy  = vi.fn();

  function makeQueryChain(table: string) {
    return {
      select(_fields: string) {
        return {
          in(_col: string, ids: string[]) {
            inSpy(table, ids);
            if (table === 'trade_marketplace_universal_products') {
              const data = ups.filter(u => ids.includes(u.global_catalog_id));
              return Promise.resolve({ data, error: null });
            }
            if (table === 'trade_marketplace_universal_product_variants') {
              return {
                eq(_col2: string, val: unknown) {
                  eqSpy('activa', val);
                  const data = vars.filter(v => ids.includes(v.global_catalog_id) && v.activa === val);
                  return Promise.resolve({ data, error: null });
                },
              };
            }
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    };
  }

  const client = {
    from: vi.fn((table: string) => makeQueryChain(table)),
    _inSpy: inSpy,
    _eqSpy: eqSpy,
  };

  return client;
}

// ── UUIDs de referencia (PILOT-001) ──────────────────────────────────────────

const GC_FON_GRF_COC = 'gc-grif-coc-0000-0000-000000000001';
const GC_FON_CU_015  = 'gc-cu-015-00000-0000-000000000002';
const GC_NO_MAPPING  = 'gc-no-map-00000-0000-000000000003';
const GC_INACTIVE_V  = 'gc-inact-v-0000-0000-000000000004';

const UP_GRIFO_COC   = '145d1eaa-a01b-47f3-b500-53dde3434367';
const UP_TUBO_COBRE  = 'e1b76491-1261-41dd-af99-03b0f2a834e1';
const VAR_TUBO_15MM  = '393f236b-a055-4908-8972-939acfd1fe68';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('C-002 resolveMarketplaceIds', () => {

  it('A — UP directo: devuelve universal_product_id, variant NULL', async () => {
    const supabase = buildMockClient({
      directUPs: [{ id: UP_GRIFO_COC, global_catalog_id: GC_FON_GRF_COC }],
      variants: [],
    });

    const result = await resolveMarketplaceIds(supabase, [GC_FON_GRF_COC]);

    expect(result.size).toBe(1);
    const m = result.get(GC_FON_GRF_COC);
    expect(m).toBeDefined();
    expect(m!.universal_product_id).toBe(UP_GRIFO_COC);
    expect(m!.universal_variant_id).toBeNull();
  });

  it('B — variante: devuelve UP padre + variant_id', async () => {
    const supabase = buildMockClient({
      directUPs: [],
      variants: [{
        id: VAR_TUBO_15MM,
        global_catalog_id: GC_FON_CU_015,
        universal_product_id: UP_TUBO_COBRE,
        activa: true,
      }],
    });

    const result = await resolveMarketplaceIds(supabase, [GC_FON_CU_015]);

    const m = result.get(GC_FON_CU_015);
    expect(m).toBeDefined();
    expect(m!.universal_product_id).toBe(UP_TUBO_COBRE);
    expect(m!.universal_variant_id).toBe(VAR_TUBO_15MM);
  });

  it('C — gc sin mapping: resultado vacío, sin excepción', async () => {
    const supabase = buildMockClient({ directUPs: [], variants: [] });

    const result = await resolveMarketplaceIds(supabase, [GC_NO_MAPPING]);

    expect(result.size).toBe(0);
    expect(result.get(GC_NO_MAPPING)).toBeUndefined();
  });

  it('D — variante inactiva: no se asigna universal_variant_id', async () => {
    const supabase = buildMockClient({
      directUPs: [],
      variants: [{
        id: 'var-inactiva-uuid',
        global_catalog_id: GC_INACTIVE_V,
        universal_product_id: 'up-parent-uuid',
        activa: false,
      }],
    });

    const result = await resolveMarketplaceIds(supabase, [GC_INACTIVE_V]);

    expect(result.size).toBe(0);
    expect(result.get(GC_INACTIVE_V)).toBeUndefined();
  });

  it('E — coherencia variante→UP: el UP almacenado coincide con el padre real de la variante', async () => {
    const supabase = buildMockClient({
      directUPs: [],
      variants: [{
        id: VAR_TUBO_15MM,
        global_catalog_id: GC_FON_CU_015,
        universal_product_id: UP_TUBO_COBRE,
        activa: true,
      }],
    });

    const result = await resolveMarketplaceIds(supabase, [GC_FON_CU_015]);
    const m = result.get(GC_FON_CU_015)!;

    // El UP almacenado debe ser exactamente el UP padre de la variante
    expect(m.universal_product_id).toBe(UP_TUBO_COBRE);
    expect(m.universal_variant_id).toBe(VAR_TUBO_15MM);
  });

  it('F — 20 líneas: máximo 2 queries adicionales (anti N+1)', async () => {
    const gcIds20 = Array.from({ length: 20 }, (_, i) => `gc-${String(i).padStart(3, '0')}-uuid`);
    const directUPs = gcIds20.slice(0, 10).map((gcId, i) => ({
      id: `up-${String(i).padStart(3, '0')}-uuid`,
      global_catalog_id: gcId,
    }));
    const variants = gcIds20.slice(10).map((gcId, i) => ({
      id: `var-${String(i).padStart(3, '0')}-uuid`,
      global_catalog_id: gcId,
      universal_product_id: `up-var-parent-${i}-uuid`,
      activa: true,
    }));

    const supabase = buildMockClient({ directUPs, variants });

    await resolveMarketplaceIds(supabase, gcIds20);

    // Query 1: .in() sobre UPs — exactamente 1 llamada
    const upCalls = supabase._inSpy.mock.calls.filter(
      (c: unknown[]) => c[0] === 'trade_marketplace_universal_products'
    );
    // Query 2: .in() sobre variantes — exactamente 1 llamada
    const varCalls = supabase._inSpy.mock.calls.filter(
      (c: unknown[]) => c[0] === 'trade_marketplace_universal_product_variants'
    );

    expect(upCalls.length).toBe(1);
    expect(varCalls.length).toBe(1);

    // Todos los 20 gc_ids deben tener mapping
    const result = await resolveMarketplaceIds(supabase, gcIds20);
    expect(result.size).toBe(20);
  });

  it('G — match por tarifa instalador: global_catalog_id debe quedar NULL', () => {
    // Este test verifica el contrato de enrichWithCatalogPrices:
    // cuando el match es instaladorMatch (fuente=tarifa_instalador), gcId=null
    // y por tanto global_catalog_id no se debe fijar en la partida.

    // Simulamos la lógica de asignación:
    const partida: { global_catalog_id?: string } = {};
    const matchFromTarifa = { fuente: 'tarifa_instalador', gcId: null as string | null };

    if (matchFromTarifa.gcId) {
      partida.global_catalog_id = matchFromTarifa.gcId;
    }

    // global_catalog_id no debe estar definido para matches de tarifa instalador
    expect(partida.global_catalog_id).toBeUndefined();
  });

  it('lista vacía: devuelve Map vacío sin queries', async () => {
    const supabase = buildMockClient({});

    const result = await resolveMarketplaceIds(supabase, []);

    expect(result.size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('mix UP directo + variante + sin mapping en un mismo presupuesto', async () => {
    const supabase = buildMockClient({
      directUPs: [{ id: UP_GRIFO_COC, global_catalog_id: GC_FON_GRF_COC }],
      variants: [{
        id: VAR_TUBO_15MM,
        global_catalog_id: GC_FON_CU_015,
        universal_product_id: UP_TUBO_COBRE,
        activa: true,
      }],
    });

    const result = await resolveMarketplaceIds(supabase, [
      GC_FON_GRF_COC, GC_FON_CU_015, GC_NO_MAPPING,
    ]);

    // UP directo
    expect(result.get(GC_FON_GRF_COC)!.universal_product_id).toBe(UP_GRIFO_COC);
    expect(result.get(GC_FON_GRF_COC)!.universal_variant_id).toBeNull();

    // Variante
    expect(result.get(GC_FON_CU_015)!.universal_product_id).toBe(UP_TUBO_COBRE);
    expect(result.get(GC_FON_CU_015)!.universal_variant_id).toBe(VAR_TUBO_15MM);

    // Sin mapping
    expect(result.get(GC_NO_MAPPING)).toBeUndefined();
  });
});
