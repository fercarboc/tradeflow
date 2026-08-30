-- E4.A: Columnas imagen en campaigns + reactivar fallbacks pausados en testing

-- 1. Añadir columnas imagen a trade_marketplace_ad_campaigns
ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD COLUMN IF NOT EXISTS image_url        text,
  ADD COLUMN IF NOT EXISTS mobile_image_url text;

-- 2. Reactivar TW-FB-LB y TW-FB-LM (pausados durante testing E2/E3)
UPDATE public.trade_marketplace_ad_campaigns
SET estado = 'ACTIVE', activa = true, updated_at = now()
WHERE nombre IN ('TW-FB-LB', 'TW-FB-LM')
  AND campaign_source = 'trabflow';

-- 3. Post-verificación
DO $$
DECLARE
  v_cols  int;
  v_fbact int;
BEGIN
  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_name = 'trade_marketplace_ad_campaigns'
    AND column_name IN ('image_url','mobile_image_url');

  SELECT count(*) INTO v_fbact
  FROM public.trade_marketplace_ad_campaigns
  WHERE campaign_source = 'trabflow' AND activa = true AND estado = 'ACTIVE';

  IF v_cols <> 2 THEN RAISE EXCEPTION 'E4A-M2: columnas imagen no creadas (% de 2)', v_cols; END IF;
  IF v_fbact <> 16 THEN RAISE EXCEPTION 'E4A-M2: solo % de 16 fallbacks activos', v_fbact; END IF;
END $$;
