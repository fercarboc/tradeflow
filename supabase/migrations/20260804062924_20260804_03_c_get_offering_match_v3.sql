DROP FUNCTION IF EXISTS public.get_offering_match_candidates(uuid, text, integer);

CREATE FUNCTION public.get_offering_match_candidates(
  p_offering_id uuid,
  p_query       text DEFAULT NULL,
  p_limit       int  DEFAULT 5
)
RETURNS TABLE (
  id                uuid,
  nombre_canonico   text,
  familia           text,
  oficio            text,
  marca             text,
  modelo            text,
  ean               text,
  mpn               text,
  score             numeric,
  match_ean         boolean,
  match_mpn         boolean,
  match_marca       boolean,
  match_familia     boolean,
  match_descripcion boolean,
  explicacion       text,
  ofertas_count     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id  uuid;
  v_desc      text;
  v_desc_u    text;
  v_query_u   text;
BEGIN
  SELECT a.id, o.descripcion_comercial
  INTO   v_actor_id, v_desc
  FROM   public.trade_marketplace_supplier_offerings o
  JOIN   public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
  WHERE  o.id = p_offering_id;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.';
  END IF;

  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.';
  END IF;

  v_desc_u  := lower(extensions.unaccent(coalesce(v_desc, '')));
  v_query_u := lower(extensions.unaccent(coalesce(p_query, '')));

  RETURN QUERY
  WITH scored AS (
    SELECT
      up.id               AS c_id,
      up.nombre_canonico  AS c_nombre,
      up.familia          AS c_familia,
      up.oficio           AS c_oficio,
      up.marca            AS c_marca,
      up.modelo           AS c_modelo,
      up.ean              AS c_ean,
      up.mpn              AS c_mpn,

      false::boolean AS c_match_ean,
      false::boolean AS c_match_mpn,
      false::boolean AS c_match_marca,

      (p_query IS NOT NULL
        AND lower(extensions.unaccent(coalesce(up.familia,''))) LIKE '%' || v_query_u || '%'
      )::boolean AS c_match_familia,

      (
        lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || left(v_desc_u, 15) || '%'
        OR v_desc_u LIKE '%' || lower(extensions.unaccent(left(up.nombre_canonico, 20))) || '%'
        OR (p_query IS NOT NULL AND lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || v_query_u || '%')
      )::boolean AS c_match_desc,

      LEAST(100,
        CASE WHEN p_query IS NOT NULL
               AND lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || v_query_u || '%'
             THEN 30 ELSE 0 END +
        CASE WHEN lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || left(v_desc_u, 15) || '%'
               OR v_desc_u LIKE '%' || lower(extensions.unaccent(left(up.nombre_canonico, 20))) || '%'
             THEN 20 ELSE 0 END +
        CASE WHEN p_query IS NOT NULL
               AND lower(extensions.unaccent(coalesce(up.familia,''))) LIKE '%' || v_query_u || '%'
             THEN 15 ELSE 0 END +
        CASE WHEN split_part(v_desc_u,' ',1) != ''
               AND lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || split_part(v_desc_u,' ',1) || '%'
             THEN 6 ELSE 0 END +
        CASE WHEN split_part(v_desc_u,' ',2) != ''
               AND lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || split_part(v_desc_u,' ',2) || '%'
             THEN 6 ELSE 0 END +
        CASE WHEN p_query IS NOT NULL THEN
          round((similarity(lower(extensions.unaccent(up.nombre_canonico)), v_query_u) * 12)::numeric, 0)
        ELSE
          round((similarity(lower(extensions.unaccent(up.nombre_canonico)), v_desc_u) * 12)::numeric, 0)
        END -
        CASE WHEN v_desc ~ '\m\d+x\d+\M' AND up.nombre_canonico ~ '\m\d+x\d+\M'
               AND (regexp_match(v_desc, '\m(\d+x\d+)\M'))[1]
                   IS DISTINCT FROM (regexp_match(up.nombre_canonico, '\m(\d+x\d+)\M'))[1]
             THEN 15 ELSE 0 END -
        CASE WHEN v_desc ~ '\m\d+/\d+\M' AND up.nombre_canonico ~ '\m\d+/\d+\M'
               AND (regexp_match(v_desc, '\m(\d+/\d+)\M'))[1]
                   IS DISTINCT FROM (regexp_match(up.nombre_canonico, '\m(\d+/\d+)\M'))[1]
             THEN 15 ELSE 0 END
      )::numeric AS c_score,

      COUNT(o2.id) FILTER (WHERE o2.match_state = 'matched')::bigint AS c_ofertas

    FROM public.trade_marketplace_universal_products up
    LEFT JOIN public.trade_marketplace_supplier_offerings o2 ON o2.universal_product_id = up.id
    WHERE up.validation_state = 'validated'
      AND (
        (p_query IS NOT NULL AND (
          lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || v_query_u || '%'
          OR up.ean = p_query
          OR lower(extensions.unaccent(coalesce(up.mpn,''))) LIKE '%' || v_query_u || '%'
          OR lower(extensions.unaccent(coalesce(up.familia,''))) LIKE '%' || v_query_u || '%'
          OR similarity(lower(extensions.unaccent(up.nombre_canonico)), v_query_u) >= 0.25
        ))
        OR (p_query IS NULL AND (
          lower(extensions.unaccent(up.nombre_canonico)) LIKE '%' || left(v_desc_u, 15) || '%'
          OR v_desc_u LIKE '%' || lower(extensions.unaccent(left(up.nombre_canonico, 20))) || '%'
          OR similarity(lower(extensions.unaccent(up.nombre_canonico)), v_desc_u) >= 0.25
        ))
      )
    GROUP BY 1
  )
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
      WHEN s.c_match_desc AND p_query IS NOT NULL THEN 'Coincidencia por nombre y búsqueda.'
      WHEN s.c_match_desc                         THEN 'Coincidencia por descripción similar.'
      WHEN s.c_match_familia                      THEN 'Coincidencia por familia de producto.'
      WHEN p_query IS NOT NULL                    THEN 'Posible coincidencia por búsqueda.'
      ELSE                                             'Posible coincidencia por similitud.'
    END)::text,
    s.c_ofertas
  FROM scored s
  WHERE s.c_score > 0
  ORDER BY s.c_score DESC, s.c_nombre
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_offering_match_candidates(uuid, text, int) IS
'P2.7 v3 2026-08-04: unaccent bilateral + pg_trgm threshold 0.25 + scoring 30/20/15/12/12 + penalización dimensional -15.';;
