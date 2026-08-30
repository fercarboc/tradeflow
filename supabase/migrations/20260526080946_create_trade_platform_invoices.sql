
CREATE TABLE IF NOT EXISTS trade_platform_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  amount_cents    integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  stripe_invoice_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trade_platform_invoices ENABLE ROW LEVEL SECURITY;

-- Solo el service_role puede leer (admin only vía service key o RPC)
CREATE POLICY "admin_platform_invoices_select"
  ON trade_platform_invoices
  FOR SELECT
  USING (auth.role() = 'service_role');

-- El superadmin (fercarboc@gmail.com) puede leer a través de una función SECURITY DEFINER
CREATE OR REPLACE FUNCTION admin_get_platform_invoices()
RETURNS SETOF trade_platform_invoices
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM trade_platform_invoices ORDER BY created_at DESC;
$$;

-- Solo puede llamarla el admin
REVOKE ALL ON FUNCTION admin_get_platform_invoices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_platform_invoices() TO authenticated;

-- Función SECURITY DEFINER para activar/desactivar suscripción
CREATE OR REPLACE FUNCTION admin_set_subscription_active(p_org_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_subscriptions
  SET status = CASE WHEN p_active THEN 'active' ELSE 'cancelled' END,
      updated_at = now()
  WHERE org_id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_subscription_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_subscription_active(uuid, boolean) TO authenticated;

CREATE INDEX IF NOT EXISTS trade_platform_invoices_org_id_idx ON trade_platform_invoices(org_id);
CREATE INDEX IF NOT EXISTS trade_platform_invoices_status_idx ON trade_platform_invoices(status);
;
