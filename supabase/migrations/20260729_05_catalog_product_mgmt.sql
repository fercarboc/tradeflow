-- MVP-2.1: Gestión individual de productos del catálogo proveedor
-- A. image_url en offerings
-- B. tabla trade_offering_events (historial por producto)
-- C. Storage bucket marketplace-offerings
-- D. get_supplier_offerings_paged v2 (filtros activa/stock, sort, image_url, updated_at)
-- E. update_supplier_offering extendido (unidad, eventos)
-- F. update_offering_image (null = borrar)
-- G. get_offering_events
-- H. get_catalog_quality_stats
-- I. record_offering_event (para eventos IA desde frontend)

-- ── A. image_url ──────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD COLUMN IF NOT EXISTS image_url text;

-- ── B. Historial de cambios ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_offering_events (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  offering_id   uuid        NOT NULL
                            REFERENCES public.trade_marketplace_supplier_offerings(id)
                            ON DELETE CASCADE,
  actor_id      uuid        NOT NULL,
  tipo          text        NOT NULL,
  datos_antes   jsonb,
  datos_despues jsonb,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offering_events_offering_ts
  ON public.trade_offering_events(offering_id, created_at DESC);

ALTER TABLE public.trade_offering_events ENABLE ROW LEVEL SECURITY;

-- ── C. Storage bucket para imágenes ──────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-offerings',
  'marketplace-offerings',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'mkt_off_img_select'
  ) THEN
    CREATE POLICY "mkt_off_img_select"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'marketplace-offerings');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'mkt_off_img_insert'
  ) THEN
    CREATE POLICY "mkt_off_img_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'marketplace-offerings');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'mkt_off_img_update'
  ) THEN
    CREATE POLICY "mkt_off_img_update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'marketplace-offerings');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'mkt_off_img_delete'
  ) THEN
    CREATE POLICY "mkt_off_img_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'marketplace-offerings');
  END IF;
END $$;

