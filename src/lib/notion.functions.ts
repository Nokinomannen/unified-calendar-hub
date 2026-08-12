import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/notion";

type NotionProp = { id: string; name: string; type: string; [k: string]: unknown };
type NotionDb = {
  id: string;
  title?: { plain_text: string }[];
  properties: Record<string, NotionProp>;
  url?: string;
};

async function notion(path: string, init?: { method?: string; body?: unknown }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const notionKey = process.env["NOTION_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY saknas");
  if (!notionKey) throw new Error("NOTION_API_KEY saknas — koppla Notion igen.");

  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": notionKey,
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Notion gateway ${res.status}: ${text}`);
    throw new Error(`Notion svarade ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function dbTitle(db: NotionDb) {
  return db.title?.map((t) => t.plain_text).join("") || "Namnlös databas";
}

function pickProp(props: Record<string, NotionProp>, types: string[], preferred?: string | null) {
  if (preferred && props[preferred]) return preferred;
  for (const type of types) {
    const hit = Object.keys(props).find((k) => props[k]?.type === type);
    if (hit) return hit;
  }
  return null;
}

export type NotionTask = {
  id: string;
  title: string;
  done: boolean;
  status: string | null;
  due: string | null;
  priority: string | null;
  url: string;
};

/** Databases the connected Notion integration can see. */
export const listNotionDatabases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = (await notion("/v1/search", {
      method: "POST",
      body: { filter: { property: "object", value: "database" }, page_size: 100 },
    })) as { results: NotionDb[] };

    return (data.results ?? []).map((db) => ({
      id: db.id,
      name: dbTitle(db),
      url: db.url ?? "",
      properties: Object.values(db.properties ?? {}).map((p) => ({ name: p.name, type: p.type })),
    }));
  });

type TaskInput = {
  databaseId: string;
  titleProp?: string | null;
  statusProp?: string | null;
  dueProp?: string | null;
  priorityProp?: string | null;
  hideDone?: boolean;
};

/** Tasks from one Notion database, normalized. */
export const listNotionTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TaskInput) => {
    if (!input?.databaseId) throw new Error("databaseId krävs");
    return input;
  })
  .handler(async ({ data }) => {
    const db = (await notion(`/v1/databases/${data.databaseId}`)) as NotionDb;
    const props = db.properties ?? {};

    const titleProp = pickProp(props, ["title"], data.titleProp) ?? "";
    const statusProp = pickProp(props, ["status", "checkbox", "select"], data.statusProp);
    const dueProp = pickProp(props, ["date"], data.dueProp);
    const priorityProp = pickProp(props, ["select"], data.priorityProp);

    const query = (await notion(`/v1/databases/${data.databaseId}/query`, {
      method: "POST",
      body: { page_size: 100 },
    })) as { results: { id: string; url: string; properties: Record<string, Record<string, unknown>> }[] };

    const tasks: NotionTask[] = (query.results ?? []).map((page) => {
      const p = page.properties ?? {};
      const titleCell = p[titleProp] as { title?: { plain_text: string }[] } | undefined;
      const title = titleCell?.title?.map((t) => t.plain_text).join("") || "Namnlös";

      let status: string | null = null;
      let done = false;
      if (statusProp && p[statusProp]) {
        const cell = p[statusProp] as {
          type?: string;
          status?: { name: string } | null;
          checkbox?: boolean;
          select?: { name: string } | null;
        };
        if (cell.type === "checkbox") {
          done = !!cell.checkbox;
          status = done ? "Done" : "To Do";
        } else {
          status = cell.status?.name ?? cell.select?.name ?? null;
          done = /^(done|complete|completed|klar|färdig)$/i.test(status ?? "");
        }
      }

      const dueCell = dueProp ? (p[dueProp] as { date?: { start?: string } | null } | undefined) : undefined;
      const priCell = priorityProp
        ? (p[priorityProp] as { select?: { name: string } | null } | undefined)
        : undefined;

      return {
        id: page.id,
        title,
        done,
        status,
        due: dueCell?.date?.start ?? null,
        priority: priCell?.select?.name ?? null,
        url: page.url,
      };
    });

    const filtered = data.hideDone ? tasks.filter((t) => !t.done) : tasks;
    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.title.localeCompare(b.title);
    });

    return {
      dbName: dbTitle(db),
      mapping: { titleProp, statusProp, dueProp, priorityProp },
      tasks: filtered,
    };
  });

/** Toggle a task between done and not-done in Notion. */
export const setNotionTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; pageId: string; done: boolean; statusProp?: string | null }) => {
    if (!input?.pageId || !input?.databaseId) throw new Error("pageId och databaseId krävs");
    return input;
  })
  .handler(async ({ data }) => {
    const db = (await notion(`/v1/databases/${data.databaseId}`)) as NotionDb;
    const props = db.properties ?? {};
    const name = pickProp(props, ["status", "checkbox", "select"], data.statusProp);
    if (!name) throw new Error("Hittade ingen status-kolumn i databasen");

    const prop = props[name]!;
    let value: Record<string, unknown>;

    if (prop.type === "checkbox") {
      value = { checkbox: data.done };
    } else {
      const options = ((prop[prop.type] as { options?: { name: string }[] } | undefined)?.options ?? []).map(
        (o) => o.name,
      );
      const doneName = options.find((o) => /^(done|complete|completed|klar|färdig)$/i.test(o));
      const todoName =
        options.find((o) => /^(to ?do|not started|ej påbörjad|att göra)$/i.test(o)) ?? options[0];
      const target = data.done ? doneName : todoName;
      if (!target) throw new Error("Hittade inget passande statusalternativ i Notion");
      value = prop.type === "status" ? { status: { name: target } } : { select: { name: target } };
    }

    await notion(`/v1/pages/${data.pageId}`, {
      method: "PATCH",
      body: { properties: { [name]: value } },
    });
    return { ok: true };
  });
