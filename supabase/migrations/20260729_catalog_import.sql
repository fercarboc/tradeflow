-- ═══════════════════════════════════════════════════════════════════════════════
-- MVP-1: Importación Masiva de Catálogo — Tablas, RLS y RPCs
-- Fecha: 2026-07-29
-- Requiere: 20260724_03_marketplace_portal_schema.sql aplicada
-- Idempotente: SÍ (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--              DROP POLICY IF EXISTS + CREATE POLICY)
--
-- FLUJO DE ESTADOS:
--   procesando_importacion
--     → pendiente_finalizacion  (auto, cuando chunks_recibidos = chunks_esperados)
--     → matching_pendiente      (finalize_catalog_import)
--     → matching_procesando     (outbox consumer — IMP-2)
--     → completado
--   En cualquier punto → error | cancelado
--
-- REANUDACIÓN SEGURA:
--   archivo_hash + chunk_size + mapping_config + parser_version se almacenan
--   al crear el import. El cliente los compara con el archivo actual antes de
--   reanudar; si difieren, no envía chunks. El servidor valida el hash por chunk.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. TABLA PRINCIPAL: trade_catalog_imports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_catalog_imports (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,

  -- Identificación del archivo fuente (para reanudación segura)
  nombre_archivo     text        NOT NULL,
  archivo_hash       text        NOT NULL,   -- SHA-256 del archivo fuente
  chunk_size         integer     NOT NULL,   -- filas por chunk acordadas al crear
  mapping_config     jsonb       NOT NULL DEFAULT '{}',  -- mapeo columna→campo
  parser_version     text        NOT NULL DEFAULT '1',   -- versión del parser del cliente

  -- Estado y modo
  estado             text        NOT NULL DEFAULT 'procesando_importacion',
  modo               text        NOT NULL DEFAULT 'append',

  -- Contadores de progreso
  total_filas        integer     NOT NULL,
  chunks_esperados   integer     NOT NULL,
  chunks_recibidos   integer     NOT NULL DEFAULT 0,
  filas_ok           integer     NOT NULL DEFAULT 0,
  filas_error        integer     NOT NULL DEFAULT 0,
  filas_duplicadas   integer     NOT NULL DEFAULT 0,   -- reservado para fase posterior

  -- Timestamps
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  created_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_import_estado CHECK (estado IN (
    'procesando_importacion',   -- chunks llegando desde el cliente
    'pendiente_finalizacion',   -- todos los chunks recibidos; esperando que el usuario llame finalize
    'matching_pendiente',       -- finalize ejecutado; outbox insertado
    'matching_procesando',      -- outbox consumer en proceso
    'completado',               -- matching IA terminado
    'error',                    -- error irrecuperable
    'cancelado'                 -- cancelado por el usuario
  )),
  CONSTRAINT chk_import_modo       CHECK (modo IN ('append')),
  CONSTRAINT chk_import_chunk_size CHECK (chunk_size BETWEEN 1 AND 500),
  CONSTRAINT chk_import_total_filas CHECK (total_filas >= 1),
  CONSTRAINT chk_import_chunks_esp  CHECK (chunks_esperados >= 1)
);

COMMENT ON TABLE public.trade_catalog_imports IS
  'Historial de importaciones de catálogo por actor proveedor.
   MVP-1: solo modo append/upsert. Modo replace en fase posterior.
   archivo_hash + chunk_size + mapping_config + parser_version garantizan
   reanudación segura: si el archivo cambia, el cliente bloquea la reanudación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. TABLA DE CHUNKS: trade_catalog_import_chunks
--     PK (import_id, chunk_index) = idempotencia por chunk.
--     chunk_hash permite detectar CHUNK_HASH_MISMATCH en reintentos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_catalog_import_chunks (
  import_id          uuid        NOT NULL
    REFERENCES public.trade_catalog_imports(id) ON DELETE CASCADE,
  chunk_index        integer     NOT NULL,
  chunk_hash         text        NOT NULL,
  filas_ok           integer     NOT NULL DEFAULT 0,
  filas_error        integer     NOT NULL DEFAULT 0,
  processed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (import_id, chunk_index)
);

