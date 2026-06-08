import { useMemo, useState } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";
import { useEvents } from "@/hooks/use-calendar-data";
import { useOverrides } from "@/hooks/use-overrides";
import { useDjSets, type DjSet } from "@/hooks/use-dj-sets";
import { Briefcase, ChevronDown, ChevronUp, Plus, Disc3, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddDjSetDialog } from "@/components/add-dj-set-dialog";

type Period = "week" | "month" | "all";

const fmtSek = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " SEK";

export function HoursTracker() {
  const [period, setPeriod] = useState<Period>("week");
  const [open, setOpen] = useState(true);
  const [djOpen, setDjOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<DjSet | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    if (period === "month") {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    // all time — wide window covering past + future
    return { start: new Date(2000, 0, 1), end: new Date(now.getFullYear() + 5, 11, 31) };
  }, [period]);

  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: overrides = [] } = useOverrides();
  const { data: djSets = [] } = useDjSets();

  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const jobRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; rate: number | null; hours: number }>();
    for (const e of events) {
      if (e.calendar?.source !== "job" || e.all_day) continue;
      const dk = format(e.occurrence_start, "yyyy-MM-dd");
      if (skipped.has(`${e.id}|${dk}`)) continue;
      const cur = map.get(e.calendar.id) ?? {
        id: e.calendar.id,
        name: e.calendar.name,
        color: e.calendar.color,
        rate: (e.calendar as { hourly_rate?: number | null }).hourly_rate ?? null,
        hours: 0,
      };
      cur.hours += (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
      map.set(e.calendar.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [events, skipped]);

  const totalHours = jobRows.reduce((s, r) => s + r.hours, 0);
  const totalJobEarnings = jobRows.reduce((s, r) => s + r.hours * (r.rate ?? 0), 0);

  const setsInRange = useMemo(
    () => djSets.filter((s) => isWithinInterval(parseISO(s.set_date), { start: range.start, end: range.end })),
    [djSets, range],
  );
  const totalDjEarnings = setsInRange.reduce((s, x) => s + Number(x.amount_sek), 0);
  const totalEarnings = totalJobEarnings + totalDjEarnings;

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Briefcase className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Work & earnings</span>
          <span className="truncate text-xs text-muted-foreground">
            {totalHours.toFixed(1)}h · {fmtSek(totalEarnings)}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              {(["week", "month", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "all" ? "All time" : `This ${p}`}
                </button>
              ))}
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {period === "all" ? "All shifts" : `${format(range.start, "d MMM")} – ${format(range.end, "d MMM")}`}
            </span>
          </div>

          {/* Jobs */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jobs</h3>
            {jobRows.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">No shifts in this period.</p>
            ) : (
              <ul className="space-y-2">
                {jobRows.map((r) => (
                  <li key={r.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {r.hours.toFixed(1)}h
                      {r.rate != null && <span className="ml-1 text-[10px]">× {r.rate}</span>}
                    </span>
                    <span className="w-24 text-right text-xs font-semibold tabular-nums">
                      {r.rate != null ? fmtSek(r.hours * r.rate) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* DJ Sets */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Disc3 className="h-3 w-3" /> DJ Sets
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={() => { setEditingSet(null); setDjOpen(true); }}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {setsInRange.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">No DJ sets in this period.</p>
            ) : (
              <ul className="space-y-1.5">
                {setsInRange.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setEditingSet(s); setDjOpen(true); }}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-md px-1 py-1 text-left hover:bg-accent/50"
                    >
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {format(parseISO(s.set_date), "d MMM")}
                      </span>
                      <span className="truncate text-xs font-medium">
                        {s.venue}
                        {s.duration_hours != null && (
                          <span className="ml-1 text-[10px] text-muted-foreground">· {Number(s.duration_hours)}h</span>
                        )}
                      </span>
                      <span className="text-right text-xs font-semibold tabular-nums">{fmtSek(Number(s.amount_sek))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Earnings summary */}
          <section className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
            <h3 className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-3 w-3" /> Earnings
            </h3>
            <ul className="space-y-1">
              {jobRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.rate != null ? fmtSek(r.hours * r.rate) : "no rate"}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between text-xs">
                <span>DJ Sets <span className="text-[10px] text-muted-foreground">({setsInRange.length})</span></span>
                <span className="tabular-nums text-muted-foreground">{fmtSek(totalDjEarnings)}</span>
              </li>
              <li className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmtSek(totalEarnings)}</span>
              </li>
            </ul>
          </section>
        </div>
      )}
      <AddDjSetDialog open={djOpen} onOpenChange={setDjOpen} editing={editingSet} />
    </div>
  );
}
