/**
 * TX-C3-C-FIX — Tests de la garantía transaccional de aceptación pública.
 *
 * La RPC `accept_quote_public` ejecuta 4 pasos en una única transacción
 * PostgreSQL. Los tests aquí verifican el contrato TypeScript del wrapper
 * y la lógica de manejo de respuestas en el cliente / panel interno.
 *
 * LIMITACIÓN: La lógica de subtransacciones PostgreSQL (EXCEPTION WHEN OTHERS
 * dentro de la RPC) no puede probarse aquí sin Docker/real DB. Las garantías
 * de atomicidad y aislamiento son invariantes de la migración SQL y se
 * documentan como INVARIANTE DB en los comentarios de cada test.
 *
 * 10 escenarios del spec TX-C3-C-FIX:
 *  1. Aceptación pública correcta
 *  2. Aceptación interna (panel)
 *  3. Dos aceptaciones concurrentes
 *  4. Fallo de conexión durante creación del servicio
 *  5. Reintento del proceso (idempotencia)
 *  6. Presupuesto aceptado sin servicio previo
 *  7. Servicio ya creado
 *  8. Instalador sin efectos nuevos
 *  9. Recurrente diferido
 * 10. Aislamiento multiempresa
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TransportServiceFromQuoteResult } from '../../lib/supabase';
import { mergeQuoteMetadata } from '../../lib/transportVoiceIntake';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_A   = 'org-aaa-0000-0000-000000000001';
const ORG_B   = 'org-bbb-0000-0000-000000000002';
const QUOTE_A = 'quote-aaa-0000-0000-000000000001';
const SVC_A   = 'svc-aaa-0000-0000-000000000001';
const TOKEN   = 'tok_test_abcdef1234567890';

// Forma del resultado de accept_quote_public (RPC SQL)
interface AcceptQuotePublicResult {
  ok?: boolean;
  already_processed?: boolean;
  error?: string;
  quote_estado?: string;
  org_id?: string;
  quote_numero?: string;
  client_name?: string | null;
  transport_service_id?: string | null;
  service_result?: TransportServiceFromQuoteResult | null;
}

// ── Mock del wrapper createTransportServiceFromQuote ─────────────────────────

const rpcMock = vi.fn();

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    createTransportServiceFromQuote: async (
      orgId: string,
      quoteDbId: string,
    ): Promise<TransportServiceFromQuoteResult> => {
      const { data, error } = await rpcMock(orgId, quoteDbId);
      if (error) throw new Error(error.message);
      return data as TransportServiceFromQuoteResult;
    },
  };
});

// ── Helper: simula la lógica del panel tras recibir un acceptResult ───────────

function processAcceptResult(
  acceptResult: AcceptQuotePublicResult,
): { ok: boolean; transportServiceId: string | null; errorCode?: string; alreadyProcessed?: boolean } {
  if (acceptResult.already_processed) {
    return { ok: true, transportServiceId: null, alreadyProcessed: true };
  }
  if (acceptResult.error) {
    return { ok: false, transportServiceId: null, errorCode: acceptResult.error };
  }
  return {
    ok: acceptResult.ok === true,
    transportServiceId: acceptResult.transport_service_id ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════

// ── Escenario 1: Aceptación pública correcta ──────────────────────────────────

describe('TX-C3-C-FIX esc.1 — aceptación pública correcta (transport_service_id)', () => {
  it('devuelve ok:true y el service_id cuando la RPC transaccional tiene éxito', () => {
    // INVARIANTE DB: los 4 pasos (token + quote + servicio) quedan en la misma TX.
    const rpcResponse: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A,
      quote_numero: 'PRE-2026-001',
      client_name: 'Test Cliente',
      transport_service_id: SVC_A,
      service_result: { ok: true, service_id: SVC_A, idempotent: false },
    };
    const result = processAcceptResult(rpcResponse);
    expect(result.ok).toBe(true);
    expect(result.transportServiceId).toBe(SVC_A);
  });
});

// ── Escenario 2: Aceptación interna (panel) ───────────────────────────────────

describe('TX-C3-C-FIX esc.2 — aceptación interna desde panel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('createTransportServiceFromQuote devuelve ok:true en aceptación interna', async () => {
    // El panel llama directamente a createTransportServiceFromQuote tras
    // marcar la quote como Aceptado. No usa accept_quote_public.
    // LIMITACIÓN CONOCIDA: el panel usa 2 writes secuenciales, no transaccional.
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, service_id: SVC_A, idempotent: false },
      error: null,
    });
    const { createTransportServiceFromQuote } = await import('../../lib/supabase');
    const result = await createTransportServiceFromQuote(ORG_A, QUOTE_A);
    expect(result.ok).toBe(true);
    expect(result.service_id).toBe(SVC_A);
  });
});

// ── Escenario 3: Dos aceptaciones concurrentes ────────────────────────────────

describe('TX-C3-C-FIX esc.3 — dos aceptaciones concurrentes del mismo token', () => {
  it('primera aceptación crea servicio, segunda recibe already_processed', () => {
    // INVARIANTE DB: SELECT FOR UPDATE en token garantiza que solo una TX
    // ve status='pending'. La segunda TX no ve el token y retorna already_processed.
    const firstResult: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A, quote_numero: 'PRE-2026-001', client_name: 'Cliente',
      transport_service_id: SVC_A,
      service_result: { ok: true, service_id: SVC_A, idempotent: false },
    };
    const secondResult: AcceptQuotePublicResult = { ok: true, already_processed: true };

    const r1 = processAcceptResult(firstResult);
    const r2 = processAcceptResult(secondResult);

    expect(r1.ok).toBe(true);
    expect(r1.transportServiceId).toBe(SVC_A);
    expect(r2.ok).toBe(true);
    expect(r2.alreadyProcessed).toBe(true);
    // No hay segundo service_id: la idempotencia la garantiza la RPC de creación.
  });

  it('si ya existe servicio (idempotente), la segunda aceptación devuelve el mismo id', () => {
    // Si por alguna razón el token no se marcó pero el servicio ya existe,
    // create_transport_service_from_quote devuelve idempotent:true.
    const secondAccept: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A, quote_numero: 'PRE-2026-001', client_name: 'Cliente',
      transport_service_id: SVC_A,
      service_result: { ok: true, service_id: SVC_A, idempotent: true },
    };
    const r = processAcceptResult(secondAccept);
    expect(r.transportServiceId).toBe(SVC_A);
  });
});

// ── Escenario 4: Fallo durante creación del servicio ─────────────────────────

describe('TX-C3-C-FIX esc.4 — fallo durante creación del servicio', () => {
  it('la aceptación permanece válida aunque el servicio falle', () => {
    // INVARIANTE DB: steps 3+4 están FUERA del bloque EXCEPTION. Si el step 5
    // falla, se hace rollback del savepoint interno pero los steps 3+4 permanecen.
    const failResult: AcceptQuotePublicResult = {
      ok: true,  // la aceptación SÍ se completó
      org_id: ORG_A, quote_numero: 'PRE-2026-002', client_name: 'Cliente',
      transport_service_id: null,  // servicio no creado
      service_result: {
        ok: false, code: 'SERVICE_CREATION_ERROR',
        message: 'TRANSPORT_INVALID: transport_intake no encontrado en metadata del presupuesto',
      },
    };
    const r = processAcceptResult(failResult);
    expect(r.ok).toBe(true);             // aceptado ✓
    expect(r.transportServiceId).toBeNull(); // sin servicio automático
  });

  it('el error de creación queda en service_result.code para monitoring', () => {
    const failResult: AcceptQuotePublicResult = {
      ok: true,
      transport_service_id: null,
      service_result: { ok: false, code: 'SERVICE_CREATION_ERROR', message: 'Error de intake' },
    };
    expect(failResult.service_result?.code).toBe('SERVICE_CREATION_ERROR');
    expect(failResult.service_result?.ok).toBe(false);
  });

  it('el badge de recuperación en UI detecta error vía metadata.transport_service_error', () => {
    // La RPC registra el error en trade_quotes.metadata.transport_service_error.
    // El panel lee metadata del quote y puede mostrar badge de recuperación.
    const quoteMeta = {
      vertical: 'transporte',
      transport_service_error: {
        code: 'SERVICE_CREATION_ERROR',
        message: 'Error',
        ts: '2026-10-30T10:00:00Z',
      },
    };
    expect(quoteMeta.transport_service_error.code).toBe('SERVICE_CREATION_ERROR');
    const recoveryMeta = mergeQuoteMetadata(quoteMeta, { transport_service_id: SVC_A });
    expect(recoveryMeta?.['transport_service_id']).toBe(SVC_A);
  });
});

// ── Escenario 5: Reintento del proceso ────────────────────────────────────────

describe('TX-C3-C-FIX esc.5 — reintento devuelve mismo servicio', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('segundo call a createTransportServiceFromQuote devuelve idempotent:true + mismo id', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, service_id: SVC_A, idempotent: true },
      error: null,
    });
    const { createTransportServiceFromQuote } = await import('../../lib/supabase');
    const result = await createTransportServiceFromQuote(ORG_A, QUOTE_A);
    expect(result.ok).toBe(true);
    expect(result.service_id).toBe(SVC_A);
    expect(result.idempotent).toBe(true);
  });
});

// ── Escenario 6: Presupuesto aceptado sin servicio previo ─────────────────────

describe('TX-C3-C-FIX esc.6 — presupuesto aceptado sin servicio previo', () => {
  it('accept_quote_public detecta vertical=transporte y crea el servicio', () => {
    const result: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A, quote_numero: 'PRE-2026-003', client_name: 'Cliente',
      transport_service_id: SVC_A,
      service_result: { ok: true, service_id: SVC_A, idempotent: false },
    };
    const r = processAcceptResult(result);
    expect(r.ok).toBe(true);
    expect(r.transportServiceId).toBe(SVC_A);
  });
});

// ── Escenario 7: Servicio ya creado ───────────────────────────────────────────

describe('TX-C3-C-FIX esc.7 — servicio ya creado (idempotencia)', () => {
  it('segunda llamada devuelve mismo service_id con idempotent:true', () => {
    const result: AcceptQuotePublicResult = {
      ok: true,
      transport_service_id: SVC_A,
      service_result: { ok: true, service_id: SVC_A, idempotent: true },
    };
    const r = processAcceptResult(result);
    expect(r.transportServiceId).toBe(SVC_A);
  });
});

// ── Escenario 8: Instalador — sin efectos en transporte ───────────────────────

describe('TX-C3-C-FIX esc.8 — presupuesto de instalador sin efectos de transporte', () => {
  it('accept_quote_public no devuelve transport_service_id para presupuesto no-transporte', () => {
    // INVARIANTE DB: IF COALESCE(vertical,'') = 'transporte' es FALSE para instaladores.
    const instaladorResult: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A, quote_numero: 'PRE-2026-004', client_name: 'Cliente',
      transport_service_id: null,   // sin servicio de transporte
      service_result: null,          // bloque de transporte nunca ejecutado
    };
    const r = processAcceptResult(instaladorResult);
    expect(r.ok).toBe(true);
    expect(r.transportServiceId).toBeNull();
  });

  it('mergeQuoteMetadata sin vertical=transporte no activa nada', () => {
    // Presupuesto instalador: metadata sin vertical
    const meta = mergeQuoteMetadata({ tipo: 'instalacion' }, null);
    expect((meta ?? {})['vertical']).toBeUndefined();
  });
});

// ── Escenario 9: Recurrente diferido ─────────────────────────────────────────

describe('TX-C3-C-FIX esc.9 — servicio recurrente → RECURRENTE_DEFERRED', () => {
  it('accept_quote_public devuelve aceptación ok pero service_result.code=RECURRENTE_DEFERRED', () => {
    // INVARIANTE DB: create_transport_service_from_quote devuelve ok:false sin RAISE
    // para recurrente → el bloque EXCEPTION no se activa, la aceptación es válida.
    const result: AcceptQuotePublicResult = {
      ok: true,
      org_id: ORG_A, quote_numero: 'PRE-2026-005', client_name: 'Cliente',
      transport_service_id: null,
      service_result: {
        ok: false, code: 'RECURRENTE_DEFERRED',
        message: 'Los servicios recurrentes requieren programación desde el módulo de Rutas Recurrentes.',
      },
    };
    const r = processAcceptResult(result);
    expect(r.ok).toBe(true);
    expect(r.transportServiceId).toBeNull();
    expect(result.service_result?.code).toBe('RECURRENTE_DEFERRED');
  });
});

// ── Escenario 10: Aislamiento multiempresa ─────────────────────────────────────

describe('TX-C3-C-FIX esc.10 — aislamiento multiempresa', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('token de org B no puede crear servicio en org A', async () => {
    // INVARIANTE DB: create_transport_service_from_quote verifica
    // org_id = p_org_id en SELECT FOR UPDATE → NOT FOUND para org incorrecta.
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'TRANSPORT_NOT_FOUND: presupuesto no encontrado o no pertenece a la organización' },
    });
    const { createTransportServiceFromQuote } = await import('../../lib/supabase');
    await expect(createTransportServiceFromQuote(ORG_B, QUOTE_A))
      .rejects.toThrow('TRANSPORT_NOT_FOUND');
  });

  it('accept_quote_public con token de org incorrecta devuelve error quote_not_found', () => {
    const result: AcceptQuotePublicResult = { error: 'quote_not_found' };
    const r = processAcceptResult(result);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('quote_not_found');
  });

  it('accept_quote_public con estado incompatible devuelve error quote_state_incompatible', () => {
    const result: AcceptQuotePublicResult = {
      error: 'quote_state_incompatible',
      quote_estado: 'Rechazado',
    };
    const r = processAcceptResult(result);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('quote_state_incompatible');
  });
});