COMMENT ON TABLE public.trade_catalog_import_chunks IS
  'Control de idempotencia por chunk. PK (import_id, chunk_index) garantiza unicidad.
   En reintento con mismo hash → devuelve resultado cacheado.
   En reintento con hash diferente → CHUNK_HASH_MISMATCH (datos distintos bajo mismo índice).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. TABLA DE ERRORES: trade_catalog_import_errors
--     Una fila por registro fallido. Append-only.
--     chunk_index = -1, fila_numero = -1 → error global del import.
--     datos_fila limitado a 2KB para evitar logs masivos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_catalog_import_errors (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id      uuid        NOT NULL
    REFERENCES public.trade_catalog_imports(id) ON DELETE CASCADE,
  chunk_index    integer     NOT NULL,
  fila_numero    integer     NOT NULL,
  supplier_ref   text,
  descripcion    text,
  motivo         text        NOT NULL,
  datos_fila     jsonb,      -- máx 2KB; truncado si supera el límite
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_catalog_import_errors IS
  'Un registro por fila rechazada. Append-only; nunca se modifica.
   chunk_index = -1, fila_numero = -1 → error global del import.
   datos_fila se trunca a ~2KB para evitar almacenamiento descontrolado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_catalog_imports_actor
  ON public.trade_catalog_imports(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_imports_estado_activos
  ON public.trade_catalog_imports(estado, updated_at DESC)
  WHERE estado NOT IN ('completado', 'cancelado', 'error');

CREATE INDEX IF NOT EXISTS idx_catalog_import_errors_import
  ON public.trade_catalog_import_errors(import_id, chunk_index, fila_numero);

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. TRIGGER updated_at en trade_catalog_imports
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_catalog_imports_updated_at'
      AND tgrelid = 'public.trade_catalog_imports'::regclass
  ) THEN
    CREATE TRIGGER trg_catalog_imports_updated_at
      BEFORE UPDATE ON public.trade_catalog_imports
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_catalog_imports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_catalog_import_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_catalog_import_errors  ENABLE ROW LEVEL SECURITY;

-- ── trade_catalog_imports ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "import_select_member" ON public.trade_catalog_imports;
DROP POLICY IF EXISTS "import_insert_deny"   ON public.trade_catalog_imports;
DROP POLICY IF EXISTS "import_update_deny"   ON public.trade_catalog_imports;
DROP POLICY IF EXISTS "import_delete_deny"   ON public.trade_catalog_imports;

CREATE POLICY "import_select_member" ON public.trade_catalog_imports
  FOR SELECT TO authenticated
  USING (public._mkt_has_permission(actor_id, 'offerings:write'));

CREATE POLICY "import_insert_deny" ON public.trade_catalog_imports
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "import_update_deny" ON public.trade_catalog_imports
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "import_delete_deny" ON public.trade_catalog_imports
  FOR DELETE TO authenticated USING (false);

-- ── trade_catalog_import_chunks ───────────────────────────────────────────────
-- Invisible para clientes autenticados. Solo SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "chunk_deny_all" ON public.trade_catalog_import_chunks;

CREATE POLICY "chunk_deny_all" ON public.trade_catalog_import_chunks
  FOR ALL TO authenticated USING (false);

-- ── trade_catalog_import_errors ───────────────────────────────────────────────
DROP POLICY IF EXISTS "import_errors_select_member" ON public.trade_catalog_import_errors;
DROP POLICY IF EXISTS "import_errors_insert_deny"   ON public.trade_catalog_import_errors;
DROP POLICY IF EXISTS "import_errors_update_deny"   ON public.trade_catalog_import_errors;

CREATE POLICY "import_errors_select_member" ON public.trade_catalog_import_errors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trade_catalog_imports i
      WHERE i.id = import_id
        AND public._mkt_has_permission(i.actor_id, 'offerings:write')
    )
  );

CREATE POLICY "import_errors_insert_deny" ON public.trade_catalog_import_errors
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "import_errors_update_deny" ON public.trade_catalog_import_errors
  FOR UPDATE TO authenticated USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. HELPER PRIVADO: _safe_datos_fila
