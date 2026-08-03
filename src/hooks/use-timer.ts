import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveTimer = {
  id: string;
  user_id: string;
  calendar_id: string;
  started_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export function useActiveTimer() {
  return useQuery({
    queryKey: ["active_timer"],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_timers").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? null) as ActiveTimer | null;
    },
    refetchOnWindowFocus: true,
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { calendar_id: string; started_at?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { error } = await supabase.from("active_timers").upsert(
        {
          user_id: u.user.id,
          calendar_id: input.calendar_id,
          started_at: input.started_at ?? new Date().toISOString(),
          note: null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active_timer"] }),
  });
}

export function useCancelTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("active_timers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active_timer"] }),
  });
}

/** Saves the tracked period as a real calendar event, then clears the timer. */
export function useSaveTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      timer_id: string;
      calendar_id: string;
      title: string;
      start_at: string;
      end_at: string;
      note?: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { error } = await supabase.from("events").insert({
        user_id: u.user.id,
        calendar_id: input.calendar_id,
        title: input.title,
        description: input.note ?? null,
        start_at: input.start_at,
        end_at: input.end_at,
        all_day: false,
      });
      if (error) throw error;
      const { error: de } = await supabase.from("active_timers").delete().eq("id", input.timer_id);
      if (de) throw de;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active_timer"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
