
-- ================================================
-- PASO 2B: POLÍTICAS — TABLAS CON org_id DIRECTO
-- Patrón: SELECT para miembros de la org
-- INSERT/UPDATE/DELETE: solo service_role (Edge Functions)
-- ================================================

-- debacu_eval_alerts (org_id ✓)
CREATE POLICY "org_select_alerts"
  ON public.debacu_eval_alerts
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_reservations (org_id ✓)
CREATE POLICY "org_select_reservations"
  ON public.debacu_eval_reservations
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_reservation_identities (org_id ✓)
CREATE POLICY "org_select_reservation_identities"
  ON public.debacu_eval_reservation_identities
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_org_guest_evidence (org_id ✓)
CREATE POLICY "org_select_org_guest_evidence"
  ON public.debacu_eval_org_guest_evidence
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_org_guest_seen (org_id ✓)
CREATE POLICY "org_select_org_guest_seen"
  ON public.debacu_eval_org_guest_seen
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_manual_incidents (org_id ✓)
CREATE POLICY "org_select_manual_incidents"
  ON public.debacu_eval_manual_incidents
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_identity_risk_events (org_id ✓)
CREATE POLICY "org_select_identity_risk_events"
  ON public.debacu_eval_identity_risk_events
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_reservation_daily_ledger (org_id ✓)
CREATE POLICY "org_select_reservation_daily_ledger"
  ON public.debacu_eval_reservation_daily_ledger
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_stay_nights (org_id ✓)
CREATE POLICY "org_select_stay_nights"
  ON public.debacu_eval_stay_nights
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_reservation_snapshots (org_id ✓)
CREATE POLICY "org_select_reservation_snapshots"
  ON public.debacu_eval_reservation_snapshots
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_inventory_daily (org_id ✓)
CREATE POLICY "org_select_inventory_daily"
  ON public.debacu_eval_inventory_daily
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_unified_revenue_daily (org_id ✓)
CREATE POLICY "org_select_unified_revenue_daily"
  ON public.debacu_eval_unified_revenue_daily
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_channels (org_id ✓)
CREATE POLICY "org_select_revenue_channels"
  ON public.debacu_eval_revenue_channels
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_segments (org_id ✓)
CREATE POLICY "org_select_revenue_segments"
  ON public.debacu_eval_revenue_segments
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_insights (org_id ✓)
CREATE POLICY "org_select_revenue_insights"
  ON public.debacu_eval_revenue_insights
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_booking_lines (org_id ✓)
CREATE POLICY "org_select_revenue_booking_lines"
  ON public.debacu_eval_revenue_booking_lines
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_price_changes (org_id ✓)
CREATE POLICY "org_select_revenue_price_changes"
  ON public.debacu_eval_revenue_price_changes
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_revenue_sales (org_id ✓)
CREATE POLICY "org_select_revenue_sales"
  ON public.debacu_eval_revenue_sales
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_manual_checks (org_id ✓)
CREATE POLICY "org_select_manual_checks"
  ON public.debacu_eval_manual_checks
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_manual_check_results (org_id ✓)
CREATE POLICY "org_select_manual_check_results"
  ON public.debacu_eval_manual_check_results
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_unified_import_rows (org_id ✓)
CREATE POLICY "org_select_unified_import_rows"
  ON public.debacu_eval_unified_import_rows
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_unified_import_batches (org_id ✓)
CREATE POLICY "org_select_unified_import_batches"
  ON public.debacu_eval_unified_import_batches
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_customer_org_map (org_id ✓)
CREATE POLICY "org_select_customer_org_map"
  ON public.debacu_eval_customer_org_map
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));
;
