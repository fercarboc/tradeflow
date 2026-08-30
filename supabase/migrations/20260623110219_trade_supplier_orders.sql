
-- Pedidos de material a proveedores
CREATE TABLE trade_supplier_orders (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid NOT NULL,
  catalog_id    uuid NOT NULL REFERENCES trade_supplier_catalogs(id),
  quote_id      uuid REFERENCES trade_quotes(id) ON DELETE SET NULL,
  job_id        uuid REFERENCES trade_jobs(id) ON DELETE SET NULL,
  estado        text NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','enviado','confirmado','recibido','cancelado')),
  notas         text,
  total         numeric(10,2),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE trade_supplier_order_lines (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        uuid NOT NULL REFERENCES trade_supplier_orders(id) ON DELETE CASCADE,
  descripcion     text NOT NULL,
  referencia      text,
  cantidad        numeric(10,3) NOT NULL DEFAULT 1,
  unidad          text DEFAULT 'ud',
  precio_unitario numeric(10,2),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE trade_supplier_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_supplier_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_all_orders" ON trade_supplier_orders
  USING (org_id = (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "org_all_order_lines" ON trade_supplier_order_lines
  USING (order_id IN (
    SELECT id FROM trade_supplier_orders
    WHERE org_id = (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() LIMIT 1)
  ));
;
