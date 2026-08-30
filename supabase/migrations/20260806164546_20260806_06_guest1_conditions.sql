-- Sprint Guest-1 · Migración 06 — Condiciones particulares + tabla hija precios (C3)

CREATE TABLE IF NOT EXISTS public.trade_marketplace_actor_org_conditions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         uuid        NOT NULL
                               REFERENCES public.trade_marketplace_actors(id)
                               ON DELETE CASCADE,
  org_id           uuid        NOT NULL
                               REFERENCES public.trade_organizations(id)
                               ON DELETE CASCADE,
  customer_number  text,
  descuento_pct    numeric(5,2),
  condiciones_pago text,
  activa           boolean     NOT NULL DEFAULT true,
  valid_from       timestamptz NOT NULL DEFAULT now(),
  valid_until      timestamptz,
  notas_internas   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_actor_org UNIQUE (actor_id, org_id),
  CONSTRAINT descuento_range  CHECK (descuento_pct IS NULL OR (descuento_pct > 0 AND descuento_pct < 100)),
  CONSTRAINT valid_range_cond CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_conditions_actor_org_active
  ON public.trade_marketplace_actor_org_conditions (actor_id, org_id, activa)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_conditions_org
  ON public.trade_marketplace_actor_org_conditions (org_id)
  WHERE activa = true;

CREATE OR REPLACE FUNCTION public._update_condition_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_condition_updated_at ON public.trade_marketplace_actor_org_conditions;
CREATE TRIGGER trg_condition_updated_at
  BEFORE UPDATE ON public.trade_marketplace_actor_org_conditions
  FOR EACH ROW EXECUTE FUNCTION public._update_condition_updated_at();

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
  valid_until   timestamptz,
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

DROP TRIGGER IF EXISTS trg_condition_price_updated_at ON public.trade_marketplace_actor_org_condition_prices;
CREATE TRIGGER trg_condition_price_updated_at
  BEFORE UPDATE ON public.trade_marketplace_actor_org_condition_prices
  FOR EACH ROW EXECUTE FUNCTION public._update_condition_updated_at();

COMMENT ON COLUMN public.trade_marketplace_actor_org_conditions.notas_internas
  IS 'Solo visible para el actor (proveedor). RLS excluye este campo de lecturas de la org.';;
