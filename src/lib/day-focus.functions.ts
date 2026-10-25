import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WORK_PAGE_ID = "3df2c3c0-f254-8100-9a7e-f180b3d3830f";
const REFLECTIONS_PAGE_ID = "4042c3c0-f254-8089-8a42-debcd06305b9";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const notion = process.env.NOTION_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY is not configured");
  if (!notion) throw new Error("NOTION_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": notion,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
  };
}

async function notion(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Notion ${path} failed [${res.status}]: ${body}`);
    if (res.status === 404) {
      throw new Error("Notion-sidan hittas inte. Dela sidan med Lovable under ... → Connections i Notion.");
    }
    throw new Error(`Notion svarade ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

const rt = (content: string) => [{ type: "text", text: { content: content.slice(0, 1900) } }];

export const sendFocusToNotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("day_focus").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error("Fokuspunkten hittades inte");
    if (row.notion_block_id) return { blockId: row.notion_block_id };
    const res = await notion(`/blocks/${WORK_PAGE_ID}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [{ object: "block", type: "to_do", to_do: { rich_text: rt(row.text), checked: row.done } }] }),
    });
    const blockId = res.results?.[0]?.id as string;
    await context.supabase.from("day_focus").update({ notion_block_id: blockId }).eq("id", row.id);
    return { blockId };
  });

export const setNotionTodoChecked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { blockId: string; checked: boolean }) => d)
  .handler(async ({ data }) => {
    await notion(`/blocks/${data.blockId}`, { method: "PATCH", body: JSON.stringify({ to_do: { checked: data.checked } }) });
    return { ok: true };
  });

export const pullFocusFromNotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ data, context }) => {
    const todos: { id: string; text: string }[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion(`/blocks/${WORK_PAGE_ID}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
      for (const b of res.results ?? []) {
        if (b.type !== "to_do" || b.to_do?.checked) continue;
        const text = (b.to_do?.rich_text ?? []).map((r: { plain_text?: string }) => r.plain_text ?? "").join("").trim();
        if (text) todos.push({ id: b.id, text });
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const { data: existing } = await context.supabase.from("day_focus").select("notion_block_id").not("notion_block_id", "is", null);
    const known = new Set((existing ?? []).map((r) => r.notion_block_id));
    const fresh = todos.filter((t) => !known.has(t.id));
    if (fresh.length) {
      const { error } = await context.supabase.from("day_focus").insert(
        fresh.map((t, i) => ({ user_id: context.userId, focus_date: data.date, text: t.text, notion_block_id: t.id, position: 1000 + i })),
      );
      if (error) throw new Error(error.message);
    }
    return { added: fresh.length };
  });

export const sendNoteToReflections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string; title: string; content: string }) => d)
  .handler(async ({ data, context }) => {
    const paragraphs = data.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (!paragraphs.length) throw new Error("Anteckningen är tom");
    await notion(`/blocks/${REFLECTIONS_PAGE_ID}/children`, {
      method: "PATCH",
      body: JSON.stringify({
        children: [
          { object: "block", type: "heading_3", heading_3: { rich_text: rt(data.title) } },
          ...paragraphs.map((p) => ({ object: "block", type: "paragraph", paragraph: { rich_text: rt(p) } })),
        ],
      }),
    });
    await context.supabase.from("day_notes").update({ sent_to_notion_at: new Date().toISOString() }).eq("note_date", data.date);
    return { ok: true };
  });
