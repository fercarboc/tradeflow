
-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily billing run at 07:00 UTC
SELECT cron.schedule(
  'trade-maintenance-billing-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-maintenance-billing',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
;
