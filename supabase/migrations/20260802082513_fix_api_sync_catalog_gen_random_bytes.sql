
-- Fix: gen_random_bytes(8) está en extensions schema, excluido del search_path 'public'
-- Reemplazar con gen_random_uuid() nativo (disponible en public sin extensión)
CREATE OR REPLACE FUNCTION public.api_sync_catalog_offerings(
  p_actor_id uuid,
  p_items jsonb,
  p_source_system text DEFAULT NULL,
  p_sync_log_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'api_' || replace(gen_random_uuid()::text, '-', ''),  -- fix: gen_random_uuid() nativo
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
END;
$function$;
;
