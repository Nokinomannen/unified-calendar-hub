import { useEffect, useMemo, useState } from "react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ExternalLink, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useNotionTasks,
  useSetNotionTaskStatus,
  useSetTaskCategory,
  useArchiveNotionTask,
  type CategorizedTask,
} from "@/hooks/use-notion";
import { NotionTaskDialog, type TaskDialogState } from "@/components/notion-task-dialog";
import { useSettings, notionDatabases } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Task = CategorizedTask;

const NO_STATUS = "__none__";
const PRIORITY_RANK: Record<string, number> = { high: 0, hög: 0, medium: 1, mellan: 1, low: 2, låg: 2 };

function dueMeta(due: string | null) {
  if (!due) return null;
  try {
    const d = parseISO(due);
    if (isToday(d)) return { text: "Idag", tone: "warn" as const };
    return { text: format(d, "d MMM"), tone: isPast(d) ? ("late" as const) : ("normal" as const) };
  } catch {
    return { text: due, tone: "normal" as const };
  }
}

function useAgo(iso: number | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  const secs = Math.max(0, Math.round((Date.now() - iso) / 1000));
  if (secs < 10) return "just nu";
  if (secs < 60) return `${secs} sek sedan`;
  return `${Math.round(secs / 60)} min sedan`;
}

function sortTasks(a: Task, b: Task) {
  if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  const pa = PRIORITY_RANK[(a.priority ?? "").toLowerCase()] ?? 9;
  const pb = PRIORITY_RANK[(b.priority ?? "").toLowerCase()] ?? 9;
  if (pa !== pb) return pa - pb;
  return a.title.localeCompare(b.title);
}

