import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { RRule } from "rrule";

export type CalendarRow = Tables<"calendars">;
export type EventRow = Tables<"events">;

export type ExpandedEvent = EventRow & {
  occurrence_start: Date;
  occurrence_end: Date;
  calendar?: CalendarRow;
};

export function useCalendars() {
  return useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendars").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useEvents(rangeStart: Date, rangeEnd: Date) {
  return useQuery({
    queryKey: ["events", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      // Pull events whose master start_at is before rangeEnd; we expand RRULE locally.
      const { data, error } = await supabase
        .from("events")
        .select("*, calendar:calendars(*)")
        .lte("start_at", rangeEnd.toISOString());
      if (error) throw error;
      const expanded: ExpandedEvent[] = [];
      for (const ev of data as (EventRow & { calendar: CalendarRow })[]) {
        const start = new Date(ev.start_at);
        const end = new Date(ev.end_at);
        const dur = end.getTime() - start.getTime();
        if (ev.rrule) {
          try {
            const rule = RRule.fromString(
              ev.rrule.startsWith("DTSTART") ? ev.rrule : `DTSTART:${toICSDate(start)}\nRRULE:${ev.rrule.replace(/^RRULE:/, "")}`,
            );
            const occs = rule.between(rangeStart, rangeEnd, true);
            for (const occ of occs) {
              expanded.push({
                ...ev,
                occurrence_start: occ,
                occurrence_end: new Date(occ.getTime() + dur),
              });
            }
          } catch {
            if (end >= rangeStart && start <= rangeEnd) {
              expanded.push({ ...ev, occurrence_start: start, occurrence_end: end });
            }
          }
        } else if (end >= rangeStart && start <= rangeEnd) {
          expanded.push({ ...ev, occurrence_start: start, occurrence_end: end });
        }
      }
      expanded.sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
      return expanded;
    },
  });
}

function toICSDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Omit<TablesInsert<"events">, "user_id">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { data, error } = await supabase
        .from("events")
        .insert({ ...e, user_id: u.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CalendarRow> & { id: string }) => {
      const { error } = await supabase.from("calendars").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendars"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
