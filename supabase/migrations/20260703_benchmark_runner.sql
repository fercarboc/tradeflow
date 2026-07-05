-- ═══════════════════════════════════════════════════════════════════════════
-- BENCHMARK RUNNER — Sprint 3
-- Alter trade_benchmark_queries + función recompute_run_stats
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Añadir oficio_display y oficio_esperado (slug canónico) ──────────────────
ALTER TABLE public.trade_benchmark_queries
  RENAME COLUMN oficio TO oficio_display;

ALTER TABLE public.trade_benchmark_queries
  ADD COLUMN oficio_esperado text;

-- El comparador y la lógica de coincidencia usan oficio_esperado (slug)
-- oficio_display es solo para visualización
COMMENT ON COLUMN public.trade_benchmark_queries.oficio_display  IS 'Nombre legible (ej: "Reformas Integrales")';
COMMENT ON COLUMN public.trade_benchmark_queries.oficio_esperado IS 'Slug canónico para comparar con oficio_detectado (ej: "reforma_integral")';

-- ── Función: recompute_run_stats ──────────────────────────────────────────────
-- Recalcula todos los KPIs de un run desde trade_benchmark_results (fuente de verdad).
-- Llamada desde la edge function tras cada batch.
CREATE OR REPLACE FUNCTION public.recompute_run_stats(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_total > 0 THEN
    v_ok_rate := ROUND((v_ok::numeric / v_total * 100), 2);
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
$$;

GRANT EXECUTE ON FUNCTION public.recompute_run_stats(uuid) TO authenticated, service_role;
