-- ══════════════════════════════════════════════════════════════════════════════
-- GEO-DB-2 — RPCs seguras para persistir coordenadas geocodificadas
-- ══════════════════════════════════════════════════════════════════════════════
-- Seguridad multicapa:
--   1. auth.uid() — nunca confía en org_id enviado por el cliente
--   2. Verificación de pertenencia a la organización (trade_org_members o owner)
--   3. Verificación de que el servicio pertenece a esa organización
--   4. Validación estricta de campo permitido y coordenadas
--   5. JSONB merge — nunca sobrescribe campos no relacionados (nombre, cp, etc.)
--   6. SECURITY DEFINER con search_path explícito
-- ══════════════════════════════════════════════════════════════════════════════

-- ── update_transport_location ─────────────────────────────────────────────────
-- Actualiza lat/lng/geo_source de origen_detalle o destino_detalle.
-- Preserva todos los demás campos del JSONB (nombre_lugar, calle, cp, etc.).

CREATE OR REPLACE FUNCTION public.update_transport_location(
  p_service_id  uuid,
  p_field       text,    -- 'origen_detalle' | 'destino_detalle'
  p_lat         float8,
  p_lng         float8,
  p_geo_source  text     -- 'geocoded' | 'confirmed' | 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id  uuid;
  v_user_id uuid := auth.uid();
BEGIN
  -- 1. Usuario autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'GEO_AUTH: autenticación requerida';
  END IF;

  -- 2. Campo permitido (lista blanca explícita)
  IF p_field NOT IN ('origen_detalle', 'destino_detalle') THEN
    RAISE EXCEPTION 'GEO_FIELD: campo no permitido: %', p_field;
  END IF;

  -- 3. Validar geo_source
  IF p_geo_source NOT IN ('geocoded', 'confirmed', 'manual') THEN
    RAISE EXCEPTION 'GEO_SOURCE: valor de geo_source no válido: %', p_geo_source;
  END IF;

  -- 4. Coordenadas dentro de rango (BETWEEN rechaza NaN e Infinity en float8)
  IF p_lat IS NULL OR p_lng IS NULL
     OR NOT (p_lat BETWEEN -90  AND  90)
     OR NOT (p_lng BETWEEN -180 AND 180)
  THEN
    RAISE EXCEPTION 'GEO_COORDS: coordenadas inválidas (lat=%, lng=%)', p_lat, p_lng;
  END IF;

  -- 5. Obtener org_id del servicio (no confiar en cliente)
  SELECT org_id INTO v_org_id
    FROM public.trade_transport_services
   WHERE id = p_service_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'GEO_NOT_FOUND: servicio no encontrado';
  END IF;

  -- 6. Verificar que el usuario es owner o admin activo de la organización
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = v_org_id AND owner_id = v_user_id
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = v_org_id
       AND user_id = v_user_id
       AND rol IN ('owner', 'admin')
       AND activo = true
  ) THEN
    RAISE EXCEPTION 'GEO_FORBIDDEN: sin permiso para modificar coordenadas en esta organización';
  END IF;

  -- 7. JSONB merge: solo actualiza lat, lng, geo_source — preserva el resto
  EXECUTE format(
    $sql$
    UPDATE public.trade_transport_services
       SET %I = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      COALESCE(%I, '{}'::jsonb),
                      '{lat}',        to_jsonb($1)
                    ),
                    '{lng}',        to_jsonb($2)
                  ),
                  '{geo_source}', to_jsonb($3)
                ),
           updated_at = now()
     WHERE id = $4 AND org_id = $5
    $sql$,
    p_field, p_field
  ) USING p_lat, p_lng, p_geo_source, p_service_id, v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transport_location(uuid, text, float8, float8, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transport_location(uuid, text, float8, float8, text)
  TO authenticated;

-- ── update_transport_stop_location ───────────────────────────────────────────
-- Actualiza lat/lng/geo_source de una parada por índice (0-based).
-- Valida que el índice es válido. Preserva todos los demás campos de la parada.

CREATE OR REPLACE FUNCTION public.update_transport_stop_location(
  p_service_id  uuid,
  p_stop_index  int,
  p_lat         float8,
  p_lng         float8,
  p_geo_source  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_user_id   uuid := auth.uid();
  v_paradas   jsonb;
  v_count     int;
BEGIN
  -- 1. Autenticación
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'GEO_AUTH: autenticación requerida';
  END IF;

  -- 2. geo_source válido
  IF p_geo_source NOT IN ('geocoded', 'confirmed', 'manual') THEN
    RAISE EXCEPTION 'GEO_SOURCE: valor de geo_source no válido: %', p_geo_source;
  END IF;

  -- 3. Coordenadas dentro de rango (BETWEEN rechaza NaN e Infinity en float8)
  IF p_lat IS NULL OR p_lng IS NULL
     OR NOT (p_lat BETWEEN -90  AND  90)
     OR NOT (p_lng BETWEEN -180 AND 180)
  THEN
    RAISE EXCEPTION 'GEO_COORDS: coordenadas inválidas (lat=%, lng=%)', p_lat, p_lng;
  END IF;

  -- 4. Obtener org_id y paradas
  SELECT org_id, paradas INTO v_org_id, v_paradas
    FROM public.trade_transport_services
   WHERE id = p_service_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'GEO_NOT_FOUND: servicio no encontrado';
  END IF;

  -- 5. Validar índice (COALESCE: paradas = '[]' por defecto, pero defensivo)
  v_count := COALESCE(jsonb_array_length(v_paradas), 0);
  IF p_stop_index < 0 OR p_stop_index >= v_count THEN
    RAISE EXCEPTION 'GEO_INDEX: índice de parada inválido (%, total %)', p_stop_index, v_count;
  END IF;

  -- 6. Permiso
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = v_org_id AND owner_id = v_user_id
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = v_org_id
       AND user_id = v_user_id
       AND rol IN ('owner', 'admin')
       AND activo = true
  ) THEN
    RAISE EXCEPTION 'GEO_FORBIDDEN: sin permiso para modificar coordenadas en esta organización';
  END IF;

  -- 7. JSONB merge en la parada específica
  -- Actualiza location.lat, location.lng, location.geo_source dentro del array
  UPDATE public.trade_transport_services
     SET paradas = jsonb_set(
                     jsonb_set(
                       jsonb_set(
                         paradas,
                         ARRAY[p_stop_index::text, 'location', 'lat'],
                         to_jsonb(p_lat)
                       ),
                       ARRAY[p_stop_index::text, 'location', 'lng'],
                       to_jsonb(p_lng)
                     ),
                     ARRAY[p_stop_index::text, 'location', 'geo_source'],
                     to_jsonb(p_geo_source)
                   ),
           updated_at = now()
   WHERE id = p_service_id AND org_id = v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transport_stop_location(uuid, int, float8, float8, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transport_stop_location(uuid, int, float8, float8, text)
  TO authenticated;

-- ── geo_reserve ───────────────────────────────────────────────────────────────
-- Reserva atómica de créditos Geoapify antes de la llamada externa.
-- Comprueba (en una sola transacción serializable):
--   1. Kill switch (GEO_DISABLED)
--   2. Rate limit de 1 req/1.1 s (GEO_RATE_GLOBAL)
--   3. Presupuesto diario global (GEO_RATE_GLOBAL_BUDGET)
--   4. Cuota diaria por organización (GEO_RATE_ORG)
--   5. Dedup de rutas en curso (GEO_PENDING) — best-effort, no garantía estricta
--
-- Si falla el check de org, hace rollback del incremento global antes de retornar.
-- Retorna jsonb: {ok: bool, error?: text, reserved?: int}
-- Sólo invocable con service role key (REVOKE de public/anon/authenticated).

CREATE OR REPLACE FUNCTION public.geo_reserve(
  p_org_id        uuid,
  p_estimated     int,
  p_waypoint_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today        date        := CURRENT_DATE;
  v_disabled     boolean;
  v_req_at       timestamptz;
  v_global_limit int;
  v_global_used  int;
  v_org_used     int;
  v_org_limit    int;
BEGIN
  -- 1. Dedup: rechazar petición idéntica ya en curso (ventana 30 s)
  IF p_waypoint_hash IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trade_route_cache
      WHERE waypoint_hash = p_waypoint_hash
        AND pending_at    > now() - interval '30 seconds'
        AND geometry      IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'GEO_PENDING');
    END IF;
  END IF;

  -- 2. Bloquear fila global con FOR UPDATE (serializa todos los checks siguientes)
  SELECT is_disabled,
         req_at,
         daily_global_limit,
         CASE WHEN global_used_date = v_today THEN global_used_today ELSE 0 END
  INTO   v_disabled, v_req_at, v_global_limit, v_global_used
  FROM   public.trade_geo_rate
  WHERE  provider = 'geoapify'
  FOR UPDATE;

  -- Kill switch
  IF v_disabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GEO_DISABLED');
  END IF;

  -- Rate limit 1 req/1.1 s
  IF v_req_at IS NOT NULL AND v_req_at > now() - interval '1.1 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GEO_RATE_GLOBAL');
  END IF;

  -- Presupuesto diario global
  IF v_global_used + p_estimated > v_global_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GEO_RATE_GLOBAL_BUDGET');
  END IF;

  -- Incrementar global + actualizar req_at (rate limit) en un solo UPDATE
  UPDATE public.trade_geo_rate
  SET global_used_today = v_global_used + p_estimated,
      global_used_date  = v_today,
      req_at            = now()
  WHERE provider = 'geoapify';

  -- 3. Asegurar fila de cuota para la organización hoy
  INSERT INTO public.trade_geo_usage (org_id, date, req_count, daily_limit)
  VALUES (p_org_id, v_today, 0, 100)
  ON CONFLICT (org_id, date) DO NOTHING;

  -- 4. Bloquear fila de org + verificar cuota
  SELECT req_count, daily_limit
  INTO   v_org_used, v_org_limit
  FROM   public.trade_geo_usage
  WHERE  org_id = p_org_id AND date = v_today
  FOR UPDATE;

  IF v_org_used + p_estimated > v_org_limit THEN
    -- Rollback del incremento global (nada fue consumido externamente)
    UPDATE public.trade_geo_rate
    SET global_used_today = GREATEST(global_used_today - p_estimated, 0)
    WHERE provider = 'geoapify';
    RETURN jsonb_build_object('ok', false, 'error', 'GEO_RATE_ORG');
  END IF;

  UPDATE public.trade_geo_usage
  SET req_count = v_org_used + p_estimated
  WHERE org_id = p_org_id AND date = v_today;

  -- 5. Marcar ruta como pendiente para dedup
  IF p_waypoint_hash IS NOT NULL THEN
    INSERT INTO public.trade_route_cache (waypoint_hash, pending_at)
    VALUES (p_waypoint_hash, now())
    ON CONFLICT (waypoint_hash) DO UPDATE
      SET pending_at = EXCLUDED.pending_at
      WHERE trade_route_cache.geometry IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reserved', p_estimated);
END;
$$;

REVOKE ALL ON FUNCTION public.geo_reserve(uuid, int, text) FROM PUBLIC, anon, authenticated;

-- ── geo_reconcile ─────────────────────────────────────────────────────────────
-- Concilia la reserva de créditos tras la llamada a Geoapify.
--
--   p_reserved  créditos reservados por geo_reserve
--   p_actual    créditos realmente consumidos:
--               = segmentos + floor(distance_m/500_000)  en caso de éxito
--               = 0  en caso de error del proveedor (Geoapify no facturó)
--
-- Libera (reserved - actual) créditos del presupuesto global y de la cuota de org.
-- Si p_actual = p_reserved no hay liberación (reserva exacta).
-- NEVER libera más créditos de los reservados — GREATEST(..., 0) protege el contador.
-- Limpia pending_at de la entrada de caché (si la hay) en todos los casos.

CREATE OR REPLACE FUNCTION public.geo_reconcile(
  p_org_id        uuid,
  p_reserved      int,
  p_actual        int,
  p_waypoint_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_delta int  := p_reserved - p_actual;
BEGIN
  -- Liberar sobre-reserva (o reserva completa si error de proveedor)
  IF v_delta > 0 THEN
    UPDATE public.trade_geo_usage
    SET req_count = GREATEST(req_count - v_delta, 0)
    WHERE org_id = p_org_id AND date = v_today;

    -- Solo liberar del global si la fecha no ha cambiado (evitar desfase al pasar medianoche)
    UPDATE public.trade_geo_rate
    SET global_used_today = GREATEST(global_used_today - v_delta, 0)
    WHERE provider = 'geoapify' AND global_used_date = v_today;
  END IF;

  -- Limpiar marca de pendiente (éxito o error — el slot queda libre)
  IF p_waypoint_hash IS NOT NULL THEN
    UPDATE public.trade_route_cache
    SET pending_at = NULL
    WHERE waypoint_hash = p_waypoint_hash AND geometry IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.geo_reconcile(uuid, int, int, text) FROM PUBLIC, anon, authenticated;
