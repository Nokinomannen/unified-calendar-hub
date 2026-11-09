export const SLOT_MIN = 30;

/** Convert a y offset (px) into minutes since midnight, snapped down to a half hour within [startHour, endHour]. */
export function yToSlotMinutes(y: number, hourPx: number, startHour: number, endHour: number): number {
  const raw = startHour * 60 + (y / hourPx) * 60;
  const snapped = Math.floor(raw / SLOT_MIN) * SLOT_MIN;
  return Math.min(Math.max(snapped, startHour * 60), endHour * 60 - SLOT_MIN);
}

/** Range covered by dragging from slot a to slot b (either direction); always at least one slot. */
export function slotRange(a: number, b: number): { start: number; end: number } {
  return { start: Math.min(a, b), end: Math.max(a, b) + SLOT_MIN };
}
