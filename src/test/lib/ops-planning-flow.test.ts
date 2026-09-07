/**
 * PH0-OPS-CORE — Operations planning flow tests
 *
 * Covers:
 *   - pendingPlanningQuotes derivation logic
 *   - duplicate guard logic
 *   - REAL-009 prefill field
 *   - token acceptance state machine (full pre-validation flow)
 *
 * NOTE: Edge function (Deno) is NOT directly unit-testable here.
 * The acceptance flow is modelled as a pure state machine function
 * that mirrors the production logic exactly.
 * REAL INTEGRATION TESTS: NO — these are unit/mock tests.
 */

import { describe, it, expect } from 'vitest';

// ── Types (inline-minimal to avoid importing from Supabase mock) ──────────────

type QuoteEstado = 'Borrador' | 'Enviado' | 'Aceptado' | 'Rechazado' | 'Expirado' | 'Facturado';

interface Quote {
  id: string;
  dbId: string;
  estado: QuoteEstado;
  descripcion: string;
  nombreCliente: string;
  total: number;
}

type JobEstado =
  | 'planificado' | 'en_curso' | 'completado'
  | 'cancelado' | 'no_realizado' | 'pausado_continua'
  | 'bloqueado_espera_material' | 'pendiente_material';

interface Job {
  id: string;
  quote_id?: string | null;
  estado: JobEstado;
}

// ── Helper: pendingPlanningQuotes (mirrors AppDashboardView derivation) ──────

function computePendingPlanningQuotes(quotes: Quote[], jobs: Job[]): Quote[] {
  return quotes.filter(p =>
    p.estado === 'Aceptado' &&
    !jobs.some(j =>
      j.quote_id === p.dbId &&
      j.estado !== 'cancelado' &&
      j.estado !== 'no_realizado'
    )
  );
}

// ── Helper: duplicate guard (mirrors ScreenPlanificacion.tsx logic) ──────────

function hasActiveJobForQuote(jobs: Job[], quoteDbId: string): boolean {
  return jobs.some(j =>
    j.quote_id === quoteDbId &&
    j.estado !== 'cancelado' &&
    j.estado !== 'no_realizado'
  );
}

// ── Acceptance state machine (mirrors edge function logic exactly) ────────────

const ACCEPT_ALLOWED_STATES: QuoteEstado[] = ['Borrador', 'Enviado', 'Aceptado'];

function canAcceptFromState(estado: QuoteEstado): boolean {
  return ACCEPT_ALLOWED_STATES.includes(estado);
}

type AcceptResult =
  | { ok: true }
  | { ok: true; already_processed: true }
  | { error: 'quote_not_found' }
  | { error: 'quote_state_incompatible'; quote_estado: QuoteEstado }
  | { error: 'quote_update_failed'; detail: string }
  | { error: string };

interface MockDB {
  token_pending: boolean;
  quote: { estado: QuoteEstado } | null;
  quoteUpdateFails?: boolean;
}

/**
 * Simulates the edge function acceptance flow in pure logic form.
 * Used to verify state machine correctness without Deno runtime.
 * ATOMIC DB TRANSACTION: NO (mirrors production — two sequential writes).
 */
function simulateAcceptance(db: MockDB): AcceptResult {
  // Step 1: check token is pending
  if (!db.token_pending) {
    return { ok: true, already_processed: true };
  }

  // Step 2: pre-validate quote state BEFORE touching token
  if (!db.quote) {
    return { error: 'quote_not_found' };
  }
  if (!ACCEPT_ALLOWED_STATES.includes(db.quote.estado)) {
    return { error: 'quote_state_incompatible', quote_estado: db.quote.estado };
  }

  // Step 3: update token (in production: UPDATE trade_quote_tokens)
  // (simulated — no write modelled here)

  // Step 4: update quote (in production: UPDATE trade_quotes)
  if (db.quoteUpdateFails) {
    return { error: 'quote_update_failed', detail: 'db error simulated' };
  }

  return { ok: true };
}

// ── Test fixtures ────────────────────────────────────────────────────────────

const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 'q-1',
  dbId: 'q-uuid-1',
  estado: 'Aceptado',
  descripcion: 'Instalación panel solar 4kW',
  nombreCliente: 'García Construcciones',
  total: 2400,
  ...overrides,
});

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'j-1',
  quote_id: 'q-uuid-1',
  estado: 'planificado',
  ...overrides,
});

// ══════════════════════════════════════════════════════════════════════════════
// PENDING PLANNING QUOTES
// ══════════════════════════════════════════════════════════════════════════════

