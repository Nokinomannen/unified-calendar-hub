import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendars, useCreateEvent } from "@/hooks/use-calendar-data";
import { toast } from "sonner";

const WEEKDAYS = [
  { v: "MO", l: "Mon" }, { v: "TU", l: "Tue" }, { v: "WE", l: "Wed" },
  { v: "TH", l: "Thu" }, { v: "FR", l: "Fri" }, { v: "SA", l: "Sat" }, { v: "SU", l: "Sun" },
];

function localDateTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${":"}${p(d.getMinutes())}`;
}

export function AddEventDialog({
  open, onOpenChange, defaultStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; defaultStart?: Date }) {
  const { data: calendars } = useCalendars();
  const create = useCreateEvent();
  const start0 = defaultStart ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000);
  const end0 = new Date(start0.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [calId, setCalId] = useState<string>("");
  const [start, setStart] = useState(localDateTimeValue(start0));
  const [end, setEnd] = useState(localDateTimeValue(end0));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "DAILY" | "WEEKLY">("none");
  const [byDays, setByDays] = useState<string[]>([]);
  const [until, setUntil] = useState("");
  const [reminder, setReminder] = useState<string>("30");

  const cal = calId || calendars?.[0]?.id || "";

  async function submit() {
    if (!title.trim() || !cal) {
      toast.error("Title and calendar required");
      return;
    }
    let rrule: string | null = null;
    if (repeat !== "none") {
      const parts = [`FREQ=${repeat}`];
      if (repeat === "WEEKLY" && byDays.length) parts.push(`BYDAY=${byDays.join(",")}`);
      if (until) {
        const u = new Date(until);
        const p = (n: number) => String(n).padStart(2, "0");
        parts.push(`UNTIL=${u.getUTCFullYear()}${p(u.getUTCMonth() + 1)}${p(u.getUTCDate())}T235959Z`);
      }
      rrule = parts.join(";");
    }
    try {
      await create.mutateAsync({
        title,
        calendar_id: cal,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        location: location || null,
        description: description || null,
        all_day: allDay,
        rrule,
        reminder_minutes: reminder ? parseInt(reminder) : null,
      });
      toast.success("Event added");
      onOpenChange(false);
      setTitle(""); setLocation(""); setDescription(""); setRepeat("none"); setByDays([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Math lecture, Tiger shift…" autoFocus />
          </div>
          <div>
            <Label>Calendar</Label>
            <Select value={cal} onValueChange={setCalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {calendars?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
          </label>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

          <div>
            <Label>Repeats</Label>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as "none" | "DAILY" | "WEEKLY")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Doesn't repeat</SelectItem>
                <SelectItem value="DAILY">Every day</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {repeat === "WEEKLY" && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => setByDays((b) => b.includes(d.v) ? b.filter((x) => x !== d.v) : [...b, d.v])}
                  className={`rounded-md border px-2.5 py-1 text-xs ${byDays.includes(d.v) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >{d.l}</button>
              ))}
            </div>
          )}
          {repeat !== "none" && (
            <div><Label>Until (optional)</Label><Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          )}
          <div>
            <Label>Remind me before (minutes)</Label>
            <Input type="number" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
