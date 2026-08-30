-- ═══════════════════════════════════════════════════════════════════════════
-- 20260819_04 — get_ad_targeting_options: TRADE devuelve grupo + aliases
-- ═══════════════════════════════════════════════════════════════════════════
-- Para TRADE, extra = JSON {"grupo":"...","aliases":[...]}
-- Permite búsqueda por sinónimos en el selector multi-gremio del portal.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_ad_targeting_options(
  p_actor_id    uuid,
  p_target_type text
)
RETURNS TABLE(id text, label text, extra text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_actor_member(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_target_type = 'CATEGORY' THEN
    RETURN QUERY
      SELECT c.id::text, c.nombre, COALESCE(c.oficio,'')
      FROM public.trade_marketplace_categories c
      WHERE c.activa = true
      ORDER BY c.posicion, c.nombre;

  ELSIF p_target_type = 'TRADE' THEN
    RETURN QUERY
      SELECT o.id::text, o.nombre,
        jsonb_build_object(
          'grupo',   COALESCE(o.grupo, 'Otros'),
          'aliases', COALESCE(o.aliases, ARRAY[]::text[])
        )::text
      FROM public.trade_maintenance_oficios o
      WHERE o.activo = true
      ORDER BY o.grupo NULLS LAST, o.nombre;

  ELSIF p_target_type = 'BRAND' THEN
    RETURN QUERY
      SELECT b.id::text, b.nombre, COALESCE(b.slug,'')
      FROM public.trade_marketplace_brands b
      WHERE b.activa = true
      ORDER BY b.nombre;

  ELSIF p_target_type = 'SUPPLIER' THEN
    RETURN QUERY
      SELECT a.id::text, a.nombre, COALESCE(a.slug,'')
      FROM public.trade_marketplace_actors a
      WHERE a.id = p_actor_id
        AND a.estado = 'ACTIVE';

  ELSIF p_target_type = 'PRODUCT' THEN
    RETURN QUERY
      SELECT up.id::text, up.nombre_canonico, COALESCE(up.oficio,'')
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'VALIDATED'
      ORDER BY up.nombre_canonico
      LIMIT 200;

  ELSIF p_target_type = 'OFFERING' THEN
    RETURN QUERY
      SELECT o.id::text, o.descripcion_comercial, o.supplier_catalog_id::text
      FROM public.trade_marketplace_supplier_offerings o
      JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
      WHERE a.id = p_actor_id
        AND o.activa = true
      ORDER BY o.descripcion_comercial
      LIMIT 200;

  ELSE
    RAISE EXCEPTION 'Tipo de objetivo no reconocido: %', p_target_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ad_targeting_options(uuid, text) TO authenticated;
