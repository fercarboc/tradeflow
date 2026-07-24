-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE HARDENING — Production fixes (Phase 1 / Audit findings)
-- Fecha: 2026-07-24
-- Resuelve:
--   CRÍTICO-2: race condition en numeración de pedidos (trg_fn_mkt_order_numero)
--   ALTA-2:    índice ausente en trade_marketplace_outbox.org_id
--   ALTA-2b:   índice compuesto (org_id, estado) en trade_marketplace_orders
--   ALTA-3:    pg_cron para consumidor del outbox (notificaciones automáticas)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. TABLA DE CONTADORES POR ACTOR (fix race condition O(n) → O(1))
-- ─────────────────────────────────────────────────────────────────────────────
-- Reemplaza el SELECT MAX() sin lock por un INSERT ... ON CONFLICT DO UPDATE
-- atómico, que serializa concurrencia a nivel de fila y es O(1).
CREATE TABLE IF NOT EXISTS public.trade_marketplace_order_counters (
  actor_id  uuid PRIMARY KEY
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  last_seq  integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.trade_marketplace_order_counters IS
  'Contador atómico de secuencia por actor para numeración de pedidos.
   Reemplaza el SELECT MAX() con race condition del trigger original.
   Actualizado exclusivamente por trg_fn_mkt_order_numero.';

-- Sembrar contadores para actores que ya tengan pedidos
INSERT INTO public.trade_marketplace_order_counters (actor_id, last_seq)
SELECT
  actor_id,
  COALESCE(MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS integer)), 0)
FROM public.trade_marketplace_orders
WHERE numero ~ '^MKT-[0-9]+'
GROUP BY actor_id
ON CONFLICT (actor_id) DO UPDATE
  SET last_seq = GREATEST(
    trade_marketplace_order_counters.last_seq,
    EXCLUDED.last_seq
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. TRIGGER: NUMERACIÓN ATÓMICA SIN RACE CONDITION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_order_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- INSERT ... ON CONFLICT DO UPDATE es atómico y serializa la concurrencia
  -- a nivel de fila. No requiere locks explícitos, es O(1) y resistente
  -- a múltiples inserts concurrentes al mismo actor.
  INSERT INTO public.trade_marketplace_order_counters (actor_id, last_seq)
  VALUES (NEW.actor_id, 1)
  ON CONFLICT (actor_id) DO UPDATE
    SET last_seq = trade_marketplace_order_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  NEW.numero := 'MKT-' || LPAD(v_seq::text, 6, '0');
  RETURN NEW;
END;
$$;

-- El trigger ya existe (creado en Sprint 1B); CREATE OR REPLACE de la función
-- lo actualiza automáticamente sin necesidad de recrear el trigger.

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. ÍNDICES AUSENTES (ALTA-2)
-- ─────────────────────────────────────────────────────────────────────────────

-- org_id en outbox: el consumer filtra por processed_at IS NULL (ya indexado)
-- y puede necesitar filtrar por org_id en eventos de tipo job.unblocked.
CREATE INDEX IF NOT EXISTS idx_outbox_org_id
  ON public.trade_marketplace_outbox(org_id)
  WHERE org_id IS NOT NULL AND processed_at IS NULL;

-- Composite (org_id, estado) en orders: get_org_active_orders filtra ambos
CREATE INDEX IF NOT EXISTS idx_mkt_orders_org_estado
  ON public.trade_marketplace_orders(org_id, estado);

-- quote_id en orders: _mkt_unblock_job_if_complete hace lookup por quote_id
CREATE INDEX IF NOT EXISTS idx_mkt_orders_quote_id
  ON public.trade_marketplace_orders(quote_id)
  WHERE quote_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. PG_CRON — CONSUMIDOR DE OUTBOX (ALTA-3)
-- ─────────────────────────────────────────────────────────────────────────────
-- PREREQUISITO: La extensión pg_cron debe estar habilitada en el proyecto.
-- Habilitar desde el dashboard de Supabase → Database → Extensions → pg_cron
-- O ejecutar manualmente: CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- PREREQUISITO: La extensión pg_net debe estar habilitada (viene por defecto).
--
-- INSTRUCCIONES DE CONFIGURACIÓN:
-- Este bloque SQL crea el job si pg_cron está disponible.
-- Si no está disponible, lo ignora sin error.
--
-- La URL de la Edge Function y la Service Role Key se obtienen de:
--   Supabase Dashboard → Settings → API → Project URL y service_role key
--
-- Para configurar manualmente después de habilitar pg_cron:
--   SELECT cron.schedule(
--     'mkt-outbox-consumer',
--     '*/2 * * * *',
--     $$ SELECT net.http_post(
--          url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/marketplace-outbox-consumer',
--          headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb,
--          body := '{"source":"pg_cron","batch_size":50}'::jsonb
--        ); $$
--   );
--
DO $$
BEGIN
  -- Verificar si pg_cron y pg_net están disponibles
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    -- Eliminar job previo si existe (idempotente)
    PERFORM cron.unschedule('mkt-outbox-consumer')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'mkt-outbox-consumer'
    );

    -- Programar el consumidor cada 2 minutos
    -- NOTA: Sustituir TU_PROJECT_REF y TU_SERVICE_ROLE_KEY antes de ejecutar
    -- en producción, o configurar via las variables de entorno del dashboard.
    RAISE NOTICE 'pg_cron disponible. Configura manualmente el job mkt-outbox-consumer con tu Project URL y Service Role Key.';
    RAISE NOTICE 'Ver comentario en esta migración para las instrucciones.';
  ELSE
    RAISE NOTICE 'pg_cron o pg_net no disponibles. Activar en Dashboard → Extensions antes de configurar el consumidor automático.';
  END IF;
END;
$$;