export function NotionKanban() {
  const { settings } = useSettings();
  const { data, tasks: allTasks, categories, isLoading, isFetching, error, refetch, dataUpdatedAt } =
    useNotionTasks({ hideDone: false });
  const move = useSetNotionTaskStatus();
  const setCategory = useSetTaskCategory();
  const archive = useArchiveNotionTask();
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const ago = useAgo(dataUpdatedAt);

  const [q, setQ] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.key, c])), [categories]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTasks) {
      if (t.done && !showDone) continue;
      map.set(t.category.key, (map.get(t.category.key) ?? 0) + 1);
    }
    return map;
  }, [allTasks, showDone]);

  const columns = useMemo(() => {
    if (!data) return [];
    const cols = data.statusOptions.filter((o) => showDone || !o.done);
    const hasUnstatused = allTasks.some((t) => !t.status);
    const list = cols.map((c) => ({ key: c.name, label: c.name, done: c.done, droppable: true }));
    if (hasUnstatused) list.unshift({ key: NO_STATUS, label: "Utan status", done: false, droppable: false });
    return list;
  }, [data, showDone, allTasks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (activeCat && t.category.key !== activeCat) return false;
      if (term && !t.title.toLowerCase().includes(term)) return false;
      if (onlyOverdue) {
        if (!t.due) return false;
        try {
          const d = parseISO(t.due);
          if (isToday(d) || !isPast(d)) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  }, [allTasks, q, onlyOverdue, activeCat]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) map.set(col.key, []);
    for (const t of filtered) {
      const key = t.status && map.has(t.status) ? t.status : map.has(NO_STATUS) && !t.status ? NO_STATUS : null;
      if (key) map.get(key)!.push(t);
    }
    for (const list of map.values()) list.sort(sortTasks);
    return map;
  }, [filtered, columns]);

  if (!notionDatabases(settings).length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Välj en eller flera Notion-databaser under <span className="font-medium text-foreground">Sources</span> för att
        se tavlan.
      </div>
    );
  }

  const drop = (status: string) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id || status === NO_STATUS) return;
    const task = allTasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    move.mutate({ pageId: id, status, dbId: task.dbId }, { onError: (e) => toast.error((e as Error).message) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök task…" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} />
          <span>Bara förfallna</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showDone} onCheckedChange={setShowDone} />
          <Label className="cursor-pointer font-normal">Visa klara</Label>
        </label>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="text-xs">{ago ? `Uppdaterad ${ago}` : "Uppdatera"}</span>
        </Button>
        <Button size="sm" onClick={() => setDialog({ mode: "create" })} className="gap-1.5">
          <Plus className="h-4 w-4" /> Ny task
        </Button>
      </div>

      {/* Job filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCat(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            activeCat === null
              ? "border-foreground/30 bg-foreground/10 font-medium text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Alla <span className="ml-1 opacity-60">{[...counts.values()].reduce((a, b) => a + b, 0)}</span>
        </button>
        {categories
          .filter((c) => (counts.get(c.key) ?? 0) > 0 || activeCat === c.key)
          .map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCat((prev) => (prev === c.key ? null : c.key))}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                activeCat === c.key
                  ? "font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={
                activeCat === c.key
                  ? { borderColor: c.color, backgroundColor: `${c.color}22` }
                  : undefined
              }
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
              <span className="opacity-60">{counts.get(c.key) ?? 0}</span>
            </button>
          ))}
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && !data && <p className="text-sm text-muted-foreground">Hämtar från Notion…</p>}

      {!!columns.length && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  if (col.droppable) {
                    e.preventDefault();
                    setOver(col.key);
                  }
                }}
                onDragLeave={() => setOver((c) => (c === col.key ? null : c))}
                onDrop={() => drop(col.key)}
                className={cn(
                  "flex w-[268px] shrink-0 flex-col rounded-xl border border-border bg-card/60 p-3 transition-colors",
                  over === col.key && "border-primary bg-accent/40",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {items.length}
                  </span>
                  <button
                    onClick={() =>
                      setDialog({ mode: "create", status: col.key === NO_STATUS ? null : col.key })
                    }
                    aria-label={`Ny task i ${col.label}`}
                    className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((t) => {
                    const d = dueMeta(t.due);
                    const cat = catMap.get(t.category.key);
                    return (
                      <article
                        key={t.id}
                        draggable
                        onDragStart={() => setDragging(t.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        className={cn(
                          "group cursor-grab rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-opacity active:cursor-grabbing",
                          dragging === t.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <p className={cn("min-w-0 flex-1 text-sm leading-snug", t.done && "text-muted-foreground line-through")}>
                            {t.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => setDialog({ mode: "edit", task: t })}
                              aria-label="Redigera task"
                              className="text-muted-foreground transition-colors hover:text-foreground"
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
                              aria-label="Ta bort task"
                              className="text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <a href={t.url} target="_blank" rel="noreferrer" aria-label="Öppna i Notion">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors hover:text-foreground",
                                  t.category.source === "manual" ? "bg-muted" : "bg-muted/60 italic",
                                )}
                                title={
                                  t.category.source === "manual"
                                    ? "Manuellt satt"
                                    : "Automatiskt sorterad — klicka för att ändra"
                                }
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: cat?.color ?? "#6b7280" }}
                                />
                                {cat?.label ?? "Personligt"}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {categories.map((c) => (
                                <DropdownMenuItem key={c.key} onSelect={() => setCategory(t.id, c.key)}>
                                  <span
                                    className="mr-2 h-2 w-2 rounded-full"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  {c.label}
                                </DropdownMenuItem>
                              ))}
                              {t.category.source === "manual" && (
                                <DropdownMenuItem onSelect={() => setCategory(t.id, null)}>
                                  Automatisk igen
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {d && (
                            <span
                              className={cn(
                                "rounded-full bg-muted px-2 py-0.5",
                                d.tone === "late" && "bg-destructive/15 text-destructive",
                                d.tone === "warn" && "font-medium text-foreground",
                              )}
                            >
                              {d.text}
                            </span>
                          )}
                          {t.priority && <span className="rounded-full bg-muted px-2 py-0.5">{t.priority}</span>}
                        </div>
                      </article>
                    );
                  })}
                  {!items.length && (
                    <p className="rounded-lg border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
                      Släpp här
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NotionTaskDialog
        state={dialog}
        databases={data?.databases ?? []}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
      />
    </div>
  );
}
