-- B05: Ampliar constraints de trade_marketplace_carts
-- Añade 'free' y 'reorder' a source_type, y 'saved' a estado
-- Mantiene 'reviewing' y 'checkout' como valores obsoletos compatibles

BEGIN;

-- 1. Ampliar chk_cart_source
ALTER TABLE public.trade_marketplace_carts
  DROP CONSTRAINT chk_cart_source;

ALTER TABLE public.trade_marketplace_carts
  ADD CONSTRAINT chk_cart_source CHECK (
    source_type = ANY (ARRAY[
      'quote'::text,
      'job'::text,
      'field_action'::text,
      'maintenance_incident'::text,
      'manual'::text,
      'free'::text,
      'reorder'::text
    ])
  );

-- 2. Ampliar chk_cart_estado
ALTER TABLE public.trade_marketplace_carts
  DROP CONSTRAINT chk_cart_estado;

ALTER TABLE public.trade_marketplace_carts
  ADD CONSTRAINT chk_cart_estado CHECK (
    estado = ANY (ARRAY[
      'active'::text,
      'reviewing'::text,
      'checkout'::text,
      'ordered'::text,
      'cancelled'::text,
      'saved'::text
    ])
  );

COMMIT;;
