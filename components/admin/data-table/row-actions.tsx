"use client";

import { EyeIcon, PencilIcon } from "lucide-react";
import type * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { Button } from "@/components/admin/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/admin/ui/tooltip";

/**
 * The right-hand actions of a table row, shared by every table in the panel so a row
 * behaves the same whether it holds a product, a collection or a FAQ item.
 *
 * ICONS, NOT WORDS, and the tooltip is not decoration — it is the label. An icon-only
 * control that says nothing on hover is a guess, so every action here carries both a
 * tooltip for the pointer and an `aria-label` naming the record for a screen reader:
 * "Edit Villa Seminyak", never a column of twelve identical "Edit"s.
 *
 * The row's name cell links to the same place. That is deliberate redundancy: the name
 * is the obvious thing to click, and this column is what remains when the name column is
 * hidden through the column menu.
 */
export function RowActions({
  href,
  /** The record's own name, for the accessible label. */
  label,
  /** Read-only records get an eye: the destination shows, it does not edit. */
  readOnly = false,
  children,
}: {
  href: string;
  label: string;
  readOnly?: boolean;
  /** Extra actions, rendered after the link — a delete button, typically. */
  children?: React.ReactNode;
}) {
  const verb = readOnly ? "View" : "Edit";
  const Icon = readOnly ? EyeIcon : PencilIcon;

  return (
    /* `justify-end` and not `justify-center`: the actions column is the last one, and a
       ragged right edge across rows reads as misalignment rather than as spacing. */
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm">
            <AppLink
              href={href}
              /* No pending dot: it would sit inside a 28px square button and push the
                 icon off centre. The row is a link, not a form. */
              showPending={false}
              aria-label={`${verb} ${label}`}
            >
              <Icon className="size-3.5" />
            </AppLink>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{verb}</TooltipContent>
      </Tooltip>

      {children}
    </div>
  );
}
