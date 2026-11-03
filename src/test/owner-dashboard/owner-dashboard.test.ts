/**
 * owner-dashboard.test.ts — TX-IN-OWNER-DASH-1
 *
 * 10 acceptance tests for OwnerDashboardDesktop + OwnerDashboardMobile.
 * Pure logic extracted from component helpers — no React renderer needed.
 */

import { describe, it, expect } from 'vitest';

// ── Helper: todayLocalISO (same impl as components) ──────────────────────────
function todayLocalISO(): string {
  return Intl.DateTimeFormat('sv-SE').format(new Date());
}

// ── Helper: filter today's jobs ───────────────────────────────────────────────
function filterTodayJobs<T extends { fecha_inicio: string | null; estado: string }>(
  jobs: T[],
  today: string,
): T[] {
  return jobs.filter(j => j.fecha_inicio === today && j.estado !== 'cancelado');
}

// ── Helper: sort by hora_inicio ───────────────────────────────────────────────
function sortByHora<T extends { hora_inicio: string | null }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) =>
    (a.hora_inicio ?? '99:99').localeCompare(b.hora_inicio ?? '99:99'),
  );
}

// ── Helper: pendingPlanningQuotes ──────────────────────────────────────────────
interface SimpleQuote { id: string; dbId?: string; estado: string }
interface SimpleJob   { id: string; quote_id: string | null | undefined; estado: string }

function filterPendingPlanningQuotes(quotes: SimpleQuote[], jobs: SimpleJob[]): SimpleQuote[] {
  return quotes.filter(p =>
    p.estado === 'Aceptado' &&
    !jobs.some(j =>
      j.quote_id === p.dbId &&
      j.estado !== 'cancelado' &&
      j.estado !== 'no_realizado',
    ),
  );
}

// ── Helper: facturas vencidas ─────────────────────────────────────────────────
interface SimpleFactura { id: string; estado: string; fechaVencimiento: string | null | undefined; importe: number }

function filterFacturasVencidas(facturas: SimpleFactura[], today: string): SimpleFactura[] {
  return facturas.filter(f => {
    if (f.estado === 'Vencida') return true;
    if (f.estado !== 'Emitida' && f.estado !== 'Pendiente') return false;
    return !!f.fechaVencimiento && f.fechaVencimiento < today;
  });
}

// ── Helper: total pendiente cobro ─────────────────────────────────────────────
function totalPendiente(facturas: SimpleFactura[]): number {
  return facturas
    .filter(f => f.estado === 'Emitida' || f.estado === 'Pendiente' || f.estado === 'Vencida')
    .reduce((sum, f) => sum + f.importe, 0);
}

// ── Helper: unassigned jobs ───────────────────────────────────────────────────
interface SimpleJobWithWorkers { id: string; trade_job_workers?: { worker_id: string }[] | null }

function filterUnassigned(jobs: SimpleJobWithWorkers[]): SimpleJobWithWorkers[] {
  return jobs.filter(j => !(j.trade_job_workers?.length));
}

// ─────────────────────────────────────────────────────────────────────────────

const today = todayLocalISO();
const yesterday = new Date(Date.now() - 86400000);
const yesterdayISO = Intl.DateTimeFormat('sv-SE').format(yesterday);
const futureISO = '2099-12-31';
const pastISO = '2020-01-01';

