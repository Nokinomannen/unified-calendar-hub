CREATE TABLE public.active_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_timers TO authenticated;
GRANT ALL ON public.active_timers TO service_role;

ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own active_timers select" ON public.active_timers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own active_timers insert" ON public.active_timers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own active_timers update" ON public.active_timers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own active_timers delete" ON public.active_timers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_active_timers_updated_at BEFORE UPDATE ON public.active_timers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();