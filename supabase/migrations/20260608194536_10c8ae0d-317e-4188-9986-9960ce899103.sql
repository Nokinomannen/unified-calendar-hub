ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS hourly_rate numeric;

UPDATE public.calendars SET hourly_rate = 162 WHERE name = 'Tiger of Sweden' AND source = 'job';
UPDATE public.calendars SET hourly_rate = 160 WHERE name = 'A-hub' AND source = 'job';

CREATE TABLE public.dj_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  set_date date NOT NULL,
  venue text NOT NULL,
  amount_sek numeric NOT NULL DEFAULT 0,
  duration_hours numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_sets TO authenticated;
GRANT ALL ON public.dj_sets TO service_role;

ALTER TABLE public.dj_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dj sets" ON public.dj_sets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tg_dj_sets_updated_at
  BEFORE UPDATE ON public.dj_sets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();