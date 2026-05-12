import { useMemo, useState } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";
import { useEvents } from "@/hooks/use-calendar-data";
import { useOverrides } from "@/hooks/use-overrides";
import { useWorkLogs } from "@/hooks/use-work-logs";
import { Briefcase, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogHoursDialog } from "@/components/log-hours-dialog";

type Period = "week" | "month";

export function HoursTracker() {
  const [period, setPeriod] = useState<Period>("week");
  const [open, setOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logCalendarId, setLogCalendarId] = useState<string | undefined>(undefined);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [period]);

  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: overrides = [] } = useOverrides();
  const { data: workLogs = [] } = useWorkLogs();

  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; scheduled: number; actual: number }>();

    // Seed jobs from events
    for (const e of events) {
      if (e.calendar?.source !== "job") continue;
      const dk = format(e.occurrence_start, "yyyy-MM-dd");
      const cur = map.get(e.calendar.id) ?? { id: e.calendar.id, name: e.calendar.name, color: e.calendar.color, scheduled: 0, actual: 0 };
      if (!skipped.has(`${e.id}|${dk}`)) {
        cur.scheduled += (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
      }
      map.set(e.calendar.id, cur);
    }

    // Add actual from work_logs in range
    for (const log of workLogs) {
      const d = parseISO(log.work_date);
      if (!isWithinInterval(d, { start: range.start, end: range.end })) continue;
      const cur = map.get(log.calendar_id);
      if (cur) {
        cur.actual += Number(log.hours);
      } else {
        // Job calendar with no events but logged hours — pull from any log entry
        map.set(log.calendar_id, { id: log.calendar_id, name: "Work", color: "#10b981", scheduled: 0, actual: Number(log.hours) });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.scheduled + b.actual) - (a.scheduled + a.actual));
  }, [events, skipped, workLogs, range]);

  const totalScheduled = rows.reduce((s, c) => s + c.scheduled, 0);
  const totalActual = rows.reduce((s, c) => s + c.actual, 0);

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
            {totalActual.toFixed(1)}h actual · {totalScheduled.toFixed(1)}h scheduled
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

          {rows.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No work in this period.</p>
          ) : (
            <ul className="space-y-2.5">
              <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Job</span>
                <span className="w-14 text-right">Sched.</span>
                <span className="w-14 text-right">Actual</span>
                <span className="w-7" />
              </li>
              {rows.map((c) => {
                const diff = c.actual - c.scheduled;
                return (
                  <li key={c.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{c.scheduled.toFixed(1)}h</span>
                    <span className="w-14 text-right text-xs tabular-nums">
                      <span className="font-semibold">{c.actual.toFixed(1)}h</span>
                      {c.actual > 0 && c.scheduled > 0 && (
                        <span className={cn("ml-1 text-[10px]", diff >= 0 ? "text-emerald-500" : "text-amber-500")}>
                          {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      )}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setLogCalendarId(c.id); setLogOpen(true); }}
                      title="Log actual hours"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
              <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-border pt-2 text-xs font-semibold">
                <span>Total</span>
                <span className="w-14 text-right tabular-nums text-muted-foreground">{totalScheduled.toFixed(1)}h</span>
                <span className="w-14 text-right tabular-nums">{totalActual.toFixed(1)}h</span>
                <span className="w-7" />
              </li>
            </ul>
          )}
        </div>
      )}
      <LogHoursDialog open={logOpen} onOpenChange={setLogOpen} defaultCalendarId={logCalendarId} />
    </div>
  );
}
