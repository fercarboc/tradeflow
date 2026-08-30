
CREATE OR REPLACE FUNCTION public.bulk_update_offerings(
  p_actor_id         uuid,
  p_ids              uuid[],
  p_activa           boolean DEFAULT NULL,
  p_stock_disponible boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_updated    integer;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN jsonb_build_object('updated', 0);
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Actor no encontrado o inactivo.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_activa IS NOT NULL THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    SELECT o.id, p_actor_id, 'estado',
      jsonb_build_object('activa', o.activa),
      jsonb_build_object('activa', p_activa)
    FROM public.trade_marketplace_supplier_offerings o
    WHERE o.id = ANY(p_ids)
      AND o.supplier_catalog_id = v_catalog_id
      AND o.activa IS DISTINCT FROM p_activa;
  END IF;

  IF p_stock_disponible IS NOT NULL THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    SELECT o.id, p_actor_id, 'stock',
      jsonb_build_object('stock_disponible', o.stock_disponible),
      jsonb_build_object('stock_disponible', p_stock_disponible)
    FROM public.trade_marketplace_supplier_offerings o
    WHERE o.id = ANY(p_ids)
      AND o.supplier_catalog_id = v_catalog_id
      AND o.stock_disponible IS DISTINCT FROM p_stock_disponible;
  END IF;

  UPDATE public.trade_marketplace_supplier_offerings SET
    activa           = COALESCE(p_activa,           activa),
    stock_disponible = COALESCE(p_stock_disponible, stock_disponible),
    updated_at       = now()
  WHERE id = ANY(p_ids)
    AND supplier_catalog_id = v_catalog_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;
;
