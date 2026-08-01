-- =====================================================================
-- MKT-FASE1-PILOT-001 v3  —  DRY RUN v2 (SELECT-ONLY)
-- =====================================================================
-- Script de solo lectura. No modifica ningún dato.
-- Ejecutar tras aplicar el DDL y antes del DML v3.
-- Confirma que cada operación producirá el resultado esperado
-- e incluye informe de cobertura gc para los 40 registros del piloto.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- §0  VERIFICAR DDL APLICADO
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§0_ddl_check'   AS seccion,
  column_name,
  data_type,
  is_nullable,
  CASE WHEN column_name IS NOT NULL THEN 'DDL APLICADO' ELSE 'DDL PENDIENTE' END AS estado
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'trade_marketplace_universal_product_variants'
  AND column_name  = 'global_catalog_id';
-- Esperado: 1 fila con data_type = 'uuid', is_nullable = 'YES'
-- Si 0 filas → ejecutar MKT_FASE1_PILOT_001_DDL.sql antes de continuar

SELECT
  '§0_ddl_indexes' AS seccion,
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

-- ─────────────────────────────────────────────────────────────────────
-- §1  ESTADO ACTUAL DE LA BASE DE DATOS
-- ─────────────────────────────────────────────────────────────────────
SELECT
  'estado_actual'                                                                AS seccion,
  (SELECT count(*) FROM public.trade_marketplace_universal_products)            AS ups_total,
  (SELECT count(*) FROM public.trade_marketplace_universal_products
   WHERE origen = 'pilot_fontaneria_2026_08_01')                                AS ups_lote_previo,
  (SELECT count(*) FROM public.trade_marketplace_universal_product_variants)    AS variantes_total,
  (SELECT count(*) FROM public.trade_marketplace_universal_product_variants
   WHERE global_catalog_id IS NOT NULL)                                         AS variantes_con_gc,
  (SELECT count(*) FROM public.trade_marketplace_categories)                    AS categorias_total,
  (SELECT count(*) FROM public.trade_marketplace_categories
   WHERE slug = 'font-acs')                                                     AS font_acs_existe,
  (SELECT category_id FROM public.trade_marketplace_universal_products
   WHERE ean = 'PZ-FON-001')                                                    AS pz001_category_id,
  (SELECT global_catalog_id FROM public.trade_marketplace_universal_products
   WHERE ean = 'PZ-FON-001')                                                    AS pz001_gc_id;
-- Esperado: ups_lote_previo=0, variantes_con_gc=0, font_acs_existe=0,
--           pz001_category_id=NULL, pz001_gc_id=NULL

-- ─────────────────────────────────────────────────────────────────────
-- §2  UPs PADRE (11) — INSERT vs. SKIP
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(nombre, oficio, familia, unidad, cat_slug) AS (
  VALUES
    ('Tubo cobre',               'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo multicapa',           'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PE-100',              'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PVC presión',         'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PVC saneamiento',     'fontaneria','Saneamiento','ml', 'font-desague'),
    ('Codo 90° cobre',           'fontaneria','Accesorios', 'ud', 'font-tuberias'),
    ('Té cobre',                 'fontaneria','Accesorios', 'ud', 'font-tuberias'),
    ('Válvula esférica latón',   'fontaneria','Válvulas',   'ud', 'font-tuberias'),
    ('Válvula de seguridad',     'fontaneria','Válvulas',   'ud', 'font-tuberias'),
    ('Plato de ducha resina',    'fontaneria','Sanitarios', 'ud', 'font-sanitarios'),
    ('Plato de ducha extraplano','fontaneria','Sanitarios', 'ud', 'font-sanitarios')
)
SELECT
  '§2_ups_padre'    AS seccion,
  p.nombre,
  p.familia,
  p.unidad,
  p.cat_slug,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (ya existe)' ELSE 'INSERT' END AS accion
FROM propuestos p
LEFT JOIN public.trade_marketplace_universal_products up
  ON up.nombre_canonico = p.nombre AND up.oficio = p.oficio
ORDER BY p.nombre;
-- Esperado: 11 filas con accion = 'INSERT'

