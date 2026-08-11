import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["calendars", "events", "event_overrides", "work_logs", "dj_sets", "user_settings"] as const;

/** Full backup of everything the app owns, as one JSON file you can keep locally. */
export function BackupExport() {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const backup: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        version: 1,
      };
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw error;
        backup[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `one-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup nedladdad");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button variant="outline" onClick={run} disabled={busy}>
        <Download className="mr-2 h-4 w-4" /> {busy ? "Exporterar…" : "Ladda ner backup (JSON)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Allt: kalendrar, event, undantag, arbetstimmar, DJ-spelningar och inställningar.
      </p>
    </div>
  );
}
