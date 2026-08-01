-- =====================================================================
-- MKT-FASE1-PILOT-001 v4  —  Lote piloto fontanería
-- =====================================================================
-- Alcance:   1 categoría nueva · 16 UPs nuevos · 1 UP actualizado
--            15 variantes nuevas (con vínculo global_catalog_id)
--
-- origen = 'global_catalog'   → procedencia funcional (desde trade_global_catalog)
-- _batch  = 'MKT_FASE1_PILOT_001'  → trazabilidad de migración (en especificaciones)
--
-- Single-run: protegida contra reejecución y estado parcial
-- Transacción única: BEGIN … COMMIT
-- Prerequisito: DDL (MKT_FASE1_PILOT_001_DDL.sql) aplicado y DRY RUN v3 sin errores
-- NO ejecutar sin aprobación humana explícita
-- =====================================================================
--
-- SNAPSHOT PREVIO VERIFICADO (DRY RUN 2026-08-01):
--   trade_marketplace_universal_products         : 6
--   trade_marketplace_universal_product_variants : 0
--   trade_marketplace_categories                 : 25
--   font-acs existe                              : false
--   PZ-FON-001 category_id                       : NULL
--   PZ-FON-001 global_catalog_id                 : NULL
--
-- ESTADO ESPERADO TRAS COMMIT:
--   trade_marketplace_universal_products         : 22  (+16)
--   trade_marketplace_universal_product_variants : 15  (+15, con global_catalog_id)
--   trade_marketplace_categories                 : 26  (+1)
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 0  PRE-VALIDACIONES (0-A a 0-K)
-- ─────────────────────────────────────────────────────────────────────
DO $pre$
DECLARE
  v_count integer;
  v_gc    text;