-- ─────────────────────────────────────────────────────────────────────
-- §3  UPs DIRECTOS (5) — INSERT vs. SKIP (clave: global_catalog_id)
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(codigo_gc, nombre_canonico, familia, cat_slug) AS (
  VALUES
    ('FON-GRF-BAN',     'Grifo monomando bañera',                       'Grifería',  'font-griferias'),
    ('FON-GRF-COC',     'Grifo monomando cocina alto',                  'Grifería',  'font-griferias'),
    ('FON-GRF-TER-DUC', 'Kit ducha termostático',                        'Grifería',  'font-griferias'),
    ('FON-GRF-LAR',     'Grifo para lavadero o exterior 1/2 pulgadas',  'Grifería',  'font-griferias'),
    ('FON-SAN-WC-S',    'Inodoro suspendido con cisterna',              'Sanitarios','font-sanitarios')
)
SELECT
  '§3_ups_directos'  AS seccion,
  p.nombre_canonico,
  p.familia,
  p.cat_slug,
  gc.id              AS gc_id,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (gc_id ya vinculado)' ELSE 'INSERT' END AS accion
FROM propuestos p
JOIN public.trade_global_catalog gc ON gc.codigo = p.codigo_gc
LEFT JOIN public.trade_marketplace_universal_products up ON up.global_catalog_id = gc.id
ORDER BY p.nombre_canonico;
-- Esperado: 5 filas con accion = 'INSERT'

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
FROM public.trade_marketplace_universal_products
WHERE ean = 'PZ-FON-001'
UNION ALL
SELECT
  '§4_update_y_categoria',
  'font-acs',
  'Equipos de agua caliente sanitaria',
  NULL,
  'db7ddd64-319d-443d-9ddb-0ea332749af5',
  CASE WHEN (SELECT count(*) FROM public.trade_marketplace_categories WHERE slug = 'font-acs') = 0
    THEN 'INSERT' ELSE 'SKIP' END;
-- Esperado: PZ-FON-001 → UPDATE, font-acs → INSERT

-- ─────────────────────────────────────────────────────────────────────
-- §5  VARIANTES (15) — INSERT vs. SKIP (clave: global_catalog_id en variant)
-- ─────────────────────────────────────────────────────────────────────
WITH variantes(up_nombre, variante_nombre, codigo_gc) AS (
  VALUES
    ('Tubo cobre',              'Tubo cobre 15mm',                        'FON-CU-015'),
    ('Tubo cobre',              'Tubo cobre 22mm',                        'FON-CU-022'),
    ('Tubo multicapa',          'Tubo multicapa 16x2mm',                  'FON-MC-016'),
    ('Tubo PE-100',             'Tubo PE-100 20mm',                       'FON-PE-20'),
    ('Tubo PVC presión',        'Tubo PVC presión 20mm',                  'FON-PVC-20'),
    ('Tubo PVC saneamiento',    'Tubo PVC saneamiento 110mm',             'FON-PVC-S110'),
    ('Codo 90° cobre',          'Codo 90° cobre 15mm',                    'FON-ACC-C15T'),
    ('Codo 90° cobre',          'Codo 90° cobre 22mm',                    'FON-ACC-C22T'),
    ('Té cobre',                'Té cobre 15mm igual',                    'FON-ACC-T15'),
    ('Válvula esférica latón',  'Válvula esférica latón 1/2 pulgada',     'FON-VAL-ESF15'),
    ('Válvula esférica latón',  'Válvula esférica latón 3/4 pulgada',     'FON-VAL-ESF22'),
    ('Plato de ducha resina',   'Plato de ducha resina 80x80cm',          'FON-SAN-DUC-P'),
    ('Plato de ducha resina',   'Plato de ducha resina 90x90cm',          'FON-SAN-DUC-P90'),
    ('Válvula de seguridad',    'Válvula de seguridad 3/4 pulgada 3 bar', 'FON-VAL-SEG'),
    ('Plato de ducha extraplano','Plato de ducha extraplano 100x70cm',    'FON-SAN-DUC-PX')
)
SELECT
  '§5_variantes'        AS seccion,
  v.up_nombre,
  v.variante_nombre,
  v.codigo_gc,
  gc.id                 AS gc_id,
  CASE
    WHEN up.id IS NULL
      THEN 'INSERT (UP padre a crear en este lote)'
    WHEN EXISTS (
      SELECT 1 FROM public.trade_marketplace_universal_product_variants vv
      WHERE vv.global_catalog_id = gc.id
    )
      THEN 'SKIP (gc_id ya vinculado a variante)'
    ELSE 'INSERT'
  END AS accion
