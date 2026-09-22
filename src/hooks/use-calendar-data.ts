import { useMemo } from "react";
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

export const calendarsQueryOptions = {
  queryKey: ["calendars"] as const,
  staleTime: 60 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("calendars").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
};

/** Calendars come along with the shared base fetch — no extra request. */
export function useCalendars() {
  const base = useEventBase();
  return { ...base, data: base.data?.calendars ?? [] };
}

/** Calendars you can still pick for new events / hours (archived ones excluded). */
export function useActiveCalendars() {
  const q = useCalendars();
  return { ...q, data: (q.data ?? []).filter((c) => !c.archived) };
}

type BaseRow = Pick<
  EventRow,
  | "id" | "user_id" | "calendar_id" | "title" | "description" | "location"
  | "start_at" | "end_at" | "all_day" | "rrule" | "external_id"
  | "reminder_minutes" | "email_reminder" | "deleted_at"
>;
type OverrideRow = {
  event_id: string;
  occurrence_date: string;
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
};
type EventBase = { events: BaseRow[]; calendars: CalendarRow[]; overrides: OverrideRow[] };

const BASE_CACHE_KEY = "one-events-base-v1";
const DAY = 24 * 60 * 60_000;

function readBaseCache(): { data: EventBase; at: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(BASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: EventBase; at: number };
    if (!parsed?.data?.events) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBaseCache(data: EventBase) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ data, at: Date.now() }));
  } catch { /* quota — ignore */ }
}

/**
 * ONE shared fetch for all calendar data. Every view (month, week, upcoming,
 * money, command palette …) expands from this cache client-side, so opening
 * the app costs a single small request instead of six overlapping ones.
 * Persisted to localStorage so reloads and app restarts cost nothing.
 */
function useEventBase() {
  const cached = typeof window !== "undefined" ? readBaseCache() : null;
  return useQuery<EventBase>({
    queryKey: ["events", "base"],
    staleTime: 6 * 60 * 60_000,
    gcTime: DAY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    queryFn: async () => {
      const [ev, cal, ovr] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id,user_id,calendar_id,title,description,location,start_at,end_at,all_day,rrule,external_id,reminder_minutes,email_reminder,deleted_at",
          )
          .is("deleted_at", null),
        supabase.from("calendars").select("*").order("created_at"),
        supabase
          .from("event_overrides")
          .select("event_id,occurrence_date,title,start_at,end_at,location")
          .eq("status", "modified"),
      ]);
      if (ev.error) throw ev.error;
      const data: EventBase = {
        events: (ev.data ?? []) as BaseRow[],
        calendars: (cal.data ?? []) as CalendarRow[],
        overrides: (ovr.data ?? []) as OverrideRow[],
      };
      writeBaseCache(data);
      return data;
    },
  });
}

export function useEvents(rangeStart: Date, rangeEnd: Date) {
  const base = useEventBase();
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const data = useMemo(() => {
    const b = base.data;
    if (!b) return [] as ExpandedEvent[];
    const from = new Date(startMs);
    const to = new Date(endMs);
    const calById = new Map(b.calendars.map((c) => [c.id, c]));
    const edits = new Map<string, OverrideRow>();
    for (const o of b.overrides) edits.set(`${o.event_id}|${o.occurrence_date}`, o);
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
    for (const row of b.events) {
      const ev = { ...row, calendar: calById.get(row.calendar_id) } as EventRow & { calendar?: CalendarRow };
      const start = new Date(ev.start_at);
      const end = new Date(ev.end_at);
      const dur = end.getTime() - start.getTime();
      if (ev.rrule) {
        try {
          const rule = RRule.fromString(
            ev.rrule.startsWith("DTSTART") ? ev.rrule : `DTSTART:${toICSDate(start)}\nRRULE:${ev.rrule.replace(/^RRULE:/, "")}`,
          );
          for (const occ of rule.between(from, to, true)) {
            expanded.push(applyEdit({ ...ev, occurrence_start: occ, occurrence_end: new Date(occ.getTime() + dur) }));
          }
        } catch {
          if (end >= from && start <= to) {
            expanded.push(applyEdit({ ...ev, occurrence_start: start, occurrence_end: end }));
          }
        }
      } else if (end >= from && start <= to) {
        expanded.push(applyEdit({ ...ev, occurrence_start: start, occurrence_end: end }));
      }
    }
    expanded.sort((a, b2) => a.occurrence_start.getTime() - b2.occurrence_start.getTime());
    return expanded;
  }, [base.data, startMs, endMs]);

  return { ...base, data } as typeof base & { data: ExpandedEvent[] };
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
