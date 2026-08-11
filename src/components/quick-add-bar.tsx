import { useEffect, useMemo, useState } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CornerDownLeft, Wand2, AlertTriangle, MapPin } from "lucide-react";
import { quickParse } from "@/lib/quick-parse";
import { useActiveCalendars, useCreateEvent, useEvents } from "@/hooks/use-calendar-data";
import { useSettings } from "@/hooks/use-settings";
import { findConflicts } from "@/lib/conflicts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EXAMPLES = [
  "Lunch med teamet imorgon 12:00 för 1h",
  "Standup måndag 14:30-15 a-hub",
  "Gig 18/8 19:00 för 1.5h dj",
];

export function QuickAddBar() {
  const [text, setText] = useState("");
  const { data: calendars = [] } = useActiveCalendars();
  const { settings } = useSettings();
  const create = useCreateEvent();
  const [placeholder] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  const [override, setOverride] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      text.trim().length > 2
        ? quickParse(text, {
            calendars: calendars.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases })),
            defaultMinutes: settings.quickAddMinutes,
            roundTo: settings.quickAddRoundTo,
          })
        : null,
    [text, calendars, settings.quickAddMinutes, settings.quickAddRoundTo],
  );

  // A manual pick sticks until the line is cleared.
  useEffect(() => { if (!text.trim()) setOverride(null); }, [text]);

  const calendar = useMemo(() => {
    if (override) return calendars.find((c) => c.id === override);
    if (parsed?.calendarId) return calendars.find((c) => c.id === parsed.calendarId);
    if (settings.quickAddCalendarId) {
      const pref = calendars.find((c) => c.id === settings.quickAddCalendarId);
      if (pref) return pref;
    }
    return calendars.find((c) => c.kind === "other") ?? calendars[0];
  }, [override, parsed, calendars, settings.quickAddCalendarId]);

  // Conflict preview for the parsed day.
  const dayRange = useMemo(
    () => (parsed ? { start: startOfDay(parsed.start), end: endOfDay(parsed.start) } : null),
    [parsed],
  );
  const { data: dayEvents = [] } = useEvents(
    dayRange?.start ?? new Date(0),
    dayRange?.end ?? new Date(0),
  );
  const conflicts = useMemo(
    () => (parsed && !parsed.allDay && settings.showConflicts ? findConflicts(dayEvents, parsed.start, parsed.end) : []),
    [parsed, dayEvents, settings.showConflicts],
  );

  async function submit() {
    if (!parsed || !calendar) return;
    try {
      await create.mutateAsync({
        title: parsed.title,
        calendar_id: calendar.id,
        start_at: parsed.start.toISOString(),
        end_at: parsed.end.toISOString(),
        all_day: parsed.allDay,
        location: parsed.location,
      });
      toast.success(`La till “${parsed.title}” i ${calendar.name}`, {
        description: parsed.allDay
          ? format(parsed.start, "EEE d MMM")
          : `${format(parsed.start, "EEE d MMM · HH:mm")}–${format(parsed.end, "HH:mm")}`,
      });
      setText("");
      setOverride(null);
    } catch (e) {
      toast.error("Kunde inte skapa eventet", { description: (e as Error).message });
    }
  }

  function cycleCalendar(dir: 1 | -1) {
    if (!calendars.length) return;
    const i = Math.max(0, calendars.findIndex((c) => c.id === calendar?.id));
    const next = calendars[(i + dir + calendars.length) % calendars.length];
    setOverride(next.id);
  }

  if (!settings.showQuickAdd) return null;

  return (
    <div className="sticky top-[57px] z-20 -mx-1 px-1 py-1">
      <div className="rounded-xl border border-border bg-card/80 shadow-[var(--shadow-elegant)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <input
            id="quick-add-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void submit(); }
              if (e.key === "Escape") { setText(""); (e.target as HTMLInputElement).blur(); }
              if (e.key === "Tab" && text.trim()) { e.preventDefault(); cycleCalendar(e.shiftKey ? -1 : 1); }
            }}
            placeholder={placeholder}
            aria-label="Snabbinmatning"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {calendar && (
            <button
              type="button"
              onClick={() => cycleCalendar(1)}
              title="Byt kalender (Tab)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{ borderColor: calendar.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: calendar.color }} />
              <span className="max-w-[9ch] truncate">{calendar.name}</span>
            </button>
          )}
          {text && (
            <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void submit()} disabled={create.isPending || !calendar}>
              <CornerDownLeft className="h-3 w-3" /> Lägg till
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
                  {format(parsed.start, "EEE d MMM")}
                  {parsed.allDay ? " · heldag" : ` · ${format(parsed.start, "HH:mm")}–${format(parsed.end, "HH:mm")}`}
                </span>
                {parsed.location && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {parsed.location}
                  </span>
                )}
                {conflicts.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> krockar med {conflicts[0].event.title}
                  </span>
                )}
                {!parsed.confident && (
                  <span className={cn("inline-flex items-center gap-1 text-muted-foreground/80")}>
                    <Wand2 className="h-3 w-3" /> gissar — lägg till dag eller tid
                  </span>
                )}
                <span className="ml-auto hidden text-muted-foreground/70 sm:inline">Enter lägger till · Tab byter kalender · Esc rensar</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
