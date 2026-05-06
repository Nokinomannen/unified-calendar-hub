
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_create_default_calendars() FROM public, anon, authenticated;
