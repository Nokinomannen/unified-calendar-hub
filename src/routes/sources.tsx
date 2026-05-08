import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { useCalendars, useCreateEvent } from "@/hooks/use-calendar-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
});

type ParsedEvent = {
  title: string; start: string; end: string;
  location?: string; description?: string; all_day?: boolean;
  _picked?: boolean;
};

function SourcesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  const { data: calendars = [] } = useCalendars();
  const create = useCreateEvent();
  const [text, setText] = useState("");
  const [calId, setCalId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEvent[]>([]);
  const [importing, setImporting] = useState(false);

  const targetCal = calId || calendars[0]?.id || "";

  async function parseSchedule(payload: { text?: string; imageBase64?: string; imageMime?: string }) {
    setParsing(true); setParsed([]);
    try {
      const { data, error } = await supabase.functions.invoke("parse-schedule", {
        body: { ...payload, referenceDate: new Date().toISOString() },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const events = (data as { events: ParsedEvent[] }).events ?? [];
      setParsed(events.map((e) => ({ ...e, _picked: true })));
      toast.success(`Found ${events.length} events`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleImages(files: FileList) {
    setParsing(true); setParsed([]);
    const all: ParsedEvent[] = [];
    try {
      for (const file of Array.from(files)) {
        const b64: string = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.readAsDataURL(file);
        });
        const { data, error } = await supabase.functions.invoke("parse-schedule", {
          body: { imageBase64: b64, imageMime: file.type, referenceDate: new Date().toISOString() },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        const evs = (data as { events: ParsedEvent[] }).events ?? [];
        all.push(...evs);
        toast.success(`${file.name}: ${evs.length} events`);
      }
      setParsed(all.map((e) => ({ ...e, _picked: true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function importPicked() {
    if (!targetCal) { toast.error("Pick a calendar first"); return; }
    const picks = parsed.filter((p) => p._picked);
    if (!picks.length) return;
    setImporting(true);
    try {
      for (const p of picks) {
        await create.mutateAsync({
          title: p.title,
          calendar_id: targetCal,
          start_at: new Date(p.start).toISOString(),
          end_at: new Date(p.end).toISOString(),
          location: p.location || null,
          description: p.description || null,
          all_day: !!p.all_day,
        });
      }
      toast.success(`Imported ${picks.length} events`);
      setParsed([]); setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Sources</h1>
          <p className="text-sm text-muted-foreground">Your calendars and ways to pull events in.</p>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Your calendars</h2>
          <ul className="space-y-2">
            {calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <div className="flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{c.source}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Paste a schedule, AI sorts it</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Use Strawberry Browser (or just copy from Outlook / your shift email) and paste the text below.
            AI will turn it into events you can review before saving.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Save into calendar</Label>
              <Select value={targetCal} onValueChange={setCalId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {calendars.map((c) => (
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
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={`Examples:\n\nMon May 11 09:00-10:30 Math (room A201)\nTue May 12 13:00-15:00 Physics lab\n\n— or paste a Tiger of Sweden shift email —`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => parseSchedule({ text })} disabled={parsing || !text.trim()}>
                {parsing ? "Parsing…" : "Parse text with AI"}
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { const fs = e.target.files; if (fs && fs.length) handleImages(fs); e.target.value = ""; }}
                />
                📷 Upload screenshot(s)
              </label>
            </div>
          </div>

          {parsed.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium">Found {parsed.length} events</h3>
              <ul className="space-y-2">
                {parsed.map((p, i) => (
                  <li key={i} className={`flex items-start gap-3 rounded-lg border border-border p-3 ${p._picked ? "" : "opacity-50"}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!p._picked}
                      onChange={(e) => setParsed((arr) => arr.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {safeFormat(p.start)} → {safeFormat(p.end)}
                        {p.location && ` · ${p.location}`}
                      </div>
                    </div>
                    <button onClick={() => setParsed((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button onClick={importPicked} disabled={importing}>
                {importing ? "Importing…" : `Import ${parsed.filter((p) => p._picked).length} events`}
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <h2 className="mb-2 font-medium text-foreground">Coming next</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Microsoft OAuth sign-in for your second Outlook account</li>
            <li>ICS subscription URL (auto-refresh) — when your school exposes one</li>
            <li>Push reminders on your phone (after installing as PWA)</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function safeFormat(s: string) {
  try { return format(new Date(s), "EEE d MMM HH:mm"); } catch { return s; }
}
