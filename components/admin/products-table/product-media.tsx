"use client";

import { ImageIcon, Loader2Icon, PlayIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/admin/ui/button";
import type { PickerFile } from "@/lib/admin/queries";

import { CollapsibleSection } from "./product-sections";

/**
 * Product media. SAVES AS YOU GO — adding is its own Shopify mutation, with no draft.
 *
 * That is deliberately the opposite of the core-fields card next to it. A photo that only
 * appeared after pressing Save somewhere else on the page would be a lie about what the
 * store contains, so there is no Save button here at all.
 *
 * TWO SHOPIFY FACTS THIS UI HAS TO ADMIT TO:
 *
 *  - Attaching by URL ALWAYS CREATES A NEW FILE in the library. There is no
 *    "attach the existing file", so choosing the same image for two products leaves two
 *    copies — and detaching one must not delete the other, which is why removal is
 *    Shopify-side rather than a delete here.
 *  - Reordering returns a BACKGROUND JOB, so the new order is not live the instant the
 *    call returns. Saying so beats re-reading and showing the old order as if the change
 *    had failed.
 */

export type ProductMediaItem = {
  id: string;
  alt: string | null;
  contentType: string;
  preview: string | null;
};

export function ProductMedia({
  productId,
  media,
}: {
  productId: string;
  media: ProductMediaItem[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [attaching, setAttaching] = React.useState(false);

  async function attach(file: PickerFile) {
    if (!file.url && !file.thumbnail) {
      toast.error("That file has no source yet", {
        description: "Shopify is still processing it. Try again in a moment.",
      });
      return;
    }

    setAttaching(true);

    try {
      const response = await fetch("/api/admin/products/update", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "productUpdate",
          id: productId,
          attachMedia: [
            {
              originalSource: file.url ?? file.thumbnail,
              ...(file.alt ? { alt: file.alt } : {}),
              mediaContentType: file.kind === "Video" ? "VIDEO" : "IMAGE",
            },
          ],
        }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? `Failed (${response.status})`);
      }

      toast.success("Image added", {
        // Said plainly, because it surprises people who expect a reference.
        description: "Shopify copies the file when it is attached, so the library now has a copy.",
      });

      router.refresh();
    } catch (error) {
      toast.error("Could not add the image", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    } finally {
      setAttaching(false);
    }
  }

  return (
    <CollapsibleSection
      id="media"
      title="Media"
      description={`${media.length} file(s). Changes here save immediately.`}
    >
      <div className="space-y-3">
        {media.length === 0 ? (
          <p className="text-muted-foreground text-sm">No media on this product yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {media.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-md border">
                <span className="bg-muted flex aspect-square items-center justify-center">
                  {item.preview ? (
                    <Image
                      src={item.preview}
                      alt={item.alt ?? ""}
                      width={140}
                      height={140}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : item.contentType === "VIDEO" ? (
                    <PlayIcon className="text-muted-foreground size-5" />
                  ) : (
                    <ImageIcon className="text-muted-foreground size-5" />
                  )}
                </span>
                <span className="text-muted-foreground block truncate px-1.5 py-1 text-[11px]">
                  {item.alt || item.contentType.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={attaching}
            onClick={() => setPickerOpen(true)}
          >
            {attaching ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-3.5" />
            )}
            {attaching ? "Adding…" : "Add image"}
          </Button>

          <p className="text-muted-foreground text-xs">
            Removing and reordering media is still done in Shopify.
          </p>
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind="image"
        title="product image"
        onSelect={attach}
      />
    </CollapsibleSection>
  );
}
