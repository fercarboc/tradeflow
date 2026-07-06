-- ok_rate redefinido como métrica de producto: presupuestos generados
-- = OK_CATALOGO + OK_MIXTO + SOLO_SUGERIDAS
--
-- SOLO_SUGERIDAS no es un fallo del motor IA: el motor generó la estructura
-- de trabajo correctamente. El instalador añade precios desde su catálogo
-- externo y el sistema aprende para próximas consultas.
-- La ausencia de precio automático es un gap del catálogo TradeFlow,
-- no de la calidad del motor.
CREATE OR REPLACE FUNCTION public.recompute_run_stats(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ok          integer;
  v_vacio       integer;
  v_truncado    integer;
  v_precio_inv  integer;
  v_solo_sug    integer;
  v_error       integer;
  v_total       integer;
  v_lat_mean    numeric;
  v_lat_p95     numeric;
  v_tok_mean    numeric;
  v_tok_max     integer;
  v_coin_rate   numeric;
  v_ok_rate     numeric;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE categoria IN ('OK_CATALOGO','OK_MIXTO')),
    COUNT(*) FILTER (WHERE categoria = 'VACIO'),
    COUNT(*) FILTER (WHERE categoria = 'TRUNCADO'),
    COUNT(*) FILTER (WHERE categoria = 'PRECIO_INVALIDO'),
    COUNT(*) FILTER (WHERE categoria = 'SOLO_SUGERIDAS'),
    COUNT(*) FILTER (WHERE categoria = 'ERROR_TECNICO'),
    COUNT(*),
    AVG(latency_ms),
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms),
    AVG(tokens_out),
    MAX(tokens_out),
    CASE WHEN COUNT(*) > 0
         THEN COUNT(*) FILTER (WHERE coincide_oficio)::numeric / COUNT(*) * 100
         ELSE 0 END
  INTO
    v_ok, v_vacio, v_truncado, v_precio_inv, v_solo_sug, v_error,
    v_total, v_lat_mean, v_lat_p95, v_tok_mean, v_tok_max, v_coin_rate
  FROM public.trade_benchmark_results
  WHERE run_id = p_run_id;

  -- ok_rate = presupuestos generados / total
  -- queries_ok sigue siendo solo OK_CATALOGO + OK_MIXTO (con precio de catálogo)
  -- para poder distinguir ambas métricas en la UI
  IF v_total > 0 THEN
    v_ok_rate := ROUND(
      ((v_ok + v_solo_sug)::numeric / v_total * 100),
    2);
  END IF;

  UPDATE public.trade_benchmark_runs SET
    queries_ok         = COALESCE(v_ok,         0),
    queries_vacio      = COALESCE(v_vacio,       0),
    queries_truncado   = COALESCE(v_truncado,    0),
    queries_precio_inv = COALESCE(v_precio_inv,  0),
    queries_solo_sug   = COALESCE(v_solo_sug,    0),
    queries_error      = COALESCE(v_error,       0),
    ok_rate            = v_ok_rate,
    coin_rate          = ROUND(COALESCE(v_coin_rate, 0), 2),
    lat_mean_ms        = ROUND(COALESCE(v_lat_mean, 0))::integer,
    lat_p95_ms         = ROUND(COALESCE(v_lat_p95,  0))::integer,
    tok_mean           = ROUND(COALESCE(v_tok_mean,  0))::integer,
    tok_max            = COALESCE(v_tok_max, 0)
  WHERE id = p_run_id;
END;
$function$;
