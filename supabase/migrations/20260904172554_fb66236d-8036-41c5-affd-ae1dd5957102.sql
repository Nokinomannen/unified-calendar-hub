CREATE TABLE public.outlook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  secret_env text NOT NULL,
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, secret_env)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlook_accounts TO authenticated;
GRANT ALL ON public.outlook_accounts TO service_role;
ALTER TABLE public.outlook_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outlook_accounts" ON public.outlook_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX events_calendar_external_uniq ON public.events (calendar_id, external_id) WHERE external_id IS NOT NULL;