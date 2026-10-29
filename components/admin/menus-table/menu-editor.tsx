"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CornerDownRightIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/admin/app-link";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { DestinationOption } from "@/components/admin/destination-picker";
import { SaveBar } from "@/components/admin/save-bar";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import type { Menu } from "@/lib/admin/menus";
import {
  addItem,
  blankDraft,
  canIndent,
  canOutdent,
  comparable,
  depthOf,
  descendantKeys,
  destinationKind,
  dropRow,
  flatten,
  flattenDrafts,
  indentItem,
  MAX_MENU_DEPTH,
  MENU_HANDLE,
  outdentItem,
  projectDrop,
  removeItem,
  shiftItem,
  toDraft,
  toPayload,
  updateItem,
  type MenuDraft,
} from "@/lib/admin/menu-tree";
import { deleteMenuRequest, RequestError, updateMenuRequest } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

import { LinkPicker, linkOptionLabel, type LinkOption } from "./link-picker";

/**
 * THE MENU EDITOR — Shopify's, for this site.
 *
 *  - A tree up to THREE levels. Drag a link to move it; drag it right to put it under
 *    the link above, left to take it out. The ⋯ menu does the same from the keyboard
 *    (Move up / down / in / out).
 *  - "Add menu item" and a click on a link open the same dialog: its label, where it
 *    goes (pages, collections, products, product types, vendors, policies, or another
 *    website) and, for a collection, the tags it is filtered by.
 *  - A menu made here can be renamed, given another handle and deleted; the site's own
 *    five keep their handle and cannot be emptied or deleted (the server checks both).
 *
 * `menuUpdate` REPLACES the tree, so every save sends the whole thing — which is also
 * why there is no per-item save: a half-sent tree is a deleted tree.
 */

const INDENT = 28;

export type MenuEditorDestinations = { options: DestinationOption[]; tags: string[]; productCount: number | null };

/* -------------------------------------------------------------------------- *
 * The tree
 * -------------------------------------------------------------------------- */

/** "Collections › The Atlas Collection", as the picker shows it; a web link by its address. */
function destinationSummary(draft: MenuDraft, optionOf: (value: string) => LinkOption | undefined): string {
  const kind = destinationKind(draft.destination);
  if (kind === "HTTP") return draft.url || "No address yet";
  const option = optionOf(draft.destination);
  if (option) return linkOptionLabel(option);
  const what =
    { PRODUCT: "Products", COLLECTION: "Collections", PAGE: "Pages", METAOBJECT: "Designers or projects", SHOP_POLICY: "Policies" }[kind] ??
    null;
  return what ? `${what} › no longer there — choose another` : "A link Shopify made";
}

type RowActions = {
  edit: (key: string) => void;
  addUnder: (key: string) => void;
  remove: (key: string) => void;
  shift: (key: string, delta: -1 | 1) => void;
  indent: (key: string) => void;
  outdent: (key: string) => void;
};

