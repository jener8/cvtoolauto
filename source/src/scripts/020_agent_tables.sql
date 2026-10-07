-- Job agents v2 — additive schema (Phase 2)
-- Creates all six agent_* tables so later phases do not rename.
-- Run in Supabase Dashboard → SQL Editor (or apply via your usual migration path).
-- Pair: 020_agent_tables_down.sql

-- ---------------------------------------------------------------------------
-- 1. agent_profile_facts — atomic master-profile facts (confirm before use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_profile_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  fact_text text NOT NULL,
  status text NOT NULL DEFAULT 'unconfirmed'
    CHECK (status IN ('unconfirmed', 'confirmed')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('resume', 'qualification_profile', 'manual')),
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Idempotent seed key (resume/qualification imports). NULL for manual facts.
  source_key text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_profile_facts_text_nonempty CHECK (char_length(trim(fact_text)) > 0),
  -- NULL source_key allowed for manual facts (Postgres treats NULLs as distinct)
  CONSTRAINT agent_profile_facts_user_source_key_unique UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_profile_facts_user_id
  ON public.agent_profile_facts (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_profile_facts_user_status
  ON public.agent_profile_facts (user_id, status);

ALTER TABLE public.agent_profile_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_profile_facts_select_authenticated" ON public.agent_profile_facts;
DROP POLICY IF EXISTS "agent_profile_facts_insert_authenticated" ON public.agent_profile_facts;
DROP POLICY IF EXISTS "agent_profile_facts_update_authenticated" ON public.agent_profile_facts;
DROP POLICY IF EXISTS "agent_profile_facts_delete_authenticated" ON public.agent_profile_facts;

CREATE POLICY "agent_profile_facts_select_authenticated"
  ON public.agent_profile_facts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_profile_facts_insert_authenticated"
  ON public.agent_profile_facts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_profile_facts_update_authenticated"
  ON public.agent_profile_facts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_profile_facts_delete_authenticated"
  ON public.agent_profile_facts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. agent_search_settings — per-user search preferences (UI may come later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_search_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  location text NOT NULL DEFAULT 'Berlin',
  remote boolean NOT NULL DEFAULT false,
  languages text[] NOT NULL DEFAULT '{}'::text[],
  seniority text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_search_settings_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_search_settings_user_id
  ON public.agent_search_settings (user_id);

ALTER TABLE public.agent_search_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_search_settings_select_authenticated" ON public.agent_search_settings;
DROP POLICY IF EXISTS "agent_search_settings_insert_authenticated" ON public.agent_search_settings;
DROP POLICY IF EXISTS "agent_search_settings_update_authenticated" ON public.agent_search_settings;
DROP POLICY IF EXISTS "agent_search_settings_delete_authenticated" ON public.agent_search_settings;

CREATE POLICY "agent_search_settings_select_authenticated"
  ON public.agent_search_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_search_settings_insert_authenticated"
  ON public.agent_search_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_search_settings_update_authenticated"
  ON public.agent_search_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_search_settings_delete_authenticated"
  ON public.agent_search_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. agent_companies — normalized companies for listings + initiative apps
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_companies_name_nonempty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_agent_companies_user_id
  ON public.agent_companies (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_companies_user_normalized
  ON public.agent_companies (user_id, normalized_name);

ALTER TABLE public.agent_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_companies_select_authenticated" ON public.agent_companies;
DROP POLICY IF EXISTS "agent_companies_insert_authenticated" ON public.agent_companies;
DROP POLICY IF EXISTS "agent_companies_update_authenticated" ON public.agent_companies;
DROP POLICY IF EXISTS "agent_companies_delete_authenticated" ON public.agent_companies;

CREATE POLICY "agent_companies_select_authenticated"
  ON public.agent_companies FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_companies_insert_authenticated"
  ON public.agent_companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_companies_update_authenticated"
  ON public.agent_companies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_companies_delete_authenticated"
  ON public.agent_companies FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. agent_jobs — listings + initiative applications (single queue; no agent_queue)
-- Status (v2):
--   new → needs_manual_review | reviewing → changes_requested → approved
--       → sending (email undo window) → sent | rejected
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'listing'
    CHECK (kind IN ('listing', 'initiative')),
  company_id uuid REFERENCES public.agent_companies(id) ON DELETE SET NULL,
  apply_method text
    CHECK (apply_method IS NULL OR apply_method IN ('email', 'portal')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new',
      'needs_manual_review',
      'reviewing',
      'changes_requested',
      'approved',
      'sending',
      'sent',
      'rejected'
    )),
  title text,
  location text,
  language text,
  description text,
  url text,
  source text,
  posted_at date,
  raw_listing_text text,
  relevance jsonb NOT NULL DEFAULT '{}'::jsonb,
  reject_reason text,
  -- Email / initiative: Gmail message id after undo window closes
  gmail_message_id text,
  email_to text,
  -- When status entered 'sending' (30s undo for email)
  sending_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_id
  ON public.agent_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_status
  ON public.agent_jobs (user_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_company_id
  ON public.agent_jobs (company_id);

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_jobs_select_authenticated" ON public.agent_jobs;
DROP POLICY IF EXISTS "agent_jobs_insert_authenticated" ON public.agent_jobs;
DROP POLICY IF EXISTS "agent_jobs_update_authenticated" ON public.agent_jobs;
DROP POLICY IF EXISTS "agent_jobs_delete_authenticated" ON public.agent_jobs;

CREATE POLICY "agent_jobs_select_authenticated"
  ON public.agent_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_jobs_insert_authenticated"
  ON public.agent_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_jobs_update_authenticated"
  ON public.agent_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_jobs_delete_authenticated"
  ON public.agent_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. agent_drafts — tailored CV/cover + cited facts snapshot at draft time
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  cv_text text,
  cover_text text,
  -- Snapshot of cited facts ({id, text}…) for traceability after edit/delete
  cited_facts_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  fabrication_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_drafts_user_id
  ON public.agent_drafts (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_drafts_job_id
  ON public.agent_drafts (job_id);

ALTER TABLE public.agent_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_drafts_select_authenticated" ON public.agent_drafts;
DROP POLICY IF EXISTS "agent_drafts_insert_authenticated" ON public.agent_drafts;
DROP POLICY IF EXISTS "agent_drafts_update_authenticated" ON public.agent_drafts;
DROP POLICY IF EXISTS "agent_drafts_delete_authenticated" ON public.agent_drafts;

CREATE POLICY "agent_drafts_select_authenticated"
  ON public.agent_drafts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_drafts_insert_authenticated"
  ON public.agent_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_drafts_update_authenticated"
  ON public.agent_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_drafts_delete_authenticated"
  ON public.agent_drafts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. agent_activity — run logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'run',
  fetched integer NOT NULL DEFAULT 0,
  relevant integer NOT NULL DEFAULT 0,
  drafted integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_user_id
  ON public.agent_activity (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_activity_run_at
  ON public.agent_activity (user_id, run_at DESC);

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_activity_select_authenticated" ON public.agent_activity;
DROP POLICY IF EXISTS "agent_activity_insert_authenticated" ON public.agent_activity;
DROP POLICY IF EXISTS "agent_activity_update_authenticated" ON public.agent_activity;
DROP POLICY IF EXISTS "agent_activity_delete_authenticated" ON public.agent_activity;

CREATE POLICY "agent_activity_select_authenticated"
  ON public.agent_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_activity_insert_authenticated"
  ON public.agent_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_activity_update_authenticated"
  ON public.agent_activity FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_activity_delete_authenticated"
  ON public.agent_activity FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
