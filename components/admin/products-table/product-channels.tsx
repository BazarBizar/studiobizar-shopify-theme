"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Switch } from "@/components/admin/ui/switch";
import { formatDate } from "@/lib/admin/field-values";

import { CollapsibleSection } from "./product-sections";

/**
 * Channel assignment. Each switch SAVES IMMEDIATELY — it is not part of any form's Save,
 * because a switch that looked flipped but was not yet stored would be lying about where
 * the product is live.
 */

export type Channel = {
  publicationId: string;
  name: string;
  /** ASSIGNED to the channel — not the same as live. See below. */
  assigned: boolean;
  publishDate: string | null;
};

export function ProductChannels({
  productId,
  channels,
  productStatus,
  allPublications,
}: {
  productId: string;
  channels: Channel[];
  productStatus: string;
  /** Every publication in the store, so unassigned ones can still be switched on. */
  allPublications: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const assigned = React.useMemo(
    () => new Map(channels.map((channel) => [channel.publicationId, channel])),
    [channels],
  );

  const isDraft = productStatus === "DRAFT";
  const liveCount = channels.filter((channel) => channel.assigned && !isDraft).length;

  async function toggle(publicationId: string, publish: boolean) {
    setPending(publicationId);

    try {
      const response = await fetch("/api/admin/products/publish", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "publishable", id: productId, publicationId, publish }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? `Failed (${response.status})`);
      }

      router.refresh();
    } catch (error) {
      toast.error("Could not change the channel", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <CollapsibleSection
      id="channels"
      title="Channels"
      description={`${liveCount} of ${allPublications.length} live`}
    >
      <ul className="divide-border divide-y">
        {allPublications.map((publication) => {
          const channel = assigned.get(publication.id);
          const isAssigned = Boolean(channel?.assigned);

          /**
           * The sub-label describes the ACTUAL state, which needs both facts. A draft
           * product keeps its channel assignments while reporting `isPublished: false`
           * everywhere — so binding the switch to published state would show every
           * channel as off for a product that is genuinely on them.
           */
          const detail = !isAssigned
            ? "Not on this channel"
            : isDraft
              ? "On this channel, hidden while the product is a draft"
              : channel?.publishDate
                ? `Live since ${formatDate(channel.publishDate, false)}`
                : "On this channel, not live yet";

          return (
            <li key={publication.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{publication.name}</p>
                <p className="text-muted-foreground text-xs">{detail}</p>
              </div>

              <Switch
                checked={isAssigned}
                disabled={pending === publication.id}
                aria-label={`Publish to ${publication.name}`}
                onCheckedChange={(next) => toggle(publication.id, next)}
              />
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}
