
BEGIN;

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS precio_unitario_lista_snapshot   numeric(12,4),
  ADD COLUMN IF NOT EXISTS precio_unitario_neto_snapshot    numeric(12,4),
  ADD COLUMN IF NOT EXISTS descuento_tipo_snapshot          text
    CHECK (descuento_tipo_snapshot IN ('supplier', 'platform', 'promotion', 'none')),
  ADD COLUMN IF NOT EXISTS descuento_importe_snapshot       numeric(12,2) DEFAULT 0;

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS tax_rate_snapshot      numeric(5,2)  DEFAULT 21.00,
  ADD COLUMN IF NOT EXISTS item_net_snapshot      numeric(12,2),
  ADD COLUMN IF NOT EXISTS item_tax_snapshot      numeric(12,2),
  ADD COLUMN IF NOT EXISTS item_gross_snapshot    numeric(12,2);

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS commissionable_unit_price_net_snapshot numeric(12,4);

ALTER TABLE public.trade_marketplace_order_items
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'EUR';

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
  v_item  public.trade_marketplace_order_items;
  v_net   numeric(12,2);
  v_tax   numeric(12,2);
  v_gross numeric(12,2);
BEGIN
  SELECT * INTO v_item
    FROM public.trade_marketplace_order_items
   WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % no encontrado', p_item_id;
  END IF;

  v_net   := ROUND(p_precio_neto::numeric(12,2) * v_item.cantidad::numeric, 2);
  v_tax   := ROUND(v_net * (p_tax_rate / 100), 2);
  v_gross := v_net + v_tax;

  UPDATE public.trade_marketplace_order_items SET
    precio_unitario_lista_snapshot         = p_precio_lista_net,
    precio_unitario_neto_snapshot          = p_precio_neto,
    descuento_tipo_snapshot                = p_descuento_tipo,
    descuento_importe_snapshot             = p_descuento_importe,
    tax_rate_snapshot                      = p_tax_rate,
    item_net_snapshot                      = v_net,
    item_tax_snapshot                      = v_tax,
    item_gross_snapshot                    = v_gross,
    commissionable_unit_price_net_snapshot = COALESCE(p_commissionable_unit_price, p_precio_neto),
    currency                               = 'EUR'
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_write_item_snapshot TO authenticated;

COMMIT;
;
