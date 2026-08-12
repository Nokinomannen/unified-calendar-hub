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

const DONE_RE = /^(done|complete|completed|klar|färdig|avklarad)$/i;
const TODO_RE = /^(to ?do|not started|ej påbörjad|att göra|backlog|inbox)$/i;

export type NotionTask = {
  id: string;
  title: string;
  done: boolean;
  status: string | null;
  due: string | null;
  priority: string | null;
  url: string;
  lastEdited: string | null;
};

export type NotionStatusOption = { name: string; color: string; done: boolean };

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
    const statusType = statusProp ? (props[statusProp]?.type ?? null) : null;

    let statusOptions: NotionStatusOption[] = [];
    if (statusProp && statusType && statusType !== "checkbox") {
      const raw = props[statusProp]?.[statusType] as
        | { options?: { name: string; color?: string }[]; groups?: { name: string; option_ids?: string[] }[] }
        | undefined;
      statusOptions = (raw?.options ?? []).map((o) => ({
        name: o.name,
        color: o.color ?? "default",
        done: DONE_RE.test(o.name),
      }));
    }

    const query = (await notion(`/v1/databases/${data.databaseId}/query`, {
      method: "POST",
      body: {
        page_size: 100,
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      },
    })) as {
      results: {
        id: string;
        url: string;
        last_edited_time?: string;
        properties: Record<string, Record<string, unknown>>;
      }[];
    };

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
          status = done ? "Klara" : "Öppna";
        } else {
          status = cell.status?.name ?? cell.select?.name ?? null;
          done = DONE_RE.test(status ?? "");
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
        lastEdited: page.last_edited_time ?? null,
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

    if (statusType === "checkbox") {
      statusOptions = [
        { name: "Öppna", color: "default", done: false },
        { name: "Klara", color: "green", done: true },
      ];
    }

    return {
      dbName: dbTitle(db),
      mapping: { titleProp, statusProp, dueProp, priorityProp },
      statusType,
      statusOptions,
      lastEdited: query.results?.[0]?.last_edited_time ?? null,
      tasks: filtered,
    };
  });

async function statusPropertyValue(
  databaseId: string,
  statusPropHint: string | null | undefined,
  resolve: (prop: NotionProp, name: string) => Record<string, unknown>,
) {
  const db = (await notion(`/v1/databases/${databaseId}`)) as NotionDb;
  const props = db.properties ?? {};
  const name = pickProp(props, ["status", "checkbox", "select"], statusPropHint);
  if (!name) throw new Error("Hittade ingen status-kolumn i databasen");
  return { name, value: resolve(props[name]!, name) };
}

/** Toggle a task between done and not-done in Notion. */
export const setNotionTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; pageId: string; done: boolean; statusProp?: string | null }) => {
    if (!input?.pageId || !input?.databaseId) throw new Error("pageId och databaseId krävs");
    return input;
  })
  .handler(async ({ data }) => {
    const { name, value } = await statusPropertyValue(data.databaseId, data.statusProp, (prop) => {
      if (prop.type === "checkbox") return { checkbox: data.done };
      const options = ((prop[prop.type] as { options?: { name: string }[] } | undefined)?.options ?? []).map(
        (o) => o.name,
      );
      const doneName = options.find((o) => DONE_RE.test(o));
      const todoName = options.find((o) => TODO_RE.test(o)) ?? options[0];
      const target = data.done ? doneName : todoName;
      if (!target) throw new Error("Hittade inget passande statusalternativ i Notion");
      return prop.type === "status" ? { status: { name: target } } : { select: { name: target } };
    });

    await notion(`/v1/pages/${data.pageId}`, {
      method: "PATCH",
      body: { properties: { [name]: value } },
    });
    return { ok: true };
  });

/** Move a task to an arbitrary status column (kanban drag & drop). */
export const setNotionTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { databaseId: string; pageId: string; status: string; statusProp?: string | null }) => {
      if (!input?.pageId || !input?.databaseId) throw new Error("pageId och databaseId krävs");
      if (!input?.status) throw new Error("status krävs");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { name, value } = await statusPropertyValue(data.databaseId, data.statusProp, (prop) => {
      if (prop.type === "checkbox") return { checkbox: DONE_RE.test(data.status) || data.status === "Klara" };
      const options = ((prop[prop.type] as { options?: { name: string }[] } | undefined)?.options ?? []).map(
        (o) => o.name,
      );
      const target = options.find((o) => o.toLowerCase() === data.status.toLowerCase());
      if (!target) throw new Error(`Statusen "${data.status}" finns inte i Notion-databasen`);
      return prop.type === "status" ? { status: { name: target } } : { select: { name: target } };
    });

    await notion(`/v1/pages/${data.pageId}`, {
      method: "PATCH",
      body: { properties: { [name]: value } },
    });
    return { ok: true };
  });
