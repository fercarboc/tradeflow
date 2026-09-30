-- ─────────────────────────────────────────────────────────────────────────────
-- TrabFlow — Seed de entorno local
-- NO contiene datos reales ni credenciales de producción.
--
-- PRERREQUISITO: Los usuarios auth deben existir en auth.users.
-- Crear con el script scripts/local_seed_users.ps1 antes de ejecutar esto.
--
-- EJECUCIÓN:
--   psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -f supabase/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────
-- NOTA: Las correcciones de generate_referral_code y su trigger
-- están en el baseline (00000000000000_local_baseline.sql) y se
-- aplican automáticamente en cada reconstrucción limpia.
-- Este archivo solo inserta datos de prueba.
-- ──────────────────────────────────────────────────────────────────

DO $seed$
DECLARE
  uid_prof   uuid;
  uid_emp    uuid;
  uid_eplus  uuid;
BEGIN
  -- Buscar los usuarios creados por local_seed_users.ps1
  SELECT id INTO uid_prof  FROM auth.users WHERE email = 'profesional@test.local';
  SELECT id INTO uid_emp   FROM auth.users WHERE email = 'empresa@test.local';
  SELECT id INTO uid_eplus FROM auth.users WHERE email = 'empresaplus@test.local';

  IF uid_prof IS NULL THEN
    RAISE EXCEPTION 'Usuario profesional@test.local no encontrado. Ejecutar scripts/local_seed_users.ps1 primero.';
  END IF;

  -- ── Organizaciones ──────────────────────────────────────────────
  INSERT INTO public.trade_organizations
    (id, owner_id, nombre, nif, oficio, plan, iva_default, is_onboarded)
  VALUES
    ('a1000000-0000-0000-0000-000000000001', uid_prof,
     'Instalaciones Martínez SL', 'B00000001', 'electricidad', 'profesional', 21, true),
    ('a2000000-0000-0000-0000-000000000002', uid_emp,
     'García Fontanería y Climatización', 'B00000002', 'fontaneria', 'empresa', 21, true),
    ('a3000000-0000-0000-0000-000000000003', uid_eplus,
     'López Servicios Integrales SL', 'B00000003', 'multiservicio', 'empresa_plus', 21, true)
  ON CONFLICT (id) DO NOTHING;

  -- ── Suscripciones ───────────────────────────────────────────────
  INSERT INTO public.trade_subscriptions (org_id, plan, status, billing_cycle, trial_end)
  VALUES
    ('a1000000-0000-0000-0000-000000000001', 'profesional', 'active', 'monthly', now() + interval '30 days'),
    ('a2000000-0000-0000-0000-000000000002', 'empresa',     'active', 'monthly', now() + interval '30 days'),
    ('a3000000-0000-0000-0000-000000000003', 'empresa_plus','active', 'monthly', now() + interval '30 days')
  ON CONFLICT DO NOTHING;

  -- ── Membresías owner ────────────────────────────────────────────
  -- El owner de cada org debe aparecer como miembro 'admin'.
  -- trade_organizations no tiene trigger que lo inserte automáticamente.
  INSERT INTO public.trade_org_members (org_id, user_id, rol, activo, email)
  VALUES
    ('a1000000-0000-0000-0000-000000000001', uid_prof,  'admin', true, 'profesional@test.local'),
    ('a2000000-0000-0000-0000-000000000002', uid_emp,   'admin', true, 'empresa@test.local'),
    ('a3000000-0000-0000-0000-000000000003', uid_eplus, 'admin', true, 'empresaplus@test.local')
  ON CONFLICT DO NOTHING;

  -- ── Clientes de prueba ───────────────────────────────────────────
  -- tipo_cliente válidos: particular, autonomo, empresa
  INSERT INTO public.trade_clients (id, org_id, nombre, email, telefono, tipo_cliente)
  VALUES
    ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
     'Juan Pérez Gómez', 'juan@cliente.test', '600100001', 'particular'),
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
     'Distribuciones Calle Mayor SL', 'calle.mayor@cliente.test', '600100002', 'empresa'),
    ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002',
     'Residencial Las Flores SL', 'residencial@cliente.test', '600200001', 'empresa'),
    ('b3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003',
     'María Sánchez López', 'maria@cliente.test', '600300001', 'particular')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Seed completado: 3 orgs, 3 suscripciones, 3 membresías, 4 clientes';
END $seed$;

-- ── Desactivar cron jobs en local ───────────────────────────────────────
-- Dos de los tres jobs (auto-churn-risk, trade-maintenance-billing-daily)
-- hacen net.http_post a dqqjaujnulutinskmqsu.supabase.co (producción).
-- El tercero (invoice-overdue-daily) solo actualiza la DB local, pero
-- se desactiva igualmente para evitar ruido con datos ficticios.
DO $cron_cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-churn-risk') THEN
    PERFORM cron.unschedule('auto-churn-risk');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trade-maintenance-billing-daily') THEN
    PERFORM cron.unschedule('trade-maintenance-billing-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-overdue-daily') THEN
    PERFORM cron.unschedule('invoice-overdue-daily');
  END IF;
  RAISE NOTICE 'Cron jobs de producción desactivados en entorno local';
END $cron_cleanup$;
