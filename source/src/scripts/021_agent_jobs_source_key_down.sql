-- Reverse 021_agent_jobs_source_key.sql

DROP INDEX IF EXISTS public.idx_agent_jobs_user_source_key;

ALTER TABLE public.agent_jobs
  DROP COLUMN IF EXISTS source_key;

NOTIFY pgrst, 'reload schema';
