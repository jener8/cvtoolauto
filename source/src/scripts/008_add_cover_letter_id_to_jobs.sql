-- Add cover_letter_id column to job_applications table
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS cover_letter_id text;

-- Add resume_version_id column if it doesn't exist
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS resume_version_id text;
