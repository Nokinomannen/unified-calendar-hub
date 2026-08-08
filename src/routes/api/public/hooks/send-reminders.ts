import * as React from "react";
import { render } from "@react-email/render";
import { createFileRoute } from "@tanstack/react-router";
import { EventReminderEmail } from "@/lib/email-templates/event-reminder";

const SITE_NAME = "Unified Calendar Hub";
const SENDER_DOMAIN = "notify.noahkruegers.com";
const FROM_DOMAIN = "notify.noahkruegers.com";

/**
 * Cron endpoint: renders and enqueues due email reminders.
 * Called by pg_cron; notification/log reminders inside the app are handled client-side.
 */
export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env["SUPABASE_ANON_KEY"]) {
          return json({ error: "unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Email infra tables are managed outside the generated schema types.
        const db = supabaseAdmin as unknown as {
          from: (t: string) => any;
          rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        };

        const { data: due, error } = await supabaseAdmin
          .from("event_reminders")
          .select("id, user_id, channel, event:events(title, start_at, location, description, calendar:calendars(name))")
          .eq("channel", "email")
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at")
          .limit(50);

        if (error) {
          console.error("send-reminders query failed", error.message);
          return json({ error: error.message }, 500);
        }
        if (!due?.length) return json({ processed: 0 });

        let queued = 0;
        for (const r of due) {
          const ev = r.event as unknown as
            | { title: string; start_at: string; location: string | null; description: string | null; calendar: { name: string } | null }
            | null;
          if (!ev) {
            await fail(supabaseAdmin, r.id, "event_missing");
            continue;
          }

          const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
          const to = userRes?.user?.email;
          if (!to) { await fail(supabaseAdmin, r.id, "no_recipient"); continue; }

          const normalized = to.toLowerCase();
          const { data: suppressed } = await db
            .from("suppressed_emails").select("id").eq("email", normalized).maybeSingle();
          if (suppressed) { await fail(supabaseAdmin, r.id, "suppressed"); continue; }

          // One unsubscribe token per address.
          let unsubscribeToken: string | null = null;
          const { data: existing } = await db
            .from("email_unsubscribe_tokens").select("token, used_at").eq("email", normalized).maybeSingle();
          if (existing && !existing.used_at) {
            unsubscribeToken = existing.token;
          } else if (!existing) {
            const t = randomToken();
            await db.from("email_unsubscribe_tokens")
              .upsert({ token: t, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
            const { data: stored } = await db
              .from("email_unsubscribe_tokens").select("token").eq("email", normalized).maybeSingle();
            unsubscribeToken = stored?.token ?? t;
          } else {
            await fail(supabaseAdmin, r.id, "unsubscribed");
            continue;
          }

          const when = new Date(ev.start_at).toLocaleString("sv-SE", {
            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            timeZone: "Europe/Stockholm",
          });
          const data = {
            title: ev.title,
            when,
            location: ev.location,
            notes: ev.description,
            calendarName: ev.calendar?.name ?? null,
            isLogReminder: false,
          };
          const element = React.createElement(EventReminderEmail, data);
          const html = await render(element);
          const text = await render(element, { plainText: true });
          const messageId = crypto.randomUUID();

          await db.from("email_send_log").insert({
            message_id: messageId,
            template_name: "event-reminder",
            recipient_email: to,
            status: "pending",
          });

          const { error: enqErr } = await db.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              message_id: messageId,
              to,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: `Påminnelse: ${ev.title} — ${when}`,
              html,
              text,
              purpose: "transactional",
              label: "event-reminder",
              idempotency_key: `reminder-${r.id}`,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            console.error("enqueue failed", enqErr.message);
            await db.from("email_send_log").insert({
              message_id: messageId,
              template_name: "event-reminder",
              recipient_email: to,
              status: "failed",
              error_message: "Failed to enqueue email",
            });
            await fail(supabaseAdmin, r.id, "enqueue_failed");
            continue;
          }

          await supabaseAdmin.from("event_reminders")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", r.id);
          queued++;
        }

        return json({ processed: queued, considered: due.length });
      },
    },
  },
});

async function fail(db: { from: (t: string) => any }, id: string, reason: string) {
  await db.from("event_reminders").update({ status: "failed", error: reason }).eq("id", id);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
