import { useMemo, useState } from "react";
import { Bell, BellOff, CalendarClock, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { useEvents, type ExpandedEvent } from "@/hooks/use-calendar-data";
import { reminderTimes } from "@/hooks/use-reminders";
import { cn } from "@/lib/utils";

function dayLabel(d: Date) {
  if (isToday(d)) return "Idag";
  if (isTomorrow(d)) return "Imorgon";
  return format(d, "EEE d MMM");
}

export function UpcomingPanel({ onEdit }: { onEdit?: (ev: ExpandedEvent) => void }) {
  const now = new Date();
  const { data: events = [] } = useEvents(startOfDay(now), addDays(now, 7));
  // Dold från start; valet sparas så att användaren själv bestämmer.
  const [open, setOpen] = useState(() => localStorage.getItem("upcoming-panel-open") === "1");
  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem("upcoming-panel-open", v ? "0" : "1");
      return !v;
    });
  };

  const upcoming = useMemo(
    () => events.filter((e) => e.occurrence_end >= now).slice(0, 8),
    [events.map((e) => e.occurrence_start.getTime()).join(",")],
  );

  if (!upcoming.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 text-left hover:opacity-80"
      >
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Kommande 7 dagar</h2>
        {open
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
      <ul className="mt-3 divide-y divide-border/60">
        {upcoming.map((ev) => {
          const rs = reminderTimes(ev);
          const hasNotify = rs.some((r) => r.channel === "notify");
          const hasEmail = rs.some((r) => r.channel === "email");
          return (
            <li key={`${ev.id}-${ev.occurrence_start.getTime()}`}>
              <button
                type="button"
                onClick={() => onEdit?.(ev)}
                className="flex w-full items-center gap-3 py-2 text-left hover:opacity-80"
              >
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: ev.calendar?.color ?? "#6366f1" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{ev.title}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {dayLabel(ev.occurrence_start)} · {format(ev.occurrence_start, "HH:mm")}–{format(ev.occurrence_end, "HH:mm")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {hasEmail && <Mail className="h-3.5 w-3.5" />}
                  {hasNotify
                    ? <Bell className="h-3.5 w-3.5" />
                    : <BellOff className={cn("h-3.5 w-3.5", !hasEmail && "text-destructive/70")} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
