import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents, useCalendars, type ExpandedEvent } from "@/hooks/use-calendar-data";
import { addDays, startOfDay } from "date-fns";

export type EmailReminder = "none" | "day_before" | "same_day";
export type ReminderChannel = "notify" | "email" | "log";

export const NOTIFY_OPTIONS = [
  { value: "off", label: "Av" },
  { value: "0", label: "Vid start" },
  { value: "15", label: "15 min före" },
  { value: "30", label: "30 min före" },
  { value: "60", label: "1 timme före" },
  { value: "120", label: "2 timmar före" },
  { value: "720", label: "12 timmar före" },
  { value: "1080", label: "Kvällen innan" },
] as const;

export const EMAIL_OPTIONS: { value: EmailReminder; label: string }[] = [
  { value: "none", label: "Inget mejl" },
  { value: "day_before", label: "Dagen innan (18:00)" },
  { value: "same_day", label: "Samma dag (08:00)" },
];

export const LOG_OPTIONS = [
  { value: "off", label: "Av" },
  { value: "0", label: "Direkt efter" },
  { value: "15", label: "15 min efter" },
  { value: "30", label: "30 min efter" },
  { value: "60", label: "1 timme efter" },
] as const;

const HORIZON_DAYS = 14;

function dateKeyLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** When each channel should fire for one occurrence, or null when disabled. */
export function reminderTimes(ev: ExpandedEvent) {
  const cal = ev.calendar;
  const notifyMin = ev.reminder_minutes ?? cal?.reminder_minutes ?? null;
  const emailMode = (ev.email_reminder ?? cal?.email_reminder ?? "none") as EmailReminder;
  const logMin = cal?.log_reminder_minutes ?? null;

  const out: { channel: ReminderChannel; at: Date }[] = [];
  if (notifyMin !== null) out.push({ channel: "notify", at: new Date(ev.occurrence_start.getTime() - notifyMin * 60_000) });
  if (logMin !== null) out.push({ channel: "log", at: new Date(ev.occurrence_end.getTime() + logMin * 60_000) });
  if (emailMode === "day_before") {
    const d = startOfDay(addDays(ev.occurrence_start, -1));
    out.push({ channel: "email", at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0) });
  } else if (emailMode === "same_day") {
    const d = ev.occurrence_start;
    out.push({ channel: "email", at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0) });
  }
  return out;
}

/**
 * Keeps `event_reminders` filled for the next two weeks.
 * Rows are inserted with ignoreDuplicates so already-sent reminders stay sent.
 */
export function useReminderSync() {
  const now = new Date();
  const { data: events = [] } = useEvents(startOfDay(now), addDays(now, HORIZON_DAYS));

  useEffect(() => {
    if (!events.length) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const cutoff = Date.now() - 60 * 60_000; // don't queue long-past reminders
      const rows = events.flatMap((ev) =>
        reminderTimes(ev)
          .filter((r) => r.at.getTime() > cutoff)
          .map((r) => ({
            user_id: u.user!.id,
            event_id: ev.id,
            occurrence_date: dateKeyLocal(ev.occurrence_start),
            channel: r.channel,
            scheduled_at: r.at.toISOString(),
          })),
      );
      if (!rows.length) return;
      const { error } = await supabase
        .from("event_reminders")
        .upsert(rows, { onConflict: "event_id,occurrence_date,channel", ignoreDuplicates: true });
      if (error) console.error("reminder sync failed", error.message);
    })();
    return () => { cancelled = true; };
    // Re-sync when the set of occurrences or their settings change.
  }, [events.map((e) => `${e.id}:${e.occurrence_start.getTime()}:${e.reminder_minutes}:${e.email_reminder}`).join("|")]);
}

/** Browser/desktop notification permission state + request helper. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") new Notification("Påminnelser är på", { body: "Du får nu notiser inför dina events." });
  }, []);

  return { permission, request };
}

type DueReminder = {
  id: string;
  channel: ReminderChannel;
  scheduled_at: string;
  event: { id: string; title: string; start_at: string; location: string | null } | null;
};

/** Polls for due notify/log reminders and shows them as native notifications. */
export function useReminderScheduler() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const { data, error } = await supabase
        .from("event_reminders")
        .select("id, channel, scheduled_at, event:events(id, title, start_at, location)")
        .eq("status", "pending")
        .in("channel", ["notify", "log"])
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(10);
      if (error || !data?.length) return;

      for (const r of data as unknown as DueReminder[]) {
        if (!r.event) continue;
        const start = new Date(r.event.start_at);
        const time = start.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
        const body =
          r.channel === "log"
            ? "Glöm inte att logga dina timmar."
            : `${time}${r.event.location ? ` · ${r.event.location}` : ""}`;
        try {
          const n = new Notification(r.channel === "log" ? `Logga: ${r.event.title}` : r.event.title, {
            body,
            tag: r.id,
          });
          n.onclick = () => { window.focus(); };
        } catch { /* notification may fail on some platforms */ }
        await supabase
          .from("event_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", r.id);
      }
      qc.invalidateQueries({ queryKey: ["event_reminders"] });
    }

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [qc]);
}

/** Upcoming reminders (for the "Kommande" panel). */
export function usePendingReminders() {
  return useQuery({
    queryKey: ["event_reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_reminders")
        .select("id, event_id, channel, scheduled_at, status, occurrence_date")
        .eq("status", "pending")
        .order("scheduled_at")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Changing a calendar's reminder settings drops its queued (unsent) reminders. */
export function useResetPendingForCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      const { data: evs } = await supabase.from("events").select("id").eq("calendar_id", calendarId);
      const ids = (evs ?? []).map((e) => e.id);
      if (!ids.length) return;
      const { error } = await supabase
        .from("event_reminders")
        .delete()
        .eq("status", "pending")
        .in("event_id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_reminders"] }),
  });
}

export { HORIZON_DAYS };
export function useCalendarsForReminders() {
  const q = useCalendars();
  return { ...q, data: (q.data ?? []).filter((c) => !c.archived) };
}
