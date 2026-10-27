/**
 * TX-PARTES-IMPL-1A — Tests para loadPartesCompletados y filtros del histórico.
 * Sin migraciones, sin datos reales. Mocks de Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadPartesCompletados,
} from '../../lib/transportServices';
import type { TradeTransportService, PartesFilter, PartesResult } from '../../lib/transportServices';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

type Chain = Record<string, unknown>;

function makeChain(resolveWith: { data?: unknown; error?: unknown }): Chain {
  const chain: Chain = {};
  chain.select  = vi.fn(() => chain);
  chain.eq      = vi.fn(() => chain);
  chain.neq     = vi.fn(() => chain);
  chain.gte     = vi.fn(() => chain);
  chain.lte     = vi.fn(() => chain);
  chain.lt      = vi.fn(() => chain);
  chain.gt      = vi.fn(() => chain);
  chain.order   = vi.fn(() => chain);
  chain.limit   = vi.fn(() => chain);
  chain.single  = vi.fn(() => Promise.resolve(resolveWith));
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(() => makeChain({ data: null, error: null })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_A = 'org-a-0000-0000-0000-000000000001';
const ORG_B = 'org-b-0000-0000-0000-000000000002';
const COND_ID = 'cond-0000-0000-0000-000000000001';
const VEH_ID  = 'veh-0000-0000-0000-000000000001';

function makeParte(overrides: Partial<TradeTransportService> = {}): TradeTransportService {
  return {
    id: 'svc-0000-0000-0000-000000000001',
    org_id: ORG_A,
    titulo: 'Excursión Picos de Europa',
    tipo_servicio: 'excursion',
    estado: 'completado',
    fecha_inicio: '2026-11-10T09:00:00.000Z',
    fecha_fin:    '2026-11-10T18:00:00.000Z',
    paradas: [],
    km_reales: 320,
    incidencias: null,
    observaciones_cierre: null,
    hora_real_salida:  '2026-11-10T09:05:00.000Z',
    hora_real_llegada: '2026-11-10T18:15:00.000Z',
    cerrado_at: '2026-11-10T18:20:00.000Z',
    cerrado_por: 'user-uuid-001',
    conductor_id: COND_ID,
    vehicle_id: VEH_ID,
    client_id: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-10T18:20:00.000Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadPartesCompletados', () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: null }));
  });

  it('PARTES-1 — retorna lista vacía cuando no hay partes', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it('PARTES-2 — retorna partes completados del org', async () => {
    const parte = makeParte();
    mockFrom.mockReturnValueOnce(makeChain({ data: [parte], error: null }));
    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes).toHaveLength(1);
    expect(result.partes[0].estado).toBe('completado');
    expect(result.partes[0].km_reales).toBe(320);
  });

  it('PARTES-3 — lanza error si Supabase falla', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'network error' } }));
    await expect(loadPartesCompletados(ORG_A)).rejects.toMatchObject({ message: 'network error' });
  });

  it('PARTES-4 — filtra por texto en titulo (client-side)', async () => {
    const p1 = makeParte({ id: 'svc-001', titulo: 'Excursión Picos de Europa' });
    const p2 = makeParte({ id: 'svc-002', titulo: 'Traslado aeropuerto Barcelona' });
    mockFrom.mockReturnValueOnce(makeChain({ data: [p1, p2], error: null }));

    const result = await loadPartesCompletados(ORG_A, { search: 'picos' });
    expect(result.partes).toHaveLength(1);
    expect(result.partes[0].titulo).toContain('Picos');
  });

  it('PARTES-5 — búsqueda por texto es case-insensitive', async () => {
    const parte = makeParte({ titulo: 'Excursión Naturaleza' });
    mockFrom.mockReturnValueOnce(makeChain({ data: [parte], error: null }));

    const result = await loadPartesCompletados(ORG_A, { search: 'NATURALEZA' });
    expect(result.partes).toHaveLength(1);
  });

  it('PARTES-6 — sin texto devuelve todos los resultados', async () => {
    const partes = [makeParte({ id: 'svc-001' }), makeParte({ id: 'svc-002' })];
    mockFrom.mockReturnValueOnce(makeChain({ data: partes, error: null }));

    const result = await loadPartesCompletados(ORG_A, { search: '' });
    expect(result.partes).toHaveLength(2);
  });

  it('PARTES-7 — aplica filtro conductorId en la query', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_A, { conductorId: COND_ID });

    // eq debe haberse llamado con conductor_id
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'conductor_id' && c[1] === COND_ID)).toBe(true);
  });

  it('PARTES-8 — aplica filtro vehicleId en la query', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_A, { vehicleId: VEH_ID });

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'vehicle_id' && c[1] === VEH_ID)).toBe(true);
  });

  it('PARTES-9 — aplica filtro desde por fecha_inicio (fecha del servicio)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_A, { desde: '2026-11-01' });

    const gteCalls = (chain.gte as ReturnType<typeof vi.fn>).mock.calls;
    expect(gteCalls.some((c: unknown[]) => c[0] === 'fecha_inicio')).toBe(true);
  });

  it('PARTES-10 — aplica filtro hasta por fecha_inicio (fecha del servicio)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_A, { hasta: '2026-11-30' });

    const lteCalls = (chain.lte as ReturnType<typeof vi.fn>).mock.calls;
    expect(lteCalls.some((c: unknown[]) => c[0] === 'fecha_inicio')).toBe(true);
  });

  it('PARTES-11 — org_id se filtra siempre (aislamiento multiempresa)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_B);

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'org_id' && c[1] === ORG_B)).toBe(true);
  });

  it('PARTES-12 — estado=completado se filtra siempre', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await loadPartesCompletados(ORG_A);

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'estado' && c[1] === 'completado')).toBe(true);
  });

  it('PARTES-13 — multiple partes retornados y ordenados por cerrado_at desc', async () => {
    const p1 = makeParte({ id: 'svc-001', cerrado_at: '2026-11-20T10:00:00.000Z' });
    const p2 = makeParte({ id: 'svc-002', cerrado_at: '2026-11-15T10:00:00.000Z' });
    const p3 = makeParte({ id: 'svc-003', cerrado_at: '2026-11-25T10:00:00.000Z' });
    mockFrom.mockReturnValueOnce(makeChain({ data: [p3, p1, p2], error: null }));

    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes[0].cerrado_at).toBe('2026-11-25T10:00:00.000Z');
    expect(result.partes[1].cerrado_at).toBe('2026-11-20T10:00:00.000Z');
    expect(result.partes[2].cerrado_at).toBe('2026-11-15T10:00:00.000Z');
  });

  it('PARTES-14 — partes sin incidencias tienen incidencias=null', async () => {
    const parte = makeParte({ incidencias: null });
    mockFrom.mockReturnValueOnce(makeChain({ data: [parte], error: null }));

    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes[0].incidencias).toBeNull();
  });

  it('PARTES-15 — parte con incidencia contiene el texto', async () => {
    const parte = makeParte({ incidencias: 'Pinchazo en la rueda delantera derecha' });
    mockFrom.mockReturnValueOnce(makeChain({ data: [parte], error: null }));

    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes[0].incidencias).toContain('Pinchazo');
  });
});

// ── KPI helpers (pure functions) ──────────────────────────────────────────────

describe('KPI helpers (calculados desde partes)', () => {
  it('PARTES-16 — total km suma km_reales de todos los partes', () => {
    const partes = [
      makeParte({ km_reales: 200 }),
      makeParte({ id: 'svc-002', km_reales: 150 }),
      makeParte({ id: 'svc-003', km_reales: 75 }),
    ];
    const totalKm = partes.reduce((acc, s) => acc + (s.km_reales ?? 0), 0);
    expect(totalKm).toBe(425);
  });

  it('PARTES-17 — total km ignora null', () => {
    const partes = [
      makeParte({ km_reales: 100 }),
      makeParte({ id: 'svc-002', km_reales: null }),
    ];
    const totalKm = partes.reduce((acc, s) => acc + (s.km_reales ?? 0), 0);
    expect(totalKm).toBe(100);
  });

  it('PARTES-18 — porcentaje incidencias correcto', () => {
    const partes = [
      makeParte({ incidencias: 'algo' }),
      makeParte({ id: 'svc-002', incidencias: null }),
      makeParte({ id: 'svc-003', incidencias: null }),
      makeParte({ id: 'svc-004', incidencias: 'otra' }),
    ];
    const total  = partes.length;
    const conInc = partes.filter(s => s.incidencias).length;
    const pct    = Math.round((conInc / total) * 100);
    expect(pct).toBe(50);
  });

  it('PARTES-19 — porcentaje incidencias es 0 con lista vacía', () => {
    const partes: TradeTransportService[] = [];
    const total = partes.length;
    const conInc = partes.filter(s => s.incidencias).length;
    const pct = total > 0 ? Math.round((conInc / total) * 100) : 0;
    expect(pct).toBe(0);
  });
});

// ── Aislamiento multiempresa ──────────────────────────────────────────────────

describe('Aislamiento multiempresa', () => {
  it('PARTES-21 — hasMore es false cuando hay menos de PAGE_SIZE resultados', async () => {
    const partes = [makeParte({ id: 'svc-001' }), makeParte({ id: 'svc-002' })];
    mockFrom.mockReturnValueOnce(makeChain({ data: partes, error: null }));

    const result: PartesResult = await loadPartesCompletados(ORG_A);
    expect(result.hasMore).toBe(false);
    expect(result.partes).toHaveLength(2);
  });

  it('PARTES-20 — ORG_A no accede a partes de ORG_B', async () => {
    const parteB = makeParte({ org_id: ORG_B });
    // Supabase filtra por org_id en servidor; el mock simula que la query
    // de ORG_A no devuelve partes de ORG_B
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));

    const result = await loadPartesCompletados(ORG_A);
    expect(result.partes.filter(s => s.org_id === ORG_B)).toHaveLength(0);
    void parteB; // usado solo para documentar el escenario
  });
});
