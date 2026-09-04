import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Outlook / ICS sync server functions — thin authenticated wrappers around
 * the core logic in outlook-sync.server.ts. No tokens ever reach the browser.
 */

const SECRET_CANDIDATES = [
  "MICROSOFT_OUTLOOK_API_KEY",
  "MICROSOFT_OUTLOOK_API_KEY_1",
  "MICROSOFT_OUTLOOK_API_KEY_2",
  "MICROSOFT_OUTLOOK_API_KEY_3",
];

const ACCOUNT_COLORS = ["#0f6cbd", "#7c3aed", "#0e9f6e", "#d97706"];

/** Register any linked Outlook connections that aren't in outlook_accounts yet. */
export const claimOutlookConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { graphCall } = await import("@/lib/outlook-sync.server");
    const claimed: string[] = [];
    const errors: string[] = [];

    const { data: existing } = await supabase
      .from("outlook_accounts" as never)
      .select("secret_env");
    const taken = new Set(((existing ?? []) as { secret_env: string }[]).map((r) => r.secret_env));

    for (const envName of SECRET_CANDIDATES) {
      if (!process.env[envName] || taken.has(envName)) continue;
      const res = await graphCall(envName, "/me?$select=mail,userPrincipalName,displayName");
      if (!res.ok) {
        errors.push(`koppling ${taken.size + claimed.length + 1}: svar ${res.status}`);
        continue;
      }
      const me = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
      const email = me.mail || me.userPrincipalName || "";
      if (!email) { errors.push("koppling: ingen e-post hittades"); continue; }

      const color = ACCOUNT_COLORS[(taken.size + claimed.length) % ACCOUNT_COLORS.length];
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
    return (data ?? []) as {
      id: string;
      email: string;
      calendar_id: string | null;
      last_synced_at: string | null;
    }[];
  });

export const syncOutlookAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { syncOutlookAccountCore } = await import("@/lib/outlook-sync.server");
    return syncOutlookAccountCore(context.supabase, context.userId, data.accountId);
  });

/** Sync all accounts; skips accounts synced within the last 14 minutes. */
export const syncAllOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncOutlookAccountCore } = await import("@/lib/outlook-sync.server");
    const { data } = await context.supabase
      .from("outlook_accounts" as never)
      .select("id, last_synced_at");
    const accounts = (data ?? []) as { id: string; last_synced_at: string | null }[];
    const results: { id: string; ok: boolean; detail?: string }[] = [];
    for (const a of accounts) {
      if (a.last_synced_at && Date.now() - new Date(a.last_synced_at).getTime() < 14 * 60_000) {
        continue;
      }
      try {
        const r = await syncOutlookAccountCore(context.supabase, context.userId, a.id);
        results.push({ id: a.id, ok: true, detail: `${r.synced} events` });
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
    const { syncIcsCalendarCore } = await import("@/lib/outlook-sync.server");
    return syncIcsCalendarCore(context.supabase, context.userId, data.calendarId);
  });

export const syncAllIcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncIcsCalendarCore } = await import("@/lib/outlook-sync.server");
    const { data } = await context.supabase
      .from("calendars")
      .select("id")
      .not("ics_url", "is", null)
      .eq("archived", false);
    const results: { id: string; ok: boolean; detail?: string }[] = [];
    for (const c of (data ?? []) as { id: string }[]) {
      try {
        const r = await syncIcsCalendarCore(context.supabase, context.userId, c.id);
        results.push({ id: c.id, ok: true, detail: `${r.synced} events` });
      } catch (e) {
        results.push({ id: c.id, ok: false, detail: e instanceof Error ? e.message : "fel" });
      }
    }
    return results;
  });
