import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Override = { id: string; event_id: string; occurrence_date: string; status: string };

export function useOverrides() {
  return useQuery({
    queryKey: ["overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_overrides").select("*");
      if (error) throw error;
      return data as Override[];
    },
  });
}

export function useToggleSkip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, date, skip }: { eventId: string; date: string; skip: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      if (skip) {
        const { error } = await supabase
          .from("event_overrides")
          .upsert(
            { user_id: u.user.id, event_id: eventId, occurrence_date: date, status: "skipped" },
            { onConflict: "event_id,occurrence_date" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_overrides")
          .delete()
          .eq("event_id", eventId)
          .eq("occurrence_date", date);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overrides"] }),
  });
}

export function dateKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
