import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type FocusItem = { id: string; focus_date: string; text: string; done: boolean; position: number; notion_block_id: string | null };

export function useDayFocus(date: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["day_focus", user?.id, date];

  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!date,
    queryFn: async () => {
      const { data, error } = await supabase.from("day_focus")
        .select("id, focus_date, text, done, position, notion_block_id")
        .eq("focus_date", date!).order("position").order("created_at");
      if (error) throw error;
      return data as FocusItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["day_focus", user?.id] });
  const optimistic = (fn: (l: FocusItem[]) => FocusItem[]) => {
    const prev = qc.getQueryData<FocusItem[]>(key);
    qc.setQueryData<FocusItem[]>(key, (l) => fn(l ?? []));
    return { prev };
  };
  const rollback = (_e: unknown, _v: unknown, ctx?: { prev?: FocusItem[] }) => qc.setQueryData(key, ctx?.prev);

  const add = useMutation({
    mutationFn: async (text: string) => {
      const position = (query.data?.length ?? 0);
      const { error } = await supabase.from("day_focus").insert({ user_id: user!.id, focus_date: date!, text, position });
      if (error) throw error;
    },
    onMutate: (text) => optimistic((l) => [...l, { id: `tmp-${Date.now()}`, focus_date: date!, text, done: false, position: l.length, notion_block_id: null }]),
    onError: rollback,
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Pick<FocusItem, "done" | "text" | "focus_date">> }) => {
      const patch = { ...v.patch, ...("done" in v.patch ? { done_changed_at: new Date().toISOString() } : {}) };
      const { error } = await supabase.from("day_focus").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onMutate: (v) => optimistic((l) => l.map((i) => (i.id === v.id ? { ...i, ...v.patch } : i)).filter((i) => !v.patch.focus_date || i.focus_date === date)),
    onError: rollback,
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("day_focus").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => optimistic((l) => l.filter((i) => i.id !== id)),
    onError: rollback,
    onSettled: invalidate,
  });

  return { items: query.data ?? [], isLoading: query.isLoading, add, update, remove, invalidate };
}

export function useDayNote(date: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["day_note", user?.id, date];
  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!date,
    queryFn: async () => {
      const { data, error } = await supabase.from("day_notes").select("content, sent_to_notion_at").eq("note_date", date!).maybeSingle();
      if (error) throw error;
      return data ?? { content: "", sent_to_notion_at: null };
    },
  });
  const save = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("day_notes").upsert(
        { user_id: user!.id, note_date: date!, content, updated_at: new Date().toISOString() },
        { onConflict: "user_id,note_date" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, content) => qc.setQueryData(key, (o: any) => ({ ...(o ?? {}), content })),
  });
  return { note: query.data, isLoading: query.isLoading, save, refresh: () => qc.invalidateQueries({ queryKey: key }) };
}
