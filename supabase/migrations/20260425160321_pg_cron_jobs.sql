DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'debacu-welcome-dispatch') THEN
    PERFORM cron.unschedule('debacu-welcome-dispatch');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'debacu-risk-digest') THEN
    PERFORM cron.unschedule('debacu-risk-digest');
  END IF;
END;
$$;

SELECT cron.schedule(
  'debacu-welcome-dispatch',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/debacu_eval_welcome_email_dispatch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.service_role_key', true), '')
    ),
    body    := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'debacu-risk-digest',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/debacu_eval_risk_digest',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.service_role_key', true), '')
    ),
    body    := '{}'::jsonb
  );
  $$
);;
