-- Sprint Guest-1 · Migración 09
-- Objetivo: Extensión de trade_marketplace_orders para soporte de pedidos de invitados
-- C1: org_id → nullable; CHECK mutuamente exclusivo profesional/guest
--     No se usa org ficticia. Pedido guest mantiene origen='guest' siempre.

BEGIN;

-- ─── Paso 1: Añadir columnas nuevas con DEFAULT para no romper filas existentes ──

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS guest_customer_id uuid
                            REFERENCES public.trade_marketplace_guest_customers(id)
                            ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_email       text,
  ADD COLUMN IF NOT EXISTS origen            text        NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS precio_tipo       text;

-- ─── Paso 2: Hacer org_id nullable (C1) ──────────────────────────────────────
-- Solo en trade_marketplace_orders. trade_marketplace_carts.org_id permanece NOT NULL.

ALTER TABLE public.trade_marketplace_orders
  ALTER COLUMN org_id DROP NOT NULL;

-- ─── Paso 3: Añadir constraints de integridad ─────────────────────────────────

-- CHECK mutuamente exclusivo: profesional xor guest
ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_order_identity_exclusive;

ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_order_identity_exclusive CHECK (
    (
      origen = 'professional'
      AND org_id IS NOT NULL
      AND guest_customer_id IS NULL
    )
    OR
    (
      origen = 'guest'
      AND org_id IS NULL
      AND guest_customer_id IS NOT NULL
    )
  );

-- Constraint en origen
ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_orden_origen;

ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_orden_origen
    CHECK (origen IN ('professional', 'guest'));

-- Constraint en precio_tipo
ALTER TABLE public.trade_marketplace_orders
  DROP CONSTRAINT IF EXISTS chk_orden_precio_tipo;

ALTER TABLE public.trade_marketplace_orders
  ADD CONSTRAINT chk_orden_precio_tipo
    CHECK (precio_tipo IS NULL OR precio_tipo IN (
      'pvd', 'pvp', 'promo_publica', 'promo_profesional', 'condicion_particular'
    ));

-- ─── Paso 4: Actualizar filas existentes ──────────────────────────────────────
-- Todas las filas existentes son profesionales: org_id NOT NULL garantizado.
-- origen ya tiene DEFAULT 'professional', pero hacemos UPDATE explícito para seguridad.

UPDATE public.trade_marketplace_orders
SET origen = 'professional'
WHERE origen IS NULL OR origen = '';

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_guest_customer
  ON public.trade_marketplace_orders (guest_customer_id)
  WHERE guest_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_origen
  ON public.trade_marketplace_orders (origen);

-- ─── Comentarios ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.trade_marketplace_orders.origen
  IS 'professional: pedido creado por org autenticada. guest: pedido de comprador invitado sin cuenta.';
COMMENT ON COLUMN public.trade_marketplace_orders.guest_customer_id
  IS 'FK a guest_customers. NOT NULL cuando origen=guest. La compra conserva origen=guest tras vinculación posterior.';
COMMENT ON COLUMN public.trade_marketplace_orders.guest_email
  IS 'Email del invitado copiado en el pedido. Permite consultas sin JOIN a guest_customers.';
COMMENT ON COLUMN public.trade_marketplace_orders.precio_tipo
  IS 'Tipo de precio aplicado: pvd | pvp | promo_publica | promo_profesional | condicion_particular.';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- ATENCIÓN: si ya existen pedidos guest, este rollback elimina datos de guest_customer_id.
-- BEGIN;
-- -- Revertir org_id NOT NULL (solo si todos los pedidos tienen org_id)
-- UPDATE public.trade_marketplace_orders SET org_id = NULL WHERE origen = 'guest'; -- borrar guest
-- ALTER TABLE public.trade_marketplace_orders ALTER COLUMN org_id SET NOT NULL;
-- ALTER TABLE public.trade_marketplace_orders
--   DROP CONSTRAINT IF EXISTS chk_order_identity_exclusive,
--   DROP CONSTRAINT IF EXISTS chk_orden_origen,
--   DROP CONSTRAINT IF EXISTS chk_orden_precio_tipo,
--   DROP COLUMN IF EXISTS guest_customer_id,
--   DROP COLUMN IF EXISTS guest_email,
--   DROP COLUMN IF EXISTS origen,
--   DROP COLUMN IF EXISTS precio_tipo;
-- DROP INDEX IF EXISTS idx_orders_guest_customer;
-- DROP INDEX IF EXISTS idx_orders_origen;
-- COMMIT;
