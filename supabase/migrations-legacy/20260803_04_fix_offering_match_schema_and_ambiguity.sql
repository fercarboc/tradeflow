-- P2.7 FIX v2: corrige dos bugs adicionales encontrados en v1:
-- 1. trade_marketplace_supplier_offerings no tiene ean/mpn/familia/marca → runtime error
-- 2. RETURNS TABLE crea OUT params con mismos nombres que columnas del CTE → "id is ambiguous"
-- Solución: capturar solo descripcion_comercial del offering; aliases c_* en CTE

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
  v_desc      text;
BEGIN
  -- Obtener actor y descripción del offering en una sola consulta
  SELECT a.id, o.descripcion_comercial
  INTO v_actor_id, v_desc
  FROM public.trade_marketplace_supplier_offerings o
  JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
  WHERE o.id = p_offering_id;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.';
  END IF;

  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.';
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT
      -- Alias c_* para evitar conflicto con OUT params del RETURNS TABLE (id, ean, mpn, etc.)
      up.id                      AS c_id,
      up.nombre_canonico         AS c_nombre,
      up.familia                 AS c_familia,
      up.oficio                  AS c_oficio,
      up.marca                   AS c_marca,
      up.modelo                  AS c_modelo,
      up.ean                     AS c_ean,
      up.mpn                     AS c_mpn,
      -- El offering no tiene EAN/MPN/familia/marca → flags siempre false en esta versión
      false::boolean             AS c_match_ean,
      false::boolean             AS c_match_mpn,
      false::boolean             AS c_match_marca,
      false::boolean             AS c_match_familia,
      -- Descripción bidireccional: LEFT 15 evita incluir dimensiones ("80x80")
      (up.nombre_canonico ILIKE '%' || LEFT(v_desc, 15) || '%'
       OR v_desc ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%') AS c_match_desc,

      LEAST(100,
        -- Coincidencia por descripción (base para modo auto y bonus en modo manual)
        CASE WHEN up.nombre_canonico ILIKE '%' || LEFT(v_desc, 15) || '%'
               OR v_desc ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%'
             THEN 30 ELSE 0 END +
        -- Puntuación por query del usuario (búsqueda manual)
        CASE WHEN p_query IS NOT NULL AND up.nombre_canonico ILIKE '%' || p_query || '%' THEN 25 ELSE 0 END +
        CASE WHEN p_query IS NOT NULL AND up.familia         ILIKE '%' || p_query || '%' THEN 15 ELSE 0 END
      )::numeric AS c_score,

      -- GROUP BY 1 (posicional) evita referencia directa a "id" que es OUT param
      COUNT(o2.id) FILTER (WHERE o2.match_state = 'matched')::bigint AS c_ofertas

    FROM public.trade_marketplace_universal_products up
    LEFT JOIN public.trade_marketplace_supplier_offerings o2 ON o2.universal_product_id = up.id
    WHERE up.validation_state = 'validated'
      AND (
        -- Modo búsqueda manual: filtrar UPs por texto
        (p_query IS NOT NULL AND (
          up.nombre_canonico ILIKE '%' || p_query || '%'
          OR up.ean          =           p_query
          OR up.mpn          ILIKE '%' || p_query || '%'
          OR up.familia      ILIKE '%' || p_query || '%'
        ))
        -- Modo auto: filtrar por descripción del offering
        OR (p_query IS NULL AND (
          up.nombre_canonico ILIKE '%' || LEFT(v_desc, 15) || '%'
          OR v_desc ILIKE '%' || LEFT(up.nombre_canonico, 20) || '%'
        ))
      )
    GROUP BY 1  -- posicional → agrupa por up.id (c_id, PK → dependencia funcional válida)
  )
  -- RETURN QUERY usa mapeo posicional, no por nombre
  SELECT
    s.c_id,
    s.c_nombre,
    s.c_familia,
    s.c_oficio,
    s.c_marca,
    s.c_modelo,
    s.c_ean,
    s.c_mpn,
    s.c_score,
    s.c_match_ean,
    s.c_match_mpn,
    s.c_match_marca,
    s.c_match_familia,
    s.c_match_desc,
    (CASE
      WHEN s.c_match_desc AND p_query IS NOT NULL THEN 'Coincidencia por descripción y búsqueda.'
      WHEN s.c_match_desc                         THEN 'Coincidencia por descripción similar.'
      WHEN p_query IS NOT NULL                    THEN 'Posible coincidencia por búsqueda.'
      ELSE                                             'Posible coincidencia.'
    END)::text,
    s.c_ofertas
  FROM scored s
  WHERE s.c_score > 0
  ORDER BY s.c_score DESC, s.c_nombre
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_offering_match_candidates(uuid, text, int) IS
'P2.7 fix v2 2026-08-03: solo usa descripcion_comercial del offering (no ean/mpn/familia); aliases c_* evitan ambigüedad con OUT params; GROUP BY posicional.';
