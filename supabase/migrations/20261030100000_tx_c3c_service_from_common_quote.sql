-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C3-C — Conversión presupuesto común de Transporte → Servicio de transporte
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Cuando un cliente acepta un presupuesto común (trade_quotes) cuya metadata
-- contiene vertical='transporte', se crea automáticamente UN único servicio
-- de transporte en estado borrador, tanto desde la aceptación pública (WhatsApp)
-- como desde el panel interno.
--
-- PIEZAS:
--   1. UNIQUE(quote_id) en trade_transport_services  → idempotencia DB
--   2. Columna iva_pct (snapshot fiscal)
--   3. Columna intake_data (trazabilidad del intake completo)
--   4. RPC create_transport_service_from_quote       → contrato único de conversión
--
-- INVARIANTES:
--   · Ningún presupuesto de instaladores ni otra vertical genera un servicio.
--   · Servicios recurrentes (tipo_servicio='recurrente') NO se convierten en
--     servicios puntuales; la función devuelve RECURRENTE_DEFERRED.
--   · La conversión es idempotente: un segundo call devuelve el mismo service_id.
--   · No se emite ninguna factura automáticamente.
--   · El estado inicial del servicio siempre es 'borrador'.
--   · No se toca Stripe, VeriFactu ni tablas TX-C2.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. UNIQUE(quote_id) para idempotencia ────────────────────────────────────
--
-- PostgreSQL trata NULLs como distintos en UNIQUE constraints: múltiples filas
-- con quote_id = NULL son válidas. Solo los valores NOT NULL deben ser únicos.
-- Esta constraint garantiza que un presupuesto común nunca genere dos servicios.
-- Se usa DO/EXCEPTION para ser idempotente frente a re-ejecuciones.

