-- ═══════════════════════════════════════════════════════════════════════
-- VF-AEAT-INST — Tests de inmutabilidad de installation_number
-- Valida trigger fn_protect_verifactu_installation_number (mig 20260903152632).
-- Ejecutar en rama de test (no producción).
-- Usa id=999 en trade_verifactu_system_config para filas de test.
-- NUNCA toca id=1 (fila de producción).
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-INST-1: NULL → valor PERMITIDO (asignación inicial)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_id int := 999;
  v_install_number text;
BEGIN
  -- Insertar fila de test con installation_number NULL
  INSERT INTO public.trade_verifactu_system_config (id, installation_number)
  VALUES (v_test_id, NULL)
  ON CONFLICT (id) DO UPDATE SET installation_number = NULL;

  -- NULL → valor: debe ser PERMITIDO
  UPDATE public.trade_verifactu_system_config
  SET installation_number = 'TEST-INST-001'
  WHERE id = v_test_id;

  SELECT installation_number INTO v_install_number
  FROM public.trade_verifactu_system_config WHERE id = v_test_id;

  IF v_install_number IS DISTINCT FROM 'TEST-INST-001' THEN
    RAISE EXCEPTION '[VF-AEAT-INST-1] FAIL: valor no se guardó correctamente (actual=%).', v_install_number;
  END IF;

  RAISE NOTICE '[VF-AEAT-INST-1] PASS: NULL → valor PERMITIDO (installation_number asignado correctamente).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-INST-1] ERROR: % — %', SQLERRM, SQLSTATE;
  DELETE FROM public.trade_verifactu_system_config WHERE id = v_test_id;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-INST-2: NULL → NULL PERMITIDO (sin cambio efectivo)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_id int := 999;
BEGIN
  -- Asegurar que la fila existe con NULL
  INSERT INTO public.trade_verifactu_system_config (id, installation_number)
  VALUES (v_test_id, NULL)
  ON CONFLICT (id) DO UPDATE SET installation_number = NULL;

  -- NULL → NULL: debe ser PERMITIDO
  UPDATE public.trade_verifactu_system_config
  SET installation_number = NULL
  WHERE id = v_test_id;

  RAISE NOTICE '[VF-AEAT-INST-2] PASS: NULL → NULL PERMITIDO (sin cambio en installation_number).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-INST-2] ERROR: % — %', SQLERRM, SQLSTATE;
  DELETE FROM public.trade_verifactu_system_config WHERE id = v_test_id;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-INST-3: valor → mismo valor PERMITIDO (idempotente)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_id int := 999;
  v_install_number text;
BEGIN
  -- Asegurar valor ya establecido
  INSERT INTO public.trade_verifactu_system_config (id, installation_number)
  VALUES (v_test_id, 'TEST-INST-SAME')
  ON CONFLICT (id) DO UPDATE SET installation_number = 'TEST-INST-SAME';

  -- valor → mismo valor: debe ser PERMITIDO
  UPDATE public.trade_verifactu_system_config
  SET installation_number = 'TEST-INST-SAME'
  WHERE id = v_test_id;

  SELECT installation_number INTO v_install_number
  FROM public.trade_verifactu_system_config WHERE id = v_test_id;

  IF v_install_number IS DISTINCT FROM 'TEST-INST-SAME' THEN
    RAISE EXCEPTION '[VF-AEAT-INST-3] FAIL: valor cambió inesperadamente (actual=%).', v_install_number;
  END IF;

  RAISE NOTICE '[VF-AEAT-INST-3] PASS: valor → mismo valor PERMITIDO (idempotente).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-INST-3] ERROR: % — %', SQLERRM, SQLSTATE;
  DELETE FROM public.trade_verifactu_system_config WHERE id = v_test_id;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-INST-4: valor → diferente valor BLOQUEADO
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_id   int  := 999;
  v_blocked   bool := false;
BEGIN
  -- Asegurar valor establecido
  INSERT INTO public.trade_verifactu_system_config (id, installation_number)
  VALUES (v_test_id, 'TEST-INST-ORIG')
  ON CONFLICT (id) DO UPDATE SET installation_number = 'TEST-INST-ORIG';

  -- valor → diferente valor: debe ser BLOQUEADO por el trigger
  BEGIN
    UPDATE public.trade_verifactu_system_config
    SET installation_number = 'TEST-INST-CHANGED'
    WHERE id = v_test_id;
    -- Si llegamos aquí, el trigger NO bloqueó → FAIL
  EXCEPTION WHEN OTHERS THEN
    -- Esperamos P0001 con el mensaje del trigger
    v_blocked := true;
    IF SQLERRM NOT LIKE '%NumeroInstalacion no puede modificarse%' THEN
      RAISE EXCEPTION '[VF-AEAT-INST-4] FAIL: excepción inesperada: % — %', SQLERRM, SQLSTATE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-AEAT-INST-4] FAIL: el trigger NO bloqueó el cambio valor → diferente valor.';
  END IF;

  RAISE NOTICE '[VF-AEAT-INST-4] PASS: valor → diferente valor BLOQUEADO por trigger (mensaje correcto).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-INST-4] ERROR: % — %', SQLERRM, SQLSTATE;
  DELETE FROM public.trade_verifactu_system_config WHERE id = v_test_id;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-INST-5: valor → NULL BLOQUEADO
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_id   int  := 999;
  v_blocked   bool := false;
BEGIN
  -- Asegurar valor establecido
  INSERT INTO public.trade_verifactu_system_config (id, installation_number)
  VALUES (v_test_id, 'TEST-INST-RESET')
  ON CONFLICT (id) DO UPDATE SET installation_number = 'TEST-INST-RESET';

  -- valor → NULL: debe ser BLOQUEADO por el trigger
  BEGIN
    UPDATE public.trade_verifactu_system_config
    SET installation_number = NULL
    WHERE id = v_test_id;
    -- Si llegamos aquí, el trigger NO bloqueó → FAIL
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true;
    IF SQLERRM NOT LIKE '%NumeroInstalacion no puede modificarse%' THEN
      RAISE EXCEPTION '[VF-AEAT-INST-5] FAIL: excepción inesperada: % — %', SQLERRM, SQLSTATE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-AEAT-INST-5] FAIL: el trigger NO bloqueó el cambio valor → NULL.';
  END IF;

  RAISE NOTICE '[VF-AEAT-INST-5] PASS: valor → NULL BLOQUEADO por trigger.';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-INST-5] ERROR: % — %', SQLERRM, SQLSTATE;
  DELETE FROM public.trade_verifactu_system_config WHERE id = v_test_id;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- CLEANUP VF-AEAT-INST
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  DELETE FROM public.trade_verifactu_system_config WHERE id = 999;
  RAISE NOTICE '[CLEANUP-INST] Fila de test id=999 eliminada de trade_verifactu_system_config.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[CLEANUP-INST] Advertencia: %', SQLERRM;
END;
$$;
