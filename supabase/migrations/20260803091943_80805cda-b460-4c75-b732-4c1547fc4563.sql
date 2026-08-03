ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.active_timers
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_ms integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_create_default_calendars()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.calendars (user_id, name, source, color, hourly_rate) VALUES
    (NEW.id, 'School', 'school', '#3b82f6', NULL),
    (NEW.id, 'Mannaz', 'job', '#2f9e63', NULL),
    (NEW.id, 'A-hub', 'job', '#10b981', 160),
    (NEW.id, 'Personal', 'manual', '#a855f7', NULL);
  RETURN NEW;
END $function$;