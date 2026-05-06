
-- Calendars (sources): manual, school, job, outlook, ics, etc.
CREATE TABLE public.calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  color TEXT NOT NULL DEFAULT '#6366f1',
  ics_url TEXT,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendars_user ON public.calendars(user_id);

ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own calendars select" ON public.calendars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own calendars insert" ON public.calendars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendars update" ON public.calendars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own calendars delete" ON public.calendars FOR DELETE USING (auth.uid() = user_id);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  rrule TEXT,
  external_id TEXT,
  reminder_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_user_start ON public.events(user_id, start_at);
CREATE INDEX idx_events_calendar ON public.events(calendar_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own events select" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own events insert" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own events update" ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own events delete" ON public.events FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_calendars BEFORE UPDATE ON public.calendars
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_events BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create default calendars for new users
CREATE OR REPLACE FUNCTION public.tg_create_default_calendars()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.calendars (user_id, name, source, color) VALUES
    (NEW.id, 'School', 'school', '#3b82f6'),
    (NEW.id, 'Tiger of Sweden', 'job', '#ef4444'),
    (NEW.id, 'A-hub', 'job', '#10b981'),
    (NEW.id, 'Personal', 'manual', '#a855f7');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_default_calendars();
