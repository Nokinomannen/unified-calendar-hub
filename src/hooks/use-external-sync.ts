import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { syncAllOutlook, syncAllIcs } from "@/lib/outlook.functions";

const OUTLOOK_INTERVAL = 30 * 60_000;
const ICS_INTERVAL = 60 * 60_000;

/**
 * Keeps externally sourced calendars fresh: syncs Outlook accounts on app
 * open and every 30 min, and ICS subscriptions hourly. Server-side throttling
 * (14 min) prevents redundant runs when multiple tabs are open.
 */
export function useExternalSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncOutlookFn = useServerFn(syncAllOutlook);
  const syncIcsFn = useServerFn(syncAllIcs);
  const lastIcs = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await syncOutlookFn();
        if (!stopped && r.some((x) => x.ok)) {
          qc.invalidateQueries({ queryKey: ["events"] });
          qc.invalidateQueries({ queryKey: ["outlook-accounts"] });
        }
        if (Date.now() - lastIcs.current > ICS_INTERVAL) {
          lastIcs.current = Date.now();
          const ir = await syncIcsFn();
          if (!stopped && ir.some((x) => x.ok)) qc.invalidateQueries({ queryKey: ["events"] });
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
  }, [user, syncOutlookFn, syncIcsFn, qc]);
}
