import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotionDatabases, listNotionTasks, setNotionTaskDone } from "@/lib/notion.functions";
import { useSettings } from "@/hooks/use-settings";

export function useNotionDatabases(enabled = true) {
  const fn = useServerFn(listNotionDatabases);
  return useQuery({
    queryKey: ["notion", "databases"],
    queryFn: () => fn(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useNotionTasks() {
  const { settings } = useSettings();
  const cfg = settings.notion;
  const fn = useServerFn(listNotionTasks);
  const databaseId = cfg?.databaseId ?? "";

  return useQuery({
    queryKey: ["notion", "tasks", databaseId, cfg?.hideDone ?? true],
    queryFn: () =>
      fn({
        data: {
          databaseId,
          titleProp: cfg?.titleProp ?? null,
          statusProp: cfg?.statusProp ?? null,
          dueProp: cfg?.dueProp ?? null,
          priorityProp: cfg?.priorityProp ?? null,
          hideDone: cfg?.hideDone ?? true,
        },
      }),
    enabled: !!databaseId,
    // Håll listan färsk mot Notion utan att spamma API:t.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useToggleNotionTask() {
  const { settings } = useSettings();
  const cfg = settings.notion;
  const qc = useQueryClient();
  const fn = useServerFn(setNotionTaskDone);

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
    onSettled: () => qc.invalidateQueries({ queryKey: ["notion", "tasks"] }),
  });
}
