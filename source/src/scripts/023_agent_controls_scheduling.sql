-- Job agents Phase 9 — per-agent pause controls + company scout watchlist
-- Additive. Pair: 023_agent_controls_scheduling_down.sql

-- ---------------------------------------------------------------------------
-- 1. agent_agent_controls — pause / resume per agent kind
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_agent_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_key text NOT NULL
    CHECK (agent_key IN ('job_scout', 'company_scout', 'assessor', 'writer')),
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_agent_controls_user_key_unique UNIQUE (user_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_agent_controls_user_id
  ON public.agent_agent_controls (user_id);

ALTER TABLE public.agent_agent_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_agent_controls_select_authenticated" ON public.agent_agent_controls;
DROP POLICY IF EXISTS "agent_agent_controls_insert_authenticated" ON public.agent_agent_controls;
DROP POLICY IF EXISTS "agent_agent_controls_update_authenticated" ON public.agent_agent_controls;
DROP POLICY IF EXISTS "agent_agent_controls_delete_authenticated" ON public.agent_agent_controls;

CREATE POLICY "agent_agent_controls_select_authenticated"
  ON public.agent_agent_controls FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "agent_agent_controls_insert_authenticated"
  ON public.agent_agent_controls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_agent_controls_update_authenticated"
  ON public.agent_agent_controls FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_agent_controls_delete_authenticated"
  ON public.agent_agent_controls FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Company Scout watchlist on search settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_search_settings
  ADD COLUMN IF NOT EXISTS target_companies text[] NOT NULL DEFAULT '{}'::text[];

NOTIFY pgrst, 'reload schema';
