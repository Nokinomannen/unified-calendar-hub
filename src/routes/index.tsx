import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, FAB } from "@/components/app-shell";
import { AddEventDialog } from "@/components/add-event-dialog";
import { useCalendars, useEvents, useUpdateCalendar, type ExpandedEvent, type EventRow } from "@/hooks/use-calendar-data";
import { useOverrides, dateKey } from "@/hooks/use-overrides";
import { DayDrawer } from "@/components/day-drawer";
import { WeekView } from "@/components/week-view";
import { HoursTracker } from "@/components/hours-tracker";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  addWeeks, subWeeks, format, isSameMonth, isSameDay, isToday, isWeekend,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

export const Route = createFileRoute("/")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  const [view, setView] = useState<ViewMode>("month");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cal-view") as ViewMode | null;
      if (stored === "month" || stored === "week" || stored === "day") setView(stored);
    } catch { /* noop */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("cal-view", view); } catch { /* noop */ } }, [view]);

  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(cursor), me = endOfMonth(cursor);
      return { start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start: s, end: addDays(s, 6) };
    }
    return { start: cursor, end: cursor };
  }, [view, cursor]);

  const { data: calendars = [] } = useCalendars();
  const update = useUpdateCalendar();
  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: overrides = [] } = useOverrides();

  const skippedSet = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const visible = events.filter((e) => e.calendar?.visible !== false);

  if (loading || !user) return null;

  const drawerEvents = drawerDate ? visible.filter((e) => isSameDay(e.occurrence_start, drawerDate)) : [];

  function openEdit(e: ExpandedEvent) {
    const { occurrence_start: _s, occurrence_end: _e, calendar: _c, ...row } = e as any;
    setEditing(row as EventRow);
    setOpen(true);
  }
  function openAdd(when?: Date) {
    setEditing(null);
    setDefaultStart(when);
    setOpen(true);
  }

  function navPrev() {
    if (view === "month") setCursor(subMonths(cursor, 1));
    else if (view === "week") setCursor(subWeeks(cursor, 1));
    else setCursor(addDays(cursor, -1));
  }
  function navNext() {
    if (view === "month") setCursor(addMonths(cursor, 1));
    else if (view === "week") setCursor(addWeeks(cursor, 1));
    else setCursor(addDays(cursor, 1));
  }
  const headerLabel = view === "month"
    ? format(cursor, "MMMM yyyy")
    : view === "week"
      ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM")}`
      : format(cursor, "EEEE d MMM yyyy");

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendar</p>
            <h1 className="text-3xl font-semibold tracking-tight">{headerLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5 backdrop-blur">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all",
                    view === v
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >{v}</button>
              ))}
            </div>
            <Button size="icon" variant="outline" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="icon" variant="outline" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {calendars.map((c) => (
            <button key={c.id}
              onClick={() => update.mutate({ id: c.id, visible: !c.visible })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                c.visible ? "bg-card/60 hover:bg-card" : "opacity-40 hover:opacity-70",
              )}
              style={{ borderColor: c.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success/80" /> free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" /> conflict
            </span>
          </span>
        </div>

        <HoursTracker />

        {view === "month" && (
          <MonthGrid cursor={cursor} events={visible} skippedSet={skippedSet}
            onDayClick={(d) => setDrawerDate(d)}
            onAdd={(d) => openAdd(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))}
          />
        )}
        {view === "week" && (
          <WeekView weekStart={cursor} events={visible} overrides={overrides}
            onEdit={openEdit} onAdd={openAdd}
          />
        )}
        {view === "day" && (
          <div className="rounded-2xl border border-border bg-card p-2">
            <button onClick={() => setDrawerDate(cursor)} className="w-full rounded-md bg-muted/40 p-3 text-sm text-muted-foreground hover:bg-muted">
              Open day details for {format(cursor, "EEE d MMM")}
            </button>
            <div className="mt-2">
              <WeekView weekStart={cursor} events={visible.filter((e) => isSameDay(e.occurrence_start, cursor))} overrides={overrides}
                onEdit={openEdit} onAdd={openAdd}
              />
            </div>
          </div>
        )}
      </div>

      <FAB onClick={() => openAdd()} />
      <AddEventDialog open={open} onOpenChange={setOpen} defaultStart={defaultStart} event={editing} />
      <DayDrawer date={drawerDate} events={drawerEvents} overrides={overrides} onClose={() => setDrawerDate(null)} onEdit={openEdit} onAdd={(d) => { setDrawerDate(null); openAdd(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0)); }} />
    </AppShell>
  );
}

function MonthGrid({ cursor, events, skippedSet, onDayClick, onAdd }: {
  cursor: Date; events: ExpandedEvent[]; skippedSet: Set<string>;
  onDayClick: (d: Date) => void; onAdd: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)]">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="py-2.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <DayCell key={d.toISOString()} day={d} cursor={cursor}
            events={events.filter((e) => isSameDay(e.occurrence_start, d))}
            skippedSet={skippedSet}
            onClick={() => onDayClick(d)}
            onAdd={() => onAdd(d)}
          />
        ))}
      </div>
    </div>
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

  const calColors = Array.from(new Set(events.map((e) => e.calendar?.color).filter(Boolean))) as string[];
  const isFree = inMonth && !isWeekend(day) && events.length === 0;

  return (
    <div
      className={cn(
        "group relative min-h-[124px] cursor-pointer border-b border-r border-border p-2 text-left transition-colors",
        !inMonth && "bg-muted/15",
        isFree && "bg-success/[0.05] hover:bg-success/10",
        !isFree && "hover:bg-accent/30",
      )}
      onClick={onClick}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className={cn(
          "inline-grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-all",
          today && "bg-primary text-primary-foreground",
          !today && inMonth && "text-foreground",
          !inMonth && "text-muted-foreground/60",
        )}>
          {day.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {calColors.slice(0, 4).map((c) => (
            <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
          ))}
          {activeHours > 0 && (
            <span className="ml-0.5 rounded bg-muted/70 px-1 py-px text-[9px] font-medium tabular-nums text-muted-foreground">
              {activeHours < 1 ? `${Math.round(activeHours * 60)}m` : `${activeHours.toFixed(activeHours < 10 ? 1 : 0)}h`}
            </span>
          )}
          {conflictIds.size > 0 && <span className="h-2 w-2 rounded-full bg-destructive" title="Conflict" />}
        </div>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, 4).map((e) => {
          const skipped = skippedSet.has(`${e.id}|${dk}`);
          const conflict = conflictIds.has(e.id);
          return (
            <div key={e.id}
              className={cn(
                "flex items-center gap-1 truncate rounded-sm border-l-[3px] bg-card/40 pl-1.5 pr-1 py-0.5 text-[10px] leading-tight transition-colors",
                skipped && "opacity-40 line-through",
                conflict && "ring-1 ring-destructive/40",
              )}
              style={{ borderLeftColor: e.calendar?.color ?? "var(--primary)" }}
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
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-success/80">Free</div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="absolute bottom-1 right-1 hidden h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground group-hover:grid"
        aria-label="Add event"
      >+</button>
    </div>
  );
}
