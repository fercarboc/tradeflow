
-- ═══════════════════════════════════════════════════════════════════════════════
-- RC1-C.3 — Checkout Multiproveedor: entrega, dirección, pago, checkout_cart_v2
-- ═══════════════════════════════════════════════════════════════════════════════

-- 01. PUNTOS DE RECOGIDA DEL PROVEEDOR
CREATE TABLE IF NOT EXISTS public.trade_marketplace_supplier_pickup_points (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  nombre        text        NOT NULL,
  direccion     jsonb       NOT NULL DEFAULT '{}',
  telefono      text,
  activo        boolean     NOT NULL DEFAULT true,
  orden         integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_supplier_pickup_points IS
  'Puntos de recogida activos de cada proveedor. Mostrados en el checkout cuando el proveedor permite recogida.';

CREATE INDEX IF NOT EXISTS idx_pickup_actor ON public.trade_marketplace_supplier_pickup_points(actor_id, activo);

ALTER TABLE public.trade_marketplace_supplier_pickup_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pickup_public_read" ON public.trade_marketplace_supplier_pickup_points;
CREATE POLICY "pickup_public_read" ON public.trade_marketplace_supplier_pickup_points
  FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "pickup_supplier_manage" ON public.trade_marketplace_supplier_pickup_points;
CREATE POLICY "pickup_supplier_manage" ON public.trade_marketplace_supplier_pickup_points
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_actor_members am
      WHERE am.actor_id = trade_marketplace_supplier_pickup_points.actor_id
        AND am.user_id = auth.uid() AND am.activo = true
    )
  );

-- 02. AMPLIAR trade_marketplace_supplier_config
ALTER TABLE public.trade_marketplace_supplier_config
  ADD COLUMN IF NOT EXISTS payment_methods_allowed  text[]
    NOT NULL DEFAULT ARRAY['cuenta_proveedor','transferencia'],
  ADD COLUMN IF NOT EXISTS permite_coordinar_entrega boolean NOT NULL DEFAULT true;

