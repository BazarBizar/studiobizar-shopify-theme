import { PlusIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { CollectionsTable, type CollectionRowData } from "@/components/admin/collections-table/collections-table";
import { FeaturedCollections } from "@/components/admin/collections-table/featured-collections";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { CollectionTabs } from "@/components/admin/collections-table/collection-tabs";
import { listCollections, sortOrderLabel } from "@/lib/admin/collections";
import { getFeaturedCollections } from "@/lib/admin/site-settings";

/**
 * Collections, in two tabs held in `?tab=`.
 *
 * A static segment, so it takes precedence over the generic `/admin/[slug]` metaobject
 * route. A metaobject type literally named `collections` would be shadowed by this —
 * `reservedSlug()` in `lib/admin/navigation.ts` flags that rather than letting the link
 * quietly lead somewhere else.
 */
export const metadata = { title: "Collections" };

export default async function CollectionsPage({ searchParams }: PageProps<"/admin/collections">) {
  const { tab } = await searchParams;
  const active = tab === "featured" ? "featured" : "all";

  const collections = await listCollections();

  const rows: CollectionRowData[] = collections.map((collection) => ({
    id: collection.id,
    param: collection.param,
    title: collection.title,
    handle: collection.handle,
    updatedAt: collection.updatedAt,
    sortOrderLabel: sortOrderLabel(collection.sortOrder),
    productsCount: collection.productsCount,
    image: collection.image,
    kind: collection.smart ? "Smart" : "Manual",
  }));

  const featured = active === "featured" ? await getFeaturedCollections() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description={`${collections.length} collections, edited straight on Shopify.`}
        actions={
          <Button asChild size="sm">
            <AppLink href="/admin/collections/new" showPending={false}>
              <PlusIcon className="size-3.5" />
              New collection
            </AppLink>
          </Button>
        }
      />

      <CollectionTabs active={active} />

      {active === "all" ? (
        <CollectionsTable rows={rows} />
      ) : (
        <FeaturedCollections
          settingsId={featured!.settingsId}
          selected={featured!.selected}
          options={rows.map((row) => ({
            id: row.id,
            label: row.title,
            thumbnail: row.image?.url ?? null,
          }))}
        />
      )}
    </div>
  );
}
