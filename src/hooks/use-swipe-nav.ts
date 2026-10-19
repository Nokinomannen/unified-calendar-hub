import { useCallback, useEffect, useRef, type RefObject } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const OUT_MS = 180;
const IN_MS = 260;

/**
 * Smooth horizontal swipe navigation. The element follows the finger / trackpad live
 * (transform set directly, no React renders per frame), then slides out and the new
 * period slides in. Returns `go(dir)` so buttons get the same animation.
 */
export function useSwipeNav(
  ref: RefObject<HTMLElement | null>,
  onPrev: () => void,
  onNext: () => void,
  enabled = true,
) {
  const cb = useRef({ onPrev, onNext });
  cb.current = { onPrev, onNext };
  const busy = useRef(false);

  const reduced = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const setX = (el: HTMLElement, x: number, ms = 0, opacity = 1) => {
    el.style.transition = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : "none";
    el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
    el.style.opacity = opacity === 1 ? "" : String(opacity);
  };

  // dir: 1 = next (content moves left), -1 = prev
  const go = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    const nav = () => (dir === 1 ? cb.current.onNext() : cb.current.onPrev());
    if (!el || reduced()) { if (el) setX(el, 0); nav(); return; }
    if (busy.current) return;
    busy.current = true;
    const dist = Math.min(el.clientWidth * 0.35, 260);
    setX(el, -dir * dist, OUT_MS, 0);
    setTimeout(() => {
      nav();
      requestAnimationFrame(() => {
        setX(el, dir * dist, 0, 0);
        void el.offsetWidth;
        requestAnimationFrame(() => {
          setX(el, 0, IN_MS, 1);
          setTimeout(() => { el.style.transition = ""; el.style.willChange = ""; busy.current = false; }, IN_MS);
        });
      });
    }, OUT_MS);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    el.style.willChange = "transform";

    let sx = 0, sy = 0, t0 = 0, dx = 0, axis: "x" | "y" | null = null, tracking = false;
    let raf = 0;
    const paint = (x: number) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setX(el, x)); };

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
      if (busy.current || e.touches.length !== 1 || blocked(e.target) || scrollableX(e.target)) { tracking = false; return; }
      tracking = true; axis = null; dx = 0;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = performance.now();
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
      if (!axis) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (axis === "y") { tracking = false; return; }
      }
      e.preventDefault();
      dx = mx;
      paint(dx);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      cancelAnimationFrame(raf);
      if (axis !== "x") return;
      const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (Math.abs(dx) > el.clientWidth * 0.25 || (v > 0.4 && Math.abs(dx) > 20)) go(dx < 0 ? 1 : -1);
      else setX(el, 0, 220);
    };

    // Trackpad / Shift+wheel
    let acc = 0, gestureLocked = false, idle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      const wx = e.shiftKey && Math.abs(e.deltaX) < 1 ? e.deltaY : e.deltaX;
      if (Math.abs(wx) <= Math.abs(e.deltaY) && !e.shiftKey) return;
      if (blocked(e.target) || scrollableX(e.target)) return;
      e.preventDefault();
      clearTimeout(idle);
      if (busy.current || gestureLocked) {
        // swallow trailing momentum: unlock only after a pause in wheel events
        gestureLocked = true;
        idle = setTimeout(() => { gestureLocked = false; }, 220);
        return;
      }
      acc += wx;
      if (Math.abs(acc) > 110) {
        const dir: 1 | -1 = acc > 0 ? 1 : -1;
        acc = 0; gestureLocked = true;
        idle = setTimeout(() => { gestureLocked = false; }, 220);
        cancelAnimationFrame(raf);
        go(dir);
        return;
      }
      paint(-acc * 0.6);
      idle = setTimeout(() => { acc = 0; cancelAnimationFrame(raf); setX(el, 0, 220); }, 140);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      clearTimeout(idle);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled, go]);

  return go;
}
