-- 024_tighten_rls.sql
-- Test on DEV first. Apply to live only on explicit command ("apply 024 to live").
-- Pair: 024_tighten_rls_down.sql
--
-- Background (2026-10-02 read-only probe on live gpbqlxowvwosonatiuac):
--   * cover_letters / folders / job_applications / resume_versions:
--       user_id IS NULL counts were all 0
--       single distinct user_id = 310a80f1-618e-410a-87de-a40c950c98fc
--       profiles.email = jennygenerate@gmail.com
--   * interview_questions: shared board — Option C (authenticated SELECT all;
--       INSERT own via auth.uid(); UPDATE/DELETE own only; no anon)
--
-- Why NULL-or-owner existed: 013_enable_rls_security.sql allowed
--   (user_id IS NULL OR auth.uid() = user_id) so legacy/pre-auth rows stayed
--   visible until an optional backfill UPDATE (commented at end of 013).
--   007_remove_rls.sql had previously made user_id nullable. 014 / 017 are
--   restore/reassign scripts for Auth UUID drift, not the NULL allowance itself.
--
-- Orphan owner: resolve from profiles by email (DEV UUID may differ from live).
-- Fallback UUID (live probe): 310a80f1-618e-410a-87de-a40c950c98fc

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Resolve orphan owner + report NULL counts
-- ---------------------------------------------------------------------------
-- Ensure interview_questions exists (DEV may never have had the community table)
CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  author_name TEXT DEFAULT 'Anonymous',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  orphan_owner uuid;
  owner_email text := 'jennygenerate@gmail.com';
  resolved_email text;
  n_cl int; n_fo int; n_ja int; n_rv int; n_iq int;
  null_total int;
BEGIN
  -- Prefer profiles, then auth.users (DEV UUID often differs from live)
  SELECT id, email INTO orphan_owner, resolved_email
  FROM public.profiles
  WHERE lower(email) = lower(owner_email)
  LIMIT 1;

  IF orphan_owner IS NULL THEN
    SELECT id, email INTO orphan_owner, resolved_email
    FROM auth.users
    WHERE lower(email) = lower(owner_email)
    LIMIT 1;
  END IF;

  IF orphan_owner IS NULL THEN
    -- Live-known UUID only if that user exists in THIS project's auth.users
    IF EXISTS (
      SELECT 1 FROM auth.users WHERE id = '310a80f1-618e-410a-87de-a40c950c98fc'::uuid
    ) THEN
      orphan_owner := '310a80f1-618e-410a-87de-a40c950c98fc'::uuid;
      SELECT email INTO resolved_email FROM auth.users WHERE id = orphan_owner;
    END IF;
  END IF;

  SELECT COUNT(*) INTO n_cl FROM public.cover_letters WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_fo FROM public.folders WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_ja FROM public.job_applications WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_rv FROM public.resume_versions WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_iq FROM public.interview_questions WHERE user_id IS NULL;
  null_total := n_cl + n_fo + n_ja + n_rv + n_iq;

  RAISE NOTICE '024_tighten_rls: orphan owner % (%)', orphan_owner, coalesce(resolved_email, 'unresolved');
  RAISE NOTICE '024_tighten_rls: NULL user_id counts — cover_letters=%, folders=%, job_applications=%, resume_versions=%, interview_questions=%',
    n_cl, n_fo, n_ja, n_rv, n_iq;

  IF null_total > 0 AND orphan_owner IS NULL THEN
    RAISE EXCEPTION '024_tighten_rls: % NULL user_id row(s) need an owner, but jennygenerate@gmail.com was not found in profiles/auth.users on this project. Create the Auth user first.', null_total;
  END IF;

  CREATE TEMP TABLE _024_orphan_owner (id uuid PRIMARY KEY) ON COMMIT DROP;
  IF orphan_owner IS NOT NULL THEN
    INSERT INTO _024_orphan_owner (id) VALUES (orphan_owner);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Assign ownerless rows to the resolved app user
-- ---------------------------------------------------------------------------
UPDATE public.cover_letters
SET user_id = (SELECT id FROM _024_orphan_owner LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM _024_orphan_owner);

UPDATE public.folders
SET user_id = (SELECT id FROM _024_orphan_owner LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM _024_orphan_owner);

UPDATE public.job_applications
SET user_id = (SELECT id FROM _024_orphan_owner LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM _024_orphan_owner);

UPDATE public.resume_versions
SET user_id = (SELECT id FROM _024_orphan_owner LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM _024_orphan_owner);

UPDATE public.interview_questions
SET user_id = (SELECT id FROM _024_orphan_owner LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM _024_orphan_owner);

-- ---------------------------------------------------------------------------
-- 2) Drop loose authenticated policies from 013 (product tables)
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
-- 3) Require ownership + default new rows to auth.uid() (product tables)
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
-- 4) Owner-only policies (no NULL bypass) — product tables
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
-- 5) interview_questions — Option C (shared board, authenticated)
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user can read all rows
-- INSERT: authenticated; user_id must equal auth.uid(); DEFAULT auth.uid()
-- UPDATE/DELETE: own rows only
-- No anon policies

DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;
-- Idempotent drops if re-applied after a partial Option C attempt
DROP POLICY IF EXISTS "interview_questions_select_authenticated" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_insert_own" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_update_own" ON public.interview_questions;
DROP POLICY IF EXISTS "interview_questions_delete_own" ON public.interview_questions;

ALTER TABLE public.interview_questions
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

CREATE POLICY "interview_questions_select_authenticated"
  ON public.interview_questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "interview_questions_insert_own"
  ON public.interview_questions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "interview_questions_update_own"
  ON public.interview_questions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "interview_questions_delete_own"
  ON public.interview_questions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
