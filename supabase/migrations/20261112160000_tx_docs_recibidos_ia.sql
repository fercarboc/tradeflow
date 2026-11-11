-- TX-DOCS-3 — Datos extraídos con IA de un documento recibido (DeCA / hoja de ruta)
-- para rellenar expediciones automáticamente. Aditiva.
ALTER TABLE public.trade_transport_received_docs
  ADD COLUMN IF NOT EXISTS datos_extraidos jsonb,
  ADD COLUMN IF NOT EXISTS extraido_at     timestamptz;
