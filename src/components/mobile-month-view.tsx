import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { CalendarPlus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { dateKey } from "@/hooks/use-overrides";
import { cn } from "@/lib/utils";

type Props = {
  cursor: Date;
  events: ExpandedEvent[];
  skippedSet: Set<string>;
  weekStartsOn: 0 | 1;
  onSelect: (date: Date) => void;
  onAdd: (date: Date) => void;
  onEdit: (event: ExpandedEvent) => void;
};

export function MobileMonthView({ cursor, events, skippedSet, weekStartsOn, onSelect, onAdd, onEdit }: Props) {
  const first = startOfWeek(startOfMonth(cursor), { weekStartsOn });
  const last = endOfWeek(endOfMonth(cursor), { weekStartsOn });
  const days: Date[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  const labels = weekStartsOn === 1 ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const dayEvents = new Map<string, ExpandedEvent[]>();
  for (const event of events) {
    const key = dateKey(event.occurrence_start);
    dayEvents.set(key, [...(dayEvents.get(key) ?? []), event]);
  }
  const selectedEvents = [...(dayEvents.get(dateKey(cursor)) ?? [])].sort((a, b) =>
    Number(b.all_day) - Number(a.all_day) || a.occurrence_start.getTime() - b.occurrence_start.getTime());

  return (
    <div data-testid="mobile-month" className="space-y-5">
      <section aria-label="Month dates" className="border-y border-border py-2">
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
          {labels.map((label, index) => <span key={index} className="py-2">{label}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1" role="group" aria-label="Choose a day">
          {days.map((day) => {
            const selected = isSameDay(day, cursor);
            const items = dayEvents.get(dateKey(day)) ?? [];
            const colors = [...new Set(items.map((event) => event.calendar?.color ?? "var(--primary)"))];
            return (
              <Button
                key={dateKey(day)}
                variant="ghost"
                aria-label={`${format(day, "EEEE d MMMM")}, ${items.length} events`}
                aria-pressed={selected}
                onClick={() => onSelect(day)}
                className={cn("h-12 min-w-0 flex-col gap-1 rounded-md px-0 py-1 font-normal", selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", !isSameMonth(day, cursor) && !selected && "text-muted-foreground/50")}
              >
                <span className={cn("grid h-6 place-items-center text-sm", isToday(day) && "font-bold", isToday(day) && !selected && "text-primary")}>{format(day, "d")}</span>
                <span className="flex h-1.5 items-center justify-center gap-1" aria-hidden="true">
                  {colors.slice(0, 3).map((color) => <span key={color} className={cn("h-1 w-1 rounded-full", selected && "bg-primary-foreground")} style={selected ? undefined : { backgroundColor: color }} />)}
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <section aria-label="Selected day events">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{format(cursor, "EEEE d MMM")}</h2>
            <p className="text-xs text-muted-foreground">{selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}</p>
          </div>
          <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" aria-label="Add event on selected day" onClick={() => { const date = new Date(cursor); date.setHours(9, 0, 0, 0); onAdd(date); }}>
            <CalendarPlus className="h-5 w-5" />
          </Button>
        </header>
        {selectedEvents.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center gap-2 border-t border-border text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />Nothing booked</div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {selectedEvents.map((event) => {
              const skipped = skippedSet.has(`${event.id}|${dateKey(cursor)}`);
              return (
                <Button key={`${event.id}-${event.occurrence_start.toISOString()}`} variant="ghost" onClick={() => onEdit(event)} className={cn("grid h-auto min-h-20 w-full grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-none px-1 py-3 text-left whitespace-normal", skipped && "opacity-45")}>
                  <span className="pt-0.5 text-xs font-normal tabular-nums text-muted-foreground">{event.all_day ? "All day" : format(event.occurrence_start, "HH:mm")}</span>
                  <span className="min-w-0">
                    <span className={cn("block break-words text-sm font-medium", skipped && "line-through")}>{event.title}</span>
                    <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.calendar?.color ?? "var(--primary)" }} />
                      <span className="truncate">{event.calendar?.name ?? "Calendar"}</span>
                      {!event.all_day && <span className="shrink-0">· {format(event.occurrence_end, "HH:mm")}</span>}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}