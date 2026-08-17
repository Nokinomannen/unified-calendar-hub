import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ViewMode = "month" | "week" | "day";

export type Settings = {
  /** Quick add */
  quickAddCalendarId: string | null;
  quickAddMinutes: number;
  quickAddRoundTo: number;
  showQuickAdd: boolean;
  /** Calendar view */
  defaultView: ViewMode;
  weekStartsOn: 0 | 1;
  showWeekends: boolean;
  showWeather: boolean;
  showConflicts: boolean;
  dayStartHour: number;
  dayEndHour: number;
  density: "comfortable" | "compact";
  /** Panels */
  showHours: boolean;
  showUpcoming: boolean;
  /** Per-view calendar filters — hidden calendar ids keyed by view ("month" | "week" | "day" | "compact") */
  viewFilters: Record<string, string[]>;
  /** Money */
  currency: string;
  taxRate: number;
  weeklyHoursGoal: number;
  includeDjInForecast: boolean;
  /** Notion tasks */
  showTasks: boolean;
  notion: {
    /** Legacy single-database config — migrated into `databases` on read. */
    databaseId: string | null;
    titleProp: string | null;
    statusProp: string | null;
    dueProp: string | null;
    priorityProp: string | null;
    hideDone: boolean;
    /** Multiple Notion databases merged into one task list. */
    databases?: NotionDbConfig[];
    /** categoryKey -> words the app should recognise. */
    categoryAliases?: Record<string, string[]>;
    /** Notion pageId -> categoryKey, set manually in the app. */
    overrides?: Record<string, string>;
  };
};

export type NotionDbConfig = {
  databaseId: string;
  titleProp: string | null;
  statusProp: string | null;
  dueProp: string | null;
  priorityProp: string | null;
  /** Category key used when nothing else matches for tasks from this database. */
  defaultCategory: string | null;
};

/** Normalized database list — migrates the legacy single-database config. */
export function notionDatabases(settings: Settings): NotionDbConfig[] {
  const n = settings.notion;
  if (n?.databases?.length) return n.databases.filter((d) => !!d.databaseId);
  if (n?.databaseId) {
    return [
      {
        databaseId: n.databaseId,
        titleProp: n.titleProp ?? null,
        statusProp: n.statusProp ?? null,
        dueProp: n.dueProp ?? null,
        priorityProp: n.priorityProp ?? null,
        defaultCategory: null,
      },
    ];
  }
  return [];



export const DEFAULT_SETTINGS: Settings = {
  quickAddCalendarId: null,
  quickAddMinutes: 60,
  quickAddRoundTo: 15,
  showQuickAdd: true,
  defaultView: "month",
  weekStartsOn: 1,
  showWeekends: true,
  showWeather: true,
  showConflicts: true,
  dayStartHour: 7,
  dayEndHour: 23,
  density: "comfortable",
  showHours: true,
  showUpcoming: true,
  viewFilters: {},
  currency: "SEK",
  taxRate: 30,
  weeklyHoursGoal: 40,
  includeDjInForecast: true,
  showTasks: true,
  notion: {
    databaseId: null,
    titleProp: null,
    statusProp: null,
    dueProp: null,
    priorityProp: null,
    hideDone: true,
  },
};


const KEY = ["user_settings"];
const LS = "one-settings";

function readLocal(): Partial<Settings> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "{}") as Partial<Settings>;
  } catch {
    return {};
  }
}

function writeLocal(s: Settings) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* noop */ }
}

/** Merged settings — server row wins, localStorage is the offline fallback. */
export function useSettings() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("prefs").maybeSingle();
      if (error) throw error;
      return (data?.prefs ?? {}) as Partial<Settings>;
    },
    staleTime: 60_000,
  });

  const settings: Settings = { ...DEFAULT_SETTINGS, ...readLocal(), ...(q.data ?? {}) };
  return { ...q, settings };
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const current = (qc.getQueryData(KEY) as Partial<Settings> | undefined) ?? {};
      const next = { ...DEFAULT_SETTINGS, ...readLocal(), ...current, ...patch };
      writeLocal(next);
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: u.user.id, prefs: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      return next;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY) as Partial<Settings> | undefined;
      qc.setQueryData(KEY, { ...(prev ?? {}), ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => { if (ctx) qc.setQueryData(KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
