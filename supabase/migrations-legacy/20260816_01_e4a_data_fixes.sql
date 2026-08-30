-- E4.A Data Fix: Corregir campaign_source de TW-FB-LT y TW-FB-PC1
-- Estas campañas son fallback institucionales clasificadas incorrectamente como 'supplier'.
-- La fuente canónica para detectar fallbacks es slots.fallback_campaign_id, NO el nombre.

UPDATE public.trade_marketplace_ad_campaigns
SET campaign_source = 'trabflow', updated_at = now()
WHERE nombre IN ('TW-FB-LT', 'TW-FB-PC1')
  AND campaign_source = 'supplier';

-- Post-verificación (idempotente: comprueba el estado final)
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_ad_campaigns
  WHERE nombre IN ('TW-FB-LT','TW-FB-PC1') AND campaign_source = 'trabflow';
  IF v_count <> 2 THEN RAISE EXCEPTION 'E4A-M1: solo % de 2 campañas con source=trabflow', v_count; END IF;
END $$;
