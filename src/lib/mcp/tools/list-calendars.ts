import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { textError } from "../shared";

export default defineTool({
  name: "list_calendars",
  title: "List calendars",
  description: "List the user's calendars (id, name, color) to choose where new events go.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return textError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("calendars")
      .select("id,name,color,kind")
      .eq("archived", false)
      .order("name");
    if (error) return textError(error.message);
    const calendars = (data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind }));
    return { content: [{ type: "text", text: JSON.stringify(calendars) }], structuredContent: { calendars } };
  },
});