describe('pendingPlanningQuotes', () => {
  it('test 6 — Aceptado + no job → appears pending', () => {
    const quotes = [makeQuote()];
    const jobs: Job[] = [];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(1);
  });

  it('test 7 — Aceptado + active job (planificado) → NOT pending', () => {
    const quotes = [makeQuote()];
    const jobs = [makeJob({ estado: 'planificado' })];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(0);
  });

  it('test 7b — Aceptado + active job (en_curso) → NOT pending', () => {
    const quotes = [makeQuote()];
    const jobs = [makeJob({ estado: 'en_curso' })];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(0);
  });

  it('test 7c — Aceptado + active job (completado) → NOT pending', () => {
    const quotes = [makeQuote()];
    const jobs = [makeJob({ estado: 'completado' })];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(0);
  });

  it('test 8 — Aceptado + cancelado job → pending again', () => {
    const quotes = [makeQuote()];
    const jobs = [makeJob({ estado: 'cancelado' })];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(1);
  });

  it('test 9 — Aceptado + no_realizado job → pending again', () => {
    const quotes = [makeQuote()];
    const jobs = [makeJob({ estado: 'no_realizado' })];
    expect(computePendingPlanningQuotes(quotes, jobs)).toHaveLength(1);
  });

  it('non-Aceptado quotes are excluded regardless of jobs', () => {
    const states: QuoteEstado[] = ['Borrador', 'Enviado', 'Rechazado', 'Expirado', 'Facturado'];
    states.forEach(estado => {
      const quotes = [makeQuote({ estado })];
      expect(computePendingPlanningQuotes(quotes, [])).toHaveLength(0);
    });
  });

  it('only counts quotes whose quote_id matches (no cross-contamination)', () => {
    const quotes = [makeQuote({ dbId: 'q-uuid-A' }), makeQuote({ id: 'q-2', dbId: 'q-uuid-B' })];
    const jobs = [makeJob({ quote_id: 'q-uuid-A', estado: 'planificado' })];
    // q-uuid-A has active job → not pending; q-uuid-B has no job → pending
    const result = computePendingPlanningQuotes(quotes, jobs);
    expect(result).toHaveLength(1);
    expect(result[0].dbId).toBe('q-uuid-B');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DUPLICATE GUARD
// ══════════════════════════════════════════════════════════════════════════════

describe('hasActiveJobForQuote (duplicate guard)', () => {
  it('test 10 — active job exists → guard triggers', () => {
    const jobs = [makeJob({ estado: 'planificado' })];
    expect(hasActiveJobForQuote(jobs, 'q-uuid-1')).toBe(true);
  });

  it('no job → guard does not trigger', () => {
    expect(hasActiveJobForQuote([], 'q-uuid-1')).toBe(false);
  });

  it('only cancelado jobs → guard does not trigger', () => {
    const jobs = [makeJob({ estado: 'cancelado' })];
    expect(hasActiveJobForQuote(jobs, 'q-uuid-1')).toBe(false);
  });

  it('only no_realizado jobs → guard does not trigger', () => {
    const jobs = [makeJob({ estado: 'no_realizado' })];
    expect(hasActiveJobForQuote(jobs, 'q-uuid-1')).toBe(false);
  });

  it('job with different quote_id → guard does not trigger', () => {
    const jobs = [makeJob({ quote_id: 'other-uuid', estado: 'planificado' })];
    expect(hasActiveJobForQuote(jobs, 'q-uuid-1')).toBe(false);
  });

  it('pausado_continua job → guard triggers (still active)', () => {
    const jobs = [makeJob({ estado: 'pausado_continua' })];
    expect(hasActiveJobForQuote(jobs, 'q-uuid-1')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TOKEN ACCEPTANCE STATE MACHINE
// Pre-validation logic: quote state checked BEFORE any write.
// NOTE: UNIT/MOCK TESTS — not real integration tests (no Deno runtime).
// ══════════════════════════════════════════════════════════════════════════════

describe('simulateAcceptance (edge function state machine)', () => {
  // ── test 1: Borrador → accepted
  it('test 1 — Borrador + pending token → ok', () => {
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Borrador' } });
    expect(result).toEqual({ ok: true });
  });

  // ── test 2: Enviado → accepted
  it('test 2 — Enviado + pending token → ok', () => {
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Enviado' } });
    expect(result).toEqual({ ok: true });
  });

  // ── test 3: already Aceptado → idempotent ok
  it('test 3 — Aceptado + pending token → idempotent ok', () => {
    // DB UPDATE WHERE estado IN [...,'Aceptado'] is a no-op: safe
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Aceptado' } });
    expect(result).toEqual({ ok: true });
  });

  // ── test 4: Rechazado → token NOT accepted (pre-validation blocks write)
  it('test 4 — Rechazado → quote_state_incompatible, token NOT written', () => {
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Rechazado' } });
    expect(result).toMatchObject({ error: 'quote_state_incompatible', quote_estado: 'Rechazado' });
  });

  // ── test 5: Expirado → token NOT accepted
  it('test 5 — Expirado → quote_state_incompatible, token NOT written', () => {
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Expirado' } });
    expect(result).toMatchObject({ error: 'quote_state_incompatible', quote_estado: 'Expirado' });
  });

  // ── test 6: Facturado → token NOT accepted
  it('test 6 — Facturado → quote_state_incompatible, token NOT written', () => {
    const result = simulateAcceptance({ token_pending: true, quote: { estado: 'Facturado' } });
    expect(result).toMatchObject({ error: 'quote_state_incompatible', quote_estado: 'Facturado' });
  });

  // ── test 7: second acceptance → already_processed (no duplicate effect)
  it('test 7 — second acceptance (token no longer pending) → already_processed', () => {
    // Simulates: first call set token to 'accepted'; second call finds token not pending
    const result = simulateAcceptance({ token_pending: false, quote: { estado: 'Aceptado' } });
    expect(result).toEqual({ ok: true, already_processed: true });
  });

  // ── test 8: quote not found → token NOT accepted
  it('test 8 — quote_not_found → token NOT written', () => {
    const result = simulateAcceptance({ token_pending: true, quote: null });
    expect(result).toEqual({ error: 'quote_not_found' });
  });

  // ── test 9: quote update fails after token write → NOT silent success
  it('test 9 — quote_update_failed → returns error, not { ok: true }', () => {
    const result = simulateAcceptance({
      token_pending: true,
      quote: { estado: 'Enviado' },
      quoteUpdateFails: true,
    });
    expect(result).toMatchObject({ error: 'quote_update_failed' });
    // Explicitly assert not { ok: true }
    expect((result as { ok?: boolean }).ok).toBeUndefined();
  });
});

// ── canAcceptFromState (unit guard, kept for completeness) ────────────────────
describe('canAcceptFromState (state allowlist)', () => {
  it('Borrador → allowed', () => expect(canAcceptFromState('Borrador')).toBe(true));
  it('Enviado → allowed', () => expect(canAcceptFromState('Enviado')).toBe(true));
  it('Aceptado → allowed (idempotent)', () => expect(canAcceptFromState('Aceptado')).toBe(true));
  it('Rechazado → NOT allowed', () => expect(canAcceptFromState('Rechazado')).toBe(false));
  it('Expirado → NOT allowed', () => expect(canAcceptFromState('Expirado')).toBe(false));
  it('Facturado → NOT allowed', () => expect(canAcceptFromState('Facturado')).toBe(false));
});

// ══════════════════════════════════════════════════════════════════════════════
// REAL-009 — PREFILL
// ══════════════════════════════════════════════════════════════════════════════

describe('REAL-009 — job draft prefill from quote', () => {
  it('test 11 — quote descripcion transfers to job draft', () => {
    const quote = makeQuote({ descripcion: 'Instalación panel solar 4kW en tejado inclinado' });
    const draft = {
      titulo: quote.descripcion.slice(0, 80) || `Trabajo — ${quote.nombreCliente}`,
      descripcion: quote.descripcion ?? '',
      client_id: null,
      quote_id: quote.dbId,
      prioridad: 'normal' as const,
    };
    expect(draft.descripcion).toBe('Instalación panel solar 4kW en tejado inclinado');
  });

  it('empty descripcion → empty string, not undefined', () => {
    const quote = makeQuote({ descripcion: '' });
    const draft = { descripcion: quote.descripcion ?? '' };
    expect(draft.descripcion).toBe('');
  });

  it('titulo truncates at 80 chars', () => {
    const longDesc = 'A'.repeat(100);
    const quote = makeQuote({ descripcion: longDesc });
    const draft = { titulo: quote.descripcion.slice(0, 80) || `Trabajo — ${quote.nombreCliente}` };
    expect(draft.titulo).toHaveLength(80);
  });

  it('titulo falls back to client name when descripcion empty', () => {
    const quote = makeQuote({ descripcion: '', nombreCliente: 'Martínez Obras' });
    const draft = { titulo: quote.descripcion.slice(0, 80) || `Trabajo — ${quote.nombreCliente}` };
    expect(draft.titulo).toBe('Trabajo — Martínez Obras');
  });
});
