import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotionDatabases,
  listNotionTasks,
  setNotionTaskDone,
  setNotionTaskStatus,
  type NotionTask,
} from "@/lib/notion.functions";
import { useSettings } from "@/hooks/use-settings";

export type NotionTasksResult = {
  dbName: string;
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

export function useNotionTasks(opts?: { hideDone?: boolean }) {
  const { settings } = useSettings();
  const cfg = settings.notion;
  const fn = useServerFn(listNotionTasks);
  const databaseId = cfg?.databaseId ?? "";
  const hideDone = opts?.hideDone ?? cfg?.hideDone ?? true;

  return useQuery({
    queryKey: ["notion", "tasks", databaseId, hideDone],
    queryFn: () =>
      fn({
        data: {
          databaseId,
          titleProp: cfg?.titleProp ?? null,
          statusProp: cfg?.statusProp ?? null,
          dueProp: cfg?.dueProp ?? null,
          priorityProp: cfg?.priorityProp ?? null,
          hideDone,
        },
      }) as Promise<NotionTasksResult>,
    enabled: !!databaseId,
    refetchInterval: liveInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    staleTime: 0,
    structuralSharing: true,
  });
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
  const cfg = settings.notion;
  const qc = useQueryClient();
  const fn = useServerFn(setNotionTaskDone);
  const patchCache = useTaskCacheUpdater();

  return useMutation({
    mutationFn: (vars: { pageId: string; done: boolean }) =>
      fn({
        data: {
          databaseId: cfg?.databaseId ?? "",
          pageId: vars.pageId,
          done: vars.done,
          statusProp: cfg?.statusProp ?? null,
        },
      }),
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
  const cfg = settings.notion;
  const qc = useQueryClient();
  const fn = useServerFn(setNotionTaskStatus);
  const patchCache = useTaskCacheUpdater();

  return useMutation({
    mutationFn: (vars: { pageId: string; status: string }) =>
      fn({
        data: {
          databaseId: cfg?.databaseId ?? "",
          pageId: vars.pageId,
          status: vars.status,
          statusProp: cfg?.statusProp ?? null,
        },
      }),
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
