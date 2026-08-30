-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1B.1D · Migración 10
-- Función mkt_fin_get_purchase_summary_data
-- ════════════════════════════════════════════════════════════════════════════
-- OBJETIVO: exponer datos completos de una compra para generar el
--   "Resumen de compra Marketplace" (PDF / justificante, NO factura fiscal).
-- FUENTE EXCLUSIVA: snapshots inmutables almacenados al hacer checkout.
--   NUNCA se recalcula desde el catálogo actual.
-- INV-007: datos son de snapshot; no pueden cambiar aunque cambien precios.
-- INV-005: commission_net_snapshot no se devuelve al comprador.
-- LEGAL_GATE: el documento resultante no es factura fiscal.
-- TAX_GATE: tipos de IVA devueltos son los del snapshot (21% por defecto).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.mkt_fin_get_purchase_summary_data(
  p_checkout_key  text  DEFAULT NULL,
  p_order_id      uuid  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master   public.trade_marketplace_master_orders%ROWTYPE;
  v_order    public.trade_marketplace_orders%ROWTYPE;
  v_sup_rows jsonb;
  v_legacy_items jsonb;
BEGIN
  -- Validación de parámetros
  IF p_checkout_key IS NULL AND p_order_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere p_checkout_key o p_order_id';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── RUTA A: por checkout_key → master_order ────────────────────────────
  IF p_checkout_key IS NOT NULL THEN
    SELECT * INTO v_master
      FROM public.trade_marketplace_master_orders
     WHERE checkout_key = p_checkout_key
     LIMIT 1;

    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Autorización: usuario debe pertenecer a la org compradora
    IF v_master.org_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE user_id = auth.uid() AND org_id = v_master.org_id
    ) THEN
      RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

  -- ── RUTA B: por order_id → intentar obtener master ─────────────────────
  ELSE
    SELECT m.* INTO v_master
      FROM public.trade_marketplace_orders o
      JOIN public.trade_marketplace_master_orders m ON m.id = o.master_order_id
     WHERE o.id = p_order_id
     LIMIT 1;

    IF NOT FOUND THEN
      -- Pedido legacy (sin master_order_id): construir resumen simplificado
      SELECT * INTO v_order
        FROM public.trade_marketplace_orders
       WHERE id = p_order_id
       LIMIT 1;

      IF NOT FOUND THEN RETURN NULL; END IF;

      -- Autorización para pedido legacy
      IF v_order.org_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.trade_org_members
         WHERE user_id = auth.uid() AND org_id = v_order.org_id
      ) THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
      END IF;

      -- Items del pedido legacy (sin snapshots de nueva arquitectura)
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',                             i.id,
          'referencia',                     i.referencia,
          'descripcion',                    i.descripcion,
          'cantidad',                       i.cantidad,
          'unidad',                         i.unidad,
          'precio_unitario_neto_snapshot',  i.precio_unitario_neto_snapshot,
          'precio_unitario_lista_snapshot', i.precio_unitario_lista_snapshot,
          'descuento_tipo_snapshot',        i.descuento_tipo_snapshot,
          'descuento_importe_snapshot',     COALESCE(i.descuento_importe_snapshot, 0),
          'tax_rate_snapshot',              COALESCE(i.tax_rate_snapshot, 21.00),
          'item_net_snapshot',              i.item_net_snapshot,
          'item_tax_snapshot',              i.item_tax_snapshot,
          'item_gross_snapshot',            i.item_gross_snapshot,
          'precio_unitario_fallback',       i.precio_unitario,
          'has_snapshot',                   (i.item_gross_snapshot IS NOT NULL),
          'currency',                       COALESCE(i.currency, 'EUR')
        ) ORDER BY i.id
      ), '[]'::jsonb)
      INTO v_legacy_items
      FROM public.trade_marketplace_order_items i
      WHERE i.order_id = v_order.id;

      RETURN jsonb_build_object(
        'is_legacy', true,
        'master_order', NULL,
        'supplier_orders', jsonb_build_array(
          jsonb_build_object(
            'supplier_order_id',     v_order.id,
            'numero',                v_order.numero,
            'actor_id',              v_order.actor_id,
            'actor_nombre',          (SELECT a.nombre FROM public.trade_marketplace_actors a WHERE a.id = v_order.actor_id),
            'goods_net_snapshot',    v_order.goods_net_snapshot,
            'goods_tax_snapshot',    v_order.goods_tax_snapshot,
            'goods_gross_snapshot',  v_order.goods_gross_snapshot,
            'shipping_net_snapshot', v_order.shipping_net_snapshot,
            'shipping_tax_snapshot', v_order.shipping_tax_snapshot,
            'shipping_gross_snapshot', v_order.shipping_gross_snapshot,
            'financial_snapshot_at', v_order.financial_snapshot_at,
            'payment_status',        v_order.payment_status,
            'currency',              COALESCE(v_order.currency, 'EUR'),
            'delivery_method',       v_order.delivery_method,
            'payment_method',        v_order.payment_method,
            'has_snapshot',          (v_order.financial_snapshot_at IS NOT NULL),
            'items',                 v_legacy_items,
            'invoice_placeholder',   jsonb_build_object(
              'status', 'pending', 'invoice_ref', NULL,
              'invoice_date', NULL, 'download_url', NULL
            )
          )
        )
      );
    END IF;

    -- Autorización para pedido con master_order
    IF v_master.org_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE user_id = auth.uid() AND org_id = v_master.org_id
    ) THEN
      RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;
  END IF;

  -- ── CONSTRUIR supplier_orders completos con items y snapshots ──────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'supplier_order_id',      o.id,
      'numero',                 o.numero,
      'actor_id',               o.actor_id,
      'actor_nombre',           a.nombre,
      'goods_net_snapshot',     o.goods_net_snapshot,
      'goods_tax_snapshot',     o.goods_tax_snapshot,
      'goods_gross_snapshot',   o.goods_gross_snapshot,
      'shipping_net_snapshot',  o.shipping_net_snapshot,
      'shipping_tax_snapshot',  o.shipping_tax_snapshot,
      'shipping_gross_snapshot', o.shipping_gross_snapshot,
      'financial_snapshot_at',  o.financial_snapshot_at,
      'payment_status',         o.payment_status,
      'currency',               COALESCE(o.currency, 'EUR'),
      'delivery_method',        o.delivery_method,
      'payment_method',         o.payment_method,
      'has_snapshot',           (o.financial_snapshot_at IS NOT NULL),
      'items', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id',                             i.id,
            'referencia',                     i.referencia,
            'descripcion',                    i.descripcion,
            'cantidad',                       i.cantidad,
            'unidad',                         i.unidad,
            'precio_unitario_lista_snapshot', i.precio_unitario_lista_snapshot,
            'precio_unitario_neto_snapshot',  i.precio_unitario_neto_snapshot,
            'descuento_tipo_snapshot',        i.descuento_tipo_snapshot,
            'descuento_importe_snapshot',     COALESCE(i.descuento_importe_snapshot, 0),
            'tax_rate_snapshot',              COALESCE(i.tax_rate_snapshot, 21.00),
            'item_net_snapshot',              i.item_net_snapshot,
            'item_tax_snapshot',              i.item_tax_snapshot,
            'item_gross_snapshot',            i.item_gross_snapshot,
            'precio_unitario_fallback',       i.precio_unitario,
            'has_snapshot',                   (i.item_gross_snapshot IS NOT NULL),
            'currency',                       COALESCE(i.currency, 'EUR')
          ) ORDER BY i.id
        ), '[]'::jsonb)
        FROM public.trade_marketplace_order_items i
        WHERE i.order_id = o.id
      ),
      'invoice_placeholder', jsonb_build_object(
        'status', 'pending', 'invoice_ref', NULL,
        'invoice_date', NULL, 'download_url', NULL
      )
    ) ORDER BY o.created_at
  ), '[]'::jsonb)
  INTO v_sup_rows
  FROM public.trade_marketplace_orders o
  JOIN public.trade_marketplace_actors a ON a.id = o.actor_id
  WHERE o.master_order_id = v_master.id;

  -- ── CONSTRUIR resultado final ──────────────────────────────────────────
  RETURN jsonb_build_object(
    'is_legacy', false,
    'master_order', jsonb_build_object(
      'id',                    v_master.id,
      'numero',                v_master.numero,
      'checkout_key',          v_master.checkout_key,
      'org_id',                v_master.org_id,
      'buyer_snapshot',        COALESCE(v_master.buyer_snapshot, '{}'::jsonb),
      'order_status',          v_master.order_status,
      'payment_status',        v_master.payment_status,
      'goods_net_total',       v_master.goods_net_total,
      'goods_tax_total',       v_master.goods_tax_total,
      'goods_gross_total',     v_master.goods_gross_total,
      'shipping_net_total',    v_master.shipping_net_total,
      'shipping_tax_total',    v_master.shipping_tax_total,
      'shipping_gross_total',  v_master.shipping_gross_total,
      'checkout_gross_total',  v_master.checkout_gross_total,
      'currency',              COALESCE(v_master.currency, 'EUR'),
      'external_provider',     COALESCE(v_master.external_provider, 'simulation'),
      'created_at',            v_master.created_at
    ),
    'supplier_orders', v_sup_rows
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_get_purchase_summary_data IS
  'MP-FIN-1B.1D: datos del resumen de compra marketplace desde snapshots inmutables. '
  'NUNCA recalcula precios desde el catálogo actual. '
  'INV-007: inmutabilidad garantizada. '
  'INV-005: comisión no expuesta al comprador. '
  'LEGAL_GATE: el documento resultante NO es factura fiscal. '
  'Acepta p_checkout_key (para compra reciente) o p_order_id (para historial).';

GRANT EXECUTE ON FUNCTION public.mkt_fin_get_purchase_summary_data TO authenticated;

COMMIT;
