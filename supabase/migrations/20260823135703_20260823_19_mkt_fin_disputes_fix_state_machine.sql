-- FIX: _mkt_validate_dispute_transition — lost → won debe ser válido.
-- WON post-chargeback: proveedor apela y gana tras chargeback posteado.
-- Económicamente: CHARGEBACK_CREDIT revierte el CHARGEBACK_DEBIT.
-- D-26 sigue bloqueando lost → under_review (no está en el array).

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
    WHEN 'lost'               THEN ARRAY['won','closed']   -- FIX: won = reversal post-chargeback
    WHEN 'accepted'           THEN ARRAY['closed']
    WHEN 'cancelled'          THEN ARRAY[]::text[]          -- terminal
    WHEN 'closed'             THEN ARRAY[]::text[]          -- terminal
    ELSE ARRAY[]::text[]
  END);
$$;

COMMIT;
;
