-- Sprint Guest-1 · Migración 11
-- Objetivo: RLS completo para todas las tablas nuevas
-- C5: USING + WITH CHECK separados; SELECT/INSERT/UPDATE/DELETE auditados individualmente
-- Correcciones aplicadas:
--   · activo (boolean) en trade_marketplace_actor_members — no 'estado'
--   · _user_org_ids() ya existe con firma uuid[] → NO se redefine; usar = ANY(...)
--   · guest tables sin políticas → solo service_role puede acceder

ALTER TABLE public.trade_marketplace_offering_promos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_actor_org_conditions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_actor_org_condition_prices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_guest_customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_guest_antifraud_signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_guest_sessions                ENABLE ROW LEVEL SECURITY;

-- ── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._actor_id_for_offering(p_offering_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id
  FROM public.trade_marketplace_actors a
  JOIN public.trade_marketplace_supplier_offerings o
    ON o.supplier_catalog_id = a.supplier_catalog_id
  WHERE o.id = p_offering_id
  LIMIT 1;
$$;

-- activo boolean (no 'estado')
CREATE OR REPLACE FUNCTION public._is_actor_member(p_actor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members m
    WHERE m.actor_id = p_actor_id AND m.user_id = auth.uid() AND m.activo = true
  );
$$;

-- _user_org_ids() ya existe en BD con tipo uuid[] — NO se redefine.
-- Se usa = ANY(public._user_org_ids()) en todas las políticas.

-- ── trade_marketplace_offering_promos ────────────────────────────────────────

DROP POLICY IF EXISTS "promos_select_public"       ON public.trade_marketplace_offering_promos;
DROP POLICY IF EXISTS "promos_insert_actor_member" ON public.trade_marketplace_offering_promos;
DROP POLICY IF EXISTS "promos_update_actor_member" ON public.trade_marketplace_offering_promos;
DROP POLICY IF EXISTS "promos_delete_actor_member" ON public.trade_marketplace_offering_promos;

CREATE POLICY "promos_select_public"
  ON public.trade_marketplace_offering_promos FOR SELECT
  USING (activa = true AND valid_until > now());

CREATE POLICY "promos_insert_actor_member"
  ON public.trade_marketplace_offering_promos FOR INSERT
  WITH CHECK (public._is_actor_member(public._actor_id_for_offering(offering_id)));

CREATE POLICY "promos_update_actor_member"
  ON public.trade_marketplace_offering_promos FOR UPDATE
  USING  (public._is_actor_member(public._actor_id_for_offering(offering_id)))
  WITH CHECK (public._is_actor_member(public._actor_id_for_offering(offering_id)));

CREATE POLICY "promos_delete_actor_member"
  ON public.trade_marketplace_offering_promos FOR DELETE
  USING (public._is_actor_member(public._actor_id_for_offering(offering_id)));

-- ── trade_marketplace_actor_org_conditions ───────────────────────────────────
-- notas_internas: visible en RLS pero se omite en funciones de lectura de org (Sprint Guest-2)

DROP POLICY IF EXISTS "conditions_select_own_org" ON public.trade_marketplace_actor_org_conditions;
DROP POLICY IF EXISTS "conditions_insert_actor"   ON public.trade_marketplace_actor_org_conditions;
DROP POLICY IF EXISTS "conditions_update_actor"   ON public.trade_marketplace_actor_org_conditions;
DROP POLICY IF EXISTS "conditions_delete_actor"   ON public.trade_marketplace_actor_org_conditions;

CREATE POLICY "conditions_select_own_org"
  ON public.trade_marketplace_actor_org_conditions FOR SELECT
  USING (
    org_id = ANY(public._user_org_ids())
    OR public._is_actor_member(actor_id)
  );

CREATE POLICY "conditions_insert_actor"
  ON public.trade_marketplace_actor_org_conditions FOR INSERT
  WITH CHECK (public._is_actor_member(actor_id));

CREATE POLICY "conditions_update_actor"
  ON public.trade_marketplace_actor_org_conditions FOR UPDATE
  USING  (public._is_actor_member(actor_id))
  WITH CHECK (public._is_actor_member(actor_id));

CREATE POLICY "conditions_delete_actor"
  ON public.trade_marketplace_actor_org_conditions FOR DELETE
  USING (public._is_actor_member(actor_id));

-- ── trade_marketplace_actor_org_condition_prices ─────────────────────────────

DROP POLICY IF EXISTS "cond_prices_select"        ON public.trade_marketplace_actor_org_condition_prices;
DROP POLICY IF EXISTS "cond_prices_insert_actor"  ON public.trade_marketplace_actor_org_condition_prices;
DROP POLICY IF EXISTS "cond_prices_update_actor"  ON public.trade_marketplace_actor_org_condition_prices;
DROP POLICY IF EXISTS "cond_prices_delete_actor"  ON public.trade_marketplace_actor_org_condition_prices;

CREATE POLICY "cond_prices_select"
  ON public.trade_marketplace_actor_org_condition_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_actor_org_conditions c
      WHERE c.id = condition_id AND (
        c.org_id = ANY(public._user_org_ids())
        OR public._is_actor_member(c.actor_id)
      )
    )
  );

