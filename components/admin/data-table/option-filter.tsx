"use client";

import { CheckIcon, PlusCircleIcon } from "lucide-react";

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

/**
 * Multi-select whose options are SUPPLIED, not derived — the server-paged filter.
 *
 * Visually identical to `FacetedFilter` on purpose; all three filter controls share
 * one shape so the toolbar reads as one language. What differs is ownership: the
 * options come in as a prop and the selection is held by the caller, because it has
 * to travel to the API rather than into a TanStack column filter.
 *
 * That is the whole point of having both — this one can offer every vendor in the
 * store, where the faceted version could only offer the vendors that happen to be on
 * screen.
 */
export function OptionFilter({
  title,
  options,
  selected,
  onChange,
  labels,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Maps a raw value to something readable: `ACTIVE` -> `Active`. */
  labels?: Record<string, string>;
}) {
  const chosen = new Set(selected);

  const toggle = (value: string) => {
    const next = new Set(chosen);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon className="size-3.5" />
          {title}
          {chosen.size > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {chosen.size}
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
                const isSelected = chosen.has(option);

                return (
                  <CommandItem key={option} onSelect={() => toggle(option)}>
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
                    <span className="truncate">{labels?.[option] ?? option}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {chosen.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
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
