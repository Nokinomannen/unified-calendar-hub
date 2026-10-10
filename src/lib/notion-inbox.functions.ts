import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INBOX_PAGE_ID = "3f52c3c0-f254-8176-a10a-d530013deb81";
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
  };
}

type RichText = { plain_text?: string };
type Block = { id: string; type: string; [k: string]: any };

const TEXT_TYPES = [
  "paragraph", "bulleted_list_item", "numbered_list_item", "to_do",
  "heading_1", "heading_2", "heading_3", "quote",
];

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export const readNotionInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const h = headers();
    const blocks: Block[] = [];
    let cursor: string | undefined;
    do {
      const url = `${GATEWAY_URL}/blocks/${INBOX_PAGE_ID}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
      const res = await fetch(url, { headers: h });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Notion read failed [${res.status}]: ${body}`);
        throw new Error(`Notion read failed [${res.status}]: ${body}`);
      }
      const data = await res.json();
      blocks.push(...(data.results ?? []));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    const lines: string[] = [];
    const images: { base64: string; mime: string }[] = [];
    const blockIds: string[] = [];

    for (const b of blocks) {
      if (b.type === "callout") continue;
      if (b.type !== "child_page" && b.type !== "child_database") blockIds.push(b.id);
      if (TEXT_TYPES.includes(b.type)) {
        const t = ((b[b.type]?.rich_text ?? []) as RichText[]).map((r) => r.plain_text ?? "").join("").trim();
        if (t) lines.push(t);
      } else if (b.type === "image") {
        const img = b.image;
        const src = img?.type === "file" ? img.file?.url : img?.external?.url;
        if (!src) continue;
        try {
          const r = await fetch(src);
          if (!r.ok) continue;
          let mime = r.headers.get("content-type")?.split(";")[0] || "";
          if (!mime.startsWith("image/")) {
            const ext = src.split("?")[0].split(".").pop()?.toLowerCase();
            mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
          }
          images.push({ base64: toBase64(await r.arrayBuffer()), mime });
        } catch (e) {
          console.error("Notion image fetch failed", e);
        }
      }
    }
    return { text: lines.join("\n"), images, blockIds };
  });

export const clearNotionInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { blockIds: string[] }) => {
    if (!Array.isArray(d?.blockIds) || d.blockIds.some((x) => typeof x !== "string" || !/^[0-9a-f-]{32,36}$/i.test(x))) {
      throw new Error("Invalid blockIds");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const h = headers();
    let deleted = 0;
    for (const id of data.blockIds) {
      const res = await fetch(`${GATEWAY_URL}/blocks/${id}`, { method: "DELETE", headers: h });
      if (res.ok) deleted++;
      else console.error(`Notion delete failed [${res.status}]: ${await res.text()}`);
    }
    return { deleted };
  });
