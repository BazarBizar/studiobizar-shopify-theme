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
import { GripVerticalIcon, ImageIcon, Loader2Icon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/admin/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { updateEntryRequest } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * The Featured tab: one ordered list of collections, stored on the `site_settings`
 * singleton. Order is the point — the storefront renders them in this sequence — so it
 * is edited by dragging rather than by typing a number.
 */

type Option = { id: string; label: string; thumbnail: string | null };

function Row({
  option,
  onRemove,
}: {
  option: Option;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        // Vertical only and no scale: dnd-kit scales the transform to the element being
        // swapped with, which visibly stretches rows of differing height mid-drag.
        transform: CSS.Transform.toString(
          transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null,
        ),
        transition,
      }}
      // `relative` on EVERY row, not just the dragged one: displaced rows are transformed
      // too and would paint under their neighbours without a positioning context.
      className={cn(
        "bg-background relative flex items-center gap-3 rounded-md border px-2 py-2",
        isDragging && "bg-muted/50 z-10",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${option.label}`}
        title="Drag to reorder"
        className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 touch-none items-center justify-center rounded"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        {option.thumbnail ? (
          <Image
            src={option.thumbnail}
            alt=""
            width={36}
            height={36}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="text-muted-foreground size-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive size-7"
        aria-label={`Remove ${option.label}`}
        onClick={onRemove}
      >
        <XIcon className="size-3.5" />
      </Button>
    </li>
  );
}

export function FeaturedCollections({
  settingsId,
  selected,
  options,
}: {
  settingsId: string | null;
  selected: string[];
  options: Option[];
}) {
  const router = useRouter();
  const [order, setOrder] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const byId = React.useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const isDirty = JSON.stringify(order) !== JSON.stringify(selected);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((current) => {
      const from = current.indexOf(String(active.id));
      const to = current.indexOf(String(over.id));
      if (from === -1 || to === -1) return current;

      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  async function save() {
    if (!settingsId) return;
    setSaving(true);

    try {
      await updateEntryRequest({
        id: settingsId,
        fields: [{ key: "featured_collections", value: JSON.stringify(order) }],
      });

      toast.success("Saved", { description: `${order.length} featured collection(s).` });
      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "That change was not applied.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!settingsId) {
    return (
      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <p className="text-sm font-medium">Site settings not set up</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Run <code className="font-mono">node --env-file=.env scripts/add-site-settings.mjs</code>{" "}
            to create the settings singleton this tab writes to.
          </p>
        </CardContent>
      </Card>
    );
  }

  const available = options.filter((option) => !order.includes(option.id));

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-muted-foreground text-sm">
        These collections appear on the storefront, in this order.
      </p>

      {order.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {order.map((id) => (
                <Row
                  key={id}
                  option={byId.get(id) ?? { id, label: id, thumbnail: null }}
                  onRemove={() => setOrder((current) => current.filter((value) => value !== id))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
          Nothing featured yet.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={available.length === 0}>
              <PlusIcon className="size-3.5" />
              Add collection
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search collections" />
              <CommandList>
                <CommandEmpty>Nothing left to add.</CommandEmpty>
                <CommandGroup>
                  {available.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.label}
                      onSelect={() => {
                        setOrder((current) => [...current, option.id]);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-xs">
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>

        <div className="ms-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isDirty || saving}
            onClick={() => setOrder(selected)}
          >
            Discard
          </Button>
          <Button type="button" size="sm" disabled={!isDirty || saving} onClick={save}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
