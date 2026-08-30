
-- Trazabilidad: qué miembro creó cada presupuesto/factura
ALTER TABLE trade_quotes   ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Stripe en trade_subscriptions
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id      text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id  text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id         text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS current_period_end      timestamptz;
;
