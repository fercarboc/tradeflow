-- =====================================================================
-- MKT-FASE1-PILOT-001  —  DRY RUN (SELECT-ONLY)
-- =====================================================================
-- Script de solo lectura. No modifica ningún dato.
-- Ejecutar antes de la migración para confirmar que cada operación
-- producirá el resultado esperado.
-- Ejecutado y verificado: 2026-08-01
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- §1  ESTADO ACTUAL DE LA BASE DE DATOS
-- ─────────────────────────────────────────────────────────────────────
SELECT
  'estado_actual'                                                                AS seccion,
  (SELECT count(*) FROM public.trade_marketplace_universal_products)            AS ups_total,
  (SELECT count(*) FROM public.trade_marketplace_universal_products
   WHERE origen = 'pilot_fontaneria_2026_08_01')                                AS ups_lote_previo,
  (SELECT count(*) FROM public.trade_marketplace_universal_product_variants)    AS variantes_total,
  (SELECT count(*) FROM public.trade_marketplace_categories)                    AS categorias_total,
  (SELECT count(*) FROM public.trade_marketplace_categories
   WHERE slug = 'font-acs')                                                     AS font_acs_existe,
  (SELECT category_id FROM public.trade_marketplace_universal_products
   WHERE ean = 'PZ-FON-001')                                                    AS pz001_category_id,
  (SELECT global_catalog_id FROM public.trade_marketplace_universal_products
   WHERE ean = 'PZ-FON-001')                                                    AS pz001_gc_id;

-- ─────────────────────────────────────────────────────────────────────
-- §2  UPs PADRE (11) — INSERT vs. SKIP
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(nombre, oficio, familia, unidad, cat_slug) AS (
  VALUES
    ('Tubo cobre',              'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo multicapa',          'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PE-100',             'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PVC presión',        'fontaneria','Tubería',    'ml', 'font-tuberias'),
    ('Tubo PVC saneamiento',    'fontaneria','Saneamiento','ml', 'font-desague'),
    ('Codo 90° cobre',          'fontaneria','Accesorios', 'ud', 'font-tuberias'),
    ('Té cobre',                'fontaneria','Accesorios', 'ud', 'font-tuberias'),
    ('Válvula esférica latón',  'fontaneria','Válvulas',   'ud', 'font-tuberias'),
    ('Válvula de seguridad',    'fontaneria','Válvulas',   'ud', 'font-tuberias'),
    ('Plato de ducha resina',   'fontaneria','Sanitarios', 'ud', 'font-sanitarios'),
    ('Plato de ducha extraplano','fontaneria','Sanitarios','ud', 'font-sanitarios')
)
SELECT
  '§2_ups_padre'              AS seccion,
  p.nombre,
  p.familia,
  p.unidad,
  p.cat_slug,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (ya existe)' ELSE 'INSERT' END AS accion
FROM propuestos p
LEFT JOIN public.trade_marketplace_universal_products up
  ON up.nombre_canonico = p.nombre AND up.oficio = p.oficio
ORDER BY p.nombre;

-- ─────────────────────────────────────────────────────────────────────
-- §3  UPs DIRECTOS (5) — INSERT vs. SKIP (clave: global_catalog_id)
-- ─────────────────────────────────────────────────────────────────────
WITH propuestos(codigo_gc, nombre_canonico, familia, cat_slug) AS (
  VALUES
    ('FON-GRF-BAN',     'Grifo monomando bañera',                      'Grifería',  'font-griferias'),
    ('FON-GRF-COC',     'Grifo monomando cocina alto',                 'Grifería',  'font-griferias'),
    ('FON-GRF-TER-DUC', 'Kit ducha termostático',                       'Grifería',  'font-griferias'),
    ('FON-GRF-LAR',     'Grifo para lavadero o exterior 1/2 pulgadas', 'Grifería',  'font-griferias'),
    ('FON-SAN-WC-S',    'Inodoro suspendido con cisterna',             'Sanitarios','font-sanitarios')
)
SELECT
  '§3_ups_directos'           AS seccion,
  p.nombre_canonico,
  p.familia,
  p.cat_slug,
  gc.id                       AS gc_id,
  CASE WHEN up.id IS NOT NULL THEN 'SKIP (gc_id ya vinculado)' ELSE 'INSERT' END AS accion
FROM propuestos p
JOIN public.trade_global_catalog gc ON gc.codigo = p.codigo_gc
LEFT JOIN public.trade_marketplace_universal_products up ON up.global_catalog_id = gc.id
ORDER BY p.nombre_canonico;

