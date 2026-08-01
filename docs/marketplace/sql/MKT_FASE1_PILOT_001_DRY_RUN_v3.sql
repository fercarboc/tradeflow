-- =====================================================================
-- MKT-FASE1-PILOT-001 v4  —  DRY RUN v3 (SELECT-ONLY)
-- =====================================================================
-- Script de solo lectura. No modifica ningún dato.
-- Ejecutar tras aplicar el DDL y antes del DML v4.
--
-- Cambios respecto a DRY RUN v2:
--   · §0: añade verificación del constraint chk_up_origen
--   · §1: verifica lote por doble condición (origen + _batch)
--   · §9: validación explícita del constraint
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- §0  DDL Y CONSTRAINT
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§0_ddl_columna'  AS seccion,
  column_name,
  data_type,
  is_nullable,
  CASE WHEN column_name IS NOT NULL THEN 'DDL APLICADO' ELSE 'DDL PENDIENTE' END AS estado
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'trade_marketplace_universal_product_variants'
  AND column_name  = 'global_catalog_id';
-- Esperado: 1 fila — data_type='uuid', is_nullable='YES'

SELECT
  '§0_ddl_indices' AS seccion,
  indexname,
  CASE
    WHEN indexname = 'uq_variant_global_catalog_id' THEN 'UNIQUE parcial OK'
    WHEN indexname = 'idx_variant_global_catalog_id' THEN 'índice lectura OK'
  END AS estado
FROM pg_indexes
WHERE tablename = 'trade_marketplace_universal_product_variants'
  AND indexname IN ('uq_variant_global_catalog_id','idx_variant_global_catalog_id')
ORDER BY indexname;
-- Esperado: 2 filas

SELECT
  '§0_constraint'   AS seccion,
  conname           AS constraint_name,
  CASE WHEN pg_get_constraintdef(oid) LIKE '%''global_catalog''%'
    THEN 'OK — global_catalog admitido'
    ELSE 'ERROR — global_catalog NO admitido'
  END               AS estado_global_catalog,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.trade_marketplace_universal_products'::regclass
  AND conname  = 'chk_up_origen';
-- Esperado: estado_global_catalog = 'OK — global_catalog admitido'

-- ─────────────────────────────────────────────────────────────────────
-- §1  ESTADO ACTUAL
-- ─────────────────────────────────────────────────────────────────────
SELECT
  'estado_actual'                                                                AS seccion,
  (SELECT count(*) FROM public.trade_marketplace_universal_products)            AS ups_total,
  (SELECT count(*) FROM public.trade_marketplace_universal_products
   WHERE origen='global_catalog' AND especificaciones->>'_batch'='MKT_FASE1_PILOT_001') AS ups_lote_previo,
  (SELECT count(*) FROM public.trade_marketplace_universal_product_variants)    AS variantes_total,
  (SELECT count(*) FROM public.trade_marketplace_universal_product_variants
   WHERE global_catalog_id IS NOT NULL)                                         AS variantes_con_gc,
  (SELECT count(*) FROM public.trade_marketplace_categories)                    AS categorias_total,
  (SELECT count(*) FROM public.trade_marketplace_categories WHERE slug='font-acs') AS font_acs_existe,
  (SELECT category_id   FROM public.trade_marketplace_universal_products WHERE ean='PZ-FON-001') AS pz001_cat_id,
  (SELECT global_catalog_id FROM public.trade_marketplace_universal_products WHERE ean='PZ-FON-001') AS pz001_gc_id;
-- Esperado: ups_lote_previo=0, variantes_con_gc=0, font_acs_existe=0,
--           pz001_cat_id=NULL, pz001_gc_id=NULL

