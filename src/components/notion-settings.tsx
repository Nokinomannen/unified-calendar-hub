import { useState } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { useNotionDatabases } from "@/hooks/use-notion";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export function NotionSettings() {
  const { settings } = useSettings();
  const update = useUpdateSettings();
  const [open, setOpen] = useState(true);
  const { data: dbs = [], isLoading, error } = useNotionDatabases(open);

  const cfg = settings.notion;
  const selected = dbs.find((d) => d.id === cfg?.databaseId);
  const propNames = (types: string[]) =>
    (selected?.properties ?? []).filter((p) => types.includes(p.type)).map((p) => p.name);

  const patch = (p: Partial<NonNullable<typeof cfg>>) =>
    update.mutate(
      { notion: { ...cfg, ...p } },
      { onError: (e) => toast.error((e as Error).message) },
    );

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notion-tasks</h2>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Välj vilken Notion-databas som ska visas i kalendern och på sidan Tasks. Listan uppdateras varje minut
        och du kan bocka av direkt härifrån.
      </p>

      {error && <p className="mb-3 text-xs text-destructive">{(error as Error).message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Databas</Label>
          <Select
            value={cfg?.databaseId ?? ""}
            onValueChange={(v) =>
              patch({ databaseId: v, titleProp: null, statusProp: null, dueProp: null, priorityProp: null })
            }
            onOpenChange={() => setOpen(true)}
          >
            <SelectTrigger><SelectValue placeholder="Välj databas…" /></SelectTrigger>
            <SelectContent>
              {dbs.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
          <div>
            <Label className="block">Dölj klara tasks</Label>
            <span className="text-xs text-muted-foreground">Visa bara det som återstår</span>
          </div>
          <Switch checked={cfg?.hideDone ?? true} onCheckedChange={(v) => patch({ hideDone: v })} />
        </div>

        {selected && (
          <>
            <PropPicker
              label="Statuskolumn"
              value={cfg?.statusProp ?? ""}
              options={propNames(["status", "checkbox", "select"])}
              onChange={(v) => patch({ statusProp: v })}
            />
            <PropPicker
              label="Datumkolumn"
              value={cfg?.dueProp ?? ""}
              options={propNames(["date"])}
              onChange={(v) => patch({ dueProp: v })}
            />
          </>
        )}
      </div>

      {selected && (
        <p className="mt-3 text-xs text-muted-foreground">
          Lämnar du kolumnerna tomma gissar appen automatiskt utifrån databasens fält.
        </p>
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
