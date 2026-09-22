import { cloneElement, isValidElement } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Pencil } from "lucide-react";
import type { ExpandedEvent } from "@/hooks/use-calendar-data";

/** Events mirrored from external systems can't be edited in One. */
const READONLY_SOURCES = new Set(["outlook", "ics"]);

/** Wraps an event chip with a right-click (or long-press) edit menu. */
export function EventContextMenu({
  event,
  onEdit,
  asChild,
  children,
}: {
  event: ExpandedEvent;
  onEdit?: (e: ExpandedEvent) => void;
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {asChild && isValidElement(children)
          ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {})
          : <div>{children}</div>}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate">{event.title}</ContextMenuLabel>
        <ContextMenuSeparator />
        {onEdit && !READONLY_SOURCES.has(event.calendar?.source ?? "") && (
          <ContextMenuItem onSelect={() => onEdit(event)}>
            <Pencil className="mr-2 h-4 w-4" /> Redigera event
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
