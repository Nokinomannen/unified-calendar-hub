import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
// `rrule` is CommonJS; a namespace import works in both SSR and the browser.
import * as rrulePkg from "rrule";
const RRule = (rrulePkg as { RRule?: typeof import("rrule").RRule; default?: { RRule: typeof import("rrule").RRule } })
  .RRule ?? (rrulePkg as unknown as { default: { RRule: typeof import("rrule").RRule } }).default.RRule;

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

/** Calendars you can still pick for new events / hours (archived ones excluded). */
export function useActiveCalendars() {
  const q = useCalendars();
  return { ...q, data: (q.data ?? []).filter((c) => !c.archived) };
}

export function useEvents(rangeStart: Date, rangeEnd: Date) {
  return useQuery({
    queryKey: ["events", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      // Pull events whose master start_at is before rangeEnd; we expand RRULE locally.
      const { data, error } = await supabase
        .from("events")
        .select("*, calendar:calendars(*)")
        .is("deleted_at", null)
        .lte("start_at", rangeEnd.toISOString());
      if (error) throw error;
      // Per-occurrence edits ("bara detta tillfälle") live in event_overrides.
      const { data: ovr } = await supabase
        .from("event_overrides")
        .select("*")
        .eq("status", "modified");
      const edits = new Map<string, { title?: string | null; start_at?: string | null; end_at?: string | null; location?: string | null }>();
      for (const o of (ovr ?? []) as { event_id: string; occurrence_date: string }[]) {
        edits.set(`${o.event_id}|${o.occurrence_date}`, o as never);
      }
      const applyEdit = (ev: ExpandedEvent): ExpandedEvent => {
        const p = (n: number) => String(n).padStart(2, "0");
        const d = ev.occurrence_start;
        const key = `${ev.id}|${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        const edit = edits.get(key);
        if (!edit) return ev;
        return {
          ...ev,
          title: edit.title ?? ev.title,
          location: edit.location ?? ev.location,
          occurrence_start: edit.start_at ? new Date(edit.start_at) : ev.occurrence_start,
          occurrence_end: edit.end_at ? new Date(edit.end_at) : ev.occurrence_end,
        };
      };
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
              expanded.push(applyEdit({
                ...ev,
                occurrence_start: occ,
                occurrence_end: new Date(occ.getTime() + dur),
              }));
            }
          } catch {
            if (end >= rangeStart && start <= rangeEnd) {
              expanded.push(applyEdit({ ...ev, occurrence_start: start, occurrence_end: end }));
            }
          }
        } else if (end >= rangeStart && start <= rangeEnd) {
          expanded.push(applyEdit({ ...ev, occurrence_start: start, occurrence_end: end }));
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

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EventRow> & { id: string }) => {
      const { data, error } = await supabase.from("events").update(patch).eq("id", id).select().single();
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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      // Read full row first so we can record it in the audit log.
      const { data: before, error: be } = await supabase.from("events").select("*").eq("id", id).single();
      if (be) throw be;
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      // A DJ event and its fee entry are one thing — remove both.
      const { error: de } = await supabase.from("dj_sets").delete().eq("event_id", id);
      if (de) console.error("failed to remove linked dj set", de.message);
      // Best-effort audit log; don't block the UI on failure.
      const { error: ae } = await supabase.from("agent_actions").insert({
        user_id: u.user.id,
        action: "soft_delete",
        event_id: id,
        before,
        after: null,
        tool_name: "ui_delete",
      });
      if (ae) console.error("audit insert failed", ae.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["dj_sets"] });
    },
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