BEGIN

  -- 0-A: Códigos gc de UPs directos existen exactamente una vez
  FOREACH v_gc IN ARRAY ARRAY[
    'FON-GRF-LAV','FON-GRF-BAN','FON-GRF-COC',
    'FON-GRF-TER-DUC','FON-GRF-LAR','FON-SAN-WC-S'
  ] LOOP
    SELECT count(*) INTO v_count FROM public.trade_global_catalog WHERE codigo = v_gc;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-A]: % tiene % ocurrencias (esperado: 1)', v_gc, v_count;
    END IF;
  END LOOP;

  -- 0-B: PZ-FON-001 existe exactamente una vez
  SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_products WHERE ean = 'PZ-FON-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PRE-VALIDATION [0-B]: PZ-FON-001 tiene % ocurrencias (esperado: 1)', v_count;
  END IF;

  -- 0-C: Ninguno de los 11 UPs padre existe ya (clave: nombre_canonico + oficio)
  FOREACH v_gc IN ARRAY ARRAY[
    'Tubo cobre','Tubo multicapa','Tubo PE-100','Tubo PVC presión',
    'Tubo PVC saneamiento','Codo 90° cobre','Té cobre',
    'Válvula esférica latón','Válvula de seguridad',
    'Plato de ducha resina','Plato de ducha extraplano'
  ] LOOP
    SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_products
    WHERE nombre_canonico = v_gc AND oficio = 'fontaneria';
    IF v_count > 0 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-C]: UP padre "%" ya existe', v_gc;
    END IF;
  END LOOP;

  -- 0-D: Ninguno de los 5 UPs directos nuevos existe ya (clave: global_catalog_id)
  FOR v_gc IN
    SELECT gc.id::text FROM public.trade_global_catalog gc
    WHERE gc.codigo IN ('FON-GRF-BAN','FON-GRF-COC','FON-GRF-TER-DUC','FON-GRF-LAR','FON-SAN-WC-S')
  LOOP
    SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_products WHERE global_catalog_id = v_gc::uuid;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-D]: global_catalog_id % ya vinculado a UP', v_gc;
    END IF;
  END LOOP;

  -- 0-E: Las cinco categorías objetivo existen
  FOREACH v_gc IN ARRAY ARRAY[
    '3c629d1b-571d-44df-8f0e-8de7259f4f25',
    'd19b757a-d45c-4702-be34-b31bb8d56ec6',
    '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',
    '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',
    'db7ddd64-319d-443d-9ddb-0ea332749af5'
  ] LOOP
    SELECT count(*) INTO v_count FROM public.trade_marketplace_categories WHERE id = v_gc::uuid;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-E]: categoría % no existe', v_gc;
    END IF;
  END LOOP;

  -- 0-F: font-acs no existe todavía
  SELECT count(*) INTO v_count FROM public.trade_marketplace_categories WHERE slug = 'font-acs';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'PRE-VALIDATION [0-F]: slug font-acs ya existe (¿migración ya aplicada?)';
  END IF;

  -- 0-G: No hay lote previo aplicado parcialmente
  -- Clave de identificación: origen='global_catalog' AND especificaciones->''_batch'' = 'MKT_FASE1_PILOT_001'
  SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_products
  WHERE origen = 'global_catalog'
    AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'PRE-VALIDATION [0-G]: % UPs del lote MKT_FASE1_PILOT_001 ya existen. '
      'Esta migración es single-run. Usar ROLLBACK v4 antes de reintentar.', v_count;
  END IF;

  -- 0-H: Los 15 códigos gc de variantes existen exactamente una vez
  FOREACH v_gc IN ARRAY ARRAY[
    'FON-CU-015','FON-CU-022','FON-MC-016','FON-PE-20','FON-PVC-20',
    'FON-PVC-S110','FON-ACC-C15T','FON-ACC-C22T','FON-ACC-T15',
    'FON-VAL-ESF15','FON-VAL-ESF22','FON-SAN-DUC-P','FON-SAN-DUC-P90',
    'FON-VAL-SEG','FON-SAN-DUC-PX'
  ] LOOP
    SELECT count(*) INTO v_count FROM public.trade_global_catalog WHERE codigo = v_gc;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-H]: código gc % tiene % ocurrencias (esperado: 1)', v_gc, v_count;
    END IF;
  END LOOP;

  -- 0-I: Ningún gc_id de variante está ya vinculado a una variante existente
  FOR v_gc IN
    SELECT gc.id::text FROM public.trade_global_catalog gc
    WHERE gc.codigo IN (
      'FON-CU-015','FON-CU-022','FON-MC-016','FON-PE-20','FON-PVC-20',
      'FON-PVC-S110','FON-ACC-C15T','FON-ACC-C22T','FON-ACC-T15',
      'FON-VAL-ESF15','FON-VAL-ESF22','FON-SAN-DUC-P','FON-SAN-DUC-P90',
      'FON-VAL-SEG','FON-SAN-DUC-PX'
    )
  LOOP
    SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id = v_gc::uuid;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'PRE-VALIDATION [0-I]: gc_id % ya vinculado a variante existente', v_gc;
    END IF;
  END LOOP;

  -- 0-J: La columna global_catalog_id existe en la tabla de variantes (DDL aplicado)
  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trade_marketplace_universal_product_variants'
    AND column_name  = 'global_catalog_id';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRE-VALIDATION [0-J]: columna global_catalog_id no existe en variants. Aplicar DDL primero.';
  END IF;

  -- 0-K: 'global_catalog' es un valor admitido por chk_up_origen
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_products'::regclass
    AND conname   = 'chk_up_origen'
    AND pg_get_constraintdef(oid) LIKE '%''global_catalog''%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRE-VALIDATION [0-K]: ''global_catalog'' no está en chk_up_origen. '
      'Revisar el constraint antes de continuar.';
  END IF;

  RAISE NOTICE 'PRE-VALIDACIONES (0-A a 0-K): todas superadas.';
END $pre$;

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 1  SNAPSHOT PZ-FON-001
-- ─────────────────────────────────────────────────────────────────────
DO $snap$
DECLARE r record;
BEGIN
  SELECT ean, nombre_canonico, category_id, global_catalog_id,
         validation_state, es_generico, oficio
  INTO r FROM public.trade_marketplace_universal_products WHERE ean = 'PZ-FON-001';
  RAISE NOTICE 'SNAPSHOT PZ-FON-001 — ean:% nombre:% category_id:% gc_id:% state:% generico:% oficio:%',
    r.ean, r.nombre_canonico, r.category_id, r.global_catalog_id,
    r.validation_state, r.es_generico, r.oficio;
