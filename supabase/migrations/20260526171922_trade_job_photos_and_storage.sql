
-- Storage bucket (public, 10MB max, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trade-job-photos', 'trade-job-photos', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job photos upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "job photos upload" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'trade-job-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job photos read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "job photos read" ON storage.objects
      FOR SELECT USING (bucket_id = 'trade-job-photos');
  END IF;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS trade_job_photos (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                  uuid NOT NULL REFERENCES trade_jobs(id) ON DELETE CASCADE,
  org_id                  uuid NOT NULL,
  uploaded_by_worker_id   uuid REFERENCES trade_workers(id),
  photo_url               text NOT NULL,
  caption                 text,
  created_at              timestamptz DEFAULT now()
);

-- Index for fast lookup by job
CREATE INDEX IF NOT EXISTS idx_trade_job_photos_job_id ON trade_job_photos(job_id);

-- RLS
ALTER TABLE trade_job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view job photos"
  ON trade_job_photos FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM trade_workers WHERE id = auth.uid() AND activo = true
      UNION
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "org members insert job photos"
  ON trade_job_photos FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM trade_workers WHERE id = auth.uid() AND activo = true
      UNION
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "org members delete own photos"
  ON trade_job_photos FOR DELETE
  USING (
    uploaded_by_worker_id = auth.uid()
    OR org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
  );
;
