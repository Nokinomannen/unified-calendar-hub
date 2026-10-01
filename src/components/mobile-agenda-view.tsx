import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { CalendarPlus, Clock3 } from "lucide-react";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { dateKey, type Override } from "@/hooks/use-overrides";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AgendaProps = {
  date: Date;
  events: ExpandedEvent[];
  overrides: Override[];
  onEdit: (event: ExpandedEvent) => void;
  onAdd: (when: Date) => void;
  compact?: boolean;
};

function AgendaDay({ date, events, overrides, onEdit, onAdd, compact = false }: AgendaProps) {
  const skipped = new Set(
    overrides
      .filter((override) => override.occurrence_date === dateKey(date) && override.status === "skipped")
      .map((override) => override.event_id),
  );
  const sorted = [...events].sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());

  return (
    <section className={cn("rounded-lg border border-border bg-card", compact && "h-full")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{format(date, "EEEE d MMM")}</h2>
          <p className="text-xs text-muted-foreground">{events.length} {events.length === 1 ? "event" : "events"}</p>
        </div>
        <Button
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0"
          onClick={() => {
            const at = new Date(date);
            at.setHours(9, 0, 0, 0);
            onAdd(at);
          }}
          aria-label={`Add event on ${format(date, "d MMM")}`}
        >
          <CalendarPlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-2">
        {sorted.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <Clock3 className="h-5 w-5" />
            Nothing booked
          </div>
        ) : (
          <div className="space-y-1.5">
            {sorted.map((event) => {
              const isSkipped = skipped.has(event.id);
              return (
                <Button
                  key={`${event.id}-${event.occurrence_start.toISOString()}`}
                  variant="ghost"
                  className={cn(
                    "grid h-auto min-h-12 w-full grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 rounded-md border border-border/70 px-2.5 py-2 text-left",
                    isSkipped && "opacity-45",
                  )}
                  onClick={() => onEdit(event)}
                >
                  <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {event.all_day ? "All day" : format(event.occurrence_start, "HH:mm")}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm font-medium", isSkipped && "line-through")}>{event.title}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: event.calendar?.color ?? "var(--primary)" }} />
                      <span className="truncate">{event.calendar?.name ?? "Calendar"}</span>
                      {!event.all_day && <span className="shrink-0">· {format(event.occurrence_end, "HH:mm")}</span>}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function MobileDayView(props: AgendaProps) {
  return <AgendaDay {...props} />;
}

export function MobileWeekView({
  weekStart,
  events,
  overrides,
  onEdit,
  onAdd,
  weekStartsOn = 1,
}: {
  weekStart: Date;
  events: ExpandedEvent[];
  overrides: Override[];
  onEdit: (event: ExpandedEvent) => void;
  onAdd: (when: Date) => void;
  weekStartsOn?: 0 | 1;
}) {
  const first = startOfWeek(weekStart, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-3">
        {days.map((day) => (
          <div key={day.toISOString()} className="w-[85vw] max-w-[340px] shrink-0 snap-start">
            <AgendaDay
              date={day}
              events={events.filter((event) => isSameDay(event.occurrence_start, day))}
              overrides={overrides}
              onEdit={onEdit}
              onAdd={onAdd}
              compact
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Swipe to see the rest of the week</p>
    </div>
  );
}