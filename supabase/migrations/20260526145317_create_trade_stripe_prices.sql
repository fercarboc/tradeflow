
CREATE TABLE IF NOT EXISTS trade_stripe_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan          text NOT NULL CHECK (plan IN ('basico', 'pro', 'empresa')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_price_id text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan, billing_cycle)
);

ALTER TABLE trade_stripe_prices ENABLE ROW LEVEL SECURITY;

-- Solo service_role y la edge function (via service key) pueden leer
-- Los usuarios autenticados normales no necesitan acceso directo
CREATE POLICY "service_role_all"
  ON trade_stripe_prices FOR ALL
  USING (auth.role() = 'service_role');

-- Insertar los 6 precios actuales
INSERT INTO trade_stripe_prices (plan, billing_cycle, stripe_price_id) VALUES
  ('basico',  'monthly', 'price_1TbM5hEBDOoWck8qntzTr07R'),
  ('basico',  'yearly',  'price_1TbM6WEBDOoWck8qQcuCnVXs'),
  ('pro',     'monthly', 'price_1TbM7dEBDOoWck8qxIysJ08O'),
  ('pro',     'yearly',  'price_1TbM87EBDOoWck8qdX25uwfX'),
  ('empresa', 'monthly', 'price_1TbM91EBDOoWck8qWhtbNz9r'),
  ('empresa', 'yearly',  'price_1TbM9QEBDOoWck8ql0CSkHfH')
ON CONFLICT (plan, billing_cycle) DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  updated_at = now();
;
