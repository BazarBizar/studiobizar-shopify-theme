"use client";

import { ArrowLeftIcon, ArrowRightIcon, ImageIcon, Loader2Icon, PlayIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/admin/ui/button";
import type { PickerFile } from "@/lib/admin/queries";

import { CollapsibleSection } from "./product-sections";

/**
 * Product photos. SAVES AS YOU GO — every add, remove and move is its own change in
 * Shopify, with no draft. That is deliberately the opposite of the card next to it: a
 * photo that only appeared after pressing Save somewhere else on the page would be a lie
 * about what the store contains.
 *
 *  - ADD links files already in Media to the product — no second copy is made.
 *  - REMOVE unlinks: the file stays in Media (and on any other product), so Undo simply
 *    links it back where it was.
 *  - ORDER is applied by Shopify in a background job, so a fresh read can still show the
 *    old order for a moment. This list keeps its own order, and only takes the server's
 *    when the SET of photos changes.
 */

export type ProductMediaItem = {
  id: string;
  alt: string | null;
  contentType: string;
  preview: string | null;
};

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/products/photos", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(detail?.message ?? `Failed (${response.status})`);
  }
}

const setOf = (media: ProductMediaItem[]) => media.map((item) => item.id).sort().join(",");

export function ProductMedia({
  productId,
  media,
}: {
  productId: string;
  media: ProductMediaItem[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [items, setItems] = React.useState(media);
  const [seen, setSeen] = React.useState(() => setOf(media));
  if (setOf(media) !== seen) {
    setSeen(setOf(media));
    setItems(media);
  }

  async function attach(picked: PickerFile[]) {
    if (picked.length === 0) return;
    setBusy(true);
    try {
      await send({ operation: "productPhotosAdd", id: productId, files: picked.map((file) => file.id) });
      toast.success(picked.length > 1 ? `${picked.length} photos added` : "Photo added");
      router.refresh();
    } catch (error) {
      toast.error("Could not add the photos", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const before = items;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setItems(next);
    try {
      await send({ operation: "productPhotosReorder", id: productId, moves: [{ id: item!.id, newPosition: target }] });
    } catch (error) {
      setItems(before);
      toast.error("Could not change the order", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    }
  }

  async function remove(index: number) {
    const item = items[index]!;
    const before = items;
    setItems(items.filter((_, at) => at !== index));
    try {
      await send({ operation: "productPhotosRemove", id: productId, files: [item.id] });
      router.refresh();
      toast("Photo removed from this product", {
        description: "It is still in Media.",
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await send({ operation: "productPhotosAdd", id: productId, files: [item.id] });
                // Linked back at the end; put it where it was.
                if (index < before.length - 1) {
                  await send({ operation: "productPhotosReorder", id: productId, moves: [{ id: item.id, newPosition: index }] });
                }
                setItems(before);
                setSeen(setOf(before));
                router.refresh();
              } catch (error) {
                toast.error("Could not put the photo back", {
                  description: error instanceof Error ? error.message : "Add it again with Add photos.",
                });
              }
            })();
          },
        },
      });
    } catch (error) {
      setItems(before);
      toast.error("Could not remove the photo", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    }
  }

  return (
    <CollapsibleSection
      id="media"
      title="Photos"
      description={`${items.length} ${items.length === 1 ? "photo" : "photos"}. Changes here are saved straight away. The first photo is the main one.`}
    >
      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyState title="No photos yet" description="Add the first one with Add photos." className="py-6" />
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {items.map((item, index) => (
              <li key={item.id} className="group relative overflow-hidden rounded-md border">
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

                {index === 0 ? (
                  <span className="bg-background/90 absolute top-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    Main photo
                  </span>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute top-1 right-1 opacity-90 shadow-sm"
                  aria-label={`Remove photo ${index + 1} from this product`}
                  title="Remove from this product"
                  onClick={() => void remove(index)}
                >
                  <XIcon />
                </Button>

                <div className="flex items-center justify-between gap-1 border-t px-1 py-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move photo ${index + 1} earlier`}
                    title="Move earlier"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <span className="text-muted-foreground min-w-0 truncate text-[11px]" title={item.alt ?? undefined}>
                    {item.alt || `Photo ${index + 1}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move photo ${index + 1} later`}
                    title="Move later"
                    disabled={index === items.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowRightIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setPickerOpen(true)}>
          {busy ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-3.5" />}
          {busy ? "Adding…" : "Add photos"}
        </Button>
      </div>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind="image"
        title="product photos"
        multiple
        onSelect={(picks) => void attach(picks.flatMap((pick) => (pick.file ? [pick.file] : [])))}
      />
    </CollapsibleSection>
  );
}
