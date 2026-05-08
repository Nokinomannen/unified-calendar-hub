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
      name: "search_events",
      description: "Get events between two ISO dates. Optional text filter on title/location.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "ISO datetime (inclusive)" },
          end: { type: "string", description: "ISO datetime (inclusive)" },
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
      description: "Create one event. Use ISO 8601 datetimes with timezone offset (Europe/Stockholm if unspecified). Set rrule for recurring events (e.g. 'FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260630T000000Z').",
      parameters: {
        type: "object",
        properties: {
          calendar_name: { type: "string", description: "Name of target calendar (School, Tiger of Sweden, A-hub, Personal)" },
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
      description: "Update an existing event by id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
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
      description: "Delete an event by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_create_events",
      description: "Create many events at once (e.g. from a pasted schedule).",
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

    const { messages } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    // Build context: calendars + upcoming events summary
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
      .limit(200);

    const sys = `You are the user's calendar assistant. Today is ${now.toISOString()}. Timezone: Europe/Stockholm.

User's calendars:
${(cals || []).map((c) => `- ${c.name} (source: ${c.source})`).join("\n")}

Recent + upcoming events (sample, up to 200):
${(evs || []).map((e) => `- [${e.id.slice(0, 8)}] ${e.title} | ${e.start_at} → ${e.end_at}${e.location ? ` @ ${e.location}` : ""}${e.rrule ? ` (recurring: ${e.rrule})` : ""}`).join("\n") || "(none)"}

Rules:
- When the user describes a new booking, immediately call create_event (or bulk_create_events). Don't ask for confirmation unless ambiguous.
- Always use ISO 8601 with timezone offset. Default to Europe/Stockholm.
- For recurring events use create_event with an RRULE string.
- If the user asks "what's on X", call search_events for that date.
- Match calendar_name fuzzily to the user's calendar list. Default to "Personal" for personal stuff, "School" for classes, the job name for shifts.
- Be concise. After acting, briefly summarize what you did.`;

    const convo: any[] = [{ role: "system", content: sys }, ...messages];

    // Loop with tool-calls (max 6 iterations)
    for (let i = 0; i < 6; i++) {
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
        console.error("gateway error", resp.status, await resp.text());
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

      case "search_events": {
        let q = supabase.from("events").select("id,title,start_at,end_at,location,calendar_id,rrule")
          .lte("start_at", args.end).gte("end_at", args.start).order("start_at");
        const { data, error } = await q;
        if (error) throw error;
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
        if (error) throw error;
        return { created: data };
      }

      case "update_event": {
        const patch: any = {};
        for (const k of ["title", "location", "description", "rrule"]) if (args[k] !== undefined) patch[k] = args[k];
        if (args.start) patch.start_at = args.start;
        if (args.end) patch.end_at = args.end;
        const { data, error } = await supabase.from("events").update(patch).eq("id", args.id).select().single();
        if (error) throw error;
        return { updated: data };
      }

      case "delete_event": {
        const { error } = await supabase.from("events").delete().eq("id", args.id);
        if (error) throw error;
        return { deleted: args.id };
      }

      case "bulk_create_events": {
        const cal = calByName(args.calendar_name);
        if (!cal) return { error: "no calendar" };
        const rows = (args.events || []).map((e: any) => ({
          user_id: userId,
          calendar_id: cal.id,
          title: e.title,
          start_at: e.start,
          end_at: e.end,
          location: e.location || null,
          all_day: !!e.all_day,
        }));
        const { data, error } = await supabase.from("events").insert(rows).select();
        if (error) throw error;
        return { created_count: data?.length ?? 0 };
      }
    }
    return { error: `unknown tool ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool error" };
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
