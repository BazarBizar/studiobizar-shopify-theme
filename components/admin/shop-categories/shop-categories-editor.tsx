"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SaveBar } from "@/components/admin/save-bar";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { formatDate } from "@/lib/admin/field-values";
import { RequestError, shopCategoriesRequest } from "@/lib/admin/queries";
import type { ShopCategoriesView } from "@/lib/admin/shop-categories";
import { CATEGORY_LIMITS, type Category } from "@/lib/shopify/categories";
import { cn } from "@/lib/utils/cn";

/** A category as the editor holds it: `key` is for drag and drop only, `slug` is null until saved. */
type Item = { key: string; slug: string | null; label: string; types: string[] };

/**
 * Keys are `<prefix><index>`, never a module counter: the first render happens on the
 * server too, and a counter there would not match the browser's.
 */
const toItems = (categories: Category[], prefix: string): Item[] =>
  categories.map((category, index) => ({ key: `${prefix}${index}`, ...category, types: [...category.types] }));

type Owner = { key: string; label: string };

/** What a save sends — and what "unsaved changes" compares. */
const payload = (items: Item[]) => items.map(({ slug, label, types }) => ({ slug, label: label.trim(), types }));

function messageOf(error: unknown): string {
  if (error instanceof RequestError) {
    const issues = error.detail.issues as { message?: string }[] | undefined;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "That did not work.";
}

export function ShopCategoriesEditor({ view, shopUrl }: { view: ShopCategoriesView; shopUrl: string | null }) {
  const [items, setItems] = React.useState(() => toItems(view.categories, "i"));
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(payload(toItems(view.categories, "i"))));
  const seq = React.useRef(0);
  const prefix = () => `k${(seq.current += 1)}-`;
  const [digest, setDigest] = React.useState(view.digest);
  const [saving, setSaving] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);

  const dirty = JSON.stringify(payload(items)) !== baseline;
  const storeTypes = React.useMemo(() => new Set(view.productTypes), [view.productTypes]);

  // Which categories each type is in, for "in lamps" in the picker and for the warning.
  const owners = React.useMemo(() => {
    const map = new Map<string, Owner[]>();
    for (const item of items) {
      const owner = { key: item.key, label: item.label.trim() || "Untitled" };
      for (const type of item.types) map.set(type, [...(map.get(type) ?? []), owner]);
    }
    return map;
  }, [items]);
  const unassigned = view.productTypes.filter((type) => !owners.has(type));

  const problems = items.filter((item) => !item.label.trim() || item.types.length === 0);
  const full = items.length >= CATEGORY_LIMITS.categories;

  const update = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const move = (index: number, by: -1 | 1) => setItems((current) => arrayMove(current, index, index + by));

  const add = (label = "", types: string[] = []) => {
    const item: Item = { key: prefix(), slug: null, label, types };
    setItems((current) => [...current, item]);
    setFocusKey(item.key);
  };

  const remove = (index: number) => {
    const before = items;
    const name = items[index]!.label.trim();
    setItems(items.filter((_, i) => i !== index));
    toast(name ? `“${name}” removed` : "Category removed", {
      description: "Its products stay on the website — they just lose this filter.",
      action: { label: "Undo", onClick: () => setItems(before) },
    });
  };

  const addType = (key: string, type: string) =>
    setItems((current) =>
      current.map((item) => (item.key === key && !item.types.includes(type) ? { ...item, types: [...item.types, type] } : item)),
    );

  const toggleType = (key: string, type: string) =>
    setItems((current) =>
      current.map((item) =>
        item.key !== key
          ? item
          : { ...item, types: item.types.includes(type) ? item.types.filter((t) => t !== type) : [...item.types, type] },
      ),
    );

  const discard = () => {
    setItems(toItems(JSON.parse(baseline) as Category[], prefix()));
    setShowErrors(false);
  };

  const save = async () => {
    if (problems.length) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const saved = await shopCategoriesRequest({ digest, categories: payload(items) });
      const next = toItems(saved.categories, prefix());
      setItems(next);
      setBaseline(JSON.stringify(payload(next)));
      setDigest(saved.digest);
      setShowErrors(false);
      toast.success("Categories saved", {
        description: "The Shop page shows them within a minute.",
        ...(shopUrl ? { action: { label: "View", onClick: () => window.open(shopUrl, "_blank", "noopener") } } : {}),
      });
    } catch (error) {
      if (error instanceof RequestError && error.code === "CONFLICT") {
        toast.error(messageOf(error), { action: { label: "Reload", onClick: () => window.location.reload() } });
      } else {
        toast.error(messageOf(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const drop = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.key === active.id);
      const to = current.findIndex((item) => item.key === over.id);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {view.saved
            ? view.savedAt
              ? `Last saved ${formatDate(view.savedAt, true)}${view.savedBy ? ` by ${view.savedBy}` : ""}`
              : null
            : "These are the categories the Shop page shows today. Change them and press Save."}
        </p>
        {shopUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={shopUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              See the Shop page
            </a>
          </Button>
        ) : null}
      </div>

      {unassigned.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-500" aria-hidden />
              {unassigned.length === 1
                ? "1 product type is not in any category"
                : `${unassigned.length} product types are not in any category`}
            </CardTitle>
            <CardDescription>
              Their products only appear when a visitor picks “all”. Add each one to a category so it can be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {unassigned.map((type) => (
                <li key={type}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {type}
                        <ChevronDownIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
                      <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Add to…</DropdownMenuLabel>
                      {items.map((item) => (
                        <DropdownMenuItem key={item.key} onSelect={() => addType(item.key, type)}>
                          {item.label.trim() || "Untitled category"}
                        </DropdownMenuItem>
                      ))}
                      {items.length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem disabled={full} onSelect={() => add(type.toLowerCase(), [type])}>
                        <PlusIcon />A new category called “{type.toLowerCase()}”
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {items.length > 0 ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={drop}
        >
          <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {items.map((item, index) => (
                <CategoryRow
                  key={item.key}
                  item={item}
                  index={index}
                  last={index === items.length - 1}
                  productTypes={view.productTypes}
                  storeTypes={storeTypes}
                  owners={owners}
                  showErrors={showErrors}
                  autoFocus={focusKey === item.key}
                  onChange={(patch) => update(item.key, patch)}
                  onToggleType={(type) => toggleType(item.key, type)}
                  onMove={(by) => move(index, by)}
                  onRemove={() => remove(index)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
          No categories — the Shop page shows only “all”. Add one to give visitors a filter.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add()}>
          <PlusIcon />
          Add category
        </Button>
        <span className="text-muted-foreground text-xs">
          {items.length} of {CATEGORY_LIMITS.categories}
        </span>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={discard}
        onSave={save}
        note={
          showErrors && problems.length
            ? "Every category needs a name and at least one product type before you can save."
            : undefined
        }
      />
    </div>
  );
}

function CategoryRow({
  item,
  index,
  last,
  productTypes,
  storeTypes,
  owners,
  showErrors,
  autoFocus,
  onChange,
  onToggleType,
  onMove,
  onRemove,
}: {
  item: Item;
  index: number;
  last: boolean;
  productTypes: string[];
  storeTypes: Set<string>;
  owners: Map<string, Owner[]>;
  showErrors: boolean;
  autoFocus: boolean;
  onChange: (patch: Partial<Item>) => void;
  onToggleType: (type: string) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const name = item.label.trim() || `Category ${index + 1}`;
  const nameId = `category-${item.key}`;
  const noName = showErrors && !item.label.trim();
  const noTypes = showErrors && item.types.length === 0;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null),
        transition,
      }}
      className={cn("bg-card rounded-lg border p-3", isDragging && "relative z-10 shadow-md")}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Drag ${name} to reorder`}
          title="Drag to reorder"
          className="text-muted-foreground hover:text-foreground flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <label htmlFor={nameId} className="sr-only">
          Category name
        </label>
        <Input
          id={nameId}
          value={item.label}
          autoFocus={autoFocus}
          maxLength={CATEGORY_LIMITS.label}
          placeholder="Category name, e.g. lamps"
          aria-invalid={noName || undefined}
          onChange={(event) => onChange({ label: event.target.value })}
          className="h-8 flex-1 font-medium"
        />
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUpIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} down`} disabled={last} onClick={() => onMove(1)}>
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label={`Remove ${name}`}
          title="Remove this category"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      {noName && (
        <p role="alert" className="text-destructive mt-1 pl-8 text-xs">
          Give this category a name.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-8">
        {item.types.map((type) => {
          const gone = !storeTypes.has(type);
          return (
            <span
              key={type}
              title={gone ? "No product has this type any more, so it shows nothing. You can remove it." : undefined}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-md border pr-0.5 pl-2 text-xs",
                gone ? "border-amber-500/50 text-amber-700 dark:text-amber-400" : "bg-muted/60",
              )}
            >
              {gone && <TriangleAlertIcon className="size-3" aria-hidden />}
              {type}
              <button
                type="button"
                aria-label={`Take ${type} out of ${name}`}
                className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center rounded"
                onClick={() => onToggleType(type)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          );
        })}
        <TypePicker
          name={name}
          selected={item.types}
          productTypes={productTypes}
          owners={owners}
          ownKey={item.key}
          onToggle={onToggleType}
        />
      </div>
      {noTypes && (
        <p role="alert" className="text-destructive mt-1 pl-8 text-xs">
          Add at least one product type — without one this category would show nothing.
        </p>
      )}
    </li>
  );
}

/** Every product type in the store, ticked when it is in this category; "in Lamps" when it is in another. */
function TypePicker({
  name,
  selected,
  productTypes,
  owners,
  ownKey,
  onToggle,
}: {
  name: string;
  selected: string[];
  productTypes: string[];
  owners: Map<string, Owner[]>;
  ownKey: string;
  onToggle: (type: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="text-muted-foreground border border-dashed">
          <PlusIcon />
          Add product types
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search product types for ${name}`} />
          <CommandList>
            <CommandEmpty>No product type matches.</CommandEmpty>
            <CommandGroup>
              {productTypes.map((type) => {
                const isSelected = selected.includes(type);
                const elsewhere = (owners.get(type) ?? []).filter((owner) => owner.key !== ownKey).map((owner) => owner.label);
                return (
                  <CommandItem key={type} value={type} onSelect={() => onToggle(type)}>
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {isSelected ? <CheckIcon className="size-3" /> : null}
                    </div>
                    <span className="truncate">{type}</span>
                    {elsewhere.length > 0 && (
                      <span className="text-muted-foreground ms-auto truncate text-xs">in {elsewhere.join(", ")}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
