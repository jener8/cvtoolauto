-- Down migration for 024_tighten_rls.sql
-- Restores 013-style NULL-or-owner policies and nullable user_id (no DEFAULT)
-- on the four product tables, and restores pre-024 interview_questions policies
-- (wide-open {public} true from fix-interview-questions-rls.sql era).
-- Does not null out orphan rows assigned by 024 (data-preserving).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Drop owner-only policies from 024 (product tables)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "folders_select_own" ON public.folders;
DROP POLICY IF EXISTS "folders_insert_own" ON public.folders;
DROP POLICY IF EXISTS "folders_update_own" ON public.folders;
DROP POLICY IF EXISTS "folders_delete_own" ON public.folders;

DROP POLICY IF EXISTS "resume_versions_select_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_insert_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_update_own" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_delete_own" ON public.resume_versions;

DROP POLICY IF EXISTS "job_applications_select_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_insert_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_update_own" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_delete_own" ON public.job_applications;

DROP POLICY IF EXISTS "cover_letters_select_own" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_insert_own" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_update_own" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_delete_own" ON public.cover_letters;

-- ---------------------------------------------------------------------------
-- 2) Restore nullable user_id (drop DEFAULT auth.uid()) — product tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.cover_letters
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.folders
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.job_applications
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.resume_versions
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Restore 013 NULL-or-owner policies — product tables
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4) interview_questions — drop Option C; restore prior wide-open policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "interview_questions_select_authenticated" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_insert_own" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_update_own" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_delete_own" ON public.interview_questions;

ALTER TABLE public.interview_questions
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id DROP NOT NULL;

-- Match create-interview-questions.sql + fix-interview-questions-rls.sql
DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;

CREATE POLICY "Anyone can view interview questions"
  ON public.interview_questions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert interview questions"
  ON public.interview_questions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete interview questions"
  ON public.interview_questions FOR DELETE
  USING (true);

CREATE POLICY "Anyone can update interview questions"
  ON public.interview_questions FOR UPDATE
  USING (true);

-- Note: orphan rows assigned by 024 are NOT reverted to NULL (data-preserving).

COMMIT;

NOTIFY pgrst, 'reload schema';
