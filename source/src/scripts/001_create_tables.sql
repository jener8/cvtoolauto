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
