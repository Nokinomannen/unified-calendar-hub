ALTER TABLE public.calendars
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS email_reminder text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS log_reminder_minutes integer;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS email_reminder text;

CREATE TABLE IF NOT EXISTS public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  channel text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_reminders_unique
  ON public.event_reminders (event_id, occurrence_date, channel);
CREATE INDEX IF NOT EXISTS event_reminders_due
  ON public.event_reminders (status, scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reminders TO authenticated;
GRANT ALL ON public.event_reminders TO service_role;

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own event_reminders select" ON public.event_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own event_reminders insert" ON public.event_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own event_reminders update" ON public.event_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own event_reminders delete" ON public.event_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_event_reminders_updated_at
  BEFORE UPDATE ON public.event_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();