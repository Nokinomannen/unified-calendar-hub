import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, FAB } from "@/components/app-shell";
import { AddEventDialog } from "@/components/add-event-dialog";
import { useCalendars, useEvents, type ExpandedEvent, type EventRow } from "@/hooks/use-calendar-data";
import { useOverrides, dateKey } from "@/hooks/use-overrides";
import { DayDrawer } from "@/components/day-drawer";
import { WeekView } from "@/components/week-view";
import { HoursTracker } from "@/components/hours-tracker";
import { QuickAddBar } from "@/components/quick-add-bar";
import { UpcomingPanel } from "@/components/upcoming-panel";
import { useReminderSync, useReminderScheduler } from "@/hooks/use-reminders";
import { EventContextMenu, LogDraftDialog, type LogDraft } from "@/components/event-context-menu";
import { LogTimeDropZone } from "@/components/log-time-dropzone";
import { useWeatherMap } from "@/hooks/use-weather";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

import { WeatherBadge } from "@/components/weather-badge";
import type { WeatherDay } from "@/hooks/use-weather";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  addWeeks, subWeeks, format, isSameMonth, isSameDay, isToday, isWeekend,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

export const Route = createFileRoute("/")({
  // `?d=YYYY-MM-DD` lets the command palette and links jump to a specific day.
  validateSearch: (search: Record<string, unknown>): { d?: string } =>
    typeof search.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.d) ? { d: search.d } : {},
  component: CalendarPage,
});

