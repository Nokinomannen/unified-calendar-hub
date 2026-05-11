import { createContext, useContext, useEffect, useState, useCallback } from "react";

const MIN = 0.8;
const MAX = 1.4;
const STEP = 0.1;
const DEFAULT = 1;

type Ctx = {
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

const ZoomContext = createContext<Ctx | null>(null);

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, Math.round(v * 10) / 10));

function apply(z: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${z * 16}px`;
}

export function UiZoomProvider({ children }: { children: React.ReactNode }) {
  const [zoom, setZoomState] = useState<number>(DEFAULT);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ui-zoom") : null;
    const initial = stored ? clamp(parseFloat(stored)) : DEFAULT;
    setZoomState(initial);
    apply(initial);
  }, []);

  const setZoom = useCallback((z: number) => {
    const c = clamp(z);
    setZoomState(c);
    localStorage.setItem("ui-zoom", String(c));
    apply(c);
  }, []);

  const zoomIn = useCallback(() => setZoom(zoom + STEP), [zoom, setZoom]);
  const zoomOut = useCallback(() => setZoom(zoom - STEP), [zoom, setZoom]);
  const reset = useCallback(() => setZoom(DEFAULT), [setZoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, reset]);

  return (
    <ZoomContext.Provider value={{ zoom, setZoom, zoomIn, zoomOut, reset }}>{children}</ZoomContext.Provider>
  );
}

export function useUiZoom() {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error("useUiZoom must be used inside UiZoomProvider");
  return ctx;
}