-- 03. AMPLIAR trade_marketplace_orders
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS cart_id_v2        uuid
    REFERENCES public.trade_marketplace_carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method   text
    CONSTRAINT chk_delivery_method CHECK (
      delivery_method IN ('entrega_obra','entrega_almacen','recogida_proveedor','por_coordinar')
      OR delivery_method IS NULL),
  ADD COLUMN IF NOT EXISTS pickup_point_id   uuid
    REFERENCES public.trade_marketplace_supplier_pickup_points(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_snapshot    jsonb,
  ADD COLUMN IF NOT EXISTS payment_method    text
    CONSTRAINT chk_payment_method CHECK (
      payment_method IN ('cuenta_proveedor','transferencia','pago_recoger','online','domiciliacion')
      OR payment_method IS NULL),
  ADD COLUMN IF NOT EXISTS delivery_notas    text,
  ADD COLUMN IF NOT EXISTS checkout_key      text;

-- 04. RPC — CONFIGURACIÓN DE CHECKOUT POR PROVEEDOR
CREATE OR REPLACE FUNCTION public.get_supplier_checkout_config(p_actor_ids uuid[])
RETURNS TABLE (
  actor_id                uuid,
  actor_nombre            text,
  actor_verificado        boolean,
  permite_entrega         boolean,
  permite_recogida        boolean,
  permite_coordinar       boolean,
  payment_methods_allowed text[],
  portes_gratis_desde     numeric,
  coste_portes            numeric,
  plazo_entrega_dias      integer,
  plazo_confirmacion_h    integer,
  mensaje_instaladores    text,
  pickup_points           jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.nombre,
    a.verificado,
    COALESCE(cfg.permite_entrega, true),
    COALESCE(cfg.permite_recogida, false),
    COALESCE(cfg.permite_coordinar_entrega, true),
    COALESCE(cfg.payment_methods_allowed, ARRAY['cuenta_proveedor','transferencia']),
    cfg.portes_gratis_desde,
    cfg.coste_portes,
    COALESCE(cfg.plazo_entrega_dias, 5),
    COALESCE(cfg.plazo_confirmacion_h, 24),
    cfg.mensaje_instaladores,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',       pp.id,
            'nombre',   pp.nombre,
            'direccion', pp.direccion,
            'telefono', pp.telefono,
            'orden',    pp.orden
          ) ORDER BY pp.orden, pp.nombre
        )
        FROM public.trade_marketplace_supplier_pickup_points pp
        WHERE pp.actor_id = a.id AND pp.activo = true
      ),
      '[]'::jsonb
    )
  FROM public.trade_marketplace_actors a
  LEFT JOIN public.trade_marketplace_supplier_config cfg ON cfg.actor_id = a.id
  WHERE a.id = ANY(p_actor_ids)
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_checkout_config(uuid[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_supplier_checkout_config(uuid[]) TO authenticated;

-- 05. RPC — CHECKOUT V2
CREATE OR REPLACE FUNCTION public.checkout_cart_v2(
  p_cart_id        uuid,
  p_delivery_data  jsonb DEFAULT '{}',
  p_buyer_snapshot jsonb DEFAULT '{}',
  p_checkout_key   text  DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart          RECORD;
  v_actor         RECORD;
  v_order_id      uuid;
  v_order_ids     uuid[] := '{}';
  v_existing_ids  uuid[];
  v_grand_total   numeric;
  v_source_quote_id uuid;
  v_actor_delivery jsonb;
  v_delivery_method text;
  v_delivery_addr   jsonb;
  v_pickup_point_id uuid;
  v_payment_method  text;
  v_delivery_notas  text;
  v_portes          numeric;
  v_cfg             RECORD;
BEGIN
  -- Idempotencia: si ya existe un pedido con este checkout_key, devolver sus IDs
  IF p_checkout_key IS NOT NULL THEN
    SELECT array_agg(mo.id) INTO v_existing_ids
    FROM public.trade_marketplace_orders mo
    WHERE mo.checkout_key = p_checkout_key
      AND mo.org_id IN (
        SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
      );
    IF array_length(v_existing_ids, 1) > 0 THEN
      RETURN v_existing_ids;
    END IF;
  END IF;

  -- Verificar acceso y que el carrito esté activo
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado.';
  END IF;

  -- Carrito ya procesado → devolver los pedidos existentes de este carrito
  IF v_cart.estado = 'ordered' THEN
    SELECT array_agg(mo.id) INTO v_existing_ids
    FROM public.trade_marketplace_orders mo
    WHERE (mo.cart_id = p_cart_id OR mo.cart_id_v2 = p_cart_id);
    IF array_length(v_existing_ids, 1) > 0 THEN
      RETURN v_existing_ids;
    END IF;
  END IF;

  IF v_cart.estado NOT IN ('active', 'reviewing') THEN
    RAISE EXCEPTION 'CART_NOT_READY: El carrito no está en estado activo (estado: %)', v_cart.estado;
  END IF;

  -- Verificar que hay ítems con proveedor
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_cart_items
    WHERE cart_id = p_cart_id AND activo = true AND selected_actor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'NO_ITEMS: No hay ítems con proveedor seleccionado.';
  END IF;

  -- Revalidación: actores activos
  IF EXISTS (
    SELECT 1
    FROM public.trade_marketplace_cart_items ci
    JOIN public.trade_marketplace_actors a ON a.id = ci.selected_actor_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
      AND a.activo = false
  ) THEN
    RAISE EXCEPTION 'ACTOR_INACTIVE: Uno o más proveedores seleccionados ya no están activos.';
  END IF;

  -- Revalidación: offerings activas
  IF EXISTS (
    SELECT 1
    FROM public.trade_marketplace_cart_items ci
    JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_offering_id IS NOT NULL
      AND o.activo = false
  ) THEN
    RAISE EXCEPTION 'OFFERING_INACTIVE: Una o más offerings seleccionadas ya no están disponibles.';
  END IF;

  -- Obtener quote_id si la fuente es un presupuesto
  IF v_cart.source_type = 'quote' THEN
    v_source_quote_id := v_cart.source_id;
  END IF;

  -- Marcar carrito en proceso
  UPDATE public.trade_marketplace_carts SET estado = 'checkout', updated_at = now()
  WHERE id = p_cart_id;

  -- Crear un pedido por proveedor
  FOR v_actor IN
    SELECT DISTINCT ci.selected_actor_id AS actor_id
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  LOOP
    -- Subtotal del proveedor
    SELECT COALESCE(SUM(ci.total_linea), 0) INTO v_grand_total
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    -- Portes
    v_portes := 0;
    SELECT cfg.coste_portes, cfg.portes_gratis_desde INTO v_cfg
    FROM public.trade_marketplace_supplier_config cfg WHERE cfg.actor_id = v_actor.actor_id;
    IF v_cfg.portes_gratis_desde IS NULL OR v_grand_total < v_cfg.portes_gratis_desde THEN
      v_portes := COALESCE(v_cfg.coste_portes, 0);
    END IF;

    -- Datos de entrega para este actor
    v_actor_delivery  := COALESCE(p_delivery_data->>(v_actor.actor_id::text), '{}');
    v_delivery_method := v_actor_delivery->>'delivery_method';
    v_delivery_addr   := CASE
      WHEN v_actor_delivery ? 'delivery_address' THEN v_actor_delivery->'delivery_address'
      ELSE NULL
    END;
    v_pickup_point_id := CASE
      WHEN v_actor_delivery->>'pickup_point_id' IS NOT NULL
      THEN (v_actor_delivery->>'pickup_point_id')::uuid
      ELSE NULL
    END;
    v_payment_method  := v_actor_delivery->>'payment_method';
    v_delivery_notas  := v_actor_delivery->>'notas';

    -- Insertar pedido
    INSERT INTO public.trade_marketplace_orders (
      actor_id, org_id, estado, subtotal, coste_envio, total,
      quote_id, cart_id, cart_id_v2,
      delivery_method, direccion_entrega, pickup_point_id,
      buyer_snapshot, payment_method, delivery_notas, checkout_key
    ) VALUES (
      v_actor.actor_id, v_cart.org_id,
      'pending',
      v_grand_total, v_portes, v_grand_total + v_portes,
      v_source_quote_id, p_cart_id, p_cart_id,
      v_delivery_method, v_delivery_addr, v_pickup_point_id,
      p_buyer_snapshot, v_payment_method, v_delivery_notas, p_checkout_key
    ) RETURNING id INTO v_order_id;

    -- Líneas del pedido (snapshot inmutable)
    INSERT INTO public.trade_marketplace_order_items (
      order_id, offering_id, universal_product_id,
      referencia, descripcion, unidad, cantidad, precio_unitario
    )
    SELECT
      v_order_id,
      ci.selected_offering_id,
      ci.universal_product_id,
      o.supplier_ref,
      COALESCE(ci.descripcion_compra, ci.descripcion_original),
      ci.unidad,
      ci.cantidad,
      COALESCE(ci.precio_unitario_final, 0)
    FROM public.trade_marketplace_cart_items ci
    LEFT JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    -- Notificación al proveedor
    INSERT INTO public.trade_marketplace_notifications (actor_id, tipo, titulo, cuerpo, ref_id, ref_tipo)
    VALUES (
      v_actor.actor_id, 'order_received',
      'Nuevo pedido recibido',
      'Has recibido un nuevo pedido desde el Marketplace de TrabFlow.',
      v_order_id, 'marketplace_order'
    );

    -- Evento de auditoría
    INSERT INTO public.trade_marketplace_order_events (
      order_id, tipo, from_estado, to_estado, actor_type, payload
    ) VALUES (
      v_order_id, 'order_created', NULL, 'pending', 'system',
      jsonb_build_object(
        'cart_id',         p_cart_id,
        'checkout_key',    p_checkout_key,
        'delivery_method', v_delivery_method,
        'payment_method',  v_payment_method,
        'source_type',     v_cart.source_type,
        'source_ref',      v_cart.source_ref
      )
    );

    -- Outbox
    INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
    VALUES (
      v_actor.actor_id, v_cart.org_id, 'order.created',
      jsonb_build_object(
        'order_id',        v_order_id,
        'cart_id',         p_cart_id,
        'org_id',          v_cart.org_id,
        'delivery_method', v_delivery_method,
        'payment_method',  v_payment_method
      )
    );

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  -- Marcar material_order_placed en quote_items vinculados
  IF v_source_quote_id IS NOT NULL THEN
    UPDATE public.trade_quote_items SET material_order_placed = true
    WHERE quote_id = v_source_quote_id
      AND id IN (
        SELECT ci.source_item_id FROM public.trade_marketplace_cart_items ci
        WHERE ci.cart_id = p_cart_id AND ci.source_item_type = 'quote_item'
          AND ci.activo = true AND ci.source_item_id IS NOT NULL
      );
  END IF;

  -- Marcar carrito como ordenado
  UPDATE public.trade_marketplace_carts
  SET estado = 'ordered', ordered_at = now(), updated_at = now()
  WHERE id = p_cart_id;

  RETURN v_order_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checkout_cart_v2(uuid,jsonb,jsonb,text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.checkout_cart_v2(uuid,jsonb,jsonb,text) TO authenticated;

-- 06. RPC — ESTADO DE PEDIDOS POR IDS
CREATE OR REPLACE FUNCTION public.get_orders_by_ids(p_order_ids uuid[])
RETURNS TABLE (
  order_id         uuid,
  numero           text,
  actor_nombre     text,
  actor_verificado boolean,
  estado           text,
  total            numeric,
  items_count      bigint,
  delivery_method  text,
  delivery_address jsonb,
  pickup_point_id  uuid,
  payment_method   text,
  created_at       timestamptz,
  confirmed_at     timestamptz,
  shipped_at       timestamptz,
  completed_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    mo.id, mo.numero, a.nombre, a.verificado,
    mo.estado, mo.total,
    COUNT(oi.id) AS items_count,
    mo.delivery_method, mo.direccion_entrega, mo.pickup_point_id, mo.payment_method,
    mo.created_at, mo.confirmed_at, mo.shipped_at, mo.completed_at
  FROM public.trade_marketplace_orders mo
  JOIN public.trade_marketplace_actors a ON a.id = mo.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = mo.id
  WHERE mo.id = ANY(p_order_ids)
    AND mo.org_id IN (
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
    )
  GROUP BY mo.id, a.nombre, a.verificado
  ORDER BY mo.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_ids(uuid[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_orders_by_ids(uuid[]) TO authenticated;
;
