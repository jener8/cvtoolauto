-- pre-job-agent schema snapshot
-- Generated: 2026-09-29T14:24:36Z
-- Source: EquitAI / CV by Design Supabase migration scripts in source/src/scripts/
-- Schema/DDL only. No user data. Live pg_dump unavailable (no supabase/pg_dump CLI).
-- Excluded data scripts: 014_reassign_*, 017_post_restore_*, 018_backfill_*, 019_backfill_*


-- =============================================================================
-- FILE: source/src/scripts/001_create_tables.sql
-- =============================================================================

-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Create resume_versions table
create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  resume_text text not null,
  contact_info jsonb not null default '{}'::jsonb,
  profile_image text,
  company_logo text,
  accent_color text default '#84cc16',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.resume_versions enable row level security;

create policy "resume_versions_select_own"
  on public.resume_versions for select
  using (auth.uid() = user_id);

create policy "resume_versions_insert_own"
  on public.resume_versions for insert
  with check (auth.uid() = user_id);

create policy "resume_versions_update_own"
  on public.resume_versions for update
  using (auth.uid() = user_id);

create policy "resume_versions_delete_own"
  on public.resume_versions for delete
  using (auth.uid() = user_id);

-- Create job_applications table
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  company text not null,
  status text not null default 'applied',
  job_description jsonb,
  why_content jsonb,
  company_info jsonb,
  cover_letter jsonb,
  contacts jsonb,
  interview_prep jsonb,
  job_strategy jsonb,
  applied_date timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.job_applications enable row level security;

create policy "job_applications_select_own"
  on public.job_applications for select
  using (auth.uid() = user_id);

create policy "job_applications_insert_own"
  on public.job_applications for insert
  with check (auth.uid() = user_id);

create policy "job_applications_update_own"
  on public.job_applications for update
  using (auth.uid() = user_id);

create policy "job_applications_delete_own"
  on public.job_applications for delete
  using (auth.uid() = user_id);


-- =============================================================================
-- FILE: source/src/scripts/002_profile_trigger.sql
-- =============================================================================

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- =============================================================================
-- FILE: source/src/scripts/004_create_folders.sql
-- =============================================================================

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


-- =============================================================================
-- FILE: source/src/scripts/005_create_cover_letters.sql
-- =============================================================================

-- Create cover_letters table for standalone cover letters (not tied to job applications)
CREATE TABLE IF NOT EXISTS cover_letters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content_en TEXT,
  content_de TEXT,
  contact_person_name TEXT,
  folder_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);


-- =============================================================================
-- FILE: source/src/scripts/006_add_user_id_and_rls.sql
-- =============================================================================

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


-- =============================================================================
-- FILE: source/src/scripts/007_remove_rls.sql
-- =============================================================================

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


-- =============================================================================
-- FILE: source/src/scripts/008_add_cover_letter_id_to_jobs.sql
-- =============================================================================

-- Add cover_letter_id column to job_applications table
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS cover_letter_id text;

-- Add resume_version_id column if it doesn't exist
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS resume_version_id text;


-- =============================================================================
-- FILE: source/src/scripts/009_add_fit_scores_and_red_flags.sql
-- =============================================================================

-- Add fit_scores and red_flags columns to job_applications table
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS fit_scores JSONB DEFAULT '{}';

ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]';


-- =============================================================================
-- FILE: source/src/scripts/010_add_resume_style_columns.sql
-- =============================================================================

alter table resume_versions
add column if not exists profile_photo_border boolean default true;

alter table resume_versions
add column if not exists target_box_bg_color text;

alter table resume_versions
add column if not exists target_box_border_color text;

-- =============================================================================
-- FILE: source/src/scripts/010_add_upload_details.sql
-- =============================================================================

-- Application form answer drafts (salary, motivation, availability, etc.)
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS upload_details JSONB DEFAULT NULL;


-- =============================================================================
-- FILE: source/src/scripts/011_add_resume_embedded_cover_letter.sql
-- =============================================================================

-- Store per-resume cover letter on the resume row (scoped by resume id)
ALTER TABLE resume_versions
ADD COLUMN IF NOT EXISTS resume_cover_letter JSONB DEFAULT NULL;