-- ─────────────────────────────────────────────────────────────────────
-- §2  UPs PADRE (11) — INSERT vs. SKIP
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(nombre, oficio) AS (
  VALUES
    ('Tubo cobre','fontaneria'),('Tubo multicapa','fontaneria'),
    ('Tubo PE-100','fontaneria'),('Tubo PVC presión','fontaneria'),
    ('Tubo PVC saneamiento','fontaneria'),('Codo 90° cobre','fontaneria'),
    ('Té cobre','fontaneria'),('Válvula esférica latón','fontaneria'),
    ('Válvula de seguridad','fontaneria'),('Plato de ducha resina','fontaneria'),
    ('Plato de ducha extraplano','fontaneria')
)
SELECT
  '§2_ups_padre'  AS seccion,
  p.nombre,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (ya existe)' ELSE 'INSERT' END AS accion
FROM propuestos p
LEFT JOIN public.trade_marketplace_universal_products up
  ON up.nombre_canonico=p.nombre AND up.oficio=p.oficio
ORDER BY p.nombre;
-- Esperado: 11 filas con accion='INSERT'

-- ─────────────────────────────────────────────────────────────────────
-- §3  UPs DIRECTOS (5) — INSERT vs. SKIP (clave: global_catalog_id)
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(codigo_gc, nombre_canonico) AS (
  VALUES
    ('FON-GRF-BAN','Grifo monomando bañera'),
    ('FON-GRF-COC','Grifo monomando cocina alto'),
    ('FON-GRF-TER-DUC','Kit ducha termostático'),
    ('FON-GRF-LAR','Grifo para lavadero o exterior 1/2 pulgadas'),
    ('FON-SAN-WC-S','Inodoro suspendido con cisterna')
)
SELECT
  '§3_ups_directos' AS seccion,
  p.nombre_canonico,
  gc.id             AS gc_id,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (gc_id ya vinculado)' ELSE 'INSERT' END AS accion
FROM propuestos p
JOIN public.trade_global_catalog gc ON gc.codigo=p.codigo_gc
LEFT JOIN public.trade_marketplace_universal_products up ON up.global_catalog_id=gc.id
ORDER BY p.nombre_canonico;
-- Esperado: 5 filas con accion='INSERT'

-- ─────────────────────────────────────────────────────────────────────
-- §4  UPDATE PZ-FON-001 + INSERT categoría font-acs
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§4_update_y_categoria'    AS seccion,
  'PZ-FON-001'               AS registro,
  nombre_canonico,
  category_id::text          AS valor_actual,
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999' AS valor_nuevo,
  CASE WHEN category_id IS NULL THEN 'UPDATE' ELSE 'SKIP' END AS accion
FROM public.trade_marketplace_universal_products WHERE ean='PZ-FON-001'
UNION ALL
SELECT '§4_update_y_categoria','font-acs','Equipos de agua caliente sanitaria',NULL,
  'db7ddd64-319d-443d-9ddb-0ea332749af5',
  CASE WHEN (SELECT count(*) FROM public.trade_marketplace_categories WHERE slug='font-acs')=0
    THEN 'INSERT' ELSE 'SKIP' END;

