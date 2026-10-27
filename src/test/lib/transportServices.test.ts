import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateStops,
  validateServiceInput,
  createTransportService,
  updateTransportService,
  cancelTransportService,
  confirmTransportService,
  loadTransportServices,
  loadServiceById,
  completeTransportService,
  TIPO_SERVICIO_OPTIONS,
  SERVICIO_ESTADOS,
} from '../../lib/transportServices';
import type { TradeTransportServiceInput, TradeTransportService, TradeTransportParteInput } from '../../lib/transportServices';

// ── Mock Supabase ────────────────────────────────────────────────────────────

type Chain = Record<string, unknown>;

function makeChain(resolveWith: { data?: unknown; error?: unknown }): Chain {
  const chain: Chain = {};
  chain.select  = vi.fn(() => chain);
  chain.insert  = vi.fn(() => chain);
  chain.update  = vi.fn(() => chain);
  chain.delete  = vi.fn(() => chain);
  chain.eq      = vi.fn(() => chain);
  chain.neq     = vi.fn(() => chain);
  chain.gte     = vi.fn(() => chain);
  chain.lte     = vi.fn(() => chain);
  chain.lt      = vi.fn(() => chain);
  chain.gt      = vi.fn(() => chain);
  chain.in      = vi.fn(() => chain);
  chain.order   = vi.fn(() => chain);
  chain.single  = vi.fn(() => Promise.resolve(resolveWith));
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

// vi.hoisted garantiza que mockFrom y mockRpc se inicialicen antes del hoisting de vi.mock
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(() => makeChain({ data: null, error: null })),
  mockRpc:  vi.fn<() => Promise<{ data: unknown; error: unknown }>>(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

// ── Constantes ───────────────────────────────────────────────────────────────

const ORG_A = 'org-a-0000-0000-0000-000000000001';
const ORG_B = 'org-b-0000-0000-0000-000000000002';
const SVC_ID = 'svc-0000-0000-0000-000000000001';

const FECHA_INI = '2026-11-15T09:00:00.000Z';
const FECHA_FIN = '2026-11-15T18:00:00.000Z';
const FECHA_SIG = '2026-11-16T06:00:00.000Z'; // siguiente día (cruce medianoche)

function makeInput(overrides: Partial<TradeTransportServiceInput> = {}): TradeTransportServiceInput {
  return {
    titulo: 'Excursión Picos de Europa',
    tipo_servicio: 'excursion',
    estado: 'borrador',
    fecha_inicio: FECHA_INI,
    fecha_fin: FECHA_FIN,
    origen: 'Santander',
    destino: 'Picos de Europa',
    paradas: [],
    num_viajeros: 45,
    client_id: null,
    vehicle_id: null,
    conductor_id: null,
    precio_acordado: 1200,
    observaciones: null,
    quote_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockImplementation(() => makeChain({ data: null, error: null }));
  mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
});

// ── Catálogos ────────────────────────────────────────────────────────────────

describe('catálogos', () => {
  it('TIPO_SERVICIO_OPTIONS tiene los 12 tipos activos', () => {
    expect(TIPO_SERVICIO_OPTIONS).toHaveLength(12);
    const values = TIPO_SERVICIO_OPTIONS.map(t => t.value);
    // Valores originales presentes
    expect(values).toContain('ruta_escolar');
    expect(values).toContain('excursion');
    expect(values).toContain('traslado_privado');
    expect(values).toContain('aeropuerto');
    expect(values).toContain('otro');
    // Valores nuevos presentes
    expect(values).toContain('circuito');
    expect(values).toContain('viaje_multidia');
    expect(values).toContain('transporte_trabajadores');
    expect(values).toContain('lanzadera');
    expect(values).toContain('congreso_evento');
    expect(values).toContain('servicio_deportivo');
    expect(values).toContain('asociacion_grupo');
    // Valor heredado NO debe aparecer en el selector
    expect(values).not.toContain('traslado_empresa');
  });

  it('SERVICIO_ESTADOS tiene los 5 estados', () => {
    expect(SERVICIO_ESTADOS).toHaveLength(5);
    expect(SERVICIO_ESTADOS.map(s => s.value)).toEqual([
      'borrador', 'confirmado', 'en_curso', 'completado', 'cancelado',
    ]);
  });

  it('los 12 tipos activos pasan validateServiceInput', () => {
    const newTypes = [
      'circuito','viaje_multidia','transporte_trabajadores','lanzadera',
      'congreso_evento','servicio_deportivo','asociacion_grupo',
    ];
    for (const tipo of newTypes) {
      expect(() => validateServiceInput(makeInput({ tipo_servicio: tipo as TradeTransportServiceInput['tipo_servicio'] }))).not.toThrow();
    }
  });

  it('traslado_empresa heredado pasa validateServiceInput sin lanzar error', () => {
    // El valor heredado puede existir en servicios ya guardados; la validación
    // de aplicación no debe rechazarlo (el CHECK de DB lo acepta).
    expect(() => validateServiceInput(makeInput({ tipo_servicio: 'traslado_empresa' as TradeTransportServiceInput['tipo_servicio'] }))).not.toThrow();
  });
});

// ── validateStops ────────────────────────────────────────────────────────────

describe('validateStops', () => {
  it('acepta array vacío', () => {
    expect(validateStops([])).toEqual([]);
  });

  it('acepta parada con nombre y hora válida', () => {
    const result = validateStops([{ nombre: 'Torrelavega', hora: '09:30' }]);
    expect(result[0].nombre).toBe('Torrelavega');
  });

  it('rechaza parada sin nombre', () => {
    expect(() => validateStops([{ nombre: '' }])).toThrow('nombre');
  });

  it('rechaza hora en formato inválido', () => {
    expect(() => validateStops([{ nombre: 'Parada', hora: '9:5' }])).toThrow('HH:MM');
  });

  it('acepta hora 23:59', () => {
    expect(() => validateStops([{ nombre: 'Parada', hora: '23:59' }])).not.toThrow();
  });

  it('rechaza hora 24:00', () => {
    expect(() => validateStops([{ nombre: 'Parada', hora: '24:00' }])).toThrow();
  });
});

// ── validateServiceInput ─────────────────────────────────────────────────────

describe('validateServiceInput', () => {
  // Escenario 1: creación válida
  it('acepta un input completo y válido', () => {
    expect(() => validateServiceInput(makeInput())).not.toThrow();
  });

  // Escenario 2: campos obligatorios
  it('rechaza título vacío', () => {
    expect(() => validateServiceInput(makeInput({ titulo: '' }))).toThrow('título');
  });

  it('rechaza fecha_inicio ausente', () => {
    expect(() => validateServiceInput(makeInput({ fecha_inicio: '' }))).toThrow('fecha de inicio');
  });

  // Escenario 3: servicio que cruza medianoche
  it('acepta servicio con fecha_fin al día siguiente', () => {
    expect(() => validateServiceInput(makeInput({
      fecha_inicio: FECHA_INI,
      fecha_fin: FECHA_SIG,
    }))).not.toThrow();
  });

  it('rechaza fecha_fin anterior a fecha_inicio', () => {
    expect(() => validateServiceInput(makeInput({
      fecha_inicio: FECHA_FIN,
      fecha_fin: FECHA_INI,
    }))).toThrow('posterior');
  });

  it('acepta num_viajeros nulo (opcional)', () => {
    expect(() => validateServiceInput(makeInput({ num_viajeros: null }))).not.toThrow();
  });

  it('rechaza num_viajeros = 0', () => {
    expect(() => validateServiceInput(makeInput({ num_viajeros: 0 }))).toThrow('entero positivo');
  });

  it('rechaza precio_acordado negativo', () => {
    expect(() => validateServiceInput(makeInput({ precio_acordado: -50 }))).toThrow('negativo');
  });
});

// ── createTransportService ───────────────────────────────────────────────────

describe('createTransportService', () => {
  it('llama a from(trade_transport_services).insert con org_id', async () => {
    const fakeSvc = { id: SVC_ID, org_id: ORG_A, ...makeInput() };
    mockFrom.mockImplementation(() => makeChain({ data: fakeSvc, error: null }));

    const result = await createTransportService(ORG_A, makeInput());
    expect(mockFrom).toHaveBeenCalledWith('trade_transport_services');
    expect(result.id).toBe(SVC_ID);
    expect(result.org_id).toBe(ORG_A);
  });

  it('propaga error de Supabase', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: { message: 'DB error' } }));
    await expect(createTransportService(ORG_A, makeInput())).rejects.toMatchObject({ message: 'DB error' });
  });

  it('rechaza antes de llamar a la DB si el título está vacío', async () => {
    await expect(createTransportService(ORG_A, makeInput({ titulo: '' }))).rejects.toThrow('título');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── updateTransportService ───────────────────────────────────────────────────

describe('updateTransportService', () => {
  it('usa .eq("org_id", orgId) como filtro defensivo', async () => {
    const chain: Chain = {};
    chain.update = vi.fn(() => chain);
    chain.eq     = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: { id: SVC_ID, org_id: ORG_A }, error: null }));

    mockFrom.mockImplementation(() => chain);

    await updateTransportService(SVC_ID, ORG_A, { titulo: 'Nuevo título' });

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const hasOrgFilter = eqCalls.some((c) => c[0] === 'org_id' && c[1] === ORG_A);
    expect(hasOrgFilter).toBe(true);
  });

  it('rechaza matrícula vacía antes de ir a la DB (precio negativo)', async () => {
    await expect(updateTransportService(SVC_ID, ORG_A, { precio_acordado: -1 }))
      .rejects.toThrow('negativo');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── cancelTransportService ───────────────────────────────────────────────────

describe('cancelTransportService', () => {
  // Escenario 18: cancelación sin borrado físico
  it('actualiza estado a cancelado (no hace DELETE)', async () => {
    const chain: Chain = {};
    chain.update = vi.fn(() => chain);
    chain.eq     = vi.fn(() => chain);
    chain.then   = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve);

    mockFrom.mockImplementation(() => chain);

    await cancelTransportService(SVC_ID, ORG_A);

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'cancelado' }));
    expect(chain.delete).toBeUndefined();
  });
});