function TreeRow({
  draft,
  depth,
  first,
  last,
  items,
  summary,
  actions,
  dragging,
}: {
  draft: MenuDraft;
  depth: number;
  first: boolean;
  last: boolean;
  items: MenuDraft[];
  summary: string;
  actions: RowActions;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: draft.key });
  const canAddUnder = depth + 1 < MAX_MENU_DEPTH;
  const label = draft.title || "Untitled link";

  return (
    <li
      ref={setNodeRef}
      style={{
        // Up and down only on screen; how far right the pointer goes picks the level.
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null),
        transition,
        paddingInlineStart: depth * INDENT,
      }}
      className={cn("relative", isDragging && "z-10")}
    >
      <div
        className={cn(
          "bg-background flex items-center gap-2 rounded-md border px-2 py-1.5",
          isDragging && "border-primary bg-muted/60 shadow-sm",
          dragging && !isDragging && "transition-[padding]",
        )}
      >
        <button
          type="button"
          aria-label={`Drag ${label}`}
          title="Drag to move — right to put it under the link above, left to take it out"
          className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
        {depth > 0 ? <CornerDownRightIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden /> : null}
        <button
          type="button"
          onClick={() => actions.edit(draft.key)}
          className="hover:bg-muted min-w-0 flex-1 rounded px-1.5 py-0.5 text-left"
        >
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="text-muted-foreground block truncate text-xs">{summary}</span>
        </button>
        {draft.tags.length ? (
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            {draft.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px]">
                {tag}
              </Badge>
            ))}
            {draft.tags.length > 3 ? <span className="text-muted-foreground text-xs">+{draft.tags.length - 3}</span> : null}
          </span>
        ) : null}
        {canAddUnder ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => actions.addUnder(draft.key)}
            title="Add a link that opens from this one"
          >
            <PlusIcon />
            Sub-link
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`More for ${label}`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => actions.edit(draft.key)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            {canAddUnder ? (
              <DropdownMenuItem onSelect={() => actions.addUnder(draft.key)}>
                <PlusIcon />
                Add a link under it
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={first} onSelect={() => actions.shift(draft.key, -1)}>
              <ArrowUpIcon />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={last} onSelect={() => actions.shift(draft.key, 1)}>
              <ArrowDownIcon />
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canIndent(items, draft.key)} onSelect={() => actions.indent(draft.key)}>
              <ArrowRightIcon />
              Move in, under the link above
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canOutdent(items, draft.key)} onSelect={() => actions.outdent(draft.key)}>
              <ArrowLeftIcon />
              Move out a level
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(draft.key)}>
              <Trash2Icon />
              Remove{draft.children.length ? " (and the links under it)" : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function MenuTree({
  items,
  onChange,
  optionOf,
  actions,
}: {
  items: MenuDraft[];
  onChange: (next: MenuDraft[]) => void;
  optionOf: (value: string) => LinkOption | undefined;
  actions: RowActions;
}) {
  // dnd-kit numbers its screen-reader ids from a module counter, which the server and the
  // browser count differently — a hydration mismatch on every drag handle. A stable id fixes it.
  const dndId = React.useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [active, setActive] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);

  const flat = flatten(items);
  // While dragging, the dragged link's own branch folds into it and travels with it.
  const hidden = active ? descendantKeys(flat, active) : new Set<string>();
  const rows = flat.filter((row) => !hidden.has(row.key));
  const projection = active && over ? projectDrop(rows, active, over, Math.round(offset / INDENT)) : null;

  const reset = () => {
    setActive(null);
    setOver(null);
    setOffset(0);
  };

  const siblingsOf = (key: string) => {
    const row = flat.find((candidate) => candidate.key === key);
    return flat.filter((candidate) => candidate.parentKey === (row?.parentKey ?? null));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active: start }: DragStartEvent) => {
        setActive(String(start.id));
        setOver(String(start.id));
      }}
      onDragMove={({ delta }: DragMoveEvent) => setOffset(delta.x)}
      onDragOver={({ over: target }: DragOverEvent) => setOver(target ? String(target.id) : null)}
      onDragEnd={({ active: end, over: target }: DragEndEvent) => {
        if (target && projection) {
          const next = dropRow(items, String(end.id), String(target.id), projection);
          if (next === items && (String(end.id) !== String(target.id) || projection.depth !== depthOf(items, String(end.id)))) {
            toast.error("Menus go three levels deep", { description: "Move it somewhere with fewer levels around it." });
          }
          onChange(next);
        }
        reset();
      }}
      onDragCancel={reset}
    >
      <SortableContext items={rows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const siblings = siblingsOf(row.key);
            return (
              <TreeRow
                key={row.key}
                draft={row.draft}
                depth={row.key === active && projection ? projection.depth : row.depth}
                first={siblings[0]?.key === row.key}
                last={siblings.at(-1)?.key === row.key}
                items={items}
                summary={destinationSummary(row.draft, optionOf)}
                actions={actions}
                dragging={active !== null}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- *
 * One link — "Add menu item" and "Edit"
 * -------------------------------------------------------------------------- */

function TagsField({ value, known, onChange }: { value: string[]; known: string[]; onChange: (next: string[]) => void }) {
  const [typed, setTyped] = React.useState("");
  const add = (tag: string) => {
    const clean = tag.trim();
    if (!clean || value.includes(clean) || value.length >= 10) return;
    onChange([...value, clean]);
    setTyped("");
  };
  const suggestions = known.filter((tag) => !value.includes(tag) && tag.toLowerCase().includes(typed.trim().toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pe-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove the tag ${tag}`}
                className="hover:bg-foreground/10 rounded-sm p-0.5"
                onClick={() => onChange(value.filter((other) => other !== tag))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        value={typed}
        placeholder={value.length >= 10 ? "At most 10 tags" : "Type a tag, or pick one below"}
        disabled={value.length >= 10}
        aria-label="Add a tag"
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(typed);
          }
        }}
      />
      {suggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <Button key={tag} type="button" variant="outline" size="xs" onClick={() => add(tag)}>
              <PlusIcon />
              {tag}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">Only products with every tag listed are shown.</p>
    </div>
  );
}

function ItemDialog({
  open,
  initial,
  title,
  destinations,
  remember,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  initial: MenuDraft;
  title: string;
  destinations: MenuEditorDestinations & { extra: DestinationOption[] };
  remember: (option: DestinationOption) => void;
  onOpenChange: (open: boolean) => void;
  onDone: (draft: MenuDraft) => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [labelTouched, setLabelTouched] = React.useState(Boolean(initial.title));
  const options = [...destinations.options, ...destinations.extra];
  const known = options.some((option) => option.value === draft.destination);
  const all = known ? options : [{ value: draft.destination, label: "The link it has now (kept as is)", group: "Current" }, ...options];
  const kind = destinationKind(draft.destination);
  const missing = !draft.title.trim() ? "Give the link a label." : kind === "HTTP" && !draft.url.trim() ? "Type the web address." : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>What people click, and where it takes them.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!missing) onDone(draft);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="menu-item-link">Link</Label>
            <LinkPicker
              id="menu-item-link"
              value={draft.destination}
              options={all}
              productCount={destinations.productCount}
              onChange={(destination, option) => {
                if (destinationKind(option.value) === "PRODUCT") remember(option);
                setDraft((current) => ({
                  ...current,
                  destination,
                  // A label nobody typed follows the choice, as in Shopify.
                  title: !labelTouched && destinationKind(destination) !== "HTTP" ? option.label : current.title,
                  tags: destinationKind(destination) === "COLLECTION" ? current.tags : [],
                }));
              }}
            />
          </div>

          {kind === "HTTP" ? (
            <div className="space-y-1.5">
              <Label htmlFor="menu-item-url">Web address</Label>
              <Input
                id="menu-item-url"
                value={draft.url}
                placeholder="https://www.instagram.com/studiobizar, or /our-story"
                onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="menu-item-label">Label</Label>
            <Input
              id="menu-item-label"
              value={draft.title}
              maxLength={255}
              placeholder="e.g. Dining chairs"
              onChange={(event) => {
                setLabelTouched(true);
                setDraft((current) => ({ ...current, title: event.target.value }));
              }}
            />
          </div>

          {kind === "COLLECTION" ? (
            <div className="space-y-1.5">
              <Label>Filter by tags</Label>
              <TagsField value={draft.tags} known={destinations.tags} onChange={(tags) => setDraft((current) => ({ ...current, tags }))} />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={Boolean(missing)} title={missing ?? undefined}>
              {initial.title ? "Done" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- *
 * The editor
 * -------------------------------------------------------------------------- */

type Editing = { mode: "add"; parentKey: string | null } | { mode: "edit"; key: string };

export function MenuEditor({
  menu,
  destinations,
  site,
  inAppearance,
}: {
  menu: Menu;
  destinations: MenuEditorDestinations;
  /** One of the site's own five: its handle stays, and it cannot be emptied or deleted. */
  site: boolean;
  /** Shown by a Theme Builder layout: its handle stays, and it cannot be deleted. */
  inAppearance: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<MenuDraft[]>(() => menu.items.map(toDraft));
  const [title, setTitle] = React.useState(menu.title);
  const [handle, setHandle] = React.useState(menu.handle);
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Products chosen through search, so their names survive closing the dialog.
  const [extra, setExtra] = React.useState<DestinationOption[]>([]);

  const initial = React.useMemo(() => comparable(menu.items.map(toDraft)), [menu.items]);
  const dirty = comparable(items) !== initial || title !== menu.title || handle !== menu.handle;
  const fixedHandle = site || menu.isDefault || inAppearance;

  const known = React.useMemo(
    () => new Map([...destinations.options, ...extra].map((option) => [option.value, option])),
    [destinations.options, extra],
  );
  const optionOf = (value: string) => known.get(value);

  const actions: RowActions = {
    edit: (key) => setEditing({ mode: "edit", key }),
    addUnder: (key) => setEditing({ mode: "add", parentKey: key }),
    remove: (key) => {
      const before = items;
      setItems(removeItem(items, key));
      toast("Link removed", { action: { label: "Undo", onClick: () => setItems(before) } });
    },
    shift: (key, delta) => setItems(shiftItem(items, key, delta)),
    indent: (key) => setItems(indentItem(items, key)),
    outdent: (key) => setItems(outdentItem(items, key)),
  };

  const editingDraft =
    editing?.mode === "edit" ? flattenDrafts(items).find((draft) => draft.key === editing.key) ?? null : null;

  async function onSave() {
    const all = flattenDrafts(items);
    const empty = all.find((item) => !item.title.trim());
    if (empty) {
      toast.error("A link has no label", { description: "Every link needs something to click." });
      return;
    }
    const badUrl = all.find((item) => destinationKind(item.destination) === "HTTP" && !item.url.trim());
    if (badUrl) {
      toast.error("A link has no web address", { description: `Fill in where "${badUrl.title}" should go.` });
      return;
    }
    if (!title.trim()) {
      toast.error("The menu has no name");
      return;
    }
    if (!MENU_HANDLE.test(handle)) {
      toast.error("That handle will not work", { description: "Use lowercase letters, numbers and dashes, like shop-by-room." });
      return;
    }

    setSaving(true);
    try {
      await updateMenuRequest({ id: menu.id, title: title.trim(), handle, items: items.map(toPayload) });
      toast.success("Saved", { description: "The menu is updated on the site." });
      router.refresh();
    } catch (error) {
      toast.error("Could not save", { description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    try {
      await deleteMenuRequest(menu.id);
      toast.success("Menu deleted");
      router.push("/admin/menus");
      router.refresh();
    } catch (error) {
      const inUse = error instanceof RequestError && error.status === 409;
      toast.error("Could not delete it", {
        description: error instanceof Error ? error.message : undefined,
        action: inUse ? { label: "Open Appearance", onClick: () => router.push("/admin/theme-builder") } : undefined,
      });
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      {site || menu.isDefault ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
            <CardDescription>
              {inAppearance
                ? "Shown in Appearance. Its handle stays while it is — that is how Appearance finds it."
                : "Not shown anywhere yet. In Appearance, add a Menu element to the header or footer and choose this menu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-title">Name</Label>
              <Input id="menu-title" value={title} maxLength={255} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-handle">Handle</Label>
              <Input
                id="menu-handle"
                value={handle}
                disabled={fixedHandle}
                onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              />
            </div>
            {!inAppearance ? (
              <div className="sm:col-span-2">
                <Button asChild variant="outline" size="sm">
                  <AppLink href="/admin/theme-builder">Open Appearance</AppLink>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
          <CardDescription>
            Up to three levels. Drag a link right to put it under the one above — a link with links under it opens a dropdown, and a
            third level turns it into a wide menu of columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length ? (
            <MenuTree items={items} onChange={setItems} optionOf={optionOf} actions={actions} />
          ) : (
            <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
              No links yet. Add the first one.
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => setEditing({ mode: "add", parentKey: null })}>
            <PlusIcon />
            Add menu item
          </Button>
        </CardContent>
      </Card>

      {site || menu.isDefault ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Delete this menu</CardTitle>
            <CardDescription>
              {inAppearance
                ? "It is shown in Appearance, so it cannot be deleted. Choose another menu there, or remove the element, first."
                : "It is not shown anywhere, so nothing on the site changes."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inAppearance ? (
              <Button asChild variant="outline" size="sm">
                <AppLink href="/admin/theme-builder">Open Appearance</AppLink>
              </Button>
            ) : (
              <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon />
                Delete menu
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {editing ? (
        <ItemDialog
          key={editing.mode === "edit" ? editing.key : `add-${editing.parentKey ?? "top"}`}
          open
          title={
            editing.mode === "edit"
              ? "Edit link"
              : editing.parentKey
                ? `Add a link under “${flattenDrafts(items).find((draft) => draft.key === editing.parentKey)?.title ?? ""}”`
                : "Add menu item"
          }
          initial={editingDraft ?? blankDraft()}
          destinations={{ ...destinations, extra }}
          remember={(option) => setExtra((current) => (current.some((known) => known.value === option.value) ? current : [...current, option]))}
          onOpenChange={(open) => !open && setEditing(null)}
          onDone={(draft) => {
            if (editing.mode === "edit") {
              setItems(updateItem(items, editing.key, (current) => ({ ...draft, children: current.children })));
            } else {
              const next = addItem(items, draft, editing.parentKey);
              if (next === items) toast.error("Menus go three levels deep");
              setItems(next);
            }
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${menu.title}”?`}
        description="The menu and its links are deleted from Shopify. This cannot be undone."
        confirmLabel="Delete menu"
        destructive
        onConfirm={onDelete}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onDiscard={() => {
          setItems(menu.items.map(toDraft));
          setTitle(menu.title);
          setHandle(menu.handle);
        }}
        note={site && items.length === 0 ? <span className="text-destructive">This menu is on every page — keep at least one link</span> : undefined}
        disabled={site && items.length === 0}
      />
    </div>
  );
}
