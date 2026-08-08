import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: sends queued email reminders that are due.
 * Called by pg_cron every 15 minutes. Notification/log reminders are handled
 * in the app itself; only the `email` channel is processed here.
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
        const nowIso = new Date().toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("event_reminders")
          .select("id, user_id, scheduled_at, event:events(title, start_at, end_at, location, description)")
          .eq("channel", "email")
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .order("scheduled_at")
          .limit(50);

        if (error) {
          console.error("send-reminders query failed", error.message);
          return json({ error: error.message }, 500);
        }
        if (!due?.length) return json({ processed: 0 });

        const apiKey = process.env["RESEND_API_KEY"];
        const from = process.env["REMINDER_FROM_EMAIL"];

        // No email infrastructure yet — park the rows instead of losing them.
        if (!apiKey || !from) {
          await supabaseAdmin
            .from("event_reminders")
            .update({ status: "failed", error: "email_not_configured" })
            .in("id", due.map((r) => r.id));
          return json({ processed: 0, skipped: due.length, reason: "email_not_configured" });
        }

        let sent = 0;
        for (const r of due) {
          const ev = r.event as unknown as
            | { title: string; start_at: string; end_at: string; location: string | null; description: string | null }
            | null;
          if (!ev) continue;

          const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
          const to = userRes?.user?.email;
          if (!to) {
            await supabaseAdmin.from("event_reminders").update({ status: "failed", error: "no_recipient" }).eq("id", r.id);
            continue;
          }

          const when = new Date(ev.start_at).toLocaleString("sv-SE", {
            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            timeZone: "Europe/Stockholm",
          });

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to,
                subject: `Påminnelse: ${ev.title} — ${when}`,
                html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5">
                  <h2 style="margin:0 0 8px">${escapeHtml(ev.title)}</h2>
                  <p style="margin:0 0 4px">${escapeHtml(when)}</p>
                  ${ev.location ? `<p style="margin:0 0 4px;color:#666">${escapeHtml(ev.location)}</p>` : ""}
                  ${ev.description ? `<p style="margin:12px 0 0">${escapeHtml(ev.description)}</p>` : ""}
                </div>`,
              }),
            });
            if (!res.ok) {
              const body = await res.text();
              console.error(`resend failed [${res.status}]: ${body}`);
              await supabaseAdmin.from("event_reminders")
                .update({ status: "failed", error: `resend_${res.status}` }).eq("id", r.id);
              continue;
            }
            await supabaseAdmin.from("event_reminders")
              .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
            sent++;
          } catch (e) {
            console.error("resend threw", e);
            await supabaseAdmin.from("event_reminders")
              .update({ status: "failed", error: "network" }).eq("id", r.id);
          }
        }

        return json({ processed: sent, considered: due.length });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