-- ─────────────────────────────────────────────────────────────────────
-- §5  VARIANTES (15) — INSERT vs. SKIP (clave: global_catalog_id en variant)
-- ─────────────────────────────────────────────────────────────────────
WITH variantes(up_nombre, variante_nombre, codigo_gc) AS (
  VALUES
    ('Tubo cobre','Tubo cobre 15mm','FON-CU-015'),
    ('Tubo cobre','Tubo cobre 22mm','FON-CU-022'),
    ('Tubo multicapa','Tubo multicapa 16x2mm','FON-MC-016'),
    ('Tubo PE-100','Tubo PE-100 20mm','FON-PE-20'),
    ('Tubo PVC presión','Tubo PVC presión 20mm','FON-PVC-20'),
    ('Tubo PVC saneamiento','Tubo PVC saneamiento 110mm','FON-PVC-S110'),
    ('Codo 90° cobre','Codo 90° cobre 15mm','FON-ACC-C15T'),
    ('Codo 90° cobre','Codo 90° cobre 22mm','FON-ACC-C22T'),
    ('Té cobre','Té cobre 15mm igual','FON-ACC-T15'),
    ('Válvula esférica latón','Válvula esférica latón 1/2 pulgada','FON-VAL-ESF15'),
    ('Válvula esférica latón','Válvula esférica latón 3/4 pulgada','FON-VAL-ESF22'),
    ('Plato de ducha resina','Plato de ducha resina 80x80cm','FON-SAN-DUC-P'),
    ('Plato de ducha resina','Plato de ducha resina 90x90cm','FON-SAN-DUC-P90'),
    ('Válvula de seguridad','Válvula de seguridad 3/4 pulgada 3 bar','FON-VAL-SEG'),
    ('Plato de ducha extraplano','Plato de ducha extraplano 100x70cm','FON-SAN-DUC-PX')
)
SELECT
  '§5_variantes'    AS seccion,
  v.up_nombre,
  v.variante_nombre,
  v.codigo_gc,
  gc.id             AS gc_id,
  CASE
    WHEN up.id IS NULL THEN 'INSERT (UP padre a crear en este lote)'
    WHEN EXISTS (SELECT 1 FROM public.trade_marketplace_universal_product_variants vv WHERE vv.global_catalog_id=gc.id)
      THEN 'SKIP (gc_id ya vinculado a variante)'
    ELSE 'INSERT'
  END AS accion
FROM variantes v
JOIN public.trade_global_catalog gc ON gc.codigo=v.codigo_gc
LEFT JOIN public.trade_marketplace_universal_products up ON up.nombre_canonico=v.up_nombre AND up.oficio='fontaneria'
ORDER BY v.up_nombre, v.variante_nombre;
-- Esperado: 15 filas con accion IN ('INSERT','INSERT (UP padre a crear en este lote)')

-- ─────────────────────────────────────────────────────────────────────
-- §6  RESULTADO ESPERADO ANTES/DESPUÉS
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§6_resumen'  AS seccion,
  tabla, antes, delta, antes+delta AS despues_esperado
FROM (VALUES
  ('trade_marketplace_universal_products',         6, 16),
  ('trade_marketplace_universal_product_variants', 0, 15),
  ('trade_marketplace_categories',                25,  1)
) AS t(tabla,antes,delta)
ORDER BY tabla;

-- ─────────────────────────────────────────────────────────────────────
-- §7  CATEGORÍAS OBJETIVO
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§7_cats_objetivo' AS seccion,
  slug, nombre, id, 'OK' AS estado
FROM public.trade_marketplace_categories
WHERE id IN (
  '3c629d1b-571d-44df-8f0e-8de7259f4f25',
  'd19b757a-d45c-4702-be34-b31bb8d56ec6',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',
  'db7ddd64-319d-443d-9ddb-0ea332749af5'
)
ORDER BY slug;
-- Esperado: 5 filas

