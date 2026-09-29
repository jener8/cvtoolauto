-- Enable Row Level Security for CV Tool (project gpbqlxowvwosonatiuac)
--
-- Run in Supabase Dashboard → SQL Editor AFTER creating one Supabase Auth user
-- for the app (Authentication → Users → Add user):
--   Email: value of SUPABASE_APP_USER_EMAIL in your server env
--   Password: value of SUPABASE_APP_USER_PASSWORD in your server env
--
-- The app signs into this user after your normal username/password login.
-- Anonymous API access (public anon key, no session) is blocked.

-- ---------------------------------------------------------------------------
-- Drop legacy / conflicting policies (001 + 006 naming)
-- ---------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- folders
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.folders;

-- resume_versions
DROP POLICY IF EXISTS "Users can view their own resumes" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can update their own resumes" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON public.resume_versions;
DROP POLICY IF EXISTS "Users can manage their own resumes" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_select_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_insert_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_update_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_delete_own" ON public.resume_versions;

-- job_applications
DROP POLICY IF EXISTS "Users can view their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can insert their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can update their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can delete their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can manage their own applications" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_select_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_insert_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_update_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_delete_own" ON public.job_applications;

-- cover_letters
DROP POLICY IF EXISTS "Users can view their own cover letters" ON public.cover_letters;
DROP POLICY IF EXISTS "Users can insert their own cover letters" ON public.cover_letters;
DROP POLICY IF EXISTS "Users can update their own cover letters" ON public.cover_letters;
DROP POLICY IF EXISTS "Users can delete their own cover letters" ON public.cover_letters;
DROP POLICY IF EXISTS "Users can manage their own cover letters" ON public.cover_letters;

-- ---------------------------------------------------------------------------
-- Enable RLS (no anon policies → unauthenticated API access is denied)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Shared helper: legacy rows may have user_id NULL until backfilled
-- ---------------------------------------------------------------------------

-- profiles
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- folders
CREATE POLICY "folders_select_authenticated"
  ON public.folders FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "folders_insert_authenticated"
  ON public.folders FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "folders_update_authenticated"
  ON public.folders FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "folders_delete_authenticated"
  ON public.folders FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- resume_versions
CREATE POLICY "resume_versions_select_authenticated"
  ON public.resume_versions FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "resume_versions_insert_authenticated"
  ON public.resume_versions FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "resume_versions_update_authenticated"
  ON public.resume_versions FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "resume_versions_delete_authenticated"
  ON public.resume_versions FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- job_applications
CREATE POLICY "job_applications_select_authenticated"
  ON public.job_applications FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "job_applications_insert_authenticated"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "job_applications_update_authenticated"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "job_applications_delete_authenticated"
  ON public.job_applications FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- cover_letters
CREATE POLICY "cover_letters_select_authenticated"
  ON public.cover_letters FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "cover_letters_insert_authenticated"
  ON public.cover_letters FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "cover_letters_update_authenticated"
  ON public.cover_letters FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "cover_letters_delete_authenticated"
  ON public.cover_letters FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Optional: attach existing NULL user_id rows to your app service user
-- (uncomment and replace the UUID after creating the Supabase Auth user)
-- UPDATE folders SET user_id = 'YOUR-SUPABASE-AUTH-USER-UUID' WHERE user_id IS NULL;
-- UPDATE resume_versions SET user_id = 'YOUR-SUPABASE-AUTH-USER-UUID' WHERE user_id IS NULL;
-- UPDATE job_applications SET user_id = 'YOUR-SUPABASE-AUTH-USER-UUID' WHERE user_id IS NULL;
-- UPDATE cover_letters SET user_id = 'YOUR-SUPABASE-AUTH-USER-UUID' WHERE user_id IS NULL;

NOTIFY pgrst, 'reload schema';
