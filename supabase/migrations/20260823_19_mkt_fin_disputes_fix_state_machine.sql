-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C FIX 4/5: state machine — lost → won (reversal post-chargeback)
-- WON después de LOST = CHARGEBACK_CREDIT que compensa el DEBIT previo.
-- Transición ausente bloqueaba el test D-18 con INVALID_TRANSITION.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public._mkt_validate_dispute_transition(
  p_current text,
  p_new     text
) RETURNS bool
  LANGUAGE sql IMMUTABLE
  SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_new = ANY(CASE p_current
    WHEN 'opened'             THEN ARRAY['needs_response','under_review','won','lost','accepted','cancelled']
    WHEN 'needs_response'     THEN ARRAY['evidence_submitted','lost','cancelled']
    WHEN 'evidence_submitted' THEN ARRAY['under_review','won','lost','cancelled']
    WHEN 'under_review'       THEN ARRAY['won','lost','cancelled']
    WHEN 'won'                THEN ARRAY['closed']
    WHEN 'lost'               THEN ARRAY['won','closed']   -- won = reversal post-chargeback
    WHEN 'accepted'           THEN ARRAY['closed']
    WHEN 'cancelled'          THEN ARRAY[]::text[]          -- terminal
    WHEN 'closed'             THEN ARRAY[]::text[]          -- terminal
    ELSE ARRAY[]::text[]
  END);
$$;

COMMIT;
