-- Add fit_scores and red_flags columns to job_applications table
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS fit_scores JSONB DEFAULT '{}';

ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]';
