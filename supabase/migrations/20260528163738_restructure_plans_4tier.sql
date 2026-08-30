
-- ── 1. Eliminar constraints viejos ───────────────────────────────────────────
ALTER TABLE trade_subscriptions DROP CONSTRAINT trade_subscriptions_plan_check;
ALTER TABLE trade_stripe_prices  DROP CONSTRAINT trade_stripe_prices_plan_check;

-- ── 2. Migrar datos 'pro' → 'profesional' ────────────────────────────────────
UPDATE trade_stripe_prices  SET plan = 'profesional' WHERE plan = 'pro';
UPDATE trade_subscriptions  SET plan = 'profesional' WHERE plan = 'pro';
UPDATE trade_organizations  SET plan = 'profesional' WHERE plan = 'pro';

-- ── 3. Añadir nuevos constraints con los 4 planes ────────────────────────────
ALTER TABLE trade_subscriptions
  ADD CONSTRAINT trade_subscriptions_plan_check
  CHECK (plan = ANY (ARRAY['basico','profesional','empresa','empresa_plus']));

ALTER TABLE trade_stripe_prices
  ADD CONSTRAINT trade_stripe_prices_plan_check
  CHECK (plan = ANY (ARRAY['basico','profesional','empresa','empresa_plus']));

-- ── 4. Filas placeholder empresa_plus (price IDs pendientes de Stripe) ────────
INSERT INTO trade_stripe_prices (plan, billing_cycle, stripe_price_id, active)
VALUES
  ('empresa_plus', 'monthly', 'PENDING_STRIPE_PRICE_ID_MONTHLY', false),
  ('empresa_plus', 'yearly',  'PENDING_STRIPE_PRICE_ID_YEARLY',  false)
ON CONFLICT DO NOTHING;
;
