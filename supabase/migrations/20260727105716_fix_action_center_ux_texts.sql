CREATE OR REPLACE FUNCTION public.get_supplier_action_center(p_actor_id uuid)
RETURNS TABLE(tipo text, severidad text, titulo text, descripcion text, count_items integer, cta_label text, cta_target text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_catalog_id      uuid;
  v_pending_orders  integer := 0;
  v_slow_orders     integer := 0;
  v_pending_match   integer := 0;
  v_no_stock        integer := 0;
  v_actor_estado    text;
  v_verify          boolean;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'analytics:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere analytics:read.';
  END IF;

  SELECT supplier_catalog_id, estado, verificado
    INTO v_catalog_id, v_actor_estado, v_verify
    FROM public.trade_marketplace_actors
   WHERE id = p_actor_id;

  SELECT COUNT(*) INTO v_pending_orders
    FROM public.trade_supplier_orders
   WHERE catalog_id = v_catalog_id AND estado = 'enviado';

  SELECT COUNT(*) INTO v_slow_orders
    FROM public.trade_supplier_orders
   WHERE catalog_id = v_catalog_id AND estado = 'confirmado'
     AND updated_at < now() - interval '48 hours';

  SELECT COUNT(*) INTO v_pending_match
    FROM public.trade_marketplace_supplier_offerings
   WHERE supplier_catalog_id = v_catalog_id
     AND match_state IN ('pending_review', 'unmatched')
     AND activa = true;

  SELECT COUNT(*) INTO v_no_stock
    FROM public.trade_marketplace_supplier_offerings
   WHERE supplier_catalog_id = v_catalog_id
     AND activa = true AND match_state = 'matched'
     AND NOT stock_disponible;

  -- UX-003: verificación — solo crítico si la cuenta no está activa (suspendida, etc.)
  --         si está activa pero sin verificar → warning, no critical
  IF v_actor_estado != 'active' OR NOT v_verify THEN
    RETURN QUERY SELECT
      'verificacion_pendiente'::text,
      CASE WHEN v_actor_estado != 'active'
           THEN 'critical'
           ELSE 'warning'
      END::text,
      CASE WHEN v_actor_estado != 'active'
           THEN ('Tu cuenta está ' || v_actor_estado)::text
           ELSE 'Verifica tu cuenta para aparecer en búsquedas'::text
      END,
      CASE WHEN v_actor_estado != 'active'
           THEN 'Contacta con TrabFlow para activar tu cuenta de proveedor.'::text
           ELSE 'Para aparecer en el catálogo público, completa la verificación en Configuración. Los instaladores que ya te conocen pueden seguir haciendo pedidos con normalidad.'::text
      END,
      1::integer,
      'Ir a Configuración'::text,
      'config'::text;
  END IF;

  IF v_pending_orders > 0 THEN
    RETURN QUERY SELECT
      'pedidos_pendientes'::text,
      CASE WHEN v_pending_orders >= 3 THEN 'critical' ELSE 'warning' END::text,
      (v_pending_orders || ' pedido' || CASE WHEN v_pending_orders > 1 THEN 's' ELSE '' END || ' sin confirmar')::text,
      'Los instaladores esperan tu confirmación. Responde en menos de 24h para mantener un buen score.'::text,
      v_pending_orders::integer,
      'Ver pedidos'::text,
      'pedidos'::text;
  END IF;

  IF v_slow_orders > 0 THEN
    RETURN QUERY SELECT
      'pedidos_lentos'::text,
      'warning'::text,
      (v_slow_orders || ' pedido' || CASE WHEN v_slow_orders > 1 THEN 's confirmados sin actualizar' ELSE ' confirmado sin actualizar' END)::text,
      'Hay pedidos confirmados hace más de 48h sin marcarse como preparando o enviado.'::text,
      v_slow_orders::integer,
      'Ver pedidos'::text,
      'pedidos'::text;
  END IF;

  -- UX-002: productos sin vincular — título y descripción más claros
  IF v_pending_match > 0 THEN
    RETURN QUERY SELECT
      'productos_sin_vincular'::text,
      CASE WHEN v_pending_match >= 20 THEN 'warning' ELSE 'info' END::text,
      (v_pending_match || ' producto' || CASE WHEN v_pending_match > 1 THEN 's sin vincular al Motor IA' ELSE ' sin vincular al Motor IA' END)::text,
      'Vincula tus productos al catálogo para que el Motor IA los recomiende automáticamente a los instaladores cuando preparan presupuestos.'::text,
      v_pending_match::integer,
      'Vincular ahora'::text,
      'catalogo'::text;
  END IF;

  IF v_no_stock > 0 THEN
    RETURN QUERY SELECT
      'sin_stock'::text,
      'info'::text,
      (v_no_stock || ' producto' || CASE WHEN v_no_stock > 1 THEN 's sin stock' ELSE ' sin stock' END)::text,
      'Productos activos sin stock disponible. Actualiza el estado para evitar pedidos fallidos.'::text,
      v_no_stock::integer,
      'Ver catálogo'::text,
      'catalogo'::text;
  END IF;

  RETURN;
END;
$function$;;
