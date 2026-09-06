-- Idempotency guard: prevent duplicate maintenance contracts from the same source presupuesto.
-- Partial index: only numbered contracts (those created by convertPresupuestoToContrato).
-- Legacy null-numero records from before this constraint are excluded intentionally.
CREATE UNIQUE INDEX trade_maintenance_contratos_presupuesto_numero_uidx
  ON public.trade_maintenance_contratos (presupuesto_id)
  WHERE presupuesto_id IS NOT NULL AND numero IS NOT NULL;
