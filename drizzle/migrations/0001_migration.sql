CREATE TABLE public.day_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  focus_date date NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  notion_block_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_focus TO authenticated;
GRANT ALL ON public.day_focus TO service_role;
ALTER TABLE public.day_focus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own day_focus" ON public.day_focus FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX day_focus_user_date ON public.day_focus(user_id, focus_date);

CREATE TABLE public.day_notes (
  user_id uuid NOT NULL,
  note_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  sent_to_notion_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, note_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_notes TO authenticated;
GRANT ALL ON public.day_notes TO service_role;
ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own day_notes" ON public.day_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);