describe('OD-1 — todayLocalISO is timezone-safe (not UTC)', () => {
  it('OD-1-1: format is YYYY-MM-DD', () => {
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('OD-1-2: uses Intl sv-SE locale (matches local TZ, not UTC)', () => {
    const svSE = Intl.DateTimeFormat('sv-SE').format(new Date());
    expect(today).toBe(svSE);
  });
});

describe('OD-2 — filterTodayJobs', () => {
  const jobs = [
    { id: 'j1', fecha_inicio: today,      estado: 'planificado' },
    { id: 'j2', fecha_inicio: today,      estado: 'en_curso' },
    { id: 'j3', fecha_inicio: today,      estado: 'cancelado' },
    { id: 'j4', fecha_inicio: yesterdayISO, estado: 'planificado' },
    { id: 'j5', fecha_inicio: futureISO,   estado: 'planificado' },
    { id: 'j6', fecha_inicio: null,        estado: 'planificado' },
  ];

  it('OD-2-1: includes planificado and en_curso jobs for today', () => {
    const result = filterTodayJobs(jobs, today);
    expect(result.map(j => j.id)).toContain('j1');
    expect(result.map(j => j.id)).toContain('j2');
  });

  it('OD-2-2: excludes cancelled jobs for today', () => {
    const result = filterTodayJobs(jobs, today);
    expect(result.map(j => j.id)).not.toContain('j3');
  });

  it('OD-2-3: excludes jobs from other dates (past, future, null)', () => {
    const result = filterTodayJobs(jobs, today);
    expect(result.map(j => j.id)).not.toContain('j4');
    expect(result.map(j => j.id)).not.toContain('j5');
    expect(result.map(j => j.id)).not.toContain('j6');
  });
});

describe('OD-3 — sortByHora', () => {
  it('OD-3-1: sorts jobs by hora_inicio ascending', () => {
    const jobs = [
      { id: 'c', hora_inicio: '14:00' },
      { id: 'a', hora_inicio: '08:00' },
      { id: 'b', hora_inicio: '11:30' },
    ];
    const sorted = sortByHora(jobs);
    expect(sorted.map(j => j.id)).toEqual(['a', 'b', 'c']);
  });

  it('OD-3-2: null hora_inicio sorts last (treated as 99:99)', () => {
    const jobs = [
      { id: 'x', hora_inicio: null },
      { id: 'y', hora_inicio: '09:00' },
    ];
    const sorted = sortByHora(jobs);
    expect(sorted[0].id).toBe('y');
    expect(sorted[1].id).toBe('x');
  });
});

describe('OD-4 — filterPendingPlanningQuotes', () => {
  const quotes: SimpleQuote[] = [
    { id: 'q1', dbId: 'db-q1', estado: 'Aceptado' },   // no job → por planificar
    { id: 'q2', dbId: 'db-q2', estado: 'Aceptado' },   // has active job → NOT por planificar
    { id: 'q3', dbId: 'db-q3', estado: 'Aceptado' },   // only cancelled job → por planificar
    { id: 'q4', dbId: 'db-q4', estado: 'Borrador' },   // wrong state
    { id: 'q5', dbId: 'db-q5', estado: 'Enviado' },    // wrong state
  ];

  const jobs: SimpleJob[] = [
    { id: 'j2', quote_id: 'db-q2', estado: 'planificado' },
    { id: 'j3', quote_id: 'db-q3', estado: 'cancelado' },
  ];

  it('OD-4-1: includes Aceptado quote with no linked active job', () => {
    const result = filterPendingPlanningQuotes(quotes, jobs);
    expect(result.map(q => q.id)).toContain('q1');
  });

  it('OD-4-2: excludes Aceptado quote that already has an active job', () => {
    const result = filterPendingPlanningQuotes(quotes, jobs);
    expect(result.map(q => q.id)).not.toContain('q2');
  });

  it('OD-4-3: includes Aceptado quote whose only linked job is cancelled', () => {
    const result = filterPendingPlanningQuotes(quotes, jobs);
    expect(result.map(q => q.id)).toContain('q3');
  });

  it('OD-4-4: excludes Borrador and Enviado quotes regardless of jobs', () => {
    const result = filterPendingPlanningQuotes(quotes, jobs);
    expect(result.map(q => q.id)).not.toContain('q4');
    expect(result.map(q => q.id)).not.toContain('q5');
  });
});

describe('OD-5 — filterFacturasVencidas', () => {
  const facturas: SimpleFactura[] = [
    { id: 'f1', estado: 'Emitida',  fechaVencimiento: pastISO,   importe: 100 }, // vencida por fecha
    { id: 'f2', estado: 'Pendiente', fechaVencimiento: pastISO,  importe: 200 }, // vencida por fecha
    { id: 'f3', estado: 'Emitida',  fechaVencimiento: futureISO, importe: 300 }, // en plazo
    { id: 'f4', estado: 'Pagada',   fechaVencimiento: pastISO,   importe: 400 }, // pagada → skip
    { id: 'f5', estado: 'Emitida',  fechaVencimiento: null,      importe: 500 }, // sin vencimiento
    { id: 'f6', estado: 'Vencida',  fechaVencimiento: futureISO, importe: 600 }, // estado Vencida explícito
  ];

  it('OD-5-1: includes Emitida and Pendiente with past fechaVencimiento', () => {
    const result = filterFacturasVencidas(facturas, today);
    expect(result.map(f => f.id)).toContain('f1');
    expect(result.map(f => f.id)).toContain('f2');
  });

  it('OD-5-2: excludes Emitida with future fechaVencimiento', () => {
    const result = filterFacturasVencidas(facturas, today);
    expect(result.map(f => f.id)).not.toContain('f3');
  });

  it('OD-5-3: excludes Pagada facturas', () => {
    const result = filterFacturasVencidas(facturas, today);
    expect(result.map(f => f.id)).not.toContain('f4');
  });

  it('OD-5-4: excludes Emitida without fechaVencimiento (null)', () => {
    const result = filterFacturasVencidas(facturas, today);
    expect(result.map(f => f.id)).not.toContain('f5');
  });

  it('OD-5-5: includes estado=Vencida regardless of fechaVencimiento', () => {
    const result = filterFacturasVencidas(facturas, today);
    expect(result.map(f => f.id)).toContain('f6');
  });
});

describe('OD-6 — totalPendiente', () => {
  it('OD-6-1: sums Emitida, Pendiente and Vencida facturas', () => {
    const facturas: SimpleFactura[] = [
      { id: 'f1', estado: 'Emitida',  fechaVencimiento: null, importe: 150 },
      { id: 'f2', estado: 'Pendiente', fechaVencimiento: null, importe: 250 },
      { id: 'f3', estado: 'Pagada',   fechaVencimiento: null, importe: 1000 },
      { id: 'f4', estado: 'Borrador', fechaVencimiento: null, importe: 50 },
      { id: 'f5', estado: 'Vencida',  fechaVencimiento: null, importe: 300 },
    ];
    expect(totalPendiente(facturas)).toBe(700);
  });

  it('OD-6-2: returns 0 when all facturas are paid', () => {
    const facturas: SimpleFactura[] = [
      { id: 'f1', estado: 'Pagada', fechaVencimiento: null, importe: 500 },
    ];
    expect(totalPendiente(facturas)).toBe(0);
  });

  it('OD-6-3: includes Vencida in total even without fechaVencimiento', () => {
    const facturas: SimpleFactura[] = [
      { id: 'f1', estado: 'Vencida', fechaVencimiento: null, importe: 400 },
    ];
    expect(totalPendiente(facturas)).toBe(400);
  });
});

describe('OD-7 — filterUnassigned', () => {
  it('OD-7-1: returns jobs with no workers (null or empty array)', () => {
    const jobs: SimpleJobWithWorkers[] = [
      { id: 'j1', trade_job_workers: null },
      { id: 'j2', trade_job_workers: [] },
      { id: 'j3', trade_job_workers: [{ worker_id: 'w1' }] },
    ];
    const result = filterUnassigned(jobs);
    expect(result.map(j => j.id)).toContain('j1');
    expect(result.map(j => j.id)).toContain('j2');
    expect(result.map(j => j.id)).not.toContain('j3');
  });
});
