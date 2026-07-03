-- ═══════════════════════════════════════════════════════════════════════════
-- AI VALIDATION CENTER — Sprint 1
-- Tablas para el módulo de validación del motor IA de TrabFlow
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Benchmarks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_benchmarks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  descripcion     text,
  tipo            text NOT NULL DEFAULT 'interno'
                  CHECK (tipo IN ('oficial','proveedor','cliente','interno')),
  proveedor_id    uuid REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  activo          boolean NOT NULL DEFAULT true,
  es_baseline     boolean NOT NULL DEFAULT false,
  total_queries   integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Consultas de cada benchmark ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_benchmark_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id    uuid NOT NULL REFERENCES public.trade_benchmarks(id) ON DELETE CASCADE,
  posicion        integer NOT NULL,
  oficio          text NOT NULL,
  texto           text NOT NULL,
  metadata        jsonb DEFAULT '{}'::jsonb,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Ejecuciones de benchmark ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_benchmark_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id      uuid NOT NULL REFERENCES public.trade_benchmarks(id) ON DELETE RESTRICT,
  version_tag       text NOT NULL,
  descripcion       text,
  estado            text NOT NULL DEFAULT 'completed'
                    CHECK (estado IN ('pending','running','paused','completed','failed','cancelled')),
  config            jsonb DEFAULT '{}'::jsonb,
  iniciado_at       timestamptz,
  completado_at     timestamptz,
  total_queries     integer NOT NULL DEFAULT 0,
  queries_ok        integer NOT NULL DEFAULT 0,
  queries_vacio     integer NOT NULL DEFAULT 0,
  queries_truncado  integer NOT NULL DEFAULT 0,
  queries_error     integer NOT NULL DEFAULT 0,
  queries_solo_sug  integer NOT NULL DEFAULT 0,
  queries_precio_inv integer NOT NULL DEFAULT 0,
  ok_rate           numeric(5,2),
  coin_rate         numeric(5,2),
  lat_mean_ms       integer,
  lat_p95_ms        integer,
  tok_mean          integer,
  tok_max           integer,
  semaforo          text CHECK (semaforo IN ('verde','amarillo','rojo')),
  notas             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Resultados individuales por query ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_benchmark_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES public.trade_benchmark_runs(id) ON DELETE CASCADE,
  query_id         uuid REFERENCES public.trade_benchmark_queries(id) ON DELETE SET NULL,
  posicion         integer NOT NULL,
  oficio_esperado  text NOT NULL,
  oficio_detectado text,
  coincide_oficio  boolean,
  categoria        text,
  n_partidas       integer NOT NULL DEFAULT 0,
  n_catalogo       integer NOT NULL DEFAULT 0,
  n_sugeridas      integer NOT NULL DEFAULT 0,
  latency_ms       integer,
  tokens_out       integer,
  stop_reason      text,
  prompt_version   text,
  raw_response     jsonb,
  error_msg        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Logs de ejecución ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_run_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES public.trade_benchmark_runs(id) ON DELETE CASCADE,
  nivel       text NOT NULL DEFAULT 'info' CHECK (nivel IN ('info','warn','error')),
  mensaje     text NOT NULL,
  query_id    uuid REFERENCES public.trade_benchmark_queries(id) ON DELETE SET NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Versiones del motor IA ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_ai_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag        text NOT NULL UNIQUE,
  git_commit         text,
  git_tag            text,
  model_id           text NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  prompt_version     text,
  desplegado_at      timestamptz,
  rolled_back_at     timestamptz,
  es_produccion      boolean NOT NULL DEFAULT false,
  es_baseline        boolean NOT NULL DEFAULT false,
  benchmark_run_id   uuid REFERENCES public.trade_benchmark_runs(id) ON DELETE SET NULL,
  semaforo           text CHECK (semaforo IN ('verde','amarillo','rojo')),
  notas              text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Acceso al módulo por roles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_ai_validation_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'qa'
                  CHECK (role IN ('staff','qa','producto','cliente','proveedor')),
  benchmark_ids   uuid[],
  org_id          uuid REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bq_benchmark     ON public.trade_benchmark_queries(benchmark_id, posicion);
