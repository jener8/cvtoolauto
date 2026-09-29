-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add folder_id column to resume_versions
ALTER TABLE resume_versions 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE CASCADE;

-- Add folder_id column to job_applications
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_resume_versions_folder_id ON resume_versions(folder_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_folder_id ON job_applications(folder_id);
