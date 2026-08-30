-- E4.B: Editor visual de creatividades — modos A/B/C, posición texto,
--        overlay, precio publicitario, tema visual TrabFlow.
-- Sin cambiar campañas existentes. Compatible retroactivo: DEFAULT 'IMAGE_CONTENT'.
-- PUBLICIDAD ≠ PRICING: price_display/old_price_display son campos presentacionales,
-- nunca actualizan offering.price ni afectan al comparador o checkout.

ALTER TABLE public.trade_marketplace_ad_creatives
  ADD COLUMN IF NOT EXISTS creative_mode text NOT NULL DEFAULT 'IMAGE_CONTENT'
    CONSTRAINT chk_creative_mode
      CHECK (creative_mode IN ('FULL_IMAGE', 'IMAGE_CONTENT', 'TRABFLOW_DESIGN')),

  ADD COLUMN IF NOT EXISTS text_position text NOT NULL DEFAULT 'LEFT'
    CONSTRAINT chk_creative_text_pos
      CHECK (text_position IN ('LEFT', 'CENTER', 'RIGHT')),

  ADD COLUMN IF NOT EXISTS overlay_strength integer NOT NULL DEFAULT 50
    CONSTRAINT chk_creative_overlay
      CHECK (overlay_strength IN (0, 20, 35, 50, 65)),

  ADD COLUMN IF NOT EXISTS price_display numeric(10, 2),

  ADD COLUMN IF NOT EXISTS old_price_display numeric(10, 2),

  ADD COLUMN IF NOT EXISTS discount_label text,

  ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'AZUL_PROFESIONAL'
    CONSTRAINT chk_creative_theme
      CHECK (theme_preset IN (
        'AZUL_PROFESIONAL', 'VERDE_TECNICO', 'NARANJA_OFERTA',
        'GRIS_INDUSTRIAL', 'MORADO_NOVEDAD'
      ));

-- Precio publicitario: solo presentación visual en el anuncio.
-- No relacionado con trade_marketplace_offerings.price.
COMMENT ON COLUMN public.trade_marketplace_ad_creatives.price_display IS
  'Precio visual en la creatividad. NO modifica offering.price ni comparador.';
COMMENT ON COLUMN public.trade_marketplace_ad_creatives.old_price_display IS
  'Precio anterior visual (tachado). Presentación publicitaria únicamente.';

-- Post-verificación: las 7 columnas nuevas deben existir
DO $$
DECLARE v_cols int;
BEGIN
  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trade_marketplace_ad_creatives'
    AND column_name IN (
      'creative_mode', 'text_position', 'overlay_strength',
      'price_display', 'old_price_display', 'discount_label', 'theme_preset'
    );
  IF v_cols <> 7 THEN
    RAISE EXCEPTION 'E4B-M6: solo % de 7 columnas nuevas en ad_creatives', v_cols;
  END IF;
END $$;;
