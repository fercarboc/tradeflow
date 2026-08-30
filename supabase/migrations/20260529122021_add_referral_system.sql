
-- Add referral columns to trade_organizations
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code text;

-- Function to generate a unique 6-char referral code
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM trade_organizations WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Assign referral codes to existing orgs
UPDATE trade_organizations
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Trigger to auto-assign referral code on new org creation
CREATE OR REPLACE FUNCTION trg_fn_assign_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON trade_organizations;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON trade_organizations
  FOR EACH ROW EXECUTE FUNCTION trg_fn_assign_referral_code();

-- Create trade_referrals table
CREATE TABLE IF NOT EXISTS trade_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  referred_org_id uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  reward_applied_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(referred_org_id)
);

-- RLS for trade_referrals
ALTER TABLE trade_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select ON trade_referrals
  FOR SELECT USING (
    referrer_org_id = ANY(_user_org_ids()) OR
    referred_org_id = ANY(_user_org_ids())
  );

-- Function to apply a referral code (extends trial 30 days for both)
CREATE OR REPLACE FUNCTION apply_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_org_id uuid;
  v_my_org_id uuid;
BEGIN
  -- Get referrer org by code
  SELECT id INTO v_referrer_org_id
  FROM trade_organizations
  WHERE referral_code = upper(trim(p_code));

  IF v_referrer_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código no válido');
  END IF;

  -- Get caller's org (must be owner)
  SELECT id INTO v_my_org_id
  FROM trade_organizations
  WHERE owner_id = auth.uid();

  IF v_my_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se encontró tu organización');
  END IF;

  -- Can't use own code
  IF v_referrer_org_id = v_my_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puedes usar tu propio código');
  END IF;

  -- Check if already referred (one per referred org)
  IF EXISTS(SELECT 1 FROM trade_referrals WHERE referred_org_id = v_my_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya utilizaste un código de invitación');
  END IF;

  -- Save referred_by_code on my org
  UPDATE trade_organizations
  SET referred_by_code = upper(trim(p_code))
  WHERE id = v_my_org_id;

  -- Record the referral
  INSERT INTO trade_referrals (referrer_org_id, referred_org_id, referral_code, reward_applied_at)
  VALUES (v_referrer_org_id, v_my_org_id, upper(trim(p_code)), now());

  -- Extend trial 30 days for both (from now or from current trial_end, whichever is later)
  UPDATE trade_subscriptions
  SET trial_end = GREATEST(COALESCE(trial_end, now()), now()) + interval '30 days',
      updated_at = now()
  WHERE org_id IN (v_referrer_org_id, v_my_org_id)
    AND status = 'trial';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_referral_code(text) TO authenticated;
;
