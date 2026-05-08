// Parses pasted text OR an image into structured calendar events using Lovable AI.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You extract calendar events from messy input (timetables, shift schedules, screenshots, Outlook copy-paste, emails).
Resolve all dates absolutely. Anchor relative weekdays to the reference date.
Return ISO 8601 datetimes WITH timezone offset. If no timezone is given, assume Europe/Stockholm (+01:00 winter, +02:00 summer).
If the source is a MONTHLY view screenshot, end times are usually NOT visible — set "uncertain_duration": true and use a placeholder 1h duration.
If the source is a WEEKLY or DAILY view, trust the visible block heights for duration.
Only return events you are confident about. Skip headers, navigation, and noise.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, imageBase64, imageMime, referenceDate, viewHint } = await req.json();
    if (!text && !imageBase64) {
      return json({ error: "text or imageBase64 required" }, 400);
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const hintLine = viewHint === "monthly"
      ? "IMPORTANT: This screenshot is a MONTHLY view. Mark every event with uncertain_duration=true."
      : viewHint === "weekly"
        ? "IMPORTANT: This screenshot is a WEEKLY/DAILY view. Trust visible block heights for end times."
        : "";

    const userContent: unknown[] = [
      { type: "text", text: `Reference date: ${referenceDate || new Date().toISOString()}\n${hintLine}\n\n${text ? `Schedule:\n${text}` : "Extract events from the attached image."}` },
    ];
    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${imageMime || "image/png"};base64,${imageBase64}` },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: imageBase64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_events",
            description: "Save the parsed events.",
            parameters: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      start: { type: "string", description: "ISO 8601 with offset" },
                      end: { type: "string", description: "ISO 8601 with offset" },
                      location: { type: "string" },
                      description: { type: "string" },
                      all_day: { type: "boolean" },
                      uncertain_duration: { type: "boolean" },
                    },
                    required: ["title", "start", "end"],
                  },
                },
              },
              required: ["events"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_events" } },
      }),
    });

    if (resp.status === 429) return json({ error: "Rate limit, try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { events: [] };
    return json(args, 200);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
