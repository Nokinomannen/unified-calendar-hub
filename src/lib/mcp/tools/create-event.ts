import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { EVENT_FIELDS, textError, toEventJson } from "../shared";

export default defineTool({
  name: "create_event",
  title: "Create event",
  description: "Create a calendar event. Use list_calendars to pick calendar_id; defaults to the first calendar.",
  inputSchema: {
    title: z.string().trim().min(1).max(300),
    start_at: z.string().datetime({ offset: true }).describe("Start, ISO 8601 with offset"),
    end_at: z.string().datetime({ offset: true }).describe("End, ISO 8601 with offset"),
    calendar_id: z.string().uuid().optional(),
    description: z.string().max(5000).optional(),
    location: z.string().max(500).optional(),
    all_day: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return textError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) return textError("Not authenticated");
    if (new Date(input.end_at) < new Date(input.start_at)) return textError("end_at must be after start_at");
    const sb = supabaseForUser(ctx);
    let calendarId = input.calendar_id;
    if (!calendarId) {
      const { data: cal } = await sb.from("calendars").select("id").eq("archived", false).order("created_at").limit(1).maybeSingle();
      if (!cal) return textError("No calendar found");
      calendarId = cal.id;
    }
    const { data, error } = await sb.from("events").insert({
      user_id: userId,
      calendar_id: calendarId,
      title: input.title,
      start_at: new Date(input.start_at).toISOString(),
      end_at: new Date(input.end_at).toISOString(),
      description: input.description ?? null,
      location: input.location ?? null,
      all_day: input.all_day ?? false,
    }).select(EVENT_FIELDS).single();
    if (error) return textError(error.message);
    const event = toEventJson(data);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(event)}` }], structuredContent: { event } };
  },
});
