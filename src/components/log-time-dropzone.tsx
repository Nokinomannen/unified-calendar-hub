import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LogDraft } from "@/components/event-context-menu";

/**
 * Drop target that only appears while an event chip is being dragged.
 * Dropping an event opens the time-log dialog prefilled from the event.
 */
export function LogTimeDropZone({ onDrop }: { onDrop: (d: LogDraft) => void }) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setDragging(Boolean((e as CustomEvent).detail));
    window.addEventListener("one:event-drag", handler);
    return () => window.removeEventListener("one:event-drag", handler);
  }, []);

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            setDragging(false);
            const raw = e.dataTransfer.getData("application/x-one-event");
            if (!raw) return;
            try {
              const d = JSON.parse(raw) as LogDraft & { date: string };
              onDrop({ ...d, date: new Date(d.date) });
            } catch { /* ignore malformed payload */ }
          }}
          className={cn(
            "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border-2 border-dashed px-6 py-4 text-sm font-medium backdrop-blur-xl transition-colors md:bottom-10",
            over ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card/90 text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4" /> Drop here to log these hours
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
