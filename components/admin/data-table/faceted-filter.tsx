"use client";

import { CheckIcon, PlusCircleIcon } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import * as React from "react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/admin/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { Separator } from "@/components/admin/ui/separator";
import { cn } from "@/lib/utils/cn";

import { BLANK, BLANK_LABEL } from "./filters";

/**
 * Multi-select over a column's DISTINCT LOADED VALUES — the client-side filter.
 *
 * Options come from `column.getFacetedUniqueValues()`, so the list is what actually
 * exists in the rows rather than a hardcoded set that drifts from the data.
 *
 * For the server-paged equivalent, whose options must describe the whole store rather
 * than the page in memory, see `option-filter.tsx`.
 */
export function FacetedFilter<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>;
  title: string;
}) {
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);

  const options = React.useMemo(() => {
    const facets = column.getFacetedUniqueValues();
    const counts = new Map<string, number>();

    for (const [rawValue, count] of facets) {
      // A list column faces its values as arrays; each element is its own option.
      if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) {
          counts.set(BLANK, (counts.get(BLANK) ?? 0) + count);
          continue;
        }
        for (const element of rawValue) {
          const key = String(element);
          counts.set(key, (counts.get(key) ?? 0) + count);
        }
        continue;
      }

      const key =
        rawValue === null || rawValue === undefined || rawValue === "" ? BLANK : String(rawValue);
      counts.set(key, (counts.get(key) ?? 0) + count);
    }

    /**
     * Alphabetical, with blank last. NOT by count: a count-ordered list reshuffles
     * itself every time the rows are filtered, so the option you were reaching for
     * moves out from under the cursor.
     */
    return [...counts.entries()]
      .sort(([a], [b]) => {
        if (a === BLANK) return 1;
        if (b === BLANK) return -1;
        return a.localeCompare(b);
      })
      .map(([value, count]) => ({ value, count }));
  }, [column]);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    column.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon className="size-3.5" />
          {title}
          {selected.size > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.size}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>

            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                const isBlank = option.value === BLANK;

                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {isSelected ? <CheckIcon className="size-3" /> : null}
                    </div>

                    <span className={cn("truncate", isBlank && "text-muted-foreground italic")}>
                      {isBlank ? BLANK_LABEL : option.value}
                    </span>

                    <span className="text-muted-foreground ms-auto font-mono text-xs">
                      {option.count}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
