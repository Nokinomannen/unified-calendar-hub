import { useMemo, useState } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { useEvents } from "@/hooks/use-calendar-data";
import { useOverrides } from "@/hooks/use-overrides";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "week" | "month";

export function HoursTracker() {
  const [period, setPeriod] = useState<Period>("week");
  const [open, setOpen] = useState(true);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [period]);

  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: overrides = [] } = useOverrides();

  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const byCalendar = useMemo(() => {
    const map = new Map<string, { name: string; color: string; hours: number }>();
    for (const e of events) {
      if (e.calendar?.source !== "job") continue;
      const dk = format(e.occurrence_start, "yyyy-MM-dd");
      if (skipped.has(`${e.id}|${dk}`)) continue;
      const hours = (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
      const cur = map.get(e.calendar.id) ?? { name: e.calendar.name, color: e.calendar.color, hours: 0 };
      cur.hours += hours;
      map.set(e.calendar.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [events, skipped]);

  const total = byCalendar.reduce((s, c) => s + c.hours, 0);
  const max = Math.max(1, ...byCalendar.map((c) => c.hours));

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Work hours</span>
          <span className="text-xs text-muted-foreground">
            {total.toFixed(1)}h · {period === "week" ? "this week" : "this month"}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              {(["week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  This {p}
                </button>
              ))}
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {format(range.start, "d MMM")} – {format(range.end, "d MMM")}
            </span>
          </div>

          {byCalendar.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No work shifts in this period.</p>
          ) : (
            <ul className="space-y-2">
              {byCalendar.map((c) => (
                <li key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{c.hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(c.hours / max) * 100}%`, background: c.color }}
                    />
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-border pt-2 text-xs font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{total.toFixed(1)}h</span>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
