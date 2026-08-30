
-- Remove permissive anon policies on trade_quote_tokens
-- The edge function trade-quote-public uses service_role and validates the token server-side
DROP POLICY IF EXISTS "public read by token" ON trade_quote_tokens;
DROP POLICY IF EXISTS "public accept pending" ON trade_quote_tokens;
;
