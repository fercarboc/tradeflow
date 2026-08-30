-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 1C — Flujo Checkout: Presupuesto → Carrito → Comparador → Pedido
-- Fecha: 2026-07-24
-- Requiere: Sprint 1B (trade_marketplace_orders, trade_marketplace_actors, etc.)
-- Fuentes soportadas: quote | job | field_action | maintenance_incident | manual
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. CARRITO INTELIGENTE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_carts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL
    REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL DEFAULT auth.uid(),
  -- Fuente del carrito
  source_type   text        NOT NULL
    CONSTRAINT chk_cart_source CHECK (
      source_type IN ('quote','job','field_action','maintenance_incident','manual')),
  source_id     uuid,        -- FK lógica (multi-tabla, sin FK real)
  source_ref    text,        -- número/referencia del documento fuente (display)
  -- Estado del carrito
  estado        text        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_cart_estado CHECK (
      estado IN ('active','reviewing','checkout','ordered','cancelled')),
  notas         text,
  -- Timestamps del ciclo de vida
  ordered_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_carts IS
  'Carrito Inteligente de Marketplace. Una compra = un carrito. Fuente: cualquier documento del ERP.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. LÍNEAS DEL CARRITO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_cart_items (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id                   uuid        NOT NULL
    REFERENCES public.trade_marketplace_carts(id) ON DELETE CASCADE,
  -- Origen dentro del documento fuente
  source_item_type          text,       -- 'quote_item' | 'field_action' | 'manual'
  source_item_id            uuid,       -- id en la tabla origen
  -- Descripción del material
  descripcion_original      text        NOT NULL,
  descripcion_compra        text,       -- puede editarse
  cantidad                  numeric(12,4) NOT NULL CHECK (cantidad > 0),
  unidad                    text        NOT NULL DEFAULT 'ud',
  -- Producto Universal identificado
  universal_product_id      uuid
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  up_match_confidence       numeric(4,3),
  up_match_method           text,
  -- Proveedor seleccionado (puede ser null si el usuario no ha elegido)
  selected_offering_id      uuid
    REFERENCES public.trade_marketplace_supplier_offerings(id) ON DELETE SET NULL,
  selected_actor_id         uuid
    REFERENCES public.trade_marketplace_actors(id) ON DELETE SET NULL,
  -- Alternativas (JSONB: [{offering_id, actor_id, actor_nombre, actor_verificado,
  --   precio_coste, delivery_days, stock_ok, score, score_pts: {precio,entrega,stock,afinidad}}])
  provider_alternatives     jsonb       NOT NULL DEFAULT '[]',
  -- IA
  ia_tipo                   text        -- null | 'consumible' | 'equivalente' | 'faltante' | 'optimizacion'
    CONSTRAINT chk_ia_tipo CHECK (ia_tipo IN ('consumible','equivalente','faltante','optimizacion') OR ia_tipo IS NULL),
  ia_sugerencia             text,       -- explicación legible
  ia_añadido                boolean     NOT NULL DEFAULT false, -- true si fue añadido por la IA
  -- Precio snapshot en checkout
  precio_unitario_final     numeric(12,4),
  total_linea               numeric(12,2) GENERATED ALWAYS AS
    (CASE WHEN precio_unitario_final IS NOT NULL THEN cantidad * precio_unitario_final::numeric(12,2) END) STORED,
  -- Control
  activo                    boolean     NOT NULL DEFAULT true,  -- false = excluido de la compra
  created_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_cart_items IS
  'Líneas del carrito. Incluye materiales del documento fuente + sugerencias IA.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. REGLAS DE CONSUMIBLES (seed para IA rules-based)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_consumable_rules (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_trigger text    NOT NULL,    -- familia que dispara la regla
  keyword_trigger text,               -- keyword alternativa en descripcion
  consumible_desc text    NOT NULL,   -- descripción del consumible a sugerir
  unidad          text    NOT NULL DEFAULT 'ud',
  ratio_cantidad  numeric(6,3) NOT NULL DEFAULT 1.0, -- multiplicador vs cantidad del trigger
  activa          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_consumable_rules IS
  'Reglas rules-based para sugerir consumibles complementarios. Evoluciona hacia ML en futuras fases.';

-- Seed de reglas básicas
INSERT INTO public.trade_marketplace_consumable_rules
  (familia_trigger, keyword_trigger, consumible_desc, unidad, ratio_cantidad)
