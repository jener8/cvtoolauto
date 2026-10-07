-- Down migration for 023_agent_controls_scheduling.sql

DROP TABLE IF EXISTS public.agent_agent_controls CASCADE;

ALTER TABLE public.agent_search_settings
  DROP COLUMN IF EXISTS target_companies;

NOTIFY pgrst, 'reload schema';
