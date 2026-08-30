-- E4.A Hotfix: TW-FB-PC1 tenía start_at/end_at de testing E2/E3
-- que excluían MARKET_HOME_PROMO_CARD_1 de la RPC (15/16 en lugar de 16/16).
-- Las campañas fallback institucionales no deben tener ventana temporal.

UPDATE public.trade_marketplace_ad_campaigns
SET start_at = NULL, end_at = NULL, updated_at = now()
WHERE nombre = 'TW-FB-PC1'
  AND campaign_source = 'trabflow'
  AND (start_at IS NOT NULL OR end_at IS NOT NULL);

-- Post-verificación
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_ad_campaigns c
  WHERE c.id IN (SELECT fallback_campaign_id FROM public.trade_marketplace_ad_slots)
    AND campaign_source = 'trabflow'
    AND (
      (start_at IS NOT NULL AND start_at > now()) OR
      (end_at   IS NOT NULL AND end_at   <= now())
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'E4A-M3: % fallback(s) trabflow con ventana temporal que los excluye hoy', v_count;
  END IF;
END $$;
