
-- TODO(wave 2): add a pg_cron job to hard-purge events where
-- deleted_at < now() - interval '30 days', and to delete
-- pending_actions where expires_at < now() - interval '1 day'.

-- 1. Soft delete on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS events_user_active_idx
  ON public.events (user_id, start_at)
  WHERE deleted_at IS NULL;

-- 2. pending_actions
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  confirmation_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  confirmed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_actions_token_unique
  ON public.pending_actions (user_id, confirmation_token)
  WHERE confirmed_at IS NULL;

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pending_actions select" ON public.pending_actions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pending_actions insert" ON public.pending_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pending_actions update" ON public.pending_actions
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. agent_actions (audit log, append-only from client)
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,         -- 'create' | 'update' | 'soft_delete' | 'restore'
  event_id UUID,
  before JSONB,
  after JSONB,
  tool_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_actions_user_recent_idx
  ON public.agent_actions (user_id, created_at DESC);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own agent_actions select" ON public.agent_actions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own agent_actions insert" ON public.agent_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- intentionally no UPDATE/DELETE policies → immutable from clients
