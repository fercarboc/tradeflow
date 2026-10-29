import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateQuoteInput,
  canTransition,
  isTerminalEstado,
  isQuoteEditable,
  isQuoteSendable,
  isQuoteApprovable,
  isQuoteRejectable,
  getQuoteEstadoInfo,
  QUOTE_VALID_TRANSITIONS,
  QUOTE_ESTADOS,
  TradeTransportQuote,
  TradeTransportQuoteInput,
  QuoteEstado,
  loadTransportQuotes,
  createTransportQuote,
  sendTransportQuote,
  rejectTransportQuote,
  approveTransportQuote,
} from '../../lib/transportQuotes';

// ── Mock supabase ─────────────────────────────────────────────────────────────

const mockSelect  = vi.fn();
const mockEq      = vi.fn();
const mockOrder   = vi.fn();
const mockInsert  = vi.fn();
const mockUpdate  = vi.fn();
const mockSingle  = vi.fn();
const mockRpc     = vi.fn();

vi.mock('../../lib/supabase', () => {
  const chain = {
    select:  (..._a: unknown[]) => { mockSelect(..._a);  return chain; },
    eq:      (..._a: unknown[]) => { mockEq(..._a);      return chain; },
    order:   (..._a: unknown[]) => mockOrder(..._a),    // terminal → devuelve promesa
    insert:  (..._a: unknown[]) => { mockInsert(..._a);  return chain; },
    update:  (..._a: unknown[]) => { mockUpdate(..._a);  return chain; },
    single:  (..._a: unknown[]) => mockSingle(..._a),
  };
  return {
    supabase: {
      from: (_t: string) => chain,
      rpc:  (..._a: unknown[]) => mockRpc(..._a),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<TradeTransportQuote> = {}): TradeTransportQuote {
  return {
    id: 'q-001',
    org_id: 'org-001',
    numero_presupuesto: 'TX-2026-0001',
    titulo: 'Excursión Sierra Nevada',
    tipo_servicio: 'excursion',
    estado: 'borrador',
    itinerario: [],
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<TradeTransportQuoteInput> = {}): TradeTransportQuoteInput {
  return {
    titulo: 'Excursión Sierra Nevada',
    tipo_servicio: 'excursion',
    estado: 'borrador',
    itinerario: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── TQ-1: validateQuoteInput ──────────────────────────────────────────────────

describe('TQ-1: validateQuoteInput', () => {
  it('input válido devuelve array vacío', () => {
    expect(validateQuoteInput(makeInput())).toHaveLength(0);
  });

  it('título vacío da error', () => {
    const errs = validateQuoteInput(makeInput({ titulo: '' }));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/título/i);
  });

  it('título solo espacios da error', () => {
    const errs = validateQuoteInput(makeInput({ titulo: '   ' }));
    expect(errs).toHaveLength(1);
  });

  it('tipo_servicio ausente da error', () => {
    const errs = validateQuoteInput({ titulo: 'Test' });
    expect(errs.some(e => /tipo de servicio/i.test(e))).toBe(true);
  });

  it('num_viajeros = 0 da error', () => {
    const errs = validateQuoteInput(makeInput({ num_viajeros: 0 }));
    expect(errs.some(e => /viajeros/i.test(e))).toBe(true);
  });

  it('num_viajeros decimal da error', () => {
    const errs = validateQuoteInput(makeInput({ num_viajeros: 1.5 }));
    expect(errs.some(e => /viajeros/i.test(e))).toBe(true);
  });

  it('num_viajeros positivo entero es válido', () => {
    expect(validateQuoteInput(makeInput({ num_viajeros: 45 }))).toHaveLength(0);
  });

  it('precio_final negativo da error', () => {
    const errs = validateQuoteInput(makeInput({ precio_final: -1 }));
    expect(errs.some(e => /precio/i.test(e))).toBe(true);
  });

  it('precio_final 0 es válido', () => {
    expect(validateQuoteInput(makeInput({ precio_final: 0 }))).toHaveLength(0);
  });

  it('fecha_fin anterior a fecha_servicio da error', () => {
    const errs = validateQuoteInput(makeInput({
      fecha_servicio:     '2026-12-10',
      fecha_fin_servicio: '2026-12-05',
    }));
    expect(errs.some(e => /fecha de fin/i.test(e))).toBe(true);
  });

  it('fecha_fin igual a fecha_servicio es válido', () => {
    expect(validateQuoteInput(makeInput({
      fecha_servicio:     '2026-12-10',
      fecha_fin_servicio: '2026-12-10',
    }))).toHaveLength(0);
  });

  it('margen_pct = 100 da error', () => {
    const errs = validateQuoteInput(makeInput({ margen_pct: 100 }));
    expect(errs.some(e => /margen/i.test(e))).toBe(true);
  });

  it('margen_pct = -100 da error (límite exclusivo)', () => {
    const errs = validateQuoteInput(makeInput({ margen_pct: -100 }));
    expect(errs.some(e => /margen/i.test(e))).toBe(true);
  });

  it('margen_pct = 99.99 es válido', () => {
    expect(validateQuoteInput(makeInput({ margen_pct: 99.99 }))).toHaveLength(0);
  });
});

// ── TQ-2: canTransition ───────────────────────────────────────────────────────

describe('TQ-2: canTransition — máquina de estados', () => {
  it('borrador → enviado OK', () => expect(canTransition('borrador', 'enviado')).toBe(true));
  it('borrador → expirado OK', () => expect(canTransition('borrador', 'expirado')).toBe(true));
  it('borrador → aprobado NOK', () => expect(canTransition('borrador', 'aprobado')).toBe(false));
  it('borrador → rechazado NOK', () => expect(canTransition('borrador', 'rechazado')).toBe(false));
  it('enviado → aprobado OK', () => expect(canTransition('enviado', 'aprobado')).toBe(true));
  it('enviado → rechazado OK', () => expect(canTransition('enviado', 'rechazado')).toBe(true));
  it('enviado → expirado OK', () => expect(canTransition('enviado', 'expirado')).toBe(true));
  it('enviado → convertido NOK', () => expect(canTransition('enviado', 'convertido')).toBe(false));
  it('aprobado → convertido OK', () => expect(canTransition('aprobado', 'convertido')).toBe(true));
  it('aprobado → borrador NOK', () => expect(canTransition('aprobado', 'borrador')).toBe(false));
  it('rechazado es terminal (no transiciones)', () => {
    expect(QUOTE_VALID_TRANSITIONS['rechazado']).toHaveLength(0);
  });
  it('expirado es terminal', () => {
    expect(QUOTE_VALID_TRANSITIONS['expirado']).toHaveLength(0);
  });
  it('convertido es terminal', () => {
    expect(QUOTE_VALID_TRANSITIONS['convertido']).toHaveLength(0);
  });
});

// ── TQ-3: isTerminalEstado ────────────────────────────────────────────────────

describe('TQ-3: isTerminalEstado', () => {
  it('rechazado es terminal', () => expect(isTerminalEstado('rechazado')).toBe(true));
  it('expirado es terminal', () => expect(isTerminalEstado('expirado')).toBe(true));
  it('convertido es terminal', () => expect(isTerminalEstado('convertido')).toBe(true));
  it('borrador no es terminal', () => expect(isTerminalEstado('borrador')).toBe(false));
  it('enviado no es terminal', () => expect(isTerminalEstado('enviado')).toBe(false));
  it('aprobado no es terminal', () => expect(isTerminalEstado('aprobado')).toBe(false));
});

// ── TQ-4: Helpers de estado ───────────────────────────────────────────────────

describe('TQ-4: helpers de estado por presupuesto', () => {
  it('isQuoteEditable true solo en borrador', () => {
    expect(isQuoteEditable(makeQuote({ estado: 'borrador' }))).toBe(true);
    expect(isQuoteEditable(makeQuote({ estado: 'enviado' }))).toBe(false);
    expect(isQuoteEditable(makeQuote({ estado: 'aprobado' }))).toBe(false);
  });

  it('isQuoteSendable true solo en borrador', () => {
    expect(isQuoteSendable(makeQuote({ estado: 'borrador' }))).toBe(true);
    expect(isQuoteSendable(makeQuote({ estado: 'enviado' }))).toBe(false);
  });

  it('isQuoteApprovable true solo en enviado', () => {
    expect(isQuoteApprovable(makeQuote({ estado: 'enviado' }))).toBe(true);
    expect(isQuoteApprovable(makeQuote({ estado: 'borrador' }))).toBe(false);
    expect(isQuoteApprovable(makeQuote({ estado: 'aprobado' }))).toBe(false);
  });

  it('isQuoteRejectable true solo en enviado', () => {
    expect(isQuoteRejectable(makeQuote({ estado: 'enviado' }))).toBe(true);
    expect(isQuoteRejectable(makeQuote({ estado: 'rechazado' }))).toBe(false);
  });
});

// ── TQ-5: Catálogo de estados ─────────────────────────────────────────────────

describe('TQ-5: QUOTE_ESTADOS catálogo', () => {
  it('tiene exactamente 6 estados', () => {
    expect(QUOTE_ESTADOS).toHaveLength(6);
  });

  it('todos los estados tienen value, label y color', () => {
    for (const e of QUOTE_ESTADOS) {
      expect(e.value).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(e.color).toBeTruthy();
    }
  });

  it('getQuoteEstadoInfo devuelve el estado correcto', () => {
    expect(getQuoteEstadoInfo('aprobado').label).toBe('Aprobado');
    expect(getQuoteEstadoInfo('rechazado').label).toBe('Rechazado');
  });

  it('getQuoteEstadoInfo con estado desconocido devuelve fallback', () => {
    const info = getQuoteEstadoInfo('__unknown__' as QuoteEstado);
    expect(info).toBeDefined();
  });
});

// ── TQ-6: loadTransportQuotes — org isolation ─────────────────────────────────

describe('TQ-6: loadTransportQuotes — aislamiento por org', () => {
  it('filtra por org_id y ordena por created_at desc', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    await loadTransportQuotes('org-abc');
    expect(mockEq).toHaveBeenCalledWith('org_id', 'org-abc');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('devuelve array vacío si no hay resultados', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
    const result = await loadTransportQuotes('org-xyz');
    expect(result).toEqual([]);
  });

  it('lanza si hay error de Supabase', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    await expect(loadTransportQuotes('org-abc')).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── TQ-7: createTransportQuote ────────────────────────────────────────────────

describe('TQ-7: createTransportQuote', () => {
  it('llama a insert con org_id y estado=borrador', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeQuote(), error: null });
    await createTransportQuote('org-001', makeInput());
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const args = mockInsert.mock.calls[0][0];
    expect(args[0]).toMatchObject({ org_id: 'org-001', estado: 'borrador' });
  });

  it('lanza si validación falla (título vacío)', async () => {
    await expect(
      createTransportQuote('org-001', makeInput({ titulo: '' }))
    ).rejects.toThrow(/título/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('itinerario por defecto es [] si no se pasa', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeQuote(), error: null });
    const input = makeInput();
    delete (input as Partial<TradeTransportQuoteInput>).itinerario;
    await createTransportQuote('org-001', input);
    const args = mockInsert.mock.calls[0][0];
    expect(args[0].itinerario).toEqual([]);
  });
});

// ── TQ-8: sendTransportQuote — guardia de estado ──────────────────────────────

describe('TQ-8: sendTransportQuote', () => {
  it('hace update con eq estado=borrador como guardia', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeQuote({ estado: 'enviado' }), error: null });
    await sendTransportQuote('q-001', 'org-001');
    expect(mockUpdate).toHaveBeenCalledWith({ estado: 'enviado' });
    expect(mockEq).toHaveBeenCalledWith('estado', 'borrador');
  });

  it('lanza si no devuelve filas (guardia falló)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(sendTransportQuote('q-001', 'org-001')).rejects.toThrow(/borrador/i);
  });

  it('lanza si Supabase retorna error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB fail' } });
    await expect(sendTransportQuote('q-001', 'org-001')).rejects.toMatchObject({ message: 'DB fail' });
  });
});

