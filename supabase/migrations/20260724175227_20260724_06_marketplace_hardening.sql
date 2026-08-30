-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE HARDENING — Production fixes (Phase 1 / Audit findings)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_marketplace_order_counters (
  actor_id  uuid PRIMARY KEY REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  last_seq  integer NOT NULL DEFAULT 0
);

INSERT INTO public.trade_marketplace_order_counters (actor_id, last_seq)
SELECT actor_id, COALESCE(MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS integer)), 0)
FROM public.trade_marketplace_orders WHERE numero ~ '^MKT-[0-9]+'
GROUP BY actor_id
ON CONFLICT (actor_id) DO UPDATE SET last_seq = GREATEST(trade_marketplace_order_counters.last_seq, EXCLUDED.last_seq);

CREATE OR REPLACE FUNCTION public.trg_fn_mkt_order_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq integer;
BEGIN
  INSERT INTO public.trade_marketplace_order_counters (actor_id, last_seq)
  VALUES (NEW.actor_id, 1)
  ON CONFLICT (actor_id) DO UPDATE SET last_seq = trade_marketplace_order_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  NEW.numero := 'MKT-' || LPAD(v_seq::text, 6, '0');
  RETURN NEW;
END; $$;

CREATE INDEX IF NOT EXISTS idx_outbox_org_id ON public.trade_marketplace_outbox(org_id) WHERE org_id IS NOT NULL AND processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_orders_org_estado ON public.trade_marketplace_orders(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_mkt_orders_quote_id ON public.trade_marketplace_orders(quote_id) WHERE quote_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mkt-outbox-consumer') THEN
      PERFORM cron.unschedule('mkt-outbox-consumer');
    END IF;
    RAISE NOTICE 'pg_cron disponible. Configura manualmente el job mkt-outbox-consumer.';
  ELSE
    RAISE NOTICE 'pg_cron o pg_net no disponibles.';
  END IF;
END; $$;;