END $snap$;

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 2  NUEVA CATEGORÍA
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id)
SELECT 'Equipos de agua caliente sanitaria','font-acs','db7ddd64-319d-443d-9ddb-0ea332749af5'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_categories WHERE slug = 'font-acs');

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 3  UPs PADRE — 11 genéricos
-- origen = 'global_catalog'  (procedencia: trade_global_catalog)
-- _batch  = 'MKT_FASE1_PILOT_001'  (trazabilidad de migración)
-- Idempotencia: WHERE NOT EXISTS por nombre_canonico + oficio
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Tubo cobre','fontaneria','Tubería','ml','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"cobre","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Tubo cobre' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Tubo multicapa','fontaneria','Tubería','ml','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"multicapa","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Tubo multicapa' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Tubo PE-100','fontaneria','Tubería','ml','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"PE-100","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Tubo PE-100' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Tubo PVC presión','fontaneria','Tubería','ml','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"PVC","uso":"presión","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Tubo PVC presión' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Tubo PVC saneamiento','fontaneria','Saneamiento','ml','d19b757a-d45c-4702-be34-b31bb8d56ec6',true,'draft','global_catalog',
  '{"material":"PVC","uso":"saneamiento","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Tubo PVC saneamiento' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Codo 90° cobre','fontaneria','Accesorios','ud','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"cobre","angulo":"90°","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Codo 90° cobre' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Té cobre','fontaneria','Accesorios','ud','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"cobre","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Té cobre' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Válvula esférica latón','fontaneria','Válvulas','ud','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"material":"latón","tipo":"esférica","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Válvula esférica latón' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Válvula de seguridad','fontaneria','Válvulas','ud','3c629d1b-571d-44df-8f0e-8de7259f4f25',true,'draft','global_catalog',
  '{"tipo":"seguridad","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Válvula de seguridad' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Plato de ducha resina','fontaneria','Sanitarios','ud','671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',true,'draft','global_catalog',
  '{"material":"resina","forma":"cuadrado","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Plato de ducha resina' AND oficio='fontaneria');

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,especificaciones)
SELECT 'Plato de ducha extraplano','fontaneria','Sanitarios','ud','671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',true,'draft','global_catalog',
  '{"forma":"rectangular","perfil":"extraplano","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE nombre_canonico='Plato de ducha extraplano' AND oficio='fontaneria');

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 4  UPs DIRECTOS — 5 nuevos
-- Clave lógica de idempotencia: global_catalog_id
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,global_catalog_id,especificaciones)
SELECT 'Grifo monomando bañera','fontaneria','Grifería','ud','9ea5bf24-67f7-4e8e-91ba-10ed279f3999',false,'draft','global_catalog',
  gc.id,'{"tipo":"monomando","uso":"bañera","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
FROM public.trade_global_catalog gc WHERE gc.codigo='FON-GRF-BAN'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,global_catalog_id,especificaciones)
SELECT 'Grifo monomando cocina alto','fontaneria','Grifería','ud','9ea5bf24-67f7-4e8e-91ba-10ed279f3999',false,'draft','global_catalog',
  gc.id,'{"tipo":"monomando","uso":"cocina","caño":"alto","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
FROM public.trade_global_catalog gc WHERE gc.codigo='FON-GRF-COC'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,global_catalog_id,especificaciones)
SELECT 'Kit ducha termostático','fontaneria','Grifería','ud','9ea5bf24-67f7-4e8e-91ba-10ed279f3999',false,'draft','global_catalog',
  gc.id,'{"tipo":"termostático","componentes":"kit completo","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
FROM public.trade_global_catalog gc WHERE gc.codigo='FON-GRF-TER-DUC'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,global_catalog_id,especificaciones)
SELECT 'Grifo para lavadero o exterior 1/2 pulgadas','fontaneria','Grifería','ud','9ea5bf24-67f7-4e8e-91ba-10ed279f3999',false,'draft','global_catalog',
  gc.id,'{"conexion":"1/2 pulgada","uso":"lavadero o exterior","_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
