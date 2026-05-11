// AI calendar assistant with tool-calling. Runs as the signed-in user (RLS).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BULK = 50;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_calendars",
      description: "List the user's calendars (id, name, source, color).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_events",
      description:
        "Find non-deleted events by fuzzy title/location match and optional date range. Returns full event ids you can then pass to update_event or the preview_* tools. ALWAYS call this before updating or deleting if you don't already have the exact full UUID.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          calendar_name: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          weekday: { type: "string", enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description: "Get non-deleted events between two ISO dates. Optional text filter on title/location.",
      parameters: {
        type: "object",
        properties: { start: { type: "string" }, end: { type: "string" }, query: { type: "string" } },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create one event. ISO 8601 with offset (Europe/Stockholm if unspecified).",
      parameters: {
        type: "object",
        properties: {
          calendar_name: { type: "string" },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          all_day: { type: "boolean" },
          rrule: { type: "string" },
        },
        required: ["calendar_name", "title", "start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description: "Update one event by FULL UUID. Non-destructive single edit.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          all_day: { type: "boolean" },
          rrule: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preview_delete_event",
      description: "Stage a delete. Returns a confirmation_token + preview. Show the preview to the user, ask 'Apply?', then call confirm_delete_event with the token.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Full UUID." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_delete_event",
      description: "Apply a previously previewed delete. Token expires in 5 minutes; one-time use.",
      parameters: {
        type: "object",
        properties: { confirmation_token: { type: "string" } },
        required: ["confirmation_token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preview_bulk_update_events",
      description: `Stage a bulk update (up to ${MAX_BULK} events). Returns confirmation_token + per-event diff. Show summary, ask 'Apply?', then call confirm_bulk_update_events.`,
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          patch: {
            type: "object",
            properties: {
              start_time: { type: "string", description: "HH:MM, Europe/Stockholm" },
              end_time: { type: "string", description: "HH:MM, Europe/Stockholm" },
              location: { type: "string" },
              calendar_name: { type: "string" },
              all_day: { type: "boolean" },
            },
          },
        },
        required: ["ids", "patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_bulk_update_events",
      description: "Apply a previously previewed bulk update.",
      parameters: {
        type: "object",
        properties: { confirmation_token: { type: "string" } },
        required: ["confirmation_token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preview_bulk_create_events",
      description: `Stage a bulk create (up to ${MAX_BULK} events). Returns confirmation_token + sample. Then call confirm_bulk_create_events.`,
      parameters: {
        type: "object",
        properties: {
          calendar_name: { type: "string" },
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                start: { type: "string" },
                end: { type: "string" },
                location: { type: "string" },
                all_day: { type: "boolean" },
              },
              required: ["title", "start", "end"],
            },
          },
        },
        required: ["calendar_name", "events"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_bulk_create_events",
      description: "Apply a previously previewed bulk create.",
      parameters: {
        type: "object",
        properties: { confirmation_token: { type: "string" } },
        required: ["confirmation_token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reimport_from_screenshot",
      description: `Parse an attached screenshot and reconcile against existing events. mode='reconcile' (default): match by title+date, propose time updates and optional inserts. mode='dedupe_only': for dates with 2+ existing events in the calendar, keep the one closest to the screenshot's shift and soft-delete the rest. ALWAYS dry-run — returns confirmation_token + preview. Then call confirm_reimport. Cap ${MAX_BULK} mutations.`,
      parameters: {
        type: "object",
        properties: {
          image_index: { type: "number" },
          calendar_name: { type: "string" },
          view_hint: { type: "string", enum: ["weekly", "monthly"] },
          insert_unmatched: { type: "boolean", description: "Reconcile mode only: include unmatched parsed events as inserts." },
          mode: { type: "string", enum: ["reconcile", "dedupe_only"], description: "Default 'reconcile'. Use 'dedupe_only' to clean up duplicates without touching dates that have only one event." },
        },
        required: ["image_index", "calendar_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_reimport",
      description: "Apply a previously previewed screenshot reimport.",
      parameters: {
        type: "object",
        properties: { confirmation_token: { type: "string" } },
        required: ["confirmation_token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last_delete",
      description: "Restore the most recent soft-deleted event for this user (within the last 30 days). Works for both agent and UI deletes.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function sanitizeHistory(raw: any[]): any[] {
  const msgs = (raw || []).filter((m: any) => m && m.role !== "system");
  const out: any[] = [];
  const knownToolCallIds = new Set<string>();
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const ids: string[] = m.tool_calls.map((tc: any) => tc.id).filter(Boolean);
      const replies: any[] = [];
      let j = i + 1;
      while (j < msgs.length && msgs[j].role === "tool") {
        replies.push(msgs[j]);
        j++;
      }
      const replyIds = new Set(replies.map((r) => r.tool_call_id));
      const allMatched = ids.length > 0 && ids.every((id) => replyIds.has(id));
      if (!allMatched) {
        console.error("dropping orphan assistant tool_calls", { ids, replyIds: [...replyIds] });
        i = j - 1;
        continue;
      }
      ids.forEach((id) => knownToolCallIds.add(id));
      out.push(m);
      for (const r of replies) {
        if (ids.includes(r.tool_call_id)) out.push(r);
      }
      i = j - 1;
    } else if (m.role === "tool") {
      if (m.tool_call_id && knownToolCallIds.has(m.tool_call_id)) {
        out.push(m);
      } else {
        console.error("dropping orphan tool message", { tool_call_id: m.tool_call_id });
      }
    } else {
      out.push(m);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return json({ error: "unauthorized" }, 401);
    const userId = u.user.id;

    const { messages, images } = await req.json();
    const attachedImages: { base64: string; mime: string; name?: string }[] = Array.isArray(images) ? images : [];

    console.error("incoming messages structure:", JSON.stringify(
      (messages || []).map((m: any) => ({
        role: m.role,
        has_tool_calls: Array.isArray(m.tool_calls) && m.tool_calls.length > 0,
        tool_call_id: m.tool_call_id,
      }))
    ));
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const { data: cals } = await supabase.from("calendars").select("id,name,source,color");

    // Just a count for the system prompt — events themselves come from find_events.
    const now = new Date();
    const horizonStart = new Date(now.getTime() - 30 * 86400000).toISOString();
    const horizonEnd = new Date(now.getTime() + 180 * 86400000).toISOString();
    const { count: evCount } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .lte("start_at", horizonEnd)
      .gte("end_at", horizonStart);

    const sys = `You are the user's calendar assistant. Today is ${now.toISOString()}. Timezone: Europe/Stockholm.

User's calendars:
${(cals || []).map((c) => `- ${c.name} (source: ${c.source}, id: ${c.id})`).join("\n") || "(none)"}

Event context: ${evCount ?? 0} non-deleted events in the window now-30d → now+180d. Do NOT guess ids — call find_events to retrieve them.

How to act:
- For new bookings: call create_event for one, or preview_bulk_create_events → confirm_bulk_create_events for many.
- To edit one event: call update_event with the FULL UUID.
- To delete or bulk-modify: you MUST first call the matching preview_* tool and receive a real confirmation_token. Only after that token exists may you ask the user "Apply?". Do NOT tell the user you "will delete" or "will update" anything before the preview_* call has actually returned. Never fabricate a preview or a token.
- If find_events returns no matches for what the user described, stop and tell them immediately: "I couldn't find an event matching [their description]. Could you give me more detail?" Do not invent an event, do not call preview_*, do not ask "Apply?".
- After the user confirms in a NEW message, call confirm_* with the token. Tokens expire in 5 minutes and are one-time use.
- Hard cap: 50 events per bulk operation. If more, batch.
- To recover a recently deleted event (agent OR manual UI delete), call undo_last_delete.
- Always use ISO 8601 with timezone offset. Default Europe/Stockholm.
- Match calendar_name fuzzily (School, Tiger of Sweden, A-hub, Personal). Default Personal if unsure.
- If a tool returns an error, relay the message in plain language.
${attachedImages.length ? `- The user attached ${attachedImages.length} screenshot(s) (indices 0..${attachedImages.length - 1}). Call reimport_from_screenshot (default view_hint='weekly') to get a preview + token, then confirm_reimport after the user approves. If the user says "rensa dubbletter", "fix duplicates", "remove duplicates" or similar, pass mode='dedupe_only' — that mode only touches dates where the calendar has 2+ events and ignores everything else. Default mode is 'reconcile'.` : ""}
- Be concise.`;

    const convo: any[] = [{ role: "system", content: sys }, ...sanitizeHistory(messages)];

    const tokensIssuedThisRequest = new Set<string>();

    for (let i = 0; i < 8; i++) {
      const t0 = Date.now();
      let resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: convo, tools: TOOLS }),
      });
      // Retry once on transient 5xx
      if (resp.status >= 500 && resp.status < 600) {
        console.warn("gateway 5xx, retrying once", resp.status);
        await new Promise((r) => setTimeout(r, 800));
        resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: convo, tools: TOOLS }),
        });
      }
      if (resp.status === 429) return json({ error: "Rate limited, try again shortly.", reply: "Rate limited — please retry in a moment.", convo }, 200);
      if (resp.status === 402) return json({ error: "AI credits exhausted.", reply: "AI credits are exhausted. Add more in Settings → Workspace → Usage to continue.", convo }, 200);
      if (!resp.ok) {
        const t = await resp.text();
        console.error("gateway error", resp.status, t);
        return json({ error: "AI gateway error", reply: "The AI service is temporarily unavailable. Please try again.", convo }, 200);
      }
      const data = await resp.json();
      console.log("[chat] turn", i, JSON.stringify({ ms: Date.now() - t0, usage: data.usage }));
      const msg = data.choices?.[0]?.message;
      if (!msg) return json({ error: "empty response" }, 500);

      const toolCalls = msg.tool_calls || [];
      convo.push(msg);

      if (!toolCalls.length) {
        return json({ reply: msg.content || "", convo });
      }

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        const tt = Date.now();
        const result = await runTool(supabase, userId, cals || [], name, args, attachedImages, auth, tokensIssuedThisRequest);
        if ((name?.startsWith("preview_") || name === "reimport_from_screenshot") && typeof result?.confirmation_token === "string") {
          tokensIssuedThisRequest.add(result.confirmation_token);
        }
        console.log("[tool]", name, JSON.stringify({
          ms: Date.now() - tt,
          args_summary: summarize(args),
          result_summary: summarize(result),
        }));
        convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    return json({ reply: "(stopped: too many tool iterations)", convo });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

async function runTool(
  supabase: any,
  userId: string,
  cals: any[],
  name: string,
  args: any,
  images: { base64: string; mime: string; name?: string }[] = [],
  auth: string = "",
  tokensIssuedThisRequest: Set<string> = new Set(),
) {
  try {
    const calByName = (n?: string) => {
      if (!n) return cals[0];
      const lower = n.toLowerCase();
      return cals.find((c) => c.name.toLowerCase() === lower)
        || cals.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
        || cals.find((c) => c.name.toLowerCase() === "personal")
        || cals[0];
    };

    switch (name) {
      case "list_calendars":
        return { calendars: cals };

      case "find_events": {
        let q = supabase.from("events")
          .select("id,title,start_at,end_at,location,calendar_id,rrule,all_day")
          .is("deleted_at", null);
        if (args.start) q = q.gte("end_at", args.start);
        if (args.end) q = q.lte("start_at", args.end);
        if (args.calendar_name) {
          const cal = calByName(args.calendar_name);
          if (cal) q = q.eq("calendar_id", cal.id);
        }
        const { data, error } = await q.order("start_at").limit(500);
        if (error) return { error: error.message };
        let rows = data || [];
        if (args.query) {
          const ql = args.query.toLowerCase();
          rows = rows.filter((e: any) => `${e.title} ${e.location || ""}`.toLowerCase().includes(ql));
        }
        if (args.weekday) {
          const target = WD.indexOf(args.weekday);
          rows = rows.filter((e: any) => new Date(e.start_at).getUTCDay() === target);
        }
        return { count: rows.length, events: rows };
      }

      case "search_events": {
        const { data, error } = await supabase.from("events")
          .select("id,title,start_at,end_at,location,calendar_id,rrule")
          .is("deleted_at", null)
          .lte("start_at", args.end).gte("end_at", args.start).order("start_at");
        if (error) return { error: error.message };
        const filtered = args.query
          ? (data || []).filter((e: any) => `${e.title} ${e.location || ""}`.toLowerCase().includes(args.query.toLowerCase()))
          : data;
        return { events: filtered };
      }

      case "create_event": {
        const cal = calByName(args.calendar_name);
        if (!cal) return { error: "no calendar" };
        const { data, error } = await supabase.from("events").insert({
          user_id: userId, calendar_id: cal.id, title: args.title,
          start_at: args.start, end_at: args.end,
          location: args.location || null, description: args.description || null,
          all_day: !!args.all_day, rrule: args.rrule || null,
        }).select().single();
        if (error) return { error: error.message };
        await audit(supabase, userId, "create", data.id, null, data, "create_event");
        return { created: data };
      }

      case "update_event": {
        if (!isUuid(args.id)) return { error: `'${args.id}' is not a valid full UUID. Call find_events.` };
        const { data: before, error: be } = await supabase.from("events").select("*").eq("id", args.id).is("deleted_at", null).single();
        if (be || !before) return { error: "event not found (or already deleted)" };
        const patch: any = {};
        for (const k of ["title", "location", "description", "rrule", "all_day"]) if (args[k] !== undefined) patch[k] = args[k];
        if (args.start) patch.start_at = args.start;
        if (args.end) patch.end_at = args.end;
        const { data: after, error } = await supabase.from("events").update(patch).eq("id", args.id).select().single();
        if (error) return { error: error.message };
        await audit(supabase, userId, "update", args.id, before, after, "update_event");
        return { updated: after };
      }

      // ── Preview / confirm: delete ──
      case "preview_delete_event": {
        if (!isUuid(args.id)) return { error: `'${args.id}' is not a valid full UUID.` };
        const { data: row, error: re } = await supabase.from("events")
          .select("id,title,start_at,end_at,location,calendar_id")
          .eq("id", args.id).is("deleted_at", null).single();
        if (re || !row) return { error: "event not found (or already deleted)" };
        const tok = newToken();
        const { error: pe } = await supabase.from("pending_actions").insert({
          user_id: userId, action_type: "delete_event",
          payload: { id: args.id, snapshot: row }, confirmation_token: tok,
        });
        if (pe) return { error: pe.message };
        return {
          confirmation_token: tok, expires_in_seconds: 300,
          preview: { id: row.id, title: row.title, start_at: row.start_at, end_at: row.end_at, calendar: cals.find((c) => c.id === row.calendar_id)?.name },
        };
      }

      case "confirm_delete_event": {
        const pa = await consumeToken(supabase, userId, args.confirmation_token, "delete_event", tokensIssuedThisRequest);
        if ("error" in pa) return pa;
        const id = pa.payload.id as string;
        const { data: before, error: be } = await supabase.from("events").select("*").eq("id", id).single();
        if (be || !before) return { error: "event vanished before confirm" };
        const { error: de } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (de) return { error: de.message };
        await audit(supabase, userId, "soft_delete", id, before, null, "confirm_delete_event");
        return { deleted: id };
      }

      // ── Preview / confirm: bulk update ──
      case "preview_bulk_update_events": {
        const ids: string[] = (args.ids || []).filter(isUuid);
        if (!ids.length) return { error: "No valid UUIDs." };
        if (ids.length > MAX_BULK) return { error: `exceeds ${MAX_BULK}-event cap (got ${ids.length}). Batch in smaller chunks.` };
        const patch = args.patch || {};
        const { data: rows, error } = await supabase.from("events")
          .select("id,title,start_at,end_at,location,calendar_id,all_day")
          .in("id", ids).is("deleted_at", null);
        if (error) return { error: error.message };
        const calId = patch.calendar_name ? calByName(patch.calendar_name)?.id : undefined;
        const diffs: any[] = [];
        for (const r of rows || []) {
          const after: any = { ...r };
          if (patch.start_time) after.start_at = applyTimeOfDay(r.start_at, patch.start_time);
          if (patch.end_time) after.end_at = applyTimeOfDay(r.end_at, patch.end_time);
          if (patch.location !== undefined) after.location = patch.location || null;
          if (patch.all_day !== undefined) after.all_day = !!patch.all_day;
          if (calId) after.calendar_id = calId;
          diffs.push({ id: r.id, before: r, after });
        }
        const tok = newToken();
        const { error: pe } = await supabase.from("pending_actions").insert({
          user_id: userId, action_type: "bulk_update_events",
          payload: { diffs }, confirmation_token: tok,
        });
        if (pe) return { error: pe.message };
        return {
          confirmation_token: tok, expires_in_seconds: 300, count: diffs.length,
          sample: diffs.slice(0, 8).map((d) => ({ title: d.before.title, from: `${d.before.start_at}→${d.before.end_at}`, to: `${d.after.start_at}→${d.after.end_at}` })),
        };
      }

      case "confirm_bulk_update_events": {
        const pa = await consumeToken(supabase, userId, args.confirmation_token, "bulk_update_events", tokensIssuedThisRequest);
        if ("error" in pa) return pa;
        const diffs: any[] = pa.payload.diffs || [];
        let updated = 0; const errs: string[] = [];
        for (const d of diffs) {
          const upd: any = {
            start_at: d.after.start_at, end_at: d.after.end_at,
            location: d.after.location, all_day: d.after.all_day, calendar_id: d.after.calendar_id,
          };
          const { data: after, error } = await supabase.from("events").update(upd).eq("id", d.id).select().single();
          if (error) { errs.push(`${d.id}: ${error.message}`); continue; }
          await audit(supabase, userId, "update", d.id, d.before, after, "confirm_bulk_update_events");
          updated++;
        }
        return { updated_count: updated, errors: errs };
      }

      // ── Preview / confirm: bulk create ──
      case "preview_bulk_create_events": {
        const cal = calByName(args.calendar_name);
        if (!cal) return { error: "no calendar" };
        const evs = args.events || [];
        if (!evs.length) return { error: "no events to create" };
        if (evs.length > MAX_BULK) return { error: `exceeds ${MAX_BULK}-event cap (got ${evs.length}).` };
        const tok = newToken();
        const { error: pe } = await supabase.from("pending_actions").insert({
          user_id: userId, action_type: "bulk_create_events",
          payload: { calendar_id: cal.id, events: evs }, confirmation_token: tok,
        });
        if (pe) return { error: pe.message };
        return {
          confirmation_token: tok, expires_in_seconds: 300, count: evs.length,
          calendar: cal.name, sample: evs.slice(0, 8),
        };
      }

      case "confirm_bulk_create_events": {
        const pa = await consumeToken(supabase, userId, args.confirmation_token, "bulk_create_events", tokensIssuedThisRequest);
        if ("error" in pa) return pa;
        const calId = pa.payload.calendar_id as string;
        const rows = (pa.payload.events as any[]).map((e) => ({
          user_id: userId, calendar_id: calId, title: e.title,
          start_at: e.start, end_at: e.end, location: e.location || null, all_day: !!e.all_day,
        }));
        const { data, error } = await supabase.from("events").insert(rows).select();
        if (error) return { error: error.message };
        for (const row of data || []) {
          await audit(supabase, userId, "create", row.id, null, row, "confirm_bulk_create_events");
        }
        return { created_count: data?.length ?? 0 };
      }

      // ── Reimport (preview only; confirm via confirm_reimport) ──
      case "reimport_from_screenshot": {
        const idx = Number(args.image_index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= images.length) {
          return { error: `image_index ${args.image_index} out of range (have ${images.length})` };
        }
        const cal = calByName(args.calendar_name);
        if (!cal) return { error: `Unknown calendar '${args.calendar_name}'.` };
        const viewHint = args.view_hint || "weekly";
        const insertUnmatched = !!args.insert_unmatched;
        const mode = args.mode === "dedupe_only" ? "dedupe_only" : "reconcile";
        const img = images[idx];
        console.log("[reimport] image", JSON.stringify({
          image_index: idx, images_total: images.length, mime: img.mime, name: img.name, mode,
          base64_len: img.base64?.length || 0, approx_bytes: Math.floor((img.base64?.length || 0) * 3 / 4),
        }));

        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-schedule`;
        const psResp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
          body: JSON.stringify({ imageBase64: img.base64, imageMime: img.mime, referenceDate: new Date().toISOString(), viewHint }),
        });
        if (!psResp.ok) return { error: `parse-schedule failed: ${psResp.status}` };
        const psData = await psResp.json();
        const parsedAll: any[] = psData.events || [];
        const parsed = parsedAll.filter((e) => !(e.all_day && /^host[: ]/i.test(e.title || "")));

        const dates = parsed.map((p) => stockholmDate(p.start)).filter(Boolean);
        if (!dates.length) return { error: "No events found in screenshot." };
        const minDate = dates.sort()[0];
        const maxDate = dates.sort()[dates.length - 1];
        const winStart = `${minDate}T00:00:00Z`;
        const winEndDate = new Date(`${maxDate}T00:00:00Z`); winEndDate.setUTCDate(winEndDate.getUTCDate() + 2);
        const winEnd = winEndDate.toISOString();
        const { data: dbEvs, error: dbErr } = await supabase
          .from("events").select("id,title,start_at,end_at,calendar_id")
          .eq("calendar_id", cal.id).is("deleted_at", null)
          .gte("start_at", winStart).lte("start_at", winEnd);
        if (dbErr) return { error: dbErr.message };

        const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

        // ── dedupe_only mode ──
        if (mode === "dedupe_only") {
          // Group parsed by date — pick the first parsed event per date as the "correct" reference.
          const parsedByDate = new Map<string, any>();
          for (const p of parsed) {
            const d = stockholmDate(p.start);
            if (d && !parsedByDate.has(d)) parsedByDate.set(d, p);
          }
          // Group DB events by date.
          const dbByDate = new Map<string, any[]>();
          for (const e of dbEvs || []) {
            const d = stockholmDate(e.start_at);
            if (!d) continue;
            const arr = dbByDate.get(d) || [];
            arr.push(e);
            dbByDate.set(d, arr);
          }

          const updates: any[] = [];
          const deletes: any[] = [];
          const dedupReport: any[] = [];

          for (const [date, evs] of dbByDate.entries()) {
            if (evs.length < 2) continue; // only act on actual duplicates
            const ref = parsedByDate.get(date);
            let keeper: any;
            if (ref) {
              // Pick the DB event with the smallest combined start+end time delta to the parsed one.
              const refStart = new Date(ref.start).getTime();
              const refEnd = new Date(ref.end).getTime();
              keeper = evs.slice().sort((a, b) => {
                const da = Math.abs(new Date(a.start_at).getTime() - refStart) + Math.abs(new Date(a.end_at).getTime() - refEnd);
                const db2 = Math.abs(new Date(b.start_at).getTime() - refStart) + Math.abs(new Date(b.end_at).getTime() - refEnd);
                return da - db2;
              })[0];
              const sameStart = new Date(keeper.start_at).getTime() === refStart;
              const sameEnd = new Date(keeper.end_at).getTime() === refEnd;
              if (!sameStart || !sameEnd) {
                updates.push({
                  id: keeper.id, title: keeper.title, before: keeper,
                  after_patch: { start_at: ref.start, end_at: ref.end },
                  from: `${keeper.start_at}→${keeper.end_at}`, to: `${ref.start}→${ref.end}`,
                });
              }
            } else {
              // No screenshot reference — keep the earliest, drop the rest.
              keeper = evs.slice().sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
            }
            const removed = evs.filter((e: any) => e.id !== keeper.id);
            for (const r of removed) deletes.push({ id: r.id, before: r, title: r.title, start_at: r.start_at, end_at: r.end_at });
            dedupReport.push({
              date,
              kept: { id: keeper.id, title: keeper.title, from: `${keeper.start_at}→${keeper.end_at}` },
              removed: removed.map((r: any) => ({ id: r.id, title: r.title, from: `${r.start_at}→${r.end_at}` })),
              had_screenshot_reference: !!ref,
            });
          }

          const totalMutations = updates.length + deletes.length;
          if (totalMutations === 0) {
            return { nothing_to_apply: true, calendar: cal.name, mode, reason: "No dates with 2+ events found in this calendar over the screenshot's range." };
          }
          if (totalMutations > MAX_BULK) {
            return { error: `Dedup would mutate ${totalMutations} events (cap ${MAX_BULK}). Narrow the screenshot or split.` };
          }
          const tok = newToken();
          const { error: pe } = await supabase.from("pending_actions").insert({
            user_id: userId, action_type: "reimport_dedupe",
            payload: { calendar_id: cal.id, updates, deletes, dedup_report: dedupReport },
            confirmation_token: tok,
          });
          if (pe) return { error: pe.message };
          return {
            confirmation_token: tok, expires_in_seconds: 300, calendar: cal.name, mode,
            would_update: updates.length,
            would_delete: deletes.length,
            dates_with_duplicates: dedupReport.length,
            sample_updates: updates.slice(0, 8).map((u) => ({ title: u.title, from: u.from, to: u.to })),
            sample_deletes: deletes.slice(0, 8).map((d) => ({ title: d.title, start_at: d.start_at, end_at: d.end_at })),
            dedup_report_sample: dedupReport.slice(0, 8),
          };
        }

        // ── reconcile mode (existing behavior) ──
        const dbByKey = new Map<string, any>();
        for (const e of dbEvs || []) dbByKey.set(`${norm(e.title)}|${stockholmDate(e.start_at)}`, e);
        const updates: any[] = []; const inserts: any[] = []; const skipped: any[] = [];
        for (const p of parsed) {
          const key = `${norm(p.title)}|${stockholmDate(p.start)}`;
          let match = dbByKey.get(key);
          if (!match) {
            const date = stockholmDate(p.start);
            const candidates = (dbEvs || []).filter((e: any) => stockholmDate(e.start_at) === date);
            for (const c of candidates) if (lev(norm(c.title), norm(p.title)) <= 2) { match = c; break; }
          }
          if (match) {
            const sameStart = new Date(match.start_at).getTime() === new Date(p.start).getTime();
            const sameEnd = new Date(match.end_at).getTime() === new Date(p.end).getTime();
            if (sameStart && sameEnd) skipped.push({ title: p.title, reason: "already correct" });
            else updates.push({ id: match.id, title: match.title, before: match, after_patch: { start_at: p.start, end_at: p.end }, from: `${match.start_at}→${match.end_at}`, to: `${p.start}→${p.end}` });
          } else {
            inserts.push({ title: p.title, start: p.start, end: p.end, location: p.location || null, all_day: !!p.all_day });
          }
        }

        const totalMutations = updates.length + (insertUnmatched ? inserts.length : 0);
        if (totalMutations === 0) {
          return { nothing_to_apply: true, calendar: cal.name, skipped_already_correct: skipped.length, unmatched: inserts.length };
        }
        if (totalMutations > MAX_BULK) {
          return { error: `Reimport would mutate ${totalMutations} events (cap ${MAX_BULK}). Narrow the screenshot or split.` };
        }
        const tok = newToken();
        const { error: pe } = await supabase.from("pending_actions").insert({
          user_id: userId, action_type: "reimport_apply",
          payload: { calendar_id: cal.id, updates, inserts: insertUnmatched ? inserts : [] },
          confirmation_token: tok,
        });
        if (pe) return { error: pe.message };
        return {
          confirmation_token: tok, expires_in_seconds: 300, calendar: cal.name, view_hint: viewHint, mode,
          would_update: updates.length,
          would_insert: insertUnmatched ? inserts.length : 0,
          unmatched_not_inserted: insertUnmatched ? 0 : inserts.length,
          skipped_already_correct: skipped.length,
          sample_updates: updates.slice(0, 8).map((u) => ({ title: u.title, from: u.from, to: u.to })),
          sample_inserts: insertUnmatched ? inserts.slice(0, 8) : [],
          sample_unmatched: insertUnmatched ? [] : inserts.slice(0, 8).map((i) => i.title),
        };
      }

      case "confirm_reimport": {
        // Peek to learn whether this token is for reconcile-apply or dedupe.
        const tokStr = args.confirmation_token;
        if (!tokStr || typeof tokStr !== "string") return { error: "missing confirmation_token" };
        if (tokensIssuedThisRequest.has(tokStr)) return { error: "This token was just created in the same turn. Show the preview to the user and wait for their explicit confirmation in a new message before calling confirm_*." };
        const { data: peek } = await supabase.from("pending_actions")
          .select("action_type").eq("user_id", userId).eq("confirmation_token", tokStr).maybeSingle();
        const expected = peek?.action_type === "reimport_dedupe" ? "reimport_dedupe" : "reimport_apply";
        const pa = await consumeToken(supabase, userId, tokStr, expected, tokensIssuedThisRequest);
        if ("error" in pa) return pa;
        const { calendar_id, updates, inserts, deletes, dedup_report } = pa.payload;
        let updated = 0, inserted = 0, deleted = 0; const errs: string[] = [];
        for (const u of updates || []) {
          const { data: after, error } = await supabase.from("events").update(u.after_patch).eq("id", u.id).select().single();
          if (error) { errs.push(`update ${u.id}: ${error.message}`); continue; }
          await audit(supabase, userId, "update", u.id, u.before, after, "confirm_reimport");
          updated++;
        }
        if ((inserts || []).length) {
          const rows = inserts.map((i: any) => ({
            user_id: userId, calendar_id, title: i.title,
            start_at: i.start, end_at: i.end, location: i.location, all_day: !!i.all_day,
          }));
          const { data, error } = await supabase.from("events").insert(rows).select();
          if (error) errs.push(`insert: ${error.message}`);
          else {
            inserted = data?.length || 0;
            for (const row of data || []) await audit(supabase, userId, "create", row.id, null, row, "confirm_reimport");
          }
        }
        if ((deletes || []).length) {
          for (const d of deletes) {
            const { data: after, error } = await supabase.from("events")
              .update({ deleted_at: new Date().toISOString() }).eq("id", d.id).select().single();
            if (error) { errs.push(`delete ${d.id}: ${error.message}`); continue; }
            await audit(supabase, userId, "soft_delete", d.id, d.before, after, "confirm_reimport");
            deleted++;
          }
        }
        if (dedup_report) {
          await audit(supabase, userId, "dedupe_report", null, null, { calendar_id, dedup_report }, "confirm_reimport");
        }
        return { applied: true, updated, inserted, deleted, errors: errs };
      }

      case "undo_last_delete": {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: actions, error } = await supabase.from("agent_actions")
          .select("id,event_id,before,created_at")
          .eq("action", "soft_delete").gte("created_at", since)
          .order("created_at", { ascending: false }).limit(20);
        if (error) return { error: error.message };
        for (const a of actions || []) {
          if (!a.event_id) continue;
          const { data: ev } = await supabase.from("events").select("id,deleted_at").eq("id", a.event_id).maybeSingle();
          if (!ev || ev.deleted_at === null) continue; // already restored or gone
          const { data: after, error: re } = await supabase.from("events").update({ deleted_at: null }).eq("id", a.event_id).select().single();
          if (re) return { error: re.message };
          await audit(supabase, userId, "restore", a.event_id, a.before, after, "undo_last_delete");
          return { restored: after };
        }
        return { error: "Nothing to undo (no soft-deleted events in the last 30 days)." };
      }
    }
    return { error: `unknown tool ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool error" };
  }
}

// ── helpers ──

function newToken(): string {
  // 12 chars from a base32-ish alphabet (no I/O/0/1)
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => a[b % a.length]).join("");
}

async function consumeToken(supabase: any, userId: string, token: string, expectedType: string, tokensIssuedThisRequest: Set<string> = new Set()) {
  if (!token || typeof token !== "string") return { error: "missing confirmation_token" };
  if (tokensIssuedThisRequest.has(token)) return { error: "This token was just created in the same turn. Show the preview to the user and wait for their explicit confirmation in a new message before calling confirm_*." };
  const { data, error } = await supabase.from("pending_actions")
    .select("*").eq("user_id", userId).eq("confirmation_token", token).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Unknown or already-used token." };
  if (data.confirmed_at) return { error: "Token already used." };
  if (new Date(data.expires_at).getTime() < Date.now()) return { error: "Token expired (5 min limit). Re-run the preview." };
  if (data.action_type !== expectedType) return { error: `Token is for ${data.action_type}, not ${expectedType}.` };
  const { error: ue } = await supabase.from("pending_actions")
    .update({ confirmed_at: new Date().toISOString() }).eq("id", data.id);
  if (ue) return { error: ue.message };
  return data;
}

async function audit(supabase: any, userId: string, action: string, eventId: string | null, before: any, after: any, toolName: string) {
  const { error } = await supabase.from("agent_actions").insert({
    user_id: userId, action, event_id: eventId, before, after, tool_name: toolName,
  });
  if (error) console.error("[audit] insert failed", error.message);
}

function summarize(o: any): any {
  if (o == null) return o;
  if (Array.isArray(o)) return o.length > 5 ? `[${o.length} items]` : o.map(summarize);
  if (typeof o === "object") {
    const out: any = {};
    for (const k of Object.keys(o)) {
      const v = (o as any)[k];
      if (typeof v === "string" && v.length > 200) out[k] = `${v.slice(0, 80)}…(${v.length})`;
      else if (Array.isArray(v) && v.length > 5) out[k] = `[${v.length} items]`;
      else out[k] = v;
    }
    return out;
  }
  return o;
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function applyTimeOfDay(iso: string, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value || "00";
  const y = get("year"), m = get("month"), day = get("day");
  const target = new Date(`${y}-${m}-${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const probeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Stockholm", hour: "2-digit", hour12: false }).format(target);
  const probeHour = parseInt(probeFmt, 10);
  const offsetHours = (probeHour - hh + 24) % 24;
  return new Date(target.getTime() - offsetHours * 3600_000).toISOString();
}

function stockholmDate(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch { return ""; }
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  }
  return dp[m][n];
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
