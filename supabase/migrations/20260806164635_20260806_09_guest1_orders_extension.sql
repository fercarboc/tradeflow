-- Sprint Guest-1 · Migración 09 — Extensión orders: org_id nullable + CHECK exclusivo (C1)

-- Paso 1: Añadir columnas con DEFAULT para no romper filas existentes
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS guest_customer_id uuid
                            REFERENCES public.trade_marketplace_guest_customers(id)
                            ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_email       text,
  ADD COLUMN IF NOT EXISTS origen            text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS precio_tipo       text;

-- Paso 2: Hacer org_id nullable (C1 — solo en orders, no en carts)
ALTER TABLE public.trade_marketplace_orders
  ALTER COLUMN org_id DROP NOT NULL;

-- Paso 3: Actualizar filas existentes explícitamente
UPDATE public.trade_marketplace_orders
SET origen = 'professional'
WHERE origen IS NULL OR origen = '';

-- Paso 4: Añadir constraints de integridad
ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_order_identity_exclusive;
ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_order_identity_exclusive CHECK (
    (origen = 'professional' AND org_id IS NOT NULL AND guest_customer_id IS NULL)
    OR
    (origen = 'guest' AND org_id IS NULL AND guest_customer_id IS NOT NULL)
  );

ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_orden_origen;
ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_orden_origen
    CHECK (origen IN ('professional', 'guest'));

ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_orden_precio_tipo;
ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_orden_precio_tipo
    CHECK (precio_tipo IS NULL OR precio_tipo IN (
      'pvd', 'pvp', 'promo_publica', 'promo_profesional', 'condicion_particular'
    ));

CREATE INDEX IF NOT EXISTS idx_orders_guest_customer
  ON public.trade_marketplace_orders (guest_customer_id)
  WHERE guest_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_origen
  ON public.trade_marketplace_orders (origen);

COMMENT ON COLUMN public.trade_marketplace_orders.origen
  IS 'professional: pedido de org autenticada. guest: pedido de invitado. Inmutable tras creación.';
COMMENT ON COLUMN public.trade_marketplace_orders.guest_customer_id
  IS 'FK a guest_customers. NOT NULL cuando origen=guest. La compra conserva origen=guest tras vinculación posterior.';;
