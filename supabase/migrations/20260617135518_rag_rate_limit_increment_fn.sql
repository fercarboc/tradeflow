
CREATE OR REPLACE FUNCTION increment_rag_rate_limit(p_org_id uuid, p_date date)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO trade_rag_rate_limits (org_id, date, query_count, updated_at)
  VALUES (p_org_id, p_date, 1, NOW())
  ON CONFLICT (org_id, date) DO UPDATE SET
    query_count = trade_rag_rate_limits.query_count + 1,
    updated_at  = NOW();
$$;
;