function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  // Queue upcoming reminders and fire due notifications while the app is open.
  useReminderSync();
  useReminderScheduler();

  const { settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const wso = settings.weekStartsOn;

  const [view, setView] = useState<ViewMode>("month");
  const [viewLoaded, setViewLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cal-view") as ViewMode | null;
      if (stored === "month" || stored === "week" || stored === "day") setView(stored);
      else setView(settings.defaultView);
    } catch { /* noop */ }
    setViewLoaded(true);
    // Only run on mount / once settings arrive.
  }, [settings.defaultView]);
  useEffect(() => { if (viewLoaded) { try { localStorage.setItem("cal-view", view); } catch { /* noop */ } } }, [view, viewLoaded]);

  const [cursor, setCursor] = useState(new Date());
  const searchDay = Route.useSearch().d;
  useEffect(() => {
    if (!searchDay) return;
    const d = new Date(`${searchDay}T12:00:00`);
    if (!Number.isNaN(d.getTime())) setCursor(d);
  }, [searchDay]);
  const [open, setOpen] = useState(false);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<{ start: Date; end: Date } | null>(null);
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);
  const [logDraft, setLogDraft] = useState<LogDraft | null>(null);
  const weatherAll = useWeatherMap("malmo");
  const weather = useMemo(
    () => (settings.showWeather ? weatherAll : new Map<string, WeatherDay>()),
    [settings.showWeather, weatherAll],
  );

  const range = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(cursor), me = endOfMonth(cursor);
      return { start: startOfWeek(ms, { weekStartsOn: wso }), end: endOfWeek(me, { weekStartsOn: wso }) };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: wso });
      return { start: s, end: addDays(s, 6) };
    }
    return { start: cursor, end: cursor };
  }, [view, cursor, wso]);


  const { data: calendars = [] } = useCalendars();
  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: overrides = [] } = useOverrides();

  const skippedSet = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  // Filters are remembered per view — month, week, day and compact each keep their own set.
  const filterKey = settings.density === "compact" ? "compact" : view;
  const hiddenIds = useMemo(
    () => new Set(settings.viewFilters?.[filterKey] ?? []),
    [settings.viewFilters, filterKey],
  );
  const toggleCalendar = (id: string) => {
    const next = new Set(hiddenIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateSettings.mutate({ viewFilters: { ...(settings.viewFilters ?? {}), [filterKey]: [...next] } });
  };
  const setAll = (show: boolean) =>
    updateSettings.mutate({
      viewFilters: {
        ...(settings.viewFilters ?? {}),
        [filterKey]: show ? [] : calendars.map((c) => c.id),
      },
    });

  const visible = events.filter((e) => e.calendar?.visible !== false && !hiddenIds.has(e.calendar_id));

  // Keyboard shortcuts — inert while typing in a field or dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      const step = (dir: -1 | 1) =>
        setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
      switch (e.key.toLowerCase()) {
        case "q": {
          e.preventDefault();
          document.getElementById("quick-add-input")?.focus();
          break;
        }
        case "n": e.preventDefault(); setEditing(null); setDefaultStart(undefined); setOpen(true); break;
        case "t": e.preventDefault(); setCursor(new Date()); break;
        case "1": setView("month"); break;
        case "2": setView("week"); break;
        case "3": setView("day"); break;
        case "arrowleft": step(-1); break;
        case "arrowright": step(1); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

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
      ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: wso }), "d MMM")}`
      : format(cursor, "EEEE d MMM yyyy");


  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendar</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{headerLabel}</h1>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5 backdrop-blur">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-all sm:px-3",
                    view === v
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >{v}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
              <Button size="icon" variant="outline" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
              <Button size="icon" variant="outline" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {calendars.map((c) => {
            const on = c.visible !== false && !hiddenIds.has(c.id);
            return (
              <button key={c.id}
                onClick={() => toggleCalendar(c.id)}
                title={`Visa/dölj ${c.name} i ${filterKey === "compact" ? "kompakt läge" : filterKey === "month" ? "månadsvyn" : filterKey === "week" ? "veckovyn" : "dagsvyn"}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  on ? "bg-card/60 hover:bg-card" : "opacity-40 hover:opacity-70",
                )}
                style={{ borderColor: c.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? c.color : "transparent", boxShadow: `inset 0 0 0 1px ${c.color}` }} />
                {c.name}
              </button>
            );
          })}
          <div className="flex items-center gap-1">
            <button onClick={() => setAll(true)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Alla</button>
            <button onClick={() => setAll(false)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Inga</button>
          </div>
          <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">
              Filter sparas för {filterKey === "compact" ? "kompakt" : filterKey === "month" ? "månad" : filterKey === "week" ? "vecka" : "dag"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success/80" /> free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" /> conflict
            </span>
          </span>
        </div>


        {settings.showQuickAdd && <QuickAddBar />}

        {settings.showHours && <HoursTracker />}

        {settings.showUpcoming && (
          <UpcomingPanel
            onEdit={(ev) => { setEditing(ev); setOpen(true); }}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "month" && (
              <MonthGrid cursor={cursor} events={visible} skippedSet={skippedSet} weather={weather}
                weekStartsOn={wso}
                compact={settings.density === "compact"}
                showConflicts={settings.showConflicts}
                onDayClick={(d) => setDrawerDate(d)}
                onAdd={(d) => openAdd(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))}
                onEdit={openEdit}
                onConvert={setLogDraft}
              />
            )}

            {view === "week" && (
              <WeekView weekStart={cursor} events={visible} overrides={overrides}
                onEdit={openEdit} onAdd={openAdd} onConvert={setLogDraft} weather={weather}
                weekStartsOn={wso}
              />

            )}
            {view === "day" && (
              <div className="rounded-2xl border border-border bg-card p-2">
                <button onClick={() => setDrawerDate(cursor)} className="w-full rounded-md bg-muted/40 p-3 text-sm text-muted-foreground hover:bg-muted">
                  Open day details for {format(cursor, "EEE d MMM")}
                </button>
                <div className="mt-2">
                  <WeekView weekStart={cursor} events={visible.filter((e) => isSameDay(e.occurrence_start, cursor))} overrides={overrides}
                    onEdit={openEdit} onAdd={openAdd} onConvert={setLogDraft} weather={weather}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <FAB onClick={() => openAdd()} />
      <AddEventDialog open={open} onOpenChange={setOpen} defaultStart={defaultStart} event={editing} />
      <DayDrawer date={drawerDate} events={drawerEvents} overrides={overrides} onClose={() => setDrawerDate(null)} onEdit={openEdit} onAdd={(d) => { setDrawerDate(null); openAdd(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0)); }} />
      <LogTimeDropZone onDrop={setLogDraft} />
      <LogDraftDialog draft={logDraft} onClose={() => setLogDraft(null)} />
    </AppShell>
  );
}


function MonthGrid({ cursor, events, skippedSet, weather, weekStartsOn, compact, showConflicts, onDayClick, onAdd, onEdit, onConvert }: {
  cursor: Date; events: ExpandedEvent[]; skippedSet: Set<string>;
  weather: Map<string, WeatherDay>;
  weekStartsOn: 0 | 1; compact: boolean; showConflicts: boolean;
  onDayClick: (d: Date) => void; onAdd: (d: Date) => void;
  onEdit: (e: ExpandedEvent) => void; onConvert: (d: LogDraft) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }
  const labels = weekStartsOn === 1
    ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)]">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {labels.map((d) => (
          <div key={d} className="py-2 sm:py-2.5">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <DayCell key={d.toISOString()} day={d} cursor={cursor}
            events={events.filter((e) => isSameDay(e.occurrence_start, d))}
            skippedSet={skippedSet}
            weather={weather.get(dateKey(d))}
            compact={compact}
            showConflicts={showConflicts}
            onClick={() => onDayClick(d)}
            onAdd={() => onAdd(d)}
            onEdit={onEdit}
            onConvert={onConvert}
          />
        ))}
      </div>
    </div>
  );
}


