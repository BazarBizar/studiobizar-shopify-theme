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
import { CornerDownRightIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DestinationPicker } from "@/components/admin/destination-picker";
import { SaveBar } from "@/components/admin/save-bar";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import type { DestinationOption, Menu, MenuItemNode } from "@/lib/admin/menus";
import { updateMenuRequest, type MenuItemPayload } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

/**
 * The menu editor.
 *
 * TWO LEVELS, matching what the storefront renders — the header's secondary nav
 * opens one level of dropdown and the mobile drawer does the same.
 *
 * Dragging reorders WITHIN a level, not between them. Moving an item to a
 * different parent is add-and-remove, which costs two clicks in a case that
 * comes up rarely; supporting it properly means a cross-container drag tree, and
 * that is a lot of machinery for a five-item nav. Each list is its own
 * `DndContext` for the same reason.
 *
 * `menuUpdate` REPLACES the tree, so every save sends the whole thing. That is
 * also why there is no per-item save: a half-sent tree is a deleted tree.
 */

const DERIVED = new Set(["FRONTPAGE", "CATALOG", "COLLECTIONS", "SEARCH"]);

type Draft = {
  /** Local, stable across renders. Not Shopify's id — a new item has none. */
  key: string;
  id?: string;
  title: string;
  /** Encoded destination, e.g. `PAGE:gid://shopify/Page/1`. */
  destination: string;
  url: string;
  children: Draft[];
};

let counter = 0;
const nextKey = () => `draft-${(counter += 1)}`;

function toDraft(item: MenuItemNode): Draft {
  return {
    key: nextKey(),
    id: item.id,
    title: item.title,
    destination: item.resourceId ? `${item.type}:${item.resourceId}` : item.type,
    url: item.url ?? "",
    children: item.items.map(toDraft),
  };
}

function blankDraft(): Draft {
  return { key: nextKey(), title: "New link", destination: "FRONTPAGE", url: "", children: [] };
}

function parse(destination: string): { type: string; resourceId: string | null } {
  const at = destination.indexOf(":");
  // A gid contains colons; split on the first one only.
  if (at === -1) return { type: destination, resourceId: null };
  return { type: destination.slice(0, at), resourceId: destination.slice(at + 1) };
}

/* -------------------------------------------------------------------------- */

/**
 * Where a menu link goes — the panel's shared `DestinationPicker`, the same list
 * the page builder's buttons use.
 *
 * An item can point at something this picker does not offer — a blog, a
 * customer-account page, a page deleted since. Rather than silently resetting it
 * to Home, the current value is offered as its own choice so the item keeps its
 * destination through an unrelated edit.
 */
function DestinationSelect({
  value,
  options,
  onChange,
  id,
}: {
  value: string;
  options: DestinationOption[];
  onChange: (value: string) => void;
  id: string;
}) {
  const known = options.some((option) => option.value === value);
  const all = known ? options : [{ value, label: "The link it has now (kept as is)", group: "Current" }, ...options];
  return <DestinationPicker id={id} value={value} options={all} onChange={onChange} />;
}

function Row({
  draft,
  options,
  depth,
  onChange,
  onRemove,
  onAddChild,
}: {
  draft: Draft;
  options: DestinationOption[];
  depth: 0 | 1;
  onChange: (next: Draft) => void;
  onRemove: () => void;
  onAddChild?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.key,
  });

  const isHttp = draft.destination === "HTTP";

  return (
    <li
      ref={setNodeRef}
      style={{
        // Vertical only and no scale: dnd-kit scales the transform to the element
        // being swapped with, which visibly stretches rows of differing height.
        transform: CSS.Transform.toString(
          transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null,
        ),
        transition,
      }}
      // `relative` on EVERY row: displaced rows are transformed too and would
      // paint under their neighbours without a positioning context.
      className={cn(
        "bg-background relative rounded-md border",
        isDragging && "bg-muted/50 z-10",
      )}
    >
      <div className="flex items-end gap-3 p-2">
        <button
          type="button"
          aria-label={`Reorder ${draft.title}`}
          title="Drag to reorder"
          className="text-muted-foreground hover:text-foreground mb-1.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>

        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${draft.key}-title`} className="text-muted-foreground text-xs font-normal">
              Text people see
            </Label>
            <Input
              id={`${draft.key}-title`}
              value={draft.title}
              placeholder="e.g. Our Story"
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${draft.key}-destination`} className="text-muted-foreground text-xs font-normal">
              Opens
            </Label>
            <DestinationSelect
              id={`${draft.key}-destination`}
              value={draft.destination}
              options={options}
              onChange={(destination) => onChange({ ...draft, destination })}
            />
          </div>

          {isHttp && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${draft.key}-url`} className="text-muted-foreground text-xs font-normal">
                Web address
              </Label>
              <Input
                id={`${draft.key}-url`}
                value={draft.url}
                placeholder="e.g. https://www.instagram.com/studiobizar"
                onChange={(event) => onChange({ ...draft, url: event.target.value })}
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onAddChild && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAddChild}
              aria-label={`Add a dropdown link under ${draft.title}`}
              title="Add a link that opens from this one"
            >
              <CornerDownRightIcon className="size-4" />
              Sub-link
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${draft.title}`}
            title="Remove"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>

      {depth === 0 && draft.children.length > 0 && (
        <div className="border-t px-2 py-2 pl-10">
          <SortableList
            items={draft.children}
            options={options}
            depth={1}
            onChange={(children) => onChange({ ...draft, children })}
          />
        </div>
      )}
    </li>
  );
}

