// AI calendar assistant with tool-calling. Runs as the signed-in user (RLS).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        "Find events by fuzzy title/location match and optional date range. Returns full event ids you can then pass to update_event, delete_event, or bulk_update_events. ALWAYS call this before updating or deleting if you don't already have the exact full UUID.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Substring match on title or location (case-insensitive)." },
          calendar_name: { type: "string" },
          start: { type: "string", description: "ISO datetime, optional lower bound." },
          end: { type: "string", description: "ISO datetime, optional upper bound." },
          weekday: {
            type: "string",
            enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
            description: "Filter to a specific weekday.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description: "Get events between two ISO dates. Optional text filter on title/location.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
          query: { type: "string" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create one event. Use ISO 8601 with offset (Europe/Stockholm if unspecified).",
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
      description: "Update one event by its FULL UUID id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Full UUID, not a prefix." },
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
      name: "delete_event",
      description: "Delete an event by its FULL UUID id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Full UUID, not a prefix." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_create_events",
      description: "Create many events at once.",
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
      name: "bulk_update_events",
      description:
        "Update many events at once by an explicit list of FULL UUIDs (call find_events first to get them). Use this for pattern fixes like 'change all my Tuesday school events to end at 15:00'. The patch can set new start/end TIME-OF-DAY (HH:MM) which will be applied per-event preserving each event's date.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          patch: {
            type: "object",
            properties: {
              start_time: { type: "string", description: "New start time of day, HH:MM (Europe/Stockholm)." },
              end_time: { type: "string", description: "New end time of day, HH:MM (Europe/Stockholm)." },
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
      name: "reimport_from_screenshot",
      description:
        "Parse an attached screenshot (use the index from the system prompt) and match its events against existing calendar events by title + date (Europe/Stockholm). Updates start/end times for matches and reports unmatched events. Default view_hint is 'weekly'. ALWAYS run with dry_run=true first to preview, then call again with dry_run=false ONLY after the user confirms.",
      parameters: {
        type: "object",
        properties: {
          image_index: { type: "number", description: "0-based index of the attached image." },
          calendar_name: { type: "string", description: "Which calendar to match against (e.g. 'School'). Required." },
          view_hint: { type: "string", enum: ["weekly", "monthly"], description: "Defaults to 'weekly'." },
          dry_run: { type: "boolean", description: "If true, returns preview without writing. Default true." },
          insert_unmatched: { type: "boolean", description: "If true, parsed events with no DB match are inserted as new events. Default false." },
        },
        required: ["image_index", "calendar_name"],
      },
    },
  },
];

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
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const { data: cals } = await supabase.from("calendars").select("id,name,source,color");
    const now = new Date();
    const horizonStart = new Date(now.getTime() - 30 * 86400000).toISOString();
    const horizonEnd = new Date(now.getTime() + 180 * 86400000).toISOString();
    const { data: evs } = await supabase
      .from("events")
      .select("id,title,start_at,end_at,location,calendar_id,rrule")
      .lte("start_at", horizonEnd)
      .gte("end_at", horizonStart)
      .order("start_at")
      .limit(300);

    const calNameById = new Map((cals || []).map((c) => [c.id, c.name]));

    const sys = `You are the user's calendar assistant. Today is ${now.toISOString()}. Timezone: Europe/Stockholm.

User's calendars:
${(cals || []).map((c) => `- ${c.name} (source: ${c.source}, id: ${c.id})`).join("\n")}

Recent + upcoming events (FULL ids — use these exactly when you call update_event / delete_event):
${(evs || []).map((e) => `- id=${e.id} | "${e.title}" | ${e.start_at} → ${e.end_at} | calendar=${calNameById.get(e.calendar_id) || "?"}${e.location ? ` | @${e.location}` : ""}${e.rrule ? ` | recurring=${e.rrule}` : ""}`).join("\n") || "(none)"}

How to act:
- For new bookings: call create_event or bulk_create_events directly.
- To change or delete events: ALWAYS use the FULL UUID (the value after id=). Never invent or shorten ids. If you only have a vague reference ("the host caro event"), call find_events first to get the full id, then update_event / delete_event.
- For pattern fixes ("all my Tuesday school events end at 15:00 not 10:30"): call find_events to gather ids, then call bulk_update_events with patch.start_time/patch.end_time as HH:MM. The system will preserve each event's date and shift only the time of day.
- Risk policy:
  - Direct action for clear single creates / single edits / non-destructive moves.
  - Before any DELETE, or any change touching MORE THAN 3 events, briefly list what you'll do and ask "Apply?" — only proceed after the user confirms.
- Always use ISO 8601 with timezone offset for explicit datetimes. Default to Europe/Stockholm.
- Match calendar_name fuzzily (School, Tiger of Sweden, A-hub, Personal). Default Personal if unsure.
- If a tool returns an error, tell the user the actual error message in plain language and suggest a fix. Don't say "tool error".
- Be concise.`;

    const convo: any[] = [{ role: "system", content: sys }, ...messages];

    for (let i = 0; i < 8; i++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
        }),
      });
      if (resp.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      if (!resp.ok) {
        const t = await resp.text();
        console.error("gateway error", resp.status, t);
        return json({ error: "AI gateway error" }, 500);
      }
      const data = await resp.json();
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
        const result = await runTool(supabase, userId, cals || [], name, args);
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return json({ reply: "(stopped: too many tool iterations)", convo });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

async function runTool(supabase: any, userId: string, cals: any[], name: string, args: any) {
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
        let q = supabase.from("events").select("id,title,start_at,end_at,location,calendar_id,rrule,all_day");
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
          user_id: userId,
          calendar_id: cal.id,
          title: args.title,
          start_at: args.start,
          end_at: args.end,
          location: args.location || null,
          description: args.description || null,
          all_day: !!args.all_day,
          rrule: args.rrule || null,
        }).select().single();
        if (error) return { error: error.message };
        return { created: data };
      }

      case "update_event": {
        if (!isUuid(args.id)) return { error: `'${args.id}' is not a valid full UUID. Call find_events to get the real id.` };
        const patch: any = {};
        for (const k of ["title", "location", "description", "rrule", "all_day"]) if (args[k] !== undefined) patch[k] = args[k];
        if (args.start) patch.start_at = args.start;
        if (args.end) patch.end_at = args.end;
        const { data, error } = await supabase.from("events").update(patch).eq("id", args.id).select().single();
        if (error) return { error: error.message };
        return { updated: data };
      }

      case "delete_event": {
        if (!isUuid(args.id)) return { error: `'${args.id}' is not a valid full UUID. Call find_events to get the real id.` };
        const { error, count } = await supabase.from("events").delete({ count: "exact" }).eq("id", args.id);
        if (error) return { error: error.message };
        if (!count) return { error: `No event found with id ${args.id}` };
        return { deleted: args.id };
      }

      case "bulk_create_events": {
        const cal = calByName(args.calendar_name);
        if (!cal) return { error: "no calendar" };
        const rows = (args.events || []).map((e: any) => ({
          user_id: userId, calendar_id: cal.id, title: e.title,
          start_at: e.start, end_at: e.end, location: e.location || null, all_day: !!e.all_day,
        }));
        const { data, error } = await supabase.from("events").insert(rows).select();
        if (error) return { error: error.message };
        return { created_count: data?.length ?? 0 };
      }

      case "bulk_update_events": {
        const ids: string[] = (args.ids || []).filter(isUuid);
        if (!ids.length) return { error: "No valid UUIDs supplied. Call find_events first." };
        const patch = args.patch || {};
        const { data: rows, error: e1 } = await supabase
          .from("events").select("id,start_at,end_at").in("id", ids);
        if (e1) return { error: e1.message };

        const calId = patch.calendar_name ? calByName(patch.calendar_name)?.id : undefined;
        let updated = 0;
        const errs: string[] = [];
        for (const r of rows || []) {
          const upd: any = {};
          if (patch.start_time) upd.start_at = applyTimeOfDay(r.start_at, patch.start_time);
          if (patch.end_time) upd.end_at = applyTimeOfDay(r.end_at, patch.end_time);
          if (patch.location !== undefined) upd.location = patch.location || null;
          if (patch.all_day !== undefined) upd.all_day = !!patch.all_day;
          if (calId) upd.calendar_id = calId;
          if (!Object.keys(upd).length) continue;
          const { error } = await supabase.from("events").update(upd).eq("id", r.id);
          if (error) errs.push(`${r.id}: ${error.message}`); else updated++;
        }
        return { updated_count: updated, errors: errs };
      }
    }
    return { error: `unknown tool ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool error" };
  }
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Replace the time-of-day in a UTC ISO string while preserving the date as observed in Europe/Stockholm.
function applyTimeOfDay(iso: string, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date(iso);
  // Determine Stockholm date components for d
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value || "00";
  const y = get("year"), m = get("month"), day = get("day");
  // Build a target wall-clock in Stockholm; figure out offset by probing
  const target = new Date(`${y}-${m}-${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  // Compute Stockholm offset at that instant
  const probeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm", hour: "2-digit", hour12: false,
  }).format(target);
  const probeHour = parseInt(probeFmt, 10);
  const offsetHours = (probeHour - hh + 24) % 24;
  // Adjust: the wall-clock time we built was UTC; subtract offset to get true UTC
  return new Date(target.getTime() - offsetHours * 3600_000).toISOString();
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
