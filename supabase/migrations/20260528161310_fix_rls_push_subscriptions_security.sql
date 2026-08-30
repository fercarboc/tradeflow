
-- Eliminar política peligrosa: qual=true expone todas las suscripciones a cualquier usuario autenticado
-- (el service_role bypasea RLS por defecto en Supabase, esta política era innecesaria y peligrosa)
DROP POLICY IF EXISTS "service role full access" ON trade_push_subscriptions;

-- Eliminar duplicado (conservamos "workers manage own push subscriptions")
DROP POLICY IF EXISTS "worker manage own subscriptions" ON trade_push_subscriptions;

-- Verificar que queda sólo la política correcta de workers
-- "workers manage own push subscriptions": ALL WHERE auth.uid() = worker_id
;
