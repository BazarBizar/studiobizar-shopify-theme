"use client";

import { Loader2Icon, MoveRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/admin/app-link";
import { Button } from "@/components/admin/ui/button";
import { convertToBuilderRequest } from "@/lib/admin/queries";

/**
 * MVP-2: the screen a hand-built page shows in the builder before it has moved.
 *
 * Moving it only makes a DRAFT from what the page shows now. The page on the site
 * does not change until that draft is published — which is what lets an operator
 * look at the result in the preview, side by side with the live page, first.
 */
export function ConvertPage({ pageId, title, route }: { pageId: string; title: string; route: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function convert() {
    setBusy(true);
    try {
      await convertToBuilderRequest(pageId);
      toast.success("Moved to the page builder", {
        description: "This is a draft. The live page is unchanged until you publish.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Could not move the page", {
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 py-16">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Move “{title}” to the page builder</h1>
        <p className="text-muted-foreground text-sm">
          The page’s current content is carried over into sections you can then edit, reorder and add to.
        </p>
      </div>

      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        <li>Nothing is retyped — the heading and text it shows today become its first sections.</li>
        <li>
          It is saved as a <strong className="text-foreground">draft</strong>. {route} stays exactly as it is until you
          publish.
        </li>
        <li>The page keeps its address.</li>
      </ul>

      <div className="flex gap-2">
        <Button onClick={() => void convert()} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <MoveRightIcon />}
          Move to page builder
        </Button>
        <Button asChild variant="outline">
          <AppLink href="/admin/pages">Not now</AppLink>
        </Button>
      </div>
    </div>
  );
}
