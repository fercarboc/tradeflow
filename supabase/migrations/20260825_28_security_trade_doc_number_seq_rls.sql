-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX: trade_doc_number_seq — RLS + revocación de acceso directo
-- Ref: Supabase Security Advisor "RLS Disabled in Public" en trade_doc_number_seq
--
-- CAUSA DEL AVISO:
--   1. trade_doc_number_seq tenía RLS desactivado (relrowsecurity = false).
--   2. El rol authenticated tenía arwd (INSERT+SELECT+UPDATE+DELETE) directos.
--   3. next_financial_doc_number() tenía EXECUTE concedida a PUBLIC (=X/postgres),
--      permitiendo que anon/authenticated la invocaran directamente y consumieran
--      números de secuencia de cualquier serie sin pasar por ningún flujo legítimo.
--
-- RIESGO:
--   Un usuario autenticado podía:
--     a) Leer o modificar el contador de cualquier serie (TF, MKP, ADV, etc.)
--     b) Forzar saltos de numeración llamando a next_financial_doc_number('TF')
--     c) Crear series fraudulentas: next_financial_doc_number('FAKE')
--     d) Consultar el estado interno de la numeración documental
--
-- SOLUCIÓN — mínimo privilegio:
--   1. ENABLE ROW LEVEL SECURITY sin policies → deny-by-default para non-owners
--   2. REVOKE acceso directo a authenticated y anon
--   3. REVOKE EXECUTE de PUBLIC en next_financial_doc_number()
--
-- POR QUÉ NO SE ROMPE NADA:
--   next_financial_doc_number() es SECURITY DEFINER (owner = postgres).
--   Las funciones SECURITY DEFINER ejecutan como su owner, no como el rol invocante.
--   postgres (owner) siempre está exento de RLS (sin FORCE ROW SECURITY).
--   Todos los consumidores son SECURITY DEFINER RPCs o triggers de sistema,
--   por lo que no requieren privilegios de rol sobre la tabla en absoluto.
--
--   Consumidores confirmados (todos SECURITY DEFINER):
--     - next_financial_doc_number()          → propietario de la tabla
--     - _mkt_fin_master_order_numero() trig  → serie MKP
--     - trg_fn_financial_doc_number() / RPCs → serie TF, ADV
--     - mkt_fin_create_refund()              → serie RF
--     - mkt_fin_create_dispute() y fixes     → serie DI
--     - mkt_fin_negative_balance_recovery()  → serie RC
--     - mkt_fin_create_reserve()             → serie RSV
--     - mkt_fin_calculate_settlement_lines() → serie SETL
--
-- SERIES ACTIVAS EN PRODUCCIÓN (a fecha de esta migración):
--   TF-2026: 6 documentos · ADV-2026: 3 documentos · MKP-2026: 7 pedidos
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Habilitar RLS ─────────────────────────────────────────────────────────
-- Sin policies → deny-by-default para todos los roles que no sean el owner.
-- postgres (owner de la tabla y de next_financial_doc_number) queda exento.
ALTER TABLE public.trade_doc_number_seq ENABLE ROW LEVEL SECURITY;

-- ── 2. Revocar acceso directo a la tabla ─────────────────────────────────────
-- authenticated tenía INSERT+SELECT+UPDATE+DELETE (arwd) por default de Supabase.
-- anon no tenía grant explícito pero se revoca por defensa en profundidad.
-- Toda operación legítima sobre la tabla pasa por next_financial_doc_number()
-- (SECURITY DEFINER, owner=postgres), que no requiere privilegios de rol.
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.trade_doc_number_seq
  FROM authenticated, anon;

-- ── 3. Revocar EXECUTE de PUBLIC en next_financial_doc_number ────────────────
-- PostgreSQL concede EXECUTE a PUBLIC por defecto al crear cualquier función.
-- Los únicos invocantes legítimos son SECURITY DEFINER RPCs/triggers (=postgres)
-- y service_role para operaciones administrativas directas.
-- authenticated/anon no deben poder generar números documentales directamente.
REVOKE EXECUTE ON FUNCTION public.next_financial_doc_number(text) FROM PUBLIC;

-- service_role mantiene EXECUTE (concedido en migración 20260820_01).
-- postgres (owner) mantiene acceso completo como propietario.

-- ── 4. Documentar invariante de seguridad ────────────────────────────────────
COMMENT ON TABLE public.trade_doc_number_seq IS
  'Secuencia interna de numeración documental por (serie, año) → último número asignado. '
  'RLS habilitado sin policies: deny-by-default para authenticated/anon. '
  'ÚNICO acceso legítimo: public.next_financial_doc_number(p_serie) [SECURITY DEFINER, owner=postgres]. '
  'Las funciones SECURITY DEFINER ejecutan como postgres y bypasan RLS automáticamente. '
  'Protege contra: manipulación directa de contadores, saltos de numeración, '
  'creación de series fraudulentas, lectura del estado interno de numeración. '
  'Series activas: TF (facturas TrabFlow), ADV (publicidad), MKP (pedidos marketplace), '
  'RF (reembolsos), DI (disputas), RC (recuperaciones), RSV (reservas), SETL (liquidaciones). '
  'LEGAL_GATE OPEN · TAX_GATE OPEN · NO FISCAL.';

COMMIT;
