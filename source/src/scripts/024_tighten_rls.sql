-- 024_tighten_rls.sql
-- PROPOSAL ONLY — do NOT apply to live or DEV until explicitly approved.
-- Pair: 024_tighten_rls_down.sql
--
-- Background (2026-10-02 read-only probe on live gpbqlxowvwosonatiuac):
--   * cover_letters / folders / job_applications / resume_versions:
--       user_id IS NULL counts were all 0
--       single distinct user_id = 310a80f1-618e-410a-87de-a40c950c98fc
--       profiles.email = jennygenerate@gmail.com
--   * interview_questions: 4 shared-library rows, all user_id NULL,
--       policies currently {public} USING/WITH CHECK (true) — left PENDING below
--
-- Why NULL-or-owner existed: 013_enable_rls_security.sql allowed
--   (user_id IS NULL OR auth.uid() = user_id) so legacy/pre-auth rows stayed
--   visible until an optional backfill UPDATE (commented at end of 013).
--   007_remove_rls.sql had previously made user_id nullable. 014 / 017 are
--   restore/reassign scripts for Auth UUID drift, not the NULL allowance itself.
--
-- Test on DEV first. Apply to live only on explicit command.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Report: proposed orphan owner + current NULL counts (for approval)
-- ---------------------------------------------------------------------------
-- Proposed owner (from live profiles + app sign-in):
--   UUID:  310a80f1-618e-410a-87de-a40c950c98fc
--   email: jennygenerate@gmail.com
--
-- Re-check before applying (run as service role / SQL Editor):

DO $$
DECLARE
  orphan_owner uuid := '310a80f1-618e-410a-87de-a40c950c98fc'::uuid;
  owner_email text;
  n_cl int; n_fo int; n_ja int; n_rv int;
BEGIN
  SELECT email INTO owner_email FROM public.profiles WHERE id = orphan_owner;
  SELECT COUNT(*) INTO n_cl FROM public.cover_letters WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_fo FROM public.folders WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_ja FROM public.job_applications WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_rv FROM public.resume_versions WHERE user_id IS NULL;

  RAISE NOTICE '024_tighten_rls: proposed orphan owner % (%)', orphan_owner, coalesce(owner_email, 'no profiles.email');
  RAISE NOTICE '024_tighten_rls: NULL user_id counts — cover_letters=%, folders=%, job_applications=%, resume_versions=%',
    n_cl, n_fo, n_ja, n_rv;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Assign ownerless rows to the approved app user
-- ---------------------------------------------------------------------------
-- Safe when counts are already 0; still run so a later apply cannot leave orphans
-- before NOT NULL.

UPDATE public.cover_letters
SET user_id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
WHERE user_id IS NULL;

UPDATE public.folders
SET user_id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
WHERE user_id IS NULL;

UPDATE public.job_applications
SET user_id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
WHERE user_id IS NULL;

UPDATE public.resume_versions
SET user_id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
WHERE user_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Drop loose authenticated policies from 013
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "folders_select_authenticated" ON public.folders;
DROP POLICY IF EXISTS "folders_insert_authenticated" ON public.folders;
DROP POLICY IF EXISTS "folders_update_authenticated" ON public.folders;
DROP POLICY IF EXISTS "folders_delete_authenticated" ON public.folders;

DROP POLICY IF EXISTS "resume_versions_select_authenticated" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_insert_authenticated" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_update_authenticated" ON public.resume_versions;
DROP POLICY IF EXISTS "resume_versions_delete_authenticated" ON public.resume_versions;

DROP POLICY IF EXISTS "job_applications_select_authenticated" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_insert_authenticated" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_update_authenticated" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_delete_authenticated" ON public.job_applications;

DROP POLICY IF EXISTS "cover_letters_select_authenticated" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_insert_authenticated" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_update_authenticated" ON public.cover_letters;
DROP POLICY IF EXISTS "cover_letters_delete_authenticated" ON public.cover_letters;

-- ---------------------------------------------------------------------------
-- 3) Require ownership + default new rows to auth.uid()
-- ---------------------------------------------------------------------------
ALTER TABLE public.cover_letters
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.folders
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.job_applications
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.resume_versions
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Owner-only policies (no NULL bypass)
-- ---------------------------------------------------------------------------
CREATE POLICY "folders_select_own"
  ON public.folders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "folders_insert_own"
  ON public.folders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders_update_own"
  ON public.folders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders_delete_own"
  ON public.folders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "resume_versions_select_own"
  ON public.resume_versions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "resume_versions_insert_own"
  ON public.resume_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resume_versions_update_own"
  ON public.resume_versions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resume_versions_delete_own"
  ON public.resume_versions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "job_applications_select_own"
  ON public.job_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "job_applications_insert_own"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_applications_update_own"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_applications_delete_own"
  ON public.job_applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cover_letters_select_own"
  ON public.cover_letters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cover_letters_insert_own"
  ON public.cover_letters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cover_letters_update_own"
  ON public.cover_letters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cover_letters_delete_own"
  ON public.cover_letters FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) interview_questions — PENDING USER CHOICE (not applied)
-- ---------------------------------------------------------------------------
-- COMMENT: Confirm before uncommenting. Live has 4 community rows (user_id NULL).
-- Schema already has optional user_id (create-interview-questions.sql).
-- Current policies are wide-open {public} true (fix-interview-questions-rls.sql).
-- 014_drop_interview_questions.sql also exists if the feature should be removed.
--
-- Option A — per-user ownership (authenticated CRUD on own rows):
--   UPDATE public.interview_questions
--     SET user_id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
--     WHERE user_id IS NULL;
--   ALTER TABLE public.interview_questions
--     ALTER COLUMN user_id SET DEFAULT auth.uid(),
--     ALTER COLUMN user_id SET NOT NULL;
--   DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;
--   CREATE POLICY "interview_questions_select_own" ON public.interview_questions
--     FOR SELECT TO authenticated USING (auth.uid() = user_id);
--   CREATE POLICY "interview_questions_insert_own" ON public.interview_questions
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "interview_questions_update_own" ON public.interview_questions
--     FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "interview_questions_delete_own" ON public.interview_questions
--     FOR DELETE TO authenticated USING (auth.uid() = user_id);
--
-- Option B — shared library, authenticated read-only (safer default if kept public-ish):
--   DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
--   DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;
--   CREATE POLICY "interview_questions_select_authenticated" ON public.interview_questions
--     FOR SELECT TO authenticated USING (true);
--   -- no INSERT/UPDATE/DELETE for clients; maintain via SQL Editor / service role
--
-- Safer interim if you need a stop-gap before choosing A/B: enable Option B only
-- (closes anon write/delete while preserving read for signed-in app user).

COMMIT;

NOTIFY pgrst, 'reload schema';
