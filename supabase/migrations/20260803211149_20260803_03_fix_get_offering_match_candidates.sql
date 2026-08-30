
-- P2.7 FIX: DROP primero por cambio en firma RETURNS TABLE
-- Bug 1: score ignoraba p_query → UPs encontrados por WHERE tenían score=0 → filtrado → 0 resultados
-- Bug 2: LEFT(descripcion_comercial,20) incluía dimensiones → nunca coincidía en modo auto
-- Fix: puntuación por query, descripción bidireccional LEFT 15/20

DROP FUNCTION IF EXISTS public.get_offering_match_candidates(uuid, text, integer);

CREATE FUNCTION public.get_offering_match_candidates(
  p_offering_id uuid,
  p_query       text DEFAULT NULL,
  p_limit       int  DEFAULT 5
)
RETURNS TABLE (
  id               uuid,
  nombre_canonico  text,
  familia          text,
  oficio           text,
  marca            text,
  modelo           text,
  ean              text,
  mpn              text,
  score            numeric,
  match_ean        boolean,
  match_mpn        boolean,
  match_marca      boolean,
  match_familia    boolean,
  match_descripcion boolean,
  explicacion      text,
  ofertas_count    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id  uuid;
  v_offering  RECORD;
BEGIN
  SELECT a.id INTO v_actor_id
  FROM public.trade_marketplace_supplier_offerings o
  JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
  WHERE o.id = p_offering_id;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.';
  END IF;

  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.';
  END IF;

  SELECT * INTO v_offering
  FROM public.trade_marketplace_supplier_offerings
  WHERE id = p_offering_id;

  RETURN QUERY
  WITH scored AS (
    SELECT
      up.id,
      up.nombre_canonico,
      up.familia,
      up.oficio,
      up.marca,
      up.modelo,
      up.ean,
      up.mpn,

      -- Flags de coincidencia
      (v_offering.ean IS NOT NULL AND v_offering.ean = up.ean)                                         AS match_ean,
      (v_offering.mpn IS NOT NULL AND lower(v_offering.mpn) = lower(COALESCE(up.mpn, '')))             AS match_mpn,
      (v_offering.marca IS NOT NULL AND lower(v_offering.marca) = lower(COALESCE(up.marca, '')))       AS match_marca,
      (v_offering.familia IS NOT NULL AND lower(v_offering.familia) = lower(COALESCE(up.familia, ''))) AS match_familia,
      -- Bidireccional: UP en desc del offering O UP-name en desc del offering
      (up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial, 15) || '%'
       OR v_offering.descripcion_comercial ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%')           AS match_descripcion,

      LEAST(100,
        CASE WHEN v_offering.ean IS NOT NULL AND v_offering.ean = up.ean THEN 60 ELSE 0 END +
        CASE WHEN v_offering.mpn IS NOT NULL AND lower(v_offering.mpn) = lower(COALESCE(up.mpn,'')) THEN 40 ELSE 0 END +
        CASE WHEN lower(COALESCE(v_offering.familia,'')) = lower(COALESCE(up.familia,'')) AND COALESCE(up.familia,'') != '' THEN 20 ELSE 0 END +
        CASE WHEN lower(COALESCE(v_offering.marca,'')) = lower(COALESCE(up.marca,'')) AND COALESCE(up.marca,'') != '' THEN 15 ELSE 0 END +
        CASE WHEN up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial, 15) || '%'
               OR v_offering.descripcion_comercial ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%'
             THEN 10 ELSE 0 END +
        -- FIX Bug 1: puntuación cuando hay query del usuario
        CASE WHEN p_query IS NOT NULL AND up.nombre_canonico ILIKE '%' || p_query || '%' THEN 8 ELSE 0 END +
        CASE WHEN p_query IS NOT NULL AND up.familia ILIKE '%' || p_query || '%' THEN 4 ELSE 0 END
      )::numeric AS score,

      COUNT(o2.id) FILTER (WHERE o2.match_state = 'matched') AS ofertas_count

    FROM public.trade_marketplace_universal_products up
    LEFT JOIN public.trade_marketplace_supplier_offerings o2 ON o2.universal_product_id = up.id
    WHERE up.validation_state = 'validated'
      AND (
        -- Modo búsqueda manual
        p_query IS NOT NULL AND (
          up.nombre_canonico ILIKE '%' || p_query || '%'
          OR up.ean = p_query
          OR up.mpn ILIKE '%' || p_query || '%'
          OR up.familia ILIKE '%' || p_query || '%'
        )
        -- Modo auto (sin query)
        OR p_query IS NULL AND (
          up.ean = v_offering.ean
          OR lower(up.mpn) = lower(COALESCE(v_offering.mpn, ''))
          OR up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial, 15) || '%'
          OR v_offering.descripcion_comercial ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%'
          OR (v_offering.familia IS NOT NULL AND lower(up.familia) = lower(v_offering.familia))
        )
      )
    GROUP BY up.id
  )
  SELECT
    s.id, s.nombre_canonico, s.familia, s.oficio, s.marca, s.modelo,
    s.ean, s.mpn, s.score,
    s.match_ean, s.match_mpn, s.match_marca, s.match_familia, s.match_descripcion,
    (CASE
      WHEN s.match_ean         THEN 'Coincidencia por EAN exacto.'
      WHEN s.match_mpn         THEN 'Coincidencia por MPN del fabricante.'
      WHEN s.match_marca AND s.match_familia THEN 'Coincidencia por marca y familia de producto.'
      WHEN s.match_familia     THEN 'Coincidencia por familia de producto.'
      WHEN s.match_descripcion THEN 'Coincidencia por descripción similar.'
      ELSE                          'Posible coincidencia por búsqueda.'
    END)::text AS explicacion,
    s.ofertas_count
  FROM scored s
  WHERE s.score > 0
  ORDER BY s.score DESC, s.nombre_canonico
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_offering_match_candidates(uuid, text, int) IS
'P2.7 fix 2026-08-03: score incluye puntuación por query usuario (+8/+4); descripción bidireccional LEFT 15/20.';
;
