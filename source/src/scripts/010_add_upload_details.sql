-- Application form answer drafts (salary, motivation, availability, etc.)
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS upload_details JSONB DEFAULT NULL;
