
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS kb_actuaciones text[] DEFAULT NULL;

COMMENT ON COLUMN public.trade_quotes.kb_actuaciones IS 'IDs de actuaciones de la Base Maestra IA matcheadas al generar el presupuesto por voz';
;
