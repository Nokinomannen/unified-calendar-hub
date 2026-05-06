import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, FAB } from "@/components/app-shell";
import { AddEventDialog } from "@/components/add-event-dialog";
import { useCalendars, useEvents, useUpdateCalendar } from "@/hooks/use-calendar-data";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  format, isSameMonth, isSameDay, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: calendars = [] } = useCalendars();
  const update = useUpdateCalendar();
  const { data: events = [] } = useEvents(gridStart, gridEnd);

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [gridStart, gridEnd]);

  const visible = events.filter((e) => e.calendar?.visible !== false);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{format(cursor, "MMMM yyyy")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const dayEvents = visible.filter((e) => isSameDay(e.occurrence_start, d));
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => { setDefaultStart(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0)); setOpen(true); }}
                  className={`group min-h-24 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/30 ${isSameMonth(d, cursor) ? "" : "bg-muted/20"}`}
                >
                  <div className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs ${isToday(d) ? "bg-primary text-primary-foreground" : isSameMonth(d, cursor) ? "text-foreground" : "text-muted-foreground"}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <div key={`${e.id}-${i}`} className="truncate rounded px-1 py-0.5 text-[11px] text-white" style={{ background: e.calendar?.color ?? "#6366f1" }}>
                        {!e.all_day && format(e.occurrence_start, "HH:mm ")}{e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <FAB onClick={() => { setDefaultStart(undefined); setOpen(true); }} />
      <AddEventDialog open={open} onOpenChange={setOpen} defaultStart={defaultStart} />
    </AppShell>
  );
}
