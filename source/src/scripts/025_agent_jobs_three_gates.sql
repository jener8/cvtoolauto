-- Job agents — three approval gates (DEV first; do not apply to live until approved)
-- Pair: 025_agent_jobs_three_gates_down.sql
--
-- Flow:
--   new → potential_fit | not_a_fit | manual
--     → [GATE 1] shortlisted | skipped
--     → drafting → drafts_ready
--     → [GATE 2] documents_approved | changes_requested
--     → [GATE 3] sending → sent
--   rejected at any gate

-- Map legacy statuses before tightening the check
UPDATE public.agent_jobs SET status = 'potential_fit' WHERE status = 'reviewing';
UPDATE public.agent_jobs SET status = 'not_a_fit' WHERE status = 'not_relevant';
UPDATE public.agent_jobs SET status = 'manual' WHERE status = 'needs_manual_review';
UPDATE public.agent_jobs SET status = 'documents_approved' WHERE status = 'approved';

ALTER TABLE public.agent_jobs DROP CONSTRAINT IF EXISTS agent_jobs_status_check;

ALTER TABLE public.agent_jobs
  ADD CONSTRAINT agent_jobs_status_check
  CHECK (status IN (
    'new',
    'potential_fit',
    'not_a_fit',
    'manual',
    'shortlisted',
    'skipped',
    'drafting',
    'drafts_ready',
    'changes_requested',
    'documents_approved',
    'sending',
    'sent',
    'rejected'
  ));

COMMENT ON COLUMN public.agent_jobs.status IS
  'Three gates: new → potential_fit|not_a_fit|manual → shortlisted|skipped → drafting → drafts_ready → documents_approved|changes_requested → sending → sent | rejected';

NOTIFY pgrst, 'reload schema';
