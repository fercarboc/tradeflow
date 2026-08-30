
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('trade-voices', 'trade-voices', false),
  ('trade-photos', 'trade-photos', false),
  ('trade-logos',  'trade-logos',  true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload voices to their folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own voices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
;
