
-- Remove completely open policy on trade_installer_needs
-- Chatbot edge function uses service_role (bypasses RLS), admin reads via authenticated session
DROP POLICY IF EXISTS "service_all" ON trade_installer_needs;

-- Admin-only SELECT
CREATE POLICY "admin_select" ON trade_installer_needs
  FOR SELECT
  TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');
;
