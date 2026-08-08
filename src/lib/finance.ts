import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from "date-fns";
import type { ExpandedEvent, CalendarRow } from "@/hooks/use-calendar-data";
import type { DjSet } from "@/hooks/use-dj-sets";
import type { WorkLog } from "@/hooks/use-work-logs";

export const SEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " SEK";

/** Rough Swedish payroll tax withholding used for the net estimate. Adjustable in the UI. */
export const DEFAULT_TAX_RATE = 0.3;

export type SourceRow = {
  id: string;
  name: string;
  color: string;
  rate: number | null;
  /** Hours already in the past within the period. */
  hoursDone: number;
  /** Hours still ahead within the period. */
  hoursLeft: number;
  earningsDone: number;
  earningsLeft: number;
};

export type PeriodSummary = {
  rows: SourceRow[];
  hoursDone: number;
  hoursLeft: number;
  earned: number;
  forecast: number;
  /** earned + forecast */
  projected: number;
  djEarned: number;
  djForecast: number;
};

function hoursOf(e: ExpandedEvent) {
  return (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
}

/**
 * Aggregate job hours (from scheduled events) and DJ fees into a money picture
 * for one period, split into what already happened and what's still ahead.
 */
export function summarizePeriod(opts: {
  events: ExpandedEvent[];
  djSets: DjSet[];
  start: Date;
  end: Date;
  now?: Date;
  skipped?: Set<string>;
}): PeriodSummary {
  const { events, djSets, start, end } = opts;
  const now = opts.now ?? new Date();
  const skipped = opts.skipped ?? new Set<string>();
  const map = new Map<string, SourceRow>();

  for (const e of events) {
    if (e.all_day || e.calendar?.source !== "job") continue;
    if (!isWithinInterval(e.occurrence_start, { start, end })) continue;
    if (skipped.has(`${e.id}|${format(e.occurrence_start, "yyyy-MM-dd")}`)) continue;
    const cal = e.calendar;
    const rate = (cal as { hourly_rate?: number | null }).hourly_rate ?? null;
    const row = map.get(cal.id) ?? {
      id: cal.id, name: cal.name, color: cal.color, rate,
      hoursDone: 0, hoursLeft: 0, earningsDone: 0, earningsLeft: 0,
    };
    const h = hoursOf(e);
    const past = e.occurrence_end.getTime() <= now.getTime();
    if (past) { row.hoursDone += h; row.earningsDone += h * (rate ?? 0); }
    else { row.hoursLeft += h; row.earningsLeft += h * (rate ?? 0); }
    map.set(cal.id, row);
  }

  let djEarned = 0;
  let djForecast = 0;
  for (const s of djSets) {
    const d = parseISO(s.set_date);
    if (!isWithinInterval(d, { start, end })) continue;
    if (d.getTime() <= now.getTime()) djEarned += Number(s.amount_sek);
    else djForecast += Number(s.amount_sek);
  }

  const rows = Array.from(map.values()).sort(
    (a, b) => b.earningsDone + b.earningsLeft - (a.earningsDone + a.earningsLeft),
  );
  const hoursDone = rows.reduce((s, r) => s + r.hoursDone, 0);
  const hoursLeft = rows.reduce((s, r) => s + r.hoursLeft, 0);
  const earned = rows.reduce((s, r) => s + r.earningsDone, 0) + djEarned;
  const forecast = rows.reduce((s, r) => s + r.earningsLeft, 0) + djForecast;

  return { rows, hoursDone, hoursLeft, earned, forecast, projected: earned + forecast, djEarned, djForecast };
}

export function monthRange(d: Date) {
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

export function prevMonthRange(d: Date) {
  return monthRange(subMonths(d, 1));
}

/** Percentage change vs a previous value; null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------------ */
/* Invoice / export                                                    */
/* ------------------------------------------------------------------ */

export type ExportLine = {
  date: string;
  calendar: string;
  title: string;
  hours: number;
  rate: number | null;
  amount: number;
  kind: "scheduled" | "logged" | "dj";
};

/**
 * Build invoice lines for a period. Logged hours win over scheduled hours on
 * days where a manual work log exists, so nothing is double-counted.
 */
export function buildExportLines(opts: {
  events: ExpandedEvent[];
  logs: WorkLog[];
  djSets: DjSet[];
  calendars: CalendarRow[];
  start: Date;
  end: Date;
  calendarIds?: string[] | null;
  useLogged: boolean;
}): ExportLine[] {
  const { events, logs, djSets, calendars, start, end, useLogged } = opts;
  const wanted = opts.calendarIds && opts.calendarIds.length ? new Set(opts.calendarIds) : null;
  const lines: ExportLine[] = [];

  const loggedKeys = new Set<string>();
  if (useLogged) {
    for (const l of logs) {
      const d = parseISO(l.work_date);
      if (!isWithinInterval(d, { start, end })) continue;
      if (wanted && !wanted.has(l.calendar_id)) continue;
      const cal = calendars.find((c) => c.id === l.calendar_id);
      const rate = cal?.hourly_rate ?? null;
      loggedKeys.add(`${l.calendar_id}|${l.work_date}`);
      lines.push({
        date: l.work_date,
        calendar: cal?.name ?? "Unknown",
        title: l.note || "Logged hours",
        hours: Number(l.hours),
        rate: rate === null ? null : Number(rate),
        amount: Number(l.hours) * Number(rate ?? 0),
        kind: "logged",
      });
    }
  }

  for (const e of events) {
    if (e.all_day || e.calendar?.source !== "job") continue;
    if (!isWithinInterval(e.occurrence_start, { start, end })) continue;
    if (wanted && !wanted.has(e.calendar.id)) continue;
    const dk = format(e.occurrence_start, "yyyy-MM-dd");
    if (loggedKeys.has(`${e.calendar.id}|${dk}`)) continue;
    const rate = (e.calendar as { hourly_rate?: number | null }).hourly_rate ?? null;
    const h = hoursOf(e);
    lines.push({
      date: dk,
      calendar: e.calendar.name,
      title: e.title,
      hours: h,
      rate: rate === null ? null : Number(rate),
      amount: h * Number(rate ?? 0),
      kind: "scheduled",
    });
  }

  const djCal = calendars.find((c) => c.kind === "dj");
  if (!wanted || (djCal && wanted.has(djCal.id))) {
    for (const s of djSets) {
      const d = parseISO(s.set_date);
      if (!isWithinInterval(d, { start, end })) continue;
      lines.push({
        date: s.set_date,
        calendar: djCal?.name ?? "DJ",
        title: s.venue,
        hours: Number(s.duration_hours ?? 0),
        rate: null,
        amount: Number(s.amount_sek),
        kind: "dj",
      });
    }
  }

  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.calendar.localeCompare(b.calendar));
}

export function linesToCsv(lines: ExportLine[]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Calendar", "Description", "Hours", "Rate (SEK/h)", "Amount (SEK)", "Type"];
  const rows = lines.map((l) => [
    l.date, l.calendar, l.title, l.hours.toFixed(2), l.rate ?? "", Math.round(l.amount), l.kind,
  ]);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  rows.push(["", "", "TOTAL", totalHours.toFixed(2), "", Math.round(total), ""]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
