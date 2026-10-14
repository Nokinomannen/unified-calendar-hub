import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { EVENT_FIELDS, textError, toEventJson } from "../shared";

export default defineTool({
  name: "list_events",
  title: "List events",
  description: "List calendar events overlapping a time range (ISO 8601 timestamps, stored in UTC).",
  inputSchema: {
    start: z.string().datetime({ offset: true }).describe("Range start, ISO 8601 e.g. 2026-10-14T00:00:00Z"),
    end: z.string().datetime({ offset: true }).describe("Range end, ISO 8601"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start, end }, ctx) => {
    if (!ctx.isAuthenticated()) return textError("Not authenticated");
    const sb = supabaseForUser(ctx);
    const [{ data, error }, { data: cals }] = await Promise.all([
      sb.from("events").select(EVENT_FIELDS).is("deleted_at", null)
        .lt("start_at", end).gt("end_at", start).order("start_at").limit(500),
      sb.from("calendars").select("id,name"),
    ]);
    if (error) return textError(error.message);
    const names = new Map((cals ?? []).map((c) => [c.id, c.name]));
    const events = (data ?? []).map((e) => toEventJson(e, names.get(e.calendar_id)));
    return { content: [{ type: "text", text: JSON.stringify(events) }], structuredContent: { events } };
  },
});