VALUES
  ('Electricidad',         'cable',         'Brida sujeción cable (100u)',    'bolsa', 0.1),
  ('Electricidad',         'cable',         'Conector automático 3 bornes',   'ud',    2.0),
  ('Electricidad',         'mecanismo',     'Caja empotrar 65mm',             'ud',    1.0),
  ('Electricidad',         'cuadro',        'Cinta señalización eléctrica',   'rollo', 0.1),
  ('Electricidad',         'luminaria',     'Brida metálica fijación',        'ud',    2.0),
  ('Fontanería',           'tubo',          'Codo 90° mismo diámetro',        'ud',    2.0),
  ('Fontanería',           'tubo',          'Cinta teflón (12mm)',            'rollo', 0.5),
  ('Fontanería',           'grifería',      'Flexo extensible 40cm',          'ud',    2.0),
  ('Fontanería',           'bomba',         'Manguito antivibración',         'ud',    1.0),
  ('Climatización',        'split',         'Kit anclaje taco expansión',     'kit',   1.0),
  ('Climatización',        'conducto',      'Cinta aluminio autoadhesiva',    'rollo', 0.2),
  ('Climatización',        'tubería cobre', 'Soldadura plata 5%',             'varilla',2.0),
  ('Reformas',             'tabique',       'Cinta junta placa escayola',     'rollo', 0.1),
  ('Reformas',             'pintura',       'Rodillo lana 23cm',              'ud',    0.2),
  ('Madera / Carpintería', 'tablero',       'Tornillo Spax 4x40 (200u)',      'caja',  0.2),
  ('Madera / Carpintería', 'barniz',        'Lija grano 120 (5u)',            'sobre', 0.2)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cart_org       ON public.trade_marketplace_carts(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_cart_user      ON public.trade_marketplace_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_source    ON public.trade_marketplace_carts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cart_items     ON public.trade_marketplace_cart_items(cart_id, activo);
CREATE INDEX IF NOT EXISTS idx_cart_item_up   ON public.trade_marketplace_cart_items(universal_product_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_actor ON public.trade_marketplace_cart_items(selected_actor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_updated_at'
    AND tgrelid = 'public.trade_marketplace_carts'::regclass) THEN
    CREATE TRIGGER trg_cart_updated_at
      BEFORE UPDATE ON public.trade_marketplace_carts
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_carts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_cart_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_consumable_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_org_members"       ON public.trade_marketplace_carts;
DROP POLICY IF EXISTS "cart_items_via_cart"    ON public.trade_marketplace_cart_items;
DROP POLICY IF EXISTS "consumable_rules_read"  ON public.trade_marketplace_consumable_rules;

CREATE POLICY "cart_org_members" ON public.trade_marketplace_carts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = trade_marketplace_carts.org_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = trade_marketplace_carts.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items_via_cart" ON public.trade_marketplace_cart_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_carts c
      JOIN public.trade_org_members m ON m.org_id = c.org_id
      WHERE c.id = cart_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_carts c
      JOIN public.trade_org_members m ON m.org_id = c.org_id
      WHERE c.id = cart_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "consumable_rules_read" ON public.trade_marketplace_consumable_rules
  FOR SELECT TO authenticated USING (activa = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. HELPER: RESOLVER ALTERNATIVAS DE PROVEEDOR POR ÍTEM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mkt_resolve_provider_alternatives(
  p_up_id       uuid,
  p_org_id      uuid,
  p_cantidad    numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_max_precio       numeric;
  v_result           jsonb := '[]';
BEGIN
  -- Precio máximo (para normalizar scoring)
  SELECT MAX(o.precio_coste) INTO v_max_precio
  FROM public.trade_marketplace_supplier_offerings o
  JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
  WHERE o.universal_product_id = p_up_id
    AND o.match_state = 'matched'
    AND o.activa = true
    AND a.estado = 'active';

  SELECT jsonb_agg(
    jsonb_build_object(
      'offering_id',    o.id,
      'actor_id',       a.id,
      'actor_nombre',   a.nombre,
      'actor_slug',     a.slug,
      'actor_verificado', a.verificado,
      'precio_coste',   o.precio_coste,
      'precio_venta',   o.precio_venta,
      'unidad',         o.unidad,
      'delivery_days',  COALESCE(o.plazo_entrega_dias, cfg.plazo_entrega_dias, 5),
      'stock_ok',       o.stock_disponible,
      'stock_cantidad', o.stock_cantidad,
      'permite_entrega', COALESCE(cfg.permite_entrega, true),
      'pedido_minimo',  cfg.pedido_minimo,
      'portes_gratis_desde', cfg.portes_gratis_desde,
      -- Scoring 0-100
      'score', LEAST(100, GREATEST(0,
        -- Precio: 40pts (menor precio = más puntos)
        CASE WHEN v_max_precio > 0 AND o.precio_coste IS NOT NULL
          THEN ROUND(40 * (1.0 - o.precio_coste / v_max_precio))
          ELSE 20
        END
        -- Entrega: 25pts (hasta 25 por entrega ≤1 día)
        + CASE
            WHEN COALESCE(o.plazo_entrega_dias, cfg.plazo_entrega_dias, 5) <= 1 THEN 25
            WHEN COALESCE(o.plazo_entrega_dias, cfg.plazo_entrega_dias, 5) <= 3 THEN 18
            WHEN COALESCE(o.plazo_entrega_dias, cfg.plazo_entrega_dias, 5) <= 7 THEN 10
            ELSE 3
          END
        -- Stock: 20pts
        + CASE WHEN o.stock_disponible AND (o.stock_cantidad IS NULL OR o.stock_cantidad >= p_cantidad) THEN 20
               WHEN o.stock_disponible THEN 10 ELSE 0 END
        -- Afinidad: hasta 15pts por historial de pedidos del org
        + LEAST(15, (
            SELECT COUNT(*) * 3
            FROM public.trade_supplier_orders so
            WHERE so.catalog_id = o.supplier_catalog_id
              AND so.org_id = p_org_id
              AND so.estado IN ('confirmado','recibido')
              AND so.created_at > now() - interval '180 days'
          ))
      )::integer)
    )
    ORDER BY 2 DESC  -- order by score desc (score is field 2 in the jsonb)
  ) INTO v_result
  FROM public.trade_marketplace_supplier_offerings o
  JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
  LEFT JOIN public.trade_marketplace_supplier_config cfg ON cfg.actor_id = a.id
  WHERE o.universal_product_id = p_up_id
    AND o.match_state = 'matched'
    AND o.activa = true
    AND a.estado = 'active'
  LIMIT 5;

  RETURN COALESCE(v_result, '[]');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. RPC — CREAR CARRITO DESDE PRESUPUESTO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote         RECORD;
  v_cart_id       uuid;
  v_item          RECORD;
  v_up_id         uuid;
  v_up_conf       numeric;
  v_up_method     text;
  v_alternatives  jsonb;
BEGIN
  -- Verificar que el presupuesto pertenece a la org del usuario
  SELECT q.id, q.org_id, q.numero, q.estado
  INTO v_quote
  FROM public.trade_quotes q
  JOIN public.trade_org_members m ON m.org_id = q.org_id
  WHERE q.id = p_quote_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Presupuesto no encontrado o sin acceso.';
  END IF;

  -- Verificar que hay materiales sin pedir
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_quote_items
    WHERE quote_id = p_quote_id AND tipo = 'material' AND NOT COALESCE(material_order_placed, false)
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Todos los materiales ya fueron pedidos.';
  END IF;

  -- Crear carrito
  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  -- Importar líneas de material
  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia, qi.supplier_ref,
           qi.catalog_variant_id, qi.precio_material
    FROM public.trade_quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.tipo = 'material'
      AND NOT COALESCE(qi.material_order_placed, false)
    ORDER BY qi.posicion
  LOOP
    -- Intentar matching con UP
    v_up_id     := NULL;
    v_up_conf   := NULL;
    v_up_method := NULL;

    -- Buscar UP por catalog_variant_id si existe
    IF v_item.catalog_variant_id IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.id = v_item.catalog_variant_id AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- Si no, buscar por supplier_ref
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- Fallback: búsqueda semántica en nombre canonico del UP
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.6::numeric, 'semantic'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'validated'
        AND (
          up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%'
          OR (v_item.familia IS NOT NULL AND up.familia ILIKE '%' || v_item.familia || '%')
        )
      ORDER BY
        CASE WHEN up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%' THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    -- Resolver alternativas de proveedor para el UP encontrado
    IF v_up_id IS NOT NULL THEN
      v_alternatives := public._mkt_resolve_provider_alternatives(
        v_up_id, v_quote.org_id, COALESCE(v_item.cantidad, 1)
      );
    ELSE
      v_alternatives := '[]'::jsonb;
    END IF;

    INSERT INTO public.trade_marketplace_cart_items (
      cart_id, source_item_type, source_item_id,
      descripcion_original, cantidad, unidad,
      universal_product_id, up_match_confidence, up_match_method,
      provider_alternatives,
      -- Pre-seleccionar el proveedor con mejor score si hay alternativas
      selected_offering_id, selected_actor_id,
      precio_unitario_final
    ) VALUES (
      v_cart_id, 'quote_item', v_item.id,
      v_item.descripcion, COALESCE(v_item.cantidad, 1), 'ud',
      v_up_id, v_up_conf, v_up_method,
      v_alternatives,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'offering_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'actor_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'precio_coste')::numeric ELSE v_item.precio_material END
    );
  END LOOP;

  RETURN v_cart_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. RPC — CREAR CARRITO DESDE TRABAJO (via field_actions material_necesario)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_from_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job       RECORD;
  v_cart_id   uuid;
  v_action    RECORD;
  v_up_id     uuid;
  v_alternatives jsonb;
BEGIN
  SELECT j.id, j.org_id, j.titulo
  INTO v_job
  FROM public.trade_jobs j
  JOIN public.trade_org_members m ON m.org_id = j.org_id
  WHERE j.id = p_job_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Trabajo no encontrado o sin acceso.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_field_actions
    WHERE job_id = p_job_id AND tipo = 'material_necesario' AND estado != 'resuelto'
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Sin materiales pendientes en este trabajo.';
  END IF;

  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_job.org_id, auth.uid(), 'job', p_job_id, v_job.titulo)
  RETURNING id INTO v_cart_id;

  FOR v_action IN
    SELECT id, descripcion
    FROM public.trade_field_actions
    WHERE job_id = p_job_id AND tipo = 'material_necesario' AND estado != 'resuelto'
  LOOP
    -- Búsqueda semántica en UPs
    SELECT up.id INTO v_up_id
    FROM public.trade_marketplace_universal_products up
    WHERE validation_state = 'validated'
      AND up.nombre_canonico ILIKE '%' || LEFT(v_action.descripcion, 20) || '%'
    LIMIT 1;

    v_alternatives := CASE WHEN v_up_id IS NOT NULL
      THEN public._mkt_resolve_provider_alternatives(v_up_id, v_job.org_id, 1)
      ELSE '[]'::jsonb
    END;

    INSERT INTO public.trade_marketplace_cart_items (
      cart_id, source_item_type, source_item_id,
      descripcion_original, cantidad, unidad,
      universal_product_id, up_match_method,
      provider_alternatives,
      selected_offering_id, selected_actor_id
    ) VALUES (
      v_cart_id, 'field_action', v_action.id,
      v_action.descripcion, 1, 'ud',
      v_up_id, CASE WHEN v_up_id IS NOT NULL THEN 'semantic' END,
      v_alternatives,
      CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid END
    );
  END LOOP;

  RETURN v_cart_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPC — CREAR CARRITO DESDE ACTUACIÓN (field_action individual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_from_field_action(p_action_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action    RECORD;
  v_job       RECORD;
  v_cart_id   uuid;
  v_up_id     uuid;
  v_alternatives jsonb;
BEGIN
  SELECT fa.id, fa.descripcion, fa.job_id
  INTO v_action
  FROM public.trade_field_actions fa
  JOIN public.trade_jobs j ON j.id = fa.job_id
  JOIN public.trade_org_members m ON m.org_id = j.org_id
  WHERE fa.id = p_action_id AND m.user_id = auth.uid() AND fa.tipo = 'material_necesario'
  LIMIT 1;

  IF v_action.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Actuación no encontrada o sin acceso.';
  END IF;

  SELECT j.org_id, j.titulo INTO v_job FROM public.trade_jobs j WHERE j.id = v_action.job_id;

  SELECT up.id INTO v_up_id
  FROM public.trade_marketplace_universal_products up
  WHERE validation_state = 'validated'
    AND up.nombre_canonico ILIKE '%' || LEFT(v_action.descripcion, 20) || '%'
  LIMIT 1;

  v_alternatives := CASE WHEN v_up_id IS NOT NULL
    THEN public._mkt_resolve_provider_alternatives(v_up_id, v_job.org_id, 1)
    ELSE '[]'::jsonb
  END;

  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_job.org_id, auth.uid(), 'field_action', p_action_id, v_job.titulo)
  RETURNING id INTO v_cart_id;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, source_item_type, source_item_id,
    descripcion_original, cantidad, unidad,
    universal_product_id, up_match_method, provider_alternatives,
    selected_offering_id, selected_actor_id
  ) VALUES (
    v_cart_id, 'field_action', v_action.id,
    v_action.descripcion, 1, 'ud',
    v_up_id, CASE WHEN v_up_id IS NOT NULL THEN 'semantic' END,
    v_alternatives,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid END,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid END
  );

  RETURN v_cart_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC — CREAR CARRITO DESDE INCIDENCIA DE MANTENIMIENTO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_from_maintenance_incident(p_incident_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_incident  RECORD;
  v_cart_id   uuid;
  v_up_id     uuid;
  v_alternatives jsonb;
BEGIN
  SELECT inc.id, inc.org_id, inc.titulo, inc.contrato_id
  INTO v_incident
  FROM public.trade_maintenance_incidencias inc
  JOIN public.trade_org_members m ON m.org_id = inc.org_id
  WHERE inc.id = p_incident_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Incidencia no encontrada o sin acceso.';
  END IF;

  SELECT up.id INTO v_up_id
  FROM public.trade_marketplace_universal_products up
  WHERE validation_state = 'validated'
    AND up.nombre_canonico ILIKE '%' || LEFT(v_incident.titulo, 20) || '%'
  LIMIT 1;

  v_alternatives := CASE WHEN v_up_id IS NOT NULL
    THEN public._mkt_resolve_provider_alternatives(v_up_id, v_incident.org_id, 1)
    ELSE '[]'::jsonb
  END;

  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_incident.org_id, auth.uid(), 'maintenance_incident', p_incident_id, v_incident.titulo)
  RETURNING id INTO v_cart_id;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, source_item_type, source_item_id,
    descripcion_original, cantidad, unidad,
    universal_product_id, up_match_method, provider_alternatives,
    selected_offering_id, selected_actor_id
  ) VALUES (
    v_cart_id, 'field_action', v_incident.id,
    v_incident.titulo, 1, 'ud',
    v_up_id, CASE WHEN v_up_id IS NOT NULL THEN 'semantic' END,
    v_alternatives,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid END,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid END
  );

  RETURN v_cart_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RPC — OBTENER DETALLE DEL CARRITO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_cart_detail(p_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart   RECORD;
  v_result jsonb;
BEGIN
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado o sin acceso.';
  END IF;

  SELECT jsonb_build_object(
    'cart', jsonb_build_object(
      'id',            v_cart.id,
      'org_id',        v_cart.org_id,
      'source_type',   v_cart.source_type,
      'source_id',     v_cart.source_id,
      'source_ref',    v_cart.source_ref,
      'estado',        v_cart.estado,
      'notas',         v_cart.notas,
      'created_at',    v_cart.created_at
    ),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                      ci.id,
          'source_item_type',        ci.source_item_type,
          'source_item_id',          ci.source_item_id,
          'descripcion_original',    ci.descripcion_original,
          'descripcion_compra',      ci.descripcion_compra,
          'cantidad',                ci.cantidad,
          'unidad',                  ci.unidad,
          'universal_product_id',    ci.universal_product_id,
          'up_nombre_canonico',      up.nombre_canonico,
          'up_familia',              up.familia,
          'up_match_confidence',     ci.up_match_confidence,
          'up_match_method',         ci.up_match_method,
          'selected_offering_id',    ci.selected_offering_id,
          'selected_actor_id',       ci.selected_actor_id,
          'selected_actor_nombre',   sa.nombre,
          'provider_alternatives',   ci.provider_alternatives,
          'ia_tipo',                 ci.ia_tipo,
          'ia_sugerencia',           ci.ia_sugerencia,
          'ia_añadido',              ci.ia_añadido,
          'precio_unitario_final',   ci.precio_unitario_final,
          'total_linea',             ci.total_linea,
          'activo',                  ci.activo
        ) ORDER BY ci.ia_añadido ASC, ci.created_at ASC
      )
      FROM public.trade_marketplace_cart_items ci
      LEFT JOIN public.trade_marketplace_universal_products up ON up.id = ci.universal_product_id
      LEFT JOIN public.trade_marketplace_actors sa ON sa.id = ci.selected_actor_id
      WHERE ci.cart_id = p_cart_id
    ), '[]'),
    'summary', (
      SELECT jsonb_build_object(
        'total_items',    COUNT(*) FILTER (WHERE activo),
        'items_con_up',   COUNT(*) FILTER (WHERE activo AND universal_product_id IS NOT NULL),
        'items_con_proveedor', COUNT(*) FILTER (WHERE activo AND selected_offering_id IS NOT NULL),
        'total_estimado', COALESCE(SUM(total_linea) FILTER (WHERE activo), 0),
        'providers_count', COUNT(DISTINCT selected_actor_id) FILTER (WHERE activo AND selected_actor_id IS NOT NULL)
      )
      FROM public.trade_marketplace_cart_items
      WHERE cart_id = p_cart_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RPC — ANÁLISIS IA DEL CARRITO (rules-based)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analyze_cart_with_ai(p_cart_id uuid)
RETURNS TABLE (
  tipo         text,  -- consumible | faltante | optimizacion | precio_alto
  titulo       text,
  descripcion  text,
  item_id      uuid,  -- si aplica a un ítem específico
  accion       text,  -- add_item | select_provider | review_price | group_orders
  payload      jsonb  -- datos para ejecutar la acción
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart       RECORD;
  v_item       RECORD;
  v_rule       RECORD;
  v_alt        jsonb;
  v_num_providers integer;
BEGIN
  -- Verificar acceso
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado.';
  END IF;

  -- 1. Sugerencias de consumibles por familia/keyword
  FOR v_item IN
    SELECT ci.id, ci.descripcion_original, up.familia
    FROM public.trade_marketplace_cart_items ci
    LEFT JOIN public.trade_marketplace_universal_products up ON up.id = ci.universal_product_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND NOT ci.ia_añadido
  LOOP
    FOR v_rule IN
      SELECT r.*
      FROM public.trade_marketplace_consumable_rules r
      WHERE r.activa = true
        AND (
          (v_item.familia IS NOT NULL AND lower(v_item.familia) ILIKE '%' || lower(r.familia_trigger) || '%')
          OR (r.keyword_trigger IS NOT NULL AND lower(v_item.descripcion_original) ILIKE '%' || lower(r.keyword_trigger) || '%')
        )
      LIMIT 3
    LOOP
      -- No sugerir si ya existe un ítem con descripción similar
      IF NOT EXISTS (
        SELECT 1 FROM public.trade_marketplace_cart_items
        WHERE cart_id = p_cart_id
          AND lower(descripcion_original) ILIKE '%' || lower(LEFT(v_rule.consumible_desc, 15)) || '%'
      ) THEN
        RETURN QUERY SELECT
          'consumible'::text,
          'Consumible sugerido'::text,
          'Para "' || LEFT(v_item.descripcion_original, 30) || '..." normalmente se necesita: ' || v_rule.consumible_desc,
          v_item.id,
          'add_item'::text,
          jsonb_build_object(
            'descripcion', v_rule.consumible_desc,
            'unidad',      v_rule.unidad,
            'cantidad',    v_rule.ratio_cantidad,
            'trigger_item_id', v_item.id
          );
      END IF;
    END LOOP;
  END LOOP;

  -- 2. Ítems sin proveedor asignado (UP encontrado pero sin oferta)
  FOR v_item IN
    SELECT ci.id, ci.descripcion_original
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true
      AND ci.universal_product_id IS NOT NULL
      AND ci.selected_offering_id IS NULL
      AND jsonb_array_length(ci.provider_alternatives) = 0
  LOOP
    RETURN QUERY SELECT
      'faltante'::text,
      'Sin proveedor disponible'::text,
      '"' || LEFT(v_item.descripcion_original, 40) || '" no tiene proveedores disponibles en el Marketplace.',
      v_item.id,
      'review_price'::text,
      jsonb_build_object('item_id', v_item.id);
  END LOOP;

  -- 3. Precio superior a la media del mercado
  FOR v_item IN
    SELECT ci.id, ci.descripcion_original, ci.selected_offering_id,
           ci.precio_unitario_final,
           AVG(o2.precio_coste) AS avg_market
    FROM public.trade_marketplace_cart_items ci
    JOIN public.trade_marketplace_supplier_offerings o2
      ON o2.universal_product_id = ci.universal_product_id
      AND o2.match_state = 'matched' AND o2.activa = true
    WHERE ci.cart_id = p_cart_id AND ci.activo = true
      AND ci.precio_unitario_final IS NOT NULL
      AND ci.universal_product_id IS NOT NULL
    GROUP BY ci.id, ci.descripcion_original, ci.selected_offering_id, ci.precio_unitario_final
    HAVING ci.precio_unitario_final > AVG(o2.precio_coste) * 1.15  -- >15% sobre media
  LOOP
    RETURN QUERY SELECT
      'precio_alto'::text,
      'Precio superior a la media'::text,
      '"' || LEFT(v_item.descripcion_original, 30) || '" tiene un precio ' ||
        ROUND((v_item.precio_unitario_final - v_item.avg_market) * 100.0 / v_item.avg_market)::text || '% superior a la media. Revisa las alternativas.',
      v_item.id,
      'select_provider'::text,
      jsonb_build_object('item_id', v_item.id, 'avg_market', ROUND(v_item.avg_market, 2));
  END LOOP;

  -- 4. Optimización: muchos proveedores distintos (consolidar pedidos)
  SELECT COUNT(DISTINCT selected_actor_id) INTO v_num_providers
  FROM public.trade_marketplace_cart_items
  WHERE cart_id = p_cart_id AND activo = true AND selected_actor_id IS NOT NULL;

  IF v_num_providers >= 3 THEN
    RETURN QUERY SELECT
      'optimizacion'::text,
      'Pedidos fragmentados'::text,
      'Tienes materiales de ' || v_num_providers || ' proveedores distintos. La IA puede consolidar para reducir portes y gestión.',
      NULL::uuid,
      'group_orders'::text,
      jsonb_build_object('providers_count', v_num_providers);
  END IF;

  RETURN;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RPC — AÑADIR ÍTEM MANUAL AL CARRITO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_cart_item(
  p_cart_id    uuid,
  p_descripcion text,
  p_cantidad   numeric DEFAULT 1,
  p_unidad     text    DEFAULT 'ud',
  p_ia_tipo    text    DEFAULT NULL,
  p_ia_sugerencia text DEFAULT NULL,
  p_ia_añadido boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart_id    uuid;
  v_item_id    uuid;
  v_org_id     uuid;
  v_up_id      uuid;
  v_alternatives jsonb := '[]';
BEGIN
  -- Verificar acceso
  SELECT c.id, c.org_id INTO v_cart_id, v_org_id
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid() AND c.estado = 'active'
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_CLOSED: Carrito no encontrado o no activo.';
  END IF;

  -- Buscar UP
  SELECT up.id INTO v_up_id
  FROM public.trade_marketplace_universal_products up
  WHERE validation_state = 'validated'
    AND up.nombre_canonico ILIKE '%' || LEFT(p_descripcion, 15) || '%'
  LIMIT 1;

  IF v_up_id IS NOT NULL THEN
    v_alternatives := public._mkt_resolve_provider_alternatives(v_up_id, v_org_id, p_cantidad);
  END IF;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, source_item_type, descripcion_original, cantidad, unidad,
    universal_product_id, up_match_method, provider_alternatives,
    ia_tipo, ia_sugerencia, ia_añadido,
    selected_offering_id, selected_actor_id, precio_unitario_final
  ) VALUES (
    p_cart_id, 'manual', p_descripcion, p_cantidad, p_unidad,
    v_up_id, CASE WHEN v_up_id IS NOT NULL THEN 'semantic' END, v_alternatives,
    p_ia_tipo, p_ia_sugerencia, p_ia_añadido,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid END,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid END,
    CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'precio_coste')::numeric END
  ) RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. RPC — SELECCIONAR OFERTA PARA UN ÍTEM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.select_offering_for_cart_item(
  p_item_id    uuid,
  p_offering_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offering RECORD;
  v_item     RECORD;
BEGIN
  -- Verificar acceso al ítem
  SELECT ci.id, ci.cart_id INTO v_item
  FROM public.trade_marketplace_cart_items ci
  JOIN public.trade_marketplace_carts c ON c.id = ci.cart_id
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE ci.id = p_item_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Ítem no encontrado o sin acceso.';
  END IF;

  SELECT o.id, o.precio_coste,
    (SELECT a.id FROM public.trade_marketplace_actors a WHERE a.supplier_catalog_id = o.supplier_catalog_id LIMIT 1) AS actor_id
  INTO v_offering
  FROM public.trade_marketplace_supplier_offerings o
  WHERE o.id = p_offering_id AND o.activa = true;

  IF v_offering.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Oferta no encontrada o inactiva.';
  END IF;

  UPDATE public.trade_marketplace_cart_items SET
    selected_offering_id  = p_offering_id,
    selected_actor_id     = v_offering.actor_id,
    precio_unitario_final = v_offering.precio_coste
  WHERE id = p_item_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. RPC — AUTO-SELECCIONAR MEJORES PROVEEDORES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_select_providers(
  p_cart_id  uuid,
  p_strategy text DEFAULT 'balance'  -- 'balance' | 'precio' | 'velocidad' | 'consolidar'
)
RETURNS integer  -- número de ítems actualizados
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart_id   uuid;
  v_updated   integer := 0;
  v_item      RECORD;
  v_best_alt  jsonb;
  v_best_idx  integer;
  v_score_key text;
BEGIN
  SELECT c.id INTO v_cart_id
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid() AND c.estado = 'active'
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_CLOSED: Carrito no encontrado o no activo.';
  END IF;

  -- Para 'consolidar': elegir el proveedor que aparece más veces con buen score
  IF p_strategy = 'consolidar' THEN
    -- Encontrar el actor que puede surtir más ítems con buena calidad
    WITH best_actor AS (
      SELECT (alt->>'actor_id')::uuid AS actor_id, COUNT(*) AS cnt
      FROM public.trade_marketplace_cart_items ci,
           LATERAL jsonb_array_elements(ci.provider_alternatives) alt
      WHERE ci.cart_id = p_cart_id AND ci.activo = true
        AND (alt->>'score')::integer >= 50
      GROUP BY (alt->>'actor_id')::uuid
      ORDER BY cnt DESC
      LIMIT 1
    )
    UPDATE public.trade_marketplace_cart_items ci SET
      selected_offering_id  = (
        SELECT (alt->>'offering_id')::uuid
        FROM jsonb_array_elements(ci.provider_alternatives) alt
        WHERE (alt->>'actor_id')::uuid = (SELECT actor_id FROM best_actor)
        LIMIT 1
      ),
      selected_actor_id     = (SELECT actor_id FROM best_actor),
      precio_unitario_final = (
        SELECT (alt->>'precio_coste')::numeric
        FROM jsonb_array_elements(ci.provider_alternatives) alt
        WHERE (alt->>'actor_id')::uuid = (SELECT actor_id FROM best_actor)
        LIMIT 1
      )
    WHERE ci.cart_id = p_cart_id AND ci.activo = true
      AND jsonb_array_length(ci.provider_alternatives) > 0
      AND EXISTS (
        SELECT 1 FROM best_actor ba
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(ci.provider_alternatives) alt
          WHERE (alt->>'actor_id')::uuid = ba.actor_id
        )
      );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
  END IF;

  -- Para otros estrategias: elegir la mejor alternativa por criterio
  FOR v_item IN
    SELECT id, provider_alternatives, cantidad
    FROM public.trade_marketplace_cart_items
    WHERE cart_id = p_cart_id AND activo = true
      AND jsonb_array_length(provider_alternatives) > 0
  LOOP
    -- Seleccionar alternativa según estrategia
    -- 'balance': max score (default sort from _mkt_resolve_provider_alternatives)
    -- 'precio': min precio_coste
    -- 'velocidad': min delivery_days + stock_ok
    SELECT alt, idx INTO v_best_alt, v_best_idx
    FROM (
      SELECT alt, row_number() OVER () - 1 AS idx
      FROM jsonb_array_elements(v_item.provider_alternatives) alt
      ORDER BY
        CASE p_strategy
          WHEN 'precio'    THEN (alt->>'precio_coste')::numeric
          WHEN 'velocidad' THEN (alt->>'delivery_days')::integer
          ELSE -(alt->>'score')::integer  -- balance: mejor score primero
        END ASC
    ) ranked
    LIMIT 1;

    IF v_best_alt IS NOT NULL THEN
      UPDATE public.trade_marketplace_cart_items SET
        selected_offering_id  = (v_best_alt->>'offering_id')::uuid,
        selected_actor_id     = (v_best_alt->>'actor_id')::uuid,
        precio_unitario_final = (v_best_alt->>'precio_coste')::numeric
      WHERE id = v_item.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. RPC — ACTUALIZAR ITEM DEL CARRITO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_cart_item(
  p_item_id     uuid,
  p_cantidad    numeric  DEFAULT NULL,
  p_unidad      text     DEFAULT NULL,
  p_descripcion text     DEFAULT NULL,
  p_activo      boolean  DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.trade_marketplace_cart_items SET
    cantidad              = COALESCE(p_cantidad,    cantidad),
    unidad                = COALESCE(p_unidad,      unidad),
    descripcion_compra    = COALESCE(p_descripcion, descripcion_compra),
    activo                = COALESCE(p_activo,      activo)
  WHERE id = p_item_id
    AND EXISTS (
      SELECT 1 FROM public.trade_marketplace_carts c
      JOIN public.trade_org_members m ON m.org_id = c.org_id
      WHERE c.id = cart_id AND m.user_id = auth.uid()
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. RPC — RESUMEN DE PROVEEDORES DEL CARRITO (para pantalla comparador)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_cart_provider_summary(p_cart_id uuid)
RETURNS TABLE (
  actor_id       uuid,
  actor_nombre   text,
  actor_verificado boolean,
  items_count    bigint,
  subtotal       numeric,
  portes         numeric,
  total_estimado numeric,
  delivery_days  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Verificar acceso
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_carts c
    JOIN public.trade_org_members m ON m.org_id = c.org_id
    WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado.';
  END IF;

  RETURN QUERY
  SELECT
    ci.selected_actor_id,
    a.nombre,
    a.verificado,
    COUNT(*) AS items_count,
    COALESCE(SUM(ci.total_linea), 0) AS subtotal,
    COALESCE(
      CASE
        WHEN cfg.portes_gratis_desde IS NOT NULL
          AND SUM(ci.total_linea) >= cfg.portes_gratis_desde THEN 0
        ELSE COALESCE(cfg.coste_portes, 0)
      END, 0
    ) AS portes,
    COALESCE(SUM(ci.total_linea), 0) +
    COALESCE(
      CASE
        WHEN cfg.portes_gratis_desde IS NOT NULL
          AND SUM(ci.total_linea) >= cfg.portes_gratis_desde THEN 0
        ELSE COALESCE(cfg.coste_portes, 0)
      END, 0
    ) AS total_estimado,
    COALESCE(cfg.plazo_entrega_dias, 5) AS delivery_days
  FROM public.trade_marketplace_cart_items ci
  JOIN public.trade_marketplace_actors a ON a.id = ci.selected_actor_id
  LEFT JOIN public.trade_marketplace_supplier_config cfg ON cfg.actor_id = ci.selected_actor_id
  WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  GROUP BY ci.selected_actor_id, a.nombre, a.verificado, cfg.coste_portes, cfg.portes_gratis_desde, cfg.plazo_entrega_dias
  ORDER BY total_estimado;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. RPC — CHECKOUT: GENERAR PEDIDOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.checkout_cart(p_cart_id uuid)
RETURNS uuid[]  -- array de marketplace_order_ids generados
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart         RECORD;
  v_actor        RECORD;
  v_order_id     uuid;
  v_order_ids    uuid[] := '{}';
  v_item         RECORD;
  v_grand_total  numeric;
  v_source_quote_id uuid;
BEGIN
  -- Verificar acceso y estado
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid() AND c.estado = 'active'
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_CLOSED: Carrito no encontrado o ya procesado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_cart_items
    WHERE cart_id = p_cart_id AND activo = true AND selected_actor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'NO_ITEMS: No hay ítems con proveedor seleccionado.';
  END IF;

  -- Obtener quote_id si la fuente es una cotización
  IF v_cart.source_type = 'quote' THEN
    v_source_quote_id := v_cart.source_id;
  END IF;

  -- Marcar carrito en proceso
  UPDATE public.trade_marketplace_carts SET estado = 'checkout', updated_at = now()
  WHERE id = p_cart_id;

  -- Crear un pedido por proveedor
  FOR v_actor IN
    SELECT DISTINCT ci.selected_actor_id AS actor_id
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  LOOP
    -- Calcular total del pedido para este proveedor
    SELECT COALESCE(SUM(ci.total_linea), 0) INTO v_grand_total
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    -- Calcular coste de portes
    DECLARE
      v_portes numeric := 0;
      v_cfg    RECORD;
    BEGIN
      SELECT cfg.coste_portes, cfg.portes_gratis_desde INTO v_cfg
      FROM public.trade_marketplace_supplier_config cfg WHERE cfg.actor_id = v_actor.actor_id;
      IF v_cfg.portes_gratis_desde IS NULL OR v_grand_total < v_cfg.portes_gratis_desde THEN
        v_portes := COALESCE(v_cfg.coste_portes, 0);
      END IF;

      INSERT INTO public.trade_marketplace_orders (
        actor_id, org_id, estado, subtotal, coste_envio, total, quote_id
      ) VALUES (
        v_actor.actor_id, v_cart.org_id,
        'pending',
        v_grand_total, v_portes, v_grand_total + v_portes,
        v_source_quote_id
      ) RETURNING id INTO v_order_id;
    END;

    -- Insertar líneas del pedido
    INSERT INTO public.trade_marketplace_order_items (
      order_id, offering_id, universal_product_id,
      referencia, descripcion, unidad, cantidad, precio_unitario
    )
    SELECT
      v_order_id,
      ci.selected_offering_id,
      ci.universal_product_id,
      o.supplier_ref,
      COALESCE(ci.descripcion_compra, ci.descripcion_original),
      ci.unidad,
      ci.cantidad,
      ci.precio_unitario_final
    FROM public.trade_marketplace_cart_items ci
    LEFT JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    -- Notificación al proveedor
    INSERT INTO public.trade_marketplace_notifications (actor_id, tipo, titulo, cuerpo, ref_id, ref_tipo)
    VALUES (
      v_actor.actor_id, 'order_received',
      'Nuevo pedido recibido',
      'Has recibido un nuevo pedido desde el Marketplace de TrabFlow.',
      v_order_id, 'marketplace_order'
    );

    -- Outbox (futuro webhook/email)
    INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload)
    VALUES (v_actor.actor_id, 'order.created',
      jsonb_build_object('order_id', v_order_id, 'cart_id', p_cart_id, 'org_id', v_cart.org_id));

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  -- Marcar material_order_placed en los quote_items originales
  IF v_source_quote_id IS NOT NULL THEN
    UPDATE public.trade_quote_items SET material_order_placed = true
    WHERE quote_id = v_source_quote_id
      AND id IN (
        SELECT ci.source_item_id FROM public.trade_marketplace_cart_items ci
        WHERE ci.cart_id = p_cart_id AND ci.source_item_type = 'quote_item'
          AND ci.activo = true AND ci.source_item_id IS NOT NULL
      );
  END IF;

  -- Marcar carrito como pedido
  UPDATE public.trade_marketplace_carts SET
    estado = 'ordered', ordered_at = now(), updated_at = now()
  WHERE id = p_cart_id;

  RETURN v_order_ids;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. RPC — ESTADO DE PEDIDOS DE UN CARRITO (tracking)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_cart_order_status(p_cart_id uuid)
RETURNS TABLE (
  order_id       uuid,
  actor_nombre   text,
  actor_verificado boolean,
  estado         text,
  total          numeric,
  items_count    bigint,
  created_at     timestamptz,
  confirmed_at   timestamptz,
  shipped_at     timestamptz,
  completed_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    mo.id, a.nombre, a.verificado,
    mo.estado, mo.total,
    COUNT(oi.id) AS items_count,
    mo.created_at, mo.confirmed_at, mo.shipped_at, mo.completed_at
  FROM public.trade_marketplace_orders mo
  JOIN public.trade_marketplace_actors a ON a.id = mo.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = mo.id
  WHERE mo.org_id = (
    SELECT c.org_id FROM public.trade_marketplace_carts c
    JOIN public.trade_org_members m ON m.org_id = c.org_id
    WHERE c.id = p_cart_id AND m.user_id = auth.uid()
    LIMIT 1
  )
  -- Pedidos creados en la última hora del mismo origen (heurístico de correlación)
  AND mo.created_at >= (
    SELECT c.ordered_at - interval '1 minute' FROM public.trade_marketplace_carts c WHERE c.id = p_cart_id
  )
  AND mo.created_at <= (
    SELECT c.ordered_at + interval '1 minute' FROM public.trade_marketplace_carts c WHERE c.id = p_cart_id
  )
  GROUP BY mo.id, a.nombre, a.verificado
  ORDER BY mo.created_at DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. RPC — LISTAR CARRITOS DE LA ORG (historial de compras)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_org_carts(
  p_org_id  uuid,
  p_estado  text    DEFAULT NULL,
  p_limit   integer DEFAULT 20,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  source_type text,
  source_ref  text,
  estado      text,
  items_count bigint,
  total       numeric,
  created_at  timestamptz,
  ordered_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, c.source_type, c.source_ref, c.estado,
    COUNT(ci.id) FILTER (WHERE ci.activo) AS items_count,
    COALESCE(SUM(ci.total_linea) FILTER (WHERE ci.activo), 0) AS total,
    c.created_at, c.ordered_at
  FROM public.trade_marketplace_carts c
  LEFT JOIN public.trade_marketplace_cart_items ci ON ci.cart_id = c.id
  WHERE c.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND (p_estado IS NULL OR c.estado = p_estado)
  GROUP BY c.id
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_cart_from_quote(uuid)                 FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_cart_from_job(uuid)                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_cart_from_field_action(uuid)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_cart_from_maintenance_incident(uuid)  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cart_detail(uuid)                        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.analyze_cart_with_ai(uuid)                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_cart_item(uuid,text,numeric,text,text,text,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.select_offering_for_cart_item(uuid,uuid)     FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_select_providers(uuid,text)             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_cart_item(uuid,numeric,text,text,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cart_provider_summary(uuid)              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkout_cart(uuid)                          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cart_order_status(uuid)                  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_org_carts(uuid,text,integer,integer)    FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_resolve_provider_alternatives(uuid,uuid,numeric) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_cart_from_quote(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_cart_from_job(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_cart_from_field_action(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_cart_from_maintenance_incident(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cart_detail(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_cart_with_ai(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid,text,numeric,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_offering_for_cart_item(uuid,uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_select_providers(uuid,text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_cart_item(uuid,numeric,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cart_provider_summary(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_cart(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cart_order_status(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_org_carts(uuid,text,integer,integer)    TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN MIGRACIÓN Sprint 1C
-- ─────────────────────────────────────────────────────────────────────────────
