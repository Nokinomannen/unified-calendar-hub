import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths,
  format, parseISO, isWithinInterval, eachWeekOfInterval, eachMonthOfInterval,
} from "date-fns";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useEvents, useCalendars } from "@/hooks/use-calendar-data";
import { useWorkLogs } from "@/hooks/use-work-logs";
import { useDjSets } from "@/hooks/use-dj-sets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MoneyOverview } from "@/components/money-overview";
import { ExportHoursDialog } from "@/components/export-hours";
import { TrendingUp, Clock, Wallet, Disc3, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Insights — hours, earnings & schedule stats" },
      { name: "description", content: "Charts of your registered hours, scheduled vs logged time and earnings across jobs and DJ sets." },
      { property: "og:title", content: "Insights — hours, earnings & schedule stats" },
      { property: "og:description", content: "Charts of your registered hours, scheduled vs logged time and earnings across jobs and DJ sets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

type Granularity = "week" | "month";

const fmtSek = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " SEK";

function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  const [gran, setGran] = useState<Granularity>("week");
  const [exportOpen, setExportOpen] = useState(false);

  const now = new Date();
  const range = useMemo(() => {
    if (gran === "week") {
      return { start: startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gran]);

  const { data: calendars = [] } = useCalendars();
  const { data: events = [] } = useEvents(range.start, range.end);
  const { data: logs = [] } = useWorkLogs();
  const { data: djSets = [] } = useDjSets();

  const buckets = useMemo(() => {
    const list = gran === "week"
      ? eachWeekOfInterval({ start: range.start, end: range.end }, { weekStartsOn: 1 })
      : eachMonthOfInterval({ start: range.start, end: range.end });
    return list.map((d) => ({
      key: gran === "week" ? format(d, "'w'I") : format(d, "MMM"),
      start: gran === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d),
      end: gran === "week" ? endOfWeek(d, { weekStartsOn: 1 }) : endOfMonth(d),
    }));
  }, [gran, range]);

  const jobCalendars = useMemo(() => calendars.filter((c) => c.source === "job"), [calendars]);

  // Scheduled hours per bucket, split per calendar + a scheduled/logged pair.
  const chartData = useMemo(() => {
    return buckets.map((b) => {
      const row: Record<string, number | string> = { name: b.key, Scheduled: 0, Logged: 0 };
      for (const c of jobCalendars) row[c.name] = 0;
      for (const e of events) {
        if (e.all_day || e.calendar?.source !== "job") continue;
        if (!isWithinInterval(e.occurrence_start, { start: b.start, end: b.end })) continue;
        const h = (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
        row.Scheduled = (row.Scheduled as number) + h;
        const name = e.calendar?.name ?? "Other";
        row[name] = ((row[name] as number) ?? 0) + h;
      }
      for (const l of logs) {
        const d = parseISO(l.work_date);
        if (!isWithinInterval(d, { start: b.start, end: b.end })) continue;
        row.Logged = (row.Logged as number) + Number(l.hours);
      }
      // Round for display
      for (const k of Object.keys(row)) {
        if (typeof row[k] === "number") row[k] = Math.round((row[k] as number) * 10) / 10;
      }
      return row;
    });
  }, [buckets, events, logs, jobCalendars]);

  const split = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    for (const e of events) {
      if (e.all_day || e.calendar?.source !== "job") continue;
      const h = (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
      const cur = map.get(e.calendar.id) ?? { name: e.calendar.name, value: 0, color: e.calendar.color };
      cur.value += h;
      map.set(e.calendar.id, cur);
    }
    const djHours = djSets
      .filter((s) => isWithinInterval(parseISO(s.set_date), range))
      .reduce((s, x) => s + Number(x.duration_hours ?? 0), 0);
    const rows = Array.from(map.values()).map((r) => ({ ...r, value: Math.round(r.value * 10) / 10 }));
    if (djHours > 0) rows.push({ name: "DJ Sets", value: Math.round(djHours * 10) / 10, color: "#a855f7" });
    return rows;
  }, [events, djSets, range]);

  const earnings = useMemo(() => {
    let acc = 0;
    return buckets.map((b) => {
      let sum = 0;
      for (const e of events) {
        if (e.all_day || e.calendar?.source !== "job") continue;
        if (!isWithinInterval(e.occurrence_start, { start: b.start, end: b.end })) continue;
        const rate = (e.calendar as { hourly_rate?: number | null }).hourly_rate ?? 0;
        sum += ((e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000) * rate;
      }
      for (const s of djSets) {
        if (!isWithinInterval(parseISO(s.set_date), { start: b.start, end: b.end })) continue;
        sum += Number(s.amount_sek);
      }
      acc += sum;
      return { name: b.key, Period: Math.round(sum), Cumulative: Math.round(acc) };
    });
  }, [buckets, events, djSets]);

  const totals = useMemo(() => {
    const scheduled = chartData.reduce((s, r) => s + (r.Scheduled as number), 0);
    const logged = chartData.reduce((s, r) => s + (r.Logged as number), 0);
    const money = earnings.at(-1)?.Cumulative ?? 0;
    const djCount = djSets.filter((s) => isWithinInterval(parseISO(s.set_date), range)).length;
    return { scheduled, logged, money, djCount };
  }, [chartData, earnings, djSets, range]);

  if (loading || !user) return null;

  const delta = totals.logged - totals.scheduled;
  const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11 };
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Insights</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {gran === "week" ? "Last 12 weeks" : "Last 12 months"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Fakturaunderlag
            </Button>
            <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5 backdrop-blur">
              {(["week", "month"] as Granularity[]).map((g) => (
                <button key={g} onClick={() => setGran(g)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all",
                    gran === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >{g === "week" ? "Weekly" : "Monthly"}</button>
              ))}
            </div>
          </div>
        </div>

        <MoneyOverview />
        <ExportHoursDialog open={exportOpen} onOpenChange={setExportOpen} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Clock} label="Scheduled" value={`${totals.scheduled.toFixed(1)}h`} />
          <Kpi icon={TrendingUp} label="Logged" value={`${totals.logged.toFixed(1)}h`}
            hint={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}h vs schedule`} />
          <Kpi icon={Wallet} label="Earnings" value={fmtSek(totals.money)} />
          <Kpi icon={Disc3} label="DJ sets" value={String(totals.djCount)} />
        </div>

        <Panel title="Hours per job" subtitle={gran === "week" ? "Stacked by calendar, per week" : "Stacked by calendar, per month"}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} {...axis} />
              <YAxis tickLine={false} axisLine={false} {...axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)", opacity: 0.25 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {jobCalendars.map((c) => (
                <Bar key={c.id} dataKey={c.name} stackId="hours" fill={c.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Scheduled vs logged" subtitle="What the calendar says versus what you registered">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} {...axis} />
                <YAxis tickLine={false} axisLine={false} {...axis} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)", opacity: 0.25 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Scheduled" fill="var(--color-muted-foreground)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Logged" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Split per source" subtitle="Share of hours in the period">
            {split.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={split} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
                    {split.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}h`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <Panel title="Earnings" subtitle="Per period and cumulative">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={earnings} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} {...axis} />
              <YAxis tickLine={false} axisLine={false} {...axis} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtSek(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Period" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cumulative" stroke="var(--color-chart-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </motion.div>
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
      <header className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-16 text-center text-xs text-muted-foreground">No hours in this period yet.</p>;
}
