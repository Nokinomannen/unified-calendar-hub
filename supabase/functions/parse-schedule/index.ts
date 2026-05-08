// Parses pasted text OR an image into structured calendar events using Lovable AI.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You extract calendar events from messy input (timetables, shift schedules, screenshots, Outlook copy-paste, emails).

CRITICAL RULES FOR DATES (when input is an image):
- Dates MUST come from text that is directly visible in the image — column headers, day-of-month labels, "Mon Jan 13" style stamps, or week-range banners.
- The reference date is ONLY used to resolve a relative weekday ("Tue") when the image shows a weekday but no full date. It is NEVER a default to fall back on.
- NEVER invent a date. If you cannot read a date from the image, SKIP that event entirely.
- For each event, populate "evidence": { "date_source": "image" | "inferred_from_weekday", "visible_text": "<the exact substring you read for the date>" }.

Return ISO 8601 datetimes WITH timezone offset. If no timezone is given, assume Europe/Stockholm (+01:00 winter, +02:00 summer).
If the source is a MONTHLY view screenshot, end times are usually NOT visible — set "uncertain_duration": true and use a placeholder 1h duration.
If the source is a WEEKLY or DAILY view, trust the visible block heights for duration.
Skip headers, navigation, and noise.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, imageBase64, imageMime, referenceDate, viewHint } = await req.json();
    if (!text && !imageBase64) {
      return json({ error: "text or imageBase64 required" }, 400);
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    // Debug: image diagnostics
    if (imageBase64) {
      const approxBytes = Math.floor(imageBase64.length * 3 / 4);
      const headHex = peekHex(imageBase64, 16);
      const dims = sniffDimensions(imageBase64, imageMime || "");
      console.log("[parse-schedule] image", JSON.stringify({
        mime: imageMime,
        base64_len: imageBase64.length,
        approx_bytes: approxBytes,
        approx_mb: +(approxBytes / 1048576).toFixed(2),
        head_hex: headHex,
        width: dims?.width,
        height: dims?.height,
        viewHint,
      }));
      if (approxBytes > 18 * 1048576) {
        console.warn("[parse-schedule] image > 18MB, gateway may reject");
      }
    }

    const hintLine = viewHint === "monthly"
      ? "IMPORTANT: This screenshot is a MONTHLY view. Mark every event with uncertain_duration=true."
      : viewHint === "weekly"
        ? "IMPORTANT: This screenshot is a WEEKLY/DAILY view. Trust visible block heights for end times. Read the date from each day's column header."
        : "";

    const userContent: unknown[] = [
      { type: "text", text: `Reference date (only for resolving bare weekdays): ${referenceDate || new Date().toISOString()}\n${hintLine}\n\n${text ? `Schedule:\n${text}` : "Extract events from the attached image. Read every date from text visible in the image — do not infer from the reference date."}` },
    ];
    const model = Deno.env.get("PARSE_SCHEDULE_MODEL") || (imageBase64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash");
    const isOpenAI = model.startsWith("openai/");

    if (imageBase64) {
      const imageUrl = `data:${imageMime || "image/png"};base64,${imageBase64}`;
      userContent.push({
        type: "image_url",
        image_url: isOpenAI ? { url: imageUrl, detail: "high" } : { url: imageUrl },
      });
    }

    console.log("[parse-schedule] model", model);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
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
                      evidence: {
                        type: "object",
                        properties: {
                          date_source: { type: "string", enum: ["image", "inferred_from_weekday"] },
                          visible_text: { type: "string", description: "Exact substring read from image for the date." },
                        },
                      },
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
    console.log("[parse-schedule] gateway", JSON.stringify({ status: resp.status, usage: data.usage }));
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { events: [] };
    console.log("[parse-schedule] parsed_events", JSON.stringify((args.events || []).map((e: any) => ({
      title: e.title, start: e.start, end: e.end, evidence: e.evidence,
    }))));
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

// --- image header sniffing (no deps) ---

function b64DecodeFirst(b64: string, n: number): Uint8Array {
  // Decode just enough chars to get >= n bytes (every 4 b64 chars = 3 bytes)
  const need = Math.ceil(n / 3) * 4;
  const slice = b64.slice(0, Math.min(need + 4, b64.length));
  try {
    const bin = atob(slice.replace(/[^A-Za-z0-9+/=]/g, ""));
    const out = new Uint8Array(Math.min(bin.length, n));
    for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

function peekHex(b64: string, n: number): string {
  const bytes = b64DecodeFirst(b64, n);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function sniffDimensions(b64: string, mime: string): { width: number; height: number } | null {
  // Decode a generous chunk for JPEG SOF scanning
  const bytes = b64DecodeFirst(b64, 65536);
  if (bytes.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR at offset 16 (width@16, height@20), big-endian u32
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width: w >>> 0, height: h >>> 0 };
  }

  // JPEG: FF D8, scan for SOF0/1/2 (FFC0/C1/C2)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xD8 || marker === 0xD9) { i += 2; continue; }
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xC0 && marker <= 0xC3) {
        const h = (bytes[i + 5] << 8) | bytes[i + 6];
        const w = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width: w, height: h };
      }
      i += 2 + segLen;
    }
  }

  // WEBP: "RIFF"...."WEBP"
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (fourcc === "VP8 ") {
      const w = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF);
      const h = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF);
      return { width: w, height: h };
    }
    if (fourcc === "VP8L") {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      const w = 1 + (((b1 & 0x3F) << 8) | b0);
      const h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      return { width: w, height: h };
    }
    if (fourcc === "VP8X") {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width: w, height: h };
    }
  }
  return null;
}
