import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { syncAllOutlook } from "@/lib/outlook.functions";

const OUTLOOK_INTERVAL = 30 * 60_000;

/**
 * Keeps Outlook accounts fresh: syncs on app open and every 30 min, but only
 * while the tab is visible. ICS subscriptions are no longer polled on a timer
 * (they can be synced manually from Sources) to avoid pointless background work.
 */
export function useExternalSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncOutlookFn = useServerFn(syncAllOutlook);
  const busy = useRef(false);

  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const run = async () => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try {
        const r = await syncOutlookFn();
        if (!stopped && r.some((x) => x.ok)) {
          qc.invalidateQueries({ queryKey: ["events"] });
          qc.invalidateQueries({ queryKey: ["outlook-accounts"] });
        }
      } catch {
        // Sync failures are non-fatal; next interval retries.
      } finally {
        busy.current = false;
      }
    };

    const initial = window.setTimeout(run, 3000);
    const interval = window.setInterval(run, OUTLOOK_INTERVAL);
    return () => {
      stopped = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [user, syncOutlookFn, qc]);
}