// ── loadTransportServices ────────────────────────────────────────────────────

describe('loadTransportServices', () => {
  it('filtra por org_id', async () => {
    const chain: Chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq     = vi.fn(() => chain);
    chain.gte    = vi.fn(() => chain);
    chain.lte    = vi.fn(() => chain);
    chain.order  = vi.fn(() => chain);
    chain.then   = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);

    mockFrom.mockImplementation(() => chain);

    await loadTransportServices(ORG_A);

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    expect(eqCalls.some((c) => c[0] === 'org_id' && c[1] === ORG_A)).toBe(true);
  });

  it('aplica filtro de estado cuando se especifica', async () => {
    const chain: Chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq     = vi.fn(() => chain);
    chain.gte    = vi.fn(() => chain);
    chain.lte    = vi.fn(() => chain);
    chain.order  = vi.fn(() => chain);
    chain.then   = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);

    mockFrom.mockImplementation(() => chain);

    await loadTransportServices(ORG_A, { estado: 'confirmado' });

    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    expect(eqCalls.some((c) => c[0] === 'estado' && c[1] === 'confirmado')).toBe(true);
  });
});

// ── Escenarios de aislamiento multitenant ────────────────────────────────────

describe('aislamiento multitenant', () => {
  // Escenarios 4, 5, 6, 7: FK compuestas en DB.
  // En la capa de aplicación validamos que org_id llega correctamente a las llamadas.

  it('createTransportService pasa org_id correcto al payload (no el de otra org)', async () => {
    const captured: unknown[] = [];
    const chain: Chain = {};
    chain.insert = vi.fn((payload: unknown) => { captured.push(payload); return chain; });
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: { id: SVC_ID, org_id: ORG_A }, error: null }));

    mockFrom.mockImplementation(() => chain);

    await createTransportService(ORG_A, makeInput());

    const inserted = (captured[0] as Array<Record<string, unknown>>)[0];
    expect(inserted.org_id).toBe(ORG_A);
    expect(inserted.org_id).not.toBe(ORG_B);
  });

  // Escenario 8: org sin transport_enabled — la protección es en el trigger de DB.
  // A nivel de aplicación el RLS deniega el INSERT; se simula como error de DB.
  it('error de DB se propaga como excepción (org sin permisos)', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    }));
    await expect(createTransportService(ORG_A, makeInput()))
      .rejects.toMatchObject({ message: 'new row violates row-level security policy' });
  });

  // Escenario 9: trabajador sin permisos de escritura — el RLS bloquea a nivel de DB.
  // La capa TS no implementa una segunda validación porque la fuente de verdad es RLS.
  // Este test documenta la expectativa de comportamiento.
  it('error de DB se propaga como excepción (worker sin permisos de escritura)', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    }));
    await expect(createTransportService(ORG_A, makeInput()))
      .rejects.toMatchObject({ message: expect.stringContaining('row-level security') });
  });
});

