"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { cn } from "@/lib/utils/cn";

/**
 * THE way to choose where a link goes — a menu link, a button in the page builder,
 * a section's address (see docs/admin/ui-standard.md): one searchable list,
 * grouped (Pages, Collections, …), showing the choice by its name. A web address
 * that is not on the list is the last choice, "Another website", and the caller
 * shows an address field for it.
 *
 * A popover, not a dialog: it picks one value for the input it sits on, like a
 * select with search.
 */

export type DestinationOption = {
  value: string;
  label: string;
  group: string;
  /** Shown faint on the right — the page's address. */
  hint?: string;
};

export function DestinationPicker({
  id,
  value,
  options,
  onChange,
  placeholder = "Choose where it goes",
  className,
}: {
  id?: string;
  value: string;
  options: DestinationOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const groups = [...new Set(options.map((option) => option.group))];
  const current = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !current && "text-muted-foreground", className)}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search pages and collections" />
          <CommandList className="max-h-80">
            <CommandEmpty>Nothing found.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {options
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <CommandItem
                      key={`${group}-${option.value}`}
                      value={`${option.label} ${option.hint ?? ""} ${option.value}`}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <CheckIcon className={cn("size-3.5 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="text-muted-foreground shrink-0 text-[11px]">{option.hint}</span>
                      ) : null}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
