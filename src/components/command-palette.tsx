import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { addDays, format, subMonths, addMonths } from "date-fns";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useEvents } from "@/hooks/use-calendar-data";
import { useTheme } from "@/hooks/use-theme";
import { useActiveTimer, usePauseTimer, useResumeTimer } from "@/hooks/use-timer";
import {
  BarChart3, CalendarDays, Layers, Moon, Sun, Monitor, Play, Pause, CalendarClock,
} from "lucide-react";

/** Cmd/Ctrl+K palette: search events, jump to dates, switch pages and controls. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { setTheme } = useTheme();
  const { data: timer } = useActiveTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchRange = useMemo(() => {
    const now = new Date();
    return { start: subMonths(now, 6), end: addMonths(now, 12) };
  }, []);
  const { data: events = [] } = useEvents(searchRange.start, searchRange.end);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out = [];
    for (const e of events) {
      const hay = `${e.title} ${e.location ?? ""} ${e.calendar?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
      const key = `${e.id}|${format(e.occurrence_start, "yyyy-MM-dd")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= 12) break;
    }
    return out;
  }, [events, query]);

  function goDate(d: Date) {
    setOpen(false);
    router.navigate({ to: "/", search: { d: format(d, "yyyy-MM-dd") } });
  }
  function go(to: "/" | "/dashboard" | "/sources") {
    setOpen(false);
    router.navigate({ to });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Sök event, hoppa till datum, byt vy…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Inga träffar.</CommandEmpty>

        {matches.length > 0 && (
          <CommandGroup heading="Event">
            {matches.map((e) => (
              <CommandItem key={`${e.id}-${e.occurrence_start.toISOString()}`}
                value={`${e.title} ${format(e.occurrence_start, "yyyy-MM-dd")}`}
                onSelect={() => goDate(e.occurrence_start)}>
                <span className="mr-2 h-2 w-2 rounded-full" style={{ background: e.calendar?.color ?? "currentColor" }} />
                <span className="truncate">{e.title}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {format(e.occurrence_start, "d MMM HH:mm")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Gå till">
          <CommandItem onSelect={() => goDate(new Date())}>
            <CalendarClock className="mr-2 h-4 w-4" /> Idag
          </CommandItem>
          <CommandItem onSelect={() => goDate(addDays(new Date(), 1))}>
            <CalendarClock className="mr-2 h-4 w-4" /> Imorgon
          </CommandItem>
          <CommandItem onSelect={() => goDate(addDays(new Date(), 7))}>
            <CalendarClock className="mr-2 h-4 w-4" /> Om en vecka
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Sidor">
          <CommandItem onSelect={() => go("/")}><CalendarDays className="mr-2 h-4 w-4" /> Kalender</CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}><BarChart3 className="mr-2 h-4 w-4" /> Insights</CommandItem>
          <CommandItem onSelect={() => go("/sources")}><Layers className="mr-2 h-4 w-4" /> Källor</CommandItem>
        </CommandGroup>

        <CommandGroup heading="Åtgärder">
          {timer && (
            <CommandItem onSelect={() => { timer.paused_at ? resume.mutate(timer) : pause.mutate(timer); setOpen(false); }}>
              {timer.paused_at ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
              {timer.paused_at ? "Fortsätt timern" : "Pausa timern"}
            </CommandItem>
          )}
          <CommandItem onSelect={() => { setTheme("light"); setOpen(false); }}>
            <Sun className="mr-2 h-4 w-4" /> Ljust läge
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); setOpen(false); }}>
            <Moon className="mr-2 h-4 w-4" /> Mörkt läge
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); setOpen(false); }}>
            <Monitor className="mr-2 h-4 w-4" /> Systemläge
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
