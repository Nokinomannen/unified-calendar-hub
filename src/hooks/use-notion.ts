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

/** Poll fast while the tab is visible, pause completely in the background. */
const LIVE_INTERVAL = 15_000;
const liveInterval = () =>
  typeof document === "undefined" || document.visibilityState === "visible" ? LIVE_INTERVAL : false;

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

  const query = useQuery({
    queryKey: ["notion", "tasks", dbs.map((d) => d.databaseId).join(","), hideDone],
    queryFn: () =>
      fn({
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
      }) as Promise<NotionTasksResult>,
    enabled: dbs.length > 0,
    refetchInterval: liveInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    staleTime: 0,
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
