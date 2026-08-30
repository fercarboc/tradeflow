-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX: trade_doc_number_seq — RLS + revocación de acceso directo
-- Ref: Supabase Security Advisor "RLS Disabled in Public" en trade_doc_number_seq
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.trade_doc_number_seq ENABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.trade_doc_number_seq
  FROM authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.next_financial_doc_number(text) FROM PUBLIC;

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

COMMIT;;