--     Limita el payload de una fila a ~2KB para la tabla de errores.
--     Si supera el límite, sustituye por objeto con _truncated = true.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._safe_datos_fila(p_item jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN pg_column_size(p_item) > 2048
    THEN jsonb_build_object(
           '_truncated',    true,
           '_original_size', pg_column_size(p_item),
           '_preview',      left(p_item::text, 200)
         )
    ELSE p_item
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. RPC: create_catalog_import
--     Crea el registro del import y devuelve su id.
--     Llamado UNA VEZ por el wizard antes de enviar cualquier chunk.
--     Almacena los parámetros de reanudación segura.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_catalog_import(
  p_actor_id          uuid,
  p_nombre_archivo    text,
  p_archivo_hash      text,
  p_total_filas       integer,
  p_chunk_size        integer,
  p_chunks_esperados  integer,
  p_mapping_config    jsonb    DEFAULT '{}',
  p_parser_version    text     DEFAULT '1'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_import_id  uuid;
BEGIN
  -- Verificar permiso offerings:write
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verificar actor activo con catálogo asignado
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_NO_CATALOG: El actor no tiene catálogo de proveedor activo.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Validaciones de entrada
  IF trim(p_nombre_archivo) = '' OR p_nombre_archivo IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: nombre_archivo no puede estar vacío.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF trim(p_archivo_hash) = '' OR p_archivo_hash IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: archivo_hash no puede estar vacío.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_total_filas < 1 THEN
    RAISE EXCEPTION 'INVALID_INPUT: total_filas debe ser >= 1.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_chunk_size NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT: chunk_size debe estar entre 1 y 500.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_chunks_esperados < 1 THEN
    RAISE EXCEPTION 'INVALID_INPUT: chunks_esperados debe ser >= 1.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.trade_catalog_imports (
    actor_id,
    nombre_archivo,
    archivo_hash,
    total_filas,
    chunk_size,
    chunks_esperados,
    mapping_config,
    parser_version,
    created_by
  ) VALUES (
    p_actor_id,
    trim(p_nombre_archivo),
    p_archivo_hash,
    p_total_filas,
    p_chunk_size,
    p_chunks_esperados,
    COALESCE(p_mapping_config, '{}'),
    COALESCE(p_parser_version, '1'),
    auth.uid()
  )
  RETURNING id INTO v_import_id;

  RETURN v_import_id;
END;
$$;

COMMENT ON FUNCTION public.create_catalog_import IS
  'Crea registro de importación. Llamado una vez por el wizard.
   Almacena archivo_hash, chunk_size, mapping_config, parser_version para reanudación segura.
   El cliente compara estos campos con el archivo actual antes de reanudar;
   si difieren, no envía chunks.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. RPC: upsert_catalog_offerings_chunk
--
--     ATOMICIDAD: toda la función corre en UNA transacción PostgreSQL.
--     Si algo falla → todo hace rollback → cliente puede reintentar sin riesgo
--     de estado parcial ni doble cómputo.
--
--     IDEMPOTENCIA (doble capa):
--       a) Chunk procesado + mismo hash   → devuelve resultado cacheado.
--       b) Chunk procesado + hash distinto → CHUNK_HASH_MISMATCH (nunca aceptar
--          datos distintos bajo el mismo import_id + chunk_index).
--
--     REANUDACIÓN SEGURA:
--       El cliente envía p_archivo_hash con cada chunk. Si el hash no coincide
--       con el almacenado en el import → IMPORT_HASH_MISMATCH.
--
--     ERRORES POR FILA: BEGIN…EXCEPTION crea un SAVEPOINT por fila.
--       Fallo de una fila → rollback de esa fila + registro en errores → continúa.
--
--     TRANSICIÓN AUTOMÁTICA:
--       Cuando chunks_recibidos + 1 = chunks_esperados → estado cambia a
--       'pendiente_finalizacion'. El usuario llama a finalize_catalog_import
--       para avanzar a 'matching_pendiente'.
--
--     VALIDACIÓN match_state:
--       ON CONFLICT preserva match_state: offerings ya vinculados a UPs no
--       se resetean a pending_review por una actualización de precio.
--
--     LÍMITE datos_fila: truncado a ~2KB vía _safe_datos_fila().
--
--     Payload de cada item en p_items (jsonb array, máx chunk_size elementos):
--     {
--       "supplier_ref":          "SKU-001",   -- OBLIGATORIO
--       "descripcion_comercial": "Tornillo",  -- OBLIGATORIO
--       "precio_coste":          0.05,        -- opcional, null OK
--       "precio_venta":          0.12,        -- opcional, null OK
--       "unidad":                "cj",        -- opcional, default 'ud'
--       "stock_disponible":      true,        -- opcional, default true
--       "stock_cantidad":        5000,        -- opcional, null OK
--       "plazo_entrega_dias":    3,           -- opcional, default 5
--       "fila_original":         42           -- número de fila en el archivo fuente
--     }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_catalog_offerings_chunk(
  p_actor_id    uuid,
  p_import_id   uuid,
  p_chunk_index integer,
  p_chunk_hash  text,
  p_archivo_hash text,
  p_items       jsonb
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
  -- 1. Verificar permiso offerings:write
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Leer el import con bloqueo de fila para evitar race conditions en contadores
  SELECT * INTO v_import
  FROM public.trade_catalog_imports
  WHERE id = p_import_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Import % no encontrado.', p_import_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 3. Verificar que pertenece al actor indicado
  IF v_import.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Import no pertenece al actor indicado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 4. Verificar estado: solo aceptar chunks en procesando_importacion
  --    pendiente_finalizacion y estados terminales → no se aceptan más chunks
  IF v_import.estado <> 'procesando_importacion' THEN
    RAISE EXCEPTION 'INVALID_STATE: Import en estado "%" — no se aceptan más chunks.', v_import.estado
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 5. REANUDACIÓN SEGURA: verificar que el archivo no ha cambiado
  IF v_import.archivo_hash <> p_archivo_hash THEN
    RAISE EXCEPTION 'IMPORT_HASH_MISMATCH: El hash del archivo no coincide con el import original. archivo_hash original: %. Hash recibido: %. Cancela este import e inicia uno nuevo.',
      v_import.archivo_hash, p_archivo_hash
      USING ERRCODE = 'data_exception';
  END IF;

  -- 6. IDEMPOTENCIA: verificar si este chunk ya fue procesado
  SELECT chunk_hash, filas_ok, filas_error
  INTO v_cached_hash, v_cached_ok, v_cached_err
  FROM public.trade_catalog_import_chunks
  WHERE import_id = p_import_id AND chunk_index = p_chunk_index;

  IF FOUND THEN
    -- Chunk ya existe: validar hash
    IF v_cached_hash <> p_chunk_hash THEN
      RAISE EXCEPTION
        'CHUNK_HASH_MISMATCH: El chunk % del import % ya fue procesado con un hash diferente. Hash original: %. Hash recibido: %. No se aceptan datos distintos bajo el mismo índice de chunk.',
        p_chunk_index, p_import_id, v_cached_hash, p_chunk_hash
        USING ERRCODE = 'data_exception';
    END IF;
    -- Mismo hash → devolver resultado cacheado (reintento de red seguro)
    RETURN jsonb_build_object(
      'ok',      v_cached_ok,
      'errores', v_cached_err,
      'cached',  true
    );
  END IF;

  -- 7. Validaciones del payload
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: p_items no puede ser null ni vacío.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'CHUNK_TOO_LARGE: Máximo 500 filas por chunk. Recibidas: %.',
      jsonb_array_length(p_items)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 8. Resolver supplier_catalog_id del actor
  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_NO_CATALOG: El actor no tiene catálogo de proveedor activo.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 9. Procesar cada fila
  --    BEGIN…EXCEPTION por fila → SAVEPOINT. Fallo de una fila no afecta al resto.
  FOR v_idx IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item          := p_items -> v_idx;
    v_supplier_ref  := trim(v_item ->> 'supplier_ref');
    v_descripcion   := trim(v_item ->> 'descripcion_comercial');
    v_fila_original := COALESCE((v_item ->> 'fila_original')::integer, v_idx + 1);

    -- supplier_ref obligatorio
    IF v_supplier_ref IS NULL OR v_supplier_ref = '' THEN
      INSERT INTO public.trade_catalog_import_errors (
        import_id, chunk_index, fila_numero,
        supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        NULL, v_descripcion,
        'supplier_ref es obligatorio y no puede estar vacío',
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
      CONTINUE;
    END IF;

    -- descripcion_comercial obligatoria
    IF v_descripcion IS NULL OR v_descripcion = '' THEN
      INSERT INTO public.trade_catalog_import_errors (
        import_id, chunk_index, fila_numero,
        supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        v_supplier_ref, NULL,
        'descripcion_comercial es obligatoria y no puede estar vacía',
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
      CONTINUE;
    END IF;

    -- Upsert con SAVEPOINT por fila
    BEGIN
      INSERT INTO public.trade_marketplace_supplier_offerings (
        supplier_catalog_id,
        supplier_ref,
        descripcion_comercial,
        precio_coste,
        precio_venta,
        unidad,
        stock_disponible,
        stock_cantidad,
        plazo_entrega_dias,
        activa,
        match_state,
        metadata,
        updated_at
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
        -- match_state NO se toca: preservar vinculaciones a UPs existentes.
        -- Un offering matched/suggested no regresa a pending_review por un price update.
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
        import_id, chunk_index, fila_numero,
        supplier_ref, descripcion, motivo, datos_fila
      ) VALUES (
        p_import_id, p_chunk_index, v_fila_original,
        v_supplier_ref, v_descripcion,
        SQLERRM,
        public._safe_datos_fila(v_item)
      );
      v_errores := v_errores + 1;
    END;
  END LOOP;

  -- 10. Registrar chunk como procesado
  --     Esta INSERT es parte de la misma transacción que los upserts:
  --     todo se confirma junto o nada. Sin estado parcial posible.
  INSERT INTO public.trade_catalog_import_chunks (
    import_id, chunk_index, chunk_hash, filas_ok, filas_error
  ) VALUES (
    p_import_id, p_chunk_index, p_chunk_hash, v_ok, v_errores
  );

  -- 11. Calcular nuevo estado: ¿es este el último chunk?
  v_chunks_tras_este := v_import.chunks_recibidos + 1;

  IF v_chunks_tras_este >= v_import.chunks_esperados THEN
    v_nuevo_estado := 'pendiente_finalizacion';
  ELSE
    v_nuevo_estado := 'procesando_importacion';
  END IF;

  -- 12. Actualizar contadores del import atómicamente
  UPDATE public.trade_catalog_imports SET
    chunks_recibidos = v_chunks_tras_este,
    filas_ok         = filas_ok + v_ok,
    filas_error      = filas_error + v_errores,
    estado           = v_nuevo_estado,
    updated_at       = now()
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'ok',                 v_ok,
    'errores',            v_errores,
    'cached',             false,
    'nuevo_estado',       v_nuevo_estado,
    'chunks_recibidos',   v_chunks_tras_este,
    'chunks_esperados',   v_import.chunks_esperados
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_catalog_offerings_chunk IS
  'Bulk upsert idempotente de un chunk (máx 500 filas).
   Una transacción PG: todo se confirma o nada.
   Idempotencia de chunk: mismo hash → caché; hash distinto → CHUNK_HASH_MISMATCH.
   Reanudación segura: p_archivo_hash validado contra import original.
   SAVEPOINT por fila para error-isolation. ON CONFLICT preserva match_state.
   Transición automática a pendiente_finalizacion cuando llega el último chunk.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPC: finalize_catalog_import
--     Transición: pendiente_finalizacion → matching_pendiente.
--     Inserta evento en outbox para lanzar matching IA (IMP-2).
--     Solo callable desde pendiente_finalizacion.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_catalog_import(
  p_import_id uuid,
  p_actor_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_import record;
BEGIN
  -- Verificar permiso
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Leer import
  SELECT * INTO v_import
  FROM public.trade_catalog_imports
  WHERE id = p_import_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Import % no encontrado.', p_import_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_import.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Import no pertenece al actor indicado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Solo aceptar desde pendiente_finalizacion
  IF v_import.estado <> 'pendiente_finalizacion' THEN
    RAISE EXCEPTION
      'INVALID_STATE: finalize solo puede llamarse desde pendiente_finalizacion. Estado actual: "%".',
      v_import.estado
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Transición → matching_pendiente
  UPDATE public.trade_catalog_imports SET
    estado       = 'matching_pendiente',
    completed_at = now(),
    updated_at   = now()
  WHERE id = p_import_id;

  -- Lanzar matching IA vía outbox (solo si hay filas importadas correctamente)
  -- IMP-2 (trade-catalog-match Edge Function) consumirá este evento.
  -- Si filas_ok = 0, no hay nada que hacer para el matching.
  IF v_import.filas_ok > 0 THEN
    INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload)
    VALUES (
      p_actor_id,
      'catalog.import_completed',
      jsonb_build_object(
        'import_id',    p_import_id,
        'actor_id',     p_actor_id,
        'filas_ok',     v_import.filas_ok,
        'triggered_at', now()
      )
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.finalize_catalog_import IS
  'Finaliza importación desde pendiente_finalizacion → matching_pendiente.
   Inserta catalog.import_completed en outbox para matching IA.
   IMP-2 (Edge Function trade-catalog-match) procesará el evento.
   No cancelable después de esta llamada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC: fail_catalog_import
--     Marca el import como error desde el cliente cuando el proceso falla
--     de forma irrecuperable. Idempotente si ya en estado terminal.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fail_catalog_import(
  p_import_id uuid,
  p_actor_id  uuid,
  p_motivo    text DEFAULT 'Error desconocido'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_import record;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_import
  FROM public.trade_catalog_imports
  WHERE id = p_import_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Import % no encontrado.', p_import_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_import.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Import no pertenece al actor indicado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Idempotente: ya en estado terminal
  IF v_import.estado IN ('completado', 'error', 'cancelado') THEN
    RETURN;
  END IF;

  UPDATE public.trade_catalog_imports SET
    estado       = 'error',
    completed_at = now(),
    updated_at   = now()
  WHERE id = p_import_id;

  -- Log del error global (chunk_index = -1, fila_numero = -1 = no es un error por fila)
  INSERT INTO public.trade_catalog_import_errors (
    import_id, chunk_index, fila_numero, motivo
  ) VALUES (
    p_import_id, -1, -1,
    COALESCE(NULLIF(trim(p_motivo), ''), 'Error desconocido')
  );
END;
$$;

COMMENT ON FUNCTION public.fail_catalog_import IS
  'Marca import como error. Idempotente si ya en estado terminal.
   chunk_index = -1 / fila_numero = -1 = error global (no por fila).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RPC: cancel_catalog_import
--     Cancela importación en curso. Filas ya importadas permanecen (modo append).
--     No cancelable en estados de matching ni terminales.
--     Idempotente: si ya en estado terminal → no hace nada.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_catalog_import(
  p_import_id uuid,
  p_actor_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_import record;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:write') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_import
  FROM public.trade_catalog_imports
  WHERE id = p_import_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Import % no encontrado.', p_import_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_import.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Import no pertenece al actor indicado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Idempotente: ya en estado terminal
  IF v_import.estado IN ('completado', 'cancelado', 'error') THEN
    RETURN;
  END IF;

  -- No cancelable si el matching ya comenzó
  IF v_import.estado IN ('matching_pendiente', 'matching_procesando') THEN
    RAISE EXCEPTION
      'INVALID_STATE: El matching IA está en curso (estado: "%"). No se puede cancelar.',
      v_import.estado
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Cancelable desde: procesando_importacion, pendiente_finalizacion
  UPDATE public.trade_catalog_imports SET
    estado       = 'cancelado',
    completed_at = now(),
    updated_at   = now()
  WHERE id = p_import_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_catalog_import IS
  'Cancela importación desde procesando_importacion o pendiente_finalizacion.
   Filas ya importadas permanecen (modo append).
   Idempotente si ya en estado terminal. No cancelable en matching_pendiente/procesando.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public._safe_datos_fila               TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_catalog_import          TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_offerings_chunk TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_catalog_import        TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_catalog_import            TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_import          TO authenticated;
