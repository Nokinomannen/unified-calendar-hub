import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { useToggleSkip, dateKey, type Override } from "@/hooks/use-overrides";
import { CheckCircle2, Circle, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LogHoursDialog } from "@/components/log-hours-dialog";

type Props = {
  date: Date | null;
  events: ExpandedEvent[];
  overrides: Override[];
  onClose: () => void;
  onEdit?: (e: ExpandedEvent) => void;
  onAdd?: (date: Date) => void;
};

const HOUR_PX = 44;
const START_HOUR = 7;
const END_HOUR = 23;

export function DayDrawer({ date, events, overrides, onClose, onEdit, onAdd }: Props) {
  const toggle = useToggleSkip();
  if (!date) return null;
  const dk = dateKey(date);
  const skipped = new Set(overrides.filter((o) => o.occurrence_date === dk && o.status === "skipped").map((o) => o.event_id));

  const timed = events.filter((e) => !e.all_day).sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
  const allDay = events.filter((e) => e.all_day);

  // Lay out timed events into columns to handle overlaps
  const cols = layoutColumns(timed);
  const colCount = Math.max(1, ...cols.map((c) => c.col + 1));

  const totalHours = timed
    .filter((e) => !skipped.has(e.id))
    .reduce((s, e) => s + (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000, 0);

  return (
    <Sheet open={!!date} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-5 py-4">
          <SheetTitle className="flex items-baseline justify-between">
            <span>{format(date, "EEEE d MMM")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {totalHours.toFixed(1)}h booked · {events.length} events
            </span>
          </SheetTitle>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Tip: click any event to edit.</p>
            {onAdd && (
              <Button size="sm" onClick={() => onAdd(date)} className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add event
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-5 pb-12">
          {allDay.length > 0 && (
            <div className="space-y-1.5 py-3">
              {allDay.map((e) => {
                const isSkip = skipped.has(e.id);
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border-l-[3px] bg-card px-2.5 py-1.5 text-sm",
                      isSkip && "opacity-50 line-through",
                    )}
                    style={{ borderLeftColor: e.calendar?.color ?? "#6366f1" }}
                  >
                    <button
                      onClick={(ev) => { ev.stopPropagation(); toggle.mutate({ eventId: e.id, date: dk, skip: !isSkip }); }}
                      title={isSkip ? "Mark as attending" : "Skip this occurrence"}
                    >
                      {isSkip ? <Circle className="h-4 w-4 text-muted-foreground" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                    <button onClick={() => onEdit?.(e)} className="flex-1 truncate text-left font-medium hover:underline">{e.title}</button>
                    <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">all-day</span>
                  </div>
                );
              })}
            </div>
          )}

          {timed.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No timed events.</div>
          ) : (
            <div className="relative mt-2" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX + 8 }}>
              {/* hour grid */}
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                const h = START_HOUR + i;
                return (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/50"
                    style={{ top: i * HOUR_PX }}
                  >
                    <span className="absolute -top-2 left-0 bg-background pr-1 text-[10px] tabular-nums text-muted-foreground">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                );
              })}
              {/* events */}
              {cols.map(({ event, col }) => {
                const startH = event.occurrence_start.getHours() + event.occurrence_start.getMinutes() / 60;
                const endH = event.occurrence_end.getHours() + event.occurrence_end.getMinutes() / 60;
                const top = (Math.max(startH, START_HOUR) - START_HOUR) * HOUR_PX;
                const height = Math.max(20, (Math.min(endH, END_HOUR) - Math.max(startH, START_HOUR)) * HOUR_PX);
                const widthPct = 100 / colCount;
                const isSkip = skipped.has(event.id);
                return (
                  <div
                    key={`${event.id}-${col}`}
                    onClick={() => onEdit?.(event)}
                    className={cn(
                      "absolute cursor-pointer overflow-hidden rounded-md border-l-[3px] bg-card/90 p-1.5 text-[11px] shadow-sm transition-opacity hover:bg-accent",
                      isSkip && "opacity-40",
                    )}
                    style={{
                      top,
                      height,
                      left: `calc(40px + ${col * widthPct}% - ${col * 40 / colCount}px)`,
                      width: `calc(${widthPct}% - 44px / ${colCount})`,
                      borderLeftColor: event.calendar?.color ?? "#6366f1",
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggle.mutate({ eventId: event.id, date: dk, skip: !isSkip }); }}
                        className="shrink-0"
                        title={isSkip ? "Attending" : "Skip this"}
                      >
                        {isSkip ? <Circle className="h-3 w-3 text-muted-foreground" /> : <CheckCircle2 className="h-3 w-3 text-primary" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate font-medium", isSkip && "line-through")}>{event.title}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {format(event.occurrence_start, "HH:mm")}–{format(event.occurrence_end, "HH:mm")}
                          {event.calendar && ` · ${event.calendar.name}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function layoutColumns(events: ExpandedEvent[]): { event: ExpandedEvent; col: number }[] {
  const out: { event: ExpandedEvent; col: number; end: number }[] = [];
  for (const e of events) {
    const start = e.occurrence_start.getTime();
    const end = e.occurrence_end.getTime();
    const used = new Set(out.filter((o) => o.end > start).map((o) => o.col));
    let col = 0;
    while (used.has(col)) col++;
    out.push({ event: e, col, end });
  }
  return out.map(({ event, col }) => ({ event, col }));
}
