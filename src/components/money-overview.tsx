import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEvents } from "@/hooks/use-calendar-data";
import { useDjSets } from "@/hooks/use-dj-sets";
import { useOverrides } from "@/hooks/use-overrides";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TAX_RATE, SEK, pctChange, summarizePeriod,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

const TAX_KEY = "money-tax-rate";

/** Monthly money picture: earned so far, forecast, split per source, net estimate. */
export function MoneyOverview() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [taxRate, setTaxRate] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_TAX_RATE;
    const raw = Number(window.localStorage.getItem(TAX_KEY));
    return Number.isFinite(raw) && raw > 0 && raw < 0.8 ? raw : DEFAULT_TAX_RATE;
  });

  const start = startOfMonth(monthCursor);
  const end = endOfMonth(monthCursor);
  const prevStart = startOfMonth(subMonths(monthCursor, 1));
  const prevEnd = endOfMonth(subMonths(monthCursor, 1));

  // One query wide enough to cover both months.
  const { data: events = [] } = useEvents(prevStart, end);
  const { data: djSets = [] } = useDjSets();
  const { data: overrides = [] } = useOverrides();

  const skipped = useMemo(() => {
    const s = new Set<string>();
    for (const o of overrides) if (o.status === "skipped") s.add(`${o.event_id}|${o.occurrence_date}`);
    return s;
  }, [overrides]);

  const cur = useMemo(
    () => summarizePeriod({ events, djSets, start, end, skipped }),
    [events, djSets, start, end, skipped],
  );
  const prev = useMemo(
    () => summarizePeriod({ events, djSets, start: prevStart, end: prevEnd, skipped, now: new Date(8.64e15) }),
    [events, djSets, prevStart, prevEnd, skipped],
  );

  const change = pctChange(cur.projected, prev.projected);
  const net = cur.projected * (1 - taxRate);
  const share = cur.projected > 0 ? (v: number) => (v / cur.projected) * 100 : () => 0;

  function setTax(v: number) {
    setTaxRate(v);
    try { window.localStorage.setItem(TAX_KEY, String(v)); } catch { /* noop */ }
  }

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Månadens ekonomi</h2>
            <p className="text-[11px] text-muted-foreground">{format(monthCursor, "MMMM yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-7 w-7"
            onClick={() => setMonthCursor((m) => subMonths(m, 1))} aria-label="Föregående månad">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7"
            onClick={() => setMonthCursor(startOfMonth(new Date()))}>Nu</Button>
          <Button size="icon" variant="outline" className="h-7 w-7"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))} aria-label="Nästa månad">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Intjänat hittills" value={SEK(cur.earned)} hint={`${cur.hoursDone.toFixed(1)} h gjorda`} />
        <Stat label="Kvar i månaden" value={SEK(cur.forecast)} hint={`${cur.hoursLeft.toFixed(1)} h schemalagda`} />
        <Stat
          label="Prognos"
          value={SEK(cur.projected)}
          hint={
            change === null
              ? "ingen jämförelse"
              : `${change >= 0 ? "+" : ""}${change.toFixed(0)}% mot ${format(prevStart, "MMM")}`
          }
          trend={change === null ? undefined : change >= 0 ? "up" : "down"}
        />
        <Stat label={`Efter skatt (${Math.round(taxRate * 100)}%)`} value={SEK(net)} hint="uppskattning" />
      </div>

      <div className="mt-4 space-y-2">
        {cur.rows.length === 0 && cur.djEarned + cur.djForecast === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Inga pass eller gager den här månaden.</p>
        ) : (
          <>
            {cur.rows.map((r) => {
              const total = r.earningsDone + r.earningsLeft;
              return (
                <Row key={r.id} color={r.color} name={r.name} pct={share(total)}
                  primary={SEK(total)}
                  secondary={`${(r.hoursDone + r.hoursLeft).toFixed(1)} h${r.rate ? ` · ${r.rate} kr/h` : ""}`} />
              );
            })}
            {cur.djEarned + cur.djForecast > 0 && (
              <Row color="#7c5cff" name="DJ" pct={share(cur.djEarned + cur.djForecast)}
                primary={SEK(cur.djEarned + cur.djForecast)} secondary="gager" />
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
        <span className="text-[11px] text-muted-foreground">Skattesats</span>
        {[0.25, 0.3, 0.35].map((t) => (
          <button key={t} onClick={() => setTax(t)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] tabular-nums transition-colors",
              Math.abs(taxRate - t) < 0.001
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >{Math.round(t * 100)}%</button>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, hint, trend }: {
  label: string; value: string; hint?: string; trend?: "up" | "down";
}) {
  const Trend = trend === "down" ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          {trend && <Trend className={cn("h-3 w-3", trend === "up" ? "text-primary" : "text-muted-foreground")} />}
          {hint}
        </div>
      )}
    </div>
  );
}

function Row({ color, name, pct, primary, secondary }: {
  color: string; name: string; pct: number; primary: string; secondary: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-medium">{name}</span>
          <span className="shrink-0 text-xs tabular-nums">{primary}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{secondary}</div>
      </div>
    </div>
  );
}
