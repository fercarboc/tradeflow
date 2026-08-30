-- Sprint Guest-1 · Migración 06
-- Objetivo: Condiciones particulares actor ↔ org + tabla hija de precios específicos
-- C3: Sin condiciones_producto jsonb — los precios específicos van en tabla hija
--     UNIQUE(condition_id, offering_id) para un precio activo por offering por acuerdo

BEGIN;

-- ─── Tabla principal: acuerdo entre actor y org ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_actor_org_conditions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         uuid        NOT NULL
                               REFERENCES public.trade_marketplace_actors(id)
                               ON DELETE CASCADE,
  org_id           uuid        NOT NULL
                               REFERENCES public.trade_organizations(id)
                               ON DELETE CASCADE,
  customer_number  text,                     -- número de cliente en el sistema del proveedor
  descuento_pct    numeric(5,2),             -- descuento global sobre PVD (si no hay precio específico)
  condiciones_pago text,                     -- "30 días", "60 días", "contado", etc.
  activa           boolean     NOT NULL DEFAULT true,
  valid_from       timestamptz NOT NULL DEFAULT now(),
  valid_until      timestamptz,              -- NULL = sin expiración
  notas_internas   text,                     -- visible solo para el actor, no para la org (ver RLS)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_actor_org    UNIQUE (actor_id, org_id),
  CONSTRAINT descuento_range     CHECK (descuento_pct IS NULL OR (descuento_pct > 0 AND descuento_pct < 100)),
  CONSTRAINT valid_range_cond    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_conditions_actor_org_active
  ON public.trade_marketplace_actor_org_conditions (actor_id, org_id, activa)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_conditions_org
  ON public.trade_marketplace_actor_org_conditions (org_id)
  WHERE activa = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public._update_condition_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_condition_updated_at ON public.trade_marketplace_actor_org_conditions;
CREATE TRIGGER trg_condition_updated_at
  BEFORE UPDATE ON public.trade_marketplace_actor_org_conditions
  FOR EACH ROW EXECUTE FUNCTION public._update_condition_updated_at();

-- ─── Tabla hija: precios específicos por offering ──────────────────────────────
-- C3: En lugar de jsonb condiciones_producto

CREATE TABLE IF NOT EXISTS public.trade_marketplace_actor_org_condition_prices (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id  uuid        NOT NULL
                            REFERENCES public.trade_marketplace_actor_org_conditions(id)
                            ON DELETE CASCADE,
  offering_id   uuid        NOT NULL
                            REFERENCES public.trade_marketplace_supplier_offerings(id)
                            ON DELETE CASCADE,
  precio_neto   numeric(12,4) NOT NULL,
  valid_from    timestamptz NOT NULL DEFAULT now(),
  valid_until   timestamptz,              -- NULL = sin expiración
  activa        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_condition_offering UNIQUE (condition_id, offering_id),
  CONSTRAINT condition_price_positivo  CHECK (precio_neto > 0),
  CONSTRAINT condition_price_range     CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_condition_prices_lookup
  ON public.trade_marketplace_actor_org_condition_prices (condition_id, offering_id, activa)
  WHERE activa = true;

DROP TRIGGER IF EXISTS trg_condition_price_updated_at
  ON public.trade_marketplace_actor_org_condition_prices;
CREATE TRIGGER trg_condition_price_updated_at
  BEFORE UPDATE ON public.trade_marketplace_actor_org_condition_prices
  FOR EACH ROW EXECUTE FUNCTION public._update_condition_updated_at();

-- Comentarios
COMMENT ON TABLE public.trade_marketplace_actor_org_conditions
  IS 'Acuerdos comerciales privados entre un actor proveedor y una org instaladora.';
COMMENT ON COLUMN public.trade_marketplace_actor_org_conditions.notas_internas
  IS 'Solo visible para el actor (proveedor). La RLS excluye este campo de las lecturas de la org.';
COMMENT ON TABLE public.trade_marketplace_actor_org_condition_prices
  IS 'Precios específicos por offering dentro de un acuerdo. Un único precio activo por offering por acuerdo (UNIQUE).';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS public.trade_marketplace_actor_org_condition_prices CASCADE;
-- DROP TABLE IF EXISTS public.trade_marketplace_actor_org_conditions CASCADE;
-- DROP FUNCTION IF EXISTS public._update_condition_updated_at();
-- COMMIT;
