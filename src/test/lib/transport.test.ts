import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMatricula,
  normalizeMatricula,
  createVehicle,
  updateVehicle,
  deactivateVehicle,
  setVehicleEstado,
  setWorkerConductor,
  loadVehicles,
  loadVehiclesAll,
  VEHICLE_TIPOS,
  VEHICLE_ESTADOS,
} from '../../lib/transport';
import type { TradeVehicleInput } from '../../lib/transport';

// ── Mock Supabase ────────────────────────────────────────────────────────────

// Chainable builder that is also properly thenable
function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select  = vi.fn(() => chain);
  chain.insert  = vi.fn(() => chain);
  chain.update  = vi.fn(() => chain);
  chain.eq      = vi.fn(() => chain);
  chain.order   = vi.fn(() => chain);
  chain.single  = vi.fn(() => Promise.resolve(resolveWith));
  // Proper thenable: must call resolve with the value
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => makeChain({ data: null, error: null })),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const ORG_A = 'org-a-uuid-1111-1111-1111-111111111111';
const ORG_B = 'org-b-uuid-2222-2222-2222-222222222222';

function makeVehicle(overrides: Partial<TradeVehicleInput> = {}) {
  return {
    nombre: 'Bus 1',
    matricula: '1234ABC',
    tipo: 'microbus' as const,
    capacidad_viajeros: 20,
    estado: 'disponible' as const,
    marca: 'Mercedes',
    modelo_vehiculo: 'Sprinter',
    anno: 2020,
    color: 'Blanco',
    notas: null,
    ...overrides,
  } satisfies TradeVehicleInput;
}

// ── validateMatricula ────────────────────────────────────────────────────────

describe('validateMatricula', () => {
  it('acepta formato moderno 4 dígitos + 3 letras', () => {
    expect(validateMatricula('1234ABC')).toBe(true);
  });

  it('acepta con guión (1234-ABC)', () => {
    expect(validateMatricula('1234-ABC')).toBe(true);
  });

  it('acepta con espacio (1234 ABC)', () => {
    expect(validateMatricula('1234 ABC')).toBe(true);
  });

  it('acepta matrícula provincial antigua (B1234CD)', () => {
    expect(validateMatricula('B1234CD')).toBe(true);
  });

  it('acepta matrícula de 4 caracteres (mínimo)', () => {
    expect(validateMatricula('ABCD')).toBe(true);
  });

  it('acepta matrícula de 10 caracteres (máximo)', () => {
    expect(validateMatricula('AB12345678')).toBe(true);
  });

  it('rechaza cadena vacía', () => {
    expect(validateMatricula('')).toBe(false);
  });

  it('rechaza solo espacios', () => {
    expect(validateMatricula('   ')).toBe(false);
  });

  it('rechaza menos de 4 caracteres reales', () => {
    expect(validateMatricula('AB')).toBe(false);
    expect(validateMatricula('ABC')).toBe(false);
  });

  it('rechaza más de 10 caracteres reales', () => {
    expect(validateMatricula('AB123456789')).toBe(false);
  });

  it('rechaza caracteres especiales (no alfanumérico)', () => {
    expect(validateMatricula('1234!ABC')).toBe(false);
    expect(validateMatricula('12.34ABC')).toBe(false);
  });

  it('acepta en minúsculas (normaliza antes de validar)', () => {
    expect(validateMatricula('1234abc')).toBe(true);
  });
});

// ── normalizeMatricula ───────────────────────────────────────────────────────

describe('normalizeMatricula', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizeMatricula('1234abc')).toBe('1234ABC');
  });

  it('elimina espacios iniciales y finales', () => {
    expect(normalizeMatricula('  1234ABC  ')).toBe('1234ABC');
  });

  it('conserva guiones internos', () => {
    expect(normalizeMatricula('1234-ABC')).toBe('1234-ABC');
  });
});

// ── Catálogos ────────────────────────────────────────────────────────────────

describe('VEHICLE_TIPOS', () => {
  it('contiene exactamente 6 tipos', () => {
    expect(VEHICLE_TIPOS).toHaveLength(6);
  });

  it('incluye furgoneta, microbus, autocar', () => {
    const values = VEHICLE_TIPOS.map(t => t.value);
    expect(values).toContain('furgoneta');
    expect(values).toContain('microbus');
    expect(values).toContain('autocar');
  });
});

describe('VEHICLE_ESTADOS', () => {
  it('contiene exactamente 4 estados', () => {
    expect(VEHICLE_ESTADOS).toHaveLength(4);
  });

  it('incluye disponible y baja', () => {
    const values = VEHICLE_ESTADOS.map(e => e.value);
    expect(values).toContain('disponible');
    expect(values).toContain('baja');
  });

  it('cada estado tiene color definido', () => {
    for (const e of VEHICLE_ESTADOS) {
      expect(e.color.length).toBeGreaterThan(0);
    }
  });
});

// ── createVehicle — validaciones de dominio ──────────────────────────────────