-- ─────────────────────────────────────────────────────────────────────
-- §4  UPDATE PZ-FON-001 + INSERT categoría font-acs
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§4_update_y_categoria'     AS seccion,
  'PZ-FON-001'                AS registro,
  nombre_canonico,
  category_id::text           AS valor_actual,
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

-- ─────────────────────────────────────────────────────────────────────
-- §5  VARIANTES (15) — INSERT vs. SKIP (clave: atributo técnico jsonb)
-- ─────────────────────────────────────────────────────────────────────
WITH variantes(up_nombre, variante_nombre, atrib_clave, atrib_valor) AS (
  VALUES
    ('Tubo cobre',             'Tubo cobre 15mm',                     'diametro',   '15 mm'),
    ('Tubo cobre',             'Tubo cobre 22mm',                     'diametro',   '22 mm'),
    ('Tubo multicapa',         'Tubo multicapa 16x2mm',               'diametro',   '16x2 mm'),
    ('Tubo PE-100',            'Tubo PE-100 20mm',                    'diametro',   '20 mm'),
    ('Tubo PVC presión',       'Tubo PVC presión 20mm',               'diametro',   '20 mm'),
    ('Tubo PVC saneamiento',   'Tubo PVC saneamiento 110mm',          'diametro',   '110 mm'),
    ('Codo 90° cobre',         'Codo 90° cobre 15mm',                 'diametro',   '15 mm'),
    ('Codo 90° cobre',         'Codo 90° cobre 22mm',                 'diametro',   '22 mm'),
    ('Té cobre',               'Té cobre 15mm igual',                 'diametro',   '15 mm'),
    ('Válvula esférica latón', 'Válvula esférica latón 1/2 pulgada',  'conexion',   '1/2 pulgada'),
    ('Válvula esférica latón', 'Válvula esférica latón 3/4 pulgada',  'conexion',   '3/4 pulgada'),
    ('Plato de ducha resina',  'Plato de ducha resina 80x80cm',       'dimensiones','80x80 cm'),
    ('Plato de ducha resina',  'Plato de ducha resina 90x90cm',       'dimensiones','90x90 cm'),
    ('Válvula de seguridad',   'Válvula de seguridad 3/4 pulgada 3 bar','conexion', '3/4 pulgada'),
    ('Plato de ducha extraplano','Plato de ducha extraplano 100x70cm','dimensiones','100x70 cm')
)
SELECT
  '§5_variantes'              AS seccion,
  v.up_nombre,
  v.variante_nombre,
  v.atrib_clave || '=' || v.atrib_valor AS clave_idempotencia,
  -- UP padre no existe aún → siempre INSERT (se crea en el mismo lote)
  CASE
    WHEN up.id IS NULL THEN 'INSERT (UP padre a crear en este lote)'
    WHEN EXISTS (
      SELECT 1 FROM public.trade_marketplace_universal_product_variants vv
      WHERE vv.universal_product_id = up.id
        AND vv.atributos @> jsonb_build_object(v.atrib_clave, v.atrib_valor)
    ) THEN 'SKIP (variante ya existe)'
    ELSE 'INSERT'
  END AS accion
FROM variantes v
LEFT JOIN public.trade_marketplace_universal_products up
  ON up.nombre_canonico = v.up_nombre AND up.oficio = 'fontaneria'
ORDER BY v.up_nombre, v.variante_nombre;

-- ─────────────────────────────────────────────────────────────────────
-- §6  RESULTADO ESPERADO ANTES/DESPUÉS
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§6_resumen' AS seccion,
  tabla,
  antes,
  delta,
  antes + delta AS despues_esperado
FROM (VALUES
  ('trade_marketplace_universal_products',         6,  16),
  ('trade_marketplace_universal_product_variants', 0,  15),
  ('trade_marketplace_categories',                 25,  1)
) AS t(tabla, antes, delta)
ORDER BY tabla;

-- ─────────────────────────────────────────────────────────────────────
-- §7  VALIDACIÓN DE CATEGORÍAS OBJETIVO
-- ─────────────────────────────────────────────────────────────────────
SELECT
  '§7_cats_objetivo'  AS seccion,
  slug,
  nombre,
  id,
  'OK' AS estado
FROM public.trade_marketplace_categories
WHERE id IN (
  '3c629d1b-571d-44df-8f0e-8de7259f4f25',
  'd19b757a-d45c-4702-be34-b31bb8d56ec6',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2',
  'db7ddd64-319d-443d-9ddb-0ea332749af5'
)
ORDER BY slug;
