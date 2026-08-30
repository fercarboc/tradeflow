
DROP VIEW IF EXISTS public.v_marketplace_invitations_safe;
CREATE VIEW public.v_marketplace_invitations_safe
  WITH (security_invoker = true)
AS
  SELECT id,
         actor_id,
         role_id,
         email,
         estado,
         expires_at,
         invited_by,
         created_at
  FROM public.trade_marketplace_invitations;

ALTER TABLE public.trade_marketplace_order_counters ENABLE ROW LEVEL SECURITY;
;
