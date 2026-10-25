import { useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Download, Send, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { freeGaps } from "@/lib/day-gaps";
import { useDayFocus, useDayNote } from "@/hooks/use-day-focus";
import { pullFocusFromNotion, sendFocusToNotion, sendNoteToReflections, setNotionTodoChecked } from "@/lib/day-focus.functions";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function DaySummary({ date, timed, skipped }: { date: Date; timed: ExpandedEvent[]; skipped: Set<string> }) {
  const active = timed.filter((e) => !skipped.has(e.id));
  const hours = active.reduce((s, e) => s + (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000, 0);
  const d = (h: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h);
  const gaps = freeGaps(active.map((e) => ({ start: e.occurrence_start, end: e.occurrence_end })), d(8), d(20), 45);
  return (
    <section className="grid grid-cols-3 gap-2 py-3 text-center">
      <Stat label="Start" value={active[0] ? format(active[0].occurrence_start, "HH:mm") : "–"} />
      <Stat label="Slut" value={active.length ? format(active[active.length - 1].occurrence_end, "HH:mm") : "–"} />
      <Stat label="Bokat" value={`${hours.toFixed(1)}h`} />
      {gaps.length > 0 && (
        <div className="col-span-3 flex flex-wrap gap-1.5 pt-1">
          {gaps.slice(0, 4).map((g) => (
            <span key={g.start.toISOString()} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Ledigt {format(g.start, "HH:mm")}–{format(g.end, "HH:mm")}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DayFocus({ date }: { date: Date }) {
  const dk = ymd(date);
  const { items, add, update, remove, invalidate } = useDayFocus(dk);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const send = useServerFn(sendFocusToNotion);
  const pull = useServerFn(pullFocusFromNotion);
  const check = useServerFn(setNotionTodoChecked);

  const run = async (k: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(k);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Något gick fel"); }
    finally { setBusy(null); }
  };

  const open = items.filter((i) => !i.done && !i.id.startsWith("tmp-"));

  const moveOpen = (days: number) => {
    const ids = open.map((i) => i.id);
    const target = ymd(addDays(date, days));
    ids.forEach((id) => update.mutate({ id, patch: { focus_date: target } }));
    toast.success(days > 0 ? "Flyttat till imorgon" : "Flyttat till dagen innan", {
      action: { label: "Ångra", onClick: () => ids.forEach((id) => update.mutate({ id, patch: { focus_date: dk } })) },
    });
  };

  return (
    <section className="space-y-2 border-t border-border py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Dagens fokus</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" disabled={!!busy}
            onClick={() => run("pull", async () => { const r = await pull({ data: { date: dk } }); invalidate(); toast.success(r.added ? `${r.added} hämtade från Notion` : "Inget nytt i Notion"); })}>
            {busy === "pull" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Notion
          </Button>
          {open.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" title="Flytta ofärdigt till dagen innan"
                onClick={() => moveOpen(-1)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Igår
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" title="Flytta ofärdigt till imorgon"
                onClick={() => moveOpen(1)}>
                <ArrowRight className="h-3.5 w-3.5" /> Imorgon
              </Button>
            </>
          )}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (v) { add.mutate(v); setText(""); } }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Vad vill du få gjort? Enter för att lägga till" className="h-11 text-sm sm:h-9" />
      </form>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id} className="group flex min-h-11 items-center gap-2 rounded-md px-1 hover:bg-muted/50 sm:min-h-8">
            <Checkbox checked={i.done} className="h-5 w-5"
              onCheckedChange={(c) => {
                update.mutate({ id: i.id, patch: { done: !!c } });
                if (i.notion_block_id) check({ data: { blockId: i.notion_block_id, checked: !!c } }).catch(() => {});
              }} />
            <span className={cn("min-w-0 flex-1 text-sm", i.done && "text-muted-foreground line-through")}>{i.text}</span>
            {i.notion_block_id ? (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Finns i Notion"><Check className="h-3 w-3" /> Notion</span>
            ) : (
              <button title="Skicka till Work i Notion" disabled={!!busy || i.id.startsWith("tmp-")}
                onClick={() => run(i.id, async () => { await send({ data: { id: i.id } }); invalidate(); }, "Skickat till Notion")}
                className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:text-foreground sm:h-7 sm:w-7">
                {busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            )}
            <button title="Ta bort" onClick={() => remove.mutate(i.id)}
              className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:text-destructive sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DayNote({ date }: { date: Date }) {
  const dk = ymd(date);
  const { note, save, refresh } = useDayNote(dk);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const send = useServerFn(sendNoteToReflections);

  useEffect(() => {
    if (note && loadedFor.current !== dk) { setValue(note.content ?? ""); loadedFor.current = dk; }
  }, [note, dk]);

  useEffect(() => {
    if (loadedFor.current !== dk || value === (note?.content ?? "")) return;
    const t = setTimeout(() => save.mutate(value), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <section className="space-y-2 border-t border-border py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Anteckning</h3>
        <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs sm:h-7" disabled={sending || !value.trim()}
          onClick={async () => {
            setSending(true);
            try {
              await save.mutateAsync(value);
              await send({ data: { date: dk, title: format(date, "yyyy-MM-dd · EEEE"), content: value } });
              refresh();
              toast.success("Skickat till Reflektioner");
            } catch (e) { toast.error(e instanceof Error ? e.message : "Kunde inte skicka"); }
            finally { setSending(false); }
          }}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Reflektioner
        </Button>
      </div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tankar om dagen…" className="min-h-20 text-sm" />
      {note?.sent_to_notion_at && <p className="text-[10px] text-muted-foreground">Skickad till Notion {format(new Date(note.sent_to_notion_at), "d MMM HH:mm")}</p>}
    </section>
  );
}
