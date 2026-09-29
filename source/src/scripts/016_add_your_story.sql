-- Per-application internal positioning narrative ("Your Story")
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS your_story JSONB DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
