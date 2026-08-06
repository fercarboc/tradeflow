-- Sprint Guest-1 · Migración 05
-- Objetivo: Tabla de promociones de offerings
-- C4: Sin actor_id — el actor se deriva desde offering → supplier_catalog → actor
--     Esto elimina el riesgo de incoherencia actor_id ↔ offering

BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_marketplace_offering_promos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id       uuid        NOT NULL
                                REFERENCES public.trade_marketplace_supplier_offerings(id)
                                ON DELETE CASCADE,
  -- actor_id NO incluido (C4): se deriva de offering.supplier_catalog_id → actors.supplier_catalog_id
  audience          text        NOT NULL DEFAULT 'public'
                                CHECK (audience IN ('public', 'professional', 'both')),
  precio_promo_neto numeric(12,4) NOT NULL,
  descuento_pct     numeric(5,2),           -- informativo; precio_promo_neto es la fuente de verdad
  etiqueta          text,                   -- "Oferta de verano", "Liquidación stock", etc.
  valid_from        timestamptz NOT NULL,
  valid_until       timestamptz NOT NULL,
  activa            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_valid_range    CHECK (valid_from < valid_until),
  CONSTRAINT promo_precio_positivo CHECK (precio_promo_neto > 0),
  CONSTRAINT promo_descuento_valid CHECK (descuento_pct IS NULL OR (descuento_pct > 0 AND descuento_pct < 100))
);

-- Índice principal: resolución de precio en tiempo real
CREATE INDEX IF NOT EXISTS idx_promos_offering_active
  ON public.trade_marketplace_offering_promos (offering_id, valid_from, valid_until)
  WHERE activa = true;

-- Índice para auditoría por audiencia
CREATE INDEX IF NOT EXISTS idx_promos_audience
  ON public.trade_marketplace_offering_promos (audience, activa, valid_until);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public._update_promo_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_promo_updated_at ON public.trade_marketplace_offering_promos;
CREATE TRIGGER trg_promo_updated_at
  BEFORE UPDATE ON public.trade_marketplace_offering_promos
  FOR EACH ROW EXECUTE FUNCTION public._update_promo_updated_at();

-- Comentarios
COMMENT ON TABLE public.trade_marketplace_offering_promos
  IS 'Promociones temporales de precio para offerings. El actor se deduce vía offering → catalog → actor. No almacena actor_id para evitar incoherencias.';
COMMENT ON COLUMN public.trade_marketplace_offering_promos.descuento_pct
  IS 'Informativo (calculado al crear la promo). El precio definitivo es siempre precio_promo_neto.';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS public.trade_marketplace_offering_promos CASCADE;
-- DROP FUNCTION IF EXISTS public._update_promo_updated_at();
-- COMMIT;
