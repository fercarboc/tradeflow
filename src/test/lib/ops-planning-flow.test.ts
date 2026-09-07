/**
 * PH0-OPS-CORE — Operations planning flow tests
 *
 * Covers:
 *   - pendingPlanningQuotes derivation logic
 *   - duplicate guard logic
 *   - REAL-009 prefill field
 *   - token acceptance state machine (state guard documented)
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

// ── Helper: token acceptance state guard (mirrors edge function logic) ────────

const ACCEPT_ALLOWED_STATES: QuoteEstado[] = ['Borrador', 'Enviado', 'Aceptado'];

function canAcceptFromState(estado: QuoteEstado): boolean {
  return ACCEPT_ALLOWED_STATES.includes(estado);
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
// TOKEN ACCEPTANCE STATE GUARD
// ══════════════════════════════════════════════════════════════════════════════

describe('canAcceptFromState (token acceptance guard)', () => {
  it('test 1 — pending quote (Borrador) → can accept', () => {
    expect(canAcceptFromState('Borrador')).toBe(true);
  });

  it('test 1b — Enviado → can accept', () => {
    expect(canAcceptFromState('Enviado')).toBe(true);
  });

  it('test 3 — already Aceptado → idempotent (allowed, safe no-op in DB)', () => {
    // The DB UPDATE is idempotent: SET estado='Aceptado' WHERE estado IN (..., 'Aceptado')
    expect(canAcceptFromState('Aceptado')).toBe(true);
  });

  it('test 4 — Rechazado → NOT allowed', () => {
    expect(canAcceptFromState('Rechazado')).toBe(false);
  });

  it('test 5 — Expirado → NOT allowed', () => {
    expect(canAcceptFromState('Expirado')).toBe(false);
  });

  it('Facturado → NOT allowed (terminal state)', () => {
    expect(canAcceptFromState('Facturado')).toBe(false);
  });
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