-- ─────────────────────────────────────────────────────────────────────
-- §8  COBERTURA GC — 40 REGISTROS DEL PILOTO
-- ─────────────────────────────────────────────────────────────────────
WITH pilot_gc(codigo, tipo) AS (
  VALUES
    ('FON-GRF-LAV','directo'),('FON-GRF-BAN','directo'),
    ('FON-GRF-COC','directo'),('FON-GRF-TER-DUC','directo'),
    ('FON-GRF-LAR','directo'),('FON-SAN-WC-S','directo'),
    ('FON-CU-015','variante'),('FON-CU-022','variante'),
    ('FON-MC-016','variante'),('FON-PE-20','variante'),
    ('FON-PVC-20','variante'),('FON-PVC-S110','variante'),
    ('FON-ACC-C15T','variante'),('FON-ACC-C22T','variante'),
    ('FON-ACC-T15','variante'),('FON-VAL-ESF15','variante'),
    ('FON-VAL-ESF22','variante'),('FON-SAN-DUC-P','variante'),
    ('FON-SAN-DUC-P90','variante'),('FON-VAL-SEG','variante'),
    ('FON-SAN-DUC-PX','variante'),
    ('FON-MO-OF','nc'),('FON-MO-AYU','nc'),('FON-MO-OFI','nc'),
    ('FON-MO-GUAR','nc'),('FON-MO-DES','nc'),
    ('FON-INS-BANO','nc'),('FON-INS-CAL','nc'),('FON-INS-WCS','nc'),
    ('FON-INS-LAVT','nc'),('FON-INS-DUC','nc'),('FON-INS-TERM','nc'),
    ('FON-INS-ACOM','nc'),('FON-INS-LLAVE','nc'),
    ('FON-MAN-DESH','nc'),('FON-MAN-DESM','nc'),('FON-MAN-DES','nc'),
    ('FON-MAN-DETF','nc'),('FON-MAN-JUN','nc'),('FON-MAN-SIF','nc')
)
SELECT
  '§8_resumen_cobertura'              AS seccion,
  tipo                                AS categoria,
  count(*)                            AS gc_count,
  CASE tipo
    WHEN 'directo'  THEN 'gc_record → UP.global_catalog_id'
    WHEN 'variante' THEN 'gc_record → variant.global_catalog_id'
    WHEN 'nc'       THEN 'excluido del marketplace'
  END                                 AS mecanismo
FROM pilot_gc
GROUP BY tipo ORDER BY tipo DESC;
-- Esperado: directo=6, variante=15, nc=19

-- ─────────────────────────────────────────────────────────────────────
-- §9  VALIDACIÓN CONSTRAINT chk_up_origen
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§9_constraint_check'  AS seccion,
  CASE
    WHEN count(*) > 0 THEN 'OK — global_catalog es valor admitido'
    ELSE 'ERROR — global_catalog NO está en chk_up_origen'
  END AS estado,
  count(*) AS constraint_encontrado
FROM pg_constraint
WHERE conrelid = 'public.trade_marketplace_universal_products'::regclass
  AND conname  = 'chk_up_origen'
  AND pg_get_constraintdef(oid) LIKE '%''global_catalog''%';
-- Esperado: estado='OK — global_catalog es valor admitido', constraint_encontrado=1

-- ─────────────────────────────────────────────────────────────────────
-- §10  VALIDACIÓN ÍNDICES EAN/GTIN (VARIANT_IDENTIFIERS_FIX)
-- ─────────────────────────────────────────────────────────────────────
-- Verifica que los constraints NULLS NOT DISTINCT fueron eliminados
-- y reemplazados por índices únicos parciales (WHERE columna IS NOT NULL).
-- Debe ejecutarse DESPUÉS de VARIANT_IDENTIFIERS_FIX.sql.

SELECT
  '§10_constraints_eliminados' AS seccion,
  CASE WHEN count(*) = 0
    THEN 'OK — constraints NULLS NOT DISTINCT eliminados'
    ELSE 'ERROR — constraints NULLS NOT DISTINCT aún existen (' || count(*) || ')'
  END AS estado,
  count(*) AS constraints_nulls_not_distinct
FROM pg_constraint
WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
  AND conname IN ('uq_variant_ean','uq_variant_gtin');
-- Esperado: constraints_nulls_not_distinct=0

SELECT
  '§10_indices_parciales'  AS seccion,
  indexname,
  CASE
    WHEN indexdef LIKE '%WHERE%' AND indexdef NOT LIKE '%NULLS NOT DISTINCT%'
      THEN 'OK — índice parcial correcto'
    ELSE 'ERROR — definición incorrecta'
  END AS estado,
  indexdef
FROM pg_indexes
WHERE tablename = 'trade_marketplace_universal_product_variants'
  AND indexname IN ('uq_variant_ean_notnull','uq_variant_gtin_notnull')
ORDER BY indexname;
-- Esperado: 2 filas, estado='OK — índice parcial correcto'