FROM variantes v
JOIN public.trade_global_catalog gc ON gc.codigo = v.codigo_gc
LEFT JOIN public.trade_marketplace_universal_products up
  ON up.nombre_canonico = v.up_nombre AND up.oficio = 'fontaneria'
ORDER BY v.up_nombre, v.variante_nombre;
-- Esperado: 15 filas con accion IN ('INSERT', 'INSERT (UP padre a crear en este lote)')

-- ─────────────────────────────────────────────────────────────────────
-- §6  RESULTADO ESPERADO ANTES/DESPUÉS
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§6_resumen'  AS seccion,
  tabla,
  antes,
  delta,
  antes + delta AS despues_esperado
FROM (VALUES
  ('trade_marketplace_universal_products',          6,  16),
  ('trade_marketplace_universal_product_variants',  0,  15),
  ('trade_marketplace_categories',                 25,   1)
) AS t(tabla, antes, delta)
ORDER BY tabla;

-- ─────────────────────────────────────────────────────────────────────
-- §7  VALIDACIÓN DE CATEGORÍAS OBJETIVO
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§7_cats_objetivo' AS seccion,
  slug,
  nombre,
  id,
  'OK' AS estado
FROM public.trade_marketplace_categories
WHERE id IN (
  '3c629d1b-571d-44df-8f0e-8de7259f4f25',   -- Tuberías y Uniones
  'd19b757a-d45c-4702-be34-b31bb8d56ec6',   -- Desagüe y Saneamiento
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',   -- Griferías
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',   -- Sanitarios
  'db7ddd64-319d-443d-9ddb-0ea332749af5'    -- Fontanería root
)
ORDER BY slug;
-- Esperado: 5 filas con estado = 'OK'

-- ─────────────────────────────────────────────────────────────────────
-- §8  COBERTURA GC — 40 REGISTROS DEL PILOTO
-- Muestra cómo cada registro de trade_global_catalog del piloto
-- queda cubierto tras la migración.
-- ─────────────────────────────────────────────────────────────────────

