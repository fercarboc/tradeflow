-- SEC-MAINT-BILLING-1: Replace unauthenticated cron with vault-secret-authenticated version.
--
-- The previous cron (20260529140156_maintenance_billing_cron.sql) called the Edge Function
-- with no Authorization or x-cron-secret header, making it fully public.
-- This migration drops that job and recreates it using the cron_invoice_secret stored in
-- Supabase Vault so the Edge Function can verify the caller.
--
-- DEPLOYMENT ORDER (must follow this sequence to avoid 401 window):
--   STEP 1 — Add 'cron_invoice_secret' to vault.secrets (Supabase dashboard > Vault).
--   STEP 2 — Set CRON_INVOICE_SECRET env var in the Edge Function (same value as vault).
--   STEP 3 — Apply this migration (unschedules old cron, schedules authenticated one).
--   STEP 4 — Deploy the new Edge Function code (auth guard active).
--
-- This order guarantees the cron always sends the correct secret BEFORE the function
-- starts enforcing it. The old function (no-auth) ignores the header harmlessly.
-- Never deploy Step 4 before Step 3: the function would reject the old headerless cron.
--
-- Prerequisites verified by safety guard below:
--   1. vault.secrets row 'cron_invoice_secret' must exist AND be non-empty.
--   2. Edge Function must have CRON_INVOICE_SECRET env var set to the same value.
--
-- ATOMICITY: cron.schedule/unschedule operate on the cron.job table, which is fully
-- transactional in PostgreSQL. If any statement fails, the whole migration rolls back
-- and the old unauthenticated job remains in place (safe state: the vulnerability
-- persists but no cron is lost). Fix the prerequisite and re-apply.

-- Safety guard: abort if the vault secret is missing or empty.
-- Checks vault.decrypted_secrets (not vault.secrets) to also catch empty values.
DO $$
DECLARE
  _secret text;
BEGIN
  SELECT decrypted_secret
    INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_invoice_secret'
   LIMIT 1;

  IF _secret IS NULL OR trim(_secret) = '' THEN
    RAISE EXCEPTION
      'vault secret "cron_invoice_secret" is missing or empty — '
      'create it in the Supabase Vault dashboard before applying this migration';
  END IF;
END;
$$;

-- Drop the unauthenticated job.
-- If this fails (job not found), the migration rolls back cleanly.
SELECT cron.unschedule('trade-maintenance-billing-daily');

-- Recreate with x-cron-secret header read from vault at execution time (not at migration time).
-- The SQL text stored in cron.job never contains the secret literal.
-- At 07:00 UTC the cron runner evaluates the subquery against vault.decrypted_secrets live.
SELECT cron.schedule(
  'trade-maintenance-billing-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-maintenance-billing',
    headers := jsonb_build_object(
                 'Content-Type',   'application/json',
                 'x-cron-secret',  (SELECT decrypted_secret
                                    FROM vault.decrypted_secrets
                                    WHERE name = 'cron_invoice_secret'
                                    LIMIT 1)
               ),
    body    := '{}'::jsonb
  );
  $$
);
