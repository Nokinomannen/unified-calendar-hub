import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, FAB } from "@/components/app-shell";
import { AddEventDialog } from "@/components/add-event-dialog";
import { useEvents } from "@/hooks/use-calendar-data";
import { format, isSameDay, startOfDay, endOfDay, addDays } from "date-fns";
import { MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/")({
  component: TodayPage,
});

function TodayPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [user, loading, router]);

  const today = new Date();
  const range = useMemo(() => ({ start: startOfDay(today), end: endOfDay(addDays(today, 7)) }), [today.toDateString()]);
  const { data: events = [] } = useEvents(range.start, range.end);

  const now = new Date();
  const todayEvents = events.filter((e) => isSameDay(e.occurrence_start, today));
  const upcoming = todayEvents.filter((e) => e.occurrence_end >= now);
  const next = upcoming[0];
  const upcomingDays = useMemo(() => {
    const groups: { date: Date; items: typeof events }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i);
      const items = events.filter((e) => isSameDay(e.occurrence_start, d));
      if (items.length) groups.push({ date: d, items });
    }
    return groups;
  }, [events]);

  if (loading || !user) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{format(today, "EEEE, d MMMM")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening"}
          </h1>
        </div>

        {next ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Next up</p>
            <h2 className="mt-1 text-2xl font-semibold">{next.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />
                {format(next.occurrence_start, "HH:mm")}–{format(next.occurrence_end, "HH:mm")}
              </span>
              {next.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{next.location}</span>}
              {next.calendar && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: next.calendar.color }} />
                  {next.calendar.name}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
            Nothing left today. Enjoy.
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Today</h3>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events.</p>
          ) : (
            <ul className="space-y-2">
              {todayEvents.map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />)}
            </ul>
          )}
        </section>

        {upcomingDays.map((g) => (
          <section key={g.date.toISOString()}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">{format(g.date, "EEEE d MMM")}</h3>
            <ul className="space-y-2">{g.items.map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />)}</ul>
          </section>
        ))}
      </div>

      <FAB onClick={() => setOpen(true)} />
      <AddEventDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function EventRow({ e }: { e: import("@/hooks/use-calendar-data").ExpandedEvent }) {
  return (
    <li className="flex items-stretch gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/30">
      <span className="w-1 rounded-full" style={{ background: e.calendar?.color ?? "var(--muted-foreground)" }} />
      <div className="flex-1">
        <div className="font-medium">{e.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {e.all_day ? "All day" : `${format(e.occurrence_start, "HH:mm")}–${format(e.occurrence_end, "HH:mm")}`}
          {e.location && <> · {e.location}</>}
          {e.calendar && <> · {e.calendar.name}</>}
        </div>
      </div>
    </li>
  );
}
