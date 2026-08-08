import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Download, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendars, useEvents } from "@/hooks/use-calendar-data";
import { useWorkLogs } from "@/hooks/use-work-logs";
import { useDjSets } from "@/hooks/use-dj-sets";
import { SEK, buildExportLines, downloadCsv, linesToCsv } from "@/lib/finance";
import { toast } from "sonner";

const dateVal = (d: Date) => format(d, "yyyy-MM-dd");

/** Period picker + CSV invoice basis for job hours and DJ fees. */
export function ExportHoursDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const lastMonth = subMonths(new Date(), 0);
  const [from, setFrom] = useState(dateVal(startOfMonth(lastMonth)));
  const [to, setTo] = useState(dateVal(endOfMonth(lastMonth)));
  const [useLogged, setUseLogged] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

  const { data: calendars = [] } = useCalendars();
  const exportable = calendars.filter((c) => c.source === "job" || c.kind === "dj");

  const start = useMemo(() => new Date(`${from}T00:00:00`), [from]);
  const end = useMemo(() => new Date(`${to}T23:59:59`), [to]);
  const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;

  const { data: events = [] } = useEvents(
    valid ? start : new Date(),
    valid ? end : new Date(),
  );
  const { data: logs = [] } = useWorkLogs();
  const { data: djSets = [] } = useDjSets();

  const lines = useMemo(() => {
    if (!valid) return [];
    return buildExportLines({
      events, logs, djSets, calendars, start, end,
      calendarIds: picked.length ? picked : null,
      useLogged,
    });
  }, [valid, events, logs, djSets, calendars, start, end, picked, useLogged]);

  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  const perCalendar = useMemo(() => {
    const m = new Map<string, { hours: number; amount: number }>();
    for (const l of lines) {
      const cur = m.get(l.calendar) ?? { hours: 0, amount: 0 };
      cur.hours += l.hours;
      cur.amount += l.amount;
      m.set(l.calendar, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [lines]);

  function quick(monthsBack: number) {
    const base = subMonths(new Date(), monthsBack);
    setFrom(dateVal(startOfMonth(base)));
    setTo(dateVal(endOfMonth(base)));
  }

  function exportCsv() {
    if (!lines.length) return;
    downloadCsv(`timmar-${from}-till-${to}.csv`, linesToCsv(lines));
    toast.success("CSV exporterad");
  }

  async function copySummary() {
    const text = [
      `Timunderlag ${from} – ${to}`,
      ...perCalendar.map(([name, v]) => `${name}: ${v.hours.toFixed(1)} h · ${SEK(v.amount)}`),
      `Totalt: ${totalHours.toFixed(1)} h · ${SEK(totalAmount)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Sammanfattning kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Fakturaunderlag
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => quick(0)}>Denna månad</Button>
            <Button size="sm" variant="outline" onClick={() => quick(1)}>Förra månaden</Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-from">Från</Label>
              <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-to">Till</Label>
              <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Källor</Label>
            <div className="flex flex-wrap gap-1.5">
              {exportable.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <button key={c.id} type="button"
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={{ borderColor: c.color, opacity: picked.length === 0 || on ? 1 : 0.4 }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">Inget valt = alla källor.</p>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={useLogged} onCheckedChange={(v) => setUseLogged(!!v)} />
            Använd registrerade timmar när de finns (annars schemalagd tid)
          </label>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            {!valid ? (
              <p className="text-xs text-muted-foreground">Välj en giltig period.</p>
            ) : lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga timmar i perioden.</p>
            ) : (
              <div className="space-y-1.5">
                {perCalendar.map(([name, v]) => (
                  <div key={name} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="tabular-nums">{v.hours.toFixed(1)} h · {SEK(v.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border/60 pt-1.5 text-xs font-semibold">
                  <span>Totalt ({lines.length} rader)</span>
                  <span className="tabular-nums">{totalHours.toFixed(1)} h · {SEK(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={copySummary} disabled={!lines.length}>Kopiera sammanfattning</Button>
          <Button onClick={exportCsv} disabled={!lines.length}>
            <Download className="mr-1.5 h-4 w-4" /> Exportera CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
