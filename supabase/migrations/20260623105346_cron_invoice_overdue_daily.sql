
-- Function called by pg_cron to check overdue invoices daily
CREATE OR REPLACE FUNCTION public.cron_invoice_overdue_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret text;
BEGIN
  -- Read shared secret from vault
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_invoice_secret'
   LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'cron_invoice_overdue_check: vault secret not found';
    RETURN;
  END IF;

  -- Call the edge function asynchronously via pg_net
  PERFORM net.http_post(
    url     := 'https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-cron-daily',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  v_secret
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Schedule: every day at 08:00 UTC
SELECT cron.schedule(
  'invoice-overdue-daily',
  '0 8 * * *',
  'SELECT public.cron_invoice_overdue_check()'
);
;
