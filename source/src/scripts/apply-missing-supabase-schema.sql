-- Run once in Supabase Dashboard → SQL Editor for project gpbqlxowvwosonatiuac
-- Fixes PGRST204 errors when the app syncs resumes to the cloud.

-- resume_versions: styling
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS profile_photo_border BOOLEAN DEFAULT true;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_bg_color TEXT DEFAULT '#f8f9fa';
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_border_color TEXT DEFAULT '';

-- resume_versions: job description + embedded cover letter + version history
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS job_description TEXT;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS resume_cover_letter JSONB DEFAULT NULL;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS application_id UUID;

-- job_applications: upload details draft
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS upload_details JSONB DEFAULT NULL;

-- job_applications: internal positioning narrative
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS your_story JSONB DEFAULT NULL;

-- Refresh PostgREST schema cache (usually automatic within ~1 min)
NOTIFY pgrst, 'reload schema';
