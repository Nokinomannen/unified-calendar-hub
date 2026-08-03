import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSaveTimer, useCancelTimer, type ActiveTimer } from "@/hooks/use-timer";

type Props = {
  timer: ActiveTimer | null;
  calendarName: string;
  stoppedAt: Date | null;
  onOpenChange: (o: boolean) => void;
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function StopTimerDialog({ timer, calendarName, stoppedAt, onOpenChange }: Props) {
  const save = useSaveTimer();
  const cancel = useCancelTimer();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  const open = !!timer && !!stoppedAt;

  useEffect(() => {
    if (!open || !timer || !stoppedAt) return;
    setStart(toLocalInput(new Date(timer.started_at)));
    setEnd(toLocalInput(stoppedAt));
    setNote("");
  }, [open, timer?.id, stoppedAt?.getTime()]);

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const hours =
    startDate && endDate && endDate > startDate
      ? (endDate.getTime() - startDate.getTime()) / 3600_000
      : 0;

  const handleSave = async () => {
    if (!timer || !startDate || !endDate) return;
    if (endDate <= startDate) {
      toast.error("Sluttiden måste vara efter starttiden");
      return;
    }
    try {
      await save.mutateAsync({
        timer_id: timer.id,
        calendar_id: timer.calendar_id,
        title: `${calendarName} (timer)`,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        note: note || null,
      });
      toast.success(`Sparade ${hours.toFixed(2)}h på ${calendarName}`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDiscard = async () => {
    if (!timer) return;
    try {
      await cancel.mutateAsync(timer.id);
      toast.success("Passet kastades");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Spara arbetspass · {calendarName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slut</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notering (valfritt)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vad jobbade du med?" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Längd: <span className="font-medium tabular-nums text-foreground">{hours.toFixed(2)}h</span>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={handleDiscard} disabled={cancel.isPending}>Kasta</Button>
          <Button onClick={handleSave} disabled={save.isPending || hours <= 0}>Spara pass</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
