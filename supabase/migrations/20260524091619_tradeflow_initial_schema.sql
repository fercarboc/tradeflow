
-- =====================================================================
-- TradeFlow AI — Schema completo con prefijo trade_
-- =====================================================================

-- 1. ORGANIZACIONES
CREATE TABLE IF NOT EXISTS public.trade_organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  nif             text,
  direccion       text,
  email           text,
  telefono        text,
  oficio          text NOT NULL DEFAULT 'Fontanería',
  ciudad          text,
  iva_default     smallint NOT NULL DEFAULT 21,
  plan            text NOT NULL DEFAULT 'básico',
  logo_url        text,
  is_onboarded    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- 2. CLIENTES CRM
CREATE TABLE IF NOT EXISTS public.trade_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  telefono        text,
  email           text,
  direccion       text,
  ciudad          text,
  nif             text,
  notas           text,
  obras_activas   smallint NOT NULL DEFAULT 0,
  total_facturado numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. PRESUPUESTOS
CREATE TABLE IF NOT EXISTS public.trade_quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  numero          text NOT NULL,
  descripcion     text,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  estado          text NOT NULL DEFAULT 'Borrador',
  total_neto      numeric(10,2) NOT NULL DEFAULT 0,
  iva_pct         smallint NOT NULL DEFAULT 21,
  total_con_iva   numeric(10,2) GENERATED ALWAYS AS (total_neto * (1 + iva_pct::numeric/100)) STORED,
  voice_note_url  text,
  whatsapp_sent_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, numero)
);

-- 4. PARTIDAS DE PRESUPUESTO
CREATE TABLE IF NOT EXISTS public.trade_quote_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  descripcion     text NOT NULL,
  tipo            text NOT NULL DEFAULT 'material',
  cantidad        numeric(8,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  posicion        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. FACTURAS
CREATE TABLE IF NOT EXISTS public.trade_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id          uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  client_id         uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  numero            text NOT NULL,
  fecha             date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  estado            text NOT NULL DEFAULT 'Pendiente',
  subtotal          numeric(10,2) NOT NULL DEFAULT 0,
  iva_pct           smallint NOT NULL DEFAULT 21,
  iva_importe       numeric(10,2) GENERATED ALWAYS AS (subtotal * iva_pct::numeric/100) STORED,
  total             numeric(10,2) GENERATED ALWAYS AS (subtotal * (1 + iva_pct::numeric/100)) STORED,
  paid_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, numero)
);

-- 6. LISTA DE ESPERA
CREATE TABLE IF NOT EXISTS public.trade_waitlist (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL,
  telefono              text,
  email                 text NOT NULL,
  oficio                text,
  ciudad                text,
  presupuestos_al_mes   text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 7. GRABACIONES DE VOZ
CREATE TABLE IF NOT EXISTS public.trade_voice_recordings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  storage_path    text NOT NULL,
  transcript      text,
  partidas_json   jsonb,
  modelo_ia       text DEFAULT 'whisper-1',
  duration_secs   smallint,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 8. ESCANEOS FOTOGRÁFICOS
CREATE TABLE IF NOT EXISTS public.trade_photo_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  storage_path    text NOT NULL,
  detections      jsonb,
  modelo_ia       text DEFAULT 'gpt-4o',
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_trade_clients_org_id       ON public.trade_clients(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_org_id        ON public.trade_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_client_id     ON public.trade_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_estado        ON public.trade_quotes(estado);
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_quote_id ON public.trade_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_org_id      ON public.trade_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_estado      ON public.trade_invoices(estado);

-- TRIGGER updated_at
CREATE OR REPLACE FUNCTION public.trade_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_trade_organizations_updated
  BEFORE UPDATE ON public.trade_organizations
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_clients_updated
  BEFORE UPDATE ON public.trade_clients
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_quotes_updated
  BEFORE UPDATE ON public.trade_quotes
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_invoices_updated
  BEFORE UPDATE ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();
;
