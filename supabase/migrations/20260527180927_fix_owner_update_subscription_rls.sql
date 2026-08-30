
-- Eliminar política que permite a cualquier usuario autenticado
-- actualizar campos críticos de su suscripción (plan, status, trial_end)
-- directamente con la anon key desde el navegador.
-- Todos los cambios legítimos de suscripción van por:
--   - Stripe webhook (service_role)
--   - RPCs SECURITY DEFINER del admin
--   - Edge functions admin con service_role
DROP POLICY IF EXISTS "owner_update_subscription" ON trade_subscriptions;
;
