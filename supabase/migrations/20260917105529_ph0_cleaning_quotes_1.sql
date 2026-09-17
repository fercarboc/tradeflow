-- PH0-CLEANING-QUOTES-1: Sector Limpieza
-- Retrocompatible: ambas columnas son NULL y opcionalmente aportadas por callers nuevos.

-- 1. Unidad en líneas de presupuesto
--    Permite representar m2, visita, mes, hora, ud, etc.
--    Los presupuestos existentes quedan con unidad = NULL sin impacto.
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS unidad text;

-- 2. Metadata estructurada en cabecera de presupuesto
--    Almacena CleaningQuoteIntake y, en el futuro, otros verticales.
--    Estructura esperada: { vertical, schemaVersion, intake: {...} }
--    Los presupuestos existentes quedan con metadata = NULL sin impacto.
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS metadata jsonb;
