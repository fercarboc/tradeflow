-- Fix: mover la comprobación de chunk cacheado ANTES de la comprobación de estado.
-- Bug: el reintento del último chunk devolvía INVALID_STATE en lugar de cached:true
-- porque el import ya había auto-transitado a pendiente_finalizacion.
-- Escenario roto: cliente envía último chunk → servidor procesa OK → red corta antes
-- de que el cliente reciba la respuesta → cliente reintenta → INVALID_STATE.

CREATE OR REPLACE FUNCTION public.upsert_catalog_offerings_chunk(
  p_actor_id     uuid,
  p_import_id    uuid,
  p_chunk_index  integer,
  p_chunk_hash   text,
  p_archivo_hash text,
  p_items        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_import            record;
  v_catalog_id        uuid;
  v_ok                integer := 0;
  v_errores           integer := 0;
  v_item              jsonb;
  v_idx               integer;
  v_supplier_ref      text;
  v_descripcion       text;
  v_fila_original     integer;
  v_cached_hash       text;
  v_cached_ok         integer;
  v_cached_err        integer;
  v_nuevo_estado      text;
  v_chunks_tras_este  integer;
BEGIN
  -- 1. Permiso
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Bloquear el import (FOR UPDATE) para serializar actualizaciones de contadores
  SELECT * INTO v_import
  FROM public.trade_catalog_imports
  WHERE id = p_import_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Import % no encontrado.', p_import_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 3. Verificar que el import pertenece al actor indicado
  IF v_import.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Import no pertenece al actor indicado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 4. Comprobar si el chunk ya fue procesado (ANTES del check de estado).
  --    Esto garantiza idempotencia incluso si el import ya auto-transicionó a
  --    pendiente_finalizacion tras recibir el último chunk.
  SELECT chunk_hash, filas_ok, filas_error
  INTO v_cached_hash, v_cached_ok, v_cached_err
  FROM public.trade_catalog_import_chunks
  WHERE import_id = p_import_id AND chunk_index = p_chunk_index;

  IF FOUND THEN
    IF v_cached_hash <> p_chunk_hash THEN
      RAISE EXCEPTION
        'CHUNK_HASH_MISMATCH: Chunk % ya procesado con hash diferente. Original: %. Recibido: %.',
        p_chunk_index, v_cached_hash, p_chunk_hash
        USING ERRCODE = 'data_exception';
    END IF;
    -- Mismo hash → resultado cacheado, sin tocar catálogo ni contadores
    RETURN jsonb_build_object(
      'ok',      v_cached_ok,
      'errores', v_cached_err,
      'cached',  true
    );
  END IF;

  -- 5. Chunk nuevo → verificar estado de la importación
  IF v_import.estado <> 'procesando_importacion' THEN
    RAISE EXCEPTION 'INVALID_STATE: Import en estado "%" — no se aceptan más chunks.', v_import.estado
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 6. Verificar integridad del archivo (previene mezcla de archivos distintos)
  IF v_import.archivo_hash <> p_archivo_hash THEN
    RAISE EXCEPTION
      'IMPORT_HASH_MISMATCH: El hash del archivo no coincide con el import original. Original: %. Recibido: %.',
      v_import.archivo_hash, p_archivo_hash
      USING ERRCODE = 'data_exception';
  END IF;

  -- 7. Validar tamaño del chunk
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: p_items no puede ser null ni vacío.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'CHUNK_TOO_LARGE: Máximo 500 filas por chunk. Recibidas: %.', jsonb_array_length(p_items)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 8. Obtener catálogo del actor
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_NO_CATALOG: El actor no tiene catálogo de proveedor activo.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 9. Procesar filas — SAVEPOINT implícito por fila mediante BEGIN/EXCEPTION
  FOR v_idx IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item          := p_items -> v_idx;
    v_supplier_ref  := trim(v_item ->> 'supplier_ref');
    v_descripcion   := trim(v_item ->> 'descripcion_comercial');
    v_fila_original := COALESCE((v_item ->> 'fila_original')::integer, v_idx + 1);

    IF v_supplier_ref IS NULL OR v_supplier_ref = '' THEN
      INSERT INTO public.trade_catalog_import_errors (
        import_id, chunk_index, fila_numero, supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        NULL, v_descripcion,
        'supplier_ref es obligatorio y no puede estar vacío',
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
      CONTINUE;
    END IF;

    IF v_descripcion IS NULL OR v_descripcion = '' THEN
      INSERT INTO public.trade_catalog_import_errors (
        import_id, chunk_index, fila_numero, supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        v_supplier_ref, NULL,
        'descripcion_comercial es obligatoria y no puede estar vacía',
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.trade_marketplace_supplier_offerings (
        supplier_catalog_id, supplier_ref, descripcion_comercial,
        precio_coste, precio_venta, unidad, stock_disponible, stock_cantidad,
        plazo_entrega_dias, activa, match_state, metadata, updated_at
      ) VALUES (
        v_catalog_id,
        v_supplier_ref,
        v_descripcion,
        NULLIF(v_item ->> 'precio_coste',       '')::numeric,
        NULLIF(v_item ->> 'precio_venta',        '')::numeric,
        COALESCE(NULLIF(trim(v_item ->> 'unidad'), ''), 'ud'),
        COALESCE((v_item ->> 'stock_disponible')::boolean, true),
        NULLIF(v_item ->> 'stock_cantidad',      '')::integer,
        COALESCE(NULLIF(v_item ->> 'plazo_entrega_dias', '')::integer, 5),
        true,
        'pending_review',
        jsonb_build_object(
          'last_import_id', p_import_id,
          'fila_original',  v_fila_original,
          'imported_at',    now()
        ),
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
        metadata              = public.trade_marketplace_supplier_offerings.metadata
                                || jsonb_build_object(
                                     'last_import_id', p_import_id,
                                     'fila_original',  v_fila_original,
                                     'imported_at',    now()
                                   ),
        updated_at            = now();

      v_ok := v_ok + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.trade_catalog_import_errors (
        import_id, chunk_index, fila_numero, supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        v_supplier_ref, v_descripcion, SQLERRM,
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
    END;
  END LOOP;

  -- 10. Registrar el chunk (PK import_id, chunk_index garantiza idempotencia)
  INSERT INTO public.trade_catalog_import_chunks (
    import_id, chunk_index, chunk_hash, filas_ok, filas_error
  ) VALUES (
    p_import_id, p_chunk_index, p_chunk_hash, v_ok, v_errores
  );

  -- 11. Actualizar contadores y determinar nuevo estado
  v_chunks_tras_este := v_import.chunks_recibidos + 1;
  IF v_chunks_tras_este >= v_import.chunks_esperados THEN
    v_nuevo_estado := 'pendiente_finalizacion';
  ELSE
    v_nuevo_estado := 'procesando_importacion';
  END IF;

  UPDATE public.trade_catalog_imports SET
    chunks_recibidos = v_chunks_tras_este,
    filas_ok         = filas_ok + v_ok,
    filas_error      = filas_error + v_errores,
    estado           = v_nuevo_estado,
    updated_at       = now()
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'ok',               v_ok,
    'errores',          v_errores,
    'cached',           false,
    'nuevo_estado',     v_nuevo_estado,
    'chunks_recibidos', v_chunks_tras_este,
    'chunks_esperados', v_import.chunks_esperados
  );
END;
$$;
