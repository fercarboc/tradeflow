-- trade_email_rate_limits: control de frecuencia para emails públicos sin autenticación.
-- Clave: ip_hash + email_type + window_start (hora en curso, truncada a 1h).
-- La función check_and_increment_email_rate() hace INSERT … ON CONFLICT DO UPDATE atómico.
-- Nota de seguridad: almacenamos SHA-256 de la IP, nunca la IP en claro.
-- La Edge Function accede con SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.trade_email_rate_limits (
  id           bigserial    PRIMARY KEY,
  ip_hash      text         NOT NULL,
  email_type   text         NOT NULL,
  window_start timestamptz  NOT NULL,
  count        integer      NOT NULL DEFAULT 1,
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT trade_email_rate_limits_uq UNIQUE (ip_hash, email_type, window_start)
);

CREATE INDEX IF NOT EXISTS trade_email_rate_limits_window_idx
  ON public.trade_email_rate_limits (window_start);

ALTER TABLE public.trade_email_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_email_rate_limits FROM PUBLIC;
REVOKE ALL ON public.trade_email_rate_limits FROM anon;
REVOKE ALL ON public.trade_email_rate_limits FROM authenticated;

-- Limpieza de ventanas antiguas (>2h). Llamada con probabilidad 1/100 desde la función principal.
CREATE OR REPLACE FUNCTION public.cleanup_email_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.trade_email_rate_limits
  WHERE window_start < now() - interval '2 hours';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_email_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_email_rate_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_email_rate_limits() FROM authenticated;
-- La Edge Function usa SUPABASE_SERVICE_ROLE_KEY → service_role debe poder invocar la función.
GRANT EXECUTE ON FUNCTION public.cleanup_email_rate_limits() TO service_role;

-- check_and_increment_email_rate(ip_hash, email_type, max_per_hour)
-- Devuelve true si el envío está permitido (count <= max), false si excede el límite.
-- La operación INSERT … ON CONFLICT DO UPDATE es atómica en PostgreSQL.
CREATE OR REPLACE FUNCTION public.check_and_increment_email_rate(
  p_ip_hash   text,
  p_type      text,
  p_max       integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('hour', now());
  v_count  integer;
BEGIN
  IF random() < 0.01 THEN
    PERFORM public.cleanup_email_rate_limits();
  END IF;

  INSERT INTO public.trade_email_rate_limits (ip_hash, email_type, window_start, count)
  VALUES (p_ip_hash, p_type, v_window, 1)
  ON CONFLICT (ip_hash, email_type, window_start)
  DO UPDATE SET
    count      = public.trade_email_rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_email_rate(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_email_rate(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_email_rate(text, text, integer) FROM authenticated;
-- La Edge Function usa SUPABASE_SERVICE_ROLE_KEY → service_role debe poder invocar la función.
GRANT EXECUTE ON FUNCTION public.check_and_increment_email_rate(text, text, integer) TO service_role;