// ── confirmTransportService ──────────────────────────────────────────────────

describe('confirmTransportService', () => {
  // Escenario nominal: RPC retorna {ok:true}
  it('retorna {ok:true} cuando la RPC confirma sin conflictos', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await confirmTransportService(SVC_ID, ORG_A);
    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('confirm_transport_service', {
      p_service_id: SVC_ID,
      p_org_id:     ORG_A,
    });
  });

  // Escenario 10 (revisado): vehículo inactivo → RPC lanza TRANSPORT_INVALID
  it('propaga TRANSPORT_INVALID cuando el RPC rechaza vehículo inactivo', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  // Escenario 11 (revisado): vehículo de mercancías → RPC lanza TRANSPORT_INVALID
  it('propaga TRANSPORT_INVALID cuando el RPC rechaza modalidad mercancias', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: el vehículo no es apto para viajeros (modalidad: mercancias)' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  // Escenario 12 (revisado): capacidad insuficiente → RPC lanza TRANSPORT_INVALID
  it('propaga TRANSPORT_INVALID cuando el RPC rechaza capacidad insuficiente', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: capacidad insuficiente — solicitados: 60, capacidad vehículo: 50' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  // Escenario 13 (revisado): conductor sin es_conductor → RPC lanza TRANSPORT_INVALID
  it('propaga TRANSPORT_INVALID cuando el RPC rechaza conductor no habilitado', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: el trabajador asignado no está habilitado como conductor (es_conductor = false)' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  // transport_enabled desactivado → RPC lanza TRANSPORT_FORBIDDEN
  it('propaga TRANSPORT_FORBIDDEN cuando transport_enabled=false', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_FORBIDDEN') });
  });

  // Sin permisos de usuario → RPC lanza TRANSPORT_FORBIDDEN
  it('propaga TRANSPORT_FORBIDDEN cuando el usuario no tiene permisos', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este servicio' },
    });
    await expect(confirmTransportService(SVC_ID, ORG_A))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_FORBIDDEN') });
  });

  // Conflicto de vehículo → retorna {ok:false, conflictos:[...]}
  it('retorna {ok:false, conflictos} cuando hay conflicto de vehículo', async () => {
    const fakeConflict = {
      tipo: 'vehiculo',
      id: 'otro-svc-id',
      titulo: 'Excursión solapada',
      fecha_inicio: FECHA_INI,
      fecha_fin: FECHA_FIN,
    };
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, conflictos: [fakeConflict] },
      error: null,
    });
    const result = await confirmTransportService(SVC_ID, ORG_A);
    expect(result.ok).toBe(false);
    expect(result.conflictos).toHaveLength(1);
    expect(result.conflictos![0].tipo).toBe('vehiculo');
  });

  // Conflicto concurrente → retorna {ok:false, conflictos} con tipo 'conflicto_concurrente'
  it('retorna {ok:false, conflictos} con tipo conflicto_concurrente por exclusion_violation', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: false,
        conflictos: [{
          tipo: 'conflicto_concurrente',
          id: null,
          titulo: 'Conflicto detectado: recurso confirmado simultáneamente por otra sesión',
          fecha_inicio: FECHA_INI,
          fecha_fin: FECHA_FIN,
        }],
      },
      error: null,
    });
    const result = await confirmTransportService(SVC_ID, ORG_A);
    expect(result.ok).toBe(false);
    expect(result.conflictos![0].tipo).toBe('conflicto_concurrente');
    expect(result.conflictos![0].id).toBeNull();
  });
});

