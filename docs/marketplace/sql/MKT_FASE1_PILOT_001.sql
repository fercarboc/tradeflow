-- =============================================================
-- MKT-FASE1-PILOT-001: Lote piloto fontanería — Migración DML
-- =============================================================
-- Alcance : 1 categoría nueva · 16 UPs nuevos · 1 UP actualizado · 15 variantes
-- Idempotente: sí — todos los INSERT usan WHERE NOT EXISTS
-- El UPDATE usa AND category_id IS NULL como guarda
-- Ejecutar DENTRO de una transacción; revisar conteos tras COMMIT
-- NO ejecutar hasta aprobación humana explícita
-- =============================================================
--
-- SNAPSHOT PREVIO CONFIRMADO (2026-08-01):
--   trade_marketplace_universal_products  : 6  filas
--   trade_marketplace_universal_product_variants : 0 filas
--   trade_marketplace_categories          : 25 filas
--   font-acs existe                       : false
--
-- CONTEOS ESPERADOS TRAS COMMIT:
--   trade_marketplace_universal_products  : 22 filas (+16)
--   trade_marketplace_universal_product_variants : 15 filas (+15)
--   trade_marketplace_categories          : 26 filas (+1)
--
-- VERIFICACIÓN PREVIA (ejecutar antes de la migración):
--   SELECT codigo, descripcion, id
--   FROM public.trade_global_catalog
--   WHERE codigo IN (
--     'FON-GRF-LAV','FON-GRF-BAN','FON-GRF-COC',
--     'FON-GRF-TER-DUC','FON-GRF-LAR','FON-SAN-WC-S'
--   );
--   -- Debe retornar exactamente 6 filas.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 1: Nueva categoría "Equipos de agua caliente sanitaria"
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id)
SELECT
  'Equipos de agua caliente sanitaria',
  'font-acs',
  'db7ddd64-319d-443d-9ddb-0ea332749af5'   -- parent: Fontanería root
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_categories WHERE slug = 'font-acs'
);

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 2: UPs PADRE — 11 genéricos (es_generico=true)
-- validation_state = 'draft' : requieren revisión antes de publicar
-- ─────────────────────────────────────────────────────────────

-- Tuberías (categoría: Tuberías y Uniones) ────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Tubo cobre', 'fontaneria', 'Tubería', 'ml',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"cobre"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Tubo cobre' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Tubo multicapa', 'fontaneria', 'Tubería', 'ml',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"multicapa"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Tubo multicapa' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Tubo PE-100', 'fontaneria', 'Tubería', 'ml',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"PE-100"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Tubo PE-100' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Tubo PVC presión', 'fontaneria', 'Tubería', 'ml',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"PVC","uso":"presión"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Tubo PVC presión' AND oficio = 'fontaneria'
);

-- Saneamiento (categoría: Desagüe y Saneamiento) ─────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Tubo PVC saneamiento', 'fontaneria', 'Saneamiento', 'ml',
  'd19b757a-d45c-4702-be34-b31bb8d56ec6', true, 'draft', 'admin_manual',
  '{"material":"PVC","uso":"saneamiento"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Tubo PVC saneamiento' AND oficio = 'fontaneria'
);

-- Accesorios (categoría: Tuberías y Uniones) ──────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Codo 90° cobre', 'fontaneria', 'Accesorios', 'ud',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"cobre","angulo":"90°"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Codo 90° cobre' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Té cobre', 'fontaneria', 'Accesorios', 'ud',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"cobre"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Té cobre' AND oficio = 'fontaneria'
);

-- Válvulas (categoría: Tuberías y Uniones) ────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Válvula esférica latón', 'fontaneria', 'Válvulas', 'ud',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"material":"latón","tipo":"esférica"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Válvula esférica latón' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Válvula de seguridad', 'fontaneria', 'Válvulas', 'ud',
  '3c629d1b-571d-44df-8f0e-8de7259f4f25', true, 'draft', 'admin_manual',
  '{"tipo":"seguridad"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Válvula de seguridad' AND oficio = 'fontaneria'
);

-- Sanitarios (categoría: Sanitarios) ─────────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Plato de ducha resina', 'fontaneria', 'Sanitarios', 'ud',
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2', true, 'draft', 'admin_manual',
  '{"material":"resina","forma":"cuadrado"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Plato de ducha resina' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico, validation_state, origen, especificaciones)
