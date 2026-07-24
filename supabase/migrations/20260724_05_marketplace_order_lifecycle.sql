-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 1D — Ciclo de vida completo del pedido
-- Fecha: 2026-07-24
-- Requiere: Sprint 1B (orders, portal) + Sprint 1C (carts, checkout)
-- Flujo: pending → confirmed → preparing → shipped → delivered → completed
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. AMPLIAR trade_marketplace_orders
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS cart_id          uuid
    REFERENCES public.trade_marketplace_carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_ref     text,
  ADD COLUMN IF NOT EXISTS tracking_url     text,
  ADD COLUMN IF NOT EXISTS notas_proveedor  text,
  -- cancelled_reason: columna canónica ya existe en Sprint 1B. NO duplicar.
  ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz,
  -- delivered_at / entregado_at: columna canónica ya existe en Sprint 1B como delivered_at. NO duplicar.
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS preparing_at     timestamptz;

-- Retrocompatibilidad: vincular órdenes existentes a su carrito por correlación temporal
UPDATE public.trade_marketplace_orders mo SET cart_id = c.id
FROM public.trade_marketplace_carts c
WHERE c.source_type = 'quote'
  AND mo.quote_id = c.source_id
  AND mo.cart_id IS NULL
  AND mo.created_at BETWEEN c.created_at - interval '5 seconds'
                        AND c.created_at + interval '60 seconds';

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. AMPLIAR trade_marketplace_outbox (org_id para eventos de sistema)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_outbox
  ADD COLUMN IF NOT EXISTS org_id uuid
    REFERENCES public.trade_organizations(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. REGISTRO INMUTABLE DE EVENTOS DE PEDIDO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_order_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid        NOT NULL
    REFERENCES public.trade_marketplace_orders(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  from_estado   text,
  to_estado     text,
  actor_type    text        NOT NULL DEFAULT 'system'
    CONSTRAINT chk_actor_type CHECK (actor_type IN ('installer','supplier','system')),
  actor_user_id uuid,
  notas         text,
  payload       jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_order_events IS
  'Audit log inmutable de todos los cambios de estado de pedidos Marketplace.';

CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.trade_marketplace_order_events(order_id, created_at);

-- Sin UPDATE ni DELETE — immutable
ALTER TABLE public.trade_marketplace_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_events_installer_read" ON public.trade_marketplace_order_events;
DROP POLICY IF EXISTS "order_events_supplier_read"  ON public.trade_marketplace_order_events;

CREATE POLICY "order_events_installer_read" ON public.trade_marketplace_order_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_orders o
      JOIN public.trade_org_members m ON m.org_id = o.org_id
      WHERE o.id = order_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "order_events_supplier_read" ON public.trade_marketplace_order_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_orders o
      JOIN public.trade_marketplace_actor_members am ON am.actor_id = o.actor_id
      WHERE o.id = order_id AND am.user_id = auth.uid() AND am.activo = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. RESERVAS DE STOCK (simple — sin gestión de capacidad compleja)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_stock_reservations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid        NOT NULL
    REFERENCES public.trade_marketplace_orders(id) ON DELETE CASCADE,
  offering_id    uuid        NOT NULL
    REFERENCES public.trade_marketplace_supplier_offerings(id) ON DELETE RESTRICT,
  order_item_id  uuid
    REFERENCES public.trade_marketplace_order_items(id) ON DELETE SET NULL,
  cantidad       numeric(12,4) NOT NULL CHECK (cantidad > 0),
  estado         text        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_stock_res_estado CHECK (estado IN ('active','released','consumed')),
  reservado_at   timestamptz NOT NULL DEFAULT now(),
  liberado_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_stock_reservations IS
  'Reservas de stock al confirmar un pedido. Liberadas al cancelar o consumidas al entregar.';

CREATE INDEX IF NOT EXISTS idx_stock_res_offering ON public.trade_marketplace_stock_reservations(offering_id, estado);
CREATE INDEX IF NOT EXISTS idx_stock_res_order    ON public.trade_marketplace_stock_reservations(order_id, estado);

ALTER TABLE public.trade_marketplace_stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_res_supplier_manage" ON public.trade_marketplace_stock_reservations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_orders o
      JOIN public.trade_marketplace_actor_members am ON am.actor_id = o.actor_id
      WHERE o.id = order_id AND am.user_id = auth.uid() AND am.activo = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. TRIGGER: LOG AUTOMÁTICO DE CAMBIOS DE ESTADO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_log_order_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.trade_marketplace_order_events (
      order_id, tipo, from_estado, to_estado, actor_type, actor_user_id, payload
    ) VALUES (
      NEW.id,
      'state_changed',
      OLD.estado,
      NEW.estado,
      CASE
        WHEN auth.uid() IS NOT NULL THEN 'supplier'  -- default; RPCs override via payload
        ELSE 'system'
      END,
      auth.uid(),
      jsonb_build_object('changed_at', now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_order_state_change_log'
      AND tgrelid = 'public.trade_marketplace_orders'::regclass
  ) THEN
    CREATE TRIGGER trg_order_state_change_log
      AFTER UPDATE OF estado ON public.trade_marketplace_orders
      FOR EACH ROW EXECUTE FUNCTION public.trg_log_order_state_change();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. HELPER: VERIFICAR MEMBRESÍA ACTIVA DE PROVEEDOR
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mkt_supplier_member_check(p_actor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE actor_id = p_actor_id AND user_id = auth.uid() AND activo = true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. HELPER: DESBLOQUEAR TRABAJO AL COMPLETAR ENTREGAS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mkt_unblock_job_if_complete(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote_id  uuid;
  v_job_id    uuid;
  v_org_id    uuid;
  v_all_done  boolean;
BEGIN
  -- Obtener quote_id del pedido
  SELECT quote_id, org_id INTO v_quote_id, v_org_id
  FROM public.trade_marketplace_orders WHERE id = p_order_id;

  IF v_quote_id IS NULL THEN
    -- Intentar por cart_id → cart.source_id si source_type = 'job'
    SELECT c.source_id INTO v_job_id
    FROM public.trade_marketplace_orders o
    JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
    WHERE o.id = p_order_id AND c.source_type = 'job';

    IF v_job_id IS NOT NULL THEN
      -- Desbloquear trabajo directamente si todos los pedidos del cart están entregados
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.trade_marketplace_orders o2
        JOIN public.trade_marketplace_carts c2 ON c2.id = o2.cart_id
        WHERE c2.source_id = v_job_id
          AND c2.source_type = 'job'
          AND o2.estado NOT IN ('delivered','completed','cancelled')
      ) INTO v_all_done;

      IF v_all_done THEN
        UPDATE public.trade_jobs SET
          estado = 'en_curso', pause_reason = NULL, updated_at = now()
        WHERE id = v_job_id AND estado = 'bloqueado_espera_material';

        IF FOUND THEN
          SELECT org_id INTO v_org_id FROM public.trade_jobs WHERE id = v_job_id;
          INSERT INTO public.trade_field_actions (org_id, job_id, tipo, descripcion, estado)
          VALUES (v_org_id, v_job_id, 'sistema',
            'Material del Marketplace recibido. Trabajo desbloqueado automáticamente.', 'completado');
        END IF;
      END IF;
    END IF;
    RETURN;
  END IF;

  -- Hay quote_id: buscar trabajo bloqueado por falta de material
  SELECT j.id INTO v_job_id
  FROM public.trade_jobs j
  WHERE j.quote_id = v_quote_id
    AND j.estado = 'bloqueado_espera_material'
    AND j.pause_reason = 'falta_material'
  LIMIT 1;

  IF v_job_id IS NULL THEN RETURN; END IF;

  -- Verificar que TODOS los pedidos de marketplace para esta quote están entregados
  SELECT NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_orders
    WHERE quote_id = v_quote_id
      AND estado NOT IN ('delivered','completed','cancelled')
  ) INTO v_all_done;

  IF NOT v_all_done THEN RETURN; END IF;

  -- Desbloquear
  UPDATE public.trade_jobs SET
    estado = 'en_curso', pause_reason = NULL, updated_at = now()
  WHERE id = v_job_id;

  -- Acción de sistema informativa
  INSERT INTO public.trade_field_actions (org_id, job_id, tipo, descripcion, estado)
  VALUES (v_org_id, v_job_id, 'sistema',
    'Todo el material pedido en Marketplace ha sido entregado. Trabajo desbloqueado.', 'completado');

  -- Outbox para notificar a la org
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (
    NULL, v_org_id, 'job.unblocked',
    jsonb_build_object('job_id', v_job_id, 'quote_id', v_quote_id, 'trigger_order_id', p_order_id)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. RPC — PREPARAR PEDIDO (supplier: confirmed → preparing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prepare_marketplace_order(
  p_order_id uuid,
  p_notas    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  WHERE o.id = p_order_id AND o.estado = 'confirmed';

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido no encontrado o no está confirmado.';
  END IF;

  IF NOT public._mkt_supplier_member_check(v_order.actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
  END IF;

  UPDATE public.trade_marketplace_orders SET
    estado = 'preparing', preparing_at = now(), notas_proveedor = COALESCE(p_notas, notas_proveedor),
    updated_at = now()
  WHERE id = p_order_id;

  -- Reservar stock
  INSERT INTO public.trade_marketplace_stock_reservations (order_id, offering_id, order_item_id, cantidad)
  SELECT p_order_id, oi.offering_id, oi.id, oi.cantidad
  FROM public.trade_marketplace_order_items oi
  WHERE oi.order_id = p_order_id AND oi.offering_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Outbox: notificar al instalador
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (v_order.actor_id, v_order.org_id, 'order.preparing',
    jsonb_build_object('order_id', p_order_id, 'actor_id', v_order.actor_id));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. EXTENDER confirm_supplier_order — añadir reserva de stock y evento
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_supplier_order(
  p_order_id uuid,
  p_source   text DEFAULT 'legacy',
  p_notas    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid;
  v_catalog_id uuid;
  v_org_id     uuid;
BEGIN
  IF p_source = 'legacy' THEN
    SELECT a.id, a.supplier_catalog_id
    INTO v_actor_id, v_catalog_id
    FROM public.trade_supplier_orders so
    JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = so.catalog_id
    JOIN public.trade_marketplace_actor_members am ON am.actor_id = a.id
    WHERE so.id = p_order_id AND am.user_id = auth.uid() AND am.activo = true
    LIMIT 1;

    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
    END IF;

    UPDATE public.trade_supplier_orders SET
      estado = 'confirmado', fecha_confirmacion = now()
    WHERE id = p_order_id;

    INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload)
    VALUES (v_actor_id, 'order.confirmed',
      jsonb_build_object('order_id', p_order_id, 'source', 'legacy', 'confirmed_by', auth.uid()));

  ELSE
    SELECT o.actor_id, o.org_id INTO v_actor_id, v_org_id
    FROM public.trade_marketplace_orders o
    WHERE o.id = p_order_id AND o.estado = 'pending';

    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido marketplace no encontrado o no está pendiente.';
    END IF;

    IF NOT public._mkt_supplier_member_check(v_actor_id) THEN
      RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
    END IF;

    UPDATE public.trade_marketplace_orders SET
      estado = 'confirmed', confirmed_at = now(),
      notas_proveedor = COALESCE(p_notas, notas_proveedor),
      updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
    VALUES (v_actor_id, v_org_id, 'order.confirmed',
      jsonb_build_object('order_id', p_order_id, 'source', 'marketplace', 'confirmed_by', auth.uid()));
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. EXTENDER ship_supplier_order — añadir tracking completo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ship_supplier_order(
  p_order_id    uuid,
  p_source      text DEFAULT 'legacy',
  p_tracking    text DEFAULT NULL,
  p_tracking_url text DEFAULT NULL,
  p_notas       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_org_id   uuid;
BEGIN
  IF p_source = 'legacy' THEN
    SELECT a.id INTO v_actor_id
    FROM public.trade_supplier_orders so
    JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = so.catalog_id
    JOIN public.trade_marketplace_actor_members am ON am.actor_id = a.id
    WHERE so.id = p_order_id AND am.user_id = auth.uid() AND am.activo = true
    LIMIT 1;

    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
    END IF;

    UPDATE public.trade_supplier_orders SET estado = 'enviado'
    WHERE id = p_order_id;

    INSERT INTO public.trade_marketplace_outbox (actor_id, event_type, payload)
    VALUES (v_actor_id, 'order.shipped',
      jsonb_build_object('order_id', p_order_id, 'source', 'legacy', 'tracking', p_tracking));

  ELSE
    SELECT o.actor_id, o.org_id INTO v_actor_id, v_org_id
    FROM public.trade_marketplace_orders o
    WHERE o.id = p_order_id AND o.estado IN ('confirmed','preparing');

    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido no encontrado o en estado incorrecto.';
    END IF;

    IF NOT public._mkt_supplier_member_check(v_actor_id) THEN
      RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
    END IF;

    UPDATE public.trade_marketplace_orders SET
      estado = 'shipped', shipped_at = now(),
      tracking_ref = COALESCE(p_tracking, tracking_ref),
      tracking_url = COALESCE(p_tracking_url, tracking_url),
      notas_proveedor = COALESCE(p_notas, notas_proveedor),
      updated_at = now()
    WHERE id = p_order_id;

    -- Marcar reservas de stock como 'consumed' al enviar
    UPDATE public.trade_marketplace_stock_reservations
    SET estado = 'consumed', liberado_at = now()
    WHERE order_id = p_order_id AND estado = 'active';

    INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
    VALUES (v_actor_id, v_org_id, 'order.shipped',
      jsonb_build_object(
        'order_id',     p_order_id,
        'source',       'marketplace',
        'tracking_ref', p_tracking,
        'tracking_url', p_tracking_url
      ));
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC — CONFIRMAR ENTREGA (installer: shipped → delivered → completed)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deliver_marketplace_order(
  p_order_id uuid,
  p_notas    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  JOIN public.trade_org_members m ON m.org_id = o.org_id
  WHERE o.id = p_order_id AND m.user_id = auth.uid()
    AND o.estado = 'shipped'
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido no encontrado o aún no ha sido enviado.';
  END IF;

  UPDATE public.trade_marketplace_orders SET
    estado = 'delivered', delivered_at = now(), completed_at = now(),
    updated_at = now()
  WHERE id = p_order_id;

  -- Evento manual (el trigger crea uno automático, éste añade actor_type=installer)
  INSERT INTO public.trade_marketplace_order_events (
    order_id, tipo, from_estado, to_estado, actor_type, actor_user_id, notas, payload
  ) VALUES (
    p_order_id, 'delivery_confirmed', 'shipped', 'delivered', 'installer', auth.uid(),
    p_notas, jsonb_build_object('confirmed_by_installer', auth.uid())
  );

  -- Liberar cualquier reserva de stock restante
  UPDATE public.trade_marketplace_stock_reservations
  SET estado = 'consumed', liberado_at = now()
  WHERE order_id = p_order_id AND estado = 'active';

  -- Outbox
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (v_order.actor_id, v_order.org_id, 'order.delivered',
    jsonb_build_object('order_id', p_order_id, 'delivered_by', auth.uid()));

  -- Auto-desbloquear trabajo si corresponde
  PERFORM public._mkt_unblock_job_if_complete(p_order_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RPC — CANCELAR PEDIDO (supplier o installer)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_marketplace_order(
  p_order_id uuid,
  p_reason   text DEFAULT 'Cancelado por el usuario'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order    RECORD;
  v_who      text;
BEGIN
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  WHERE o.id = p_order_id
    AND o.estado NOT IN ('delivered','completed','cancelled');

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Pedido no encontrado o no puede cancelarse.';
  END IF;

  -- Verificar acceso: proveedor O instalador de la org
  IF public._mkt_supplier_member_check(v_order.actor_id) THEN
    v_who := 'supplier';
  ELSIF EXISTS (
    SELECT 1 FROM public.trade_org_members m
    WHERE m.org_id = v_order.org_id AND m.user_id = auth.uid()
  ) THEN
    v_who := 'installer';
  ELSE
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este pedido.';
  END IF;

  UPDATE public.trade_marketplace_orders SET
    estado = 'cancelled', cancel_reason = p_reason,
    cancelled_at = now(), updated_at = now()
  WHERE id = p_order_id;

  -- Liberar reservas de stock
  UPDATE public.trade_marketplace_stock_reservations
  SET estado = 'released', liberado_at = now()
  WHERE order_id = p_order_id AND estado = 'active';

  -- Evento
  INSERT INTO public.trade_marketplace_order_events (
    order_id, tipo, from_estado, to_estado, actor_type, actor_user_id, notas, payload
  ) VALUES (
    p_order_id, 'cancelled', v_order.estado, 'cancelled', v_who, auth.uid(),
    p_reason, jsonb_build_object('cancelled_by', v_who)
  );

  -- Outbox
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (v_order.actor_id, v_order.org_id, 'order.cancelled',
    jsonb_build_object('order_id', p_order_id, 'reason', p_reason, 'cancelled_by', v_who));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RPC — DETALLE COMPLETO DE PEDIDO (items + eventos + info proveedor)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_order_full_detail(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result jsonb;
BEGIN
  -- Acceso: org del pedido O actor del proveedor
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  WHERE o.id = p_order_id
    AND (
      EXISTS (
        SELECT 1 FROM public.trade_org_members m
        WHERE m.org_id = o.org_id AND m.user_id = auth.uid()
      )
      OR public._mkt_supplier_member_check(o.actor_id)
    )
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido no encontrado o sin acceso.';
  END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object(
      'id',               v_order.id,
      'numero',           v_order.numero,
      'estado',           v_order.estado,
      'actor_id',         v_order.actor_id,
      'actor_nombre',     a.nombre,
      'actor_verificado', a.verificado,
      'org_id',           v_order.org_id,
      'subtotal',         v_order.subtotal,
      'coste_envio',      v_order.coste_envio,
      'total',            v_order.total,
      'notas',            v_order.notas,
      'notas_proveedor',  v_order.notas_proveedor,
      'tracking_ref',     v_order.tracking_ref,
      'tracking_url',     v_order.tracking_url,
      'delivery_address', v_order.delivery_address,
      'cancel_reason',    v_order.cancel_reason,
      'created_at',       v_order.created_at,
      'confirmed_at',     v_order.confirmed_at,
      'preparing_at',     v_order.preparing_at,
      'shipped_at',       v_order.shipped_at,
      'delivered_at',     v_order.delivered_at,
      'cancelled_at',     v_order.cancelled_at,
      'completed_at',     v_order.completed_at
    ),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',              oi.id,
          'referencia',      oi.referencia,
          'descripcion',     oi.descripcion,
          'unidad',          oi.unidad,
          'cantidad',        oi.cantidad,
          'precio_unitario', oi.precio_unitario,
          'precio_total',    oi.precio_total
        ) ORDER BY oi.created_at
      )
      FROM public.trade_marketplace_order_items oi
      WHERE oi.order_id = p_order_id
    ), '[]'),
    'events', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           ev.id,
          'tipo',         ev.tipo,
          'from_estado',  ev.from_estado,
          'to_estado',    ev.to_estado,
          'actor_type',   ev.actor_type,
          'notas',        ev.notas,
          'created_at',   ev.created_at
        ) ORDER BY ev.created_at DESC
      )
      FROM public.trade_marketplace_order_events ev
      WHERE ev.order_id = p_order_id
    ), '[]'),
    'supplier_config', (
      SELECT jsonb_build_object(
        'horario_entrega',  cfg.horario_entrega,
        'mensaje_instaladores', cfg.mensaje_instaladores,
        'permite_recogida', cfg.permite_recogida
      )
      FROM public.trade_marketplace_supplier_config cfg
      WHERE cfg.actor_id = v_order.actor_id
    )
  ) INTO v_result
  FROM public.trade_marketplace_actors a
  WHERE a.id = v_order.actor_id;

  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RPC — PEDIDOS ACTIVOS DE LA ORG (vista instalador)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_active_orders(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  numero          text,
  estado          text,
  actor_id        uuid,
  actor_nombre    text,
  actor_verificado boolean,
  total           numeric,
  items_count     bigint,
  tracking_ref    text,
  tracking_url    text,
  notas_proveedor text,
  source_ref      text,
  created_at      timestamptz,
  confirmed_at    timestamptz,
  preparing_at    timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz,
  total_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id, o.numero, o.estado,
    o.actor_id, a.nombre, a.verificado,
    o.total,
    COUNT(oi.id) AS items_count,
    o.tracking_ref, o.tracking_url, o.notas_proveedor,
    c.source_ref,
    o.created_at, o.confirmed_at, o.preparing_at,
    o.shipped_at, o.delivered_at, o.cancelled_at,
    COUNT(*) OVER () AS total_count
  FROM public.trade_marketplace_orders o
  JOIN public.trade_marketplace_actors a ON a.id = o.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
  WHERE o.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND o.estado NOT IN ('completed','cancelled')
  GROUP BY o.id, a.nombre, a.verificado, c.source_ref
  ORDER BY
    CASE o.estado
      WHEN 'pending'   THEN 1
      WHEN 'confirmed' THEN 2
      WHEN 'preparing' THEN 3
      WHEN 'shipped'   THEN 4
      WHEN 'delivered' THEN 5
      ELSE 6
    END,
    o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. RPC — HISTORIAL DE PEDIDOS DE LA ORG (completados/cancelados)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_order_history(
  p_org_id  uuid,
  p_limit   integer DEFAULT 20,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id           uuid,
  numero       text,
  estado       text,
  actor_nombre text,
  total        numeric,
  items_count  bigint,
  source_ref   text,
  created_at   timestamptz,
  completed_at timestamptz,
  total_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id, o.numero, o.estado, a.nombre,
    o.total, COUNT(oi.id), c.source_ref,
    o.created_at, o.completed_at,
    COUNT(*) OVER () AS total_count
  FROM public.trade_marketplace_orders o
  JOIN public.trade_marketplace_actors a ON a.id = o.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
  WHERE o.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND o.estado IN ('completed','cancelled','delivered')
  GROUP BY o.id, a.nombre, c.source_ref
  ORDER BY o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. RPC — EVENTOS DE UN PEDIDO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_order_events(p_order_id uuid)
RETURNS TABLE (
  id           uuid,
  tipo         text,
  from_estado  text,
  to_estado    text,
  actor_type   text,
  notas        text,
  payload      jsonb,
  created_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT ev.id, ev.tipo, ev.from_estado, ev.to_estado,
         ev.actor_type, ev.notas, ev.payload, ev.created_at
  FROM public.trade_marketplace_order_events ev
  JOIN public.trade_marketplace_orders o ON o.id = ev.order_id
  WHERE ev.order_id = p_order_id
    AND (
      EXISTS (
        SELECT 1 FROM public.trade_org_members m
        WHERE m.org_id = o.org_id AND m.user_id = auth.uid()
      )
      OR public._mkt_supplier_member_check(o.actor_id)
    )
  ORDER BY ev.created_at DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.prepare_marketplace_order(uuid,text)                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.deliver_marketplace_order(uuid,text)                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_marketplace_order(uuid,text)                    FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_order_full_detail(uuid)                            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_org_active_orders(uuid,integer,integer)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_org_order_history(uuid,integer,integer)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_order_events(uuid)                                 FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_unblock_job_if_complete(uuid)                     FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_supplier_member_check(uuid)                       FROM anon, public;

GRANT EXECUTE ON FUNCTION public.prepare_marketplace_order(uuid,text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_marketplace_order(uuid,text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_marketplace_order(uuid,text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_full_detail(uuid)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_active_orders(uuid,integer,integer)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_order_history(uuid,integer,integer)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_events(uuid)                                  TO authenticated;

-- Re-grant para las RPCs extendidas de Sprint 1B (firma ampliada)
REVOKE EXECUTE ON FUNCTION public.confirm_supplier_order(uuid,text,text)                 FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ship_supplier_order(uuid,text,text,text,text)          FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_order(uuid,text,text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ship_supplier_order(uuid,text,text,text,text)           TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN MIGRACIÓN Sprint 1D
-- ─────────────────────────────────────────────────────────────────────────────