DO $$ BEGIN
  ALTER TABLE public.trade_transport_services
    ADD CONSTRAINT tts_unique_common_quote_id UNIQUE (quote_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Columna iva_pct — snapshot fiscal ─────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.trade_transport_services
    ADD COLUMN iva_pct numeric(5,2);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 3. Columna intake_data — trazabilidad completa ───────────────────────────
-- Almacena la metadata completa del presupuesto en el momento de la conversión.
-- Incluye transport_intake, precio con/sin IVA, campos_pendientes e itinerario.
-- Esto garantiza que no se pierda información aunque las columnas operativas
-- del servicio (origen, destino, paradas…) no puedan almacenar todo.

DO $$ BEGIN
  ALTER TABLE public.trade_transport_services
    ADD COLUMN intake_data jsonb DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 4. RPC: create_transport_service_from_quote ───────────────────────────────
--
-- CONTRATO:
--   IN:  p_org_id  uuid  — organización propietaria del presupuesto
--        p_quote_id uuid  — UUID del presupuesto en trade_quotes
--   OUT: jsonb
--     · {ok:true,  service_id:uuid, idempotent:bool}     — éxito o reintento
--     · {ok:false, code:'RECURRENTE_DEFERRED', message}  — servicio recurrente
--
-- SEGURIDAD:
--   · SECURITY DEFINER: bypass RLS para INSERT en trade_transport_services.
--   · Si auth.uid() IS NOT NULL (panel interno): verifica pertenencia a org.
--   · Si auth.uid() IS NULL (service_role / Edge Function): confía en p_org_id
--     que el caller (trade-quote-public) ya validó desde el token.
--   · SELECT FOR UPDATE sobre trade_quotes previene race conditions.
--   · UNIQUE(quote_id) + manejo de unique_violation garantiza idempotencia
--     incluso bajo llamadas concurrentes.
--
-- MAPEO tipo_servicio (intake → DB):
--   circuito_turistico → circuito     (valor canónico en DB)
--   discrecional       → otro
--   recurrente         → RECURRENTE_DEFERRED (sin INSERT)
--   cualquier otro no reconocido → otro

CREATE OR REPLACE FUNCTION public.create_transport_service_from_quote(
  p_org_id   uuid,
  p_quote_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quote        record;
  v_intake       jsonb;
  v_service_id   uuid;
  v_tipo         text;
  v_titulo       text;
  v_fecha_inicio timestamptz;
  v_fecha_fin    timestamptz;
  v_paradas      jsonb;
  v_num_viajeros integer;
  v_precio_base  numeric;
  v_iva_pct      numeric;
  v_obs_parts    text[];
  v_obs_item     text;
  v_observaciones text;
BEGIN
  -- ── 1. Autorización ───────────────────────────────────────────────────────
  -- Con sesión autenticada (panel): verificar pertenencia a la org.
  -- Sin sesión (service_role/Edge Function): confiar en p_org_id ya validado.
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations
       WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members
       WHERE org_id = p_org_id AND user_id = auth.uid() AND activo = true
    ) THEN
      RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos en esta organización'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- ── 2. Bloquear y leer el presupuesto ─────────────────────────────────────
  -- FOR UPDATE previene que dos llamadas concurrentes procesen el mismo presupuesto.
  SELECT * INTO v_quote
  FROM public.trade_quotes
  WHERE id = p_quote_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: presupuesto no encontrado o no pertenece a la organización'
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 3. Validar estado Aceptado ────────────────────────────────────────────
  IF v_quote.estado <> 'Aceptado' THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: el presupuesto debe estar en estado Aceptado (actual: %)', v_quote.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Validar vertical transporte ────────────────────────────────────────
  IF COALESCE(v_quote.metadata->>'vertical', '') <> 'transporte' THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: vertical incorrecta — se esperaba transporte, actual: %',
      COALESCE(v_quote.metadata->>'vertical', 'nula')
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. Obtener intake data ────────────────────────────────────────────────
  v_intake := v_quote.metadata->'transport_intake'->'intake';
  IF v_intake IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: transport_intake no encontrado en metadata del presupuesto'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Idempotencia: ¿ya existe un servicio para este presupuesto? ─────────
  SELECT id INTO v_service_id
  FROM public.trade_transport_services
  WHERE quote_id = p_quote_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'service_id', v_service_id, 'idempotent', true);
  END IF;

  -- ── 7. Mapear tipo_servicio (intake → DB) ─────────────────────────────────
  v_tipo := LOWER(TRIM(COALESCE(v_intake->>'tipo_servicio', '')));

  -- Servicios recurrentes: arquitectura diferente, no crear servicio puntual
  IF v_tipo = 'recurrente' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'RECURRENTE_DEFERRED',
      'message', 'Los servicios recurrentes requieren programación desde el módulo de Rutas Recurrentes. Crea la plantilla allí y materializa las ocurrencias.'
    );
  END IF;

  -- Mapeo valores intake → valores DB
  IF v_tipo = 'circuito_turistico' THEN v_tipo := 'circuito'; END IF;
  IF v_tipo = 'discrecional'       THEN v_tipo := 'otro';     END IF;
  -- Valores ya válidos en DB: excursion, traslado_empresa, traslado_privado,
  --   ruta_escolar, aeropuerto, otro, circuito, viaje_multidia,
  --   transporte_trabajadores, lanzadera, congreso_evento,
  --   servicio_deportivo, asociacion_grupo
  IF v_tipo NOT IN (
    'ruta_escolar','excursion','traslado_empresa','traslado_privado','aeropuerto','otro',
    'circuito','viaje_multidia','transporte_trabajadores','lanzadera','congreso_evento',
    'servicio_deportivo','asociacion_grupo'
  ) THEN
    v_tipo := 'otro';
  END IF;

  -- ── 8. Extraer y normalizar campos del intake ─────────────────────────────

  -- Título: origen → destino si hay, si no descripción del presupuesto
  v_titulo := NULLIF(TRIM(
    CONCAT_WS(' → ',
      NULLIF(TRIM(COALESCE(v_intake->>'origen',  '')), ''),
      NULLIF(TRIM(COALESCE(v_intake->>'destino', '')), '')
    )
  ), '');
  v_titulo := COALESCE(v_titulo, NULLIF(TRIM(COALESCE(v_quote.descripcion, '')), ''), 'Servicio de transporte');

  -- fecha_inicio: fecha_servicio del intake + hora 08:00; fallback: now()
  v_fecha_inicio := now();
  IF v_intake->>'fecha_servicio' IS NOT NULL AND v_intake->>'fecha_servicio' <> '' THEN
    BEGIN
      v_fecha_inicio := ((v_intake->>'fecha_servicio')::date)::timestamptz + INTERVAL '8 hours';
    EXCEPTION WHEN others THEN
      v_fecha_inicio := now();
    END;
  END IF;

  -- fecha_fin: para viajes multidía
  v_fecha_fin := NULL;
  IF v_intake->>'fecha_fin_servicio' IS NOT NULL AND v_intake->>'fecha_fin_servicio' <> '' THEN
    BEGIN
      v_fecha_fin := ((v_intake->>'fecha_fin_servicio')::date)::timestamptz + INTERVAL '23 hours 59 minutes';
    EXCEPTION WHEN others THEN
      v_fecha_fin := NULL;
    END;
  END IF;

  -- Paradas: mapeadas desde itinerario []string → [{nombre:...}]
  v_paradas := '[]'::jsonb;
  IF jsonb_array_length(COALESCE(v_intake->'itinerario', '[]'::jsonb)) > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('nombre', elem::text))
    INTO   v_paradas
    FROM   jsonb_array_elements_text(COALESCE(v_intake->'itinerario', '[]'::jsonb)) elem;
    v_paradas := COALESCE(v_paradas, '[]'::jsonb);
  END IF;

  -- num_viajeros
  v_num_viajeros := NULL;
  IF v_intake->>'num_viajeros' IS NOT NULL AND v_intake->>'num_viajeros' <> 'null' THEN
    BEGIN
      v_num_viajeros := (v_intake->>'num_viajeros')::integer;
    EXCEPTION WHEN others THEN v_num_viajeros := NULL; END;
  END IF;

  -- Precio base (neto):
  --   · precio_incluye_iva=true  → revertir IVA para obtener base imponible
  --   · precio_incluye_iva=false → precio_base ya es el neto
  v_iva_pct    := COALESCE(v_quote.iva_pct, 21);
  v_precio_base := NULL;
  IF v_intake->>'precio_base' IS NOT NULL AND v_intake->>'precio_base' <> 'null' THEN
    BEGIN
      DECLARE v_precio_raw numeric := (v_intake->>'precio_base')::numeric;
      BEGIN
        IF COALESCE((v_intake->>'precio_incluye_iva')::boolean, false) THEN
          -- Precio con IVA incluido: precio_neto = precio_total / (1 + iva%)
          v_precio_base := round(v_precio_raw / (1 + v_iva_pct / 100.0), 2);
        ELSE
          v_precio_base := v_precio_raw;
        END IF;
      END;
    EXCEPTION WHEN others THEN v_precio_base := NULL; END;
  END IF;

  -- Observaciones: condiciones_especiales + aviso de campos pendientes
  v_obs_parts := ARRAY[]::text[];
  IF jsonb_array_length(COALESCE(v_intake->'condiciones_especiales', '[]'::jsonb)) > 0 THEN
    SELECT string_agg(elem, '. ') INTO v_obs_item
    FROM   jsonb_array_elements_text(v_intake->'condiciones_especiales') elem;
    v_obs_parts := array_append(v_obs_parts, v_obs_item);
  END IF;
  IF jsonb_array_length(COALESCE(v_intake->'campos_pendientes', '[]'::jsonb)) > 0 THEN
    SELECT 'Datos pendientes: ' || string_agg(elem, ', ') INTO v_obs_item
    FROM   jsonb_array_elements_text(v_intake->'campos_pendientes') elem;
    v_obs_parts := array_append(v_obs_parts, v_obs_item);
  END IF;
  v_observaciones := NULLIF(array_to_string(v_obs_parts, E'\n'), '');

  -- ── 9. Insertar servicio + gestión de unique_violation concurrente ─────────
  BEGIN
    INSERT INTO public.trade_transport_services (
      org_id, quote_id, client_id,
      titulo, tipo_servicio, estado,
      fecha_inicio, fecha_fin,
      origen, destino, paradas,
      num_viajeros,
      precio_acordado, iva_pct,
      observaciones, intake_data
    ) VALUES (
      p_org_id,
      p_quote_id,
      v_quote.client_id,
      v_titulo,
      v_tipo,
      'borrador',
      v_fecha_inicio,
      v_fecha_fin,
      NULLIF(TRIM(COALESCE(v_intake->>'origen',  '')), ''),
      NULLIF(TRIM(COALESCE(v_intake->>'destino', '')), ''),
      v_paradas,
      v_num_viajeros,
      v_precio_base,
      v_iva_pct,
      v_observaciones,
      v_quote.metadata
    )
    RETURNING id INTO v_service_id;

  EXCEPTION WHEN unique_violation THEN
    -- Llamada concurrente: otro proceso ya insertó el servicio.
    -- La constraint tts_unique_common_quote_id garantiza que solo exista uno.
    SELECT id INTO v_service_id
    FROM   public.trade_transport_services
    WHERE  quote_id = p_quote_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'TRANSPORT_CONCURRENT_ERROR: violación de unicidad no resuelta para quote_id=%', p_quote_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'service_id', v_service_id, 'idempotent', true);
  END;

  -- ── 10. Actualizar metadata del presupuesto con el service_id ─────────────
  -- Permite al frontend mostrar el enlace "Abrir servicio" sin un SELECT extra.
  UPDATE public.trade_quotes
  SET    metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{transport_service_id}',
           to_jsonb(v_service_id::text)
         )
  WHERE  id = p_quote_id AND org_id = p_org_id;

  RETURN jsonb_build_object('ok', true, 'service_id', v_service_id, 'idempotent', false);
END;
$$;

-- Permisos: disponible para usuarios autenticados (panel) y service_role (Edge Function)
REVOKE ALL ON FUNCTION public.create_transport_service_from_quote(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_transport_service_from_quote(uuid, uuid) TO authenticated;
-- service_role tiene EXECUTE implícito por ser superusuario en Supabase
