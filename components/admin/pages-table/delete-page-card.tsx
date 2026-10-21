"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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
  const [open, setOpen] = React.useState(false);

  async function remove() {
    try {
      await deletePageRequest(pageId);
      toast.success("Page deleted", { description: `${publicPath} no longer exists.` });
      router.push("/admin/pages");
    } catch (error) {
      toast.error("Could not delete the page", {
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
      throw error;
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

        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2Icon />
          Delete page
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          destructive
          title={`Delete “${title}”?`}
          description={`The page and everything built on it are deleted, and ${publicPath} stops working. This cannot be undone.`}
          confirmLabel="Delete page"
          onConfirm={remove}
        />
      </CardContent>
    </Card>
  );
}
