import { describe, it, expect } from "vitest";
import { freeGaps } from "./day-gaps";

const t = (h: number, m = 0) => new Date(2026, 9, 25, h, m);

describe("freeGaps", () => {
  it("finds windows between events and ignores short ones", () => {
    const gaps = freeGaps(
      [{ start: t(9), end: t(10, 30) }, { start: t(10, 45), end: t(11) }, { start: t(13), end: t(14) }],
      t(8), t(18),
    );
    expect(gaps.map((g) => [g.start.getHours(), g.end.getHours()])).toEqual([[8, 9], [11, 13], [14, 18]]);
  });
  it("merges overlapping events", () => {
    const gaps = freeGaps([{ start: t(9), end: t(12) }, { start: t(10), end: t(11) }], t(9), t(12));
    expect(gaps).toEqual([]);
  });
});
