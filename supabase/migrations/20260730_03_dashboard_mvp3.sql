-- MVP-3: Dashboard operativo — funciones de soporte

-- ── 1. Feed de actividad reciente ──────────────────────────────────────────────
-- Agrupa eventos de offerings por tipo + minuto (bulk actions = 1 fila)
-- Incluye también eventos de importación (completado/error/cancelado)

CREATE OR REPLACE FUNCTION public.get_supplier_activity_feed(
  p_actor_id uuid,
  p_limit    integer DEFAULT 20
)
RETURNS TABLE(
  id           text,
  event_source text,
  tipo         text,
  titulo       text,
  descripcion  text,
  count_items  integer,
  ref_id       uuid,
  created_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id;

  IF v_catalog_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH offering_groups AS (
    SELECT
      oe.tipo::text                                      AS tipo,
      date_trunc('minute', oe.created_at)               AS bucket,
      COUNT(*)::integer                                  AS cnt,
      MAX(oe.created_at)                                 AS ts,
      MAX(oe.offering_id)                                AS ref_id,
      MAX(o.descripcion_comercial)                       AS desc_val,
      MAX((oe.datos_despues->>'activa')::text)           AS activa_val,
      MAX((oe.datos_despues->>'stock_disponible')::text) AS stock_val
    FROM public.trade_offering_events oe
    JOIN public.trade_marketplace_supplier_offerings o ON o.id = oe.offering_id
    WHERE o.supplier_catalog_id = v_catalog_id
      AND oe.tipo IN ('precio', 'stock', 'estado', 'imagen', 'ia_vinculado', 'ia_desvinculado')
    GROUP BY oe.tipo, date_trunc('minute', oe.created_at)
    ORDER BY MAX(oe.created_at) DESC
    LIMIT 30
  ),
  import_rows AS (
    SELECT
      ci.estado::text             AS tipo,
      date_trunc('minute', ci.updated_at) AS bucket,
      1::integer                  AS cnt,
      ci.updated_at               AS ts,
      ci.id                       AS ref_id,
      ci.nombre_archivo           AS desc_val,
      NULL::text                  AS activa_val,
      NULL::text                  AS stock_val
    FROM public.trade_catalog_imports ci
    WHERE ci.actor_id = p_actor_id
      AND ci.estado IN ('completado', 'error', 'cancelado')
    ORDER BY ci.updated_at DESC
    LIMIT 5
  ),
  combined AS (
    SELECT * FROM offering_groups
    UNION ALL
    SELECT * FROM import_rows
  )
  SELECT
    md5(c.tipo || c.bucket::text)::text AS id,
    CASE c.tipo
      WHEN 'completado' THEN 'import'::text
      WHEN 'error'      THEN 'import'::text
      WHEN 'cancelado'  THEN 'import'::text
      ELSE 'offering'::text
    END AS event_source,
    c.tipo,
    CASE
      WHEN c.tipo = 'precio'        AND c.cnt = 1    THEN 'Precio actualizado'
      WHEN c.tipo = 'precio'                         THEN c.cnt::text || ' precios actualizados'
      WHEN c.tipo = 'stock'         AND c.stock_val = 'true'  AND c.cnt = 1 THEN 'Stock activado'
      WHEN c.tipo = 'stock'         AND c.stock_val = 'true'               THEN c.cnt::text || ' stocks activados'
      WHEN c.tipo = 'stock'         AND c.cnt = 1    THEN 'Stock desactivado'
      WHEN c.tipo = 'stock'                          THEN c.cnt::text || ' stocks desactivados'
      WHEN c.tipo = 'estado'        AND c.activa_val = 'true' AND c.cnt = 1 THEN 'Producto activado'
      WHEN c.tipo = 'estado'        AND c.activa_val = 'true'              THEN c.cnt::text || ' productos activados'
      WHEN c.tipo = 'estado'        AND c.cnt = 1    THEN 'Producto desactivado'
      WHEN c.tipo = 'estado'                         THEN c.cnt::text || ' productos desactivados'
      WHEN c.tipo = 'imagen'        AND c.cnt = 1    THEN 'Imagen actualizada'
      WHEN c.tipo = 'imagen'                         THEN c.cnt::text || ' imágenes actualizadas'
      WHEN c.tipo = 'ia_vinculado'  AND c.cnt = 1    THEN 'Vinculado con catálogo universal'
      WHEN c.tipo = 'ia_vinculado'                   THEN c.cnt::text || ' productos vinculados'
      WHEN c.tipo = 'ia_desvinculado' AND c.cnt = 1  THEN 'Desvinculado del catálogo'
      WHEN c.tipo = 'ia_desvinculado'                THEN c.cnt::text || ' productos desvinculados'
      WHEN c.tipo = 'completado'                     THEN 'Importación completada'
      WHEN c.tipo = 'error'                          THEN 'Error en importación'
      WHEN c.tipo = 'cancelado'                      THEN 'Importación cancelada'
      ELSE c.tipo
    END::text AS titulo,
    COALESCE(c.desc_val, '')::text AS descripcion,
    c.cnt AS count_items,
    c.ref_id,
    c.ts AS created_at
  FROM combined c
  ORDER BY c.ts DESC
  LIMIT p_limit;
END;
$$;


-- ── 2. Estadísticas del Motor IA ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_supplier_ia_stats(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id     uuid;
  v_linked         integer;
  v_pending        integer;
  v_avg_confidence numeric;
  v_to_review      integer;
  v_with_issues    integer;
BEGIN
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object(
      'linked', 0, 'pending', 0, 'avg_confidence', null,
      'to_review', 0, 'with_issues', 0
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE universal_product_id IS NOT NULL)::integer,
    COUNT(*) FILTER (WHERE universal_product_id IS NULL)::integer,
    AVG(match_confidence) FILTER (WHERE universal_product_id IS NOT NULL AND match_confidence IS NOT NULL),
    COUNT(*) FILTER (
      WHERE universal_product_id IS NOT NULL
        AND match_confidence IS NOT NULL
        AND match_confidence < 0.70
    )::integer,
    COUNT(*) FILTER (WHERE match_state IN ('conflict', 'duplicate'))::integer
  INTO v_linked, v_pending, v_avg_confidence, v_to_review, v_with_issues
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id;

  RETURN jsonb_build_object(
    'linked',         COALESCE(v_linked, 0),
    'pending',        COALESCE(v_pending, 0),
    'avg_confidence', CASE
                        WHEN v_avg_confidence IS NOT NULL
                        THEN round((v_avg_confidence * 100)::numeric, 0)
                        ELSE NULL
                      END,
    'to_review',      COALESCE(v_to_review, 0),
    'with_issues',    COALESCE(v_with_issues, 0)
  );
END;
$$;
