import { useEffect, useMemo, useState } from "react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ExternalLink, ListChecks, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useNotionTasks, useToggleNotionTask, useArchiveNotionTask } from "@/hooks/use-notion";
import { NotionTaskDialog, type TaskDialogState } from "@/components/notion-task-dialog";
import { useSettings, notionDatabases } from "@/hooks/use-settings";
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
  const { data, tasks: allTasks, categories, isLoading, isFetching, error, refetch, dataUpdatedAt } = useNotionTasks();
  const toggle = useToggleNotionTask();
  const archive = useArchiveNotionTask();
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const ago = useAgo(dataUpdatedAt);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.key, c])), [categories]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTasks) map.set(t.category.key, (map.get(t.category.key) ?? 0) + 1);
    return map;
  }, [allTasks]);

  const visible = useMemo(
    () => allTasks.filter((t) => !activeCat || t.category.key === activeCat),
    [allTasks, activeCat],
  );
  const tasks = useMemo(() => visible.slice(0, limit), [visible, limit]);

  if (!notionDatabases(settings).length) {
    return (
      <section className={cn("rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <ListChecks className="h-4 w-4" /> Notion-tasks
        </div>
        Välj vilka Notion-databaser som ska visas under <span className="font-medium text-foreground">Sources</span>.
      </section>
    );
  }

  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{data?.dbName ?? "Notion-tasks"}</h2>
        {ago && <span className="ml-auto text-[11px] text-muted-foreground">{ago}</span>}
        <button
          onClick={() => refetch()}
          className={cn("text-muted-foreground transition-colors hover:text-foreground", !ago && "ml-auto")}
          aria-label="Uppdatera från Notion"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => setDialog({ mode: "create" })}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Ny task i Notion"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {categories.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCat(null)}
            className={cn(
              "rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
              activeCat === null && "border-foreground/30 bg-foreground/10 font-medium text-foreground",
            )}
          >
            Alla
          </button>
          {categories
            .filter((c) => (counts.get(c.key) ?? 0) > 0)
            .map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCat((p) => (p === c.key ? null : c.key))}
                className={cn(
                  "flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
                  activeCat === c.key && "font-medium text-foreground",
                )}
                style={activeCat === c.key ? { borderColor: c.color, backgroundColor: `${c.color}22` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
                <span className="opacity-60">{counts.get(c.key)}</span>
              </button>
            ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      {isLoading && !data && <p className="text-xs text-muted-foreground">Hämtar från Notion…</p>}

      {!isLoading && !tasks.length && !error && (
        <p className="text-xs text-muted-foreground">Inga öppna tasks. 🎉</p>
      )}

      <ul className="divide-y divide-border/60">
        {tasks.map((t) => {
          const d = t.due ? dueLabel(t.due) : null;
          const cat = catMap.get(t.category.key);
          return (
            <li key={t.id} className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={t.done}
                onChange={(e) =>
                  toggle.mutate(
                    { pageId: t.id, done: e.target.checked, dbId: t.dbId },
                    { onError: (err) => toast.error((err as Error).message) },
                  )
                }
                className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                aria-label={`Bocka av ${t.title}`}
              />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-sm", t.done && "text-muted-foreground line-through")}>{t.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {cat && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.label}
                    </span>
                  )}
                  {t.status && <span>· {t.status}</span>}
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
              <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setDialog({ mode: "edit", task: t })}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Redigera task"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`Ta bort "${t.title}" från Notion?`)) return;
                    archive.mutate(
                      { pageId: t.id },
                      {
                        onSuccess: () => toast.success("Task arkiverad i Notion"),
                        onError: (e) => toast.error((e as Error).message),
                      },
                    );
                  }}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Ta bort task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Öppna i Notion"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length > limit && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
          <a href="/tasks">Visa alla {visible.length}</a>
        </Button>
      )}

      <NotionTaskDialog
        state={dialog}
        databases={data?.databases ?? []}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
      />
    </section>
  );
}
