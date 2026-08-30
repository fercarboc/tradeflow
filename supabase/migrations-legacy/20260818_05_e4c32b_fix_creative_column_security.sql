-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.2b — Fix creative table-level grants → proper column-level security
-- ═══════════════════════════════════════════════════════════════════════════
-- ROOT CAUSE DISCOVERED:
--   pg_class.relacl shows authenticated=awd/postgres on
--   trade_marketplace_ad_creatives, meaning authenticated has TABLE-LEVEL
--   INSERT ('a'), UPDATE ('w'), and DELETE ('d') grants.
--
--   The column-level REVOKEs in migration 04 were no-ops: you cannot
--   restrict a column inherited from a table-level GRANT with a column-level
--   REVOKE.  The correct pattern is:
--     1. REVOKE the table-level privilege entirely.
--     2. Re-GRANT at column level for only the safe columns.
--
-- SAFE INSERT columns (supplier creates a DRAFT creative):
--   campaign_id, creative_mode, image_url, mobile_image_url, headline,
--   body_text, cta_text, alt_text, text_position, overlay_strength,
--   price_display, old_price_display, discount_label, theme_preset,
--   estado, activa, updated_at
--
-- SAFE UPDATE columns (supplier edits a DRAFT creative):
--   Same minus campaign_id (campaign is immutable once the creative exists).
--
-- EXCLUDED from both (admin / system writes only):
--   id, created_at   — auto-generated, never client-supplied
--   aprobada_por, aprobada_at  — written by future admin approval RPC (DEFINER)
--   submitted_at               — written only by submit_ad_creative_for_review (DEFINER)
--   ia_model, ia_prompt_ref    — AI pipeline metadata
--   generada_ia                — AI pipeline flag
--
-- IMPACT on admin client:
--   Admin form payload (AdCreativeForm) sends only safe columns.
--   Admin toggle-activa sends only activa+updated_at — both in safe set.
--   Admin approval RPC (future E4.D) will be SECURITY DEFINER → bypasses
--   column grants, so it can write aprobada_por/aprobada_at.
--
-- IMPACT on RLS policies:
--   No change — INSERT/UPDATE policies continue to use WITH CHECK to
--   enforce estado='DRAFT', activa=false, and campaign ownership.
--
-- INVARIANTE: publicidad ≠ ranking. No toca pricing, ranking ni scores.
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Remove the table-level INSERT, UPDATE, DELETE from authenticated.
--   DELETE was implicitly granted and suppliers have no business deleting
--   creatives; RLS already blocks it, but belt-and-suspenders.
REVOKE INSERT, UPDATE, DELETE
  ON public.trade_marketplace_ad_creatives
  FROM authenticated;

-- Step 2: Re-grant INSERT on safe supplier-writable columns only.
GRANT INSERT (
  campaign_id,
  creative_mode,
  image_url,
  mobile_image_url,
  headline,
  body_text,
  cta_text,
  alt_text,
  text_position,
  overlay_strength,
  price_display,
  old_price_display,
  discount_label,
  theme_preset,
  estado,
  activa,
  updated_at
) ON public.trade_marketplace_ad_creatives TO authenticated;

-- Step 3: Re-grant UPDATE on safe supplier-editable columns only.
--   campaign_id excluded: a creative's campaign association is immutable.
GRANT UPDATE (
  creative_mode,
  image_url,
  mobile_image_url,
  headline,
  body_text,
  cta_text,
  alt_text,
  text_position,
  overlay_strength,
  price_display,
  old_price_display,
  discount_label,
  theme_preset,
  estado,
  activa,
  updated_at
) ON public.trade_marketplace_ad_creatives TO authenticated;
