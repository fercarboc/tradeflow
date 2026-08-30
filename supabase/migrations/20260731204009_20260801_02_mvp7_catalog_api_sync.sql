-- MVP-7.3: Funciones de sincronización para la API externa del proveedor

-- A. Extender modo para importaciones vía API
ALTER TABLE public.trade_catalog_imports DROP CONSTRAINT IF EXISTS chk_import_modo;
ALTER TABLE public.trade_catalog_imports ADD CONSTRAINT chk_import_modo CHECK (modo IN ('append', 'api'));

-- B. api_sync_catalog_offerings
CREATE OR REPLACE FUNCTION public.api_sync_catalog_offerings(
  p_actor_id uuid, p_items jsonb, p_source_system text DEFAULT NULL, p_sync_log_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catalog_id  uuid;
  v_import_id   uuid;
  v_item        jsonb;
  v_idx         integer;
  v_ref         text;
  v_desc        text;
  v_ok          integer := 0;
  v_updated     integer := 0;
  v_errores     integer := 0;
  v_errors_arr  jsonb   := '[]'::jsonb;
  v_is_insert   boolean;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: items no puede estar vacío.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'BATCH_TOO_LARGE: Máximo 500 productos por llamada. Recibidos: %.', jsonb_array_length(p_items)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors WHERE id = p_actor_id AND estado = 'active';
  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_NO_CATALOG: El actor no tiene catálogo activo.' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO public.trade_catalog_imports (
    actor_id, nombre_archivo, archivo_hash, total_filas,
    chunk_size, chunks_esperados, chunks_recibidos, modo, parser_version, estado
  ) VALUES (
    p_actor_id,
    COALESCE('api_sync_' || p_source_system, 'api_sync'),
    'api_' || encode(gen_random_bytes(8), 'hex'),
    jsonb_array_length(p_items), 500, 1, 1, 'api', 'api_v1', 'matching_pendiente'
  ) RETURNING id INTO v_import_id;

  FOR v_idx IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items -> v_idx;
    v_ref  := trim(v_item ->> 'supplier_ref');
    v_desc := trim(v_item ->> 'descripcion_comercial');

    IF v_ref IS NULL OR v_ref = '' THEN
      v_errors_arr := v_errors_arr || jsonb_build_object('index', v_idx, 'supplier_ref', null, 'motivo', 'supplier_ref es obligatorio');
      v_errores := v_errores + 1; CONTINUE;
    END IF;
    IF v_desc IS NULL OR v_desc = '' THEN
      v_errors_arr := v_errors_arr || jsonb_build_object('index', v_idx, 'supplier_ref', v_ref, 'motivo', 'descripcion_comercial es obligatoria');
      v_errores := v_errores + 1; CONTINUE;
    END IF;

    BEGIN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.trade_marketplace_supplier_offerings
        WHERE supplier_catalog_id = v_catalog_id AND supplier_ref = v_ref
      ) INTO v_is_insert;

      INSERT INTO public.trade_marketplace_supplier_offerings (
        supplier_catalog_id, supplier_ref, descripcion_comercial,
        precio_coste, precio_venta, unidad, stock_disponible, stock_cantidad,
        plazo_entrega_dias, activa, image_url, match_state, metadata, updated_at
      ) VALUES (
        v_catalog_id, v_ref, v_desc,
        NULLIF(v_item ->> 'precio_coste', '')::numeric,
        NULLIF(v_item ->> 'precio_venta', '')::numeric,
        COALESCE(NULLIF(trim(v_item ->> 'unidad'), ''), 'ud'),
        COALESCE((v_item ->> 'stock_disponible')::boolean, true),
        NULLIF(v_item ->> 'stock_cantidad', '')::integer,
        COALESCE(NULLIF(v_item ->> 'plazo_entrega_dias', '')::integer, 5),
        true,
        NULLIF(trim(v_item ->> 'image_url'), ''),
        'pending_review',
        jsonb_build_object('last_import_id', v_import_id, 'source_system', p_source_system, 'synced_at', now()),
        now()
      )
      ON CONFLICT (supplier_catalog_id, supplier_ref) DO UPDATE SET
        descripcion_comercial = EXCLUDED.descripcion_comercial,
        precio_coste          = EXCLUDED.precio_coste,
        precio_venta          = EXCLUDED.precio_venta,
        unidad                = EXCLUDED.unidad,
        stock_disponible      = EXCLUDED.stock_disponible,
        stock_cantidad        = EXCLUDED.stock_cantidad,
        plazo_entrega_dias    = EXCLUDED.plazo_entrega_dias,
        activa                = true,
        image_url             = COALESCE(EXCLUDED.image_url, public.trade_marketplace_supplier_offerings.image_url),
        metadata              = public.trade_marketplace_supplier_offerings.metadata
                                || jsonb_build_object('last_import_id', v_import_id, 'source_system', p_source_system, 'synced_at', now()),
        updated_at            = now();

      IF v_is_insert THEN v_ok := v_ok + 1; ELSE v_updated := v_updated + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors_arr := v_errors_arr || jsonb_build_object('index', v_idx, 'supplier_ref', v_ref, 'motivo', SQLERRM);
      v_errores := v_errores + 1;
    END;
  END LOOP;

  UPDATE public.trade_catalog_imports SET
    filas_ok = v_ok + v_updated, filas_error = v_errores,
    estado = CASE WHEN v_errores = 0 THEN 'matching_pendiente' ELSE 'completado' END,
    completed_at = now(), updated_at = now()
  WHERE id = v_import_id;

  IF (v_ok + v_updated) > 0 THEN
    INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload)
    VALUES (p_actor_id, 'catalog.import_completed', jsonb_build_object(
      'import_id', v_import_id, 'catalog_id', v_catalog_id,
      'actor_id', p_actor_id, 'source', 'api', 'source_system', p_source_system,
      'filas_ok', v_ok + v_updated
    ));
  END IF;

  RETURN jsonb_build_object('import_id', v_import_id, 'rows_inserted', v_ok, 'rows_updated', v_updated, 'rows_rejected', v_errores, 'errors', v_errors_arr);
