-- ══════════════════════════════════════════════════════════════════════
-- TX-CIERRE-1 — Cierre del módulo de transporte para el piloto
--   1. El conductor asignado puede iniciar y cerrar sus servicios y viajes.
--   2. Inicio de viaje por RPC (antes UPDATE directo solo para admin).
--   3. Permiso que faltaba: vincular el cliente al viaje al facturar.
--   4. Prueba de entrega de expediciones: DNI del receptor, firma, fotos y posición.
--   5. Precio y factura por expedición (grupaje: varios cargadores en un viaje).
--   6. Presupuesto aceptado en empresa de mercancías → viaje en borrador.
--   Migración aditiva: no borra datos ni cambia el comportamiento de los admins.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Ficha de trabajador del usuario actual en una organización ─────────────
CREATE OR REPLACE FUNCTION public._transport_my_worker_id(p_org_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.worker_profile_id FROM public.trade_org_members m
   WHERE m.org_id = p_org_id AND m.user_id = auth.uid() AND m.activo = true
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public._transport_my_worker_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._transport_my_worker_id(uuid) TO authenticated;

-- Añade «o el conductor asignado» a la comprobación de permisos de las RPC
-- existentes, sin reescribirlas a mano (se parchea su definición actual).
DO $$
DECLARE
  r record;
  v_def text;
  v_new text;
  v_tabla text;
  v_param text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('start_transport_service', 'complete_transport_service', 'complete_transport_trip')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('_transport_my_worker_id' IN v_def) > 0 THEN CONTINUE; END IF;  -- ya parcheada
    IF r.proname = 'complete_transport_trip' THEN
      v_tabla := 'trade_transport_trips'; v_param := 'p_trip_id';
    ELSE
      v_tabla := 'trade_transport_services'; v_param := 'p_service_id';
    END IF;
    v_new := regexp_replace(v_def,
      E'\\)\\s*THEN\\s*\\n(\\s*)RAISE EXCEPTION ''TRANSPORT_FORBIDDEN: sin permisos para',
      E'    UNION ALL\n    SELECT 1 FROM public.' || v_tabla || E' c\n     WHERE c.id = ' || v_param ||
      E' AND c.org_id = p_org_id\n       AND c.conductor_id IS NOT NULL\n       AND c.conductor_id = public._transport_my_worker_id(p_org_id)\n  ) THEN\n\\1RAISE EXCEPTION ''TRANSPORT_FORBIDDEN: sin permisos para');
    IF v_new = v_def THEN
      RAISE EXCEPTION 'TX-CIERRE-1: no se encontró el bloque de permisos en %', r.proname;
    END IF;
    EXECUTE v_new;
  END LOOP;
END $$;

-- ── 2. Iniciar viaje (admin o conductor asignado) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.start_transport_trip(
  p_trip_id uuid,
  p_org_id uuid,
  p_odometro_inicio integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trip public.trade_transport_trips%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND transport_enabled = true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;
  SELECT * INTO v_trip FROM public.trade_transport_trips WHERE id = p_trip_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: viaje no encontrado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id AND user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
  ) AND (v_trip.conductor_id IS NULL OR v_trip.conductor_id IS DISTINCT FROM public._transport_my_worker_id(p_org_id)) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para iniciar este viaje';
  END IF;
  IF v_trip.estado <> 'confirmado' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se puede iniciar un viaje confirmado (estado actual: %)', v_trip.estado;
  END IF;
  IF p_odometro_inicio IS NOT NULL AND p_odometro_inicio < 0 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_inicio no puede ser negativo';
  END IF;
  UPDATE public.trade_transport_trips
     SET estado = 'en_curso',
         hora_real_salida = COALESCE(hora_real_salida, now()),
         odometro_inicio = COALESCE(p_odometro_inicio, odometro_inicio)
   WHERE id = p_trip_id AND org_id = p_org_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.start_transport_trip(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_transport_trip(uuid, uuid, integer) TO authenticated;

-- ── 3. Permiso que faltaba: cliente del viaje (TX-FACT-1) ─────────────────────
GRANT UPDATE (client_id) ON public.trade_transport_trips TO authenticated;

-- ── 4 y 5. Expediciones: prueba de entrega, precio y factura propia ───────────
ALTER TABLE public.trade_transport_shipments
  ADD COLUMN IF NOT EXISTS precio_acordado numeric(10,2) CHECK (precio_acordado IS NULL OR precio_acordado >= 0),
  ADD COLUMN IF NOT EXISTS receptor_dni    text,
  ADD COLUMN IF NOT EXISTS firma_path      text,
  ADD COLUMN IF NOT EXISTS fotos           text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS entrega_lat     numeric(9,6),
  ADD COLUMN IF NOT EXISTS entrega_lng     numeric(9,6),
  ADD COLUMN IF NOT EXISTS entregada_por   uuid;

-- Quién marca la entrega
CREATE OR REPLACE FUNCTION public._tsh_entregada_por()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'entregada' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'entregada') THEN
    NEW.entregada_por := COALESCE(NEW.entregada_por, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tsh_entregada_por ON public.trade_transport_shipments;
CREATE TRIGGER trg_tsh_entregada_por BEFORE INSERT OR UPDATE ON public.trade_transport_shipments
  FOR EACH ROW EXECUTE FUNCTION public._tsh_entregada_por();

ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.trade_transport_shipments(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_invoices_shipment
  ON public.trade_invoices(shipment_id) WHERE shipment_id IS NOT NULL AND rectifica_factura_id IS NULL;

-- Archivos de la prueba de entrega: <org_id>/<shipment_id>/<archivo>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transport-pod', 'transport-pod', false, 8388608, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "transport_pod_select" ON storage.objects;
CREATE POLICY "transport_pod_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'transport-pod'
         AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         AND ((storage.foldername(name))[1])::uuid = ANY(public._user_org_ids()));
DROP POLICY IF EXISTS "transport_pod_insert" ON storage.objects;
CREATE POLICY "transport_pod_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'transport-pod'
         AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         AND ((storage.foldername(name))[1])::uuid = ANY(public._user_org_ids()));
-- Sin UPDATE ni DELETE: la prueba de entrega no se modifica.

-- ── 6. Presupuesto aceptado → viaje de mercancías ─────────────────────────────
ALTER TABLE public.trade_transport_trips ADD COLUMN IF NOT EXISTS quote_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ttt_quote ON public.trade_transport_trips(quote_id) WHERE quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_transport_trip_from_quote(p_org_id uuid, p_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote record;
  v_intake jsonb;
  v_trip_id uuid;
  v_origen text;
  v_destino text;
  v_inicio timestamptz := now();
  v_fin timestamptz;
  v_precio numeric;
  v_iva numeric;
  v_cliente text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid() AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos en esta organización' USING ERRCODE = 'P0003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND transport_enabled) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ORG_NO_TRANSPORT_CAPABILITY',
      'message', 'Esta organización no tiene la operativa de Transporte habilitada.');
  END IF;

  SELECT * INTO v_quote FROM public.trade_quotes WHERE id = p_quote_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: presupuesto no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_quote.estado <> 'Aceptado' THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: el presupuesto debe estar Aceptado (actual: %)', v_quote.estado USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_trip_id FROM public.trade_transport_trips WHERE quote_id = p_quote_id;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'trip_id', v_trip_id, 'idempotent', true); END IF;

  v_intake := COALESCE(v_quote.metadata->'transport_intake'->'intake', '{}'::jsonb);
  v_origen  := COALESCE(NULLIF(btrim(v_intake->>'origen'), ''), 'Por definir');
  v_destino := COALESCE(NULLIF(btrim(v_intake->>'destino'), ''), 'Por definir');
  BEGIN
    IF NULLIF(v_intake->>'fecha_servicio', '') IS NOT NULL THEN
      v_inicio := ((v_intake->>'fecha_servicio')::date)::timestamptz + INTERVAL '8 hours';
    END IF;
  EXCEPTION WHEN others THEN v_inicio := now(); END;
  BEGIN
    IF NULLIF(v_intake->>'fecha_fin_servicio', '') IS NOT NULL THEN
      v_fin := ((v_intake->>'fecha_fin_servicio')::date)::timestamptz + INTERVAL '20 hours';
      IF v_fin <= v_inicio THEN v_fin := NULL; END IF;
    END IF;
  EXCEPTION WHEN others THEN v_fin := NULL; END;

  v_iva := COALESCE(v_quote.iva_pct, 21);
  BEGIN
    v_precio := NULLIF(v_intake->>'precio_base', 'null')::numeric;
    IF v_precio IS NOT NULL AND COALESCE((v_intake->>'precio_incluye_iva')::boolean, false) THEN
      v_precio := round(v_precio / (1 + v_iva / 100.0), 2);
    END IF;
  EXCEPTION WHEN others THEN v_precio := NULL; END;
  -- Sin precio en el intake: importe neto del presupuesto
  IF v_precio IS NULL AND COALESCE(v_quote.total_neto, 0) > 0 THEN v_precio := v_quote.total_neto; END IF;

  SELECT NULLIF(btrim(concat_ws(' ', c.nombre, c.apellidos)), '') INTO v_cliente
    FROM public.trade_clients c WHERE c.id = v_quote.client_id AND c.org_id = p_org_id;

  BEGIN
    INSERT INTO public.trade_transport_trips (
      org_id, quote_id, client_id, titulo, origen, destino, fecha_inicio, fecha_fin,
      precio_acordado, cliente_nombre, observaciones, estado
    ) VALUES (
      p_org_id, p_quote_id, v_quote.client_id,
      left(v_origen || ' → ' || v_destino, 200), v_origen, v_destino, v_inicio, v_fin,
      v_precio, v_cliente,
      NULLIF(concat_ws(E'\n', NULLIF(btrim(COALESCE(v_quote.descripcion, '')), ''),
        'Creado desde el presupuesto ' || COALESCE(v_quote.numero, '')), ''),
      'borrador'
    ) RETURNING id INTO v_trip_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_trip_id FROM public.trade_transport_trips WHERE quote_id = p_quote_id;
    RETURN jsonb_build_object('ok', true, 'trip_id', v_trip_id, 'idempotent', true);
  END;

  UPDATE public.trade_quotes
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{transport_trip_id}', to_jsonb(v_trip_id::text))
   WHERE id = p_quote_id AND org_id = p_org_id;

  RETURN jsonb_build_object('ok', true, 'trip_id', v_trip_id, 'idempotent', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_transport_trip_from_quote(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_transport_trip_from_quote(uuid, uuid) TO authenticated;

-- ── 7. Aceptación desde el enlace público en empresas de mercancías ───────────
-- accept_quote_by_token llama a create_transport_service_from_quote. Si la
-- empresa es de mercancías, se delega en create_transport_trip_from_quote.
DO $$
DECLARE v_oid oid; v_def text; v_new text;
BEGIN
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_transport_service_from_quote'
     AND pg_get_function_identity_arguments(p.oid) = 'p_org_id uuid, p_quote_id uuid';
  v_def := pg_get_functiondef(v_oid);
  IF position('create_transport_trip_from_quote' IN v_def) > 0 THEN RETURN; END IF;
  v_new := regexp_replace(v_def,
    E'(\\n\\s*-- ── 1b\\. Verificar operativa)',
    E'\n  -- TX-CIERRE-1: empresas de mercancías → viaje en lugar de servicio de viajeros\n' ||
    E'  IF EXISTS (SELECT 1 FROM public.trade_organizations\n' ||
    E'              WHERE id = p_org_id AND transport_modalidad IN (''mercancias'', ''reparto'')) THEN\n' ||
    E'    RETURN public.create_transport_trip_from_quote(p_org_id, p_quote_id) || jsonb_build_object(''service_id'', NULL);\n' ||
    E'  END IF;\n\\1');
  IF v_new = v_def THEN
    RAISE EXCEPTION 'TX-CIERRE-1: no se encontró el punto de inserción en create_transport_service_from_quote';
  END IF;
  EXECUTE v_new;
END $$;
