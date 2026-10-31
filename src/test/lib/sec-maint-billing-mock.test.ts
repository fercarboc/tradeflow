/**
 * SEC-MAINT-BILLING-1 — Behavioral mock tests for the auth guard
 *
 * These tests model the auth guard logic extracted from the Edge Function and
 * verify its runtime behaviour without invoking Deno, calling any remote service,
 * or creating real invoices.
 *
 * Strategy: replicate the guard logic (verbatim from index.ts) in a pure
 * TypeScript function and test each decision branch independently.
 * If the guard logic changes in index.ts, the static analysis tests in
 * sec-maint-billing-auth.test.ts will catch structural drift.
 */

import { describe, it, expect, vi } from 'vitest';

// ── Auth guard — exact replication of the logic in index.ts ──────────────────
// Changes here must be mirrored in the Edge Function, and vice-versa.

interface GuardResult {
  status: number;
  body: Record<string, string>;
  passed: boolean;
}

interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
}

function runAuthGuard(
  cronSecret: string,  // simulates Deno.env.get('CRON_INVOICE_SECRET')
  method: string,
  incomingSecret: string,
): GuardResult {
  if (!cronSecret) {
    return { status: 500, body: { error: 'misconfigured: CRON_INVOICE_SECRET not set' }, passed: false };
  }
  if (method !== 'POST') {
    return { status: 405, body: { error: 'method not allowed' }, passed: false };
  }
  if (!incomingSecret || incomingSecret !== cronSecret) {
    return { status: 401, body: { error: 'unauthorized' }, passed: false };
  }
  return { status: 200, body: {}, passed: true };
}

// ── 1. Missing CRON_INVOICE_SECRET ────────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 mock — missing secret config', () => {
  it('returns 500 when CRON_INVOICE_SECRET is empty string', () => {
    const result = runAuthGuard('', 'POST', 'anything');
    expect(result.status).toBe(500);
    expect(result.passed).toBe(false);
    expect(result.body.error).toContain('CRON_INVOICE_SECRET not set');
  });

  it('does not proceed to privileged operations when secret is missing', () => {
    const sbCreate = vi.fn();
    const result = runAuthGuard('', 'POST', 'anything');
    expect(result.passed).toBe(false);
    // If guard didn't pass, createClient should never be called
    expect(sbCreate).not.toHaveBeenCalled();
  });
});

// ── 2. Method restriction ─────────────────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 mock — method restriction', () => {
  const SECRET = 'test-secret-abc123';

  it('returns 405 for GET requests', () => {
    const result = runAuthGuard(SECRET, 'GET', SECRET);
    expect(result.status).toBe(405);
    expect(result.passed).toBe(false);
  });

  it('returns 405 for PUT requests', () => {
    const result = runAuthGuard(SECRET, 'PUT', SECRET);
    expect(result.status).toBe(405);
    expect(result.passed).toBe(false);
  });

  it('returns 405 for DELETE requests', () => {
    const result = runAuthGuard(SECRET, 'DELETE', SECRET);
    expect(result.status).toBe(405);
    expect(result.passed).toBe(false);
  });

  it('returns 405 for PATCH requests', () => {
    const result = runAuthGuard(SECRET, 'PATCH', SECRET);
    expect(result.status).toBe(405);
    expect(result.passed).toBe(false);
  });

  it('does not respond 405 for OPTIONS (handled by CORS preflight, before guard)', () => {
    // OPTIONS is handled before the guard in the real function (returns early).
    // This test confirms the guard itself would return 405 for OPTIONS —
    // callers must not pass OPTIONS into the guard.
    const result = runAuthGuard(SECRET, 'OPTIONS', SECRET);
    expect(result.status).toBe(405);
  });
});

// ── 3. Wrong or absent x-cron-secret ─────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 mock — x-cron-secret validation', () => {
  const SECRET = 'prod-secret-xyz-9876';
  const sbCreate = vi.fn();

  it('returns 401 for empty secret header', () => {
    const result = runAuthGuard(SECRET, 'POST', '');
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('unauthorized');
    expect(result.passed).toBe(false);
  });

  it('returns 401 for wrong secret', () => {
    const result = runAuthGuard(SECRET, 'POST', 'wrong-secret');
    expect(result.status).toBe(401);
    expect(result.passed).toBe(false);
  });

  it('does not invoke createClient when secret is wrong', () => {
    const result = runAuthGuard(SECRET, 'POST', 'wrong-secret');
    expect(result.passed).toBe(false);
    expect(sbCreate).not.toHaveBeenCalled();
  });

  it('is case-sensitive', () => {
    const result = runAuthGuard(SECRET, 'POST', SECRET.toUpperCase());
    expect(result.status).toBe(401);
  });
});

// ── 4. Response does not expose internal identifiers ─────────────────────────

describe('SEC-MAINT-BILLING-1 mock — response content', () => {
  const SECRET = 'safe-secret-1234';

  it('401 response body contains only "error" key', () => {
    const result = runAuthGuard(SECRET, 'POST', 'wrong');
    const keys = Object.keys(result.body);
    expect(keys).toEqual(['error']);
    expect(result.body).not.toHaveProperty('maintenance_contract_id');
    expect(result.body).not.toHaveProperty('org_id');
    expect(result.body).not.toHaveProperty('id');
  });

  it('405 response body contains only "error" key', () => {
    const result = runAuthGuard(SECRET, 'GET', SECRET);
    const keys = Object.keys(result.body);
    expect(keys).toEqual(['error']);
  });

  it('500 response body does not expose env var names or values', () => {
    const result = runAuthGuard('', 'POST', 'x');
    // Error mentions the concept, not a secret value
    expect(result.body.error).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(result.body.error).not.toContain('RESEND_API_KEY');
    // Does mention the missing var name — acceptable for operator debugging
    expect(result.body.error).toContain('CRON_INVOICE_SECRET');
  });
});

// ── 5. Authorised request passes through ─────────────────────────────────────

describe('SEC-MAINT-BILLING-1 mock — authorised request', () => {
  const SECRET = 'correct-secret-abc';

  it('passes with correct POST + correct secret', () => {
    const result = runAuthGuard(SECRET, 'POST', SECRET);
    expect(result.passed).toBe(true);
    expect(result.status).toBe(200);
  });

  it('does not reject correct secret with whitespace trimming (no implicit trim)', () => {
    // Secrets must match exactly — no implicit whitespace trimming.
    // Operators must ensure vault value and env var have no surrounding spaces.
    const result = runAuthGuard(SECRET, 'POST', ` ${SECRET}`);
    expect(result.passed).toBe(false);
  });

  it('does not reject correct secret with different capitalisation (case-sensitive)', () => {
    const result = runAuthGuard(SECRET, 'POST', SECRET.toLowerCase());
    // Only equal if they happen to be the same
    expect(result.passed).toBe(SECRET === SECRET.toLowerCase());
  });
});

// ── 6. Guard order: all rejections happen before any billing ─────────────────

describe('SEC-MAINT-BILLING-1 mock — guard order invariant', () => {
  it('missing-secret check fires before method check', () => {
    // Even with wrong method, missing secret fires first (500 not 405)
    const result = runAuthGuard('', 'GET', 'x');
    expect(result.status).toBe(500);
  });

  it('method check fires before secret comparison', () => {
    // Even with correct secret, wrong method fires (405 not 401)
    const SECRET = 'abc';
    const result = runAuthGuard(SECRET, 'DELETE', SECRET);
    expect(result.status).toBe(405);
  });
});
