import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Clock, Coins, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LogHoursDialog } from "@/components/log-hours-dialog";
import { useEvents, useCalendars } from "@/hooks/use-calendar-data";
import { useWorkLogs } from "@/hooks/use-work-logs";
import { useDjSets } from "@/hooks/use-dj-sets";
import { useOverrides, dateKey } from "@/hooks/use-overrides";
import { useSettings } from "@/hooks/use-settings";
import { summarizePeriod, SEK } from "@/lib/finance";

export const Route = createFileRoute("/weekly")({
  component: WeeklyPage,
  head: () => ({
    meta: [
      { title: "Veckoplanering — One" },
      { name: "description", content: "Planera veckan: kommande pass, ologgade timmar och förväntad inkomst i en vy." },
      { property: "og:title", content: "Veckoplanering — One" },
      { property: "og:description", content: "Planera veckan: kommande pass, ologgade timmar och förväntad inkomst." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Missing = { calendarId: string; calendarName: string; color: string; date: Date; scheduled: number; logged: number };

function WeeklyPage() {
  const { settings } = useSettings();
  const wso = settings.weekStartsOn;
  const today = new Date();

  const thisWeekStart = startOfWeek(today, { weekStartsOn: wso });
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);

  const { data: calendars = [] } = useCalendars();
  const { data: upcoming = [] } = useEvents(nextWeekStart, addDays(nextWeekEnd, 1));
  const { data: pastEvents = [] } = useEvents(lastWeekStart, addDays(lastWeekEnd, 1));
  const { data: logs = [] } = useWorkLogs();
  const { data: djSets = [] } = useDjSets();
  const { data: overrides = [] } = useOverrides();

  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  // Scheduled but never logged — the whole point of the Sunday check-in.
  const missing = useMemo<Missing[]>(() => {
    const byKey = new Map<string, Missing>();
    for (const e of pastEvents) {
      if (e.all_day || e.calendar?.source !== "job") continue;
      const dk = dateKey(e.occurrence_start);
      if (skipped.has(`${e.id}|${dk}`)) continue;
      const key = `${e.calendar_id}|${dk}`;
      const hours = (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
      const row = byKey.get(key) ?? {
        calendarId: e.calendar_id,
        calendarName: e.calendar?.name ?? "Jobb",
        color: e.calendar?.color ?? "#888",
        date: new Date(e.occurrence_start.getFullYear(), e.occurrence_start.getMonth(), e.occurrence_start.getDate()),
        scheduled: 0,
        logged: 0,
      };
      row.scheduled += hours;
      byKey.set(key, row);
    }
    for (const row of byKey.values()) {
      const dk = dateKey(row.date);
      row.logged = logs
        .filter((l) => l.calendar_id === row.calendarId && l.work_date === dk)
        .reduce((s, l) => s + Number(l.hours), 0);
    }
    return [...byKey.values()]
      .filter((r) => r.logged === 0 || Math.abs(r.scheduled - r.logged) > 0.5)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [pastEvents, logs, skipped]);

  const summary = useMemo(
    () => summarizePeriod({ events: upcoming, djSets, start: nextWeekStart, end: addDays(nextWeekEnd, 1), skipped }),
    [upcoming, djSets, nextWeekStart, nextWeekEnd, skipped],
  );

  const plannedHours = summary.hoursDone + summary.hoursLeft;
  const goal = settings.weeklyHoursGoal || 0;

  const [draft, setDraft] = useState<Missing | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Veckoplanering</h1>
          <p className="text-sm text-muted-foreground">
            Vecka {format(nextWeekStart, "w", { locale: sv })} · {format(nextWeekStart, "d MMM", { locale: sv })}–
            {format(nextWeekEnd, "d MMM", { locale: sv })}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Clock} label="Planerade timmar" value={`${plannedHours.toFixed(1)} h`}
            hint={goal ? `Mål ${goal} h · ${(plannedHours - goal >= 0 ? "+" : "")}${(plannedHours - goal).toFixed(1)} h` : undefined} />
          <Stat icon={Coins} label="Förväntad inkomst" value={SEK(summary.projected)}
            hint={summary.djForecast ? `varav DJ ${SEK(summary.djForecast + summary.djEarned)}` : undefined} />
          <Stat icon={TriangleAlert} label="Att logga från förra veckan"
            value={missing.length === 0 ? "Inget" : `${missing.length} dagar`}
            hint={missing.length ? `${missing.reduce((s, m) => s + (m.scheduled - m.logged), 0).toFixed(1)} h saknas` : "Allt är loggat"} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <TriangleAlert className="h-4 w-4 text-primary" /> Ologgade timmar förra veckan
          </h2>
          {missing.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Allt är loggat — snyggt jobbat.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {missing.map((m) => (
                <li key={`${m.calendarId}-${dateKey(m.date)}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border-l-[3px] bg-muted/30 px-3 py-2 text-sm"
                  style={{ borderLeftColor: m.color }}>
                  <span className="font-medium">{format(m.date, "EEE d MMM", { locale: sv })}</span>
                  <span className="text-muted-foreground">{m.calendarName}</span>
                  <span className="tabular-nums text-muted-foreground">
                    schema {m.scheduled.toFixed(1)} h · loggat {m.logged.toFixed(1)} h
                  </span>
                  <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => setDraft(m)}>Logga</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4 text-primary" /> Veckan som kommer
          </h2>
          <div className="space-y-3">
            {days.map((d) => {
              const dayEvents = upcoming
                .filter((e) => isSameDay(e.occurrence_start, d) && !skipped.has(`${e.id}|${dateKey(e.occurrence_start)}`))
                .sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
              const hours = dayEvents
                .filter((e) => !e.all_day)
                .reduce((s, e) => s + (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000, 0);
              return (
                <div key={d.toISOString()} className="grid gap-1.5 sm:grid-cols-[7rem_1fr]">
                  <div className="pt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {format(d, "EEE d MMM", { locale: sv })}
                    {hours > 0 && <span className="ml-1 tabular-nums">· {hours.toFixed(1)} h</span>}
                  </div>
                  {dayEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground/60">Ledigt</div>
                  ) : (
                    <ul className="space-y-1">
                      {dayEvents.map((e) => (
                        <li key={`${e.id}-${e.occurrence_start.toISOString()}`}
                          className="flex items-center gap-2 rounded-md border-l-[3px] bg-muted/30 px-2.5 py-1.5 text-sm"
                          style={{ borderLeftColor: e.calendar?.color ?? "#888" }}>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {e.all_day ? "heldag" : `${format(e.occurrence_start, "HH:mm")}–${format(e.occurrence_end, "HH:mm")}`}
                          </span>
                          <span className="truncate">{e.title}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{e.calendar?.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          {calendars.length === 0 && <p className="text-sm text-muted-foreground">Inga kalendrar än.</p>}
        </section>
      </div>

      <LogHoursDialog
        open={!!draft}
        onOpenChange={(o) => { if (!o) setDraft(null); }}
        defaultDate={draft?.date}
        defaultCalendarId={draft?.calendarId}
        defaultHours={draft ? Math.round(draft.scheduled * 100) / 100 : undefined}
      />
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
