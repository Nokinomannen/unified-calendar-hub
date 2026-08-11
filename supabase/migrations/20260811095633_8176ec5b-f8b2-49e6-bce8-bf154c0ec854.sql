ALTER TABLE public.event_overrides
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS location text;

CREATE UNIQUE INDEX IF NOT EXISTS event_overrides_event_date_uidx
  ON public.event_overrides (event_id, occurrence_date);