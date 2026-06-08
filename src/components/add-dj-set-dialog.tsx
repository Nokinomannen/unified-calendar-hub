import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsertDjSet, useDeleteDjSet, type DjSet } from "@/hooks/use-dj-sets";
import { dateKey } from "@/hooks/use-overrides";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: DjSet | null;
};

export function AddDjSetDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertDjSet();
  const del = useDeleteDjSet();

  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.set_date);
      setVenue(editing.venue);
      setAmount(String(editing.amount_sek));
      setDuration(editing.duration_hours != null ? String(editing.duration_hours) : "");
      setNotes(editing.notes ?? "");
    } else {
      setDate(dateKey(new Date()));
      setVenue("");
      setAmount("");
      setDuration("");
      setNotes("");
    }
  }, [open, editing]);

  const handleSave = async () => {
    const amt = parseFloat(amount.replace(",", "."));
    if (!venue.trim()) return toast.error("Add a venue or name");
    if (isNaN(amt) || amt < 0) return toast.error("Enter an amount");
    const dur = duration ? parseFloat(duration.replace(",", ".")) : null;
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        set_date: date,
        venue: venue.trim(),
        amount_sek: amt,
        duration_hours: dur,
        notes: notes.trim() || null,
      });
      toast.success(editing ? "Set updated" : "Set added");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("Delete this DJ set?")) return;
    try {
      await del.mutateAsync(editing.id);
      toast.success("Deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit DJ set" : "Add DJ set"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (h)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Venue / name</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Trädgården" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (SEK)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="50"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {editing ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-conflict">
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