describe('createVehicle — validaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza error si matrícula es inválida', async () => {
    await expect(
      createVehicle(ORG_A, makeVehicle({ matricula: 'XX' })),
    ).rejects.toThrow('Matrícula inválida');
  });

  it('lanza error si capacidad < 1', async () => {
    await expect(
      createVehicle(ORG_A, makeVehicle({ capacidad_viajeros: 0 })),
    ).rejects.toThrow('capacidad');
  });

  it('lanza error si capacidad > 90', async () => {
    await expect(
      createVehicle(ORG_A, makeVehicle({ capacidad_viajeros: 91 })),
    ).rejects.toThrow('capacidad');
  });

  it('lanza error si capacidad = 90 no lanza (límite aceptado)', async () => {
    const dbRow = { id: 'uuid-1', org_id: ORG_A, activo: true, ...makeVehicle({ capacidad_viajeros: 90 }) };
    const chain = makeChain({ data: dbRow, error: null });
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);
    await expect(
      createVehicle(ORG_A, makeVehicle({ capacidad_viajeros: 90 })),
    ).resolves.toBeDefined();
  });
});

// ── updateVehicle — validaciones de dominio ──────────────────────────────────

describe('updateVehicle — validaciones', () => {
  it('lanza error si matricula del update es inválida', async () => {
    await expect(
      updateVehicle('id-1', ORG_A, { matricula: 'X' }),
    ).rejects.toThrow('Matrícula inválida');
  });

  it('lanza error si capacidad del update < 1', async () => {
    await expect(
      updateVehicle('id-1', ORG_A, { capacidad_viajeros: 0 }),
    ).rejects.toThrow('capacidad');
  });
});

// ── Aislamiento multitenant ──────────────────────────────────────────────────

/** Crea un chain thenable que captura el valor de la columna `captureCol`. */
function makeCaptureChain(
  captureCol: string,
  resolveWith: { data: unknown; error: null },
): { chain: Record<string, unknown>; captured: { value: unknown } } {
  const captured = { value: null as unknown };
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.order  = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(resolveWith));
  chain.eq = vi.fn((_col: string, val: unknown) => {
    if (_col === captureCol) captured.value = val;
    return chain;
  });
  // Proper thenable: must invoke `resolve` with the resolved value
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return { chain, captured };
}

describe('aislamiento de org_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadVehicles filtra por org_id correcto', async () => {
    const orgAData = [{ id: 'v1', org_id: ORG_A, nombre: 'Bus A' }];
    const { chain, captured } = makeCaptureChain('org_id', { data: orgAData, error: null });
    // Override order to be the terminal call
    chain.order = vi.fn(() => Promise.resolve({ data: orgAData, error: null }));
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    const result = await loadVehicles(ORG_A);
    expect(captured.value).toBe(ORG_A);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('deactivateVehicle incluye org_id en el filtro', async () => {
    const { chain, captured } = makeCaptureChain('org_id', { data: null, error: null });
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    await deactivateVehicle('id-1', ORG_B);
    expect(captured.value).toBe(ORG_B);
  });

  it('setVehicleEstado incluye org_id en el filtro', async () => {
    const { chain, captured } = makeCaptureChain('org_id', { data: null, error: null });
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    await setVehicleEstado('id-1', ORG_A, 'en_servicio');
    expect(captured.value).toBe(ORG_A);
  });
});

// ── loadVehiclesAll ──────────────────────────────────────────────────────────

describe('loadVehiclesAll', () => {
  it('devuelve tanto activos como inactivos', async () => {
    const data = [
      { id: 'v1', activo: true,  nombre: 'Bus 1' },
      { id: 'v2', activo: false, nombre: 'Bus 2 (baja)' },
    ];
    let orderCallCount = 0;
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq     = vi.fn(() => chain);
    chain.order  = vi.fn(() => {
      orderCallCount++;
      if (orderCallCount >= 2) return Promise.resolve({ data, error: null });
      return chain;
    });
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    const result = await loadVehiclesAll(ORG_A);
    expect(result).toHaveLength(2);
  });
});

// ── setWorkerConductor — filtro defensivo org_id ─────────────────────────────

describe('setWorkerConductor', () => {
  it('incluye org_id en el filtro (guarda defensivo app-level)', async () => {
    const { chain, captured } = makeCaptureChain('org_id', { data: null, error: null });
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    await setWorkerConductor('worker-1', ORG_A, true);
    expect(captured.value).toBe(ORG_A);
  });

  it('incluye el valor booleano correcto al habilitar', async () => {
    let capturedUpdate: unknown = null;
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn((patch: unknown) => { capturedUpdate = patch; return chain; });
    chain.eq = vi.fn(() => chain);
    chain.then = (resolve: (v: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve);
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    await setWorkerConductor('worker-1', ORG_A, true);
    expect((capturedUpdate as Record<string, unknown>).es_conductor).toBe(true);
  });

  it('incluye el valor booleano correcto al deshabilitar', async () => {
    let capturedUpdate: unknown = null;
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn((patch: unknown) => { capturedUpdate = patch; return chain; });
    chain.eq = vi.fn(() => chain);
    chain.then = (resolve: (v: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve);
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabase.from>);

    await setWorkerConductor('worker-1', ORG_A, false);
    expect((capturedUpdate as Record<string, unknown>).es_conductor).toBe(false);
  });
});
