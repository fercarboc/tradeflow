-- Extensión no destructiva de trade_waitlist para soportar múltiples tipos de leads:
-- installer (existentes), provider, advertising, partner, other.
-- Todos los campos nuevos son nullable/con default para no romper datos existentes.

ALTER TABLE public.trade_waitlist

  -- Tipo de lead: distingue instaladores de proveedores/publicidad
  ADD COLUMN IF NOT EXISTS lead_type        text DEFAULT 'installer',

  -- Datos corporativos del proveedor
  ADD COLUMN IF NOT EXISTS company_name     text,
  ADD COLUMN IF NOT EXISTS company_type     text,
  ADD COLUMN IF NOT EXISTS website          text,
  ADD COLUMN IF NOT EXISTS province         text,
  ADD COLUMN IF NOT EXISTS geographic_coverage text,
  ADD COLUMN IF NOT EXISTS catalog_size     text,

  -- Intereses del proveedor (array de strings)
  ADD COLUMN IF NOT EXISTS interests        text[],

  -- Flags de interés específico (expresado por el lead en el formulario)
  ADD COLUMN IF NOT EXISTS provider_interest          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advertising_interest       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_provider_interest boolean DEFAULT false,

  -- Estado confirmado por admin (≠ interés expresado por el lead)
  ADD COLUMN IF NOT EXISTS founding_provider          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advertising_discount_percent integer DEFAULT 0,

  -- Datos de campaña publicitaria
  ADD COLUMN IF NOT EXISTS campaign_type    text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS desired_period   text,
  ADD COLUMN IF NOT EXISTS desired_ad_space text,
  ADD COLUMN IF NOT EXISTS estimated_budget text,

  -- Seguimiento
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,

  -- Vinculación futura con organización de proveedor
  ADD COLUMN IF NOT EXISTS provider_org_id  uuid;

-- Índice para filtrar por tipo en el admin
CREATE INDEX IF NOT EXISTS idx_trade_waitlist_lead_type ON public.trade_waitlist (lead_type);
