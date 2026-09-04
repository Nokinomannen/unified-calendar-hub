import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Outlook / ICS sync server functions.
 * All Microsoft Graph and ICS fetching happens here on the server — no
 * tokens ever reach the browser. The Lovable connector gateway holds the
 * OAuth credentials; we only read the per-connection gateway keys from
 * server env vars.
 */

const GATEWAY = "https://connector-gateway.lovable.dev";
const SECRET_CANDIDATES = [
  "MICROSOFT_OUTLOOK_API_KEY",
  "MICROSOFT_OUTLOOK_API_KEY_2",
  "MICROSOFT_OUTLOOK_API_KEY_3",
  "MICROSOFT_OUTLOOK_API_KEY_4",
];

const ACCOUNT_COLORS = ["#0f6cbd", "#7c3aed", "#0e9f6e", "#d97706"];

type OutlookAccountRow = {
  id: string;
  user_id: string;
  email: string;
  secret_env: string;
  calendar_id: string | null;
  last_synced_at: string | null;
};

async function graphCall(secretEnv: string, path: string): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env[secretEnv];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY saknas på servern");
  if (!connKey) throw new Error(`Kopplingsnyckeln ${secretEnv} saknas — koppla kontot igen`);
  const res = await fetch(`${GATEWAY}/microsoft_outlook${path}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  return res;
}

/** Register any linked Outlook connections that aren't in outlook_accounts yet. */
export const claimOutlookConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const claimed: string[] = [];
    const errors: string[] = [];

    const { data: existing } = await supabase
      .from("outlook_accounts" as never)
      .select("secret_env");
    const taken = new Set(((existing ?? []) as { secret_env: string }[]).map((r) => r.secret_env));

    for (const envName of SECRET_CANDIDATES) {
      if (!process.env[envName] || taken.has(envName)) continue;
      // Look up the account's identity via Graph /me.
      const res = await graphCall(envName, "/me?$select=mail,userPrincipalName,displayName");
      if (!res.ok) {
        errors.push(`${envName}: ${res.status}`);
        continue;
      }
      const me = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
      const email = me.mail || me.userPrincipalName || "";
      if (!email) { errors.push(`${envName}: ingen e-post hittades`); continue; }

      // Create a calendar for this account.
      const color = ACCOUNT_COLORS[taken.size % ACCOUNT_COLORS.length];
      const { data: cal, error: calErr } = await supabase
        .from("calendars")
        .insert({
          user_id: userId,
          name: `Outlook — ${me.displayName || email}`,
          source: "outlook",
          color,
          kind: "other",
        })
        .select("id")
        .single();
      if (calErr) { errors.push(`${email}: ${calErr.message}`); continue; }

      const { error: accErr } = await supabase
        .from("outlook_accounts" as never)
        .insert({
          user_id: userId,
          email,
          secret_env: envName,
          calendar_id: (cal as { id: string }).id,
        } as never);
      if (accErr) { errors.push(`${email}: ${accErr.message}`); continue; }
      taken.add(envName);
      claimed.push(email);
    }
    return { claimed, errors };
  });

export const listOutlookAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("outlook_accounts" as never)
      .select("id, email, calendar_id, last_synced_at")
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as { id: string; email: string; calendar_id: string | null; last_synced_at: string | null }[];
  });

type GraphEvent = {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  start?: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
  location?: { displayName?: string };
  bodyPreview?: string;
};

function graphTime(t: { dateTime: string; timeZone?: string } | undefined, fallback: Date): Date {
  if (!t?.dateTime) return fallback;
  // Graph returns naive local times with a timeZone label. "UTC" / "tzone://Microsoft/Utc"
  // are the common cases; anything else we interpret via a small mapping.
  const tz = (t.timeZone ?? "UTC").replace("tzone://Microsoft/Utc", "UTC");
  const naive = t.dateTime.replace(/\.\d+$/, "");
  if (tz === "UTC") {
    return new Date(`${naive}${naive.length === 16 ? ":00" : ""}Z`);
  }
  const map: Record<string, string> = {
    "W. Europe Standard Time": "Europe/Berlin",
    "Central European Standard Time": "Europe/Warsaw",
    "Romance Standard Time": "Europe/Paris",
  };
  const iana = map[tz] ?? "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const y = +naive.slice(0, 4), mo = +naive.slice(5, 7) - 1, d = +naive.slice(8, 10);
    const h = +naive.slice(11, 13), mi = +naive.slice(14, 16), s = +(naive.slice(17, 19) || "0");
    let guess = Date.UTC(y, mo, d, h, mi, s);
    const get = (ty: string) => +(parts.formatToParts(new Date(guess)).find((p) => p.type === ty)?.value ?? "0");
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    guess = Date.UTC(y, mo, d, h, mi, s) - (asUtc - guess);
    return new Date(guess);
  } catch {
    return new Date(`${naive}Z`);
  }
}

export const syncOutlookAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error: accErr } = await supabase
      .from("outlook_accounts" as never)
      .select("*")
      .eq("id", data.accountId)
      .single();
    if (accErr || !acc) throw new Error("Kontot hittades inte");
    const account = acc as unknown as OutlookAccountRow;
    if (!account.calendar_id) throw new Error("Kontot saknar kalender");

    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const end = new Date(now.getTime() + 180 * 86400_000).toISOString();

    // Page through calendarView.
    const events: GraphEvent[] = [];
    let path: string | null = `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=200&$select=id,subject,isAllDay,isCancelled,start,end,location,bodyPreview`;
    while (path) {
      const res: Response = await graphCall(account.secret_env, path);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Microsoft svarade ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as { value?: GraphEvent[]; "@odata.nextLink"?: string };
      events.push(...(json.value ?? []));
      const next = json["@odata.nextLink"];
      if (next) {
        const u = new URL(next);
        path = u.pathname.replace(/^\/v1\.0/, "") + u.search;
      } else {
        path = null;
      }
    }

    const rows = events.map((ev) => {
      const s = graphTime(ev.start, now);
      const e = graphTime(ev.end, new Date(s.getTime() + 3600_000));
      return {
        user_id: userId,
        calendar_id: account.calendar_id!,
        title: ev.subject || "(utan titel)",
        start_at: s.toISOString(),
        end_at: e.toISOString(),
        all_day: !!ev.isAllDay,
        location: ev.location?.displayName || null,
        description: ev.bodyPreview || null,
        external_id: ev.id,
        deleted_at: ev.isCancelled ? now.toISOString() : null,
        updated_at: now.toISOString(),
      };
    });

    if (rows.length) {
      const { error: upErr } = await supabase
        .from("events")
        .upsert(rows, { onConflict: "calendar_id,external_id" });
      if (upErr) throw new Error(`Kunde inte spara events: ${upErr.message}`);
    }

    // Soft-delete events that disappeared from Outlook in the window.
    const seen = new Set(events.map((e) => e.id));
    const { data: existing } = await supabase
      .from("events")
      .select("id, external_id")
      .eq("calendar_id", account.calendar_id)
      .not("external_id", "is", null)
      .is("deleted_at", null)
      .gte("start_at", start)
      .lte("start_at", end);
    const stale = ((existing ?? []) as { id: string; external_id: string }[]).filter((r) => !seen.has(r.external_id));
    if (stale.length) {
      await supabase
        .from("events")
        .update({ deleted_at: now.toISOString() })
        .in("id", stale.map((r) => r.id));
    }

    await supabase
      .from("outlook_accounts" as never)
      .update({ last_synced_at: now.toISOString(), updated_at: now.toISOString() } as never)
      .eq("id", account.id);

    return { synced: events.length, removed: stale.length };
  });

/** Sync all accounts; skips accounts synced within the last 14 minutes. */
export const syncAllOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("outlook_accounts" as never)
      .select("id, last_synced_at");
    const accounts = (data ?? []) as { id: string; last_synced_at: string | null }[];
    const results: { id: string; ok: boolean; detail?: string }[] = [];
    for (const a of accounts) {
      if (a.last_synced_at && Date.now() - new Date(a.last_synced_at).getTime() < 14 * 60_000) {
        continue;
      }
      try {
        // Call the underlying handler logic directly via a fresh invocation.
        const r = await syncOutlookAccount({ data: { accountId: a.id } } as never);
        results.push({ id: a.id, ok: true, detail: JSON.stringify(r) });
      } catch (e) {
        results.push({ id: a.id, ok: false, detail: e instanceof Error ? e.message : "fel" });
      }
    }
    return results;
  });

export const disconnectOutlookAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acc } = await supabase
      .from("outlook_accounts" as never)
      .select("id, calendar_id")
      .eq("id", data.accountId)
      .single();
    const account = acc as unknown as { id: string; calendar_id: string | null } | null;
    if (!account) throw new Error("Kontot hittades inte");
    // Soft-delete its events and archive the calendar, then drop the account row.
    if (account.calendar_id) {
      await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("calendar_id", account.calendar_id);
      await supabase
        .from("calendars")
        .update({ archived: true, visible: false })
        .eq("id", account.calendar_id);
    }
    await supabase.from("outlook_accounts" as never).delete().eq("id", account.id);
    return { ok: true };
  });

/* ---------- ICS subscriptions ---------- */

export const syncIcsCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendarId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cal, error: calErr } = await supabase
      .from("calendars")
      .select("id, ics_url")
      .eq("id", data.calendarId)
      .single();
    if (calErr || !cal) throw new Error("Kalendern hittades inte");
    const url = (cal as { ics_url: string | null }).ics_url;
    if (!url) throw new Error("Kalendern har ingen ICS-länk");

    const res = await fetch(url, { headers: { "User-Agent": "One-Calendar/1.0" } });
    if (!res.ok) throw new Error(`Kunde inte hämta kalendern (${res.status})`);
    const text = await res.text();
    const { parseIcs } = await import("@/lib/ics.server");
    const parsed = parseIcs(text);

    const now = new Date();
    const winStart = new Date(now.getTime() - 30 * 86400_000);
    const winEnd = new Date(now.getTime() + 365 * 86400_000);

    const rows = parsed
      .filter((e) => new Date(e.end) >= winStart && new Date(e.start) <= winEnd)
      .map((e) => ({
        user_id: userId,
        calendar_id: data.calendarId,
        title: e.title,
        start_at: e.start,
        end_at: e.end,
        all_day: e.allDay,
        location: e.location,
        description: e.description,
        rrule: e.rrule,
        external_id: e.uid,
        deleted_at: null,
        updated_at: now.toISOString(),
      }));

    if (rows.length) {
      const { error: upErr } = await supabase
        .from("events")
        .upsert(rows, { onConflict: "calendar_id,external_id" });
      if (upErr) throw new Error(`Kunde inte spara events: ${upErr.message}`);
    }
    const seen = new Set(rows.map((r) => r.external_id));
    const { data: existing } = await supabase
      .from("events")
      .select("id, external_id")
      .eq("calendar_id", data.calendarId)
      .not("external_id", "is", null)
      .is("deleted_at", null);
    const stale = ((existing ?? []) as { id: string; external_id: string }[]).filter((r) => !seen.has(r.external_id));
    if (stale.length) {
      await supabase.from("events").update({ deleted_at: now.toISOString() }).in("id", stale.map((r) => r.id));
    }
    return { synced: rows.length, removed: stale.length };
  });

export const syncAllIcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("calendars")
      .select("id")
      .not("ics_url", "is", null)
      .eq("archived", false);
    const results: { id: string; ok: boolean; detail?: string }[] = [];
    for (const c of (data ?? []) as { id: string }[]) {
      try {
        await syncIcsCalendar({ data: { calendarId: c.id } } as never);
        results.push({ id: c.id, ok: true });
      } catch (e) {
        results.push({ id: c.id, ok: false, detail: e instanceof Error ? e.message : "fel" });
      }
    }
    return results;
  });
