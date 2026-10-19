import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Two-way sync between One and the Hotmail Outlook calendar.
 * No background polling: pull runs on demand (button / once per app session),
 * push runs right after an event in the Outlook calendar is saved or deleted.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";
const TZ = "Europe/Stockholm";
const CAL_NAME = "Hotmail";

function headers(): Record<string, string> {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.MICROSOFT_OUTLOOK_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY is not configured");
  if (!key) throw new Error("MICROSOFT_OUTLOOK_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
    Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"',
  };
}

async function graph(path: string, init: RequestInit = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok && !(init.method === "DELETE" && res.status === 404)) {
    const body = await res.text();
    console.error(`Outlook request failed [${res.status}]: ${body}`);
    throw new Error(`Outlook request failed [${res.status}]: ${body}`);
  }
  if (res.status === 204 || init.method === "DELETE") return null;
  return res.json();
}

/** Stockholm-local date (YYYY-MM-DD) for a UTC instant. */
function localDate(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
/** UTC instant of Stockholm midnight on a given date. */
function stockholmMidnight(date: string) {
  const guess = new Date(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(guess);
  const offsetH = Number(parts) || 0; // Stockholm hour at UTC midnight = UTC offset
  return new Date(guess.getTime() - offsetH * 3600_000).toISOString();
}

type Ev = {
  id: string; title: string; description: string | null; location: string | null;
  start_at: string; end_at: string; all_day: boolean; external_id: string | null;
};

function toGraph(e: Ev) {
  const span = e.all_day
    ? {
        isAllDay: true,
        start: { dateTime: `${localDate(e.start_at)}T00:00:00`, timeZone: TZ },
        // all-day end must be the following midnight
        end: {
          dateTime: `${localDate(new Date(Math.max(new Date(e.end_at).getTime() - 1, new Date(e.start_at).getTime()) + 86400_000).toISOString())}T00:00:00`,
          timeZone: TZ,
        },
      }
    : {
        isAllDay: false,
        start: { dateTime: e.start_at.replace(/Z$|\+00(:00)?$/, ""), timeZone: "UTC" },
        end: { dateTime: e.end_at.replace(/Z$|\+00(:00)?$/, ""), timeZone: "UTC" },
      };
  return {
    subject: e.title,
    body: { contentType: "text", content: e.description ?? "" },
    location: { displayName: e.location ?? "" },
    ...span,
  };
}

async function getOutlookCalendarId(supabase: any, userId: string) {
  const { data } = await supabase.from("calendars").select("id").eq("source", "outlook").limit(1);
  if (data?.[0]) return data[0].id as string;
  const { data: created, error } = await supabase
    .from("calendars")
    .insert({ user_id: userId, name: CAL_NAME, source: "outlook", kind: "other", color: "#0078D4" })
    .select("id").single();
  if (error) throw error;
  return created.id as string;
}

/** Push one event (create/update/delete) to Outlook if it belongs to the Outlook calendar. */
export const pushOutlookEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; op: "upsert" | "delete" }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: ev } = await sb
      .from("events")
      .select("id,title,description,location,start_at,end_at,all_day,external_id,rrule,calendars!inner(source)")
      .eq("id", data.id).maybeSingle();
    if (!ev || ev.calendars?.source !== "outlook") return { pushed: false };
    if (data.op === "delete") {
      if (ev.external_id) await graph(`/me/events/${ev.external_id}`, { method: "DELETE" });
      return { pushed: true };
    }
    if (ev.external_id) {
      await graph(`/me/events/${ev.external_id}`, { method: "PATCH", body: JSON.stringify(toGraph(ev)) });
    } else {
      const created = await graph(`/me/calendar/events`, { method: "POST", body: JSON.stringify(toGraph(ev)) });
      await sb.from("events").update({ external_id: created.id }).eq("id", ev.id);
    }
    return { pushed: true };
  });

/** Pull Outlook → One (and push any un-synced One events). */
export const syncOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const calId = await getOutlookCalendarId(sb, context.userId);
    const from = new Date(Date.now() - 30 * 86400_000).toISOString();
    const to = new Date(Date.now() + 180 * 86400_000).toISOString();

    const remote: any[] = [];
    let url: string | null =
      `/me/calendar/calendarView?startDateTime=${from}&endDateTime=${to}&$top=200` +
      `&$select=id,subject,body,location,start,end,isAllDay,isCancelled`;
    while (url) {
      const page: any = await graph(url);
      remote.push(...(page.value ?? []));
      url = page["@odata.nextLink"] ?? null;
    }

    const { data: local } = await sb
      .from("events")
      .select("id,title,description,location,start_at,end_at,all_day,external_id")
      .eq("calendar_id", calId).is("deleted_at", null);
    const byExt = new Map<string, Ev>((local ?? []).filter((e: Ev) => e.external_id).map((e: Ev) => [e.external_id!, e]));

    let added = 0, updated = 0, removed = 0, pushed = 0;
    const seen = new Set<string>();
    for (const r of remote) {
      if (r.isCancelled) continue;
      seen.add(r.id);
      const startUtc = `${r.start.dateTime.slice(0, 19)}Z`;
      const endUtc = `${r.end.dateTime.slice(0, 19)}Z`;
      const row = {
        title: r.subject || "(utan titel)",
        description: r.body?.content?.trim() || null,
        location: r.location?.displayName || null,
        all_day: !!r.isAllDay,
        start_at: r.isAllDay ? stockholmMidnight(r.start.dateTime.slice(0, 10)) : startUtc,
        end_at: r.isAllDay ? stockholmMidnight(r.end.dateTime.slice(0, 10)) : endUtc,
      };
      const ex = byExt.get(r.id);
      if (!ex) {
        const { error } = await sb.from("events").insert({ ...row, user_id: context.userId, calendar_id: calId, external_id: r.id });
        if (!error) added++;
      } else if (
        ex.title !== row.title || (ex.description ?? null) !== row.description || (ex.location ?? null) !== row.location ||
        ex.all_day !== row.all_day || +new Date(ex.start_at) !== +new Date(row.start_at) || +new Date(ex.end_at) !== +new Date(row.end_at)
      ) {
        await sb.from("events").update(row).eq("id", ex.id);
        updated++;
      }
    }
    for (const e of (local ?? []) as Ev[]) {
      if (e.external_id && !seen.has(e.external_id) && e.start_at >= from && e.start_at <= to) {
        await sb.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", e.id);
        removed++;
      } else if (!e.external_id) {
        const created = await graph(`/me/calendar/events`, { method: "POST", body: JSON.stringify(toGraph(e)) });
        await sb.from("events").update({ external_id: created.id }).eq("id", e.id);
        pushed++;
      }
    }
    return { added, updated, removed, pushed };
  });