-- ── D. get_supplier_offerings_paged v2 ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_supplier_offerings_paged(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_supplier_offerings_paged(
  p_actor_id    uuid,
  p_search      text    DEFAULT NULL,
  p_match_state text    DEFAULT NULL,
  p_activa      boolean DEFAULT NULL,
  p_stock       boolean DEFAULT NULL,
  p_sort_by     text    DEFAULT 'updated_at',
  p_sort_dir    text    DEFAULT 'desc',
  p_limit       integer DEFAULT 20,
  p_offset      integer DEFAULT 0
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_sort_col   text;
  v_sort_order text;
BEGIN
  -- Whitelist sort column to prevent SQL injection
  v_sort_col := CASE p_sort_by
    WHEN 'supplier_ref'          THEN 'o.supplier_ref'
    WHEN 'descripcion_comercial' THEN 'o.descripcion_comercial'
    WHEN 'precio_venta'          THEN 'o.precio_venta'
    WHEN 'precio_coste'          THEN 'o.precio_coste'
    WHEN 'created_at'            THEN 'o.created_at'
    ELSE                              'o.updated_at'
  END;
  v_sort_order := CASE WHEN lower(p_sort_dir) = 'asc'
    THEN 'ASC NULLS LAST'
    ELSE 'DESC NULLS LAST'
  END;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN RETURN; END IF;

  RETURN QUERY EXECUTE format(
    $q$
    SELECT to_jsonb(r) FROM (
      SELECT
        o.id,
        o.supplier_ref,
        o.descripcion_comercial,
        o.precio_coste,
        o.precio_venta,
        o.unidad,
        o.stock_disponible,
        o.stock_cantidad,
        o.plazo_entrega_dias,
        o.match_state,
        o.match_method,
        o.match_confidence,
        o.universal_product_id,
        o.activa,
        o.image_url,
        o.created_at,
        o.updated_at,
        up.nombre_canonico AS up_nombre_canonico,
        up.familia         AS up_familia,
        CASE
          WHEN o.match_state = 'matched'        THEN 'compatible'
          WHEN o.match_state = 'suggested'      THEN 'mejor_coincidencia'
          WHEN o.match_state = 'pending_review' THEN 'revisar'
          WHEN NOT o.stock_disponible           THEN 'sin_stock'
          ELSE                                       'sin_up'
        END AS ia_estado,
        CASE
          WHEN o.match_state = 'matched'        THEN 'Vinculado al catálogo TrabFlow'
          WHEN o.match_state = 'suggested'      THEN 'Sugerencia pendiente de confirmación'
          WHEN o.match_state = 'pending_review' THEN 'Pendiente de revisión'
          WHEN NOT o.stock_disponible           THEN 'Sin stock disponible'
          ELSE                                       'Sin vincular al catálogo TrabFlow'
        END AS ia_explicacion,
        COUNT(*) OVER() AS total_count
      FROM public.trade_marketplace_supplier_offerings o
      LEFT JOIN public.trade_universal_products up ON up.id = o.universal_product_id
      WHERE o.supplier_catalog_id = $1
        AND ($2 IS NULL
             OR o.supplier_ref          ILIKE '%%' || $2 || '%%'
             OR o.descripcion_comercial ILIKE '%%' || $2 || '%%')
        AND ($3 IS NULL OR o.match_state    = $3)
        AND ($4 IS NULL OR o.activa         = $4)
        AND ($5 IS NULL OR o.stock_disponible = $5)
      ORDER BY %s %s
      LIMIT $6 OFFSET $7
    ) r
    $q$,
    v_sort_col, v_sort_order
  ) USING v_catalog_id, p_search, p_match_state, p_activa, p_stock, p_limit, p_offset;
END;
$$;

-- ── E. update_supplier_offering extendido ────────────────────────────────────

DROP FUNCTION IF EXISTS public.update_supplier_offering(uuid, numeric, numeric, boolean, integer, text, integer, boolean);

CREATE OR REPLACE FUNCTION public.update_supplier_offering(
  p_offering_id           uuid,
  p_precio_coste          numeric  DEFAULT NULL,
  p_precio_venta          numeric  DEFAULT NULL,
  p_stock_disponible      boolean  DEFAULT NULL,
  p_stock_cantidad        integer  DEFAULT NULL,
  p_descripcion_comercial text     DEFAULT NULL,
  p_plazo_entrega_dias    integer  DEFAULT NULL,
  p_activa                boolean  DEFAULT NULL,
  p_unidad                text     DEFAULT NULL,
  p_actor_id              uuid     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old      record;
  v_actor_id uuid := COALESCE(p_actor_id, auth.uid());
BEGIN
  SELECT * INTO v_old
  FROM public.trade_marketplace_supplier_offerings
  WHERE id = p_offering_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Producto % no encontrado.', p_offering_id
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.trade_marketplace_supplier_offerings SET
    descripcion_comercial = COALESCE(p_descripcion_comercial, descripcion_comercial),
    precio_coste          = COALESCE(p_precio_coste,          precio_coste),
    precio_venta          = COALESCE(p_precio_venta,          precio_venta),
    unidad                = COALESCE(p_unidad,                unidad),
    stock_disponible      = COALESCE(p_stock_disponible,      stock_disponible),
    stock_cantidad        = COALESCE(p_stock_cantidad,        stock_cantidad),
    plazo_entrega_dias    = COALESCE(p_plazo_entrega_dias,    plazo_entrega_dias),
    activa                = COALESCE(p_activa,                activa),
    updated_at            = now()
  WHERE id = p_offering_id;

  -- Record price change event
  IF (p_precio_coste IS NOT NULL AND p_precio_coste IS DISTINCT FROM v_old.precio_coste)
  OR (p_precio_venta IS NOT NULL AND p_precio_venta IS DISTINCT FROM v_old.precio_venta)
  THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    VALUES (
      p_offering_id, v_actor_id, 'precio',
      jsonb_build_object('precio_coste', v_old.precio_coste, 'precio_venta', v_old.precio_venta),
      jsonb_build_object(
        'precio_coste', COALESCE(p_precio_coste, v_old.precio_coste),
        'precio_venta', COALESCE(p_precio_venta, v_old.precio_venta)
      )
    );
  END IF;

  -- Record stock change event
  IF (p_stock_disponible IS NOT NULL AND p_stock_disponible IS DISTINCT FROM v_old.stock_disponible)
  OR (p_stock_cantidad IS NOT NULL AND p_stock_cantidad IS DISTINCT FROM v_old.stock_cantidad)
  THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    VALUES (
      p_offering_id, v_actor_id, 'stock',
      jsonb_build_object('stock_disponible', v_old.stock_disponible, 'stock_cantidad', v_old.stock_cantidad),
      jsonb_build_object(
        'stock_disponible', COALESCE(p_stock_disponible, v_old.stock_disponible),
        'stock_cantidad',   COALESCE(p_stock_cantidad,   v_old.stock_cantidad)
      )
    );
  END IF;

  -- Record estado change event
  IF p_activa IS NOT NULL AND p_activa IS DISTINCT FROM v_old.activa THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    VALUES (
      p_offering_id, v_actor_id, 'estado',
      jsonb_build_object('activa', v_old.activa),
      jsonb_build_object('activa', p_activa)
    );
  END IF;

  -- Record general edit event (desc, unidad, plazo)
  IF (p_descripcion_comercial IS NOT NULL AND p_descripcion_comercial IS DISTINCT FROM v_old.descripcion_comercial)
  OR (p_unidad IS NOT NULL AND p_unidad IS DISTINCT FROM v_old.unidad)
  OR (p_plazo_entrega_dias IS NOT NULL AND p_plazo_entrega_dias IS DISTINCT FROM v_old.plazo_entrega_dias)
  THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    VALUES (
      p_offering_id, v_actor_id, 'editado',
      jsonb_build_object(
        'descripcion_comercial', v_old.descripcion_comercial,
        'unidad',                v_old.unidad,
        'plazo_entrega_dias',    v_old.plazo_entrega_dias
      ),
      jsonb_build_object(
        'descripcion_comercial', COALESCE(p_descripcion_comercial, v_old.descripcion_comercial),
        'unidad',                COALESCE(p_unidad,                v_old.unidad),
        'plazo_entrega_dias',    COALESCE(p_plazo_entrega_dias,    v_old.plazo_entrega_dias)
      )
    );
  END IF;
END;
$$;

-- ── F. update_offering_image (NULL = borrar imagen) ───────────────────────────

CREATE OR REPLACE FUNCTION public.update_offering_image(
  p_actor_id    uuid,
  p_offering_id uuid,
  p_image_url   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_url text;
BEGIN
  SELECT image_url INTO v_old_url
  FROM public.trade_marketplace_supplier_offerings
  WHERE id = p_offering_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Producto % no encontrado.', p_offering_id
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.trade_marketplace_supplier_offerings SET
    image_url  = p_image_url,
    updated_at = now()
  WHERE id = p_offering_id;

  IF p_image_url IS DISTINCT FROM v_old_url THEN
    INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
    VALUES (
      p_offering_id, p_actor_id, 'imagen',
      jsonb_build_object('image_url', v_old_url),
      jsonb_build_object('image_url', p_image_url)
    );
  END IF;
END;
$$;

-- ── G. get_offering_events ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_offering_events(
  p_actor_id    uuid,
  p_offering_id uuid,
  p_limit       integer DEFAULT 30
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_supplier_offerings
    WHERE id = p_offering_id AND supplier_catalog_id = v_catalog_id
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT to_jsonb(e) FROM (
    SELECT id, tipo, datos_antes, datos_despues, created_at
    FROM public.trade_offering_events
    WHERE offering_id = p_offering_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) e;
END;
$$;

-- ── H. get_catalog_quality_stats ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_catalog_quality_stats(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_result     jsonb;
BEGIN
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN
    RETURN '{"total":0,"matched":0,"sin_imagen":0,"sin_stock":0,"inactivos":0,"cobertura_pct":0}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total',         COUNT(*),
    'matched',       COUNT(*) FILTER (WHERE match_state = 'matched'),
    'sin_imagen',    COUNT(*) FILTER (WHERE image_url IS NULL AND activa),
    'sin_stock',     COUNT(*) FILTER (WHERE NOT stock_disponible AND activa),
    'inactivos',     COUNT(*) FILTER (WHERE NOT activa),
    'cobertura_pct', COALESCE(
      ROUND(100.0 * COUNT(*) FILTER (WHERE match_state = 'matched') / NULLIF(COUNT(*), 0)),
      0
    )
  )
  INTO v_result
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id;

  RETURN v_result;
END;
$$;

-- ── I. record_offering_event (llamado desde frontend tras acciones IA) ────────

CREATE OR REPLACE FUNCTION public.record_offering_event(
  p_actor_id      uuid,
  p_offering_id   uuid,
  p_tipo          text,
  p_datos_antes   jsonb DEFAULT NULL,
  p_datos_despues jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_offering_events(offering_id, actor_id, tipo, datos_antes, datos_despues)
  VALUES (p_offering_id, p_actor_id, p_tipo, p_datos_antes, p_datos_despues);
END;
$$;
