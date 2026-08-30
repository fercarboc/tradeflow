
-- ================================================
-- CORREGIR VISTAS SECURITY DEFINER
-- Recrear con SECURITY INVOKER para que respeten
-- las políticas RLS del usuario consultante
-- GestionDebacuPro — Abril 2026
-- ================================================

-- 1. debacu_eval_audit_timeline_v
CREATE OR REPLACE VIEW public.debacu_eval_audit_timeline_v
  WITH (security_invoker = true) AS
SELECT 'MANUAL_CHECK'::text AS event_family,
    mc.id AS event_id,
    mc.org_id,
    mc.property_id,
    mc.performed_by_user_id AS actor_user_id,
    mc.identity_key,
    mc.current_risk_level AS risk_level,
    mc.created_at AS occurred_at,
    jsonb_build_object(
      'check_mode', mc.check_mode,
      'query_type', mc.query_type,
      'query_value_masked', mc.query_value_masked,
      'result_has_matches', mc.result_has_matches,
      'risk_changed', mc.risk_changed,
      'result_scope', mc.result_scope,
      'result_summary', mc.result_summary
    ) AS event_payload
  FROM debacu_eval_manual_checks mc
UNION ALL
SELECT 'MANUAL_INCIDENT'::text AS event_family,
    mi.id AS event_id,
    mi.org_id,
    mi.property_id,
    mi.created_by AS actor_user_id,
    mi.identity_key,
    NULL::debacu_eval_risk_level AS risk_level,
    mi.created_at AS occurred_at,
    jsonb_build_object(
      'incident_type', mi.incident_type,
      'severity', mi.severity,
      'source', mi.source,
      'incident_date', mi.incident_date,
      'economic_impact', mi.economic_impact,
      'status', mi.status
    ) AS event_payload
  FROM debacu_eval_manual_incidents mi
UNION ALL
SELECT 'RISK_EVENT'::text AS event_family,
    re.id AS event_id,
    re.org_id,
    re.property_id,
    re.actor_user_id,
    re.identity_key,
    re.new_risk_level AS risk_level,
    re.created_at AS occurred_at,
    jsonb_build_object(
      'event_type', re.event_type,
      'previous_risk_level', re.previous_risk_level,
      'new_risk_level', re.new_risk_level,
      'risk_delta', re.risk_delta,
      'payload', re.payload
    ) AS event_payload
  FROM debacu_eval_identity_risk_events re;

-- 2. debacu_eval_inventory_base_v
CREATE OR REPLACE VIEW public.debacu_eval_inventory_base_v
  WITH (security_invoker = true) AS
SELECT
    org_id,
    property_id,
    (sum(COALESCE(rooms_count, 0)))::integer AS rooms_available_base
  FROM debacu_eval_property_room_types
  WHERE is_active = true
  GROUP BY org_id, property_id;

-- 3. debacu_eval_inventory_daily_v
CREATE OR REPLACE VIEW public.debacu_eval_inventory_daily_v
  WITH (security_invoker = true) AS
SELECT
    d.org_id,
    d.property_id,
    d.stay_date,
    b.rooms_available_base AS rooms_available
  FROM (
    SELECT DISTINCT
        debacu_eval_revenue_daily.org_id,
        debacu_eval_revenue_daily.property_id,
        debacu_eval_revenue_daily.stay_date
      FROM debacu_eval_revenue_daily
  ) d
  JOIN debacu_eval_inventory_base_v b
    ON b.org_id = d.org_id AND b.property_id = d.property_id;

-- 4. debacu_eval_property_calendar_context_v
CREATE OR REPLACE VIEW public.debacu_eval_property_calendar_context_v
  WITH (security_invoker = true) AS
