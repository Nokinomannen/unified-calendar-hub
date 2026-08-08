import { useState, cloneElement, isValidElement } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Clock, Pencil } from "lucide-react";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";
import { LogHoursDialog } from "@/components/log-hours-dialog";

export type LogDraft = { date: Date; calendarId?: string; hours: number; title: string };

export function eventToLogDraft(e: ExpandedEvent): LogDraft {
  const hours = (e.occurrence_end.getTime() - e.occurrence_start.getTime()) / 3600_000;
  return {
    date: e.occurrence_start,
    calendarId: e.calendar_id,
    hours: Math.round(hours * 4) / 4,
    title: e.title,
  };
}

/**
 * Wraps an event chip: right-click (or long-press) offers "Convert to logged
 * hours", and the chip is draggable onto the Log time drop zone.
 */
export function EventContextMenu({
  event,
  onEdit,
  onConvert,
  asChild,
  children,
}: {
  event: ExpandedEvent;
  onEdit?: (e: ExpandedEvent) => void;
  onConvert?: (d: LogDraft) => void;
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
}) {
  const dragProps = {
    draggable: true,
    onDragStart: (ev: React.DragEvent) => {
      ev.dataTransfer.effectAllowed = "copy";
      ev.dataTransfer.setData("application/x-one-event", JSON.stringify(eventToLogDraft(event)));
      window.dispatchEvent(new CustomEvent("one:event-drag", { detail: true }));
    },
    onDragEnd: () => window.dispatchEvent(new CustomEvent("one:event-drag", { detail: false })),
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {asChild && isValidElement(children)
          ? cloneElement(children as React.ReactElement<Record<string, unknown>>, dragProps)
          : <div {...dragProps}>{children}</div>}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate">{event.title}</ContextMenuLabel>
        <ContextMenuSeparator />
        {onEdit && (
          <ContextMenuItem onSelect={() => onEdit(event)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit event
          </ContextMenuItem>
        )}
        {onConvert && (
          <ContextMenuItem onSelect={() => onConvert(eventToLogDraft(event))}>
            <Clock className="mr-2 h-4 w-4" /> Convert to logged hours
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Controlled LogHoursDialog fed by a draft (from drag-drop or context menu). */
export function LogDraftDialog({ draft, onClose }: { draft: LogDraft | null; onClose: () => void }) {
  const [, force] = useState(0);
  void force;
  return (
    <LogHoursDialog
      open={!!draft}
      onOpenChange={(o) => { if (!o) onClose(); }}
      defaultDate={draft?.date}
      defaultCalendarId={draft?.calendarId}
      defaultHours={draft?.hours}
    />
  );
}
