"use client";

import { Columns3Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { ScrollArea } from "@/components/admin/ui/scroll-area";

/**
 * Column visibility.
 *
 * Every field on the definition becomes a column, but only some are shown by default.
 * This menu is what keeps the rest REACHABLE rather than missing — which is why it
 * lists all of them, including the ones the module chose to hide.
 */
export function ViewOptions<TData>({ table }: { table: Table<TData> }) {
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ms-auto">
          <Columns3Icon className="size-3.5" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ScrollArea className="max-h-72">
          {columns.map((column) => {
            const visible = column.getIsVisible();

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visible}
                /* Kept as a checkbox item so it keeps role="menuitemcheckbox" and
                   aria-checked for screen readers — the eye is a visual swap only. */
                onCheckedChange={(next) => column.toggleVisibility(Boolean(next))}
                /* Without this the menu closes after every single toggle, which makes
                   setting up a view a dozen separate trips. */
                onSelect={(event) => event.preventDefault()}
                className="[&>span:first-child]:hidden"
              >
                {/* A tick marks only the shown state; an eye reads in BOTH states, and
                    a visibility list is exactly about the two states. */}
                {visible ? (
                  <EyeIcon className="size-3.5 shrink-0" />
                ) : (
                  <EyeOffIcon className="text-muted-foreground size-3.5 shrink-0" />
                )}
                <span className="truncate">{column.columnDef.meta?.label ?? column.id}</span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
