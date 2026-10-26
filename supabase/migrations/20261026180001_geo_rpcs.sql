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
