CREATE TABLE IF NOT EXISTS public.trade_client_errors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id      uuid REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  message     text NOT NULL,
  stack       text,
  page        text,
  url         text,
  user_agent  text,
  context     jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.trade_client_errors ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede leer (Admin panel)
CREATE POLICY "service_role_all" ON public.trade_client_errors
  FOR ALL TO service_role USING (true);

-- Usuarios autenticados pueden insertar sus propios errores
CREATE POLICY "authenticated_insert" ON public.trade_client_errors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Anon puede insertar (errores antes de login)
CREATE POLICY "anon_insert" ON public.trade_client_errors
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);;
