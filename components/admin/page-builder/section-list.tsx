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
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/admin/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { MAX_SECTIONS, type SectionInstance } from "@/lib/page-builder/document";
import { SECTION_CATEGORIES, SECTIONS, SECTION_TYPES, sectionDefinition, type SectionType } from "@/lib/page-builder/registry";
import { cn } from "@/lib/utils/cn";

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
  handlers,
}: {
  section: SectionInstance;
  index: number;
  count: number;
  selected: boolean;
  incomplete: boolean;
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
        {summary && <span className="text-muted-foreground block truncate text-xs">{summary}</span>}
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
  onAdd: (type: SectionType) => void;
  onOpenPageSettings: () => void;
}) {
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
                    handlers={handlers}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <AddSection onAdd={onAdd} disabled={sections.length >= MAX_SECTIONS} />
      </div>

      <div className="border-t p-2">
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={onOpenPageSettings}>
          <Settings2Icon />
          Page settings
        </Button>
      </div>
    </div>
  );
}

/**
 * The approved sections, grouped, each with one line saying what it is for — an
 * operator should be able to choose without having seen it before.
 */
function AddSection({ onAdd, disabled }: { onAdd: (type: SectionType) => void; disabled: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled}>
          <PlusIcon />
          Add section
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        <Command>
          <CommandInput placeholder="Search sections" />
          <CommandList className="max-h-[60svh]">
            <CommandEmpty>No section matches.</CommandEmpty>
            {SECTION_CATEGORIES.map((category) => {
              const types = SECTION_TYPES.filter((type) => SECTIONS[type].category === category);
              if (types.length === 0) return null;

              return (
                <CommandGroup key={category} heading={category}>
                  {types.map((type) => (
                    <CommandItem
                      key={type}
                      value={`${SECTIONS[type].label} ${SECTIONS[type].description}`}
                      onSelect={() => {
                        onAdd(type);
                        setOpen(false);
                      }}
                      className="flex-col items-start gap-0.5"
                    >
                      <span className="text-sm">{SECTIONS[type].label}</span>
                      <span className="text-muted-foreground text-xs">{SECTIONS[type].description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
