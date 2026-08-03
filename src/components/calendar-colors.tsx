import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCalendars, useUpdateCalendar, type CalendarRow } from "@/hooks/use-calendar-data";

/** Curated palette — muted, editorial tones that read well in both themes. */
const PRESETS = [
  "#2f9e63", // grön
  "#4f9d7a", // salvia
  "#c9772e", // bränd orange
  "#d9a441", // ockra
  "#c0503f", // terrakotta
  "#c05b86", // dov rosa
  "#8b5cf6", // lila
  "#3b82f6", // blå
  "#2a7f8f", // petrol
  "#6b7280", // grå
];

const HEX = /^#[0-9a-fA-F]{6}$/;

function CalendarColorRow({ calendar }: { calendar: CalendarRow }) {
  const update = useUpdateCalendar();
  const [value, setValue] = useState(calendar.color);
  const [draft, setDraft] = useState(calendar.color);

  // Keep local state in sync when the row changes server-side.
  useEffect(() => {
    setValue(calendar.color);
    setDraft(calendar.color);
  }, [calendar.color]);

  const dirty = value.toLowerCase() !== calendar.color.toLowerCase();

  const pick = (hex: string) => {
    setValue(hex);
    setDraft(hex);
  };

  const save = async () => {
    if (!HEX.test(value)) {
      toast.error("Ange en giltig färgkod, t.ex. #2f9e63");
      return;
    }
    try {
      await update.mutateAsync({ id: calendar.id, color: value.toLowerCase() });
      toast.success(`${calendar.name} uppdaterad`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reset = () => {
    setValue(calendar.color);
    setDraft(calendar.color);
  };

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="h-8 w-8 shrink-0 rounded-lg border border-border/60"
          style={{ background: value }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium">
            <span className="truncate">{calendar.name}</span>
            {calendar.archived && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                arkiverad
              </span>
            )}
          </div>
          <div className="text-xs capitalize text-muted-foreground">{calendar.source}</div>
        </div>

        {dirty && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={reset} aria-label="Ångra">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-8" onClick={save} disabled={update.isPending}>
              <Check className="mr-1 h-3.5 w-3.5" /> Spara
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((hex) => {
          const active = hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              onClick={() => pick(hex)}
              aria-label={`Välj färg ${hex}`}
              aria-pressed={active}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
                active && "ring-2 ring-foreground",
              )}
              style={{ background: hex }}
            >
              {active && <Check className="h-3.5 w-3.5 text-background" />}
            </button>
          );
        })}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="color"
            value={HEX.test(value) ? value : "#6b7280"}
            onChange={(e) => pick(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded-md border border-input bg-background p-0.5"
            aria-label={`Egen färg för ${calendar.name}`}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              setDraft(next);
              if (HEX.test(next)) setValue(next);
            }}
            spellCheck={false}
            maxLength={7}
            placeholder="#2f9e63"
            className="h-7 w-24 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase"
            aria-label={`Färgkod för ${calendar.name}`}
          />
        </label>
      </div>
    </li>
  );
}

export function CalendarColorSettings() {
  const { data: calendars = [], isLoading } = useCalendars();

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Kalenderfärger</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Välj en färg per kalender. Färgen används i månads-, vecko- och dagsvyn samt i timern.
      </p>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Laddar…</div>
      ) : (
        <ul className="space-y-2">
          {calendars.map((c) => (
            <CalendarColorRow key={c.id} calendar={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
