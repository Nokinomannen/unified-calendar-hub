import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { syncFocusWithNotion } from "./day-focus.functions";

describe("deleted focus tasks during Notion sync", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test");
    vi.stubEnv("NOTION_API_KEY", "test");
  });

  it.each(["2026-10-28", "2026-10-29"])("does not re-import or push a deleted linked task on %s", async (date) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { id: "deleted-block", type: "to_do", to_do: { rich_text: [{ plain_text: "Deleted task" }], checked: true }, last_edited_time: "2026-10-28T20:00:00Z" },
        { id: "new-block", type: "to_do", to_do: { rich_text: [{ plain_text: "New task" }], checked: false }, last_edited_time: "2026-10-28T20:00:00Z" },
      ], has_more: false,
    })));
    vi.stubGlobal("fetch", request);
    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn();
    const query = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{ id: "deleted-row", notion_block_id: "deleted-block", done: false, done_changed_at: "2026-10-28T21:00:00Z", deleted_at: "2026-10-28T21:01:00Z" }], error: null }),
      insert, update,
    };
    const handler = syncFocusWithNotion as unknown as (args: unknown) => Promise<unknown>;
    const result = await handler({ data: { date }, context: { userId: "owner", supabase: { from: () => query } } });
    expect(result).toEqual({ added: 1, pushed: 0, pulled: 0 });
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ notion_block_id: "new-block", focus_date: date })]);
    expect(update).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not import anything if loading the deletion records fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [], has_more: false }))));
    const insert = vi.fn();
    const query = { select: () => query, not: async () => ({ data: null, error: { message: "Read failed" } }), insert };
    const handler = syncFocusWithNotion as unknown as (args: unknown) => Promise<unknown>;
    await expect(handler({ data: { date: "2026-10-28" }, context: { userId: "owner", supabase: { from: () => query } } })).rejects.toThrow("Read failed");
    expect(insert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});