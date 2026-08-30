
-- Permite al admin (fercarboc@gmail.com) crear y actualizar runs desde el panel UI
-- SELECT ya existe (auth_read_runs). Solo faltan INSERT y UPDATE.

CREATE POLICY "admin_insert_runs"
  ON public.trade_benchmark_runs
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'fercarboc@gmail.com');

CREATE POLICY "admin_update_runs"
  ON public.trade_benchmark_runs
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'fercarboc@gmail.com');
;
