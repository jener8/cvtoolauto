-- Job agents v2 — Phase 4: allow not_relevant after Claude fit review
-- Pair: 022_agent_jobs_not_relevant_status_down.sql
--
-- Documented status choice (Phase 4):
--   new + relevant=true  → reviewing
--   new + relevant=false → not_relevant (stored explanation; NOT auto-rejected / not sent)
--   new + invalid JSON after retry → needs_manual_review

ALTER TABLE public.agent_jobs DROP CONSTRAINT IF EXISTS agent_jobs_status_check;

ALTER TABLE public.agent_jobs
  ADD CONSTRAINT agent_jobs_status_check
  CHECK (status IN (
    'new',
    'needs_manual_review',
    'reviewing',
    'not_relevant',
    'changes_requested',
    'approved',
    'sending',
    'sent',
    'rejected'
  ));

COMMENT ON COLUMN public.agent_jobs.relevance IS
  'Phase 4 Claude fit JSON: {relevant, requirements_met[{requirement, evidence_fact_ids}], requirements_not_met, summary, listing_language}. No scores.';

COMMENT ON COLUMN public.agent_jobs.status IS
  'v2: new → needs_manual_review | reviewing | not_relevant → changes_requested → approved → sending → sent | rejected';

NOTIFY pgrst, 'reload schema';
