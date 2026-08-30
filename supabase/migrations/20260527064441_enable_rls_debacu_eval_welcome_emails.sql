-- Habilitar RLS en la tabla de cola de emails de debacu_eval.
-- Solo el service_role (edge functions) puede acceder. Ningún usuario anon ni authenticated tiene acceso directo.
ALTER TABLE public.debacu_eval_welcome_emails ENABLE ROW LEVEL SECURITY;;
