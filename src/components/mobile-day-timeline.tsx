import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { slotRange, yToSlotMinutes } from "@/lib/drag-slot";
import { cn } from "@/lib/utils";

const HOUR_PX = 56;
const START_HOUR = 7;
const END_HOUR = 23;
const HOLD_MS = 450;
const MOVE_TOL = 8;

type Props = {
  date: Date;
  events: ExpandedEvent[];
  onEdit: (e: ExpandedEvent) => void;
  onAddRange: (start: Date, end: Date) => void;
};

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function MobileDayTimeline({ date, events, onEdit, onAddRange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const press = useRef<{ x: number; y: number; timer: number; id: number } | null>(null);

  // Block native scroll and swipe-navigation only while a drag is active.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (dragRef.current) { e.preventDefault(); e.stopPropagation(); }
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const minAt = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    return yToSlotMinutes(clientY - r.top, HOUR_PX, START_HOUR, END_HOUR);
  };
  const at = (m: number) => { const d = new Date(date); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
  const clear = () => { if (press.current) window.clearTimeout(press.current.timer); press.current = null; };

  const dayEvents = events.filter((e) => !e.all_day && isSameDay(e.occurrence_start, date));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div
        ref={ref}
        className="relative ml-12 select-none"
        style={{ height: (END_HOUR - START_HOUR) * HOUR_PX, WebkitTouchCallout: "none" }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-event]")) return;
          const { clientX, clientY, pointerId } = e;
          const target = e.currentTarget;
          const timer = window.setTimeout(() => {
            const m = minAt(clientY);
            try { target.setPointerCapture(pointerId); } catch { /* pointer gone */ }
            navigator.vibrate?.(10);
            setDrag({ a: m, b: m });
          }, HOLD_MS);
          press.current = { x: clientX, y: clientY, timer, id: pointerId };
        }}
        onPointerMove={(e) => {
          if (drag) {
            e.stopPropagation();
            const m = minAt(e.clientY);
            if (m !== drag.b) setDrag({ ...drag, b: m });
            return;
          }
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOL) clear();
        }}
        onPointerUp={(e) => {
          if (drag) {
            const { start, end } = slotRange(drag.a, drag.b);
            setDrag(null);
            onAddRange(at(start), at(end));
          } else if (press.current) {
            const m = minAt(e.clientY);
            clear();
            onAddRange(at(m), at(m + 30));
          }
        }}
        onPointerCancel={() => { clear(); setDrag(null); }}
      >
        {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-border/40" style={{ top: i * HOUR_PX }}>
            <span className="absolute -left-11 -top-2 w-9 text-right text-[11px] tabular-nums text-muted-foreground">
              {String(START_HOUR + i).padStart(2, "0")}:00
            </span>
          </div>
        ))}
        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 border-t border-dashed border-border/20" style={{ top: i * HOUR_PX + HOUR_PX / 2 }} />
        ))}
        {dayEvents.map((ev) => {
          const sH = ev.occurrence_start.getHours() + ev.occurrence_start.getMinutes() / 60;
          const eH = ev.occurrence_end.getHours() + ev.occurrence_end.getMinutes() / 60;
          const top = (Math.max(sH, START_HOUR) - START_HOUR) * HOUR_PX;
          const height = Math.max(24, (Math.min(eH, END_HOUR) - Math.max(sH, START_HOUR)) * HOUR_PX);
          return (
            <button
              key={`${ev.id}-${ev.occurrence_start.toISOString()}`}
              data-event
              type="button"
              onClick={() => onEdit(ev)}
              className="absolute left-1 right-1 overflow-hidden rounded-md border-l-4 bg-muted px-2 py-1 text-left text-xs shadow-sm"
              style={{ top, height, borderLeftColor: ev.calendar?.color ?? "hsl(var(--primary))" }}
            >
              <div className="truncate font-medium">{ev.title}</div>
              <div className="truncate text-[11px] tabular-nums text-muted-foreground">
                {format(ev.occurrence_start, "HH:mm")}–{format(ev.occurrence_end, "HH:mm")}
              </div>
            </button>
          );
        })}
        {drag && (() => {
          const { start, end } = slotRange(drag.a, drag.b);
          return (
            <div
              className={cn("pointer-events-none absolute left-1 right-1 z-10 rounded-md border-2 border-primary bg-primary/20 px-2 py-1 text-xs font-semibold tabular-nums text-primary")}
              style={{ top: (start / 60 - START_HOUR) * HOUR_PX, height: ((end - start) / 60) * HOUR_PX }}
            >
              {fmt(start)}–{fmt(end)}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
