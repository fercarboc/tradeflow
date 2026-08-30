
CREATE TABLE IF NOT EXISTS public.trade_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  client_id       uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  estado          text NOT NULL DEFAULT 'planificado',
  prioridad       text NOT NULL DEFAULT 'normal',
  fecha_inicio    date,
  hora_inicio     time,
  fecha_fin       date,
  hora_fin        time,
  duracion_horas  numeric(4,1),
  direccion       text,
  localidad       text,
  cp              text,
  latitud         numeric(9,6),
  longitud        numeric(9,6),
  completado_por  uuid REFERENCES public.trade_workers(id) ON DELETE SET NULL,
  completado_at   timestamptz,
  notas_cierre    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_jobs_org_id    ON public.trade_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_jobs_fecha     ON public.trade_jobs(org_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_trade_jobs_estado    ON public.trade_jobs(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_trade_jobs_client_id ON public.trade_jobs(client_id);

ALTER TABLE public.trade_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso a trabajos propios" ON public.trade_jobs;
CREATE POLICY "Acceso a trabajos propios"
  ON public.trade_jobs FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.trade_job_workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.trade_jobs(id) ON DELETE CASCADE,
  worker_id   uuid NOT NULL REFERENCES public.trade_workers(id) ON DELETE CASCADE,
  rol         text NOT NULL DEFAULT 'asignado',
  notificado  boolean NOT NULL DEFAULT false,
  aceptado    boolean,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_job_workers_job    ON public.trade_job_workers(job_id);
CREATE INDEX IF NOT EXISTS idx_trade_job_workers_worker ON public.trade_job_workers(worker_id);

ALTER TABLE public.trade_job_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso a asignaciones propias" ON public.trade_job_workers;
CREATE POLICY "Acceso a asignaciones propias"
  ON public.trade_job_workers FOR ALL
  USING (job_id IN (
    SELECT j.id FROM public.trade_jobs j
    JOIN public.trade_organizations o ON j.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ))
  WITH CHECK (job_id IN (
    SELECT j.id FROM public.trade_jobs j
    JOIN public.trade_organizations o ON j.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ));

CREATE OR REPLACE TRIGGER trg_trade_jobs_updated
  BEFORE UPDATE ON public.trade_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();
;
