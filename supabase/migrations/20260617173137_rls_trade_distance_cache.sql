
-- Enable RLS on trade_distance_cache
ALTER TABLE public.trade_distance_cache ENABLE ROW LEVEL SECURITY;

-- Only service_role can SELECT (cache reads happen server-side via edge functions)
CREATE POLICY "service_role_select" ON public.trade_distance_cache
  FOR SELECT USING (auth.role() = 'service_role');

-- Only service_role can INSERT
CREATE POLICY "service_role_insert" ON public.trade_distance_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service_role can UPDATE
CREATE POLICY "service_role_update" ON public.trade_distance_cache
  FOR UPDATE USING (auth.role() = 'service_role');

-- Only service_role can DELETE
CREATE POLICY "service_role_delete" ON public.trade_distance_cache
  FOR DELETE USING (auth.role() = 'service_role');
;
