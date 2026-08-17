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
  toggleMini?: () => void;
  showMini?: () => void;
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

  const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  const titleBar = (
    <div className="flex items-center justify-between gap-2 px-3 pt-2" style={drag}>
      <span className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {timer ? `${cal?.name ?? "Jobb"}${paused ? " · pausad" : ""}` : "One timer"}
      </span>
      <div className="flex items-center gap-1" style={noDrag}>
        <button
          onClick={() => desktop()?.openMain()}
          className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Öppna kalendern"
        >
          <CalendarDays className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => desktop()?.closeMini()}
          className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dölj mini-timern"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="flex h-screen select-none flex-col bg-background text-foreground" style={drag}>
        {titleBar}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Du är inte inloggad.</p>
          <button
            onClick={() => desktop()?.openMain()}
            style={noDrag}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Öppna kalendern och logga in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen select-none flex-col bg-background text-foreground" style={drag}>
      {titleBar}

      <div className="flex flex-1 items-center gap-3 px-3 pb-3 pt-1">
        <div className="min-w-0 flex-1" style={noDrag}>
          {timer ? (
            <span
              className={cn(
                "block font-mono text-[26px] leading-none tabular-nums",
                paused && "text-muted-foreground",
              )}
            >
              {formatElapsed(timerNetMs(timer, now))}
            </span>
          ) : (
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              {jobs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5" style={noDrag}>
          {timer ? (
            <>
              <button
                onClick={() => (paused ? resume.mutate(timer) : pause.mutate(timer))}
                className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
                aria-label={paused ? "Fortsätt" : "Paus"}
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setStoppedAt(new Date())}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
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
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Starta"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
        </div>
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
