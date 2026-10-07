"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  Settings2Icon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { MAX_SECTIONS, type SectionInstance } from "@/lib/page-builder/document";
import type { SectionPreset } from "@/lib/page-builder/presets";
import { sectionDefinition } from "@/lib/page-builder/registry";
import { cn } from "@/lib/utils/cn";

import { AddSectionDialog } from "./add-section-dialog";

/**
 * The page's sections, top to bottom, as the left-hand column of the builder.
 *
 * Every action has a keyboard route: rows are buttons, the grip is a dnd-kit
 * handle with the keyboard sensor (space to lift, arrows to move, space to drop),
 * and the ⋮ menu repeats Move up / Move down for anyone who would rather not drag
 * at all.
 */

export type SectionListHandlers = {
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
};

function Row({
  section,
  index,
  count,
  selected,
  incomplete,
  joined,
  handlers,
}: {
  section: SectionInstance;
  index: number;
  count: number;
  selected: boolean;
  incomplete: boolean;
  /** Drawn inside the page heading's band, directly above. */
  joined: boolean;
  handlers: SectionListHandlers;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const definition = sectionDefinition(section.type);
  const label = definition?.label ?? section.type;
  const summary = definition?.summary(section.settings as Record<string, unknown>) ?? "";

  return (
    <li
      ref={setNodeRef}
      style={{
        // Vertical only and unscaled — see the same note in featured-collections.tsx.
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null),
        transition,
      }}
      className={cn(
        "group bg-background relative flex items-center gap-1 rounded-md border px-1 py-1",
        selected && "border-primary ring-primary/20 ring-2",
        isDragging && "bg-muted/60 z-10",
        !section.visible && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        title="Drag to reorder"
        className="text-muted-foreground hover:text-foreground flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => handlers.onSelect(section.id)}
        aria-current={selected}
        className="min-w-0 flex-1 rounded px-1 py-1 text-left"
      >
        <span className="block truncate text-sm">{label}</span>
        {(summary || joined) && (
          <span className="text-muted-foreground block truncate text-xs">
            {joined ? "In the heading’s band" : summary}
          </span>
        )}
      </button>

      {incomplete && (
        <span title="Has required fields left empty" className="text-amber-600 dark:text-amber-500">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          <span className="sr-only">Needs content before publishing</span>
        </span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={section.visible ? `Hide ${label}` : `Show ${label}`}
        title={section.visible ? "Hide" : "Show"}
        onClick={() => handlers.onToggle(section.id)}
      >
        {section.visible ? <EyeIcon /> : <EyeOffIcon />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`More actions for ${label}`}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={index === 0} onSelect={() => handlers.onMove(index, index - 1)}>
            <ArrowUpIcon />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => handlers.onMove(index, index + 1)}>
            <ArrowDownIcon />
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem disabled={count >= MAX_SECTIONS} onSelect={() => handlers.onDuplicate(section.id)}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handlers.onRemove(section.id)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function SectionList({
  sections,
  selectedId,
  incompleteIds,
  handlers,
  onAdd,
  onOpenPageSettings,
}: {
  sections: SectionInstance[];
  selectedId: string | null;
  incompleteIds: Set<string>;
  handlers: SectionListHandlers;
  onAdd: (preset: SectionPreset) => void;
  onOpenPageSettings: () => void;
}) {
  // dnd-kit numbers its screen-reader ids from a module counter, which the server and the
  // browser count differently — a hydration mismatch on every drag handle. A stable id fixes it.
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.id === active.id);
    const to = sections.findIndex((section) => section.id === over.id);
    if (from >= 0 && to >= 0) handlers.onMove(from, to);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">Sections</h2>
        <span className="text-muted-foreground text-xs">{sections.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {sections.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
            This page is empty. Add a section to start.
          </p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {sections.map((section, index) => (
                  <Row
                    key={section.id}
                    section={section}
                    index={index}
                    count={sections.length}
                    selected={section.id === selectedId}
                    incomplete={incompleteIds.has(section.id)}
                    joined={
                      index > 0 &&
                      sections[index - 1]!.type === "page_heading" &&
                      (section.settings as { placement?: unknown }).placement === "heading"
                    }
                    handlers={handlers}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <AddSectionDialog onAdd={onAdd} disabled={sections.length >= MAX_SECTIONS} />
      </div>

      <div className="border-t p-2">
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={onOpenPageSettings}>
          <Settings2Icon />
          Page colours
        </Button>
      </div>
    </div>
  );
}
