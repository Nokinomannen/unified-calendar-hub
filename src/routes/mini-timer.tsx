import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Pause, Square, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCalendars } from "@/hooks/use-calendar-data";
import {
  useActiveTimer,
  useStartTimer,
  usePauseTimer,
  useResumeTimer,
  timerNetMs,
} from "@/hooks/use-timer";
import { formatElapsed, useNowTick } from "@/components/timer-widget";
import { StopTimerDialog } from "@/components/stop-timer-dialog";
import { cn } from "@/lib/utils";

/** Electron preload bridge; undefined in the browser. */
type OneDesktop = {
  isDesktop: true;
  timerState: (s: { running: boolean; paused: boolean; label: string; elapsed: string }) => void;
  closeMini: () => void;
  openMain: () => void;
};
const desktop = (): OneDesktop | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { oneDesktop?: OneDesktop }).oneDesktop;


export const Route = createFileRoute("/mini-timer")({
  ssr: false,
  component: MiniTimer,
  head: () => ({
    meta: [
      { title: "Mini timer — One calendar" },
      { name: "description", content: "Floating work timer for One: start, pause and save your hours." },
      { property: "og:title", content: "Mini timer — One calendar" },
      { property: "og:description", content: "Floating work timer for One: start, pause and save your hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MiniTimer() {
  const { user } = useAuth();
  const { data: calendars = [] } = useActiveCalendars();
  const jobs = calendars.filter((c) => c.source === "job");
  const { data: timer } = useActiveTimer();
  const start = useStartTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const [jobId, setJobId] = useState("");
  const [stoppedAt, setStoppedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!jobId && jobs.length) setJobId(jobs[0]!.id);
  }, [jobs, jobId]);

  const now = useNowTick(!!timer);
  const cal = timer ? calendars.find((c) => c.id === timer.calendar_id) : null;
  const paused = !!timer?.paused_at;
  const elapsed = timer ? formatElapsed(timerNetMs(timer, now)) : "";

  // Mirror the timer into the macOS menu bar.
  useEffect(() => {
    desktop()?.timerState({
      running: !!timer,
      paused,
      label: cal?.name ?? "Jobb",
      elapsed,
    });
  }, [timer, paused, cal?.name, elapsed]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4 text-center text-xs text-muted-foreground">
        Logga in i huvudfönstret först.
      </div>
    );
  }

  return (
    <div
      className="group flex h-screen select-none items-center gap-2 bg-background px-3 text-foreground"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex min-w-0 flex-1 flex-col" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>

        {timer ? (
          <>
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {cal?.name ?? "Jobb"}{paused ? " · pausad" : ""}
            </span>
            <span className={cn("font-mono text-lg leading-tight tabular-nums", paused && "text-muted-foreground")}>
              {formatElapsed(timerNetMs(timer, now))}
            </span>
          </>
        ) : (
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {jobs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {timer ? (
          <>
            <button
              onClick={() => (paused ? resume.mutate(timer) : pause.mutate(timer))}
              className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-accent"
              aria-label={paused ? "Fortsätt" : "Paus"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setStoppedAt(new Date())}
              className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Stoppa"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={async () => {
              if (!jobId) return;
              try {
                await start.mutateAsync({ calendar_id: jobId });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label="Starta"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
      </div>

      <StopTimerDialog
        timer={timer ?? null}
        calendarName={cal?.name ?? "Jobb"}
        stoppedAt={stoppedAt}
        onOpenChange={(o) => { if (!o) setStoppedAt(null); }}
      />
    </div>
  );
}
