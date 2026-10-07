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
import { Card, CardContent } from "@/components/admin/ui/card";
import { deletePageRequest } from "@/lib/admin/queries";

/**
 * Deleting a page is a page setting, so it lives here on the page's screen, not in
 * the page builder — the builder is for what the page shows.
 *
 * Offered only for pages made with the page builder. The server re-reads the page
 * and refuses anything else (`deleteBuilderPage`); a site page whose route is code
 * is never offered the button in the first place.
 */
export function DeletePageCard({ pageId, title, publicPath }: { pageId: string; title: string; publicPath: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      await deletePageRequest(pageId);
      toast.success("Page deleted", { description: `${publicPath} no longer exists.` });
      router.push("/admin/pages");
    } catch (error) {
      toast.error("Could not delete the page", {
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Delete page</h2>
          <p className="text-muted-foreground text-xs">
            Removes the page, its sections and {publicPath} for good. This cannot be undone.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm" disabled={deleting}>
              {deleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Delete page
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The page and everything built on it are deleted, and {publicPath} stops working. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void confirm()}
                disabled={deleting}
                /* As in delete-entry-action.tsx: styled as destructive, and Cancel keeps
                   the focus so a reflexive Enter cancels. */
                className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/30 text-white"
              >
                Delete page
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
