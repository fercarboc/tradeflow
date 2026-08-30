-- MP-FIN-2E FIX 2: mkt_fin_admin_reserves_overview had nested aggregate calls
-- (jsonb_object_agg inside a SELECT with SUM/COUNT → PostgreSQL error 42803)
-- Fix: compute by_currency in a separate subquery first.
-- Applied to cloud 2026-08-24 during test validation.

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_reserves_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r jsonb; v_by_currency jsonb; BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;

  SELECT jsonb_object_agg(currency_key, currency_data) INTO v_by_currency
  FROM (
    SELECT currency::text AS currency_key,
           jsonb_build_object(
             'total_reserved', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN('active','partially_released')),0),
             'active_count',   COUNT(*) FILTER (WHERE status IN('active','partially_released'))
           ) AS currency_data
    FROM public.trade_marketplace_reserves
    GROUP BY currency
  ) sub;

  SELECT jsonb_build_object(
    'total_reserved',          COALESCE(SUM(remaining_amount) FILTER (WHERE status IN('active','partially_released')),0),
    'providers_with_reserves', COUNT(DISTINCT provider_actor_id) FILTER (WHERE status IN('active','partially_released')),
    'active_reserves',         COUNT(*) FILTER (WHERE status='active'),
    'partially_released',      COUNT(*) FILTER (WHERE status='partially_released'),
    'expired_reserves',        COUNT(*) FILTER (WHERE status='expired'),
    'cancelled_reserves',      COUNT(*) FILTER (WHERE status='cancelled'),
    'released_reserves',       COUNT(*) FILTER (WHERE status='released'),
    'reserves_near_expiry',    COUNT(*) FILTER (WHERE status IN('active','partially_released') AND expires_at IS NOT NULL AND expires_at<=now()+INTERVAL '7 days'),
    'total_ever_reserved',     COALESCE(SUM(reserved_amount),0),
    'total_ever_released',     COALESCE(SUM(released_amount),0),
    'by_currency',             COALESCE(v_by_currency, '{}'::jsonb),
    'simulation_only',         true,
    'calculated_at',           now()
  ) INTO v_r FROM public.trade_marketplace_reserves;

  RETURN COALESCE(v_r, jsonb_build_object(
    'total_reserved',0,'providers_with_reserves',0,'active_reserves',0,
    'simulation_only',true,'calculated_at',now()
  ));
END;$$;
