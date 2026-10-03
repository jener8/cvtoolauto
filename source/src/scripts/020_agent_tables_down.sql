-- Rollback for 020_agent_tables.sql
-- Drops agent tables in FK-safe order. Does not touch resume/qualification sources.

DROP TABLE IF EXISTS public.agent_activity CASCADE;
DROP TABLE IF EXISTS public.agent_drafts CASCADE;
DROP TABLE IF EXISTS public.agent_jobs CASCADE;
DROP TABLE IF EXISTS public.agent_companies CASCADE;
DROP TABLE IF EXISTS public.agent_search_settings CASCADE;
DROP TABLE IF EXISTS public.agent_profile_facts CASCADE;

NOTIFY pgrst, 'reload schema';