END; $$;

REVOKE EXECUTE ON FUNCTION public.api_sync_catalog_offerings(uuid, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.api_sync_catalog_offerings(uuid, jsonb, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.api_sync_catalog_offerings(uuid, jsonb, text, uuid) FROM anon;

-- C. api_sync_stock
CREATE OR REPLACE FUNCTION public.api_sync_stock(p_actor_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catalog_id uuid; v_item jsonb; v_idx integer; v_ref text;
  v_updated integer := 0; v_not_found jsonb := '[]'::jsonb; v_rows integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: items no puede estar vacío.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'BATCH_TOO_LARGE: Máximo 1000 referencias por llamada. Recibidas: %.', jsonb_array_length(p_items)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors WHERE id = p_actor_id AND estado = 'active';
  IF v_catalog_id IS NULL THEN RAISE EXCEPTION 'ACTOR_NO_CATALOG' USING ERRCODE = 'no_data_found'; END IF;

  FOR v_idx IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items -> v_idx;
    v_ref  := trim(v_item ->> 'supplier_ref');
    IF v_ref IS NULL OR v_ref = '' THEN CONTINUE; END IF;
    UPDATE public.trade_marketplace_supplier_offerings SET
      stock_disponible = COALESCE((v_item ->> 'stock_disponible')::boolean, stock_disponible),
      stock_cantidad   = CASE WHEN v_item ? 'stock_cantidad' THEN NULLIF(v_item ->> 'stock_cantidad', '')::integer ELSE stock_cantidad END,
      updated_at       = now()
    WHERE supplier_catalog_id = v_catalog_id AND supplier_ref = v_ref;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_updated := v_updated + 1; ELSE v_not_found := v_not_found || to_jsonb(v_ref); END IF;
  END LOOP;

  RETURN jsonb_build_object('rows_received', jsonb_array_length(p_items), 'rows_updated', v_updated, 'not_found', v_not_found);
END; $$;

REVOKE EXECUTE ON FUNCTION public.api_sync_stock(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.api_sync_stock(uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.api_sync_stock(uuid, jsonb) FROM anon;

-- D. api_sync_prices
CREATE OR REPLACE FUNCTION public.api_sync_prices(p_actor_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catalog_id uuid; v_item jsonb; v_idx integer; v_ref text;
  v_updated integer := 0; v_not_found jsonb := '[]'::jsonb; v_rows integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: items no puede estar vacío.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'BATCH_TOO_LARGE: Máximo 1000 referencias por llamada. Recibidas: %.', jsonb_array_length(p_items)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors WHERE id = p_actor_id AND estado = 'active';
  IF v_catalog_id IS NULL THEN RAISE EXCEPTION 'ACTOR_NO_CATALOG' USING ERRCODE = 'no_data_found'; END IF;

  FOR v_idx IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items -> v_idx;
    v_ref  := trim(v_item ->> 'supplier_ref');
    IF v_ref IS NULL OR v_ref = '' THEN CONTINUE; END IF;
    UPDATE public.trade_marketplace_supplier_offerings SET
      precio_coste = CASE WHEN v_item ? 'precio_coste' THEN NULLIF(v_item ->> 'precio_coste', '')::numeric ELSE precio_coste END,
      precio_venta = CASE WHEN v_item ? 'precio_venta' THEN NULLIF(v_item ->> 'precio_venta', '')::numeric ELSE precio_venta END,
      updated_at   = now()
    WHERE supplier_catalog_id = v_catalog_id AND supplier_ref = v_ref;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_updated := v_updated + 1; ELSE v_not_found := v_not_found || to_jsonb(v_ref); END IF;
  END LOOP;

  RETURN jsonb_build_object('rows_received', jsonb_array_length(p_items), 'rows_updated', v_updated, 'not_found', v_not_found);
END; $$;

REVOKE EXECUTE ON FUNCTION public.api_sync_prices(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.api_sync_prices(uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.api_sync_prices(uuid, jsonb) FROM anon;

-- E. get_api_catalog_products
CREATE OR REPLACE FUNCTION public.get_api_catalog_products(
  p_actor_id uuid, p_page integer DEFAULT 1, p_per_page integer DEFAULT 50,
  p_activa boolean DEFAULT NULL, p_match_state text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catalog_id uuid; v_total integer; v_data jsonb; v_offset integer;
BEGIN
  IF p_per_page > 200 THEN p_per_page := 200; END IF;
  IF p_page < 1 THEN p_page := 1; END IF;
  v_offset := (p_page - 1) * p_per_page;
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors WHERE id = p_actor_id AND estado = 'active';
  IF v_catalog_id IS NULL THEN RAISE EXCEPTION 'ACTOR_NO_CATALOG' USING ERRCODE = 'no_data_found'; END IF;

  SELECT COUNT(*)::integer INTO v_total FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id
    AND (p_activa IS NULL OR activa = p_activa)
    AND (p_match_state IS NULL OR match_state = p_match_state);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'supplier_ref', o.supplier_ref, 'descripcion_comercial', o.descripcion_comercial,
    'precio_coste', o.precio_coste, 'precio_venta', o.precio_venta, 'unidad', o.unidad,
    'stock_disponible', o.stock_disponible, 'stock_cantidad', o.stock_cantidad,
    'plazo_entrega_dias', o.plazo_entrega_dias, 'activa', o.activa,
    'image_url', o.image_url, 'match_state', o.match_state, 'match_confidence', o.match_confidence,
    'updated_at', o.updated_at, 'created_at', o.created_at
  ) ORDER BY o.updated_at DESC), '[]'::jsonb) INTO v_data
  FROM public.trade_marketplace_supplier_offerings o
  WHERE o.supplier_catalog_id = v_catalog_id
    AND (p_activa IS NULL OR o.activa = p_activa)
    AND (p_match_state IS NULL OR o.match_state = p_match_state)
  LIMIT p_per_page OFFSET v_offset;

  RETURN jsonb_build_object('data', v_data,
    'pagination', jsonb_build_object('page', p_page, 'per_page', p_per_page, 'total', v_total,
      'pages', CEIL(v_total::numeric / NULLIF(p_per_page, 0))::integer));
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_api_catalog_products(uuid, integer, integer, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_catalog_products(uuid, integer, integer, boolean, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_api_catalog_products(uuid, integer, integer, boolean, text) FROM anon;;
