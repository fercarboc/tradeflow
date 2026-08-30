
-- Actualizar get_order_full_detail para incluir buyer_snapshot,
-- source_ref, source_type (del carrito) y quote_descripcion (join live)
CREATE OR REPLACE FUNCTION public.get_order_full_detail(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  RECORD;
  v_result jsonb;
BEGIN
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  WHERE o.id = p_order_id
    AND (
      EXISTS (SELECT 1 FROM public.trade_org_members m WHERE m.org_id = o.org_id AND m.user_id = auth.uid())
      OR public._mkt_supplier_member_check(o.actor_id)
    )
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido no encontrado o sin acceso.';
  END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object(
      'id',                       v_order.id,
      'numero',                   v_order.numero,
      'estado',                   v_order.estado,
      'actor_id',                 v_order.actor_id,
      'actor_nombre',             a.nombre,
      'actor_verificado',         a.verificado,
      'org_id',                   v_order.org_id,
      'subtotal',                 v_order.subtotal,
      'coste_envio',              v_order.coste_envio,
      'total',                    v_order.total,
      'notas',                    v_order.notas,
      'notas_proveedor',          v_order.notas_proveedor,
      'tracking_ref',             v_order.tracking_ref,
      'tracking_url',             v_order.tracking_url,
      'delivery_address',         v_order.delivery_address,
      'delivery_method',          v_order.delivery_method,
      'payment_method',           v_order.payment_method,
      'delivery_notas',           v_order.delivery_notas,
      'direccion_entrega',        v_order.direccion_entrega,
      'pickup_location_id',       v_order.pickup_location_id,
      'pickup_location_snapshot', v_order.pickup_location_snapshot,
      'buyer_snapshot',           v_order.buyer_snapshot,
      'source_ref',               mc.source_ref,
      'source_type',              mc.source_type,
      'quote_descripcion',        q.descripcion,
      'cancel_reason',            v_order.cancel_reason,
      'created_at',               v_order.created_at,
      'confirmed_at',             v_order.confirmed_at,
      'preparing_at',             v_order.preparing_at,
      'shipped_at',               v_order.shipped_at,
      'delivered_at',             v_order.delivered_at,
      'cancelled_at',             v_order.cancelled_at,
      'completed_at',             v_order.completed_at
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             oi.id,
        'referencia',     oi.referencia,
        'descripcion',    oi.descripcion,
        'unidad',         oi.unidad,
        'cantidad',       oi.cantidad,
        'precio_unitario',oi.precio_unitario,
        'precio_total',   oi.precio_total
      ) ORDER BY oi.created_at)
      FROM public.trade_marketplace_order_items oi
      WHERE oi.order_id = p_order_id
    ), '[]'),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',          ev.id,
        'tipo',        ev.tipo,
        'from_estado', ev.from_estado,
        'to_estado',   ev.to_estado,
        'actor_type',  ev.actor_type,
        'notas',       ev.notas,
        'created_at',  ev.created_at
      ) ORDER BY ev.created_at DESC)
      FROM public.trade_marketplace_order_events ev
      WHERE ev.order_id = p_order_id
    ), '[]'),
    'supplier_config', (
      SELECT jsonb_build_object(
        'horario_entrega',      cfg.horario_entrega,
        'mensaje_instaladores', cfg.mensaje_instaladores,
        'permite_recogida',     cfg.permite_recogida
      )
      FROM public.trade_marketplace_supplier_config cfg
      WHERE cfg.actor_id = v_order.actor_id
    )
  ) INTO v_result
  FROM public.trade_marketplace_actors a
  LEFT JOIN public.trade_marketplace_carts mc ON mc.id = v_order.cart_id_v2
  LEFT JOIN public.trade_quotes q ON q.id = v_order.quote_id
  WHERE a.id = v_order.actor_id;

  RETURN v_result;
END;
$$;
;
