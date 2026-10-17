-- Verificación post-migración: oficio pintura en trade_global_catalog
-- Ejecutar manualmente en Supabase SQL Editor para confirmar la migración.

SELECT oficio, familia, COUNT(*) AS total
FROM public.trade_global_catalog
WHERE activo = true
GROUP BY oficio, familia
ORDER BY oficio, familia;

SELECT codigo, descripcion, unidad, precio_referencia
FROM public.trade_global_catalog
WHERE oficio = 'pintura' AND activo = true
ORDER BY familia, descripcion;
