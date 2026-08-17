import { useEffect, useState } from "react";
import { Play, Pause, Square, Timer as TimerIcon, PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useActiveCalendars } from "@/hooks/use-calendar-data";
import {
  useActiveTimer,
  useStartTimer,
  usePauseTimer,
  useResumeTimer,
  timerNetMs,
  timerPausedMs,
} from "@/hooks/use-timer";
import { StopTimerDialog } from "@/components/stop-timer-dialog";

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

export function useNowTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Electron preload bridge; undefined in the browser. */
type OneDesktopBridge = { toggleMini?: () => void; showMini?: () => void };
function useDesktopBridge() {
  const [bridge, setBridge] = useState<OneDesktopBridge | null>(null);
  useEffect(() => {
    setBridge((window as unknown as { oneDesktop?: OneDesktopBridge }).oneDesktop ?? null);
  }, []);
  return bridge;
}

export function TimerWidget({ className }: { className?: string }) {
  const desktop = useDesktopBridge();
  const { data: calendars = [] } = useActiveCalendars();
  const jobs = calendars.filter((c) => c.source === "job");
  const { data: timer } = useActiveTimer();
  const start = useStartTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const [jobId, setJobId] = useState<string>("");
  const [stoppedAt, setStoppedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!jobId && jobs.length) setJobId(jobs[0]!.id);
  }, [jobs, jobId]);

  const now = useNowTick(!!timer);
  const activeCal = timer ? calendars.find((c) => c.id === timer.calendar_id) : null;
  const paused = !!timer?.paused_at;
  const pausedMs = timer ? timerPausedMs(timer, now) : 0;

  const handleStart = async () => {
    if (!jobId) return;
    try {
      await start.mutateAsync({ calendar_id: jobId });
      toast.success("Timer igång");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const togglePause = async () => {
    if (!timer) return;
    try {
      if (paused) {
        await resume.mutateAsync(timer);
        toast.success("Timer fortsätter");
      } else {
        await pause.mutateAsync(timer);
        toast.success("Timer pausad");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2",
        className,
      )}
    >
      <TimerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {desktop && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => (desktop.toggleMini ?? desktop.showMini)?.()}
          title="Visa/dölj mini-timer (⌘⇧T)"
        >
          <PictureInPicture2 className="h-3.5 w-3.5" /> Mini-timer
        </Button>
      )}
      {timer ? (
        <>
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", !paused && "animate-pulse")}
            style={{ background: paused ? "hsl(var(--muted-foreground))" : activeCal?.color ?? "hsl(var(--primary))" }}
          />
          <span className="text-sm font-medium">{activeCal?.name ?? "Jobb"}</span>
          {pausedMs > 1000 && (
            <span className="text-[11px] text-muted-foreground">
              {paused ? "pausad · " : "paus "}
              {formatElapsed(pausedMs)}
            </span>
          )}
          <span className={cn("ml-auto font-mono text-sm tabular-nums", paused && "text-muted-foreground")}>
            {formatElapsed(timerNetMs(timer, now))}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={togglePause}
            disabled={pause.isPending || resume.isPending}
          >
            {paused ? <><Play className="h-3 w-3" /> Fortsätt</> : <><Pause className="h-3 w-3" /> Paus</>}
          </Button>
          <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={() => setStoppedAt(new Date())}>
            <Square className="h-3 w-3" /> Stoppa
          </Button>
        </>
      ) : (
        <>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          >
            {jobs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Registrera arbetstid live</span>
          <Button
            size="sm"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={handleStart}
            disabled={!jobId || start.isPending}
          >
            <Play className="h-3 w-3" /> Starta
          </Button>
        </>
      )}

      <StopTimerDialog
        timer={timer ?? null}
        calendarName={activeCal?.name ?? "Jobb"}
        stoppedAt={stoppedAt}
        onOpenChange={(o) => { if (!o) setStoppedAt(null); }}
      />
    </div>
  );
}
