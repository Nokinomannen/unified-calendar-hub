import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CornerDownLeft, Wand2 } from "lucide-react";
import { quickParse } from "@/lib/quick-parse";
import { useActiveCalendars, useCreateEvent } from "@/hooks/use-calendar-data";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const EXAMPLES = [
  "Lunch with team tomorrow at 12:00 for 1h",
  "Standup monday 14:30-15 @A-hub",
  "Gym 18/8 19:00 for 1.5h",
];

export function QuickAddBar() {
  const [text, setText] = useState("");
  const { data: calendars = [] } = useActiveCalendars();
  const create = useCreateEvent();
  const [placeholder] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);

  const parsed = useMemo(() => (text.trim().length > 2 ? quickParse(text) : null), [text]);

  const calendar = useMemo(() => {
    if (!parsed) return undefined;
    if (parsed.calendarHint) {
      const hint = parsed.calendarHint.toLowerCase();
      const hit = calendars.find((c) => c.name.toLowerCase().replace(/\s+/g, "-").includes(hint));
      if (hit) return hit;
    }
    return calendars.find((c) => c.source === "personal") ?? calendars[0];
  }, [parsed, calendars]);

  async function submit() {
    if (!parsed || !calendar) return;
    try {
      await create.mutateAsync({
        title: parsed.title,
        calendar_id: calendar.id,
        start_at: parsed.start.toISOString(),
        end_at: parsed.end.toISOString(),
        all_day: false,
      });
      toast.success(`Added “${parsed.title}”`, {
        description: `${format(parsed.start, "EEE d MMM · HH:mm")}–${format(parsed.end, "HH:mm")}`,
      });
      setText("");
    } catch (e) {
      toast.error("Could not create the event", { description: (e as Error).message });
    }
  }

  return (
    <div className="sticky top-[57px] z-20 -mx-1 px-1 py-1">
      <div className="rounded-xl border border-border bg-card/80 shadow-[var(--shadow-elegant)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void submit(); }
              if (e.key === "Escape") setText("");
            }}
            placeholder={placeholder}
            aria-label="Quick add event"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {text && (
            <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void submit()} disabled={create.isPending || !calendar}>
              <CornerDownLeft className="h-3 w-3" /> Add
            </Button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {parsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-border/60"
            >
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[11px]">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{parsed.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {format(parsed.start, "EEE d MMM")} · {format(parsed.start, "HH:mm")}–{format(parsed.end, "HH:mm")}
                </span>
                {calendar && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: calendar.color }} />
                    {calendar.name}
                  </span>
                )}
                {!parsed.confident && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                    <Wand2 className="h-3 w-3" /> guessing — add a day or time for a precise match
                  </span>
                )}
                <span className="ml-auto hidden text-muted-foreground/70 sm:inline">Enter to add · Esc to clear</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