CREATE INDEX IF NOT EXISTS idx_br_benchmark     ON public.trade_benchmark_runs(benchmark_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_br_version       ON public.trade_benchmark_runs(version_tag);
CREATE INDEX IF NOT EXISTS idx_results_run      ON public.trade_benchmark_results(run_id, posicion);
CREATE INDEX IF NOT EXISTS idx_results_oficio   ON public.trade_benchmark_results(run_id, oficio_esperado);
CREATE INDEX IF NOT EXISTS idx_results_cat      ON public.trade_benchmark_results(run_id, categoria);
CREATE INDEX IF NOT EXISTS idx_logs_run         ON public.trade_run_logs(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_prod    ON public.trade_ai_versions(es_produccion, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_benchmarks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_benchmark_queries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_benchmark_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_benchmark_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_run_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_ai_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_ai_validation_access ENABLE ROW LEVEL SECURITY;

-- Solo service_role o el usuario autenticado con acceso puede leer
-- Por ahora: acceso amplio para usuarios autenticados (refinamos en Sprint 4)
CREATE POLICY "auth_read_benchmarks"    ON public.trade_benchmarks           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_bq"            ON public.trade_benchmark_queries     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_runs"          ON public.trade_benchmark_runs        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_results"       ON public.trade_benchmark_results     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_logs"          ON public.trade_run_logs              FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_versions"      ON public.trade_ai_versions           FOR ALL    TO authenticated USING (true);
CREATE POLICY "auth_read_access"        ON public.trade_ai_validation_access  FOR SELECT TO authenticated USING (true);

-- Service role: acceso completo (edge functions, scripts)
CREATE POLICY "service_all_benchmarks"  ON public.trade_benchmarks           FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_bq"          ON public.trade_benchmark_queries     FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_runs"        ON public.trade_benchmark_runs        FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_results"     ON public.trade_benchmark_results     FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_logs"        ON public.trade_run_logs              FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_versions"    ON public.trade_ai_versions           FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_access"      ON public.trade_ai_validation_access  FOR ALL TO service_role USING (true);

-- ── Seed: Benchmark Oficial ───────────────────────────────────────────────────
INSERT INTO public.trade_benchmarks (id, nombre, descripcion, tipo, activo, es_baseline, total_queries)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Benchmark Oficial 400',
  '20 oficios × 20 consultas. Benchmark permanente de referencia del motor IA. Nunca se modifica.',
  'oficial',
  true,
  true,
  400
) ON CONFLICT (id) DO NOTHING;

-- ── Seed: Versiones históricas ────────────────────────────────────────────────
INSERT INTO public.trade_ai_versions
  (version_tag, git_commit, git_tag, model_id, prompt_version, desplegado_at, es_produccion, es_baseline, semaforo, notas)
VALUES
  ('v51', NULL, NULL, 'claude-haiku-4-5-20251001', 'v51', '2026-05-01 00:00:00+00', false, false, 'verde',
   'extractFirstJSON añadido. VACIO 75%→2%. Primer hito funcional.'),
  ('v54', 'aa2c443', NULL, 'claude-haiku-4-5-20251001', 'v54', '2026-06-15 00:00:00+00', false, false, 'verde',
   'max_tokens 8192/4096 + isComplexJob regex. VACIO=0 definitivo.'),
  ('v55', NULL, NULL, 'claude-haiku-4-5-20251001', 'v55', NULL, false, false, 'rojo',
   'CASO 1/CASO 2 primera versión. ROLLBACK: +2 VACIO nuevos.'),
  ('v56-stable', '7571e96', 'v56-stable', 'claude-haiku-4-5-20251001', 'v56', '2026-06-24 00:00:00+00', false, true, 'verde',
   'CASO 1/CASO 2 + isComplexJob expandido. OK 93.2%, VACIO=0. Baseline oficial permanente.'),
  ('v57', NULL, NULL, 'claude-haiku-4-5-20251001', 'v57', NULL, false, false, 'rojo',
   'Prompt +150 tokens con reglas de oficio. ROLLBACK: −3.4pp OK, TRUNCADO+3.'),
  ('v57b', '5d09d06', 'v57b-stable', 'claude-haiku-4-5-20251001', 'v57b', '2026-06-30 00:00:00+00', true, false, 'verde',
   'applyOficioRules() post-proceso TypeScript. Zero tokens añadidos al prompt. OK 92.2%, VACIO=0, TRUNCADO=2.'),
  ('v58', NULL, NULL, 'claude-haiku-4-5-20251001', 'v58', NULL, false, false, 'rojo',
   'Fix origen/precio_origen. ROLLBACK: reconciliador sin guardia de precio → PRECIO_INVALIDO+10.'),
  ('v58b', NULL, NULL, 'claude-haiku-4-5-20251001', 'v58', NULL, false, false, 'amarillo',
   'Fix origen/precio_origen con guardia precio_unitario>0. Pendiente despliegue y validación.')
ON CONFLICT (version_tag) DO NOTHING;

-- ── Seed: Ejecuciones históricas (stats agregadas) ───────────────────────────
-- v51
INSERT INTO public.trade_benchmark_runs
  (id, benchmark_id, version_tag, descripcion, estado, completado_at,
   total_queries, queries_ok, queries_vacio, queries_truncado, queries_error, queries_solo_sug,
   ok_rate, coin_rate, lat_mean_ms, lat_p95_ms, tok_mean, tok_max, semaforo, notas)
VALUES (
  'b0000000-0000-0000-0000-000000000051',
  'a0000000-0000-0000-0000-000000000001',
  'v51', 'Benchmark oficial v51', 'completed', '2026-05-01 00:00:00+00',
  400, 312, 8, 4, 2, 74,
  78.0, 65.0, 19000, 31000, 2100, 5200, 'verde',
  'Primera ejecución con extractFirstJSON. VACIO reducido de 75% a 2%.'
) ON CONFLICT (id) DO NOTHING;

-- v54
INSERT INTO public.trade_benchmark_runs
  (id, benchmark_id, version_tag, descripcion, estado, completado_at,
   total_queries, queries_ok, queries_vacio, queries_truncado, queries_error, queries_solo_sug,
   ok_rate, coin_rate, lat_mean_ms, lat_p95_ms, tok_mean, tok_max, semaforo, notas)
VALUES (
  'b0000000-0000-0000-0000-000000000054',
  'a0000000-0000-0000-0000-000000000001',
  'v54', 'Benchmark oficial v54', 'completed', '2026-06-15 00:00:00+00',
  400, 360, 0, 4, 2, 34,
  90.0, 70.0, 18500, 30000, 2200, 6200, 'verde',
  'VACIO=0 definitivo. max_tokens 8192/4096 según complejidad.'
) ON CONFLICT (id) DO NOTHING;

-- v56-stable (baseline)
INSERT INTO public.trade_benchmark_runs
  (id, benchmark_id, version_tag, descripcion, estado, completado_at,
   total_queries, queries_ok, queries_vacio, queries_truncado, queries_error, queries_solo_sug, queries_precio_inv,
   ok_rate, coin_rate, lat_mean_ms, lat_p95_ms, tok_mean, tok_max, semaforo, notas)
VALUES (
  'b0000000-0000-0000-0000-000000000056',
  'a0000000-0000-0000-0000-000000000001',
  'v56-stable', 'Benchmark oficial v56-stable — BASELINE', 'completed', '2026-06-24 00:00:00+00',
  400, 373, 0, 4, 2, 20, 1,
  93.2, 72.8, 18299, 29179, 2468, 6618, 'verde',
  'Baseline oficial permanente. OK 93.2%, VACIO=0. Referencia para todas las comparativas.'
) ON CONFLICT (id) DO NOTHING;

-- v57b
INSERT INTO public.trade_benchmark_runs
  (id, benchmark_id, version_tag, descripcion, estado, completado_at,
   total_queries, queries_ok, queries_vacio, queries_truncado, queries_error, queries_solo_sug, queries_precio_inv,
   ok_rate, coin_rate, lat_mean_ms, lat_p95_ms, tok_mean, tok_max, semaforo, notas)
VALUES (
  'b0000000-0000-0000-0000-000000000057',
  'a0000000-0000-0000-0000-000000000001',
  'v57b', 'Benchmark oficial v57b', 'completed', '2026-07-02 00:00:00+00',
  400, 369, 0, 2, 2, 27, 0,
  92.2, 73.8, 17917, 28543, 2488, 8192, 'verde',
  'applyOficioRules: Telecomunicaciones+10pp, Contra Incendios+10pp. TRUNCADO reducido a 2.'
) ON CONFLICT (id) DO NOTHING;

-- v58 (rollback)
INSERT INTO public.trade_benchmark_runs
  (id, benchmark_id, version_tag, descripcion, estado, completado_at,
   total_queries, queries_ok, queries_vacio, queries_truncado, queries_error, queries_solo_sug, queries_precio_inv,
   ok_rate, coin_rate, lat_mean_ms, lat_p95_ms, tok_mean, tok_max, semaforo, notas)
VALUES (
  'b0000000-0000-0000-0000-000000000058',
  'a0000000-0000-0000-0000-000000000001',
  'v58', 'Benchmark oficial v58 — ROLLBACK', 'completed', '2026-07-03 00:00:00+00',
  400, 367, 0, 5, 2, 16, 10,
  91.8, 72.8, 17880, 29034, 2505, 7360, 'rojo',
  'ROLLBACK. Fix origen sin guardia precio: 9 regresiones Causa A (PRECIO_INVALIDO+10). Tasa −1.4pp vs baseline.'
) ON CONFLICT (id) DO NOTHING;

-- ── Asociar runs a versiones ──────────────────────────────────────────────────
UPDATE public.trade_ai_versions SET benchmark_run_id = 'b0000000-0000-0000-0000-000000000051' WHERE version_tag = 'v51';
UPDATE public.trade_ai_versions SET benchmark_run_id = 'b0000000-0000-0000-0000-000000000054' WHERE version_tag = 'v54';
UPDATE public.trade_ai_versions SET benchmark_run_id = 'b0000000-0000-0000-0000-000000000056' WHERE version_tag = 'v56-stable';
UPDATE public.trade_ai_versions SET benchmark_run_id = 'b0000000-0000-0000-0000-000000000057' WHERE version_tag = 'v57b';
UPDATE public.trade_ai_versions SET benchmark_run_id = 'b0000000-0000-0000-0000-000000000058' WHERE version_tag = 'v58';