// ── TQ-9: rejectTransportQuote — guardia de estado ───────────────────────────

describe('TQ-9: rejectTransportQuote', () => {
  it('hace update con eq estado=enviado como guardia', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeQuote({ estado: 'rechazado' }), error: null });
    await rejectTransportQuote('q-001', 'org-001');
    expect(mockUpdate).toHaveBeenCalledWith({ estado: 'rechazado' });
    expect(mockEq).toHaveBeenCalledWith('estado', 'enviado');
  });

  it('lanza si no devuelve filas (no estaba en enviado)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(rejectTransportQuote('q-001', 'org-001')).rejects.toThrow(/enviado/i);
  });
});

// ── TQ-10: approveTransportQuote — llama RPC ─────────────────────────────────

describe('TQ-10: approveTransportQuote vía RPC', () => {
  it('llama rpc("approve_transport_quote", { p_quote_id })', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'svc-uuid-001', error: null });
    const result = await approveTransportQuote('q-001');
    expect(mockRpc).toHaveBeenCalledWith('approve_transport_quote', { p_quote_id: 'q-001' });
    expect(result).toBe('svc-uuid-001');
  });

  it('lanza si la RPC devuelve error (ej. estado ≠ enviado)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Solo se puede aprobar un presupuesto en estado "enviado"' },
    });
    await expect(approveTransportQuote('q-borrador')).rejects.toMatchObject({
      message: expect.stringContaining('enviado'),
    });
  });

  it('idempotencia: segunda llamada lanza porque estado ya es aprobado', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 'svc-001', error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Solo se puede aprobar un presupuesto en estado "enviado". Estado actual: aprobado' },
      });
    await approveTransportQuote('q-001');
    await expect(approveTransportQuote('q-001')).rejects.toMatchObject({
      message: expect.stringContaining('aprobado'),
    });
  });
});

