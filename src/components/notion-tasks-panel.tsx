import { useEffect, useMemo, useState } from "react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ExternalLink, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { useNotionTasks, useToggleNotionTask } from "@/hooks/use-notion";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function dueLabel(due: string) {
  try {
    const d = parseISO(due);
    if (isToday(d)) return { text: "Idag", tone: "warn" as const };
    return { text: format(d, "d MMM"), tone: isPast(d) ? ("late" as const) : ("normal" as const) };
  } catch {
    return { text: due, tone: "normal" as const };
  }
}

function useAgo(updatedAt: number | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (!updatedAt) return null;
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (secs < 10) return "just nu";
  if (secs < 60) return `${secs}s sedan`;
  return `${Math.round(secs / 60)}m sedan`;
}

export function NotionTasksPanel({ limit = 8, className }: { limit?: number; className?: string }) {
  const { settings } = useSettings();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useNotionTasks();
  const toggle = useToggleNotionTask();
  const ago = useAgo(dataUpdatedAt);

  const tasks = useMemo(() => (data?.tasks ?? []).slice(0, limit), [data, limit]);


  if (!settings.notion?.databaseId) {
    return (
      <section className={cn("rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <ListChecks className="h-4 w-4" /> Notion-tasks
        </div>
        Välj vilken Notion-databas som ska visas under <span className="font-medium text-foreground">Sources</span>.
      </section>
    );
  }

  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{data?.dbName ?? "Notion-tasks"}</h2>
        <button
          onClick={() => refetch()}
          className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Uppdatera från Notion"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{(error as Error).message}</p>
      )}

      {isLoading && !data && <p className="text-xs text-muted-foreground">Hämtar från Notion…</p>}

      {!isLoading && !tasks.length && !error && (
        <p className="text-xs text-muted-foreground">Inga öppna tasks. 🎉</p>
      )}

      <ul className="divide-y divide-border/60">
        {tasks.map((t) => {
          const d = t.due ? dueLabel(t.due) : null;
          return (
            <li key={t.id} className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={t.done}
                onChange={(e) =>
                  toggle.mutate(
                    { pageId: t.id, done: e.target.checked },
                    { onError: (err) => toast.error((err as Error).message) },
                  )
                }
                className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                aria-label={`Bocka av ${t.title}`}
              />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-sm", t.done && "text-muted-foreground line-through")}>{t.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {t.status && <span>{t.status}</span>}
                  {t.priority && <span>· {t.priority}</span>}
                  {d && (
                    <span
                      className={cn(
                        d.tone === "late" && "text-destructive",
                        d.tone === "warn" && "font-medium text-foreground",
                      )}
                    >
                      · {d.text}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Öppna i Notion"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          );
        })}
      </ul>

      {(data?.tasks.length ?? 0) > limit && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
          <a href="/tasks">Visa alla {data?.tasks.length}</a>
        </Button>
      )}
    </section>
  );
}