FROM public.trade_global_catalog gc WHERE gc.codigo='FON-GRF-LAR'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico,oficio,familia,unidad,category_id,es_generico,validation_state,origen,global_catalog_id,especificaciones)
SELECT 'Inodoro suspendido con cisterna','fontaneria','Sanitarios','ud','671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',false,'draft','global_catalog',
  gc.id,'{"instalacion":"suspendido","incluye_cisterna":true,"_batch":"MKT_FASE1_PILOT_001","_classification":"human_reviewed","_reviewed_at":"2026-08-01"}'
FROM public.trade_global_catalog gc WHERE gc.codigo='FON-SAN-WC-S'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id);

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 5  ACTUALIZAR PZ-FON-001
-- Snapshot verificado: category_id = NULL, global_catalog_id = NULL
-- Idempotencia: AND category_id IS NULL
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.trade_marketplace_universal_products
SET
  category_id       = '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',
  global_catalog_id = (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-GRF-LAV' LIMIT 1),
  updated_at        = now()
WHERE ean = 'PZ-FON-001'
  AND category_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 6  VARIANTES — 15 variantes con global_catalog_id
-- Clave lógica de idempotencia: global_catalog_id en variant
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo cobre 15mm','{"diametro":"15 mm","material":"cobre"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-CU-015') gc
WHERE p.nombre_canonico='Tubo cobre' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo cobre 22mm','{"diametro":"22 mm","material":"cobre"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-CU-022') gc
WHERE p.nombre_canonico='Tubo cobre' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo multicapa 16x2mm','{"diametro":"16x2 mm","material":"multicapa"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-MC-016') gc
WHERE p.nombre_canonico='Tubo multicapa' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo PE-100 20mm','{"diametro":"20 mm","material":"PE-100"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-PE-20') gc
WHERE p.nombre_canonico='Tubo PE-100' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo PVC presión 20mm','{"diametro":"20 mm","material":"PVC","uso":"presión"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-PVC-20') gc
WHERE p.nombre_canonico='Tubo PVC presión' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Tubo PVC saneamiento 110mm','{"diametro":"110 mm","material":"PVC","uso":"saneamiento"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-PVC-S110') gc
WHERE p.nombre_canonico='Tubo PVC saneamiento' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Codo 90° cobre 15mm','{"diametro":"15 mm","material":"cobre","angulo":"90°"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-ACC-C15T') gc
WHERE p.nombre_canonico='Codo 90° cobre' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Codo 90° cobre 22mm','{"diametro":"22 mm","material":"cobre","angulo":"90°"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-ACC-C22T') gc
WHERE p.nombre_canonico='Codo 90° cobre' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Té cobre 15mm igual','{"diametro":"15 mm","material":"cobre","tipo":"igual"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-ACC-T15') gc
WHERE p.nombre_canonico='Té cobre' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Válvula esférica latón 1/2 pulgada','{"conexion":"1/2 pulgada","material":"latón"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-VAL-ESF15') gc
WHERE p.nombre_canonico='Válvula esférica latón' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Válvula esférica latón 3/4 pulgada','{"conexion":"3/4 pulgada","material":"latón"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-VAL-ESF22') gc
WHERE p.nombre_canonico='Válvula esférica latón' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Plato de ducha resina 80x80cm','{"dimensiones":"80x80 cm","material":"resina","forma":"cuadrado"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-SAN-DUC-P') gc
WHERE p.nombre_canonico='Plato de ducha resina' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Plato de ducha resina 90x90cm','{"dimensiones":"90x90 cm","material":"resina","forma":"cuadrado"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-SAN-DUC-P90') gc
WHERE p.nombre_canonico='Plato de ducha resina' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Válvula de seguridad 3/4 pulgada 3 bar','{"conexion":"3/4 pulgada","presion_max":"3 bar"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-VAL-SEG') gc
WHERE p.nombre_canonico='Válvula de seguridad' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

INSERT INTO public.trade_marketplace_universal_product_variants (universal_product_id,nombre,atributos,activa,global_catalog_id)
SELECT p.id,'Plato de ducha extraplano 100x70cm','{"dimensiones":"100x70 cm","forma":"rectangular"}',true,gc.id
FROM public.trade_marketplace_universal_products p
CROSS JOIN (SELECT id FROM public.trade_global_catalog WHERE codigo='FON-SAN-DUC-PX') gc
WHERE p.nombre_canonico='Plato de ducha extraplano' AND p.oficio='fontaneria'
  AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id);

-- ─────────────────────────────────────────────────────────────────────
-- BLOQUE 7  POST-VALIDACIONES (7-A a 7-L)
-- ─────────────────────────────────────────────────────────────────────
DO $post$
DECLARE
  v_ups_nuevos   integer;
  v_ups_cat_null integer;
  v_pz001_ok     integer;
  v_variantes    integer;
  v_gc_dup       integer;
  v_nc_como_up   integer;
  v_dup_logicos  integer;
BEGIN

  -- 7-A: Exactamente 16 UPs nuevos con marcador de lote
  SELECT count(*) INTO v_ups_nuevos FROM public.trade_marketplace_universal_products
  WHERE origen = 'global_catalog' AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001';
  IF v_ups_nuevos <> 16 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-A]: se esperaban 16 UPs nuevos, hay %', v_ups_nuevos;
  END IF;

  -- 7-B: PZ-FON-001 actualizado correctamente
  SELECT count(*) INTO v_pz001_ok FROM public.trade_marketplace_universal_products
  WHERE ean='PZ-FON-001' AND category_id IS NOT NULL AND global_catalog_id IS NOT NULL;
  IF v_pz001_ok <> 1 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-B]: PZ-FON-001 no fue actualizado correctamente';
  END IF;

  -- 7-C: Exactamente 15 variantes vinculadas a UPs del lote
  SELECT count(*) INTO v_variantes
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id=v.universal_product_id
  WHERE p.origen='global_catalog' AND p.especificaciones->>'_batch'='MKT_FASE1_PILOT_001';
  IF v_variantes <> 15 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-C]: se esperaban 15 variantes, hay %', v_variantes;
  END IF;

  -- 7-D: Todos los UPs del lote tienen category_id no nulo
  SELECT count(*) INTO v_ups_cat_null FROM public.trade_marketplace_universal_products
  WHERE origen='global_catalog' AND especificaciones->>'_batch'='MKT_FASE1_PILOT_001' AND category_id IS NULL;
  IF v_ups_cat_null > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-D]: % UPs del lote tienen category_id NULL', v_ups_cat_null;
  END IF;

  -- 7-E: global_catalog_id sin duplicados en UPs (tabla completa, excluyendo NULLs)
  SELECT count(*) INTO v_gc_dup FROM (
    SELECT global_catalog_id,count(*) FROM public.trade_marketplace_universal_products
    WHERE global_catalog_id IS NOT NULL GROUP BY global_catalog_id HAVING count(*)>1
  ) dup;
  IF v_gc_dup > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-E]: % global_catalog_id duplicados entre UPs', v_gc_dup;
  END IF;

  -- 7-F: Ninguna partida NC convertida en UP
  SELECT count(*) INTO v_nc_como_up FROM public.trade_marketplace_universal_products up
  JOIN public.trade_global_catalog gc ON gc.id=up.global_catalog_id
  WHERE gc.familia IN ('Instalaciones','Mantenimiento','Mano de obra') AND gc.oficio='Fontanería';
  IF v_nc_como_up > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-F]: % partidas NC convertidas en UP', v_nc_como_up;
  END IF;

  -- 7-G: Cero duplicados lógicos (nombre_canonico + oficio únicos, tabla completa)
  SELECT count(*) INTO v_dup_logicos FROM (
    SELECT nombre_canonico,oficio,count(*) FROM public.trade_marketplace_universal_products
    GROUP BY nombre_canonico,oficio HAVING count(*)>1
  ) dup;
  IF v_dup_logicos > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-G]: % duplicados lógicos en UPs', v_dup_logicos;
  END IF;

  -- 7-H: Las 15 variantes del lote tienen global_catalog_id no nulo
  SELECT count(*) INTO v_ups_cat_null
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id=v.universal_product_id
  WHERE p.origen='global_catalog' AND p.especificaciones->>'_batch'='MKT_FASE1_PILOT_001'
    AND v.global_catalog_id IS NULL;
  IF v_ups_cat_null > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-H]: % variantes del lote tienen global_catalog_id NULL', v_ups_cat_null;
  END IF;

  -- 7-I: Sin global_catalog_id duplicados en variantes (tabla completa)
  SELECT count(*) INTO v_gc_dup FROM (
    SELECT global_catalog_id,count(*) FROM public.trade_marketplace_universal_product_variants
    WHERE global_catalog_id IS NOT NULL GROUP BY global_catalog_id HAVING count(*)>1
  ) dup;
  IF v_gc_dup > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-I]: % gc_ids duplicados entre variantes', v_gc_dup;
  END IF;

  -- 7-J: Cada gc directo del piloto tiene un UP vinculado (6 códigos)
  SELECT count(*) INTO v_gc_dup FROM public.trade_global_catalog gc
  WHERE gc.codigo IN ('FON-GRF-LAV','FON-GRF-BAN','FON-GRF-COC','FON-GRF-TER-DUC','FON-GRF-LAR','FON-SAN-WC-S')
    AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products up WHERE up.global_catalog_id=gc.id);
  IF v_gc_dup > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-J]: % gc directos del piloto sin UP vinculado', v_gc_dup;
  END IF;

  -- 7-K: Cada gc de variante del piloto tiene una variante vinculada (15 códigos)
  SELECT count(*) INTO v_gc_dup FROM public.trade_global_catalog gc
  WHERE gc.codigo IN (
    'FON-CU-015','FON-CU-022','FON-MC-016','FON-PE-20','FON-PVC-20',
    'FON-PVC-S110','FON-ACC-C15T','FON-ACC-C22T','FON-ACC-T15',
    'FON-VAL-ESF15','FON-VAL-ESF22','FON-SAN-DUC-P','FON-SAN-DUC-P90',
    'FON-VAL-SEG','FON-SAN-DUC-PX'
  )
    AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants v WHERE v.global_catalog_id=gc.id);
  IF v_gc_dup > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-K]: % gc de variantes del piloto sin variante vinculada', v_gc_dup;
  END IF;

  -- 7-L: Las 19 partidas NC no tienen relación marketplace
  SELECT count(*) INTO v_nc_como_up FROM public.trade_global_catalog gc
  WHERE gc.codigo IN (
    'FON-MO-OF','FON-MO-AYU','FON-MO-OFI','FON-MO-GUAR','FON-MO-DES',
    'FON-INS-BANO','FON-INS-CAL','FON-INS-WCS','FON-INS-LAVT','FON-INS-DUC',
    'FON-INS-TERM','FON-INS-ACOM','FON-INS-LLAVE',
    'FON-MAN-DESH','FON-MAN-DESM','FON-MAN-DES','FON-MAN-DETF','FON-MAN-JUN','FON-MAN-SIF'
  )
    AND (
      EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products WHERE global_catalog_id=gc.id)
      OR EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants WHERE global_catalog_id=gc.id)
    );
  IF v_nc_como_up > 0 THEN
    RAISE EXCEPTION 'POST-VALIDATION [7-L]: % partidas NC con relación marketplace', v_nc_como_up;
  END IF;

  RAISE NOTICE 'POST-VALIDACIONES (7-A a 7-L): todas superadas. UPs nuevos:%, PZ-FON-001:%, variantes:%',
    v_ups_nuevos, v_pz001_ok, v_variantes;
END $post$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN MANUAL POST-COMMIT
-- ─────────────────────────────────────────────────────────────────────
-- SELECT count(*) FROM public.trade_marketplace_universal_products;           -- 22
-- SELECT count(*) FROM public.trade_marketplace_universal_product_variants;   -- 15
-- SELECT count(*) FROM public.trade_marketplace_categories;                   -- 26
-- SELECT nombre_canonico, category_id, global_catalog_id, especificaciones->>'_batch'
--   FROM public.trade_marketplace_universal_products
--   WHERE origen='global_catalog' AND especificaciones->>'_batch'='MKT_FASE1_PILOT_001'
--   ORDER BY nombre_canonico;
-- SELECT v.nombre, v.global_catalog_id, gc.codigo
--   FROM public.trade_marketplace_universal_product_variants v
--   JOIN public.trade_marketplace_universal_products p ON p.id=v.universal_product_id
--   JOIN public.trade_global_catalog gc ON gc.id=v.global_catalog_id
--   WHERE p.origen='global_catalog' AND p.especificaciones->>'_batch'='MKT_FASE1_PILOT_001'
--   ORDER BY v.nombre;
