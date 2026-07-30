-- MVP-4: Portal de pedidos del proveedor — nuevas funciones SQL

-- ── 1. get_supplier_order_detail ──────────────────────────────────────────────
-- Valida que el pedido pertenece al actor y que el caller es miembro, luego
-- delega en get_order_full_detail (que ya construye el JSONB completo).
CREATE OR REPLACE FUNCTION public.get_supplier_order_detail(
  p_actor_id uuid,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_orders
    WHERE id = p_order_id AND actor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido no encontrado o sin acceso.';
  END IF;

  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  RETURN public.get_order_full_detail(p_order_id);
END;
$$;

-- ── 2. get_supplier_order_alerts ──────────────────────────────────────────────
-- Devuelve contadores de alertas para el panel de avisos del portal.
-- pending_urgent:  pending con más de 4 h sin respuesta
-- atrasados:       confirmed/preparing con más de 72 h transcurridas
CREATE OR REPLACE FUNCTION public.get_supplier_order_alerts(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT jsonb_build_object(
    'pending_count',  COUNT(*) FILTER (WHERE estado = 'pending'),
    'pending_urgent', COUNT(*) FILTER (
      WHERE estado = 'pending' AND created_at < now() - interval '4 hours'
    ),
    'atrasados', COUNT(*) FILTER (
      WHERE estado IN ('confirmed','preparing')
        AND created_at < now() - interval '72 hours'
    )
  )
  INTO v_result
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id
    AND estado NOT IN ('delivered','completed','cancelled');

  RETURN v_result;
END;
$$;

-- ── 3. cancel_supplier_order ──────────────────────────────────────────────────
-- El proveedor puede cancelar un pedido en estado pending o confirmed.
-- El trigger trg_log_order_state_change registra el cambio de estado automáticamente.
CREATE OR REPLACE FUNCTION public.cancel_supplier_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_reason   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT org_id INTO v_org_id
  FROM public.trade_marketplace_orders
  WHERE id = p_order_id
    AND actor_id = p_actor_id
    AND estado IN ('pending','confirmed');

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido no encontrado, sin acceso o estado no cancelable.';
  END IF;

  UPDATE public.trade_marketplace_orders
  SET estado       = 'cancelled',
      cancelled_at = now(),
      cancel_reason = p_reason,
      updated_at   = now()
  WHERE id = p_order_id;

  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (
    p_actor_id, v_org_id, 'order.cancelled_by_supplier',
    jsonb_build_object(
      'order_id',     p_order_id,
      'reason',       p_reason,
      'cancelled_by', auth.uid()
    )
  );
END;
$$;

-- ── 4. mark_supplier_order_incident ──────────────────────────────────────────
-- Inserta un evento de tipo incident_reported sin cambiar el estado del pedido.
CREATE OR REPLACE FUNCTION public.mark_supplier_order_incident(
  p_order_id    uuid,
  p_actor_id    uuid,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_orders
    WHERE id = p_order_id AND actor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido no encontrado.';
  END IF;

  INSERT INTO public.trade_marketplace_order_events
    (order_id, tipo, actor_type, actor_user_id, notas, payload)
  VALUES (
    p_order_id, 'incident_reported', 'supplier', auth.uid(), p_description,
    jsonb_build_object('reported_at', now(), 'reported_by', auth.uid())
  );
END;
$$;

-- ── 5. bulk_confirm_supplier_orders ──────────────────────────────────────────
-- Confirma en bloque todos los pedidos pending que pertenezcan al actor.
-- El trigger auto-registra el cambio de estado. Devuelve el número confirmado.
CREATE OR REPLACE FUNCTION public.bulk_confirm_supplier_orders(
  p_actor_id  uuid,
  p_order_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  WITH updated AS (
    UPDATE public.trade_marketplace_orders
    SET estado       = 'confirmed',
        confirmed_at = now(),
        updated_at   = now()
    WHERE id        = ANY(p_order_ids)
      AND actor_id  = p_actor_id
      AND estado    = 'pending'
    RETURNING id, org_id
  )
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  SELECT
    p_actor_id, u.org_id, 'order.confirmed',
    jsonb_build_object(
      'order_id',     u.id,
      'source',       'marketplace',
      'confirmed_by', auth.uid(),
      'bulk',         true
    )
  FROM updated u;

  -- ROW_COUNT refleja las filas del INSERT, que iguala las del UPDATE
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 6. bulk_ship_supplier_orders ─────────────────────────────────────────────
-- Marca como enviados en bloque pedidos en estado confirmed o preparing.
-- Devuelve el número de pedidos actualizados.
CREATE OR REPLACE FUNCTION public.bulk_ship_supplier_orders(
  p_actor_id  uuid,
  p_order_ids uuid[],
  p_tracking  text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  WITH updated AS (
    UPDATE public.trade_marketplace_orders
    SET estado       = 'shipped',
        shipped_at   = now(),
        tracking_ref = COALESCE(p_tracking, tracking_ref),
        updated_at   = now()
    WHERE id        = ANY(p_order_ids)
      AND actor_id  = p_actor_id
      AND estado    IN ('confirmed','preparing')
    RETURNING id, org_id
  )
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  SELECT
    p_actor_id, u.org_id, 'order.shipped',
    jsonb_build_object(
      'order_id',     u.id,
      'source',       'marketplace',
      'tracking_ref', p_tracking,
      'bulk',         true
    )
  FROM updated u;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
