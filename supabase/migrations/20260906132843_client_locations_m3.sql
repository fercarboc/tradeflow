-- M3: UNIQUE contrato activo por cliente + ubicación
-- PH0-MAINT-CLIENT-LOCATIONS-IMPL-1
--
-- Garantiza que no puede existir más de un contrato ACTIVO
-- para la misma (org_id, client_id, location_id).
--
-- WHERE location_id IS NOT NULL AND client_id IS NOT NULL:
--   excluye registros legacy sin location → sin conflictos con datos históricos.
-- WHERE estado = 'activo':
--   contratos cancelados/vencidos no cuentan → permite nuevo contrato
--   tras cancelar el anterior en la misma ubicación.

CREATE UNIQUE INDEX trade_maintenance_contratos_active_client_location_uidx
  ON public.trade_maintenance_contratos (org_id, client_id, location_id)
  WHERE location_id IS NOT NULL
    AND client_id IS NOT NULL
    AND estado = 'activo';
