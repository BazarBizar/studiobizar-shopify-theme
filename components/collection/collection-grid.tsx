import { CollectionCard } from "@/components/collection/collection-card";
import type { CollectionCard as CollectionCardType } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/** Collection cards on the 4-up grid — the Collections page. */
export function CollectionGrid({
  collections,
  className,
}: {
  collections: CollectionCardType[];
  className?: string;
}) {
  return (
    <ul className={cn("sb-grid-4", className)}>
      {collections.map((collection) => (
        <li key={collection.id}>
          <CollectionCard collection={collection} />
        </li>
      ))}
    </ul>
  );
}
