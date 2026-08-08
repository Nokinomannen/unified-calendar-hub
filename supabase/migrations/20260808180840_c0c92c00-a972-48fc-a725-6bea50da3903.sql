-- 1. calendar kind
ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other';

UPDATE public.calendars SET kind = 'job' WHERE source = 'job';
UPDATE public.calendars SET kind = 'school' WHERE source = 'school';

-- 2. link dj_sets to events
ALTER TABLE public.dj_sets ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dj_sets_event_id_key ON public.dj_sets(event_id) WHERE event_id IS NOT NULL;

-- 3. DJ calendar for every existing user that has calendars
INSERT INTO public.calendars (user_id, name, source, color, kind)
SELECT DISTINCT c.user_id, 'DJ', 'manual', '#7c5cff', 'dj'
FROM public.calendars c
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendars c2 WHERE c2.user_id = c.user_id AND c2.kind = 'dj'
);

-- 4. backfill events for existing dj sets
WITH dj_cal AS (
  SELECT user_id, id FROM public.calendars WHERE kind = 'dj'
), ins AS (
  INSERT INTO public.events (user_id, calendar_id, title, start_at, end_at, location, description, all_day)
  SELECT s.user_id,
         d.id,
         'DJ · ' || s.venue,
         ((s.set_date::timestamp + interval '22 hours') AT TIME ZONE 'Europe/Stockholm'),
         ((s.set_date::timestamp + interval '22 hours') AT TIME ZONE 'Europe/Stockholm')
           + (COALESCE(s.duration_hours, 5) * interval '1 hour'),
         s.venue,
         s.notes,
         false
  FROM public.dj_sets s
  JOIN dj_cal d ON d.user_id = s.user_id
  WHERE s.event_id IS NULL
  RETURNING id, user_id, start_at, location
)
UPDATE public.dj_sets s
SET event_id = i.id
FROM ins i
WHERE s.user_id = i.user_id
  AND s.event_id IS NULL
  AND s.venue = i.location
  AND s.set_date = (i.start_at AT TIME ZONE 'Europe/Stockholm')::date;

-- 5. default calendars for new users
CREATE OR REPLACE FUNCTION public.tg_create_default_calendars()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.calendars (user_id, name, source, color, hourly_rate, kind) VALUES
    (NEW.id, 'School', 'school', '#3b82f6', NULL, 'school'),
    (NEW.id, 'Mannaz', 'job', '#2f9e63', NULL, 'job'),
    (NEW.id, 'A-hub', 'job', '#10b981', 160, 'job'),
    (NEW.id, 'DJ', 'manual', '#7c5cff', NULL, 'dj'),
    (NEW.id, 'Personal', 'manual', '#a855f7', NULL, 'other');
  RETURN NEW;
END $function$;