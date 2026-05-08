
CREATE TABLE public.event_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'skipped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_date)
);

ALTER TABLE public.event_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own overrides select" ON public.event_overrides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own overrides insert" ON public.event_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own overrides update" ON public.event_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own overrides delete" ON public.event_overrides FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_overrides_user_date ON public.event_overrides(user_id, occurrence_date);
