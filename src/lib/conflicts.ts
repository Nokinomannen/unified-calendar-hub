import type { ExpandedEvent } from "@/hooks/use-calendar-data";

export type Conflict = {
  event: ExpandedEvent;
  overlapMinutes: number;
};

/** Events on the same timeline that overlap [start, end), ignoring `excludeId`. */
export function findConflicts(
  events: ExpandedEvent[],
  start: Date,
  end: Date,
  excludeId?: string | null,
): Conflict[] {
  const s = start.getTime();
  const e = end.getTime();
  if (!(e > s)) return [];
  const out: Conflict[] = [];
  for (const ev of events) {
    if (excludeId && ev.id === excludeId) continue;
    if (ev.all_day) continue;
    const os = ev.occurrence_start.getTime();
    const oe = ev.occurrence_end.getTime();
    const overlap = Math.min(e, oe) - Math.max(s, os);
    if (overlap > 0) out.push({ event: ev, overlapMinutes: Math.round(overlap / 60_000) });
  }
  return out.sort((a, b) => b.overlapMinutes - a.overlapMinutes);
}

export type Gap = { start: Date; end: Date; minutes: number };

/** Free stretches between timed events on a single day, at least `minMinutes` long. */
export function findGaps(dayEvents: ExpandedEvent[], minMinutes = 60): Gap[] {
  const timed = dayEvents
    .filter((e) => !e.all_day)
    .slice()
    .sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
  const gaps: Gap[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    let cursorEnd = timed[i].occurrence_end.getTime();
    // Skip fully nested events.
    for (let k = 0; k <= i; k++) cursorEnd = Math.max(cursorEnd, timed[k].occurrence_end.getTime());
    const next = timed[i + 1].occurrence_start.getTime();
    const minutes = Math.round((next - cursorEnd) / 60_000);
    if (minutes >= minMinutes) {
      gaps.push({ start: new Date(cursorEnd), end: new Date(next), minutes });
    }
  }
  return gaps;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
