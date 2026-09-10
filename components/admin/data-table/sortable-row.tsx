"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { flexRender, type Row } from "@tanstack/react-table";

import { TableCell, TableRow } from "@/components/admin/ui/table";
import { cn } from "@/lib/utils/cn";

/**
 * Drag-to-reorder, for collections that carry a manual order field.
 */

export function DragHandle({
  attributes,
  listeners,
  disabledReason,
}: {
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
  /** When set, dragging is off and this says why. */
  disabledReason?: string | null;
}) {
  const label = disabledReason ?? "Drag to reorder";

  return (
    <button
      type="button"
      /**
       * `aria-disabled`, NOT `disabled`. A `disabled` button leaves the tab order and
       * stops firing hover, so the title explaining WHY reordering is unavailable
       * could never be read — which is the only useful thing left to communicate.
       */
      aria-disabled={disabledReason ? true : undefined}
      title={label}
      aria-label={label}
      className={cn(
        "text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded",
        // So a drag on a touch screen moves the row rather than scrolling the page.
        "touch-none",
        disabledReason && "cursor-not-allowed opacity-40",
      )}
      {...(disabledReason ? {} : attributes)}
      {...(disabledReason ? {} : listeners)}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
}

export function SortableRow<TData>({
  row,
  id,
  disabledReason,
}: {
  row: Row<TData>;
  id: string;
  disabledReason?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: Boolean(disabledReason),
  });

  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging || undefined}
      style={{
        /**
         * Vertical only, and NO scale. dnd-kit scales the transform to fit the element
         * being swapped with, which on rows of differing height visibly stretches the
         * row mid-drag.
         */
        transform: CSS.Transform.toString(
          transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null,
        ),
        transition,
      }}
      /**
       * `relative` on EVERY row, not just the dragged one: the rows being displaced are
       * transformed too, and without a positioning context they paint underneath their
       * neighbours as they pass.
       */
      className={cn("relative", isDragging && "bg-muted/50 z-10")}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "py-2.5",
            cell.column.columnDef.meta?.numeric && "text-right tabular-nums",
          )}
        >
          {cell.column.id === "drag" ? (
            <DragHandle
              attributes={attributes as unknown as Record<string, unknown>}
              listeners={listeners as unknown as Record<string, unknown>}
              disabledReason={disabledReason}
            />
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}
