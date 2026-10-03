-- Reverse 025_agent_jobs_three_gates.sql (DEV rollback only)

UPDATE public.agent_jobs SET status = 'reviewing' WHERE status IN ('potential_fit', 'shortlisted', 'drafting', 'drafts_ready');
UPDATE public.agent_jobs SET status = 'not_relevant' WHERE status IN ('not_a_fit', 'skipped');
UPDATE public.agent_jobs SET status = 'needs_manual_review' WHERE status = 'manual';
UPDATE public.agent_jobs SET status = 'approved' WHERE status = 'documents_approved';

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

NOTIFY pgrst, 'reload schema';
