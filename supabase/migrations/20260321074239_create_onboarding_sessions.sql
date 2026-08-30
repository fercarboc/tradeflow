
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.debacu_eval_organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  current_step TEXT NOT NULL DEFAULT 'SELECT_PMS'
    CHECK (current_step IN ('SELECT_PMS', 'SELECT_CONNECTION_TYPE', 'WIZARD_OAUTH', 'WIZARD_SYNC', 'COMPLETE', 'CSV_PROFILE')),
  pms_selected TEXT DEFAULT NULL,
  connection_type TEXT DEFAULT NULL
    CHECK (connection_type IS NULL OR connection_type IN ('API', 'CSV')),
  wizard_completed_at TIMESTAMPTZ DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_org_id ON public.onboarding_sessions(org_id);

-- RLS
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can see their onboarding session"
  ON public.onboarding_sessions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.debacu_eval_org_members
      WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "org members can update their onboarding session"
  ON public.onboarding_sessions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.debacu_eval_org_members
      WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "service role bypass onboarding sessions"
  ON public.onboarding_sessions
  USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_sessions_updated_at ON public.onboarding_sessions;
CREATE TRIGGER trg_onboarding_sessions_updated_at
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.onboarding_sessions IS 'Rastrea el progreso del wizard de onboarding PMS para cada organización nueva. Permite retomar si el usuario cierra el navegador.';
;
