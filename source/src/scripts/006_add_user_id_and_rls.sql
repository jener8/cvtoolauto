-- Add user_id to folders table and enable RLS
ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Folders RLS policies
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- Update resume_versions RLS (table already has user_id)
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resumes" ON resume_versions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes" ON resume_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" ON resume_versions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" ON resume_versions
  FOR DELETE USING (auth.uid() = user_id);

-- Update job_applications RLS (table already has user_id)
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job applications" ON job_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job applications" ON job_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job applications" ON job_applications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job applications" ON job_applications
  FOR DELETE USING (auth.uid() = user_id);

-- Add user_id to cover_letters and enable RLS
ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cover letters" ON cover_letters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cover letters" ON cover_letters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cover letters" ON cover_letters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cover letters" ON cover_letters
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_folder_id ON resume_versions(folder_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_folder_id ON job_applications(folder_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_folder_id ON cover_letters(folder_id);
