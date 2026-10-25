export type Span = { start: Date; end: Date };

/** Free windows of at least `minMinutes` between dayStart and dayEnd, given busy spans. */
export function freeGaps(busy: Span[], dayStart: Date, dayEnd: Date, minMinutes = 30): Span[] {
  const sorted = [...busy]
    .map((s) => ({ start: new Date(Math.max(s.start.getTime(), dayStart.getTime())), end: new Date(Math.min(s.end.getTime(), dayEnd.getTime())) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: Span[] = [];
  let cursor = dayStart.getTime();
  for (const s of sorted) {
    if (s.start.getTime() - cursor >= minMinutes * 60_000) gaps.push({ start: new Date(cursor), end: s.start });
    cursor = Math.max(cursor, s.end.getTime());
  }
  if (dayEnd.getTime() - cursor >= minMinutes * 60_000) gaps.push({ start: new Date(cursor), end: dayEnd });
  return gaps;
}
