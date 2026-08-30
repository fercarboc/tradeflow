-- SPRINT 1B — Portal del Proveedor

CREATE TABLE IF NOT EXISTS public.trade_marketplace_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid        NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,
  org_id          uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE RESTRICT,
  estado          text        NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_mkt_order_estado CHECK (estado IN ('pending','confirmed','preparing','shipped','delivered','completed','cancelled')),
  numero          text        NOT NULL,
  notas           text,
  notas_proveedor text,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  coste_envio     numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  direccion_entrega jsonb,
  confirmed_at    timestamptz,
  preparing_at    timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  quote_id        uuid        REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  job_id          uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_mkt_order_numero UNIQUE (actor_id, numero)
);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_order_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid        NOT NULL REFERENCES public.trade_marketplace_orders(id) ON DELETE CASCADE,
  offering_id          uuid        REFERENCES public.trade_marketplace_supplier_offerings(id) ON DELETE SET NULL,
  universal_product_id uuid        REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  referencia           text,
  descripcion          text        NOT NULL,
  unidad               text        NOT NULL DEFAULT 'ud',
  cantidad             integer     NOT NULL CHECK (cantidad > 0),
  precio_unitario      numeric(12,4) NOT NULL,
  precio_total         numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario::numeric(12,2)) STORED,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_supplier_config (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id                uuid        NOT NULL UNIQUE REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  permite_recogida        boolean     NOT NULL DEFAULT false,
  permite_entrega         boolean     NOT NULL DEFAULT true,
  radio_entrega_km        integer,
  pedido_minimo           numeric(10,2),
  portes_gratis_desde     numeric(10,2),
  coste_portes            numeric(10,2),
  permite_urgencias       boolean     NOT NULL DEFAULT false,
  coste_urgencia          numeric(10,2),
  horario_recogida        jsonb,
  horario_entrega         jsonb,
  plazo_confirmacion_h    integer     NOT NULL DEFAULT 24,
  plazo_preparacion_dias  integer     NOT NULL DEFAULT 2,
  plazo_entrega_dias      integer     NOT NULL DEFAULT 5,
  mensaje_instaladores    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid        NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  tipo            text        NOT NULL
    CONSTRAINT chk_notif_tipo CHECK (tipo IN ('order_received','order_cancelled','invitation','incident','catalog_alert','system')),
  titulo          text        NOT NULL,
  cuerpo          text,
  ref_id          uuid,
  ref_tipo        text,
  leida           boolean     NOT NULL DEFAULT false,
  leida_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_outbox (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE SET NULL,
  event_type    text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}',
  processed_at  timestamptz,
  error         text,
  retry_count   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON public.trade_marketplace_outbox(created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_orders_actor   ON public.trade_marketplace_orders(actor_id, estado);
CREATE INDEX IF NOT EXISTS idx_mkt_orders_org     ON public.trade_marketplace_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_mkt_orders_created ON public.trade_marketplace_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_order_items_order ON public.trade_marketplace_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_mkt_notif_actor    ON public.trade_marketplace_notifications(actor_id, leida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_config_actor ON public.trade_marketplace_supplier_config(actor_id);

CREATE OR REPLACE FUNCTION public.trg_fn_mkt_order_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq integer;
BEGIN
  SELECT COALESCE(MAX(CAST(regexp_replace(numero, '[^0-9]', '', 'g') AS integer)), 0) + 1
  INTO v_seq FROM public.trade_marketplace_orders WHERE actor_id = NEW.actor_id;
  NEW.numero := 'MKT-' || LPAD(v_seq::text, 6, '0');
  RETURN NEW;
END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mkt_order_numero' AND tgrelid = 'public.trade_marketplace_orders'::regclass) THEN
    CREATE TRIGGER trg_mkt_order_numero BEFORE INSERT ON public.trade_marketplace_orders FOR EACH ROW WHEN (NEW.numero = '' OR NEW.numero IS NULL) EXECUTE FUNCTION public.trg_fn_mkt_order_numero();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mkt_order_updated_at' AND tgrelid = 'public.trade_marketplace_orders'::regclass) THEN
    CREATE TRIGGER trg_mkt_order_updated_at BEFORE UPDATE ON public.trade_marketplace_orders FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_supplier_config_updated_at' AND tgrelid = 'public.trade_marketplace_supplier_config'::regclass) THEN
    CREATE TRIGGER trg_supplier_config_updated_at BEFORE UPDATE ON public.trade_marketplace_supplier_config FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
END; $$;

ALTER TABLE public.trade_marketplace_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_supplier_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_outbox            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mkt_orders_select"  ON public.trade_marketplace_orders;
DROP POLICY IF EXISTS "mkt_orders_insert"  ON public.trade_marketplace_orders;
CREATE POLICY "mkt_orders_select" ON public.trade_marketplace_orders FOR SELECT TO authenticated USING (public._mkt_has_permission(actor_id, 'orders:read'));

DROP POLICY IF EXISTS "mkt_order_items_select" ON public.trade_marketplace_order_items;
CREATE POLICY "mkt_order_items_select" ON public.trade_marketplace_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trade_marketplace_orders o WHERE o.id = order_id AND public._mkt_has_permission(o.actor_id, 'orders:read')));

DROP POLICY IF EXISTS "supplier_config_select" ON public.trade_marketplace_supplier_config;
DROP POLICY IF EXISTS "supplier_config_upsert" ON public.trade_marketplace_supplier_config;
CREATE POLICY "supplier_config_select" ON public.trade_marketplace_supplier_config FOR SELECT TO authenticated USING (actor_id = ANY(public._mkt_actor_ids_for_user()));
CREATE POLICY "supplier_config_upsert" ON public.trade_marketplace_supplier_config FOR ALL TO authenticated
  USING (public._mkt_has_permission(actor_id, 'actor:settings')) WITH CHECK (public._mkt_has_permission(actor_id, 'actor:settings'));

DROP POLICY IF EXISTS "notif_select"  ON public.trade_marketplace_notifications;
DROP POLICY IF EXISTS "notif_update"  ON public.trade_marketplace_notifications;
CREATE POLICY "notif_select" ON public.trade_marketplace_notifications FOR SELECT TO authenticated USING (actor_id = ANY(public._mkt_actor_ids_for_user()));
CREATE POLICY "notif_update" ON public.trade_marketplace_notifications FOR UPDATE TO authenticated USING (actor_id = ANY(public._mkt_actor_ids_for_user()));

DROP POLICY IF EXISTS "outbox_select_platform" ON public.trade_marketplace_outbox;
CREATE POLICY "outbox_select_platform" ON public.trade_marketplace_outbox FOR SELECT TO authenticated USING (public._mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.get_supplier_dashboard_stats(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid; v_result jsonb;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'analytics:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere analytics:read.'; END IF;
  SELECT supplier_catalog_id INTO v_catalog_id FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  WITH offering_stats AS (
    SELECT COUNT(*) AS total_offerings, COUNT(*) FILTER (WHERE match_state = 'matched') AS matched_offerings,
      COUNT(*) FILTER (WHERE match_state IN ('pending_review','unmatched')) AS unmatched_offerings,
      COUNT(*) FILTER (WHERE activa AND NOT stock_disponible AND match_state = 'matched') AS no_stock_offerings,
      ROUND(COUNT(*) FILTER (WHERE match_state = 'matched') * 100.0 / NULLIF(COUNT(*), 0), 1) AS coverage_pct
    FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id AND activa = true
  ),
  legacy_order_stats AS (
    SELECT COUNT(*) FILTER (WHERE estado = 'enviado') AS pending_orders,
      COUNT(*) FILTER (WHERE estado = 'confirmado') AS confirmed_orders,
      COUNT(*) FILTER (WHERE estado = 'recibido') AS completed_orders,
      COUNT(DISTINCT org_id) AS total_buyers
    FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND estado != 'cancelado'
  ),
  mkt_order_stats AS (
    SELECT COUNT(*) FILTER (WHERE estado = 'pending') AS mkt_pending,
      COUNT(*) FILTER (WHERE estado IN ('confirmed','preparing')) AS mkt_confirmed,
      COUNT(*) FILTER (WHERE estado = 'completed') AS mkt_completed,
      COALESCE(SUM(total) FILTER (WHERE estado IN ('completed') AND created_at >= date_trunc('month', now())), 0) AS month_revenue
    FROM public.trade_marketplace_orders WHERE actor_id = p_actor_id
  )
  SELECT jsonb_build_object(
    'total_offerings', os.total_offerings, 'matched_offerings', os.matched_offerings,
    'unmatched_offerings', os.unmatched_offerings, 'no_stock_offerings', os.no_stock_offerings,
    'coverage_pct', COALESCE(os.coverage_pct, 0),
    'pending_orders', COALESCE(los.pending_orders, 0) + COALESCE(mo.mkt_pending, 0),
    'confirmed_orders', COALESCE(los.confirmed_orders, 0) + COALESCE(mo.mkt_confirmed, 0),
    'completed_orders', COALESCE(los.completed_orders, 0) + COALESCE(mo.mkt_completed, 0),
    'total_buyers', COALESCE(los.total_buyers, 0),
    'month_revenue', COALESCE(mo.month_revenue, 0)
  ) INTO v_result FROM offering_stats os CROSS JOIN legacy_order_stats los CROSS JOIN mkt_order_stats mo;
  RETURN COALESCE(v_result, '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_action_center(p_actor_id uuid)
RETURNS TABLE (tipo text, severidad text, titulo text, descripcion text, count_items integer, cta_label text, cta_target text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid; v_pending_orders integer := 0; v_slow_orders integer := 0; v_pending_match integer := 0; v_no_stock integer := 0; v_actor_estado text; v_verify boolean;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'analytics:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere analytics:read.'; END IF;
  SELECT supplier_catalog_id, estado, verificado INTO v_catalog_id, v_actor_estado, v_verify FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  SELECT COUNT(*) INTO v_pending_orders FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND estado = 'enviado';
  SELECT COUNT(*) INTO v_slow_orders FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND estado = 'confirmado' AND updated_at < now() - interval '48 hours';
  SELECT COUNT(*) INTO v_pending_match FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id AND match_state IN ('pending_review','unmatched') AND activa = true;
  SELECT COUNT(*) INTO v_no_stock FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id AND activa = true AND match_state = 'matched' AND NOT stock_disponible;
  IF v_actor_estado != 'active' OR NOT v_verify THEN
    RETURN QUERY SELECT 'verificacion_pendiente'::text, 'critical'::text,
      CASE WHEN v_actor_estado != 'active' THEN 'Tu cuenta está ' || v_actor_estado ELSE 'Cuenta sin verificar' END::text,
      'Completa la verificación de tu cuenta para que los instaladores puedan encontrarte.'::text, 1::integer, 'Ir a Configuración'::text, 'config'::text;
  END IF;
  IF v_pending_orders > 0 THEN
    RETURN QUERY SELECT 'pedidos_pendientes'::text, CASE WHEN v_pending_orders >= 3 THEN 'critical' ELSE 'warning' END::text,
      (v_pending_orders || ' pedido' || CASE WHEN v_pending_orders > 1 THEN 's' ELSE '' END || ' sin confirmar')::text,
      'Los instaladores esperan tu confirmación. Responde en menos de 24h para mantener un buen score.'::text,
      v_pending_orders::integer, 'Ver pedidos'::text, 'pedidos'::text;
  END IF;
  IF v_slow_orders > 0 THEN
    RETURN QUERY SELECT 'pedidos_lentos'::text, 'warning'::text,
      (v_slow_orders || ' pedido' || CASE WHEN v_slow_orders > 1 THEN 's confirmados sin actualizar' ELSE ' confirmado sin actualizar' END)::text,
      'Hay pedidos confirmados hace más de 48h sin marcarse como preparando o enviado.'::text,
      v_slow_orders::integer, 'Ver pedidos'::text, 'pedidos'::text;
  END IF;
  IF v_pending_match > 0 THEN
    RETURN QUERY SELECT 'productos_sin_vincular'::text, CASE WHEN v_pending_match >= 20 THEN 'warning' ELSE 'info' END::text,
      (v_pending_match || ' producto' || CASE WHEN v_pending_match > 1 THEN 's sin Producto Universal' ELSE ' sin Producto Universal' END)::text,
      'Sin vinculación, estos productos no aparecen en las búsquedas del Motor IA.'::text,
      v_pending_match::integer, 'Vincular ahora'::text, 'catalogo'::text;
  END IF;
  IF v_no_stock > 0 THEN
    RETURN QUERY SELECT 'sin_stock'::text, 'info'::text,
      (v_no_stock || ' producto' || CASE WHEN v_no_stock > 1 THEN 's sin stock' ELSE ' sin stock' END)::text,
      'Productos activos sin stock disponible. Actualiza el estado para evitar pedidos fallidos.'::text,
      v_no_stock::integer, 'Ver catálogo'::text, 'catalogo'::text;
  END IF;
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_ai_insights(p_actor_id uuid)
RETURNS TABLE (insight_type text, titulo text, descripcion text, valor numeric, unidad text, accion text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid; v_coverage numeric; v_avg_price_delta numeric; v_dup_count integer; v_avg_confirm_h numeric;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'analytics:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere analytics:read.'; END IF;
  SELECT supplier_catalog_id INTO v_catalog_id FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  SELECT ROUND(COUNT(*) FILTER (WHERE match_state = 'matched') * 100.0 / NULLIF(COUNT(*), 0), 1) INTO v_coverage FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id AND activa = true;
  SELECT ROUND(AVG((o.precio_coste - avg_market.avg_precio) * 100.0 / NULLIF(avg_market.avg_precio, 0)), 1) INTO v_avg_price_delta
  FROM public.trade_marketplace_supplier_offerings o
  JOIN (SELECT universal_product_id, AVG(precio_coste) AS avg_precio FROM public.trade_marketplace_supplier_offerings WHERE match_state = 'matched' AND activa = true AND precio_coste IS NOT NULL GROUP BY universal_product_id HAVING COUNT(*) > 1) avg_market ON avg_market.universal_product_id = o.universal_product_id
  WHERE o.supplier_catalog_id = v_catalog_id AND o.match_state = 'matched' AND o.precio_coste IS NOT NULL;
  SELECT COUNT(*) INTO v_dup_count FROM (SELECT supplier_ref FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id AND activa = true AND supplier_ref IS NOT NULL GROUP BY supplier_ref HAVING COUNT(*) > 1) dups;
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 1) INTO v_avg_confirm_h FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND estado IN ('confirmado','recibido') AND created_at > now() - interval '90 days';
  IF COALESCE(v_coverage, 0) < 80 THEN
    RETURN QUERY SELECT 'cobertura_baja'::text, 'Cobertura de catálogo baja'::text, ('Tu catálogo tiene un ' || COALESCE(v_coverage, 0) || '% de productos vinculados.')::text, COALESCE(v_coverage, 0), '%'::text, 'Vincular productos ahora'::text;
  END IF;
  IF COALESCE(v_avg_price_delta, 0) > 10 THEN
    RETURN QUERY SELECT 'precio_superior'::text, 'Tus precios son superiores a la media'::text, ('Tus precios son de media un ' || ROUND(ABS(v_avg_price_delta), 1) || '% más altos que la media de mercado.')::text, ROUND(ABS(v_avg_price_delta), 1), '%'::text, 'Revisar precios'::text;
  ELSIF COALESCE(v_avg_price_delta, 0) < -10 THEN
    RETURN QUERY SELECT 'precio_competitivo'::text, 'Tus precios son muy competitivos'::text, ('Tus precios están un ' || ROUND(ABS(v_avg_price_delta), 1) || '% por debajo de la media.')::text, ROUND(ABS(v_avg_price_delta), 1), '%'::text, 'Ver catálogo'::text;
  END IF;
  IF v_dup_count > 0 THEN
    RETURN QUERY SELECT 'referencias_duplicadas'::text, 'Referencias duplicadas detectadas'::text, ('Hay ' || v_dup_count || ' referencia/s duplicada/s en tu catálogo.')::text, v_dup_count::numeric, 'refs'::text, 'Ver duplicados'::text;
  END IF;
  IF COALESCE(v_avg_confirm_h, 0) > 48 THEN
    RETURN QUERY SELECT 'tiempo_respuesta_lento'::text, 'Tiempo de respuesta lento'::text, ('Tu tiempo medio de confirmación es de ' || ROUND(v_avg_confirm_h, 0) || 'h.')::text, ROUND(v_avg_confirm_h, 0), 'h'::text, 'Ver pedidos pendientes'::text;
  END IF;
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_offerings_paged(p_actor_id uuid, p_search text DEFAULT NULL, p_match_state text DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, supplier_ref text, descripcion_comercial text, precio_coste numeric, precio_venta numeric, unidad text, stock_disponible boolean, stock_cantidad integer, plazo_entrega_dias integer, match_state text, match_method text, match_confidence numeric, universal_product_id uuid, up_nombre_canonico text, up_familia text, ia_estado text, ia_explicacion text, activa boolean, created_at timestamptz, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.'; END IF;
  SELECT supplier_catalog_id INTO v_catalog_id FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  RETURN QUERY
  WITH filtered AS (
    SELECT o.id, o.supplier_ref, o.descripcion_comercial, o.precio_coste, o.precio_venta, o.unidad, o.stock_disponible, o.stock_cantidad, o.plazo_entrega_dias, o.match_state, o.match_method, o.match_confidence, o.universal_product_id,
      up.nombre_canonico AS up_nombre_canonico, up.familia AS up_familia,
      CASE WHEN o.match_state = 'matched' AND o.activa AND o.stock_disponible AND COALESCE(o.match_confidence, 1) >= 0.85 THEN 'compatible'
           WHEN o.match_state = 'matched' AND o.activa AND NOT o.stock_disponible THEN 'sin_stock'
           WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) < 0.85 THEN 'revisar'
           WHEN o.match_state = 'suggested' THEN 'mejor_coincidencia'
           WHEN o.match_state IN ('pending_review','unmatched') THEN 'sin_up'
           ELSE 'revisar' END AS ia_estado,
      CASE WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) >= 0.85 THEN 'Vinculado con alta confianza.'
           WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) < 0.85 THEN 'Vinculado con confianza media. Revisa la coincidencia.'
           WHEN o.match_state = 'suggested' THEN 'El sistema ha encontrado una posible coincidencia. Confirma manualmente.'
           WHEN o.match_state = 'pending_review' THEN 'Importado recientemente. Pendiente de vincular a un Producto Universal.'
           WHEN o.match_state = 'unmatched' THEN 'Sin Producto Universal. No aparece en búsquedas del Motor IA.'
           ELSE 'Revisar estado.' END AS ia_explicacion,
      o.activa, o.created_at
    FROM public.trade_marketplace_supplier_offerings o LEFT JOIN public.trade_marketplace_universal_products up ON up.id = o.universal_product_id
    WHERE o.supplier_catalog_id = v_catalog_id AND (p_match_state IS NULL OR o.match_state = p_match_state)
      AND (p_search IS NULL OR o.supplier_ref ILIKE '%' || p_search || '%' OR o.descripcion_comercial ILIKE '%' || p_search || '%' OR up.nombre_canonico ILIKE '%' || p_search || '%')
    ORDER BY CASE o.match_state WHEN 'pending_review' THEN 1 WHEN 'unmatched' THEN 2 WHEN 'suggested' THEN 3 WHEN 'matched' THEN 4 ELSE 5 END, o.created_at DESC
  )
  SELECT f.*, COUNT(*) OVER () AS total_count FROM filtered f LIMIT p_limit OFFSET p_offset;
END; $$;

CREATE OR REPLACE FUNCTION public.update_supplier_offering(p_offering_id uuid, p_precio_coste numeric DEFAULT NULL, p_precio_venta numeric DEFAULT NULL, p_stock_disponible boolean DEFAULT NULL, p_stock_cantidad integer DEFAULT NULL, p_descripcion_comercial text DEFAULT NULL, p_plazo_entrega_dias integer DEFAULT NULL, p_activa boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid;
BEGIN
  SELECT a.id INTO v_actor_id FROM public.trade_marketplace_supplier_offerings o JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id WHERE o.id = p_offering_id;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.'; END IF;
  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:write') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:write.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_actors WHERE id = v_actor_id AND estado = 'active') THEN RAISE EXCEPTION 'ACTOR_SUSPENDED: Solo actores activos pueden modificar ofertas.'; END IF;
  UPDATE public.trade_marketplace_supplier_offerings SET precio_coste = COALESCE(p_precio_coste, precio_coste), precio_venta = COALESCE(p_precio_venta, precio_venta), stock_disponible = COALESCE(p_stock_disponible, stock_disponible), stock_cantidad = COALESCE(p_stock_cantidad, stock_cantidad), descripcion_comercial = COALESCE(p_descripcion_comercial, descripcion_comercial), plazo_entrega_dias = COALESCE(p_plazo_entrega_dias, plazo_entrega_dias), activa = COALESCE(p_activa, activa), updated_at = now() WHERE id = p_offering_id;
  INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload) VALUES (v_actor_id, 'offering.updated', jsonb_build_object('offering_id', p_offering_id, 'changed_by', auth.uid()));
END; $$;

CREATE OR REPLACE FUNCTION public.match_offering_to_up(p_offering_id uuid, p_up_id uuid, p_method text DEFAULT 'admin')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid;
BEGIN
  SELECT a.id INTO v_actor_id FROM public.trade_marketplace_supplier_offerings o JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id WHERE o.id = p_offering_id;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.'; END IF;
  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:match') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:match.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE id = p_up_id) THEN RAISE EXCEPTION 'NOT_FOUND: Producto Universal no encontrado.'; END IF;
  UPDATE public.trade_marketplace_supplier_offerings SET universal_product_id = p_up_id, match_state = 'matched', match_method = p_method, match_confidence = CASE WHEN p_method = 'admin' THEN 1.0 ELSE match_confidence END, matched_by = auth.uid(), matched_at = now(), updated_at = now() WHERE id = p_offering_id;
  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data) VALUES (v_actor_id, auth.uid(), 'offering_matched', jsonb_build_object('offering_id', p_offering_id, 'up_id', p_up_id, 'method', p_method));
END; $$;

CREATE OR REPLACE FUNCTION public.unmatch_offering(p_offering_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid;
BEGIN
  SELECT a.id INTO v_actor_id FROM public.trade_marketplace_supplier_offerings o JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id WHERE o.id = p_offering_id;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.'; END IF;
  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:match') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:match.'; END IF;
  UPDATE public.trade_marketplace_supplier_offerings SET universal_product_id = NULL, match_state = 'unmatched', match_method = NULL, match_confidence = NULL, matched_by = NULL, matched_at = NULL, updated_at = now() WHERE id = p_offering_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_orders_unified(p_actor_id uuid, p_estado text DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, source text, numero text, org_nombre text, org_id uuid, estado text, original_estado text, total numeric, items_count bigint, notas text, created_at timestamptz, confirmed_at timestamptz, shipped_at timestamptz, completed_at timestamptz, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'orders:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:read.'; END IF;
  SELECT supplier_catalog_id INTO v_catalog_id FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  RETURN QUERY
  WITH all_orders AS (
    SELECT so.id, 'legacy'::text AS source, 'PED-' || LEFT(so.id::text, 8) AS numero,
      COALESCE(o.nombre, 'Organización') AS org_nombre, so.org_id,
      CASE so.estado WHEN 'enviado' THEN 'pending' WHEN 'confirmado' THEN 'confirmed' WHEN 'recibido' THEN 'completed' WHEN 'cancelado' THEN 'cancelled' ELSE so.estado END AS estado,
      so.estado AS original_estado, COALESCE(so.total, 0) AS total, COUNT(sol.id) AS items_count, so.notas, so.created_at,
      CASE WHEN so.estado IN ('confirmado','recibido') THEN so.updated_at ELSE NULL END AS confirmed_at,
      NULL::timestamptz AS shipped_at, CASE WHEN so.estado = 'recibido' THEN so.updated_at ELSE NULL END AS completed_at
    FROM public.trade_supplier_orders so LEFT JOIN public.trade_organizations o ON o.id = so.org_id LEFT JOIN public.trade_supplier_order_lines sol ON sol.order_id = so.id
    WHERE so.catalog_id = v_catalog_id AND so.estado != 'borrador' GROUP BY so.id, o.nombre
    UNION ALL
    SELECT mo.id, 'marketplace'::text AS source, mo.numero, COALESCE(o.nombre, 'Organización') AS org_nombre, mo.org_id, mo.estado, mo.estado AS original_estado,
      COALESCE(mo.total, 0) AS total, COUNT(oi.id) AS items_count, mo.notas, mo.created_at, mo.confirmed_at, mo.shipped_at, mo.completed_at
    FROM public.trade_marketplace_orders mo LEFT JOIN public.trade_organizations o ON o.id = mo.org_id LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = mo.id
    WHERE mo.actor_id = p_actor_id GROUP BY mo.id, o.nombre
  )
  SELECT ao.*, COUNT(*) OVER () AS total_count FROM all_orders ao WHERE (p_estado IS NULL OR ao.estado = p_estado) ORDER BY ao.created_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_supplier_order(p_order_id uuid, p_source text DEFAULT 'legacy')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid;
BEGIN
  IF p_source = 'legacy' THEN
    SELECT a.id INTO v_actor_id FROM public.trade_supplier_orders so JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = so.catalog_id WHERE so.id = p_order_id AND so.estado = 'enviado';
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND_OR_INVALID: Pedido no encontrado o no está en estado enviado.'; END IF;
    IF NOT public._mkt_has_permission(v_actor_id, 'orders:manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:manage.'; END IF;
    UPDATE public.trade_supplier_orders SET estado = 'confirmado', updated_at = now() WHERE id = p_order_id;
  ELSE
    SELECT actor_id INTO v_actor_id FROM public.trade_marketplace_orders WHERE id = p_order_id AND estado = 'pending';
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND_OR_INVALID: Pedido no encontrado o no está en estado pending.'; END IF;
    IF NOT public._mkt_has_permission(v_actor_id, 'orders:manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:manage.'; END IF;
    UPDATE public.trade_marketplace_orders SET estado = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = p_order_id;
  END IF;
  INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload) VALUES (v_actor_id, 'order.confirmed', jsonb_build_object('order_id', p_order_id, 'source', p_source, 'confirmed_by', auth.uid()));
END; $$;

CREATE OR REPLACE FUNCTION public.ship_supplier_order(p_order_id uuid, p_source text DEFAULT 'legacy', p_tracking text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid;
BEGIN
  IF p_source = 'legacy' THEN
    SELECT a.id INTO v_actor_id FROM public.trade_supplier_orders so JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = so.catalog_id WHERE so.id = p_order_id AND so.estado = 'confirmado';
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND_OR_INVALID: Pedido no encontrado o no está en estado confirmado.'; END IF;
    IF NOT public._mkt_has_permission(v_actor_id, 'orders:fulfillment') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:fulfillment.'; END IF;
    UPDATE public.trade_supplier_orders SET estado = 'recibido', updated_at = now() WHERE id = p_order_id;
  ELSE
    SELECT actor_id INTO v_actor_id FROM public.trade_marketplace_orders WHERE id = p_order_id AND estado IN ('confirmed','preparing');
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND_OR_INVALID: Pedido no encontrado o estado no válido para envío.'; END IF;
    IF NOT public._mkt_has_permission(v_actor_id, 'orders:fulfillment') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:fulfillment.'; END IF;
    UPDATE public.trade_marketplace_orders SET estado = 'shipped', shipped_at = now(), updated_at = now() WHERE id = p_order_id;
  END IF;
  INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload) VALUES (v_actor_id, 'order.shipped', jsonb_build_object('order_id', p_order_id, 'source', p_source, 'tracking', p_tracking, 'shipped_by', auth.uid()));
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_health_score(p_actor_id uuid)
RETURNS TABLE (score integer, cobertura_pts integer, stock_pts integer, respuesta_pts integer, completado_pts integer, cobertura_pct numeric, stock_pct numeric, avg_confirm_h numeric, completion_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_id uuid; v_cov_pct numeric := 0; v_stock_pct numeric := 0; v_avg_h numeric := NULL; v_compl_rate numeric := 0; v_cov_pts integer; v_stock_pts integer; v_resp_pts integer; v_compl_pts integer;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'analytics:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere analytics:read.'; END IF;
  SELECT supplier_catalog_id INTO v_catalog_id FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  SELECT ROUND(COUNT(*) FILTER (WHERE match_state='matched') * 100.0 / NULLIF(COUNT(*),0),1), ROUND(COUNT(*) FILTER (WHERE activa AND stock_disponible) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE activa),0),1)
  INTO v_cov_pct, v_stock_pct FROM public.trade_marketplace_supplier_offerings WHERE supplier_catalog_id = v_catalog_id;
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 1) INTO v_avg_h FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND estado IN ('confirmado','recibido') AND created_at > now() - interval '90 days';
  SELECT ROUND(COUNT(*) FILTER (WHERE estado IN ('recibido','completed')) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE estado != 'cancelado' AND estado != 'cancelled'), 0), 1) INTO v_compl_rate FROM public.trade_supplier_orders WHERE catalog_id = v_catalog_id AND created_at > now() - interval '90 days';
  v_cov_pts := LEAST(30, ROUND(COALESCE(v_cov_pct, 0) * 0.3))::integer;
  v_stock_pts := LEAST(20, ROUND(COALESCE(v_stock_pct, 0) * 0.2))::integer;
  v_resp_pts := CASE WHEN v_avg_h IS NULL THEN 15 WHEN v_avg_h <= 4 THEN 25 WHEN v_avg_h <= 24 THEN 20 WHEN v_avg_h <= 48 THEN 10 ELSE 0 END;
  v_compl_pts := LEAST(25, ROUND(COALESCE(v_compl_rate, 50) * 0.25))::integer;
  RETURN QUERY SELECT LEAST(100, GREATEST(0, v_cov_pts + v_stock_pts + v_resp_pts + v_compl_pts)), v_cov_pts, v_stock_pts, v_resp_pts, v_compl_pts, COALESCE(v_cov_pct, 0), COALESCE(v_stock_pct, 0), v_avg_h, COALESCE(v_compl_rate, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.get_supplier_notifications(p_actor_id uuid, p_limit integer DEFAULT 20, p_unread_only boolean DEFAULT false)
RETURNS TABLE (id uuid, tipo text, titulo text, cuerpo text, ref_id uuid, ref_tipo text, leida boolean, leida_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, tipo, titulo, cuerpo, ref_id, ref_tipo, leida, leida_at, created_at FROM public.trade_marketplace_notifications WHERE actor_id = p_actor_id AND (NOT p_unread_only OR NOT leida) ORDER BY created_at DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_actor_id uuid, p_notification_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.trade_marketplace_notifications SET leida = true, leida_at = now() WHERE actor_id = p_actor_id AND id = ANY(p_notification_ids) AND NOT leida;
$$;

CREATE OR REPLACE FUNCTION public.create_marketplace_actor(p_nombre text, p_legal_name text DEFAULT NULL, p_tax_id text DEFAULT NULL, p_country char(2) DEFAULT 'ES', p_catalog_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_actor_id uuid; v_slug text; v_owner_role uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: Autenticación requerida.'; END IF;
  v_slug := lower(regexp_replace(p_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  WHILE EXISTS (SELECT 1 FROM public.trade_marketplace_actors WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || left(gen_random_uuid()::text, 4);
  END LOOP;
  SELECT id INTO v_owner_role FROM public.trade_marketplace_roles WHERE actor_type = 'supplier' AND nombre = 'owner' AND is_system = true AND actor_id IS NULL;
  INSERT INTO public.trade_marketplace_actors (actor_type, nombre, slug, legal_name, tax_id, country, supplier_catalog_id, estado, verificado)
  VALUES ('supplier', p_nombre, v_slug, p_legal_name, p_tax_id, p_country, p_catalog_id, 'pending', false) RETURNING id INTO v_actor_id;
  INSERT INTO public.trade_marketplace_actor_members (actor_id, user_id, role_id, activo, accepted_at) VALUES (v_actor_id, v_user_id, v_owner_role, true, now());
  INSERT INTO public.trade_marketplace_supplier_config (actor_id) VALUES (v_actor_id);
  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data) VALUES (v_actor_id, v_user_id, 'actor_created', jsonb_build_object('nombre', p_nombre, 'catalog_id', p_catalog_id));
  RETURN v_actor_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_offering_match_candidates(p_offering_id uuid, p_query text DEFAULT NULL, p_limit integer DEFAULT 5)
RETURNS TABLE (up_id uuid, nombre_canonico text, familia text, oficio text, marca text, modelo text, ean text, mpn text, score numeric, match_ean boolean, match_mpn boolean, match_marca boolean, match_familia boolean, match_descripcion boolean, explicacion text, ofertas_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_id uuid; v_offering RECORD;
BEGIN
  SELECT a.id INTO v_actor_id FROM public.trade_marketplace_supplier_offerings o JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id WHERE o.id = p_offering_id;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada.'; END IF;
  IF NOT public._mkt_has_permission(v_actor_id, 'offerings:read') THEN RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.'; END IF;
  SELECT * INTO v_offering FROM public.trade_marketplace_supplier_offerings WHERE id = p_offering_id;
  RETURN QUERY
  WITH scored AS (
    SELECT up.id, up.nombre_canonico, up.familia, up.oficio, up.marca, up.modelo, up.ean, up.mpn,
      (v_offering.ean IS NOT NULL AND v_offering.ean = up.ean) AS match_ean,
      (v_offering.mpn IS NOT NULL AND lower(v_offering.mpn) = lower(COALESCE(up.mpn,''))) AS match_mpn,
      (v_offering.marca IS NOT NULL AND lower(v_offering.marca) = lower(COALESCE(up.marca,''))) AS match_marca,
      (v_offering.familia IS NOT NULL AND lower(v_offering.familia) = lower(COALESCE(up.familia,''))) AS match_familia,
      (up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial, 20) || '%') AS match_descripcion,
      LEAST(100, CASE WHEN v_offering.ean IS NOT NULL AND v_offering.ean = up.ean THEN 60 ELSE 0 END +
        CASE WHEN v_offering.mpn IS NOT NULL AND lower(v_offering.mpn) = lower(COALESCE(up.mpn,'')) THEN 40 ELSE 0 END +
        CASE WHEN lower(COALESCE(v_offering.familia,'')) = lower(COALESCE(up.familia,'')) AND COALESCE(up.familia,'') != '' THEN 20 ELSE 0 END +
        CASE WHEN lower(COALESCE(v_offering.marca,'')) = lower(COALESCE(up.marca,'')) AND COALESCE(up.marca,'') != '' THEN 15 ELSE 0 END +
        CASE WHEN up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial,20) || '%' THEN 10 ELSE 0 END)::numeric AS score,
      COUNT(o2.id) FILTER (WHERE o2.match_state = 'matched') AS ofertas_count
    FROM public.trade_marketplace_universal_products up LEFT JOIN public.trade_marketplace_supplier_offerings o2 ON o2.universal_product_id = up.id
    WHERE up.validation_state = 'validated' AND (p_query IS NULL OR up.nombre_canonico ILIKE '%' || p_query || '%' OR up.ean = p_query OR up.mpn ILIKE '%' || p_query || '%' OR up.familia ILIKE '%' || p_query || '%'
      OR (p_query IS NULL AND (up.ean = v_offering.ean OR lower(up.mpn) = lower(COALESCE(v_offering.mpn,'')) OR up.nombre_canonico ILIKE '%' || LEFT(v_offering.descripcion_comercial, 20) || '%')))
    GROUP BY up.id
  )
  SELECT s.id, s.nombre_canonico, s.familia, s.oficio, s.marca, s.modelo, s.ean, s.mpn, s.score, s.match_ean, s.match_mpn, s.match_marca, s.match_familia, s.match_descripcion,
    (CASE WHEN s.match_ean THEN 'Coincidencia por EAN exacto.' WHEN s.match_mpn THEN 'Coincidencia por MPN del fabricante.' WHEN s.match_marca AND s.match_familia THEN 'Coincidencia por marca y familia de producto.' WHEN s.match_familia THEN 'Coincidencia por familia de producto.' WHEN s.match_descripcion THEN 'Coincidencia por descripción similar.' ELSE 'Posible coincidencia basada en múltiples campos.' END)::text AS explicacion,
    s.ofertas_count
  FROM scored s WHERE s.score > 0 ORDER BY s.score DESC, s.nombre_canonico LIMIT p_limit;
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_dashboard_stats(uuid)               FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_action_center(uuid)                 FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_ai_insights(uuid)                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_offerings_paged(uuid,text,text,integer,integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_supplier_offering(uuid,numeric,numeric,boolean,integer,text,integer,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.match_offering_to_up(uuid,uuid,text)             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.unmatch_offering(uuid)                           FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_orders_unified(uuid,text,integer,integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirm_supplier_order(uuid,text)                FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ship_supplier_order(uuid,text,text)              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_health_score(uuid)                  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_notifications(uuid,integer,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid,uuid[])             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_actor(text,text,text,char,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_offering_match_candidates(uuid,text,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_supplier_dashboard_stats(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_action_center(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_ai_insights(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_offerings_paged(uuid,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_supplier_offering(uuid,numeric,numeric,boolean,integer,text,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_offering_to_up(uuid,uuid,text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch_offering(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_orders_unified(uuid,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_order(uuid,text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.ship_supplier_order(uuid,text,text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_health_score(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_notifications(uuid,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid,uuid[])             TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_actor(text,text,text,char,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offering_match_candidates(uuid,text,integer) TO authenticated;;
