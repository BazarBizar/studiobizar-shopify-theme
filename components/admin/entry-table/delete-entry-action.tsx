"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/admin/ui/tooltip";
import { deleteEntryRequest } from "@/lib/admin/queries";
import { cn } from "@/lib/utils/cn";

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
  const [deleting, setDeleting] = React.useState(false);

  async function confirm(event: React.MouseEvent) {
    // Radix closes on click by default. Held open so the spinner is visible and so a
    // failure is seen on the dialog that caused it rather than behind it.
    event.preventDefault();
    setDeleting(true);

    try {
      await deleteEntryRequest({ id: entryId });

      toast.success("Deleted", { description: `${name} is gone from the store.` });
      setOpen(false);

      // The list is server-rendered, so the row goes only when the screen is refetched.
      // The server action already dropped the cache tags; this asks for the new HTML.
      router.refresh();
    } catch (error) {
      toast.error("Could not delete", {
        description: error instanceof Error ? error.message : "Nothing was deleted.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${name}`}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {typeLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground font-medium">{name}</span> will be removed
            from Shopify and from the storefront. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={deleting}
            /* The confirm button is the destructive one, and it is NOT the focused one —
               AlertDialog focuses Cancel, so a reflexive Enter cancels. */
            className={cn(
              "bg-destructive text-white hover:bg-destructive/90",
              "focus-visible:ring-destructive/30",
            )}
          >
            {deleting ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
