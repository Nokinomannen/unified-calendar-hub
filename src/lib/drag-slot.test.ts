import { describe, it, expect } from "vitest";
import { yToSlotMinutes, slotRange } from "./drag-slot";

describe("drag to create", () => {
  it("snaps to half hours", () => {
    expect(yToSlotMinutes(40 * 6 + 25, 40, 7, 23)).toBe(13 * 60 + 30);
  });
  it("clamps to 07:00 and last slot before 23:00", () => {
    expect(yToSlotMinutes(-50, 40, 7, 23)).toBe(7 * 60);
    expect(yToSlotMinutes(99999, 40, 7, 23)).toBe(22 * 60 + 30);
  });
  it("plain click gives 30 minutes, upward drag works", () => {
    expect(slotRange(600, 600)).toEqual({ start: 600, end: 630 });
    expect(slotRange(690, 600)).toEqual({ start: 600, end: 720 });
  });
});
