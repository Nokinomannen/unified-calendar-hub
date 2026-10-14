import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { EVENT_FIELDS, textError, toEventJson } from "../shared";

export default defineTool({
  name: "search_events",
  title: "Search events",
  description: "Find events whose title, description or location contains a keyword.",
  inputSchema: {
    query: z.string().trim().min(1).max(100).describe("Keyword to search for"),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 25)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return textError("Not authenticated");
    const q = query.replace(/[%,()*]/g, " ");
    const { data, error } = await supabaseForUser(ctx)
      .from("events").select(EVENT_FIELDS).is("deleted_at", null)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`)
      .order("start_at", { ascending: false }).limit(limit ?? 25);
    if (error) return textError(error.message);
    const events = (data ?? []).map((e) => toEventJson(e));
    return { content: [{ type: "text", text: JSON.stringify(events) }], structuredContent: { events } };
  },
});
