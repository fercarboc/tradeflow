/**
 * TX-FLEET-ODO-1 FASE H — Tests para vehicleKm.ts
 * Cubre: loadVehicleKmHistory (filtros, marcado anulada) y
 * correctVehicleKmReading (parámetros, propagación de errores).
 *
 * Nota: la lógica transaccional (trigger _sync_vehicle_km_actual,
 * idempotencia por UNIQUE INDEX) requiere PostgreSQL real y no puede
 * validarse con mocks. Ver FASE H del spec TX-FLEET-ODO-1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadVehicleKmHistory,
  correctVehicleKmReading,
} from '../../lib/vehicleKm';
import type { VehicleKmReading } from '../../lib/vehicleKm';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

type Chain = Record<string, unknown>;

function makeChain(resolveWith: { data?: unknown; error?: unknown }): Chain {
  const chain: Chain = {};
  chain.select  = vi.fn(() => chain);
  chain.eq      = vi.fn(() => chain);
  chain.order   = vi.fn(() => chain);
  chain.limit   = vi.fn(() => chain);
  chain.single  = vi.fn(() => Promise.resolve(resolveWith));
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(() => makeChain({ data: null, error: null })),
  mockRpc:  vi.fn<() => Promise<{ data: unknown; error: unknown }>>(() =>
    Promise.resolve({ data: null, error: null }),
  ),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_A   = 'org-a-0000-0000-0000-000000000001';
const VEH_1   = 'veh-0000-0000-0000-000000000001';
const READ_1  = 'read-0000-0000-0000-000000000001';
const READ_2  = 'read-0000-0000-0000-000000000002';
const READ_3  = 'read-0000-0000-0000-000000000003';

function makeReading(overrides: Partial<VehicleKmReading> = {}): VehicleKmReading {
  return {
    id:          READ_1,
    org_id:      ORG_A,
    vehicle_id:  VEH_1,
    tipo:        'manual',
    km:          10000,
    leido_en:    '2026-10-01T10:00:00.000Z',
    servicio_id: null,
    fuente:      'manual',
    notas:       null,
    corrige_id:  null,
    created_by:  null,
    created_at:  '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

// ── loadVehicleKmHistory ──────────────────────────────────────────────────────

describe('loadVehicleKmHistory', () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() => makeChain({ data: [], error: null }));
  });

  it('KM-1 — retorna lista vacía si no hay lecturas', async () => {
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(result).toEqual([]);
  });

  it('KM-2 — retorna lecturas con anulada=false si nadie las corrige', async () => {
    const rows = [makeReading({ id: READ_1 }), makeReading({ id: READ_2, km: 11000 })];
    mockFrom.mockReturnValueOnce(makeChain({ data: rows, error: null }));
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.anulada === false)).toBe(true);
  });

  it('KM-3 — marca como anulada la lectura que es corregida por otra', async () => {
    const original   = makeReading({ id: READ_1, km: 9999 });
    const correccion = makeReading({ id: READ_2, km: 10100, tipo: 'correccion', corrige_id: READ_1 });
    mockFrom.mockReturnValueOnce(makeChain({ data: [original, correccion], error: null }));
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    const orig = result.find(r => r.id === READ_1);
    const corr = result.find(r => r.id === READ_2);
    expect(orig?.anulada).toBe(true);
    expect(corr?.anulada).toBe(false);
  });

  it('KM-4 — la corrección misma no se marca como anulada', async () => {
    const original   = makeReading({ id: READ_1 });
    const correccion = makeReading({ id: READ_2, tipo: 'correccion', corrige_id: READ_1 });
    mockFrom.mockReturnValueOnce(makeChain({ data: [original, correccion], error: null }));
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(result.find(r => r.id === READ_2)?.anulada).toBe(false);
  });

  it('KM-5 — solo anula la lectura referenciada, no otras', async () => {
    const r1 = makeReading({ id: READ_1, km: 10000 });
    const r2 = makeReading({ id: READ_2, km: 10100 });
    const r3 = makeReading({ id: READ_3, km: 9999, tipo: 'correccion', corrige_id: READ_1 });
    mockFrom.mockReturnValueOnce(makeChain({ data: [r1, r2, r3], error: null }));
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(result.find(r => r.id === READ_1)?.anulada).toBe(true);
    expect(result.find(r => r.id === READ_2)?.anulada).toBe(false);
    expect(result.find(r => r.id === READ_3)?.anulada).toBe(false);
  });

  it('KM-6 — propaga error de Supabase', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('DB error') }));
    await expect(loadVehicleKmHistory(ORG_A, VEH_1)).rejects.toThrow('DB error');
  });

  it('KM-7 — data null sin error se trata como lista vacía', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const result = await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(result).toHaveLength(0);
  });

  it('KM-8 — respeta el limit pasado como argumento', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);
    await loadVehicleKmHistory(ORG_A, VEH_1, 10);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('KM-9 — filtra por org_id y vehicle_id para aislamiento', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);
    await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(chain.eq).toHaveBeenCalledWith('org_id', ORG_A);
    expect(chain.eq).toHaveBeenCalledWith('vehicle_id', VEH_1);
  });

  it('KM-10 — ordena por leido_en DESC', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);
    await loadVehicleKmHistory(ORG_A, VEH_1);
    expect(chain.order).toHaveBeenCalledWith('leido_en', { ascending: false });
  });
});

// ── correctVehicleKmReading ───────────────────────────────────────────────────

describe('correctVehicleKmReading', () => {
  beforeEach(() => {
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('KM-C1 — llama al RPC con los parámetros correctos', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, correccion_id: READ_2, km_correcto: 10100 },
      error: null,
    });
    const result = await correctVehicleKmReading(ORG_A, VEH_1, {
      corrige_id:  READ_1,
      km_correcto: 10100,
      notas:       'Error de digitación',
    });
    expect(mockRpc).toHaveBeenCalledWith('correct_vehicle_km_reading', expect.objectContaining({
      p_org_id:      ORG_A,
      p_vehicle_id:  VEH_1,
      p_corrige_id:  READ_1,
      p_km_correcto: 10100,
      p_notas:       'Error de digitación',
    }));
    expect(result.ok).toBe(true);
    expect(result.km_correcto).toBe(10100);
  });

  it('KM-C2 — envía p_leido_en null si no se pasa', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, correccion_id: READ_2, km_correcto: 10100 }, error: null });
    await correctVehicleKmReading(ORG_A, VEH_1, { corrige_id: READ_1, km_correcto: 10100 });
    expect(mockRpc).toHaveBeenCalledWith('correct_vehicle_km_reading', expect.objectContaining({
      p_leido_en: null,
      p_notas:    null,
    }));
  });

  it('KM-C3 — envía p_leido_en si se pasa', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, correccion_id: READ_2, km_correcto: 500 }, error: null });
    const leido_en = '2026-09-15T08:00:00.000Z';
    await correctVehicleKmReading(ORG_A, VEH_1, { corrige_id: READ_1, km_correcto: 500, leido_en });
    expect(mockRpc).toHaveBeenCalledWith('correct_vehicle_km_reading', expect.objectContaining({
      p_leido_en: leido_en,
    }));
  });

  it('KM-C4 — propaga error del RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('TRANSPORT_INVALID: ya corregida') });
    await expect(
      correctVehicleKmReading(ORG_A, VEH_1, { corrige_id: READ_1, km_correcto: 10100 }),
    ).rejects.toThrow('ya corregida');
  });

  it('KM-C5 — retorna la estructura { ok, correccion_id, km_correcto }', async () => {
    const expected = { ok: true, correccion_id: READ_3, km_correcto: 12345 };
    mockRpc.mockResolvedValueOnce({ data: expected, error: null });
    const result = await correctVehicleKmReading(ORG_A, VEH_1, { corrige_id: READ_1, km_correcto: 12345 });
    expect(result).toEqual(expected);
  });
});
