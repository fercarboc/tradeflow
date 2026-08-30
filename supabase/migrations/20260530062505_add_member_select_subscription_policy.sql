
-- Allow org members (workers, admins, etc.) to read their org's subscription
CREATE POLICY "member_select_subscription"
ON public.trade_subscriptions
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.trade_org_members
    WHERE user_id = auth.uid() AND activo = true
  )
);
;
