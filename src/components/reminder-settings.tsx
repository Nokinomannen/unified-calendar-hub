import { Bell, BellOff, Mail, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useUpdateCalendar, type CalendarRow } from "@/hooks/use-calendar-data";
import {
  EMAIL_OPTIONS, LOG_OPTIONS, NOTIFY_OPTIONS,
  useCalendarsForReminders, useNotificationPermission, useResetPendingForCalendar,
  type EmailReminder,
} from "@/hooks/use-reminders";

function CalendarReminderRow({ calendar }: { calendar: CalendarRow }) {
  const update = useUpdateCalendar();
  const reset = useResetPendingForCalendar();
  const isWork = calendar.kind === "job" || calendar.kind === "dj";

  const save = async (patch: Partial<CalendarRow>) => {
    try {
      await update.mutateAsync({ id: calendar.id, ...patch });
      await reset.mutateAsync(calendar.id);
      toast.success(`${calendar.name}: påminnelser uppdaterade`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara");
    }
  };

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
        <span className="text-sm font-medium">{calendar.name}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="h-3 w-3" /> Notis</span>
          <Select
            value={calendar.reminder_minutes === null ? "off" : String(calendar.reminder_minutes)}
            onValueChange={(v) => save({ reminder_minutes: v === "off" ? null : Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTIFY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> Mejl</span>
          <Select
            value={(calendar.email_reminder ?? "none") as EmailReminder}
            onValueChange={(v) => save({ email_reminder: v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMAIL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        {isWork && (
          <label className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="h-3 w-3" /> Logga timmar</span>
            <Select
              value={calendar.log_reminder_minutes === null ? "off" : String(calendar.log_reminder_minutes)}
              onValueChange={(v) => save({ log_reminder_minutes: v === "off" ? null : Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
    </div>
  );
}

export function ReminderSettings() {
  const { data: calendars = [] } = useCalendarsForReminders();
  const { permission, request } = useNotificationPermission();

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Påminnelser</h2>
      </div>

      <div
        className={
          "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs " +
          (permission === "granted" ? "border-border/60 text-muted-foreground" : "border-primary/40 bg-primary/5")
        }
      >
        <span className="flex items-center gap-2">
          {permission === "granted" ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {permission === "granted" && "Notiser är påslagna i den här webbläsaren."}
          {permission === "default" && "Notiser är inte påslagna än — slå på dem för att få påminnelser."}
          {permission === "denied" && "Notiser är blockerade. Tillåt dem i webbläsarens/systemets inställningar."}
          {permission === "unsupported" && "Den här webbläsaren stödjer inte notiser — använd mejlpåminnelser."}
        </span>
        {permission === "default" && (
          <Button size="sm" className="h-7 text-xs" onClick={request}>Slå på notiser</Button>
        )}
      </div>

      <div className="space-y-3">
        {calendars.map((c) => <CalendarReminderRow key={c.id} calendar={c} />)}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Notiser visas när appen är öppen (webb eller skrivbordsappen). Mejlpåminnelser skickas från servern
        och når dig även när datorn är avstängd.
      </p>
    </section>
  );
}