-- §8-A: Tabla de cobertura por tipo
WITH pilot_gc(codigo, tipo, descripcion) AS (
  VALUES
    -- 6 directos: gc_record → UP.global_catalog_id
    ('FON-GRF-LAV',      'directo',   'Grifo monomando lavabo (PZ-FON-001 existente)'),
    ('FON-GRF-BAN',      'directo',   'Grifo monomando bañera'),
    ('FON-GRF-COC',      'directo',   'Grifo monomando cocina alto'),
    ('FON-GRF-TER-DUC',  'directo',   'Kit ducha termostático'),
    ('FON-GRF-LAR',      'directo',   'Grifo lavadero/exterior 1/2 pulgadas'),
    ('FON-SAN-WC-S',     'directo',   'Inodoro suspendido con cisterna'),
    -- 15 variantes: gc_record → variant.global_catalog_id
    ('FON-CU-015',       'variante',  'Tubo cobre 15mm'),
    ('FON-CU-022',       'variante',  'Tubo cobre 22mm'),
    ('FON-MC-016',       'variante',  'Tubo multicapa 16x2mm'),
    ('FON-PE-20',        'variante',  'Tubo PE-100 20mm'),
    ('FON-PVC-20',       'variante',  'Tubo PVC presión 20mm'),
    ('FON-PVC-S110',     'variante',  'Tubo PVC saneamiento 110mm'),
    ('FON-ACC-C15T',     'variante',  'Codo 90° cobre 15mm'),
    ('FON-ACC-C22T',     'variante',  'Codo 90° cobre 22mm'),
    ('FON-ACC-T15',      'variante',  'Té cobre 15mm igual'),
    ('FON-VAL-ESF15',    'variante',  'Válvula esférica latón 1/2 pulgada'),
    ('FON-VAL-ESF22',    'variante',  'Válvula esférica latón 3/4 pulgada'),
    ('FON-SAN-DUC-P',    'variante',  'Plato de ducha resina 80x80cm'),
    ('FON-SAN-DUC-P90',  'variante',  'Plato de ducha resina 90x90cm'),
    ('FON-VAL-SEG',      'variante',  'Válvula de seguridad 3/4 pulgada 3 bar'),
    ('FON-SAN-DUC-PX',   'variante',  'Plato de ducha extraplano 100x70cm'),
    -- 19 NC: excluidos del marketplace (no se crean UPs ni variantes)
    ('FON-MO-OF',        'nc',        'Oficial fontanero (h)'),
    ('FON-MO-AYU',       'nc',        'Ayudante fontanero (h)'),
    ('FON-MO-OFI',       'nc',        'Oficial de obra (h)'),
    ('FON-MO-GUAR',      'nc',        'Guardia de seguridad (h)'),
    ('FON-MO-DES',       'nc',        'Desplazamiento técnico (km)'),
    ('FON-INS-BANO',     'nc',        'Instalación baño completo'),
    ('FON-INS-CAL',      'nc',        'Instalación calentador ACS'),
    ('FON-INS-WCS',      'nc',        'Instalación inodoro suspendido'),
    ('FON-INS-LAVT',     'nc',        'Instalación lavabo con grifería'),
    ('FON-INS-DUC',      'nc',        'Instalación plato ducha'),
    ('FON-INS-TERM',     'nc',        'Instalación termo eléctrico'),
    ('FON-INS-ACOM',     'nc',        'Instalación acometida agua'),
    ('FON-INS-LLAVE',    'nc',        'Instalación llave de paso'),
    ('FON-MAN-DESH',     'nc',        'Desatasco tuberías WC/ducha'),
    ('FON-MAN-DESM',     'nc',        'Desmontaje calentador/termo'),
    ('FON-MAN-DES',      'nc',        'Detección y reparación fuga'),
    ('FON-MAN-DETF',     'nc',        'Detección fuga oculta'),
    ('FON-MAN-JUN',      'nc',        'Cambio juntas grifería'),
    ('FON-MAN-SIF',      'nc',        'Cambio sifón lavabo/bañera')
)
SELECT
  '§8A_cobertura_detalle' AS seccion,
  p.tipo,
  p.codigo,
  p.descripcion,
  gc.id IS NOT NULL      AS gc_existe_en_bd
FROM pilot_gc p
LEFT JOIN public.trade_global_catalog gc ON gc.codigo = p.codigo
ORDER BY p.tipo, p.codigo;
-- Esperado: 40 filas, gc_existe_en_bd = true en todas

-- §8-B: Resumen de cobertura por tipo
WITH pilot_gc(codigo, tipo) AS (
  VALUES
    ('FON-GRF-LAV','directo'),    ('FON-GRF-BAN','directo'),
    ('FON-GRF-COC','directo'),    ('FON-GRF-TER-DUC','directo'),
    ('FON-GRF-LAR','directo'),    ('FON-SAN-WC-S','directo'),
    ('FON-CU-015','variante'),    ('FON-CU-022','variante'),
    ('FON-MC-016','variante'),    ('FON-PE-20','variante'),
    ('FON-PVC-20','variante'),    ('FON-PVC-S110','variante'),
    ('FON-ACC-C15T','variante'),  ('FON-ACC-C22T','variante'),
    ('FON-ACC-T15','variante'),   ('FON-VAL-ESF15','variante'),
    ('FON-VAL-ESF22','variante'), ('FON-SAN-DUC-P','variante'),
    ('FON-SAN-DUC-P90','variante'),('FON-VAL-SEG','variante'),
    ('FON-SAN-DUC-PX','variante'),
    ('FON-MO-OF','nc'),    ('FON-MO-AYU','nc'),    ('FON-MO-OFI','nc'),
    ('FON-MO-GUAR','nc'),  ('FON-MO-DES','nc'),
    ('FON-INS-BANO','nc'), ('FON-INS-CAL','nc'),   ('FON-INS-WCS','nc'),
    ('FON-INS-LAVT','nc'), ('FON-INS-DUC','nc'),   ('FON-INS-TERM','nc'),
    ('FON-INS-ACOM','nc'), ('FON-INS-LLAVE','nc'),
    ('FON-MAN-DESH','nc'), ('FON-MAN-DESM','nc'),  ('FON-MAN-DES','nc'),
    ('FON-MAN-DETF','nc'), ('FON-MAN-JUN','nc'),   ('FON-MAN-SIF','nc')
)
SELECT
  '§8B_resumen_cobertura'              AS seccion,
  tipo                                 AS categoria_cobertura,
  count(*)                             AS gc_count,
  CASE tipo
    WHEN 'directo'  THEN 'gc_record → UP.global_catalog_id'
    WHEN 'variante' THEN 'gc_record → variant.global_catalog_id'
    WHEN 'nc'       THEN 'excluido del marketplace'
  END                                  AS mecanismo_vinculo
