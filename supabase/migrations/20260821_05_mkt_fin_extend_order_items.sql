-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 05
-- Extensión de trade_marketplace_order_items con snapshots por línea
-- ════════════════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBLE: columnas existentes intactas.
-- INV-007: snapshots inmutables tras checkout.
-- INV-016: net/tax/gross diferenciados por ítem.
-- TAX_GATE: tipos de IVA definitivos por categoría pendientes de dictamen.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Snapshots de precio por línea ──────────────────────────────────────
-- Las columnas existentes (precio_unitario, precio_total) se conservan.
-- Los nuevos _snapshot son el registro canónico con desglose fiscal.

-- Precio de lista y precio efectivo (antes de IVA)
ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS precio_unitario_lista_snapshot   numeric(12,4),
  ADD COLUMN IF NOT EXISTS precio_unitario_neto_snapshot    numeric(12,4),
  ADD COLUMN IF NOT EXISTS descuento_tipo_snapshot          text
    CHECK (descuento_tipo_snapshot IN ('supplier', 'platform', 'promotion', 'none')),
  ADD COLUMN IF NOT EXISTS descuento_importe_snapshot       numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.trade_marketplace_order_items.precio_unitario_lista_snapshot IS
  'Precio de lista sin descuento, ex-IVA. INV-007: inmutable.';

COMMENT ON COLUMN public.trade_marketplace_order_items.precio_unitario_neto_snapshot IS
  'Precio efectivo tras descuento, ex-IVA. Base para comisión. INV-007: inmutable.';

-- ── 2. Desglose fiscal por ítem (INV-016) ────────────────────────────────

-- [TAX_GATE] El tipo de IVA definitivo por categoría requiere dictamen fiscal.
-- Por defecto usamos 21% para simulación.
ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS tax_rate_snapshot      numeric(5,2) DEFAULT 21.00,
  ADD COLUMN IF NOT EXISTS item_net_snapshot      numeric(12,2),
  ADD COLUMN IF NOT EXISTS item_tax_snapshot      numeric(12,2),
  ADD COLUMN IF NOT EXISTS item_gross_snapshot    numeric(12,2);

COMMENT ON COLUMN public.trade_marketplace_order_items.tax_rate_snapshot IS
  '[TAX_GATE] Tipo IVA aplicado a este ítem. '
  '21% por defecto en simulación. '
  'Puede variar por categoría de producto (T2 pendiente de dictamen fiscal).';

COMMENT ON COLUMN public.trade_marketplace_order_items.item_net_snapshot IS
  'precio_unitario_neto_snapshot × cantidad, ex-IVA. INV-007: inmutable.';

COMMENT ON COLUMN public.trade_marketplace_order_items.item_gross_snapshot IS
  'item_net_snapshot + item_tax_snapshot (con IVA). INV-007: inmutable.';

-- ── 3. Base comisionable por ítem ─────────────────────────────────────────

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS commissionable_unit_price_net_snapshot numeric(12,4);

COMMENT ON COLUMN public.trade_marketplace_order_items.commissionable_unit_price_net_snapshot IS
  'Precio unitario sobre el que se calcula la comisión. '
  'Normalmente = precio_unitario_neto_snapshot. '
  'Puede diferir si hay exclusiones específicas.';

-- ── 4. Moneda (INV-015) ───────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'EUR';

-- ── 5. Función: escribir snapshot por ítem ────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_write_item_snapshot(
  p_item_id                    uuid,
  p_precio_lista_net           numeric(12,4),
  p_precio_neto                numeric(12,4),
  p_descuento_tipo             text     DEFAULT 'none',
  p_descuento_importe          numeric  DEFAULT 0,
  p_tax_rate                   numeric  DEFAULT 21.00,
  p_commissionable_unit_price  numeric  DEFAULT NULL
)
RETURNS public.trade_marketplace_order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     public.trade_marketplace_order_items;
  v_net      numeric(12,2);
  v_tax      numeric(12,2);
  v_gross    numeric(12,2);
BEGIN
  SELECT * INTO v_item
    FROM public.trade_marketplace_order_items
   WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % no encontrado', p_item_id;
  END IF;

  -- Calcular con la cantidad del ítem
  v_net   := ROUND(p_precio_neto::numeric(12,2) * v_item.cantidad::numeric, 2);
  v_tax   := ROUND(v_net * (p_tax_rate / 100), 2);
  v_gross := v_net + v_tax;

  UPDATE public.trade_marketplace_order_items SET
    precio_unitario_lista_snapshot          = p_precio_lista_net,
    precio_unitario_neto_snapshot           = p_precio_neto,
    descuento_tipo_snapshot                 = p_descuento_tipo,
    descuento_importe_snapshot              = p_descuento_importe,
    tax_rate_snapshot                       = p_tax_rate,
    item_net_snapshot                       = v_net,
    item_tax_snapshot                       = v_tax,
    item_gross_snapshot                     = v_gross,
    commissionable_unit_price_net_snapshot  = COALESCE(p_commissionable_unit_price, p_precio_neto),
    currency                                = 'EUR'
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_write_item_snapshot IS
  'Escribe el snapshot financiero de una línea de pedido. '
  'INV-007: los snapshots son inmutables (no hay protección a nivel item individual '
  'porque la protección real está en el trigger del supplier order padre).';

-- ── 6. Grants ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.mkt_fin_write_item_snapshot TO authenticated;

COMMIT;
