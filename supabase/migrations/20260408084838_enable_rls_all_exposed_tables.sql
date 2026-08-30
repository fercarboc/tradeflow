
-- ================================================
-- PASO 1: ACTIVAR RLS EN TODAS LAS TABLAS EXPUESTAS
-- GestionDebacuPro — Abril 2026
-- ================================================

-- 🔴 TABLAS CRÍTICAS (datos de huéspedes / RGPD)
ALTER TABLE public.debacu_eval_guest_index              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_identity_links                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_reservations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_reservation_identities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_org_guest_evidence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_org_guest_seen           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_manual_incidents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_alerts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_identity_risk_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_identity_risk_events     ENABLE ROW LEVEL SECURITY;

-- 🟠 TABLAS DE REVENUE / OPERACIONES
ALTER TABLE public.debacu_eval_reservation_daily_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_stay_nights               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_reservation_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_inventory_daily           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_unified_revenue_daily     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_segments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_insights          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_booking_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_price_changes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_revenue_sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_manual_checks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_manual_check_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_unified_import_rows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_unified_import_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_customer_org_map          ENABLE ROW LEVEL SECURITY;

-- 🟡 TABLAS BAJA PRIORIDAD
ALTER TABLE public.debacu_eval_guest_index_bak_20260314  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spain_hotels_master                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_contact_requests               ENABLE ROW LEVEL SECURITY;
;
