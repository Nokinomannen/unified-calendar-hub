import { useEffect, useState } from "react";
import { Play, Square, Timer as TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCalendars } from "@/hooks/use-calendar-data";
import { useActiveTimer, useStartTimer } from "@/hooks/use-timer";
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

export function TimerWidget({ className }: { className?: string }) {
  const { data: calendars = [] } = useCalendars();
  const jobs = calendars.filter((c) => c.source === "job");
  const { data: timer } = useActiveTimer();
  const start = useStartTimer();
  const [jobId, setJobId] = useState<string>("");
  const [stoppedAt, setStoppedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!jobId && jobs.length) setJobId(jobs[0]!.id);
  }, [jobs, jobId]);

  const now = useNowTick(!!timer);
  const activeCal = timer ? calendars.find((c) => c.id === timer.calendar_id) : null;

  const handleStart = async () => {
    if (!jobId) return;
    try {
      await start.mutateAsync({ calendar_id: jobId });
      toast.success("Timer igång");
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
      {timer ? (
        <>
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full"
            style={{ background: activeCal?.color ?? "hsl(var(--primary))" }}
          />
          <span className="text-sm font-medium">{activeCal?.name ?? "Jobb"}</span>
          <span className="ml-auto font-mono text-sm tabular-nums">
            {formatElapsed(now - new Date(timer.started_at).getTime())}
          </span>
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
