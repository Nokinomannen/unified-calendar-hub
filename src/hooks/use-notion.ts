import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  archiveNotionTask,
  createNotionTask,
  listNotionDatabases,
  listNotionTasks,
  setNotionTaskDone,
  setNotionTaskStatus,
  updateNotionTask,
  type NotionDbMeta,
  type NotionTask,
  type TaskFields,
} from "@/lib/notion.functions";
import { useSettings, useUpdateSettings, notionDatabases } from "@/hooks/use-settings";
import { useCalendars } from "@/hooks/use-calendar-data";
import { buildCategories, categorize, type CategoryAssignment, type TaskCategory } from "@/lib/task-category";

export type CategorizedTask = NotionTask & { category: CategoryAssignment };

export type NotionTasksResult = {
  dbName: string;
  databases: NotionDbMeta[];
  mapping: { titleProp: string; statusProp: string | null; dueProp: string | null; priorityProp: string | null };
  statusType: string | null;
  statusOptions: { name: string; color: string; done: boolean }[];
  lastEdited: string | null;
  tasks: NotionTask[];
};

/** No background polling at all: tasks refresh once a day and on manual refresh. */
const liveInterval = () => false as const;

const DAY = 24 * 60 * 60_000;
const CACHE_PREFIX = "notion-tasks-cache:";

/**
 * Tasks are cached in localStorage so a page reload doesn't re-hit Notion.
 * Anything fetched less than a day ago is reused as-is — the user rarely
 * needs fresher data and every fetch costs egress.
 */
function readTaskCache(key: string): { data: NotionTasksResult; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: NotionTasksResult; at: number };
    if (!parsed?.data || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTaskCache(key: string, data: NotionTasksResult) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, at: Date.now() }));
  } catch {
    // storage full / disabled — caching is best effort
  }
}