COMMENT ON COLUMN resume_versions.resume_cover_letter IS 'Cover letter content belonging to this resume only';


-- =============================================================================
-- FILE: source/src/scripts/012_add_resume_version_history.sql
-- =============================================================================

-- Resume version history: content snapshots belong to one resume record.
alter table public.resume_versions
  add column if not exists version_history jsonb default '[]'::jsonb;

alter table public.resume_versions
  add column if not exists application_id uuid;


-- =============================================================================
-- FILE: source/src/scripts/013_enable_rls_security.sql
-- =============================================================================

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


-- =============================================================================
-- FILE: source/src/scripts/014_drop_interview_questions.sql
-- =============================================================================

-- Remove unused community interview_questions table (feature removed from app design).
-- Run in Supabase SQL Editor to clear rls_policy_always_true linter warnings.

DROP POLICY IF EXISTS "Anyone can view interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can insert interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can delete interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can update interview questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;

DROP TABLE IF EXISTS public.interview_questions;


-- =============================================================================
-- FILE: source/src/scripts/015_revoke_handle_new_user_rpc.sql
-- =============================================================================

-- handle_new_user() is only meant to run from the auth.users signup trigger.
-- Revoke direct RPC access so anon/authenticated cannot call it via PostgREST.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;


-- =============================================================================
-- FILE: source/src/scripts/016_add_your_story.sql
-- =============================================================================

-- Per-application internal positioning narrative ("Your Story")
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS your_story JSONB DEFAULT NULL;

NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- FILE: source/src/scripts/add-folder-contact-info.sql
-- =============================================================================

-- Add profile_image and contact_info columns to folders table
-- These store default contact info and profile photo for all resumes in the workspace

ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN folders.profile_image IS 'Default profile image (base64) for all resumes in this folder';
COMMENT ON COLUMN folders.contact_info IS 'Default contact information for all resumes in this folder';


-- =============================================================================
-- FILE: source/src/scripts/add-job-description-to-resumes.sql
-- =============================================================================

-- Add job_description column to resume_versions table
-- This stores the job description specific to each resume version/application

ALTER TABLE resume_versions 
ADD COLUMN IF NOT EXISTS job_description TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN resume_versions.job_description IS 'Job description specific to this resume version, used for tailoring the CV and cover letter';


-- =============================================================================
-- FILE: source/src/scripts/add-resume-styling-columns.sql
-- =============================================================================

-- Add styling columns to resume_versions table
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS profile_photo_border BOOLEAN DEFAULT true;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_bg_color TEXT DEFAULT '#f8f9fa';
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS target_box_border_color TEXT DEFAULT '';


-- =============================================================================
-- FILE: source/src/scripts/apply-missing-supabase-schema.sql
-- =============================================================================

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


-- =============================================================================
-- FILE: source/src/scripts/create-interview-questions.sql
-- =============================================================================

-- Create interview_questions table for community collection
CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  author_name TEXT DEFAULT 'Anonymous',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read all questions (community collection)
CREATE POLICY "Anyone can view interview questions"
  ON public.interview_questions FOR SELECT
  USING (true);

-- Authenticated users can insert questions
CREATE POLICY "Authenticated users can insert questions"
  ON public.interview_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only delete their own questions
CREATE POLICY "Users can delete their own questions"
  ON public.interview_questions FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own questions
CREATE POLICY "Users can update their own questions"
  ON public.interview_questions FOR UPDATE
  USING (auth.uid() = user_id);


-- =============================================================================
-- FILE: source/src/scripts/fix-interview-questions-rls.sql
-- =============================================================================

-- Fix RLS policies for interview_questions to allow anonymous access
-- since the app doesn't use Supabase Auth

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can delete their own questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON public.interview_questions;

-- Allow anyone to insert questions (community collection)
CREATE POLICY "Anyone can insert interview questions"
  ON public.interview_questions FOR INSERT
  WITH CHECK (true);

-- Allow anyone to delete questions (for now - the app handles ownership check client-side)
CREATE POLICY "Anyone can delete interview questions"
  ON public.interview_questions FOR DELETE
  USING (true);

-- Allow anyone to update questions (needed for upvoting)
CREATE POLICY "Anyone can update interview questions"
  ON public.interview_questions FOR UPDATE
  USING (true);