function SortableList({
  items,
  options,
  depth,
  onChange,
}: {
  items: Draft[];
  options: DestinationOption[];
  depth: 0 | 1;
  onChange: (next: Draft[]) => void;
}) {
  // dnd-kit numbers its screen-reader ids from a module counter, which the server and the
  // browser count differently — a hydration mismatch on every drag handle. A stable id fixes it.
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    if (from === -1 || to === -1) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <Row
              key={item.key}
              draft={item}
              options={options}
              depth={depth}
              onChange={(next) => {
                const list = [...items];
                list[index] = next;
                onChange(list);
              }}
              onRemove={() => onChange(items.filter((_, at) => at !== index))}
              onAddChild={
                depth === 0
                  ? () => {
                      const list = [...items];
                      list[index] = { ...item, children: [...item.children, blankDraft()] };
                      onChange(list);
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- */

export function MenuEditor({
  menu,
  options,
}: {
  menu: Menu;
  options: DestinationOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<Draft[]>(() => menu.items.map(toDraft));

  // Compared by value rather than tracked by a flag, so an edit that is undone
  // by hand leaves the save button quiet again.
  const initial = React.useMemo(() => JSON.stringify(menu.items.map(toDraft)), [menu.items]);
  const dirty = React.useMemo(
    () => JSON.stringify(items.map(stripKeys)) !== JSON.stringify(JSON.parse(initial).map(stripKeys)),
    [items, initial],
  );

  async function onSave() {
    const empty = flatten(items).find((item) => item.title.trim() === "");
    if (empty) {
      toast.error("A link has no label", { description: "Every link needs something to click." });
      return;
    }

    const badUrl = flatten(items).find(
      (item) => item.destination === "HTTP" && item.url.trim() === "",
    );
    if (badUrl) {
      toast.error("A link has no web address", { description: `Fill in where "${badUrl.title}" should go.` });
      return;
    }

    setSaving(true);
    try {
      await updateMenuRequest({
        id: menu.id,
        title: menu.title,
        handle: menu.handle,
        items: items.map(toPayload),
      });

      toast.success("Saved", { description: "The menu is updated on the site." });
      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <SortableList items={items} options={options} depth={0} onChange={setItems} />

          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((current) => [...current, blankDraft()])}
          >
            <PlusIcon />
            Add link
          </Button>
        </CardContent>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onDiscard={() => setItems(menu.items.map(toDraft))}
        note={items.length === 0 ? <span className="text-destructive">A menu cannot be saved empty</span> : undefined}
        disabled={items.length === 0}
      />
    </div>
  );
}

/* ---- helpers --------------------------------------------------------------- */

/** Local keys change on every load, so they cannot take part in a dirty check. */
function stripKeys(draft: Draft): unknown {
  return {
    id: draft.id ?? null,
    title: draft.title,
    destination: draft.destination,
    url: draft.url,
    children: draft.children.map(stripKeys),
  };
}

function flatten(items: Draft[]): Draft[] {
  return items.flatMap((item) => [item, ...flatten(item.children)]);
}

function toPayload(draft: Draft): MenuItemPayload {
  const { type, resourceId } = parse(draft.destination);

  return {
    ...(draft.id ? { id: draft.id } : {}),
    title: draft.title.trim(),
    type,
    ...(DERIVED.has(type) ? {} : type === "HTTP" ? { url: draft.url.trim() } : { resourceId }),
    ...(draft.children.length ? { items: draft.children.map(toPayload) } : {}),
  };
}
