"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/admin/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/admin/ui/tooltip";
import { deleteEntryRequest } from "@/lib/admin/queries";

/**
 * Delete one metaobject entry, behind a confirmation.
 *
 * WHAT THE DIALOG IS FOR. Not ceremony — the record's NAME is in the question, because
 * the mistake this catches is not "I did not mean to delete" but "I did not mean to
 * delete THAT ONE", which is the mistake a row of identical trash icons invites. Shopify
 * keeps no copy, so there is nothing to undo with afterwards.
 *
 * The button being absent for inquiries and for site settings is a courtesy. The refusal
 * that counts is `assertDeletable` in `lib/admin/metaobjects.ts`, which answers a curl
 * exactly the same way.
 */
export function DeleteEntryAction({
  entryId,
  name,
  typeLabel,
}: {
  entryId: string;
  /** Shown in the question, so the operator confirms a record rather than a row index. */
  name: string;
  /** Singular noun for this type — "designer", "FAQ item". */
  typeLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  async function remove() {
    try {
      await deleteEntryRequest({ id: entryId });
      toast.success("Deleted", { description: `${name} is removed from the site.` });
      // The list is server-rendered, so the row goes only when the screen is refetched.
      router.refresh();
    } catch (error) {
      toast.error("Could not delete", {
        description: error instanceof Error ? error.message : "Nothing was deleted.",
      });
      throw error;
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${name}`}
            onClick={() => setOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title={`Delete this ${typeLabel}?`}
        description={
          <>
            <span className="text-foreground font-medium">{name}</span> will be removed from the site. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </>
  );
}
