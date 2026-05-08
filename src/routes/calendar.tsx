import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, FAB } from "@/components/app-shell";
import { AddEventDialog } from "@/components/add-event-dialog";
import { useCalendars, useEvents, useUpdateCalendar, type ExpandedEvent } from "@/hooks/use-calendar-data";
import { useOverrides, dateKey } from "@/hooks/use-overrides";
import { DayDrawer } from "@/components/day-drawer";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  format, isSameMonth, isSameDay, isToday, isWeekend,
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: calendars = [] } = useCalendars();
  const update = useUpdateCalendar();
  const { data: events = [] } = useEvents(gridStart, gridEnd);
  const { data: overrides = [] } = useOverrides();

  const skippedSet = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [gridStart, gridEnd]);

  const visible = events.filter((e) => e.calendar?.visible !== false);

  if (loading || !user) return null;

  const drawerEvents = drawerDate ? visible.filter((e) => isSameDay(e.occurrence_start, drawerDate)) : [];

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{format(cursor, "MMMM yyyy")}</h1>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {calendars.map((c) => (
            <button
              key={c.id}
              onClick={() => update.mutate({ id: c.id, visible: !c.visible })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ${c.visible ? "" : "opacity-40"}`}
              style={{ borderColor: c.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500/60" /> free day
            <span className="ml-2"><AlertTriangle className="inline h-3 w-3 text-destructive" /> conflict</span>
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => (
              <DayCell
                key={d.toISOString()}
                day={d}
                cursor={cursor}
                events={visible.filter((e) => isSameDay(e.occurrence_start, d))}
                skippedSet={skippedSet}
                onClick={() => setDrawerDate(d)}
                onAdd={() => { setDefaultStart(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0)); setOpen(true); }}
              />
            ))}
          </div>
        </div>
      </div>

      <FAB onClick={() => { setDefaultStart(undefined); setOpen(true); }} />
      <AddEventDialog open={open} onOpenChange={setOpen} defaultStart={defaultStart} />
      <DayDrawer date={drawerDate} events={drawerEvents} overrides={overrides} onClose={() => setDrawerDate(null)} />
    </AppShell>
  );
}

function DayCell({
  day, cursor, events, skippedSet, onClick, onAdd,
}: {
  day: Date; cursor: Date; events: ExpandedEvent[]; skippedSet: Set<string>;
  onClick: () => void; onAdd: () => void;
}) {
  const dk = dateKey(day);
  const inMonth = isSameMonth(day, cursor);
  const today = isToday(day);

  // Conflict detection: pair-wise overlaps among non-all-day events
  const timed = events.filter((e) => !e.all_day);
  const conflictIds = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i], b = timed[j];
      if (a.occurrence_start < b.occurrence_end && b.occurrence_start < a.occurrence_end) {
        if (!skippedSet.has(`${a.id}|${dk}`) && !skippedSet.has(`${b.id}|${dk}`)) {
          conflictIds.add(a.id); conflictIds.add(b.id);
        }
      }
    }
  }

  const activeHours = timed
    .filter((e) => !skippedSet.has(`${e.id}|${dk}`))
    .reduce((s, e) => s + (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000, 0);

  // unique calendar colors present
  const calColors = Array.from(new Set(events.map((e) => e.calendar?.color).filter(Boolean))) as string[];

  const isFree = inMonth && !isWeekend(day) && events.length === 0;

  return (
    <div
      className={cn(
        "group relative min-h-[112px] cursor-pointer border-b border-r border-border p-1.5 text-left transition-colors",
        !inMonth && "bg-muted/20",
        isFree && "bg-emerald-500/[0.04] hover:bg-emerald-500/10",
        !isFree && "hover:bg-accent/30",
      )}
      onClick={onClick}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={cn(
          "inline-grid h-6 w-6 place-items-center rounded-full text-xs",
          today && "bg-primary text-primary-foreground font-semibold",
          !today && inMonth && "text-foreground",
          !inMonth && "text-muted-foreground",
        )}>
          {day.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {calColors.slice(0, 4).map((c) => (
            <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
          ))}
          {activeHours > 0 && (
            <span className="ml-0.5 rounded bg-muted/60 px-1 py-px text-[9px] font-medium tabular-nums text-muted-foreground">
              {activeHours < 1 ? `${Math.round(activeHours * 60)}m` : `${activeHours.toFixed(activeHours < 10 ? 1 : 0)}h`}
            </span>
          )}
          {conflictIds.size > 0 && (
            <AlertTriangle className="h-3 w-3 text-destructive" />
          )}
        </div>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, 4).map((e) => {
          const skipped = skippedSet.has(`${e.id}|${dk}`);
          const conflict = conflictIds.has(e.id);
          return (
            <div
              key={e.id}
              className={cn(
                "flex items-center gap-1 truncate rounded-sm border-l-[3px] bg-card/60 pl-1.5 pr-1 py-px text-[10px] leading-tight",
                skipped && "opacity-40 line-through",
                conflict && "ring-1 ring-destructive/40",
              )}
              style={{ borderLeftColor: e.calendar?.color ?? "#6366f1" }}
            >
              {!e.all_day && (
                <span className="tabular-nums text-muted-foreground">{format(e.occurrence_start, "HH:mm")}</span>
              )}
              <span className="truncate">{e.title}</span>
            </div>
          );
        })}
        {events.length > 4 && (
          <div className="px-1 text-[9px] text-muted-foreground">+{events.length - 4} more</div>
        )}
        {isFree && (
          <div className="mt-1 text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70">Free</div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="absolute bottom-1 right-1 hidden h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground group-hover:grid"
        aria-label="Add event"
        title="Add event"
      >
        +
      </button>
    </div>
  );
}