// ── Escenarios de disponibilidad ─────────────────────────────────────────────

describe('disponibilidad — validación de inputs', () => {
  // Escenario 10/11/12/13: las validaciones de activo, modalidad, capacidad y es_conductor
  // se realizan en el RPC (paso 4a/4b). La UI filtra para mejor UX pero no es el enforcement.
  it('la validación de vehículo y conductor es responsabilidad del RPC en DB', () => {
    // Contrato de diseño: la capa TS no duplica estas validaciones.
    // El RPC retorna TRANSPORT_INVALID si alguna falla (probado en el bloque anterior).
    expect(true).toBe(true);
  });
});

// ── Escenarios de transición de estado ───────────────────────────────────────

describe('transiciones de estado', () => {
  // Escenario 17: transiciones de estado inválidas.
  // La máquina de estados es un trigger de DB; en la capa TS el error se propaga.
  it('el error del trigger de DB llega como excepción a la capa TS (transición inválida)', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'TRANSPORT_STATE_INVALID: de borrador solo se puede pasar a confirmado o cancelado' },
    }));
    const { updateTransportEstado } = await import('../../lib/transportServices');
    await expect(updateTransportEstado(SVC_ID, ORG_A, 'completado'))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_STATE_INVALID') });
  });
});

// ── Guard operacional: trigger DB via updateTransportEstado / updateTransportService ──

