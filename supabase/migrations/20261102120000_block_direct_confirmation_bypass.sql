-- TX-MC-1 SECURITY — Bloqueo de confirmación directa via PostgREST
--
-- VULNERABILIDAD IDENTIFICADA (2026-11-02):
--   Las políticas RLS trips_update_org_admin / tts_update solo comprueban
--   pertenencia a la org (owner/admin). No restringen el valor del campo estado.
--
--   Un usuario autenticado con rol admin/owner puede ejecutar:
--     PATCH /rest/v1/trade_transport_trips?id=eq.{id}
--     { "estado": "confirmado" }
--   Esto activa el trigger FSM y el trigger operacional, pero omite:
--     · SELECT FOR UPDATE sobre trade_vehicles y trade_workers
--     · Check cross-table contra trade_transport_services
--
--   Resultado: double-booking cross-table posible para orgs combinadas.
--   Los EXCLUDE constraints (within-table) SÍ actúan como backstop,
--   pero no cubren el solapamiento trips↔services.
--
-- SOLUCIÓN:
--   Triggers SECURITY INVOKER BEFORE UPDATE OF estado que bloquean la
--   transición borrador→confirmado cuando current_user es 'authenticated'
--   o 'anon' (canal PostgREST directo).
--
--   Las RPCs confirm_transport_trip / confirm_transport_service son
--   SECURITY DEFINER y se ejecutan como 'postgres' (propietario de las
--   funciones). Cuando esas RPCs hacen el UPDATE interno, current_user='postgres'
--   → el trigger pasa. PostgREST envía el UPDATE como 'authenticated'
--   → el trigger bloquea.
--
--   service_role (operaciones admin server-side) no está bloqueado —
--   es acceso de nivel de administrador, nunca expuesto al cliente.
--
-- IMPACTO SOBRE OPERACIONES EXISTENTES:
--   · INSERT trips/services en borrador: no afectado (INSERT, no UPDATE)
--   · UPDATE de campos en borrador (titulo, fechas, observaciones): no afectado
--     (el trigger solo dispara en UPDATE OF estado, y solo bloquea confirmado)
--   · Transición confirmado→en_curso (startTransportTrip direct UPDATE):
--     NEW.estado='en_curso' ≠ 'confirmado' → NO bloqueado
--   · Cancelación (UPDATE estado='cancelado'): no bloqueado
--   · complete_transport_trip RPC: no bloqueado (SECURITY DEFINER → postgres)
--   · Viajeros (trade_transport_services): misma lógica

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Bloqueo en trade_transport_trips
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._prevent_direct_trip_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER (default): current_user = rol del llamante, NO del propietario
-- de esta función. Esto es deliberado: necesitamos ver si el llamante es
-- 'authenticated' (PostgREST) o 'postgres' (RPC SECURITY DEFINER).
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Interceptar únicamente la transición borrador → confirmado
  IF NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado' THEN
    -- current_user = 'authenticated' | 'anon' → POST directo de PostgREST → bloquear
    -- current_user = 'postgres' → llamada interna desde confirm_transport_trip() → permitir
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION
        'TRANSPORT_FORBIDDEN: la transición a confirmado está restringida a la RPC confirm_transport_trip(). '
        'Acceso directo via REST bloqueado para garantizar integridad cross-table.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._prevent_direct_trip_confirmation() FROM PUBLIC;

-- Disparar solo cuando estado cambia (BEFORE UPDATE OF estado)
CREATE TRIGGER trg_ttt_block_direct_confirmation
  BEFORE UPDATE OF estado ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._prevent_direct_trip_confirmation();

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Bloqueo en trade_transport_services
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._prevent_direct_service_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER   -- mismo razonamiento que arriba
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION
        'TRANSPORT_FORBIDDEN: la transición a confirmado está restringida a la RPC confirm_transport_service(). '
        'Acceso directo via REST bloqueado para garantizar integridad cross-table.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._prevent_direct_service_confirmation() FROM PUBLIC;

CREATE TRIGGER trg_tts_block_direct_confirmation
  BEFORE UPDATE OF estado ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._prevent_direct_service_confirmation();
