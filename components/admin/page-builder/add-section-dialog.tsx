"use client";

import { PlusIcon } from "lucide-react";
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
} from "@/components/admin/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/admin/ui/dialog";
import { SECTION_PRESETS, type SectionPreset } from "@/lib/page-builder/presets";
import { SECTION_CATEGORIES } from "@/lib/page-builder/registry";
import { cn } from "@/lib/utils/cn";

import { SectionThumbnail } from "./section-thumbnails";

/**
 * Add section, as a theme editor does it: every preset in a searchable list on
 * the left, and on the right a picture of the one under the pointer — or under
 * the arrow keys, since cmdk moves the same selection either way. The operator
 * sees the shape of a band before adding it, without adding it to find out.
 *
 * Enter or a click adds the highlighted preset where the selection is (after the
 * selected section, else at the end) and closes the dialog.
 */
export function AddSectionDialog({
  onAdd,
  disabled,
  trigger,
}: {
  onAdd: (preset: SectionPreset) => void;
  disabled: boolean;
  /** The button that opens it; a full-width "Add section" when omitted. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string>(SECTION_PRESETS[0]?.id ?? "");
  const preset = SECTION_PRESETS.find((item) => item.id === active) ?? SECTION_PRESETS[0]!;

  const add = (item: SectionPreset) => {
    onAdd(item);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled}>
            <PlusIcon />
            Add section
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[min(64rem,calc(100vw-2rem))]">
        <DialogTitle className="sr-only">Add section</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a section. The picture on the right shows the one highlighted.
        </DialogDescription>

        <div className="grid h-[min(42rem,85svh)] md:grid-cols-[22rem_1fr]">
          <Command value={active} onValueChange={setActive} className="min-h-0 rounded-none md:border-r" loop>
            <CommandInput placeholder="Search sections — banner, columns, quote…" />
            <CommandList className="max-h-none flex-1">
              <CommandEmpty>No section matches.</CommandEmpty>
              {SECTION_CATEGORIES.map((category) => {
                const items = SECTION_PRESETS.filter((item) => item.category === category);
                if (items.length === 0) return null;
                return (
                  <CommandGroup key={category} heading={category}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        keywords={[item.label, item.description, item.category]}
                        onSelect={() => add(item)}
                        className="gap-3 py-1.5"
                      >
                        <span className="bg-background text-foreground flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border">
                          <SectionThumbnail id={item.id} type={item.type} className="size-full" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{item.label}</span>
                          <span className="text-muted-foreground block truncate text-xs">{item.description}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>

          <div className="bg-muted/40 hidden min-h-0 flex-col p-6 md:flex">
            <div className="bg-background text-foreground flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border shadow-sm">
              <SectionThumbnail id={preset.id} type={preset.type} className="size-full p-4" />
            </div>
            <div className="mt-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium">{preset.label}</h3>
                  <Badge variant="secondary">{preset.category}</Badge>
                </div>
                <p className="text-muted-foreground mt-1.5 text-sm">{preset.description}</p>
              </div>
              <Button type="button" onClick={() => add(preset)} disabled={disabled} className="shrink-0">
                <PlusIcon />
                Add
              </Button>
            </div>
            <p className={cn("text-muted-foreground mt-auto pt-6 text-xs")}>
              Every setting can be changed after adding. Placeholder text is only a start — replace it before publishing.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
