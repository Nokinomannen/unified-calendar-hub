import { useEffect, useState } from "react";
import { Check, Tags, Coins, EyeOff, Eye, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCalendars, useUpdateCalendar, type CalendarRow } from "@/hooks/use-calendar-data";

function Row({ calendar }: { calendar: CalendarRow }) {
  const update = useUpdateCalendar();
  const [aliases, setAliases] = useState((calendar.aliases ?? []).join(", "));
  const [rate, setRate] = useState(calendar.hourly_rate == null ? "" : String(calendar.hourly_rate));

  useEffect(() => {
    setAliases((calendar.aliases ?? []).join(", "));
    setRate(calendar.hourly_rate == null ? "" : String(calendar.hourly_rate));
  }, [calendar.aliases, calendar.hourly_rate]);

  const dirty =
    aliases.trim() !== (calendar.aliases ?? []).join(", ") ||
    rate.trim() !== (calendar.hourly_rate == null ? "" : String(calendar.hourly_rate));

  async function save() {
    const list = aliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedRate = rate.trim() === "" ? null : Number(rate.replace(",", "."));
    if (parsedRate != null && Number.isNaN(parsedRate)) {
      toast.error("Timlönen måste vara ett tal");
      return;
    }
    try {
      await update.mutateAsync({ id: calendar.id, aliases: list, hourly_rate: parsedRate });
      toast.success(`${calendar.name} sparad`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-8 shrink-0 rounded-lg border border-border/60" style={{ background: calendar.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{calendar.name}</div>
          <div className="text-xs capitalize text-muted-foreground">{calendar.kind ?? calendar.source}</div>
        </div>
        <button
          onClick={() => update.mutate({ id: calendar.id, visible: !calendar.visible })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          title={calendar.visible ? "Dölj i kalendern" : "Visa i kalendern"}
        >
          {calendar.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {calendar.visible ? "Synlig" : "Dold"}
        </button>
        <button
          onClick={() => update.mutate({ id: calendar.id, archived: !calendar.archived })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          title="Arkivera/återställ"
        >
          <Archive className="h-3.5 w-3.5" />
          {calendar.archived ? "Arkiverad" : "Aktiv"}
        </button>
        {dirty && (
          <Button size="sm" className="h-8" onClick={save} disabled={update.isPending}>
            <Check className="mr-1 h-3.5 w-3.5" /> Spara
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          <span className="mb-1 inline-flex items-center gap-1.5"><Tags className="h-3.5 w-3.5" /> Alias för snabbraden</span>
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="jobb, kontoret" className="h-8" />
        </label>
        <label className="block text-xs text-muted-foreground">
          <span className="mb-1 inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" /> Timlön (SEK)</span>
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="160" inputMode="decimal" className="h-8" />
        </label>
      </div>
    </li>
  );
}

export function CalendarSettings() {
  const { data: calendars = [], isLoading } = useCalendars();
  return (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">Kalendrar</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Alias gör att snabbraden förstår vad du skriver — skriv “a-hub” eller ett eget ord och eventet hamnar rätt.
      </p>
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Laddar…</div>
      ) : (
        <ul className="space-y-2">
          {calendars.map((c) => (
            <Row key={c.id} calendar={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SettingToggle({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
