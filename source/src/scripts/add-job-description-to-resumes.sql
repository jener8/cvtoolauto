-- Add job_description column to resume_versions table
-- This stores the job description specific to each resume version/application

ALTER TABLE resume_versions 
ADD COLUMN IF NOT EXISTS job_description TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN resume_versions.job_description IS 'Job description specific to this resume version, used for tailoring the CV and cover letter';
