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
    let friendly = `Notion svarade ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      if (parsed?.message) friendly += `: ${parsed.message}`;
      if (parsed?.code === "object_not_found") {
        friendly = "Notion hittar inte sidan/databasen — dela den med integrationen och försök igen.";
      }
    } catch {
      friendly += `: ${text.slice(0, 200)}`;
    }
    throw new Error(friendly);
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

function optionsOf(prop: NotionProp | undefined): { name: string; color: string }[] {
  if (!prop) return [];
  const raw = prop[prop.type] as { options?: { name: string; color?: string }[] } | undefined;
  return (raw?.options ?? []).map((o) => ({ name: o.name, color: o.color ?? "default" }));
}

const DONE_RE = /^(done|complete|completed|klar|färdig|avklarad)$/i;
const TODO_RE = /^(to ?do|not started|ej påbörjad|att göra|backlog|inbox)$/i;

export type NotionTask = {
  id: string;
  dbId: string;
  dbName: string;
  title: string;
  done: boolean;
  status: string | null;
  due: string | null;
  priority: string | null;
  notes: string | null;
  tags: string[];
  url: string;
  lastEdited: string | null;
};

export type NotionStatusOption = { name: string; color: string; done: boolean };

export type NotionDbMeta = {
  id: string;
  name: string;
  statusType: string | null;
  statusOptions: NotionStatusOption[];
  priorityOptions: { name: string; color: string }[];
  hasDue: boolean;
  hasNotes: boolean;
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

type DbInput = {
  databaseId: string;
  titleProp?: string | null;
  statusProp?: string | null;
  dueProp?: string | null;
  priorityProp?: string | null;
};

type TaskInput = {
  /** One or more databases, merged into a single task list. */
  databases: DbInput[];
  hideDone?: boolean;
};

type Mapping = {
  titleProp: string;
  statusProp: string | null;
  dueProp: string | null;
  priorityProp: string | null;
  notesProp: string | null;
  statusType: string | null;
};

function resolveMapping(props: Record<string, NotionProp>, cfg: Partial<DbInput>): Mapping {
  const titleProp = pickProp(props, ["title"], cfg.titleProp) ?? "";
  const statusProp = pickProp(props, ["status", "checkbox", "select"], cfg.statusProp);
  const dueProp = pickProp(props, ["date"], cfg.dueProp);
  const priorityCandidate = pickProp(props, ["select"], cfg.priorityProp);
  const priorityProp = priorityCandidate === statusProp ? null : priorityCandidate;
  const notesProp = Object.keys(props).find((k) => props[k]?.type === "rich_text") ?? null;
  return {
    titleProp,
    statusProp,
    dueProp,
    priorityProp,
    notesProp,
    statusType: statusProp ? (props[statusProp]?.type ?? null) : null,
  };
}

function statusOptionsFor(props: Record<string, NotionProp>, m: Mapping): NotionStatusOption[] {
  if (!m.statusProp || !m.statusType) return [];
  if (m.statusType === "checkbox") {
    return [
      { name: "Öppna", color: "default", done: false },
      { name: "Klara", color: "green", done: true },
    ];
  }
  return optionsOf(props[m.statusProp]).map((o) => ({ ...o, done: DONE_RE.test(o.name) }));
}

async function loadDatabase(cfg: DbInput, hideDone: boolean) {
  const db = (await notion(`/v1/databases/${cfg.databaseId}`)) as NotionDb;
  const props = db.properties ?? {};
  const m = resolveMapping(props, cfg);
  const statusOptions = statusOptionsFor(props, m);
  const priorityOptions = m.priorityProp ? optionsOf(props[m.priorityProp]) : [];

  type Page = {
    id: string;
    url: string;
    last_edited_time?: string;
    properties: Record<string, Record<string, unknown>>;
  };

  const pages: Page[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res = (await notion(`/v1/databases/${cfg.databaseId}/query`, {
      method: "POST",
      body: {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      },
    })) as { results: Page[]; has_more?: boolean; next_cursor?: string | null };
    pages.push(...(res.results ?? []));
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }

  const tasks: NotionTask[] = pages.map((page) => {
    const p = page.properties ?? {};
    const titleCell = p[m.titleProp] as { title?: { plain_text: string }[] } | undefined;
    const title = titleCell?.title?.map((t) => t.plain_text).join("") || "Namnlös";

    let status: string | null = null;
    let done = false;
    if (m.statusProp && p[m.statusProp]) {
      const cell = p[m.statusProp] as {
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

    const dueCell = m.dueProp ? (p[m.dueProp] as { date?: { start?: string } | null } | undefined) : undefined;
    const priCell = m.priorityProp
      ? (p[m.priorityProp] as { select?: { name: string } | null } | undefined)
      : undefined;
    const notesCell = m.notesProp
      ? (p[m.notesProp] as { rich_text?: { plain_text?: string }[] } | undefined)
      : undefined;

    // Every select / multi-select tag value except the status and priority
    // columns, used by the app to figure out which job a task belongs to.
    const tags: string[] = [];
    for (const [name, rawCell] of Object.entries(p)) {
      if (name === m.statusProp || name === m.priorityProp) continue;
      const cell = rawCell as {
        type?: string;
        select?: { name?: string } | null;
        multi_select?: { name?: string }[];
        rich_text?: { plain_text?: string }[];
      };
      if (cell.type === "select" && cell.select?.name) tags.push(cell.select.name);
      if (cell.type === "multi_select") {
        for (const opt of cell.multi_select ?? []) if (opt?.name) tags.push(opt.name);
      }
      if (cell.type === "rich_text" && /tag|kategori|projekt|jobb|område/i.test(name)) {
        const text = (cell.rich_text ?? []).map((r) => r.plain_text ?? "").join(" ").trim();
        if (text) tags.push(text);
      }
    }

    return {
      id: page.id,
      dbId: cfg.databaseId,
      dbName: dbTitle(db),
      title,
      done,
      status,
      due: dueCell?.date?.start ?? null,
      priority: priCell?.select?.name ?? null,
      notes: (notesCell?.rich_text ?? []).map((r) => r.plain_text ?? "").join("").trim() || null,
      tags,
      url: page.url,
      lastEdited: page.last_edited_time ?? null,
    };
  });

  const meta: NotionDbMeta = {
    id: cfg.databaseId,
    name: dbTitle(db),
    statusType: m.statusType,
    statusOptions,
    priorityOptions,
    hasDue: !!m.dueProp,
    hasNotes: !!m.notesProp,
  };

  return {
    meta,
    mapping: { titleProp: m.titleProp, statusProp: m.statusProp, dueProp: m.dueProp, priorityProp: m.priorityProp },
    statusOptions,
    statusType: m.statusType,
    dbId: cfg.databaseId,
    dbName: dbTitle(db),
    lastEdited: pages[0]?.last_edited_time ?? null,
    tasks: hideDone ? tasks.filter((t) => !t.done) : tasks,
  };
}

/** Tasks from one or more Notion databases, normalized and merged. */
export const listNotionTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TaskInput) => {
    if (!input?.databases?.length) throw new Error("minst en databas krävs");
    return input;
  })
  .handler(async ({ data }) => {
    const results = await Promise.all(data.databases.map((cfg) => loadDatabase(cfg, !!data.hideDone)));

    const statusOptions: NotionStatusOption[] = [];
    for (const r of results) {
      for (const o of r.statusOptions) {
        if (!statusOptions.some((x) => x.name.toLowerCase() === o.name.toLowerCase())) statusOptions.push(o);
      }
    }

    const tasks = results.flatMap((r) => r.tasks);
    tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.title.localeCompare(b.title);
    });

    const first = results[0]!;
    return {
      dbName: results.map((r) => r.dbName).join(" · "),
      databases: results.map((r) => r.meta),
      mapping: first.mapping,
      statusType: first.statusType,
      statusOptions,
      lastEdited: results.map((r) => r.lastEdited).filter(Boolean).sort().pop() ?? null,
      tasks,
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
      const options = optionsOf(prop).map((o) => o.name);
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
      const options = optionsOf(prop).map((o) => o.name);
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

export type TaskFields = {
  title?: string;
  status?: string | null;
  due?: string | null;
  priority?: string | null;
  notes?: string | null;
};

/** Build a Notion `properties` payload from app-level task fields. */
function buildProperties(props: Record<string, NotionProp>, m: Mapping, fields: TaskFields) {
  const out: Record<string, unknown> = {};

  if (fields.title !== undefined && m.titleProp) {
    out[m.titleProp] = { title: [{ text: { content: fields.title.slice(0, 1900) } }] };
  }

  if (fields.status !== undefined && m.statusProp) {
    const prop = props[m.statusProp]!;
    if (prop.type === "checkbox") {
      out[m.statusProp] = { checkbox: !!fields.status && DONE_RE.test(fields.status) };
    } else if (fields.status) {
      const target = optionsOf(prop).find((o) => o.name.toLowerCase() === fields.status!.toLowerCase());
      if (!target) throw new Error(`Statusen "${fields.status}" finns inte i Notion-databasen`);
      out[m.statusProp] = prop.type === "status" ? { status: { name: target.name } } : { select: { name: target.name } };
    }
  }

  if (fields.due !== undefined && m.dueProp) {
    out[m.dueProp] = fields.due ? { date: { start: fields.due } } : { date: null };
  }

  if (fields.priority !== undefined && m.priorityProp) {
    if (!fields.priority) {
      out[m.priorityProp] = { select: null };
    } else {
      const target = optionsOf(props[m.priorityProp]).find(
        (o) => o.name.toLowerCase() === fields.priority!.toLowerCase(),
      );
      if (target) out[m.priorityProp] = { select: { name: target.name } };
    }
  }

  if (fields.notes !== undefined && m.notesProp) {
    out[m.notesProp] = fields.notes
      ? { rich_text: [{ text: { content: fields.notes.slice(0, 1900) } }] }
      : { rich_text: [] };
  }

  return out;
}

/** Create a new task page in a Notion database. */
export const createNotionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; fields: TaskFields; mapping?: Partial<DbInput> }) => {
    if (!input?.databaseId) throw new Error("databaseId krävs");
    if (!input?.fields?.title?.trim()) throw new Error("Titel krävs");
    return input;
  })
  .handler(async ({ data }) => {
    const db = (await notion(`/v1/databases/${data.databaseId}`)) as NotionDb;
    const props = db.properties ?? {};
    const m = resolveMapping(props, data.mapping ?? {});
    const properties = buildProperties(props, m, data.fields);

    const page = (await notion("/v1/pages", {
      method: "POST",
      body: { parent: { database_id: data.databaseId }, properties },
    })) as { id: string; url: string };

    return { id: page.id, url: page.url };
  });

/** Update fields on an existing task page. */
export const updateNotionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { databaseId: string; pageId: string; fields: TaskFields; mapping?: Partial<DbInput> }) => {
      if (!input?.pageId || !input?.databaseId) throw new Error("pageId och databaseId krävs");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const db = (await notion(`/v1/databases/${data.databaseId}`)) as NotionDb;
    const props = db.properties ?? {};
    const m = resolveMapping(props, data.mapping ?? {});
    const properties = buildProperties(props, m, data.fields);
    if (!Object.keys(properties).length) return { ok: true };

    await notion(`/v1/pages/${data.pageId}`, { method: "PATCH", body: { properties } });
    return { ok: true };
  });

/** Archive (soft delete) a task page in Notion. */
export const archiveNotionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pageId: string }) => {
    if (!input?.pageId) throw new Error("pageId krävs");
    return input;
  })
  .handler(async ({ data }) => {
    await notion(`/v1/pages/${data.pageId}`, { method: "PATCH", body: { archived: true } });
    return { ok: true };
  });
