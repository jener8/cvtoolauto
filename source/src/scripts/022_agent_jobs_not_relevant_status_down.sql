-- Reverse 022_agent_jobs_not_relevant_status.sql
-- Rows already in not_relevant must be moved first (reverts to reviewing).

UPDATE public.agent_jobs
SET status = 'reviewing', updated_at = now()
WHERE status = 'not_relevant';

ALTER TABLE public.agent_jobs DROP CONSTRAINT IF EXISTS agent_jobs_status_check;

ALTER TABLE public.agent_jobs
  ADD CONSTRAINT agent_jobs_status_check
  CHECK (status IN (
    'new',
    'needs_manual_review',
    'reviewing',
    'changes_requested',
    'approved',
    'sending',
    'sent',
    'rejected'
  ));

NOTIFY pgrst, 'reload schema';
