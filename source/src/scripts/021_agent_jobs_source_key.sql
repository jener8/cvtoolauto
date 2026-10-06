-- Job agents v2 — Phase 3 additive: stable source key for listing upsert/dedupe
-- Pair: 021_agent_jobs_source_key_down.sql

ALTER TABLE public.agent_jobs
  ADD COLUMN IF NOT EXISTS source_key text;

COMMENT ON COLUMN public.agent_jobs.source_key IS
  'Stable idempotency key: {source}:{externalId}. NULL for initiative / manual rows.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_jobs_user_source_key
  ON public.agent_jobs (user_id, source_key)
  WHERE source_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
