import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCreateNotionTask, useUpdateNotionTask, type CategorizedTask } from "@/hooks/use-notion";
import { useSettings, notionDatabases } from "@/hooks/use-settings";
import type { NotionDbMeta } from "@/lib/notion.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export type TaskDialogState =
  | { mode: "create"; dbId?: string; status?: string | null }
  | { mode: "edit"; task: CategorizedTask };

export function NotionTaskDialog({
  state,
  databases,
  onOpenChange,
}: {
  state: TaskDialogState | null;
  databases: NotionDbMeta[];
  onOpenChange: (open: boolean) => void;
}) {
  const { settings } = useSettings();
  const configured = notionDatabases(settings);
  const create = useCreateNotionTask();
  const update = useUpdateNotionTask();

  const editing = state?.mode === "edit" ? state.task : null;
  const [dbId, setDbId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>(NONE);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<string>(NONE);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setDbId(state.task.dbId);
      setTitle(state.task.title);
      setStatus(state.task.status ?? NONE);
      setDue(state.task.due ? state.task.due.slice(0, 10) : "");
      setPriority(state.task.priority ?? NONE);
      setNotes(state.task.notes ?? "");
    } else {
      setDbId(state.dbId ?? configured[0]?.databaseId ?? databases[0]?.id ?? "");
      setTitle("");
      setStatus(state.status ?? NONE);
      setDue("");
      setPriority(NONE);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const meta = useMemo(() => databases.find((d) => d.id === dbId) ?? databases[0], [databases, dbId]);
  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!title.trim()) {
      toast.error("Titel krävs");
      return;
    }
    const fields = {
      title: title.trim(),
      status: status === NONE ? null : status,
      due: due || null,
      priority: priority === NONE ? null : priority,
      notes: notes.trim() || null,
    };
    const done = () => {
      toast.success(editing ? "Task uppdaterad i Notion" : "Task skapad i Notion");
      onOpenChange(false);
    };
    const fail = (e: unknown) => toast.error((e as Error).message);

    if (editing) update.mutate({ pageId: editing.id, dbId, fields }, { onSuccess: done, onError: fail });
    else create.mutate({ dbId, fields }, { onSuccess: done, onError: fail });
  };

  return (
    <Dialog open={!!state} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Redigera task" : "Ny task"}</DialogTitle>
          <DialogDescription>Sparas direkt i din Notion-databas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && databases.length > 1 && (
            <div className="space-y-1.5">
              <Label>Databas</Label>
              <Select value={dbId} onValueChange={setDbId}>
                <SelectTrigger><SelectValue placeholder="Välj databas" /></SelectTrigger>
                <SelectContent>
                  {databases.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(); }}
              placeholder="Vad ska göras?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!!meta?.statusOptions.length && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {meta.statusOptions.map((o) => (
                      <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {meta?.hasDue !== false && (
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Deadline</Label>
                <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            )}
          </div>

          {!!meta?.priorityOptions.length && (
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {meta.priorityOptions.map((o) => (
                    <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {meta?.hasNotes && (
            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Anteckning</Label>
              <Textarea id="task-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={submit} disabled={busy}>{editing ? "Spara" : "Skapa task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
