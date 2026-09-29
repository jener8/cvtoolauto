-- Resume version history: content snapshots belong to one resume record.
alter table public.resume_versions
  add column if not exists version_history jsonb default '[]'::jsonb;

alter table public.resume_versions
  add column if not exists application_id uuid;
