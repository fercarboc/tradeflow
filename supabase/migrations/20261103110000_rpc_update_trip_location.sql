-- ══════════════════════════════════════════════════════════════════════════════
-- TX-MC-GEO-1 — RPC update_transport_trip_location
-- ══════════════════════════════════════════════════════════════════════════════
-- Persiste lat/lng/geo_source en origen_detalle o destino_detalle de un viaje
-- de mercancías. Mismo modelo de seguridad que update_transport_location.
--
-- Auditoría de seguridad (pre-deploy):
--   ✓ auth.uid() — nunca confía en org_id enviado por el cliente
--   ✓ Verificación de pertenencia a la org (owner o admin activo)
--   ✓ Verificación de que el viaje pertenece a esa org (no confía en p_trip_id solamente)
--   ✓ Whitelist de campos permitidos (solo origen_detalle | destino_detalle)
--   ✓ Whitelist de geo_source (geocoded | confirmed | manual)
--   ✓ Validación de coordenadas (BETWEEN rechaza NaN e Infinity en float8)
--   ✓ Protección frente a bypass por UPDATE directo: REVOKE col-level al final
--   ✓ JSONB merge: solo actualiza lat, lng, geo_source — preserva nombre_lugar, cp, etc.
--   ✓ SECURITY DEFINER con SET search_path = public
--   ✓ Permisos mínimos: solo authenticated; anon/PUBLIC revocados
--   ✓ Aislamiento org: WHERE id = p_trip_id AND org_id = v_org_id en el UPDATE final
--   ✓ Comportamiento en confirmado/en_curso: permitido (solo vehicle_id/conductor_id/fechas protegidos)
--   ✗ Comportamiento en completado: BLOQUEADO por trigger trg_protect_completed_trip (correcto — invariante)
--   ✓ Comportamiento en cancelado: permitido (no hay trigger de protección en este estado)
--
-- DEPENDENCIA: requiere migración 20261103100000 (ADD COLUMN) ejecutada primero.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_transport_trip_location(
  p_trip_id      uuid,
  p_field        text,              -- 'origen_detalle' | 'destino_detalle'
  p_lat          float8,
  p_lng          float8,
  p_geo_source   text,              -- 'geocoded' | 'confirmed' | 'manual'
  p_address_text text DEFAULT NULL  -- texto de origen/destino cuando se inició la geocodificación
                                    -- (anti-stale: rechaza coords de una dirección ya cambiada)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       uuid;
  v_user_id      uuid := auth.uid();
  v_current_text text;
BEGIN
  -- 1. Usuario autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'GEO_AUTH: autenticación requerida';
  END IF;

  -- 2. Campo permitido (whitelist explícita)
  IF p_field NOT IN ('origen_detalle', 'destino_detalle') THEN
    RAISE EXCEPTION 'GEO_FIELD: campo no permitido: %', p_field;
  END IF;

  -- 3. geo_source válido
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

  -- 5. Obtener org_id y texto actual del campo correspondiente en una sola query
  IF p_field = 'origen_detalle' THEN
    SELECT org_id, origen  INTO v_org_id, v_current_text
      FROM public.trade_transport_trips WHERE id = p_trip_id;
  ELSE
    SELECT org_id, destino INTO v_org_id, v_current_text
      FROM public.trade_transport_trips WHERE id = p_trip_id;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'GEO_NOT_FOUND: viaje no encontrado';
  END IF;

  -- 5.5 Protección anti-stale: si el cliente envía el texto con el que geocodificó,
  --     verificar que la dirección no ha cambiado desde entonces.
  --     Casos protegidos:
  --     · Santander→geocodifica→usuario cambia a Bilbao→RPC de Santander llega tarde → GEO_STALE
  --     · Dos RPCs concurrentes con textos distintos → la segunda falla → GEO_STALE
  --     NULL permite llamadas sin verificación de texto (retrocompatibilidad, confirmación manual).
  IF p_address_text IS NOT NULL AND v_current_text IS DISTINCT FROM p_address_text THEN
    RAISE EXCEPTION 'GEO_STALE: dirección cambiada. Geocodificado para "%" pero actual es "%"',
      p_address_text, v_current_text;
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

  -- 7. JSONB merge: solo actualiza lat, lng, geo_source — preserva todos los demás campos
  --    (nombre_lugar, calle, cp, localidad, provincia, pais, etc.)
  --    Doble CHECK org_id en WHERE garantiza aislamiento aunque v_org_id provenga de la DB.
  EXECUTE format(
    $sql$
    UPDATE public.trade_transport_trips
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
  ) USING p_lat, p_lng, p_geo_source, p_trip_id, v_org_id;
END;
$$;

-- Permisos mínimos: solo usuarios autenticados; anon y PUBLIC revocados
REVOKE ALL ON FUNCTION public.update_transport_trip_location(uuid, text, float8, float8, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transport_trip_location(uuid, text, float8, float8, text, text)
  TO authenticated;

-- ── Protección frente a bypass por UPDATE directo ─────────────────────────────
-- El role authenticated NO puede actualizar origen_detalle/destino_detalle
-- mediante PostgREST (PATCH /trade_transport_trips). Solo la RPC SECURITY DEFINER
-- puede escribir en estas columnas.
--
-- Patrón REVOKE tabla → GRANT columnas (feedback_table_level_grants):
-- authenticated tiene GRANT UPDATE a nivel de tabla (confirmado en baseline).
-- REVOKE de columna sería no-op si existe grant de tabla — patrón obligatorio:
--   1. REVOKE UPDATE en tabla (revoca el grant tabla)
--   2. GRANT UPDATE en columnas individuales, EXCLUYENDO las columnas geo
-- Columnas excluidas del GRANT: origen_detalle, destino_detalle (solo RPC),
-- id, org_id, created_at (inmutables — no deben actualizarse vía PostgREST).
REVOKE UPDATE ON public.trade_transport_trips FROM authenticated;
GRANT UPDATE (
  referencia, titulo, origen, destino, fecha_inicio, fecha_fin,
  vehicle_id, conductor_id, tipo_carga, peso_kg, volumen_m3, num_bultos,
  precio_acordado, cliente_nombre, observaciones, estado,
  hora_real_salida, hora_real_llegada, km_inicio, km_fin, km_realizados,
  incidencias, observaciones_cierre, cerrado_at, cerrado_por,
  odometro_inicio, odometro_final, updated_at
) ON public.trade_transport_trips TO authenticated;
-- origen_detalle y destino_detalle quedan sin GRANT UPDATE para authenticated:
-- PostgREST no puede escribir en ellas; solo update_transport_trip_location puede.
