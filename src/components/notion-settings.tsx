import { useState } from "react";
import { ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { useNotionDatabases, useTaskCategories } from "@/hooks/use-notion";
import { useSettings, useUpdateSettings, notionDatabases, type NotionDbConfig } from "@/hooks/use-settings";
import { DEFAULT_ALIASES } from "@/lib/task-category";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

const AUTO = "__auto__";

export function NotionSettings() {
  const { settings } = useSettings();
  const update = useUpdateSettings();
  const [open, setOpen] = useState(true);
  const { data: dbs = [], isLoading, error } = useNotionDatabases(open);
  const { categories } = useTaskCategories();

  const cfg = settings.notion;
  const configured = notionDatabases(settings);

  const patch = (p: Partial<NonNullable<typeof cfg>>) =>
    update.mutate({ notion: { ...cfg, ...p } }, { onError: (e) => toast.error((e as Error).message) });

  const setDatabases = (list: NotionDbConfig[]) => patch({ databases: list, databaseId: null });

  const addDatabase = (databaseId: string) => {
    if (configured.some((d) => d.databaseId === databaseId)) return;
    setDatabases([
      ...configured,
      { databaseId, titleProp: null, statusProp: null, dueProp: null, priorityProp: null, defaultCategory: null },
    ]);
  };

  const updateDb = (databaseId: string, p: Partial<NotionDbConfig>) =>
    setDatabases(configured.map((d) => (d.databaseId === databaseId ? { ...d, ...p } : d)));

  const removeDb = (databaseId: string) =>
    setDatabases(configured.filter((d) => d.databaseId !== databaseId));

  const aliasValue = (key: string) =>
    (cfg?.categoryAliases?.[key] ?? DEFAULT_ALIASES[key] ?? []).join(", ");

  const setAlias = (key: string, raw: string) =>
    patch({
      categoryAliases: {
        ...(cfg?.categoryAliases ?? {}),
        [key]: raw.split(",").map((s) => s.trim()).filter(Boolean),
      },
    });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notion-tasks</h2>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Lägg till en eller flera Notion-databaser — t.ex. en för jobb och en för personligt. One slår ihop dem och
        sorterar automatiskt varje task till rätt jobb.
      </p>

      {error && <p className="mb-3 text-xs text-destructive">{(error as Error).message}</p>}

      <div className="mb-4 flex items-end justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
        <div>
          <Label className="block">Dölj klara tasks</Label>
          <span className="text-xs text-muted-foreground">Visa bara det som återstår i panelen</span>
        </div>
        <Switch checked={cfg?.hideDone ?? true} onCheckedChange={(v) => patch({ hideDone: v })} />
      </div>

      <div className="space-y-3">
        {configured.map((db) => {
          const meta = dbs.find((d) => d.id === db.databaseId);
          const propNames = (types: string[]) =>
            (meta?.properties ?? []).filter((p) => types.includes(p.type)).map((p) => p.name);

          return (
            <div key={db.databaseId} className="rounded-xl border border-border/70 p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium">{meta?.name ?? "Databas"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 text-muted-foreground"
                  onClick={() => removeDb(db.databaseId)}
                  aria-label="Ta bort databas"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PropPicker
                  label="Statuskolumn"
                  value={db.statusProp ?? ""}
                  options={propNames(["status", "checkbox", "select"])}
                  onChange={(v) => updateDb(db.databaseId, { statusProp: v })}
                />
                <PropPicker
                  label="Datumkolumn"
                  value={db.dueProp ?? ""}
                  options={propNames(["date"])}
                  onChange={(v) => updateDb(db.databaseId, { dueProp: v })}
                />
                <div className="sm:col-span-2">
                  <Label>Standardkategori</Label>
                  <Select
                    value={db.defaultCategory ?? AUTO}
                    onValueChange={(v) =>
                      updateDb(db.databaseId, { defaultCategory: v === AUTO ? null : v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Automatiskt (Personligt om inget matchar)</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Används när varken taggar eller titel avslöjar vilket jobb tasken hör till.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Label>Lägg till databas</Label>
        <Select value="" onValueChange={addDatabase} onOpenChange={() => setOpen(true)}>
          <SelectTrigger>
            <SelectValue placeholder="Välj databas…" />
            <Plus className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          </SelectTrigger>
          <SelectContent>
            {dbs
              .filter((d) => !configured.some((c) => c.databaseId === d.id))
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {!!configured.length && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <h3 className="mb-1 text-sm font-medium">Så känner appen igen jobben</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Kommaseparerade ord. Matchar mot Notion-taggar, #hashtaggar och orden i titeln — versaler, bindestryck och
            mellanslag spelar ingen roll.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <div key={c.key}>
                <Label className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </Label>
                <Input
                  defaultValue={aliasValue(c.key)}
                  onBlur={(e) => setAlias(c.key, e.target.value)}
                  placeholder="t.ex. ahub, a-hub"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PropPicker({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
