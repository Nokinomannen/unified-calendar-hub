import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { textError } from "../shared";

export default defineTool({
  name: "delete_event",
  title: "Delete event",
  description: "Move an event to Recently deleted (soft delete, restorable in the app). Confirm with the user first.",
  inputSchema: { event_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id }, ctx) => {
    if (!ctx.isAuthenticated()) return textError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("events").update({ deleted_at: new Date().toISOString() })
      .eq("id", event_id).is("deleted_at", null).select("id,title");
    if (error) return textError(error.message);
    if (!data?.length) return textError("Event not found");
    return { content: [{ type: "text", text: `Deleted "${data[0].title}"` }], structuredContent: { deleted: { id: data[0].id, title: data[0].title } } };
  },
});
