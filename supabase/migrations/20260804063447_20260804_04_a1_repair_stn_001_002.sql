DO $$
DECLARE
  v_offering_id  uuid;
  v_old_desc     text;
  v_new_desc     text;
  v_supplier_ref text;
BEGIN

  v_supplier_ref := 'STN-FON-001';
  v_new_desc     := 'Grifo monomando lavabo caño alto cromado';

  SELECT id, descripcion_comercial
  INTO   v_offering_id, v_old_desc
  FROM   public.trade_marketplace_supplier_offerings
  WHERE  supplier_ref        = v_supplier_ref
    AND  supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02'
    AND  descripcion_comercial LIKE '%' || chr(65533) || '%'
  LIMIT 1;

  IF v_offering_id IS NOT NULL THEN
    UPDATE public.trade_marketplace_supplier_offerings
    SET    descripcion_comercial = v_new_desc,
           updated_at            = now()
    WHERE  id = v_offering_id;

    INSERT INTO public.trade_marketplace_audit_log
      (actor_id, event_type, event_data)
    VALUES (
      '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',
      'offering.description_normalized',
      jsonb_build_object(
        'entity_type',    'supplier_offering',
        'entity_id',      v_offering_id,
        'reason',         'Manual confirmation: Windows-1252 ñ (0xF1) decoded as U+FFFD',
        'dataset',        'A1_P2_7_repair_confirmed',
        'previous_value', v_old_desc,
        'new_value',      v_new_desc,
        'supplier_ref',   v_supplier_ref
      )
    );
    RAISE NOTICE 'Reparado %', v_supplier_ref;
  ELSE
    RAISE NOTICE '% ya reparado o no encontrado', v_supplier_ref;
  END IF;

  v_supplier_ref := 'STN-FON-002';
  v_new_desc     := 'Grifo monomando lavabo caño bajo cromado';

  SELECT id, descripcion_comercial
  INTO   v_offering_id, v_old_desc
  FROM   public.trade_marketplace_supplier_offerings
  WHERE  supplier_ref        = v_supplier_ref
    AND  supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02'
    AND  descripcion_comercial LIKE '%' || chr(65533) || '%'
  LIMIT 1;

  IF v_offering_id IS NOT NULL THEN
    UPDATE public.trade_marketplace_supplier_offerings
    SET    descripcion_comercial = v_new_desc,
           updated_at            = now()
    WHERE  id = v_offering_id;

    INSERT INTO public.trade_marketplace_audit_log
      (actor_id, event_type, event_data)
    VALUES (
      '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',
      'offering.description_normalized',
      jsonb_build_object(
        'entity_type',    'supplier_offering',
        'entity_id',      v_offering_id,
        'reason',         'Manual confirmation: Windows-1252 ñ (0xF1) decoded as U+FFFD',
        'dataset',        'A1_P2_7_repair_confirmed',
        'previous_value', v_old_desc,
        'new_value',      v_new_desc,
        'supplier_ref',   v_supplier_ref
      )
    );
    RAISE NOTICE 'Reparado %', v_supplier_ref;
  ELSE
    RAISE NOTICE '% ya reparado o no encontrado', v_supplier_ref;
  END IF;

END;
$$;;
