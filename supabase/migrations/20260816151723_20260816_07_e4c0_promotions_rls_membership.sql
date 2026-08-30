-- E4.C.0: RLS definitiva para trade_marketplace_promotions
-- Reemplaza policies provisionales tmp_ con membership check real.
-- Usa _is_actor_member(actor_id) (SECURITY DEFINER, search_path=public).
-- WITH CHECK en UPDATE previene mutación de actor_id cross-actor.
-- PUBLICIDAD ≠ RANKING: promotions = descuentos de precio; ad_slots = publicidad. Sistemas separados.

-- Verificar RLS activa en la tabla
ALTER TABLE public.trade_marketplace_promotions ENABLE ROW LEVEL SECURITY;

-- DROP policies provisionales
DROP POLICY IF EXISTS tmp_select_active ON public.trade_marketplace_promotions;
DROP POLICY IF EXISTS tmp_write_service ON public.trade_marketplace_promotions;

-- Admin: acceso total
CREATE POLICY promotions_admin_all
  ON public.trade_marketplace_promotions
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- Proveedor miembro: SELECT solo su actor
CREATE POLICY promotions_supplier_select
  ON public.trade_marketplace_promotions
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public._is_actor_member(actor_id));

-- Proveedor miembro: INSERT solo su actor (WITH CHECK impide insertar en actor ajeno)
CREATE POLICY promotions_supplier_insert
  ON public.trade_marketplace_promotions
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (public._is_actor_member(actor_id));

-- Proveedor miembro: UPDATE solo su actor; WITH CHECK también evita mover a actor_id ajeno
CREATE POLICY promotions_supplier_update
  ON public.trade_marketplace_promotions
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING     (public._is_actor_member(actor_id))
  WITH CHECK (public._is_actor_member(actor_id));

-- Proveedor miembro: DELETE solo su actor
CREATE POLICY promotions_supplier_delete
  ON public.trade_marketplace_promotions
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (public._is_actor_member(actor_id));

-- Post-verificación: 5 policies definitivas en la tabla
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename  = 'trade_marketplace_promotions'
    AND policyname IN (
      'promotions_admin_all',
      'promotions_supplier_select',
      'promotions_supplier_insert',
      'promotions_supplier_update',
      'promotions_supplier_delete'
    );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'E4C0: solo % de 5 policies definitivas creadas', v_count;
  END IF;
END $$;;
