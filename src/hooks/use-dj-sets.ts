import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DjSet = {
  id: string;
  user_id: string;
  set_date: string;
  venue: string;
  amount_sek: number;
  duration_hours: number | null;
  notes: string | null;
  event_id: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_DJ_START_HOUR = 22;
export const DEFAULT_DJ_DURATION_H = 5;

export function djTitle(venue: string) {
  return `DJ · ${venue}`;
}

/** The user's DJ calendar (kind = 'dj'); created on demand if missing. */
export async function ensureDjCalendarId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("calendars")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "dj")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const { data: created, error: ce } = await supabase
    .from("calendars")
    .insert({ user_id: userId, name: "DJ", source: "manual", color: "#7c5cff", kind: "dj" })
    .select("id")
    .single();
  if (ce) throw ce;
  return created.id;
}

export function useDjCalendar() {
  return useQuery({
    queryKey: ["dj_calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendars")
        .select("*")
        .eq("kind", "dj")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDjSets() {
  return useQuery({
    queryKey: ["dj_sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dj_sets")
        .select("*")
        .order("set_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DjSet[];
    },
  });
}

/** Local start Date for a set, honouring an explicit ISO start when given. */
export function djStartDate(set_date: string, startIso?: string | null) {
  if (startIso) return new Date(startIso);
  const [y, m, d] = set_date.split("-").map(Number);
  return new Date(y, m - 1, d, DEFAULT_DJ_START_HOUR, 0, 0, 0);
}

type UpsertInput = {
  id?: string;
  set_date: string;
  venue: string;
  amount_sek: number;
  duration_hours?: number | null;
  notes?: string | null;
  /** Optional explicit local start (ISO). Falls back to 22:00 on set_date. */
  start_iso?: string | null;
  /** When the caller already owns the event (event-first flow), pass it here. */
  event_id?: string | null;
};

export function useUpsertDjSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertInput) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const userId = u.user.id;

      const row = {
        set_date: input.set_date,
        venue: input.venue,
        amount_sek: input.amount_sek,
        duration_hours: input.duration_hours ?? null,
        notes: input.notes ?? null,
      };

      let setId = input.id;
      let eventId = input.event_id ?? null;

      if (setId) {
        const { data: existing } = await supabase.from("dj_sets").select("event_id").eq("id", setId).maybeSingle();
        eventId = eventId ?? existing?.event_id ?? null;
        const { error } = await supabase.from("dj_sets").update({ ...row, event_id: eventId }).eq("id", setId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("dj_sets")
          .insert({ ...row, user_id: userId, event_id: eventId })
          .select("id")
          .single();
        if (error) throw error;
        setId = data.id;
      }

      // Keep the calendar event in sync (skip when the event drives the change).
      if (!input.event_id) {
        const calendarId = await ensureDjCalendarId(userId);
        const start = djStartDate(input.set_date, input.start_iso);
        const hours = input.duration_hours ?? DEFAULT_DJ_DURATION_H;
        const end = new Date(start.getTime() + hours * 3600_000);
        const payload = {
          title: djTitle(input.venue),
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          location: input.venue,
          description: input.notes ?? null,
          calendar_id: calendarId,
          all_day: false,
          deleted_at: null,
        };
        if (eventId) {
          const { error } = await supabase.from("events").update(payload).eq("id", eventId);
          if (error) throw error;
        } else {
          const { data: ev, error } = await supabase
            .from("events")
            .insert({ ...payload, user_id: userId })
            .select("id")
            .single();
          if (error) throw error;
          const { error: le } = await supabase.from("dj_sets").update({ event_id: ev.id }).eq("id", setId);
          if (le) throw le;
        }
      }

      return setId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dj_sets"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteDjSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase.from("dj_sets").select("event_id").eq("id", id).maybeSingle();
      const { error } = await supabase.from("dj_sets").delete().eq("id", id);
      if (error) throw error;
      if (existing?.event_id) {
        const { error: ee } = await supabase
          .from("events")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", existing.event_id);
        if (ee) console.error("failed to remove linked event", ee.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dj_sets"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/** Fee suggestion: the most recent amount for the same venue. */
export function useFeeSuggestion(venue: string) {
  const { data: sets = [] } = useDjSets();
  const v = venue.trim().toLowerCase();
  if (!v) return null;
  const match = sets.find((s) => s.venue.trim().toLowerCase() === v);
  return match ? match.amount_sek : null;
}
