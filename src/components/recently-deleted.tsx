import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Undo2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RecentlyDeleted() {
  const qc = useQueryClient();
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["deleted-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, calendar:calendars(name, color)")
        .not("deleted_at", "is", null)
        .gte("deleted_at", since)
        .order("deleted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deleted-events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Restored");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Restore failed"),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Trash className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recently deleted</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Deleted events from the last 30 days. Everything is stored in Lovable Cloud — nothing is gone for good.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing deleted recently.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const cal = (r as { calendar?: { name: string; color: string } }).calendar;
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cal?.color ?? "#6366f1" }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {safeFormat(r.start_at)}
                    {cal && ` · ${cal.name}`}
                    {r.deleted_at && ` · deleted ${safeFormat(r.deleted_at)}`}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restore.mutate(r.id)} disabled={restore.isPending} className="h-8 gap-1">
                  <Undo2 className="h-3.5 w-3.5" /> Restore
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function safeFormat(s: string) {
  try { return format(new Date(s), "EEE d MMM HH:mm"); } catch { return s; }
}
