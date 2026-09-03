-- ============================================================
-- VF-PROD-3: NumeroInstalacion immutability trigger
-- ============================================================
--
-- trade_verifactu_system_config.installation_number es inmutable
-- una vez asignado. Reglas:
--   NULL → valor : PERMITIDO (asignación inicial)
--   NULL → NULL  : PERMITIDO (sin cambio)
--   valor → mismo: PERMITIDO (sin cambio efectivo)
--   valor → distinto: BLOQUEADO
--   valor → NULL : BLOQUEADO
--
-- El trigger es la única protección actualmente porque no existe
-- ningún RPC de actualización expuesto al cliente. Cuando se cree
-- un RPC admin de actualización debe incluir su propio guard antes
-- del UPDATE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_protect_verifactu_installation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el valor anterior ya estaba establecido y el nuevo es distinto → bloquear
  IF OLD.installation_number IS NOT NULL
     AND (NEW.installation_number IS DISTINCT FROM OLD.installation_number) THEN
    RAISE EXCEPTION
      'NumeroInstalacion no puede modificarse una vez establecido para esta instancia SIF.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_protect_verifactu_installation_number() FROM PUBLIC;

-- Trigger BEFORE UPDATE para interceptar cualquier cambio en la tabla
DROP TRIGGER IF EXISTS trg_protect_verifactu_installation_number
  ON public.trade_verifactu_system_config;

CREATE TRIGGER trg_protect_verifactu_installation_number
  BEFORE UPDATE ON public.trade_verifactu_system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_verifactu_installation_number();
