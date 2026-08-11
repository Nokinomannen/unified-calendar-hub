import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { NOTIFY_OPTIONS, EMAIL_OPTIONS } from "@/hooks/use-reminders";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendars, useCreateEvent, useUpdateEvent, useDeleteEvent, useEvents, type EventRow } from "@/hooks/use-calendar-data";
import { useFeeSuggestion, useUpsertDjSet } from "@/hooks/use-dj-sets";
import { findConflicts, formatDuration } from "@/lib/conflicts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";

const WEEKDAYS = [
  { v: "MO", l: "Mon" }, { v: "TU", l: "Tue" }, { v: "WE", l: "Wed" },
  { v: "TH", l: "Thu" }, { v: "FR", l: "Fri" }, { v: "SA", l: "Sat" }, { v: "SU", l: "Sun" },
];

async function djSetIdForEvent(eventId: string) {
  const { data } = await supabase.from("dj_sets").select("id").eq("event_id", eventId).maybeSingle();
  return data?.id;
}

function localDateTimeValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AddEventDialog({
  open, onOpenChange, defaultStart, event, occurrence,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultStart?: Date;
  event?: EventRow | null;
  /** The clicked occurrence of a recurring event, so edits can be scoped to it. */
  occurrence?: { start: Date; end: Date } | null;
}) {
  const { data: allCalendars = [] } = useCalendars();
  // Archived calendars aren't offered for new events, but stay selectable when editing an old one.
  const calendars = allCalendars.filter((c) => !c.archived || c.id === event?.calendar_id);

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
  const [reminder, setReminder] = useState<string>("default");
  const [emailRem, setEmailRem] = useState<string>("default");
  const [fee, setFee] = useState("");
  const upsertDj = useUpsertDjSet();

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
      
      setReminder(event.reminder_minutes === null ? "default" : event.reminder_minutes < 0 ? "off" : String(event.reminder_minutes));
      setEmailRem(event.email_reminder ?? "default");
    } else {
      const s0 = defaultStart ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000);
      const e0 = new Date(s0.getTime() + 60 * 60 * 1000);
      setTitle(""); setCalId(""); setStart(localDateTimeValue(s0)); setEnd(localDateTimeValue(e0));
      setLocation(""); setDescription(""); setAllDay(false); setRepeat("none"); setByDays([]); setUntil("");
      setReminder("default"); setEmailRem("default");
    }
  }, [open, event, defaultStart]);

  const cal = calId || calendars?.[0]?.id || "";
  const isDj = allCalendars.find((c) => c.id === cal)?.kind === "dj";
  const suggestedFee = useFeeSuggestion(isDj ? location : "");

  // Overlap detection against everything already in the calendar that day.
  const startDate = useMemo(() => new Date(start), [start]);
  const endDate = useMemo(() => new Date(end), [end]);
  const validRange = !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > startDate;
  const dayStart = useMemo(
    () => (validRange ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : new Date()),
    [validRange, startDate],
  );
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + 86_400_000), [dayStart]);
  const { data: dayEvents = [] } = useEvents(dayStart, dayEnd);
  const conflicts = useMemo(
    () => (open && validRange && !allDay ? findConflicts(dayEvents, startDate, endDate, event?.id ?? null) : []),
    [open, validRange, allDay, dayEvents, startDate, endDate, event?.id],
  );

  // Load the linked DJ set (fee) when editing an event in the DJ calendar.
  useEffect(() => {
    if (!open || !event) { setFee(""); return; }
    let cancelled = false;
    supabase.from("dj_sets").select("amount_sek").eq("event_id", event.id).maybeSingle().then(({ data }) => {
      if (!cancelled) setFee(data ? String(data.amount_sek) : "");
    });
    return () => { cancelled = true; };
  }, [open, event]);


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
        reminder_minutes: reminder === "default" ? null : reminder === "off" ? -1 : parseInt(reminder),
        email_reminder: emailRem === "default" ? null : emailRem,
      };
      let eventId = event?.id ?? null;
      if (editing && event) {
        await update.mutateAsync({ id: event.id, ...payload });
        toast.success("Event updated");
      } else {
        const created = await create.mutateAsync(payload);
        eventId = created.id;
        toast.success("Event added");
      }
      // DJ calendar events double as DJ sets, so keep the fee entry in sync.
      if (isDj && eventId) {
        const s = new Date(start);
        const e2 = new Date(end);
        const p = (n: number) => String(n).padStart(2, "0");
        await upsertDj.mutateAsync({
          event_id: eventId,
          id: await djSetIdForEvent(eventId),
          set_date: `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`,
          venue: location || title.replace(/^DJ · /, ""),
          amount_sek: fee ? Number(fee) : 0,
          duration_hours: Math.round(((e2.getTime() - s.getTime()) / 3600_000) * 100) / 100,
          notes: description || null,
        });
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
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Krockar med {conflicts.length} {conflicts.length === 1 ? "event" : "event"}
              </div>
              <ul className="mt-1.5 space-y-1">
                {conflicts.slice(0, 4).map((c) => (
                  <li key={`${c.event.id}-${c.event.occurrence_start.toISOString()}`}
                    className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: c.event.calendar?.color ?? "currentColor" }} />
                    <span className="truncate">{c.event.title}</span>
                    <span className="ml-auto shrink-0 tabular-nums">{formatDuration(c.overlapMinutes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
          </label>
          <div><Label>{isDj ? "Venue" : "Location"}</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          {isDj && (
            <div>
              <Label>Fee (SEK)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder={suggestedFee != null ? `Last time: ${suggestedFee}` : "e.g. 4000"}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Saved as a DJ set and counted in earnings.</p>
            </div>
          )}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Notis</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Kalenderns standard</SelectItem>
                  {NOTIFY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mejlpåminnelse</Label>
              <Select value={emailRem} onValueChange={setEmailRem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Kalenderns standard</SelectItem>
                  {EMAIL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