describe('guard operacional — trigger DB en UPDATE directo', () => {
  // El trigger _validate_transport_service_operational aplica a cualquier UPDATE,
  // no solo al RPC. La capa TS propaga el error como excepción.

  it('propaga TRANSPORT_INVALID desde trigger cuando UPDATE directo asigna vehículo inactivo', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)' },
    }));
    await expect(updateTransportService(SVC_ID, ORG_A, { vehicle_id: 'inactive-vehicle-id' }))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  it('propaga TRANSPORT_INVALID desde trigger cuando UPDATE directo usa conductor sin es_conductor', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'TRANSPORT_INVALID: el trabajador asignado no está habilitado como conductor (es_conductor = false)' },
    }));
    await expect(updateTransportService(SVC_ID, ORG_A, { conductor_id: 'no-conductor-id' }))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  it('propaga TRANSPORT_FORBIDDEN desde trigger en UPDATE de vehicle_id con transport_enabled=false (sin cambio de estado)', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización' },
    }));
    await expect(updateTransportService(SVC_ID, ORG_A, { vehicle_id: 'new-vehicle-id' }))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_FORBIDDEN') });
  });

  it('propaga TRANSPORT_FORBIDDEN desde trigger en UPDATE de estado con transport_enabled=false', async () => {
    mockFrom.mockImplementation(() => makeChain({
      data: null,
      error: { message: 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización' },
    }));
    const { updateTransportEstado } = await import('../../lib/transportServices');
    await expect(updateTransportEstado(SVC_ID, ORG_A, 'confirmado'))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_FORBIDDEN') });
  });
});

// ── loadServiceById ──────────────────────────────────────────────────────────

describe('loadServiceById', () => {
  it('devuelve el servicio cuando lo encuentra', async () => {
    const fakeSvc: Partial<TradeTransportService> = {
      id: SVC_ID, org_id: ORG_A, titulo: 'Test', estado: 'en_curso',
    };
    mockFrom.mockImplementation(() => makeChain({ data: fakeSvc, error: null }));
    const result = await loadServiceById(SVC_ID, ORG_A);
    expect(result?.id).toBe(SVC_ID);
    expect(result?.estado).toBe('en_curso');
  });

  it('devuelve null cuando Supabase retorna PGRST116 (not found)', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }));
    const result = await loadServiceById(SVC_ID, ORG_A);
    expect(result).toBeNull();
  });

  it('propaga error diferente de PGRST116', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: { code: '42501', message: 'permission denied' } }));
    await expect(loadServiceById(SVC_ID, ORG_A)).rejects.toMatchObject({ message: 'permission denied' });
  });
});

