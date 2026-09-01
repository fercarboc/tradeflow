-- ============================================================
-- VF-CHAIN-NIF: Unicidad de NIF emisor + Inmutabilidad post-fiscal
-- ============================================================
--
-- Garantía estructural de Design A (VF-CHAIN-NIF):
--   1 organización fiscal ↔ 1 NIF emisor (biyección)
--
-- INVARIANTE A — Unicidad:
--   Ningún NIF canonicalizado puede existir en más de una org.
--   Canon: upper(replace(replace(trim(nif), '-', ''), ' ', ''))
--   Guiones y espacios internos son separadores decorativos en
--   NIF/CIF/DNI/NIE españoles y se eliminan para comparación.
--   El índice es parcial (WHERE nif IS NOT NULL AND trim(nif) != '')
--   para que orgs en onboarding incompleto coexistan sin conflicto.
--
-- INVARIANTE B — Inmutabilidad post-fiscal:
--   El NIF de una org no puede cambiar una vez existe cualquier
--   registro en trade_fiscal_records para esa org.
--   Comparación: trim(NEW.nif) IS DISTINCT FROM trim(OLD.nif)
--   — alineada con fn_emitir_factura: nif_emisor = trim(v_org.nif).
--   Permite: A→' A ' (solo espacios externos, trim idéntico).
--   Bloquea: A→B, A→NULL, A→'', A→'a' (cambio de case), post-fiscal.
--
-- SECURITY DEFINER en fn_protect_org_nif_immutability:
--   El EXISTS sobre trade_fiscal_records ejecuta con privilegios
--   del propietario (sin filtrado RLS), garantizando correctitud
--   independientemente del rol que realice el UPDATE.
--
-- NO MODIFICA: fn_emitir_factura, trade_fiscal_records, datos existentes.
-- VF-HASH-CASE-GAP: OPEN PRE-ACTIVATION — fn_emitir_factura usa
--   trim() sin upper(). Resolución diferida a fase de activación.
-- ============================================================


-- ── PRECONDITION ─────────────────────────────────────────────
-- Aborta si existen colisiones canónicas. Protege contra aplicar
-- la migration sobre datos con NIFs duplicados ya existentes.
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT upper(replace(replace(trim(nif), '-', ''), ' ', ''))
    FROM public.trade_organizations
    WHERE nif IS NOT NULL AND trim(nif) != ''
    GROUP BY upper(replace(replace(trim(nif), '-', ''), ' ', ''))
    HAVING COUNT(*) > 1
  ) dup;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'PRECONDITION FAILED: % grupo(s) de NIF canónico duplicado entre '
      'organizaciones. Resolver antes de aplicar esta migration.',
      v_count;
  END IF;
END $$;


-- ── 1. UNIQUE INDEX — unicidad de NIF canónico ───────────────
DROP INDEX IF EXISTS public.uq_org_nif_normalized;

CREATE UNIQUE INDEX uq_org_nif_normalized
  ON public.trade_organizations (
    upper(replace(replace(trim(nif), '-', ''), ' ', ''))
  )
  WHERE nif IS NOT NULL AND trim(nif) != '';


-- ── 2. fn_protect_org_nif_immutability ───────────────────────
CREATE OR REPLACE FUNCTION public.fn_protect_org_nif_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF trim(NEW.nif) IS DISTINCT FROM trim(OLD.nif) THEN
    IF EXISTS (
      SELECT 1
      FROM public.trade_fiscal_records
      WHERE org_id = OLD.id
      LIMIT 1
    ) THEN
      RAISE EXCEPTION
        'El NIF/CIF no puede modificarse después de existir actividad '
        'fiscal en esta organización. (org_id: %)',
        OLD.id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_protect_org_nif_immutability() FROM PUBLIC;


-- ── 3. TRIGGER ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_protect_org_nif_immutability ON public.trade_organizations;

CREATE TRIGGER trg_protect_org_nif_immutability
  BEFORE UPDATE ON public.trade_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_org_nif_immutability();
