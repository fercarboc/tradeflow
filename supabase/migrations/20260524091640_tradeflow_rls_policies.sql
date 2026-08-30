
-- =====================================================================
-- TradeFlow AI — Row Level Security
-- =====================================================================

ALTER TABLE public.trade_organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_quote_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_photo_scans      ENABLE ROW LEVEL SECURITY;

-- trade_organizations
CREATE POLICY "Owner accede a su organización"
  ON public.trade_organizations FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- trade_clients
CREATE POLICY "Acceso a clientes propios"
  ON public.trade_clients FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- trade_quotes
CREATE POLICY "Acceso a presupuestos propios"
  ON public.trade_quotes FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- trade_quote_items
CREATE POLICY "Acceso a partidas propias"
  ON public.trade_quote_items FOR ALL
  USING (quote_id IN (
    SELECT q.id FROM public.trade_quotes q
    JOIN public.trade_organizations o ON q.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ))
  WITH CHECK (quote_id IN (
    SELECT q.id FROM public.trade_quotes q
    JOIN public.trade_organizations o ON q.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ));

-- trade_invoices
CREATE POLICY "Acceso a facturas propias"
  ON public.trade_invoices FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- trade_waitlist: insert público, sin lectura desde cliente
CREATE POLICY "Cualquiera puede unirse a la lista de espera"
  ON public.trade_waitlist FOR INSERT
  WITH CHECK (true);

-- trade_voice_recordings
CREATE POLICY "Acceso a grabaciones propias"
  ON public.trade_voice_recordings FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- trade_photo_scans
CREATE POLICY "Acceso a escaneos propios"
  ON public.trade_photo_scans FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));
;