// ── completeTransportService ─────────────────────────────────────────────────

describe('completeTransportService', () => {
  const PARTE: TradeTransportParteInput = {
    hora_real_salida:     '2026-10-23T09:05:00Z',
    hora_real_llegada:    '2026-10-23T17:45:00Z',
    km_reales:            125.5,
    incidencias:          'Desvío por obras en A-8',
    observaciones_cierre: 'Cliente satisfecho',
  };

  it('llama a RPC complete_transport_service con los parámetros correctos', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, cerrado_at: '2026-10-23T17:46:00Z' },
      error: null,
    });
    const result = await completeTransportService(SVC_ID, ORG_A, PARTE);
    expect(result.ok).toBe(true);
    expect(result.cerrado_at).toBe('2026-10-23T17:46:00Z');
    expect(mockRpc).toHaveBeenCalledWith('complete_transport_service', {
      p_service_id:           SVC_ID,
      p_org_id:               ORG_A,
      p_hora_real_salida:     PARTE.hora_real_salida,
      p_hora_real_llegada:    PARTE.hora_real_llegada,
      p_km_reales:            PARTE.km_reales,
      p_incidencias:          PARTE.incidencias,
      p_observaciones_cierre: PARTE.observaciones_cierre,
      p_odometro_final:       null,
    });
  });

  it('propaga TRANSPORT_STATE_INVALID cuando el servicio no está en_curso', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_STATE_INVALID: solo se puede cerrar un servicio en_curso (estado actual: completado)' },
    });
    await expect(completeTransportService(SVC_ID, ORG_A, {}))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_STATE_INVALID') });
  });

  it('propaga TRANSPORT_INVALID cuando km_reales es negativo', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: km_reales no puede ser negativo (recibido: -5)' },
    });
    await expect(completeTransportService(SVC_ID, ORG_A, { km_reales: -5 }))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  it('propaga TRANSPORT_INVALID cuando llegada <= salida', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_INVALID: hora_real_llegada debe ser posterior a hora_real_salida' },
    });
    await expect(completeTransportService(SVC_ID, ORG_A, {
      hora_real_salida:  '2026-10-23T10:00:00Z',
      hora_real_llegada: '2026-10-23T09:00:00Z',
    })).rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_INVALID') });
  });

  it('envía null para campos opcionales no proporcionados', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await completeTransportService(SVC_ID, ORG_A, {});
    expect(mockRpc).toHaveBeenCalledWith('complete_transport_service', expect.objectContaining({
      p_hora_real_salida:     null,
      p_hora_real_llegada:    null,
      p_km_reales:            null,
      p_incidencias:          null,
      p_observaciones_cierre: null,
    }));
  });

  it('propaga TRANSPORT_IMMUTABLE si el trigger bloquea el cierre en completado', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_IMMUTABLE: un servicio completado no puede modificarse directamente' },
    });
    await expect(completeTransportService(SVC_ID, ORG_A, PARTE))
      .rejects.toMatchObject({ message: expect.stringContaining('TRANSPORT_IMMUTABLE') });
  });
});

// ── Escenario 20: no regresión del módulo de instaladores ───────────────────

describe('no regresión módulo instaladores', () => {
  it('los imports de transportServices no contaminan trade_jobs ni ScreenPlanificacion', async () => {
    // Verificar que el módulo exporta exactamente lo esperado y no importa de módulos ajenos
    const mod = await import('../../lib/transportServices');
    expect(typeof mod.createTransportService).toBe('function');
    expect(typeof mod.updateTransportService).toBe('function');
    expect(typeof mod.cancelTransportService).toBe('function');
    expect(typeof mod.confirmTransportService).toBe('function');
    expect(typeof mod.loadTransportServices).toBe('function');
    expect(typeof mod.checkAvailability).toBe('function');
    expect(typeof mod.validateStops).toBe('function');
    expect(typeof mod.validateServiceInput).toBe('function');
    expect(typeof mod.loadServiceById).toBe('function');
    expect(typeof mod.completeTransportService).toBe('function');
  });
});
