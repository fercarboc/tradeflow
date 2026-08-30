
-- 1. Ampliar trade_waitlist con columnas CRM
ALTER TABLE trade_waitlist
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'landing',
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

ALTER TABLE trade_waitlist
  ADD CONSTRAINT waitlist_estado_check
    CHECK (estado IN ('nuevo','contactado','interesado','beta_activa','convertido','descartado'))
    NOT VALID,
  ADD CONSTRAINT waitlist_prioridad_check
    CHECK (prioridad IN ('alta','media','baja'))
    NOT VALID;

-- 2. Política RLS para admin autenticado
DROP POLICY IF EXISTS "waitlist_admin_select" ON trade_waitlist;
DROP POLICY IF EXISTS "waitlist_admin_update" ON trade_waitlist;
DROP POLICY IF EXISTS "waitlist_admin_delete" ON trade_waitlist;

CREATE POLICY "waitlist_admin_select" ON trade_waitlist
  FOR SELECT TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "waitlist_admin_update" ON trade_waitlist
  FOR UPDATE TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "waitlist_admin_delete" ON trade_waitlist
  FOR DELETE TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');

-- 3. Columna lead_id en trade_organizations (referencia opcional al lead de origen)
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES trade_waitlist(id) ON DELETE SET NULL;

-- 4. RPC admin para leer todos los leads
CREATE OR REPLACE FUNCTION admin_get_waitlist_leads()
RETURNS SETOF trade_waitlist
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'fercarboc@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT * FROM trade_waitlist ORDER BY
    CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
    created_at DESC;
END;
$$;
;
