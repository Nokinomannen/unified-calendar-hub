import { useEffect, useRef, type RefObject } from "react";

/** Horizontal swipe (touch) and horizontal trackpad / Shift+wheel scroll to move prev/next. */
export function useSwipeNav(ref: RefObject<HTMLElement | null>, onPrev: () => void, onNext: () => void, enabled = true) {
  const cb = useRef({ onPrev, onNext });
  cb.current = { onPrev, onNext };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sx = 0, sy = 0, t0 = 0, tracking = false;
    let acc = 0, lock = 0, resetTimer: ReturnType<typeof setTimeout> | undefined;

    const scrollableX = (target: EventTarget | null) => {
      let n = target as HTMLElement | null;
      while (n && n !== el) {
        if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const blocked = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable=true], [role=dialog]");

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || blocked(e.target) || scrollableX(e.target)) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now();
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 800) {
        if (dx < 0) cb.current.onNext(); else cb.current.onPrev();
      }
    };
    const onWheel = (e: WheelEvent) => {
      const dx = e.shiftKey && Math.abs(e.deltaX) < 1 ? e.deltaY : e.deltaX;
      if (Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return;
      if (blocked(e.target) || scrollableX(e.target)) return;
      e.preventDefault();
      if (Date.now() < lock) return;
      acc += dx;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { acc = 0; }, 200);
      if (Math.abs(acc) > 80) {
        if (acc > 0) cb.current.onNext(); else cb.current.onPrev();
        acc = 0; lock = Date.now() + 600;
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("wheel", onWheel);
      clearTimeout(resetTimer);
    };
  }, [ref, enabled]);
}
