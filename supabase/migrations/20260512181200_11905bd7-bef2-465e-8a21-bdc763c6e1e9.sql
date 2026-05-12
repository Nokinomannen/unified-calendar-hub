CREATE TABLE public.work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendar_id, work_date)
);

ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own work_logs select" ON public.work_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own work_logs insert" ON public.work_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own work_logs update" ON public.work_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own work_logs delete" ON public.work_logs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tg_work_logs_updated_at BEFORE UPDATE ON public.work_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_work_logs_user_date ON public.work_logs(user_id, work_date);