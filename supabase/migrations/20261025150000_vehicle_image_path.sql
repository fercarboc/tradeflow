-- ══════════════════════════════════════════════════════════════════════════════
-- TX-1E-HOTFIX-FLEET-DRIVERS-1 — Imagen explícita de vehículo
-- ══════════════════════════════════════════════════════════════════════════════
-- Añade columna image_path para guardar la ruta pública de la imagen
-- asignada explícitamente a un vehículo (/autocar.png, /minibus.png, etc.).
-- Si es NULL, la UI usa el mapping automático por tipo.
-- Aditiva y retrocompatible: vehículos existentes quedan con NULL (mapping automático).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_vehicles
  ADD COLUMN IF NOT EXISTS image_path text;
