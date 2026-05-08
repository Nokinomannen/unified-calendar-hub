import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendars, useCreateEvent, useUpdateEvent, useDeleteEvent, type EventRow } from "@/hooks/use-calendar-data";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const WEEKDAYS = [
  { v: "MO", l: "Mon" }, { v: "TU", l: "Tue" }, { v: "WE", l: "Wed" },
  { v: "TH", l: "Thu" }, { v: "FR", l: "Fri" }, { v: "SA", l: "Sat" }, { v: "SU", l: "Sun" },
];

function localDateTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AddEventDialog({
  open, onOpenChange, defaultStart, event,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultStart?: Date;
  event?: EventRow | null;
}) {
  const { data: calendars } = useCalendars();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const editing = !!event;

  const [title, setTitle] = useState("");
  const [calId, setCalId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "DAILY" | "WEEKLY">("none");
  const [byDays, setByDays] = useState<string[]>([]);
  const [until, setUntil] = useState("");
  const [reminder, setReminder] = useState<string>("30");

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setCalId(event.calendar_id);
      setStart(localDateTimeValue(new Date(event.start_at)));
      setEnd(localDateTimeValue(new Date(event.end_at)));
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setAllDay(event.all_day);
      const r = event.rrule || "";
      setRepeat(r.includes("FREQ=WEEKLY") ? "WEEKLY" : r.includes("FREQ=DAILY") ? "DAILY" : "none");
      const m = r.match(/BYDAY=([^;]+)/);
      setByDays(m ? m[1].split(",") : []);
      setReminder(String(event.reminder_minutes ?? 30));
    } else {
      const s0 = defaultStart ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000);
      const e0 = new Date(s0.getTime() + 60 * 60 * 1000);
      setTitle(""); setCalId(""); setStart(localDateTimeValue(s0)); setEnd(localDateTimeValue(e0));
      setLocation(""); setDescription(""); setAllDay(false); setRepeat("none"); setByDays([]); setUntil(""); setReminder("30");
    }
  }, [open, event, defaultStart]);

  const cal = calId || calendars?.[0]?.id || "";

  async function submit() {
    if (!title.trim() || !cal) { toast.error("Title and calendar required"); return; }
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
      const payload = {
        title,
        calendar_id: cal,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        location: location || null,
        description: description || null,
        all_day: allDay,
        rrule,
        reminder_minutes: reminder ? parseInt(reminder) : null,
      };
      if (editing && event) {
        await update.mutateAsync({ id: event.id, ...payload });
        toast.success("Event updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Event added");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm(`Delete "${event.title}"?`)) return;
    try {
      await del.mutateAsync(event.id);
      toast.success("Deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Calendar (source)</Label>
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
                <button key={d.v} type="button"
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
        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) ? "Saving…" : (editing ? "Save changes" : "Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
