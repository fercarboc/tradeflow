-- A1: Reparación idempotente de 2 offerings STN con U+FFFD confirmados
-- STN-FON-006: V▒lvula de esfera palanca 1/2" PN25 lat▒n → Válvula de esfera palanca 1/2" PN25 latón
-- STN-FON-030: Kit desag▒e plato ducha click-clack 90mm inox → Kit desagüe plato ducha click-clack 90mm inox
-- Guard: solo actualiza si la descripción actual contiene U+FFFD (chr(65533))
-- No toca: precio, stock, match_state, match_method, match_confidence, metadata

DO $$
DECLARE
  v_offering_id  uuid;
  v_old_desc     text;
  v_new_desc     text;
  v_supplier_ref text;
BEGIN

  -- ── STN-FON-006 ──────────────────────────────────────────────────────────────
  v_supplier_ref := 'STN-FON-006';
  v_new_desc     := 'Válvula de esfera palanca 1/2" PN25 latón';

  SELECT id, descripcion_comercial
  INTO   v_offering_id, v_old_desc
  FROM   public.trade_marketplace_supplier_offerings
  WHERE  supplier_ref      = v_supplier_ref
    AND  supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02'
    AND  descripcion_comercial LIKE '%' || chr(65533) || '%'
  LIMIT 1;

  IF v_offering_id IS NOT NULL THEN
    UPDATE public.trade_marketplace_supplier_offerings
    SET    descripcion_comercial = v_new_desc,
           updated_at = now()
    WHERE  id = v_offering_id;

    INSERT INTO public.trade_marketplace_audit_log
      (actor_id, event_type, event_data)
    VALUES (
      '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',
      'offering.description_normalized',
      jsonb_build_object(
        'entity_type',    'supplier_offering',
        'entity_id',      v_offering_id,
        'reason',         'UTF-8 replacement characters from Windows-1252 import',
        'dataset',        'A1_P2_7_repair',
        'previous_value', v_old_desc,
        'new_value',      v_new_desc,
        'supplier_ref',   v_supplier_ref
      )
    );
    RAISE NOTICE 'Reparado %: "%" → "%"', v_supplier_ref, v_old_desc, v_new_desc;
  ELSE
    RAISE NOTICE '% ya reparado o no encontrado — sin cambios.', v_supplier_ref;
  END IF;

  -- ── STN-FON-030 ──────────────────────────────────────────────────────────────
  v_supplier_ref := 'STN-FON-030';
  v_new_desc     := 'Kit desagüe plato ducha click-clack 90mm inox';

  SELECT id, descripcion_comercial
  INTO   v_offering_id, v_old_desc
  FROM   public.trade_marketplace_supplier_offerings
  WHERE  supplier_ref      = v_supplier_ref
    AND  supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02'
    AND  descripcion_comercial LIKE '%' || chr(65533) || '%'
  LIMIT 1;

  IF v_offering_id IS NOT NULL THEN
    UPDATE public.trade_marketplace_supplier_offerings
    SET    descripcion_comercial = v_new_desc,
           updated_at = now()
    WHERE  id = v_offering_id;

    INSERT INTO public.trade_marketplace_audit_log
      (actor_id, event_type, event_data)
    VALUES (
      '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',
      'offering.description_normalized',
      jsonb_build_object(
        'entity_type',    'supplier_offering',
        'entity_id',      v_offering_id,
        'reason',         'UTF-8 replacement characters from Windows-1252 import',
        'dataset',        'A1_P2_7_repair',
        'previous_value', v_old_desc,
        'new_value',      v_new_desc,
        'supplier_ref',   v_supplier_ref
      )
    );
    RAISE NOTICE 'Reparado %: "%" → "%"', v_supplier_ref, v_old_desc, v_new_desc;
  ELSE
    RAISE NOTICE '% ya reparado o no encontrado — sin cambios.', v_supplier_ref;
  END IF;

END;
$$;