CREATE POLICY "cond_prices_insert_actor"
  ON public.trade_marketplace_actor_org_condition_prices FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.trade_marketplace_actor_org_conditions c
            WHERE c.id = condition_id AND public._is_actor_member(c.actor_id))
  );

CREATE POLICY "cond_prices_update_actor"
  ON public.trade_marketplace_actor_org_condition_prices FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.trade_marketplace_actor_org_conditions c
            WHERE c.id = condition_id AND public._is_actor_member(c.actor_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.trade_marketplace_actor_org_conditions c
            WHERE c.id = condition_id AND public._is_actor_member(c.actor_id))
  );

CREATE POLICY "cond_prices_delete_actor"
  ON public.trade_marketplace_actor_org_condition_prices FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.trade_marketplace_actor_org_conditions c
            WHERE c.id = condition_id AND public._is_actor_member(c.actor_id))
  );

-- ── guest tables: sin políticas → solo service_role ──────────────────────────
-- trade_marketplace_guest_customers, guest_antifraud_signals, guest_sessions:
-- RLS habilitado sin ninguna política → bloqueado para anon y authenticated.
-- Acceso exclusivo vía service_role (Edge Function checkout-guest, Sprint Guest-2).

-- ── trade_marketplace_orders: SELECT para org compradora ─────────────────────

DROP POLICY IF EXISTS "mkt_orders_select_org" ON public.trade_marketplace_orders;
CREATE POLICY "mkt_orders_select_org"
  ON public.trade_marketplace_orders FOR SELECT
  USING (
    org_id IS NOT NULL
    AND org_id = ANY(public._user_org_ids())
  );

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP POLICY IF EXISTS "promos_select_public"          ON public.trade_marketplace_offering_promos;
-- DROP POLICY IF EXISTS "promos_insert_actor_member"    ON public.trade_marketplace_offering_promos;
-- DROP POLICY IF EXISTS "promos_update_actor_member"    ON public.trade_marketplace_offering_promos;
-- DROP POLICY IF EXISTS "promos_delete_actor_member"    ON public.trade_marketplace_offering_promos;
-- DROP POLICY IF EXISTS "conditions_select_own_org"     ON public.trade_marketplace_actor_org_conditions;
-- DROP POLICY IF EXISTS "conditions_insert_actor"       ON public.trade_marketplace_actor_org_conditions;
-- DROP POLICY IF EXISTS "conditions_update_actor"       ON public.trade_marketplace_actor_org_conditions;
-- DROP POLICY IF EXISTS "conditions_delete_actor"       ON public.trade_marketplace_actor_org_conditions;
-- DROP POLICY IF EXISTS "cond_prices_select"            ON public.trade_marketplace_actor_org_condition_prices;
-- DROP POLICY IF EXISTS "cond_prices_insert_actor"      ON public.trade_marketplace_actor_org_condition_prices;
-- DROP POLICY IF EXISTS "cond_prices_update_actor"      ON public.trade_marketplace_actor_org_condition_prices;
-- DROP POLICY IF EXISTS "cond_prices_delete_actor"      ON public.trade_marketplace_actor_org_condition_prices;
-- DROP POLICY IF EXISTS "mkt_orders_select_org"         ON public.trade_marketplace_orders;
-- DROP FUNCTION IF EXISTS public._actor_id_for_offering(uuid);
-- DROP FUNCTION IF EXISTS public._is_actor_member(uuid);
-- COMMIT;