FROM pilot_gc
GROUP BY tipo
ORDER BY tipo DESC;
-- Esperado:
--   directo   : 6   — gc_record → UP.global_catalog_id
--   variante  : 15  — gc_record → variant.global_catalog_id
--   nc        : 19  — excluido del marketplace

-- §8-C: gc del piloto sin resolver — códigos del piloto AUSENTES en la BD
-- "sin resolver" = código clasificado en el piloto pero inexistente en trade_global_catalog
WITH pilot_gc(codigo, tipo) AS (
  VALUES
    ('FON-GRF-LAV','directo'),    ('FON-GRF-BAN','directo'),
    ('FON-GRF-COC','directo'),    ('FON-GRF-TER-DUC','directo'),
    ('FON-GRF-LAR','directo'),    ('FON-SAN-WC-S','directo'),
    ('FON-CU-015','variante'),    ('FON-CU-022','variante'),
    ('FON-MC-016','variante'),    ('FON-PE-20','variante'),
    ('FON-PVC-20','variante'),    ('FON-PVC-S110','variante'),
    ('FON-ACC-C15T','variante'),  ('FON-ACC-C22T','variante'),
    ('FON-ACC-T15','variante'),   ('FON-VAL-ESF15','variante'),
    ('FON-VAL-ESF22','variante'), ('FON-SAN-DUC-P','variante'),
    ('FON-SAN-DUC-P90','variante'),('FON-VAL-SEG','variante'),
    ('FON-SAN-DUC-PX','variante'),
    ('FON-MO-OF','nc'),    ('FON-MO-AYU','nc'),    ('FON-MO-OFI','nc'),
    ('FON-MO-GUAR','nc'),  ('FON-MO-DES','nc'),
    ('FON-INS-BANO','nc'), ('FON-INS-CAL','nc'),   ('FON-INS-WCS','nc'),
    ('FON-INS-LAVT','nc'), ('FON-INS-DUC','nc'),   ('FON-INS-TERM','nc'),
    ('FON-INS-ACOM','nc'), ('FON-INS-LLAVE','nc'),
    ('FON-MAN-DESH','nc'), ('FON-MAN-DESM','nc'),  ('FON-MAN-DES','nc'),
    ('FON-MAN-DETF','nc'), ('FON-MAN-JUN','nc'),   ('FON-MAN-SIF','nc')
)
SELECT
  '§8C_gc_sin_resolver'          AS seccion,
  count(*)                       AS gc_ausentes_en_bd,
  CASE WHEN count(*) = 0 THEN 'OK — los 40 códigos del piloto existen en BD'
    ELSE 'ERROR — códigos del piloto ausentes en trade_global_catalog' END AS estado
FROM pilot_gc p
LEFT JOIN public.trade_global_catalog gc ON gc.codigo = p.codigo
WHERE gc.id IS NULL;
-- Esperado: gc_ausentes_en_bd = 0
-- Los 40 códigos del piloto (6 directos + 15 variantes + 19 NC) deben
-- existir en trade_global_catalog. Los ~61 registros de Fontanería
-- fuera del piloto (Equipos ACS, etc.) son out-of-scope para esta migración.
