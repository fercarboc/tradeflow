
-- E4.C.3.1 — Harden supplier creative submission: enforce activa=false

DROP POLICY IF EXISTS "ad_creatives_supplier_insert" ON public.trade_marketplace_ad_creatives;

CREATE POLICY "ad_creatives_supplier_insert"
ON public.trade_marketplace_ad_creatives
FOR INSERT TO authenticated
WITH CHECK (
  estado     = 'DRAFT'
  AND activa = false
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
      AND  estado   = 'DRAFT'
  )
);

DROP POLICY IF EXISTS "ad_creatives_supplier_update" ON public.trade_marketplace_ad_creatives;

CREATE POLICY "ad_creatives_supplier_update"
ON public.trade_marketplace_ad_creatives
FOR UPDATE TO authenticated
USING (
  estado     = 'DRAFT'
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
)
WITH CHECK (
  estado     = 'DRAFT'
  AND activa = false
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
);

CREATE OR REPLACE FUNCTION public.submit_ad_creative_for_review(
  p_creative_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid;
  v_creative_est text;
BEGIN
  SELECT c.actor_id, cr.estado::text
  INTO   v_actor_id, v_creative_est
  FROM   public.trade_marketplace_ad_creatives cr
  JOIN   public.trade_marketplace_ad_campaigns  c ON c.id = cr.campaign_id
  WHERE  cr.id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_creative_est <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden enviar creatividades en estado DRAFT (estado actual: %)', v_creative_est;
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET    estado       = 'PENDING_APPROVAL',
         activa       = false,
         submitted_at = now(),
         updated_at   = now()
  WHERE  id = p_creative_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_creative_for_review(uuid) TO authenticated;
;