function DayCell({
  day, cursor, events, skippedSet, weather, compact, showConflicts, onClick, onAdd, onEdit, onConvert,
}: {
  day: Date; cursor: Date; events: ExpandedEvent[]; skippedSet: Set<string>;
  weather?: WeatherDay; compact: boolean; showConflicts: boolean;
  onClick: () => void; onAdd: () => void;
  onEdit: (e: ExpandedEvent) => void; onConvert: (d: LogDraft) => void;
}) {
  const dk = dateKey(day);
  const inMonth = isSameMonth(day, cursor);
  const today = isToday(day);

  const timed = events.filter((e) => !e.all_day);
  const conflictIds = new Set<string>();
  if (showConflicts) {
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
  }


  const activeHours = timed
    .filter((e) => !skippedSet.has(`${e.id}|${dk}`))
    .reduce((s, e) => s + (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000, 0);

  const calColors = Array.from(new Set(events.map((e) => e.calendar?.color).filter(Boolean))) as string[];
  const isFree = inMonth && !isWeekend(day) && events.length === 0;

  return (
    <div
      className={cn(
        "group relative cursor-pointer border-b border-r border-border p-1 text-left transition-colors sm:p-2",
        compact ? "min-h-[60px] sm:min-h-[96px]" : "min-h-[72px] sm:min-h-[124px]",

        !inMonth && "bg-muted/15",
        isFree && "bg-success/[0.05] hover:bg-success/10",
        !isFree && "hover:bg-accent/30",
      )}
      onClick={onClick}
    >
      <div className="mb-1 flex items-center justify-between gap-1 sm:mb-1.5">
        <span className={cn(
          "inline-grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition-all sm:h-7 sm:w-7 sm:text-xs",
          today && "bg-primary text-primary-foreground",
          !today && inMonth && "text-foreground",
          !inMonth && "text-muted-foreground/60",
        )}>
          {day.getDate()}
        </span>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {weather && <WeatherBadge day={weather} className="hidden sm:inline-flex" />}
          {/* Mobile: show max 2 dots, no hour badge */}
          <span className="flex items-center gap-0.5 sm:hidden">
            {calColors.slice(0, 2).map((c) => (
              <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            {calColors.slice(0, 4).map((c) => (
              <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
            ))}
            {activeHours > 0 && (
              <span className="ml-0.5 rounded bg-muted/70 px-1 py-px text-[9px] font-medium tabular-nums text-muted-foreground">
                {activeHours < 1 ? `${Math.round(activeHours * 60)}m` : `${activeHours.toFixed(activeHours < 10 ? 1 : 0)}h`}
              </span>
            )}
          </span>
          {conflictIds.size > 0 && <span className="h-1.5 w-1.5 rounded-full bg-destructive sm:h-2 sm:w-2" title="Conflict" />}
        </div>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, 2).map((e) => {
          const skipped = skippedSet.has(`${e.id}|${dk}`);
          const conflict = conflictIds.has(e.id);
          return (
            <EventContextMenu key={e.id} event={e} onEdit={onEdit} onConvert={onConvert}>
              <div
                className={cn(
                  "flex items-center gap-1 truncate rounded-sm border-l-[3px] bg-card/40 pl-1 pr-0.5 py-0.5 text-[9px] leading-tight transition-colors sm:pl-1.5 sm:pr-1 sm:text-[10px]",
                  skipped && "opacity-40 line-through",
                  conflict && "ring-1 ring-destructive/40",
                )}
                style={{ borderLeftColor: e.calendar?.color ?? "var(--primary)" }}
              >
                {!e.all_day && (
                  <span className="hidden tabular-nums text-muted-foreground sm:inline">{format(e.occurrence_start, "HH:mm")}</span>
                )}
                <span className="truncate">{e.title}</span>
              </div>
            </EventContextMenu>
          );
        })}
        {/* Desktop: show up to 4 */}
        <div className="hidden sm:block">
          {events.slice(2, 4).map((e) => {
            const skipped = skippedSet.has(`${e.id}|${dk}`);
            const conflict = conflictIds.has(e.id);
            return (
              <EventContextMenu key={e.id} event={e} onEdit={onEdit} onConvert={onConvert}>
                <div
                  className={cn(
                    "mt-0.5 flex items-center gap-1 truncate rounded-sm border-l-[3px] bg-card/40 pl-1.5 pr-1 py-0.5 text-[10px] leading-tight transition-colors",
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
              </EventContextMenu>
            );
          })}
        </div>
        {events.length > 2 && (
          <div className="px-0.5 text-[9px] text-muted-foreground sm:hidden">+{events.length - 2}</div>
        )}
        {events.length > 4 && (
          <div className="hidden px-1 text-[9px] text-muted-foreground sm:block">+{events.length - 4} more</div>
        )}
        {isFree && (
          <div className="mt-1 hidden text-[10px] font-medium uppercase tracking-wider text-success/80 sm:block">Free</div>
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