WITH season_days AS (
  SELECT
      s.org_id, s.property_id,
      (gs.gs)::date AS calendar_date,
      'SEASON'::text AS source_type,
      s.id AS source_id, s.name,
      s.season_type AS item_type, s.color, s.priority, s.impact_level,
      s.pricing_operation, s.pricing_adjustment_type, s.pricing_adjustment_value
    FROM debacu_eval_property_seasons s,
      LATERAL generate_series(
        (s.start_date)::timestamptz,
        (s.end_date)::timestamptz,
        '1 day'::interval
      ) gs(gs)
    WHERE s.is_active = true
),
event_days AS (
  SELECT
      e.org_id, e.property_id,
      (gs.gs)::date AS calendar_date,
      'EVENT'::text AS source_type,
      e.id AS source_id, e.name,
      e.event_type AS item_type, e.color, e.priority, e.impact_level,
      e.pricing_operation, e.pricing_adjustment_type, e.pricing_adjustment_value
    FROM debacu_eval_revenue_events e,
      LATERAL generate_series(
        (e.start_date)::timestamptz,
        (e.end_date)::timestamptz,
        '1 day'::interval
      ) gs(gs)
    WHERE e.is_active = true
),
unioned AS (
  SELECT * FROM season_days
  UNION ALL
  SELECT * FROM event_days
),
ranked AS (
  SELECT *,
      row_number() OVER (
        PARTITION BY property_id, calendar_date
        ORDER BY priority, source_type, name
      ) AS rn
    FROM unioned
)
SELECT
    org_id, property_id, calendar_date,
    source_type, source_id, name, item_type, color, priority, impact_level,
    pricing_operation, pricing_adjustment_type, pricing_adjustment_value
  FROM ranked
  WHERE rn = 1;

-- 5. debacu_eval_revenue_daily_property_v
CREATE OR REPLACE VIEW public.debacu_eval_revenue_daily_property_v
  WITH (security_invoker = true) AS
SELECT
    org_id,
    property_id,
    stay_date,
    (sum(COALESCE(rooms_sold, 0)))::integer AS rooms_sold,
    sum(COALESCE(revenue_rooms, 0::numeric)) AS revenue_rooms,
    sum(COALESCE(revenue_total, 0::numeric)) AS revenue_total,
    round(
      sum(COALESCE(revenue_rooms, 0::numeric))
      / NULLIF(sum(COALESCE(rooms_sold, 0)), 0)::numeric,
      2
    ) AS adr
  FROM debacu_eval_revenue_daily r
  GROUP BY org_id, property_id, stay_date;

-- 6. debacu_eval_revenue_daily_property_with_inventory_v
CREATE OR REPLACE VIEW public.debacu_eval_revenue_daily_property_with_inventory_v
  WITH (security_invoker = true) AS
SELECT
    r.org_id, r.property_id, r.stay_date,
    r.rooms_sold,
    i.rooms_available,
    r.revenue_rooms,
    r.revenue_total,
    r.adr,
    round(
      (r.rooms_sold::numeric / NULLIF(i.rooms_available, 0)::numeric) * 100::numeric,
      2
    ) AS occupancy_pct,
    round(
      r.revenue_rooms / NULLIF(i.rooms_available, 0)::numeric,
      2
    ) AS revpar
  FROM debacu_eval_revenue_daily_property_v r
  JOIN debacu_eval_inventory_daily_v i
    ON i.org_id = r.org_id
   AND i.property_id = r.property_id
   AND i.stay_date = r.stay_date;

-- 7. debacu_eval_revenue_daily_with_inventory_v
CREATE OR REPLACE VIEW public.debacu_eval_revenue_daily_with_inventory_v
  WITH (security_invoker = true) AS
SELECT
    r.org_id, r.property_id, r.stay_date,
    r.rooms_sold,
    i.rooms_available,
    r.revenue_rooms,
    r.adr,
    round(
      (r.rooms_sold::numeric / NULLIF(i.rooms_available, 0)::numeric) * 100::numeric,
      2
    ) AS occupancy_pct,
    round(
      r.revenue_rooms / NULLIF(i.rooms_available, 0)::numeric,
      2
    ) AS revpar
  FROM debacu_eval_revenue_daily r
  JOIN debacu_eval_inventory_daily_v i
    ON i.org_id = r.org_id
   AND i.property_id = r.property_id
   AND i.stay_date = r.stay_date;
;
