import { useMemo } from "react";
import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { dateKey, type Override } from "@/hooks/use-overrides";
import { cn } from "@/lib/utils";

const HOUR_PX = 40;
const START_HOUR = 7;
const END_HOUR = 23;

type Props = {
  weekStart: Date;
  events: ExpandedEvent[];
  overrides: Override[];
  onEdit: (e: ExpandedEvent) => void;
  onAdd: (when: Date) => void;
};

export function WeekView({ weekStart, events, overrides, onEdit, onAdd }: Props) {
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="grid min-w-[840px]" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="border-b border-border bg-muted/40" />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn(
            "border-b border-l border-border px-2 py-2 text-xs",
            isToday(d) && "bg-primary/10",
          )}>
            <div className="font-medium">{format(d, "EEE")}</div>
            <div className={cn("text-muted-foreground", isToday(d) && "font-semibold text-primary")}>{format(d, "d MMM")}</div>
          </div>
        ))}

        {/* timeline body */}
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-border/40 text-[9px] tabular-nums text-muted-foreground"
              style={{ top: i * HOUR_PX }}>
              <span className="absolute -top-2 right-1">{String(START_HOUR + i).padStart(2, "0")}</span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dk = dateKey(day);
          const dayEvents = events.filter((e) => !e.all_day && isSameDay(e.occurrence_start, day));
          const cols = layoutColumns(dayEvents);
          const colCount = Math.max(1, ...cols.map((c) => c.col + 1));
          // conflict detection
          const conflictIds = new Set<string>();
          for (let i = 0; i < dayEvents.length; i++)
            for (let j = i + 1; j < dayEvents.length; j++) {
              const a = dayEvents[i], b = dayEvents[j];
              if (a.occurrence_start < b.occurrence_end && b.occurrence_start < a.occurrence_end
                && !skipped.has(`${a.id}|${dk}`) && !skipped.has(`${b.id}|${dk}`)) {
                conflictIds.add(a.id); conflictIds.add(b.id);
              }
            }
          return (
            <div key={day.toISOString()} className="relative border-l border-border" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}
              onDoubleClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const y = e.clientY - r.top;
                const hour = START_HOUR + Math.floor(y / HOUR_PX);
                const at = new Date(day); at.setHours(hour, 0, 0, 0);
                onAdd(at);
              }}
            >
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-border/30" style={{ top: i * HOUR_PX }} />
              ))}
              {cols.map(({ event, col }) => {
                const sH = event.occurrence_start.getHours() + event.occurrence_start.getMinutes() / 60;
                const eH = event.occurrence_end.getHours() + event.occurrence_end.getMinutes() / 60;
                const top = (Math.max(sH, START_HOUR) - START_HOUR) * HOUR_PX;
                const height = Math.max(18, (Math.min(eH, END_HOUR) - Math.max(sH, START_HOUR)) * HOUR_PX);
                const isSkip = skipped.has(`${event.id}|${dk}`);
                const isConflict = conflictIds.has(event.id);
                const w = 100 / colCount;
                return (
                  <div key={`${event.id}-${col}`}
                    onClick={() => onEdit(event)}
                    className={cn(
                      "absolute cursor-pointer overflow-hidden rounded-sm border-l-[3px] bg-card/95 px-1 py-0.5 text-[10px] leading-tight shadow-sm hover:bg-accent",
                      isSkip && "opacity-40 line-through",
                      isConflict && "ring-1 ring-destructive/50",
                    )}
                    style={{
                      top, height,
                      left: `calc(${col * w}% + 1px)`,
                      width: `calc(${w}% - 2px)`,
                      borderLeftColor: event.calendar?.color ?? "#6366f1",
                    }}
                  >
                    <div className="truncate font-medium">{event.title}</div>
                    <div className="truncate text-[9px] text-muted-foreground tabular-nums">
                      {format(event.occurrence_start, "HH:mm")}–{format(event.occurrence_end, "HH:mm")}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function layoutColumns(events: ExpandedEvent[]): { event: ExpandedEvent; col: number }[] {
  const sorted = [...events].sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
  const out: { event: ExpandedEvent; col: number; end: number }[] = [];
  for (const e of sorted) {
    const start = e.occurrence_start.getTime();
    const end = e.occurrence_end.getTime();
    const used = new Set(out.filter((o) => o.end > start).map((o) => o.col));
    let col = 0;
    while (used.has(col)) col++;
    out.push({ event: e, col, end });
  }
  return out.map(({ event, col }) => ({ event, col }));
}