SELECT 'Plato de ducha extraplano', 'fontaneria', 'Sanitarios', 'ud',
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2', true, 'draft', 'admin_manual',
  '{"forma":"rectangular","perfil":"extraplano"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Plato de ducha extraplano' AND oficio = 'fontaneria'
);

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 3: UPs DIRECTOS — 5 nuevos (es_generico=false)
-- "Grifo monomando lavabo" (PZ-FON-001) ya existe → ver BLOQUE 4
-- global_catalog_id: lookup por codigo exacto (confirmado en BD)
-- ─────────────────────────────────────────────────────────────

-- Grifería ────────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico,
   validation_state, origen, global_catalog_id, especificaciones)
SELECT
  'Grifo monomando bañera', 'fontaneria', 'Grifería', 'ud',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999', false, 'draft', 'admin_manual',
  (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-BAN' LIMIT 1),
  '{"tipo":"monomando","uso":"bañera"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Grifo monomando bañera' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico,
   validation_state, origen, global_catalog_id, especificaciones)
SELECT
  'Grifo monomando cocina alto', 'fontaneria', 'Grifería', 'ud',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999', false, 'draft', 'admin_manual',
  (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-COC' LIMIT 1),
  '{"tipo":"monomando","uso":"cocina","caño":"alto"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Grifo monomando cocina alto' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico,
   validation_state, origen, global_catalog_id, especificaciones)
SELECT
  'Kit ducha termostático', 'fontaneria', 'Grifería', 'ud',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999', false, 'draft', 'admin_manual',
  (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-TER-DUC' LIMIT 1),
  '{"tipo":"termostático","componentes":"kit completo"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Kit ducha termostático' AND oficio = 'fontaneria'
);

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico,
   validation_state, origen, global_catalog_id, especificaciones)
SELECT
  'Grifo para lavadero o exterior 1/2 pulgadas', 'fontaneria', 'Grifería', 'ud',
  '9ea5bf24-67f7-4e8e-91ba-10ed279f3999', false, 'draft', 'admin_manual',
  (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-LAR' LIMIT 1),
  '{"conexion":"1/2 pulgada","uso":"lavadero o exterior"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Grifo para lavadero o exterior 1/2 pulgadas' AND oficio = 'fontaneria'
);

-- Sanitarios ──────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_products
  (nombre_canonico, oficio, familia, unidad, category_id, es_generico,
   validation_state, origen, global_catalog_id, especificaciones)
SELECT
  'Inodoro suspendido con cisterna', 'fontaneria', 'Sanitarios', 'ud',
  '671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2', false, 'draft', 'admin_manual',
  (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-SAN-WC-S' LIMIT 1),
  '{"instalacion":"suspendido","incluye_cisterna":true}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_products
  WHERE nombre_canonico = 'Inodoro suspendido con cisterna' AND oficio = 'fontaneria'
);

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 4: ACTUALIZAR UP EXISTENTE PZ-FON-001
-- Añade category_id y global_catalog_id que faltaban
-- Guarda: AND category_id IS NULL garantiza idempotencia
-- ─────────────────────────────────────────────────────────────

UPDATE public.trade_marketplace_universal_products
SET
  category_id     = '9ea5bf24-67f7-4e8e-91ba-10ed279f3999',
  global_catalog_id = (SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-LAV' LIMIT 1),
  updated_at      = now()
WHERE ean = 'PZ-FON-001'
  AND category_id IS NULL;   -- idempotente: solo aplica si no está ya vinculado

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 5: VARIANTES — 15 variantes del piloto
-- Referencia al UP padre por nombre_canonico + oficio (subconsulta)
-- Idempotencia: WHERE NOT EXISTS por universal_product_id + nombre
-- ─────────────────────────────────────────────────────────────

-- Tubo cobre ─────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo cobre' AND oficio = 'fontaneria'),
  'Tubo cobre 15mm',
  '{"diametro":"15 mm","material":"cobre"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo cobre' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo cobre 15mm'
);

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo cobre' AND oficio = 'fontaneria'),
  'Tubo cobre 22mm',
  '{"diametro":"22 mm","material":"cobre"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo cobre' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo cobre 22mm'
);

-- Tubo multicapa ─────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo multicapa' AND oficio = 'fontaneria'),
  'Tubo multicapa 16x2mm',
  '{"diametro":"16x2 mm","material":"multicapa"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo multicapa' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo multicapa 16x2mm'
);

-- Tubo PE-100 ────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo PE-100' AND oficio = 'fontaneria'),
  'Tubo PE-100 20mm',
  '{"diametro":"20 mm","material":"PE-100"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo PE-100' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo PE-100 20mm'
);

