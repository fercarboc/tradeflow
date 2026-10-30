-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C3-PH0-FIX-2 — Guard: operativa de Transporte habilitada en la org
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Problema: create_transport_service_from_quote no verificaba transport_enabled
-- en la organización. Un instalador cuya org no tiene operativa de transporte
-- podía forzar la creación de un servicio de transporte simplemente enviando un
-- presupuesto con vertical=transporte.
--
-- Fix: añadir paso 1b entre la comprobación de permisos y la lectura del
-- presupuesto. Si la org tiene transport_enabled=false, devolver
-- ORG_NO_TRANSPORT_CAPABILITY en lugar de crear el servicio.
--
-- CRITERIO AUTORIZADO: trade_organizations.transport_enabled = true
-- No se infiere de oficio, transport_modalidad ni metadata del presupuesto.
-- Solo transport_enabled es autoritativo (protegido por trg_protect_transport_enabled).
--
-- INVARIANTES TRAS FIX:
--   · Solo orgs con transport_enabled=true obtienen servicios de transporte.
--   · Un instalador SÍ puede crear y enviar presupuestos de vertical=transporte
--     (workflow multivertical), pero la conversión a servicio queda bloqueada.
--   · Los checks existentes (estado=Aceptado, vertical=transporte, intake) se mantienen.
--   · La idempotencia (UNIQUE quote_id) no cambia.
-- ══════════════════════════════════════════════════════════════════════════════

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
  v_quote              record;
  v_intake             jsonb;
  v_service_id         uuid;
  v_tipo               text;
  v_titulo             text;
  v_fecha_inicio       timestamptz;
  v_fecha_fin          timestamptz;
  v_paradas            jsonb;
  v_num_viajeros       integer;
  v_precio_base        numeric;
  v_iva_pct            numeric;
  v_obs_parts          text[];
  v_obs_item           text;
  v_observaciones      text;
  v_transport_enabled  boolean;
BEGIN
  -- ── 1. Autorización ───────────────────────────────────────────────────────
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

  -- ── 1b. Verificar operativa de Transporte habilitada en la org ────────────
  -- Criterio autorizado: trade_organizations.transport_enabled = true.
  -- Un instalador puede crear presupuestos de vertical=transporte (multivertical),
  -- pero la conversión a servicio requiere que la org tenga la operativa activa.
  SELECT transport_enabled INTO v_transport_enabled
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF NOT COALESCE(v_transport_enabled, false) THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'code',   'ORG_NO_TRANSPORT_CAPABILITY',
      'message','Esta organización no tiene la operativa de Transporte habilitada. Actívala desde el panel de administración.'
    );
  END IF;

  -- ── 2. Bloquear y leer el presupuesto ─────────────────────────────────────
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

  IF v_tipo = 'recurrente' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'RECURRENTE_DEFERRED',
      'message', 'Los servicios recurrentes requieren programación desde el módulo de Rutas Recurrentes. Crea la plantilla allí y materializa las ocurrencias.'
    );
  END IF;

  IF v_tipo = 'circuito_turistico' THEN v_tipo := 'circuito'; END IF;
  IF v_tipo = 'discrecional'       THEN v_tipo := 'otro';     END IF;
  IF v_tipo NOT IN (
    'ruta_escolar','excursion','traslado_empresa','traslado_privado','aeropuerto','otro',
    'circuito','viaje_multidia','transporte_trabajadores','lanzadera','congreso_evento',
    'servicio_deportivo','asociacion_grupo'
  ) THEN
    v_tipo := 'otro';
  END IF;

  -- ── 8. Extraer y normalizar campos del intake ─────────────────────────────

  v_titulo := NULLIF(TRIM(
    CONCAT_WS(' → ',
      NULLIF(TRIM(COALESCE(v_intake->>'origen',  '')), ''),
      NULLIF(TRIM(COALESCE(v_intake->>'destino', '')), '')
    )
  ), '');
  v_titulo := COALESCE(v_titulo, NULLIF(TRIM(COALESCE(v_quote.descripcion, '')), ''), 'Servicio de transporte');

  v_fecha_inicio := now();
  IF v_intake->>'fecha_servicio' IS NOT NULL AND v_intake->>'fecha_servicio' <> '' THEN
    BEGIN
      v_fecha_inicio := ((v_intake->>'fecha_servicio')::date)::timestamptz + INTERVAL '8 hours';
    EXCEPTION WHEN others THEN
      v_fecha_inicio := now();
    END;
  END IF;

  v_fecha_fin := NULL;
  IF v_intake->>'fecha_fin_servicio' IS NOT NULL AND v_intake->>'fecha_fin_servicio' <> '' THEN
    BEGIN
      v_fecha_fin := ((v_intake->>'fecha_fin_servicio')::date)::timestamptz + INTERVAL '23 hours 59 minutes';
    EXCEPTION WHEN others THEN
      v_fecha_fin := NULL;
    END;
  END IF;

  v_paradas := '[]'::jsonb;
  IF jsonb_array_length(COALESCE(v_intake->'itinerario', '[]'::jsonb)) > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('nombre', elem::text))
    INTO   v_paradas
    FROM   jsonb_array_elements_text(COALESCE(v_intake->'itinerario', '[]'::jsonb)) elem;
    v_paradas := COALESCE(v_paradas, '[]'::jsonb);
  END IF;

  v_num_viajeros := NULL;
  IF v_intake->>'num_viajeros' IS NOT NULL AND v_intake->>'num_viajeros' <> 'null' THEN
    BEGIN
      v_num_viajeros := (v_intake->>'num_viajeros')::integer;
    EXCEPTION WHEN others THEN v_num_viajeros := NULL; END;
  END IF;

  v_iva_pct    := COALESCE(v_quote.iva_pct, 21);
  v_precio_base := NULL;
  IF v_intake->>'precio_base' IS NOT NULL AND v_intake->>'precio_base' <> 'null' THEN
    BEGIN
      DECLARE v_precio_raw numeric := (v_intake->>'precio_base')::numeric;
      BEGIN
        IF COALESCE((v_intake->>'precio_incluye_iva')::boolean, false) THEN
          v_precio_base := round(v_precio_raw / (1 + v_iva_pct / 100.0), 2);
        ELSE
          v_precio_base := v_precio_raw;
        END IF;
      END;
    EXCEPTION WHEN others THEN v_precio_base := NULL; END;
  END IF;

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
    SELECT id INTO v_service_id
    FROM   public.trade_transport_services
    WHERE  quote_id = p_quote_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'TRANSPORT_CONCURRENT_ERROR: violación de unicidad no resuelta para quote_id=%', p_quote_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'service_id', v_service_id, 'idempotent', true);
  END;

  -- ── 10. Actualizar metadata del presupuesto con el service_id ─────────────
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

-- Permisos idénticos a la versión anterior
REVOKE ALL ON FUNCTION public.create_transport_service_from_quote(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_transport_service_from_quote(uuid, uuid) TO authenticated;