export function useNotionDatabases(enabled = true) {
  const fn = useServerFn(listNotionDatabases);
  return useQuery({
    queryKey: ["notion", "databases"],
    queryFn: () => fn(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** The work contexts tasks can be sorted into, derived from the calendar sources. */
export function useTaskCategories(): { categories: TaskCategory[]; fallbackKey: string } {
  const { data: calendars = [] } = useCalendars();
  return useMemo(
    () => buildCategories(calendars.map((c) => ({ id: c.id, name: c.name, color: c.color, archived: c.archived }))),
    [calendars],
  );
}

export function useNotionTasks(opts?: { hideDone?: boolean }) {
  const { settings } = useSettings();
  const cfg = settings.notion;
  const fn = useServerFn(listNotionTasks);
  const dbs = notionDatabases(settings);
  const hideDone = opts?.hideDone ?? cfg?.hideDone ?? true;
  const { categories, fallbackKey } = useTaskCategories();

  const cacheKey = `${dbs.map((d) => d.databaseId).join(",")}|${hideDone}`;
  const cached = useMemo(() => readTaskCache(cacheKey), [cacheKey]);

  const query = useQuery({
    queryKey: ["notion", "tasks", dbs.map((d) => d.databaseId).join(","), hideDone],
    queryFn: async () => {
      const result = (await fn({
        data: {
          databases: dbs.map((d) => ({
            databaseId: d.databaseId,
            titleProp: d.titleProp,
            statusProp: d.statusProp,
            dueProp: d.dueProp,
            priorityProp: d.priorityProp,
          })),
          hideDone,
        },
      })) as NotionTasksResult;
      writeTaskCache(cacheKey, result);
      return result;
    },
    enabled: dbs.length > 0,
    refetchInterval: liveInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: DAY,
    gcTime: DAY,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    structuralSharing: true,
  });

  const aliases = cfg?.categoryAliases ?? {};
  const overrides = cfg?.overrides ?? {};
  const dbDefaults = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of dbs) if (d.defaultCategory) map[d.databaseId] = d.defaultCategory;
    return map;
  }, [JSON.stringify(dbs)]);

  const tasks = useMemo<CategorizedTask[]>(() => {
    const list = query.data?.tasks ?? [];
    return list.map((t) => ({
      ...t,
      category: categorize(t, { categories, aliases, overrides, dbDefaults, fallbackKey }),
    }));
  }, [query.data, categories, JSON.stringify(aliases), JSON.stringify(overrides), dbDefaults, fallbackKey]);

  return { ...query, tasks, categories, fallbackKey };
}

/** Manual category assignment, stored in the app (never written back to Notion). */
export function useSetTaskCategory() {
  const { settings } = useSettings();
  const update = useUpdateSettings();
  return (pageId: string, categoryKey: string | null) => {
    const overrides = { ...(settings.notion?.overrides ?? {}) };
    if (categoryKey) overrides[pageId] = categoryKey;
    else delete overrides[pageId];
    update.mutate({ notion: { ...settings.notion, overrides } });
  };
}

function useTaskCacheUpdater() {
  const qc = useQueryClient();
  return (apply: (t: NotionTask) => NotionTask | null) => {
    const snapshots = qc.getQueriesData<NotionTasksResult>({ queryKey: ["notion", "tasks"] });
    for (const [key, value] of snapshots) {
      if (!value) continue;
      qc.setQueryData<NotionTasksResult>(key, {
        ...value,
        tasks: value.tasks.flatMap((t) => {
          const next = apply(t);
          return next ? [next] : [t];
        }),
      });
    }
    return snapshots;
  };
}

export function useToggleNotionTask() {
  const { settings } = useSettings();
  const dbs = notionDatabases(settings);
  const qc = useQueryClient();
  const fn = useServerFn(setNotionTaskDone);
  const patchCache = useTaskCacheUpdater();

  return useMutation({
    mutationFn: (vars: { pageId: string; done: boolean; dbId?: string }) => {
      const db = dbs.find((d) => d.databaseId === vars.dbId) ?? dbs[0];
      return fn({
        data: {
          databaseId: db?.databaseId ?? "",
          pageId: vars.pageId,
          done: vars.done,
          statusProp: db?.statusProp ?? null,
        },
      });
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notion", "tasks"] });
      const snapshots = patchCache((t) => (t.id === vars.pageId ? { ...t, done: vars.done } : null));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}

export function useSetNotionTaskStatus() {
  const { settings } = useSettings();
  const dbs = notionDatabases(settings);
  const qc = useQueryClient();
  const fn = useServerFn(setNotionTaskStatus);
  const patchCache = useTaskCacheUpdater();

  return useMutation({
    mutationFn: (vars: { pageId: string; status: string; dbId?: string }) => {
      const db = dbs.find((d) => d.databaseId === vars.dbId) ?? dbs[0];
      return fn({
        data: {
          databaseId: db?.databaseId ?? "",
          pageId: vars.pageId,
          status: vars.status,
          statusProp: db?.statusProp ?? null,
        },
      });
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notion", "tasks"] });
      const snapshots = patchCache((t) =>
        t.id === vars.pageId
          ? { ...t, status: vars.status, done: /^(done|complete|completed|klar|färdig|avklarad)$/i.test(vars.status) }
          : null,
      );
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}

/** The mapping config for a database, used when writing back to Notion. */
function useDbMapping() {
  const { settings } = useSettings();
  const dbs = notionDatabases(settings);
  return (dbId?: string) => {
    const db = dbs.find((d) => d.databaseId === dbId) ?? dbs[0];
    return {
      databaseId: db?.databaseId ?? "",
      mapping: {
        titleProp: db?.titleProp ?? null,
        statusProp: db?.statusProp ?? null,
        dueProp: db?.dueProp ?? null,
        priorityProp: db?.priorityProp ?? null,
      },
    };
  };
}

export function useCreateNotionTask() {
  const qc = useQueryClient();
  const fn = useServerFn(createNotionTask);
  const resolve = useDbMapping();
  return useMutation({
    mutationFn: (vars: { dbId?: string; fields: TaskFields }) => {
      const { databaseId, mapping } = resolve(vars.dbId);
      if (!databaseId) throw new Error("Ingen Notion-databas vald");
      return fn({ data: { databaseId, fields: vars.fields, mapping } });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}

export function useUpdateNotionTask() {
  const qc = useQueryClient();
  const fn = useServerFn(updateNotionTask);
  const resolve = useDbMapping();
  const patchCache = useTaskCacheUpdater();
  return useMutation({
    mutationFn: (vars: { pageId: string; dbId?: string; fields: TaskFields }) => {
      const { databaseId, mapping } = resolve(vars.dbId);
      if (!databaseId) throw new Error("Ingen Notion-databas vald");
      return fn({ data: { databaseId, pageId: vars.pageId, fields: vars.fields, mapping } });
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notion", "tasks"] });
      const snapshots = patchCache((t) =>
        t.id === vars.pageId
          ? {
              ...t,
              ...(vars.fields.title !== undefined ? { title: vars.fields.title } : {}),
              ...(vars.fields.due !== undefined ? { due: vars.fields.due } : {}),
              ...(vars.fields.priority !== undefined ? { priority: vars.fields.priority } : {}),
              ...(vars.fields.notes !== undefined ? { notes: vars.fields.notes } : {}),
              ...(vars.fields.status !== undefined ? { status: vars.fields.status } : {}),
            }
          : null,
      );
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}

export function useArchiveNotionTask() {
  const qc = useQueryClient();
  const fn = useServerFn(archiveNotionTask);
  const patchCache = useTaskCacheUpdater();
  return useMutation({
    mutationFn: (vars: { pageId: string }) => fn({ data: { pageId: vars.pageId } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notion", "tasks"] });
      const qcAll = qc.getQueriesData<NotionTasksResult>({ queryKey: ["notion", "tasks"] });
      for (const [key, value] of qcAll) {
        if (!value) continue;
        qc.setQueryData<NotionTasksResult>(key, { ...value, tasks: value.tasks.filter((t) => t.id !== vars.pageId) });
      }
      void patchCache;
      return { snapshots: qcAll };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}
