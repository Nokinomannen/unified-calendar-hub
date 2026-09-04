import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, RefreshCw, Unplug, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  listOutlookAccounts,
  claimOutlookConnections,
  syncOutlookAccount,
  disconnectOutlookAccount,
  syncIcsCalendar,
} from "@/lib/outlook.functions";
import { useCalendars } from "@/hooks/use-calendar-data";

/** Outlook accounts + ICS subscriptions management for the Sources page. */
export function OutlookSources() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOutlookAccounts);
  const claimFn = useServerFn(claimOutlookConnections);
  const syncFn = useServerFn(syncOutlookAccount);
  const disconnectFn = useServerFn(disconnectOutlookAccount);
  const syncIcsFn = useServerFn(syncIcsCalendar);

  const { data: accounts = [], refetch } = useQuery({
    queryKey: ["outlook-accounts"],
    queryFn: () => listFn(),
  });
  const { data: calendars = [] } = useCalendars();
  const icsCals = calendars.filter((c) => c.ics_url && !c.archived);

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (r) => {
      if (r.claimed.length) toast.success(`Kopplade: ${r.claimed.join(", ")}`);
      else if (!r.errors.length) toast.info("Inga nya kopplingar hittades ännu — koppla ett konto i chatten först");
      if (r.errors.length) toast.error(r.errors.join(" · "));
      refetch();
      qc.invalidateQueries({ queryKey: ["calendars"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (accountId: string) => syncFn({ data: { accountId } }),
    onSuccess: (r) => {
      toast.success(`Synkade ${r.synced} events${r.removed ? `, tog bort ${r.removed}` : ""}`);
      refetch();
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: (accountId: string) => disconnectFn({ data: { accountId } }),
    onSuccess: () => {
      toast.success("Kontot är bortkopplat");
      refetch();
      qc.invalidateQueries({ queryKey: ["calendars"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const syncIcs = useMutation({
    mutationFn: (calendarId: string) => syncIcsFn({ data: { calendarId } }),
    onSuccess: (r) => {
      toast.success(`Synkade ${r.synced} events${r.removed ? `, tog bort ${r.removed}` : ""}`);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Outlook-konton</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Kopplade Microsoft-konton synkas automatiskt var 15:e minut (30 dagar bakåt, 6 månader framåt).
        Events från Outlook är skrivskyddade här — ändra dem i Outlook.
      </p>

      {accounts.length > 0 && (
        <ul className="mb-4 space-y-2">
          {accounts.map((a) => {
            const cal = calendars.find((c) => c.id === a.calendar_id);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cal?.color ?? "#0f6cbd" }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.last_synced_at
                      ? `Synkad ${formatDistanceToNow(new Date(a.last_synced_at), { addSuffix: true })}`
                      : "Inte synkad ännu"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sync.isPending}
                  onClick={() => sync.mutate(a.id)}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
                  Synka nu
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    if (confirm(`Koppla bort ${a.email}? Dess events tas bort ur One.`)) disconnect.mutate(a.id);
                  }}
                >
                  <Unplug className="mr-1 h-3.5 w-3.5" /> Koppla bort
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => claim.mutate()} disabled={claim.isPending}>
          <Plus className="mr-1 h-4 w-4" />
          {claim.isPending ? "Letar…" : "Hitta kopplade konton"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Nya konton kopplas via mig i chatten (säg "koppla mitt Outlook") — tryck sen på knappen här.
        </p>
      </div>

      {/* ICS subscriptions */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-2 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kalenderlänkar (ICS)</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          För företagskonton utan inloggning: i Outlook på webben → Inställningar → Kalender →
          Delade kalendrar → <span className="text-foreground">Publicera en kalender</span> → kopiera
          ICS-länken och klistra in den här. Uppdateras varje timme.
        </p>
        {icsCals.length > 0 && (
          <ul className="mb-3 space-y-2">
            {icsCals.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <Button size="sm" variant="outline" disabled={syncIcs.isPending} onClick={() => syncIcs.mutate(c.id)}>
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncIcs.isPending ? "animate-spin" : ""}`} />
                  Synka nu
                </Button>
              </li>
            ))}
          </ul>
        )}
        <AddIcsForm onAdded={() => qc.invalidateQueries({ queryKey: ["calendars"] })} />
      </div>
    </section>
  );
}

function AddIcsForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const trimmed = url.trim();
    if (!name.trim() || !trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) { toast.error("Länken måste börja med http(s)://"); return; }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Inte inloggad");
      const { error } = await supabase.from("calendars").insert({
        user_id: uid,
        name: name.trim(),
        source: "ics",
        ics_url: trimmed,
        color: "#0e9f6e",
        kind: "other",
      });
      if (error) throw error;
      toast.success("Kalenderlänk tillagd — synkas automatiskt inom en timme");
      setName(""); setUrl("");
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte lägga till");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <div>
        <Label className="sr-only">Namn</Label>
        <Input placeholder="Namn, t.ex. Jobb-kalender" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label className="sr-only">ICS-länk</Label>
        <Input placeholder="https://…/calendar.ics" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <Button onClick={add} disabled={busy || !name.trim() || !url.trim()}>
        {busy ? "Lägger till…" : "Lägg till"}
      </Button>
    </div>
  );
}
