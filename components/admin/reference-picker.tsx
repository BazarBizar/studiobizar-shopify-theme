"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { ErrorState } from "@/components/admin/error-state";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { useMetaobjectOptions } from "@/lib/admin/queries";

/**
 * Picks metaobject entries for a `metaobject_reference` or
 * `list.metaobject_reference` field.
 *
 * `targetType` is resolved on the SERVER from the field's `metaobject_definition_id`
 * validation, because that validation carries a definition gid and only the definition
 * list can turn it into a type. A client that had to resolve it would need the whole
 * definition list shipped to it.
 */

type Selected = { id: string; label: string; thumbnail: string | null };

type Props = {
  /** Chosen ids, in order. A single-reference field passes at most one. */
  value: string[];
  current: Selected[];
  onChange: (ids: string[]) => void;
  targetType: string | null;
  multiple: boolean;
  disabled?: boolean;
  label: string;
};

export function ReferencePicker({
  value,
  current,
  onChange,
  targetType,
  multiple,
  disabled,
  label,
}: Props) {
  const [open, setOpen] = React.useState(false);
  // Labels for ids chosen in this session; the server only resolved what was stored.
  const [known, setKnown] = React.useState<Record<string, Selected>>(() =>
    Object.fromEntries(current.map((item) => [item.id, item])),
  );

  const { data, isLoading, error, refetch } = useMetaobjectOptions({
    type: targetType,
    enabled: open,
  });

  const describe = (id: string): Selected => known[id] ?? { id, label: id, thumbnail: null };

  const toggle = (entry: Selected) => {
    setKnown((currentKnown) => ({ ...currentKnown, [entry.id]: entry }));

    if (!multiple) {
      onChange([entry.id]);
      setOpen(false);
      return;
    }

    onChange(
      value.includes(entry.id)
        ? value.filter((candidate) => candidate !== entry.id)
        : [...value, entry.id],
    );
  };

  /** Manual ordering matters: `project.gallery` renders in the order stored. */
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  if (!targetType) {
    return (
      <p className="text-muted-foreground rounded-md border px-3 py-2 text-sm">
        This field points at a metaobject definition the panel cannot see, so it cannot be
        edited here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="divide-border divide-y rounded-md border">
          {value.map((id, index) => {
            const item = describe(id);

            return (
              <li key={`${id}-${index}`} className="flex items-center gap-2 px-2 py-1.5">
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className="size-7 shrink-0 rounded object-cover"
                  />
                ) : null}

                <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>

                {multiple && !disabled ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Move ${item.label} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Move ${item.label} down`}
                      disabled={index === value.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon className="size-3.5" />
                    </Button>
                  </>
                ) : null}

                {!disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-6"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => onChange(value.filter((_, position) => position !== index))}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-3.5" />
          {multiple ? "Add" : value.length ? "Replace" : "Choose"}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose {label.toLowerCase()}</DialogTitle>
          </DialogHeader>

          {error ? (
            <ErrorState error={error.message} onRetry={() => refetch()} title="Could not load entries" />
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}`} />
              <CommandList className="max-h-72">
                <CommandEmpty>Nothing to choose from.</CommandEmpty>
                <CommandGroup>
                  {(data?.entries ?? []).map((entry) => {
                    const chosen = value.includes(entry.id);

                    return (
                      <CommandItem
                        key={entry.id}
                        value={entry.label}
                        onSelect={() =>
                          toggle({
                            id: entry.id,
                            label: entry.label,
                            thumbnail: entry.thumbnail,
                          })
                        }
                      >
                        {entry.thumbnail ? (
                          <Image
                            src={entry.thumbnail}
                            alt=""
                            width={24}
                            height={24}
                            unoptimized
                            className="size-6 shrink-0 rounded object-cover"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {chosen ? <CheckIcon className="size-3.5 shrink-0" /> : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
