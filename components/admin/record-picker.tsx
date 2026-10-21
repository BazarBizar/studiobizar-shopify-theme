"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ImageIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { EmptyState } from "@/components/admin/empty-state";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/admin/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/admin/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * Choosing RECORDS — products, collections, designers, projects — the sibling of
 * `MediaPicker` for things that are not files, with the same behaviour: a dialog,
 * search, click to select, **Select** / **Add N** to confirm (see
 * docs/admin/ui-standard.md). `RecordRows` shows what is chosen, in order.
 */

export type RecordItem = { id: string; label: string; thumbnail: string | null; handle?: string };

export function Thumb({ src, className = "size-12" }: { src: string | null; className?: string }) {
  return (
    <span className={cn("bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md border", className)}>
      {src ? (
        <Image src={src} alt="" width={64} height={64} unoptimized className="size-full object-cover" />
      ) : (
        <ImageIcon className="text-muted-foreground size-4" />
      )}
    </span>
  );
}

export function RecordRows({
  items,
  noun,
  multiple,
  disabled,
  max,
  onMove,
  onRemove,
  onAdd,
}: {
  /** The chosen records, in order; `null` for one that no longer exists. */
  items: (RecordItem | null)[];
  /** Singular, lower case: "product", "designer". */
  noun: string;
  multiple: boolean;
  disabled?: boolean;
  max?: number;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const full = max !== undefined && items.length >= max;

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <ul className="divide-border divide-y rounded-md border">
          {items.map((item, index) => (
            <li key={`${item?.id ?? "gone"}-${index}`} className="flex items-center gap-3 px-2 py-2">
              <Thumb src={item?.thumbnail ?? null} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {item?.label ?? <span className="text-muted-foreground">A {noun} that no longer exists</span>}
              </span>
              {multiple && !disabled ? (
                <>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>
                    <ArrowUpIcon className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move down" title="Move down" disabled={index === items.length - 1} onClick={() => onMove(index, 1)}>
                    <ArrowDownIcon className="size-3.5" />
                  </Button>
                </>
              ) : null}
              {!disabled ? (
                <Button type="button" variant="ghost" size="icon" className="text-destructive size-7" aria-label={`Remove ${item?.label ?? noun}`} title="Remove" onClick={() => onRemove(index)}>
                  <XIcon className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No {noun} chosen yet.</p>
      )}

      {!disabled ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={onAdd}>
            <PlusIcon className="size-3.5" />
            {multiple ? `Add ${noun}s` : items.length ? `Change ${noun}` : `Choose ${noun}`}
          </Button>
          {max !== undefined && multiple ? (
            <span className="text-muted-foreground text-xs">
              {items.length} of {max}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RecordPickerDialog({
  open,
  onOpenChange,
  title,
  noun,
  items,
  loading,
  error,
  onRetry,
  search,
  multiple,
  selectedIds,
  limit,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Plural, lower case, for search and empty text: "products". */
  noun: string;
  items: RecordItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Server-side search (products). Without it the list is filtered here. */
  search?: { value: string; onChange: (value: string) => void; searching: boolean };
  multiple: boolean;
  /** Already on the field: selected (single) or marked as added (multiple). */
  selectedIds: string[];
  /** How many more may be added (multiple). */
  limit?: number;
  onConfirm: (items: RecordItem[]) => void;
}) {
  const [chosen, setChosen] = React.useState<RecordItem[]>([]);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChosen([]);
  }

  const inUse = new Set(multiple ? selectedIds : []);
  const isChosen = (id: string) =>
    chosen.some((item) => item.id === id) || (!multiple && chosen.length === 0 && selectedIds.includes(id));
  const roomLeft = limit === undefined ? Infinity : limit - chosen.length;

  const toggle = (item: RecordItem) => {
    if (inUse.has(item.id)) return;
    if (!multiple) return setChosen([item]);
    setChosen((current) =>
      current.some((candidate) => candidate.id === item.id)
        ? current.filter((candidate) => candidate.id !== item.id)
        : roomLeft > 0
          ? [...current, item]
          : current,
    );
  };

  const confirm = (picked: RecordItem[]) => {
    if (picked.length === 0) return;
    onConfirm(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose {title}</DialogTitle>
          <DialogDescription>Search by name, then click to select.</DialogDescription>
        </DialogHeader>

        {error ? <ErrorState error={error} onRetry={onRetry} title="Could not load the list" /> : null}

        <Command shouldFilter={!search} className="min-h-0 flex-1 rounded-md border">
          <CommandInput
            placeholder={`Search ${noun}`}
            {...(search ? { value: search.value, onValueChange: search.onChange } : {})}
          />
          <CommandList className="max-h-96">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* cmdk's own empty slot only knows about its filter; this covers both kinds of search. */}
                {items.length === 0 && !search?.searching ? (
                  <EmptyState title={`No ${noun} found`} description="Try another word." className="py-6" />
                ) : null}
                {search?.searching ? <p className="text-muted-foreground p-3 text-center text-xs">Searching…</p> : null}
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      // The id too: two records can share a name, and cmdk keys on this.
                      value={`${item.label} ${item.id}`}
                      disabled={inUse.has(item.id)}
                      onSelect={() => toggle(item)}
                      onDoubleClick={() => (multiple ? undefined : confirm([item]))}
                    >
                      <Thumb src={item.thumbnail} className="size-9" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {inUse.has(item.id) ? (
                        <span className="text-muted-foreground text-xs">Already added</span>
                      ) : isChosen(item.id) ? (
                        <CheckIcon className="size-4 shrink-0" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {multiple
              ? chosen.length
                ? `${chosen.length} selected${roomLeft <= 0 ? " — that is the most this can hold" : ""}`
                : "Click to select one or more."
              : chosen.length
                ? `Selected: ${chosen[0]!.label}`
                : "Click to select. Double-click to choose at once."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={chosen.length === 0} onClick={() => confirm(chosen)}>
              {multiple ? (chosen.length > 1 ? `Add ${chosen.length}` : "Add") : "Select"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
