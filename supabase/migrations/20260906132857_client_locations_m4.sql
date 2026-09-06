-- M4: Contador monotónico TF-MANT + seed
-- PH0-MAINT-CLIENT-LOCATIONS-IMPL-1

-- ── Tabla contador ─────────────────────────────────────────────────────────────
CREATE TABLE public.trade_contract_counters (
  org_id     uuid    NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  ejercicio  integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0
    CONSTRAINT last_value_non_negative CHECK (last_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, ejercicio)
);

-- Ningún rol de aplicación tiene acceso directo al contador.
-- El acceso pasa exclusivamente por la función SECURITY DEFINER.
-- Mismo patrón que la migración 20260904083809 (contadores VeriFactu).
REVOKE ALL ON TABLE public.trade_contract_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.trade_contract_counters FROM anon;
REVOKE ALL ON TABLE public.trade_contract_counters FROM authenticated;
REVOKE ALL ON TABLE public.trade_contract_counters FROM service_role;

-- ── Función de protección (trigger de monotonicidad) ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_protect_contract_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Los contadores de contrato no pueden eliminarse (org_id=%, ejercicio=%)',
      OLD.org_id, OLD.ejercicio
      USING ERRCODE = '23514';
  END IF;
  IF NEW.last_value < OLD.last_value THEN
    RAISE EXCEPTION
      'El contador de contrato no puede decrementarse (% → %, org_id=%, ejercicio=%)',
      OLD.last_value, NEW.last_value, OLD.org_id, OLD.ejercicio
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_contract_counter
  BEFORE DELETE OR UPDATE ON public.trade_contract_counters
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_contract_counter();

-- ── Función de numeración ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_maintenance_contract_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
  v_org_tz   text;
  v_year     integer;
  v_next     integer;
BEGIN
  -- 1. Autorización explícita — FAIL CLOSED para todo rol no reconocido.
  --    auth.role() IS NULL → REJECT (no tratar como postgres/confiable).
  v_jwt_role := auth.role();

  IF v_jwt_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Token autenticado sin identidad (uid ausente).'
        USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations
        WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members
        WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No autorizado: el usuario no pertenece a la organización %', p_org_id
        USING ERRCODE = '42501';
    END IF;

  ELSIF v_jwt_role = 'service_role' THEN
    NULL; -- service_role es confiable (billing cron, edge functions)

  ELSE
    -- auth.role() IS NULL o cualquier otro rol → REJECT
    RAISE EXCEPTION 'Rol no autorizado para crear números de contrato: %',
      COALESCE(v_jwt_role, 'NULL')
      USING ERRCODE = '42501';
  END IF;

  -- 2. Verificar que la org existe ANTES de incrementar.
  --    p_org_id inexistente → REJECT (no crea ni incrementa contador).
  SELECT COALESCE(timezone, 'Europe/Madrid')
  INTO v_org_tz
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización % no encontrada.', p_org_id
      USING ERRCODE = '23503';
  END IF;

  -- 3. Ejercicio calculado internamente con timezone de la org.
  --    NO se acepta p_year desde el exterior.
  v_year := EXTRACT(YEAR FROM (NOW() AT TIME ZONE v_org_tz))::integer;

  -- 4. Incremento atómico — ON CONFLICT garantiza unicidad bajo concurrencia.
  INSERT INTO public.trade_contract_counters (org_id, ejercicio, last_value)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (org_id, ejercicio) DO UPDATE
    SET last_value = trade_contract_counters.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN 'TF-MANT-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- Permisos de la función:
-- REVOKE de PUBLIC y anon (PostgreSQL otorga EXECUTE a PUBLIC por defecto).
-- GRANT explícito a authenticated y service_role.
REVOKE EXECUTE ON FUNCTION public.next_maintenance_contract_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_maintenance_contract_number(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.next_maintenance_contract_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_maintenance_contract_number(uuid) TO service_role;

-- ── Seed: FAIL CLOSED + inserción ────────────────────────────────────────────

-- FAIL CLOSED: abortar si existen referencias TF-MANT con formato inválido.
-- La regex ^TF-MANT-[0-9]{4}-[0-9]{4,}$ acepta exactamente el formato emitido
-- por esta función. Si existe alguna referencia anómala el seed podría ser incorrecto.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.trade_contracts
    WHERE referencia LIKE 'TF-MANT-%'
      AND NOT (referencia ~ '^TF-MANT-[0-9]{4}-[0-9]{4,}$')
  ) THEN
    RAISE EXCEPTION
      'MIGRATION BLOCKED: trade_contracts tiene referencias TF-MANT con formato inválido. '
      'Corregir datos antes de aplicar esta migración.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Seed piloto explícito y auditable:
-- TF-MANT-2026-0001..0005 existieron (test data, eliminados 2026-09-06,
-- PH0-MAINT-CLEAN-SLATE-AND-DUPLICATE-GUARD). Próximo válido: TF-MANT-2026-0006.
-- GREATEST garantiza que si el contador ya existe con valor mayor, no retrocede.
INSERT INTO public.trade_contract_counters (org_id, ejercicio, last_value)
VALUES ('89d05f11-6115-470d-bdac-37d38b9925c0', 2026, 5)
ON CONFLICT (org_id, ejercicio)
  DO UPDATE SET
    last_value = GREATEST(trade_contract_counters.last_value, 5),
    updated_at = now();

-- Seed genérico para otras orgs: MAX ordinal desde referencia (no created_at).
-- Excluye piloto (ya seedeado arriba) y refs con formato inválido (filtro regex).
-- split_part('-',3) = año (ej. 2026), split_part('-',4) = ordinal (ej. 3).
-- ON CONFLICT GREATEST: idempotente y no retrocede si ya existe.
INSERT INTO public.trade_contract_counters (org_id, ejercicio, last_value)
SELECT
  org_id,
  split_part(referencia, '-', 3)::integer                AS ejercicio,
  MAX(split_part(referencia, '-', 4)::integer)           AS last_value
FROM public.trade_contracts
WHERE referencia ~ '^TF-MANT-[0-9]{4}-[0-9]{4,}$'
  AND org_id != '89d05f11-6115-470d-bdac-37d38b9925c0'
GROUP BY org_id, split_part(referencia, '-', 3)
ON CONFLICT (org_id, ejercicio)
  DO UPDATE SET
    last_value = GREATEST(trade_contract_counters.last_value, EXCLUDED.last_value),
    updated_at = now();
