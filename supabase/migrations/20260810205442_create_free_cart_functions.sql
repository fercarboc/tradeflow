
-- Crea un carrito libre (source_type='free') para compras sin presupuesto
CREATE OR REPLACE FUNCTION public.create_free_cart(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type)
  VALUES (p_org_id, auth.uid(), 'free')
  RETURNING id INTO v_cart_id;
  RETURN v_cart_id;
END;
$$;

-- Inserta en bloque los ítems del carrito local al carrito servidor
-- p_items: [{descripcion, cantidad, unidad, universal_product_id, offering_id, actor_id, precio_unitario}]
CREATE OR REPLACE FUNCTION public.add_free_cart_items(
  p_cart_id uuid,
  p_items   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  -- Verificar que el carrito pertenece al usuario y es de tipo free
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_carts
    WHERE id = p_cart_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Carrito no válido o sin permisos';
  END IF;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id,
    descripcion_original,
    cantidad,
    unidad,
    universal_product_id,
    selected_offering_id,
    selected_actor_id,
    precio_unitario_final,
    total_linea,
    provider_alternatives,
    activo
  )
  SELECT
    p_cart_id,
    (item->>'descripcion')::text,
    (item->>'cantidad')::numeric,
    COALESCE(NULLIF(item->>'unidad', ''), 'ud'),
    CASE WHEN (item->>'universal_product_id') IS NOT NULL AND (item->>'universal_product_id') <> ''
         THEN (item->>'universal_product_id')::uuid ELSE NULL END,
    CASE WHEN (item->>'offering_id') IS NOT NULL AND (item->>'offering_id') <> ''
         THEN (item->>'offering_id')::uuid ELSE NULL END,
    CASE WHEN (item->>'actor_id') IS NOT NULL AND (item->>'actor_id') <> ''
         THEN (item->>'actor_id')::uuid ELSE NULL END,
    CASE WHEN (item->>'precio_unitario') IS NOT NULL AND (item->>'precio_unitario') <> ''
         THEN (item->>'precio_unitario')::numeric ELSE NULL END,
    CASE WHEN (item->>'cantidad') IS NOT NULL AND (item->>'precio_unitario') IS NOT NULL
              AND (item->>'cantidad') <> '' AND (item->>'precio_unitario') <> ''
         THEN (item->>'cantidad')::numeric * (item->>'precio_unitario')::numeric ELSE NULL END,
    '[]'::jsonb,
    true
  FROM jsonb_array_elements(p_items) AS item;
END;
$$;
;