// ── TQ-11: Presupuesto multidía — validación de fechas ───────────────────────

describe('TQ-11: presupuesto multidía (viaje multidia B2B)', () => {
  it('fecha_fin posterior a inicio es válida', () => {
    const errs = validateQuoteInput(makeInput({
      tipo_servicio:      'viaje_multidia',
      fecha_servicio:     '2026-12-01',
      fecha_fin_servicio: '2026-12-05',
      num_viajeros:       30,
    }));
    expect(errs).toHaveLength(0);
  });

  it('client_id es opcional (B2B agencia)', () => {
    const errs = validateQuoteInput(makeInput({ client_id: 'client-007' }));
    expect(errs).toHaveLength(0);
  });

  it('sin client_id también es válido', () => {
    const errs = validateQuoteInput(makeInput({ client_id: undefined }));
    expect(errs).toHaveLength(0);
  });
});

// ── TQ-12: Varios errores a la vez ────────────────────────────────────────────

describe('TQ-12: múltiples errores simultáneos', () => {
  it('recoge todos los errores en un array', () => {
    const errs = validateQuoteInput({
      titulo: '',
      // tipo_servicio ausente → error
      num_viajeros: 0,
      precio_final: -50,
    });
    expect(errs.length).toBeGreaterThanOrEqual(3);
  });
});
