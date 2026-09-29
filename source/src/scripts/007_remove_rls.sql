-- Remove RLS and user_id requirements to allow simple password access

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can manage their own folders" ON folders;
DROP POLICY IF EXISTS "Users can manage their own resumes" ON resume_versions;
DROP POLICY IF EXISTS "Users can manage their own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can manage their own cover letters" ON cover_letters;

-- Disable RLS
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters DISABLE ROW LEVEL SECURITY;

-- Make user_id nullable since we don't use authentication
ALTER TABLE folders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE resume_versions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE job_applications ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE cover_letters ALTER COLUMN user_id DROP NOT NULL;
