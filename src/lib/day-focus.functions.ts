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
      throw new Error("Appen har inte tillgång till Notion-sidan. Koppla om Notion och bocka i sidan (Work/Reflektioner).");
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
    // Place the to-do right under the "Idag" checklist instead of at the bottom of the page.
    const page = await notion(`/blocks/${WORK_PAGE_ID}/children?page_size=100`);
    const blocks: { id: string; type: string; [k: string]: any }[] = page.results ?? [];
    const headingIdx = blocks.findIndex((b) => b.type?.startsWith("heading_") && (b[b.type]?.rich_text ?? []).map((r: any) => r.plain_text).join("").trim().toLowerCase() === "idag");
    let after: string | undefined;
    if (headingIdx >= 0) {
      after = blocks[headingIdx].id;
      for (let i = headingIdx + 1; i < blocks.length && blocks[i].type === "to_do"; i++) {
        const empty = !(blocks[i].to_do?.rich_text ?? []).length;
        if (!empty) after = blocks[i].id;
      }
    }
    const res = await notion(`/blocks/${WORK_PAGE_ID}/children`, {
      method: "PATCH",
      body: JSON.stringify({ ...(after ? { after } : {}), children: [{ object: "block", type: "to_do", to_do: { rich_text: rt(row.text), checked: row.done } }] }),
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

// Two-way sync with per-item conflict resolution: the side edited most
// recently wins (Notion's last_edited_time vs One's done_changed_at).
// New Notion to-dos are pulled in with their checked state.
export const syncFocusWithNotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ data, context }) => {
    // Pull all to-dos (checked and unchecked) from the Work page first.
    const todos: { id: string; text: string; checked: boolean; edited: string }[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion(`/blocks/${WORK_PAGE_ID}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
      for (const b of res.results ?? []) {
        if (b.type !== "to_do") continue;
        const text = (b.to_do?.rich_text ?? []).map((r: { plain_text?: string }) => r.plain_text ?? "").join("").trim();
        if (text) todos.push({ id: b.id, text, checked: !!b.to_do?.checked, edited: b.last_edited_time ?? "" });
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const { data: linked } = await context.supabase
      .from("day_focus")
      .select("id, done, notion_block_id, done_changed_at")
      .not("notion_block_id", "is", null);
    const byBlock = new Map((linked ?? []).map((r) => [r.notion_block_id as string, r]));

    let pushed = 0;
    let pulledState = 0;
    for (const t of todos) {
      const row = byBlock.get(t.id);
      if (!row || row.done === t.checked) continue;
      const notionNewer = new Date(t.edited).getTime() > new Date(row.done_changed_at ?? 0).getTime();
      if (notionNewer) {
        // Notion was edited more recently → update One.
        const { error } = await context.supabase
          .from("day_focus")
          .update({ done: t.checked, done_changed_at: t.edited })
          .eq("id", row.id);
        if (!error) pulledState++;
      } else {
        // One was edited more recently → update Notion.
        try {
          await notion(`/blocks/${t.id}`, {
            method: "PATCH",
            body: JSON.stringify({ to_do: { checked: row.done } }),
          });
          pushed++;
        } catch (e) {
          console.error(`Failed to push done-state for block ${t.id}:`, e);
        }
      }
    }

    const fresh = todos.filter((t) => !byBlock.has(t.id));
    if (fresh.length) {
      const { error } = await context.supabase.from("day_focus").insert(
        fresh.map((t, i) => ({
          user_id: context.userId,
          focus_date: data.date,
          text: t.text,
          done: t.checked,
          done_changed_at: t.edited || new Date().toISOString(),
          notion_block_id: t.id,
          position: 1000 + i,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { added: fresh.length, pushed, pulled: pulledState };
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
