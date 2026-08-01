-- =============================================================
-- MKT-FASE1-PILOT-001: ROLLBACK
-- =============================================================
-- Usar SOLO si la migración MKT_FASE1_PILOT_001.sql produce
-- resultados incorrectos o necesita deshacerse.
-- Ejecutar completo dentro de una transacción.
-- Verificar conteos antes y después.
-- =============================================================
--
-- CONTEOS ESPERADOS TRAS ROLLBACK (estado original):
--   trade_marketplace_universal_products        : 6
--   trade_marketplace_universal_product_variants : 0
--   trade_marketplace_categories                 : 25
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- PASO 1: Eliminar variantes del piloto
-- Identificación: universal_product_id apunta a UPs sin EAN (creados por esta migración)
-- ─────────────────────────────────────────────────────────────

DELETE FROM public.trade_marketplace_universal_product_variants
WHERE universal_product_id IN (
  SELECT id FROM public.trade_marketplace_universal_products
  WHERE oficio = 'fontaneria'
    AND ean IS NULL
    AND nombre_canonico IN (
      'Tubo cobre',
      'Tubo multicapa',
      'Tubo PE-100',
      'Tubo PVC presión',
      'Tubo PVC saneamiento',
      'Codo 90° cobre',
      'Té cobre',
      'Válvula esférica latón',
      'Válvula de seguridad',
      'Plato de ducha resina',
      'Plato de ducha extraplano'
    )
);

-- ─────────────────────────────────────────────────────────────
-- PASO 2: Eliminar UPs padre y UPs directos creados por esta migración
-- Guarda: ean IS NULL — los 6 UPs preexistentes tienen EAN (PZ-FON-xxx)
-- ─────────────────────────────────────────────────────────────

DELETE FROM public.trade_marketplace_universal_products
WHERE oficio = 'fontaneria'
  AND ean IS NULL
  AND nombre_canonico IN (
    -- UPs padre
    'Tubo cobre',
    'Tubo multicapa',
    'Tubo PE-100',
    'Tubo PVC presión',
    'Tubo PVC saneamiento',
    'Codo 90° cobre',
    'Té cobre',
    'Válvula esférica latón',
    'Válvula de seguridad',
    'Plato de ducha resina',
    'Plato de ducha extraplano',
    -- UPs directos nuevos
    'Grifo monomando bañera',
    'Grifo monomando cocina alto',
    'Kit ducha termostático',
    'Grifo para lavadero o exterior 1/2 pulgadas',
    'Inodoro suspendido con cisterna'
  );

-- ─────────────────────────────────────────────────────────────
-- PASO 3: Revertir UPDATE de PZ-FON-001
-- Quitar category_id y global_catalog_id añadidos por BLOQUE 4
-- ─────────────────────────────────────────────────────────────

UPDATE public.trade_marketplace_universal_products
SET
  category_id       = NULL,
  global_catalog_id = NULL,
  updated_at        = now()
WHERE ean = 'PZ-FON-001';

-- ─────────────────────────────────────────────────────────────
-- PASO 4: Eliminar categoría ACS si fue creada
-- ─────────────────────────────────────────────────────────────

DELETE FROM public.trade_marketplace_categories
WHERE slug = 'font-acs';

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK
-- ─────────────────────────────────────────────────────────────
-- SELECT count(*) FROM public.trade_marketplace_universal_products;
-- -- Esperado: 6
--
-- SELECT count(*) FROM public.trade_marketplace_universal_product_variants;
-- -- Esperado: 0
--
-- SELECT count(*) FROM public.trade_marketplace_categories;
-- -- Esperado: 25
--
-- SELECT ean, nombre_canonico, category_id, global_catalog_id
-- FROM public.trade_marketplace_universal_products
-- WHERE ean = 'PZ-FON-001';
-- -- Esperado: category_id = NULL, global_catalog_id = NULL
-- ─────────────────────────────────────────────────────────────

COMMIT;
