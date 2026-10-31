/**
 * SEC-MAINT-BILLING-1 — Auth hardening verification (static analysis)
 *
 * These tests inspect the source of the trade-maintenance-billing Edge Function
 * without mounting Deno, calling any remote service, or altering production data.
 * They enforce the structural security invariants introduced by the hotfix.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT      = resolve(__dirname, '../../..');
const fnSrc     = readFileSync(
  resolve(ROOT, 'supabase/functions/trade-maintenance-billing/index.ts'),
  'utf-8',
);
const cronSql   = readFileSync(
  resolve(ROOT, 'supabase/migrations/20261031120000_maintenance_billing_cron_auth.sql'),
  'utf-8',
);

// ── 1. Auth guard precedes any privileged operation ───────────────────────────

describe('SEC-MAINT-BILLING-1 — Auth guard order', () => {
  it('CRON_INVOICE_SECRET env var is declared at module level', () => {
    expect(fnSrc).toContain("Deno.env.get('CRON_INVOICE_SECRET')");
  });

  it('auth guard appears before createClient call', () => {
    const authIdx   = fnSrc.indexOf('CRON_INVOICE_SECRET not set');
    const clientIdx = fnSrc.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)');
    expect(authIdx).toBeGreaterThan(0);
    expect(clientIdx).toBeGreaterThan(authIdx);
  });

  it('returns 500 when CRON_INVOICE_SECRET is missing', () => {
    expect(fnSrc).toContain("status: 500");
    expect(fnSrc).toContain("CRON_INVOICE_SECRET not set");
  });
});

// ── 2. Method restriction ─────────────────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 — Method restriction', () => {
  it('rejects non-POST methods with 405', () => {
    expect(fnSrc).toContain("req.method !== 'POST'");
    expect(fnSrc).toContain("status: 405");
    expect(fnSrc).toContain("method not allowed");
  });

  it('method check appears before createClient', () => {
    const methodIdx = fnSrc.indexOf("req.method !== 'POST'");
    const clientIdx = fnSrc.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)');
    expect(methodIdx).toBeGreaterThan(0);
    expect(clientIdx).toBeGreaterThan(methodIdx);
  });
});

// ── 3. x-cron-secret validation ───────────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 — x-cron-secret validation', () => {
  it('reads x-cron-secret from request headers', () => {
    expect(fnSrc).toContain("req.headers.get('x-cron-secret')");
  });

  it('returns 401 when secret is absent or wrong', () => {
    expect(fnSrc).toContain("status: 401");
    expect(fnSrc).toContain("unauthorized");
  });

  it('secret validation appears before createClient', () => {
    const secretIdx = fnSrc.indexOf("req.headers.get('x-cron-secret')");
    const clientIdx = fnSrc.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)');
    expect(secretIdx).toBeGreaterThan(0);
    expect(clientIdx).toBeGreaterThan(secretIdx);
  });

  it('compares incomingSecret to CRON_INVOICE_SECRET', () => {
    expect(fnSrc).toContain('incomingSecret !== CRON_INVOICE_SECRET');
  });
});

// ── 4. Response does not expose internal IDs ──────────────────────────────────

describe('SEC-MAINT-BILLING-1 — Response content', () => {
  it('skippedNoClient does not include maintenance_contract_id field', () => {
    expect(fnSrc).not.toContain('maintenance_contract_id:');
  });

  it('skippedNoClient does not include org_id field', () => {
    // org_id references inside the business logic (queries) are expected;
    // only the response push must not expose it.
    const pushIdx = fnSrc.indexOf('skippedNoClient.push');
    expect(pushIdx).toBeGreaterThan(0);
    const pushBlock = fnSrc.slice(pushIdx, pushIdx + 300);
    expect(pushBlock).not.toContain('org_id');
  });

  it('skippedNoClient exposes only numero and motivo', () => {
    const pushIdx   = fnSrc.indexOf('skippedNoClient.push');
    const pushBlock = fnSrc.slice(pushIdx, pushIdx + 300);
    expect(pushBlock).toContain('numero');
    expect(pushBlock).toContain('motivo');
  });
});

// ── 5. Cron migration uses vault secret ───────────────────────────────────────

describe('SEC-MAINT-BILLING-1 — Cron migration', () => {
  it('drops the old unauthenticated job', () => {
    expect(cronSql).toContain("cron.unschedule('trade-maintenance-billing-daily')");
  });

  it('new cron sends x-cron-secret header', () => {
    expect(cronSql).toContain("'x-cron-secret'");
  });

  it('secret value is read from vault.decrypted_secrets at execution time', () => {
    expect(cronSql).toContain('vault.decrypted_secrets');
    expect(cronSql).toContain("name = 'cron_invoice_secret'");
  });

  it('safety guard aborts if vault secret is missing', () => {
    expect(cronSql).toContain('vault.secrets');
    expect(cronSql).toContain('cron_invoice_secret');
    expect(cronSql).toContain('RAISE EXCEPTION');
  });

  it('preserves 07:00 UTC daily schedule', () => {
    expect(cronSql).toContain("'0 7 * * *'");
  });
});

// ── 6. Semestral billing regression ───────────────────────────────────────────

describe('SEC-MAINT-BILLING-1 — Semestral billing regression', () => {
  it('multiplier 6 is applied for semestral contracts', () => {
    expect(fnSrc).toContain("tipo_facturacion === 'semestral' ? 6");
  });

  it('metodo_pago is included in the invoice INSERT', () => {
    expect(fnSrc).toContain('metodo_pago:');
  });

  it('period label renders S1/S2 for semestral', () => {
    expect(fnSrc).toContain('S${periodoDate.getMonth() < 6 ? 1 : 2}');
  });
});