-- Tubo PVC presión ───────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo PVC presión' AND oficio = 'fontaneria'),
  'Tubo PVC presión 20mm',
  '{"diametro":"20 mm","material":"PVC","uso":"presión"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo PVC presión' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo PVC presión 20mm'
);

-- Tubo PVC saneamiento ───────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Tubo PVC saneamiento' AND oficio = 'fontaneria'),
  'Tubo PVC saneamiento 110mm',
  '{"diametro":"110 mm","material":"PVC","uso":"saneamiento"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Tubo PVC saneamiento' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Tubo PVC saneamiento 110mm'
);

-- Codo 90° cobre ─────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Codo 90° cobre' AND oficio = 'fontaneria'),
  'Codo 90° cobre 15mm',
  '{"diametro":"15 mm","material":"cobre","angulo":"90°"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Codo 90° cobre' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Codo 90° cobre 15mm'
);

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Codo 90° cobre' AND oficio = 'fontaneria'),
  'Codo 90° cobre 22mm',
  '{"diametro":"22 mm","material":"cobre","angulo":"90°"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Codo 90° cobre' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Codo 90° cobre 22mm'
);

-- Té cobre ────────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Té cobre' AND oficio = 'fontaneria'),
  'Té cobre 15mm igual',
  '{"diametro":"15 mm","material":"cobre","tipo":"igual"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Té cobre' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Té cobre 15mm igual'
);

-- Válvula esférica latón ──────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Válvula esférica latón' AND oficio = 'fontaneria'),
  'Válvula esférica latón 1/2 pulgada',
  '{"conexion":"1/2 pulgada","material":"latón"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Válvula esférica latón' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Válvula esférica latón 1/2 pulgada'
);

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Válvula esférica latón' AND oficio = 'fontaneria'),
  'Válvula esférica latón 3/4 pulgada',
  '{"conexion":"3/4 pulgada","material":"latón"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Válvula esférica latón' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Válvula esférica latón 3/4 pulgada'
);

-- Plato de ducha resina ──────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Plato de ducha resina' AND oficio = 'fontaneria'),
  'Plato de ducha resina 80x80cm',
  '{"dimensiones":"80x80 cm","material":"resina","forma":"cuadrado"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Plato de ducha resina' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Plato de ducha resina 80x80cm'
);

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Plato de ducha resina' AND oficio = 'fontaneria'),
  'Plato de ducha resina 90x90cm',
  '{"dimensiones":"90x90 cm","material":"resina","forma":"cuadrado"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Plato de ducha resina' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Plato de ducha resina 90x90cm'
);

-- Válvula de seguridad ───────────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Válvula de seguridad' AND oficio = 'fontaneria'),
  'Válvula de seguridad 3/4 pulgada 3 bar',
  '{"conexion":"3/4 pulgada","presion_max":"3 bar"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Válvula de seguridad' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Válvula de seguridad 3/4 pulgada 3 bar'
);

-- Plato de ducha extraplano ──────────────────────────────────

INSERT INTO public.trade_marketplace_universal_product_variants
  (universal_product_id, nombre, atributos, activa)
SELECT
  (SELECT id FROM public.trade_marketplace_universal_products
   WHERE nombre_canonico = 'Plato de ducha extraplano' AND oficio = 'fontaneria'),
  'Plato de ducha extraplano 100x70cm',
  '{"dimensiones":"100x70 cm","forma":"rectangular"}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products p ON p.id = v.universal_product_id
  WHERE p.nombre_canonico = 'Plato de ducha extraplano' AND p.oficio = 'fontaneria'
    AND v.nombre = 'Plato de ducha extraplano 100x70cm'
);

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-COMMIT (ejecutar tras COMMIT)
-- ─────────────────────────────────────────────────────────────
-- SELECT count(*) FROM public.trade_marketplace_universal_products;
-- -- Esperado: 22
--
-- SELECT count(*) FROM public.trade_marketplace_universal_product_variants;
-- -- Esperado: 15
--
-- SELECT count(*) FROM public.trade_marketplace_categories;
-- -- Esperado: 26
--
-- SELECT ean, nombre_canonico, category_id, global_catalog_id
-- FROM public.trade_marketplace_universal_products
-- WHERE ean = 'PZ-FON-001';
-- -- Esperado: category_id y global_catalog_id NOT NULL
-- ─────────────────────────────────────────────────────────────

COMMIT;
