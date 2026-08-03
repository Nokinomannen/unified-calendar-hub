import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveTimer = {
  id: string;
  user_id: string;
  calendar_id: string;
  started_at: string;
  paused_at: string | null;
  paused_ms: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Net worked milliseconds at `now`, excluding paused time. */
export function timerNetMs(timer: ActiveTimer, now: number) {
  const elapsed = now - new Date(timer.started_at).getTime();
  const pausedNow = timer.paused_at ? now - new Date(timer.paused_at).getTime() : 0;
  return Math.max(0, elapsed - (timer.paused_ms ?? 0) - pausedNow);
}

/** Total paused milliseconds at `now`. */
export function timerPausedMs(timer: ActiveTimer, now: number) {
  const pausedNow = timer.paused_at ? now - new Date(timer.paused_at).getTime() : 0;
  return Math.max(0, (timer.paused_ms ?? 0) + pausedNow);
}

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
          paused_at: null,
          paused_ms: 0,
          note: null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active_timer"] }),
  });
}

export function usePauseTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (timer: ActiveTimer) => {
      if (timer.paused_at) return;
      const { error } = await supabase
        .from("active_timers")
        .update({ paused_at: new Date().toISOString() })
        .eq("id", timer.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active_timer"] }),
  });
}

export function useResumeTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (timer: ActiveTimer) => {
      if (!timer.paused_at) return;
      const extra = Date.now() - new Date(timer.paused_at).getTime();
      const { error } = await supabase
        .from("active_timers")
        .update({ paused_at: null, paused_ms: Math.max(0, (timer.paused_ms ?? 0) + extra) })
        .eq("id", timer.id);
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
