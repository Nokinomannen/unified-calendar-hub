import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCalendars } from "@/hooks/use-calendar-data";
import { useUpsertWorkLog, useWorkLogs } from "@/hooks/use-work-logs";
import { dateKey } from "@/hooks/use-overrides";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: Date;
  defaultCalendarId?: string;
  defaultHours?: number;
};

export function LogHoursDialog({ open, onOpenChange, defaultDate, defaultCalendarId, defaultHours }: Props) {
  const { data: calendars = [] } = useCalendars();
  const { data: logs = [] } = useWorkLogs();
  const jobs = calendars.filter((c) => c.source === "job");
  const upsert = useUpsertWorkLog();

  const [calendarId, setCalendarId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const d = defaultDate ?? new Date();
    const dk = dateKey(d);
    const cid = defaultCalendarId ?? jobs[0]?.id ?? "";
    setCalendarId(cid);
    setDate(dk);
    const existing = logs.find((l) => l.calendar_id === cid && l.work_date === dk);
    setHours(existing ? String(existing.hours) : defaultHours ? String(defaultHours) : "");
    setNote(existing?.note ?? "");
  }, [open, defaultDate, defaultCalendarId, defaultHours]);

  // Refresh hours/note when user changes calendar or date in the dialog
  useEffect(() => {
    if (!open || !calendarId || !date) return;
    const existing = logs.find((l) => l.calendar_id === calendarId && l.work_date === date);
    if (existing) {
      setHours(String(existing.hours));
      setNote(existing.note ?? "");
    }
  }, [calendarId, date]);

  const handleSave = async () => {
    if (!calendarId || !date) return;
    const h = parseFloat(hours.replace(",", "."));
    if (isNaN(h) || h < 0 || h > 24) {
      toast.error("Enter hours between 0 and 24");
      return;
    }
    try {
      await upsert.mutateAsync({ calendar_id: calendarId, work_date: date, hours: h, note: note || null });
      toast.success(h === 0 ? "Log cleared" : `Logged ${h}h`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log actual hours</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Job</Label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {jobs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hours</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" />
          </div>
          {date && <p className="text-[11px] text-muted-foreground">Save 0 to clear this day's log.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
