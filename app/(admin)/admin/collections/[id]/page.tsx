import { ExternalLinkIcon } from "lucide-react";

import { CollectionForm, type CollectionFormState } from "@/components/admin/collections-table/collection-form";
import { CollectionProducts } from "@/components/admin/collections-table/collection-products";
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { DetailHeader } from "@/components/admin/detail-header";
import { Button } from "@/components/admin/ui/button";
import {
  collectionIdFromParam,
  getCollection,
  listCollectionProducts,
  SORT_ORDER_OPTIONS,
} from "@/lib/admin/collections";
import { storefrontUrl } from "@/lib/admin/links";

export async function generateMetadata({ params }: PageProps<"/admin/collections/[id]">) {
  const { id } = await params;
  const gid = collectionIdFromParam(id);
  const collection = gid ? await getCollection(gid) : null;
  return { title: collection?.title ?? "Not found" };
}

export default async function CollectionDetailPage({ params }: PageProps<"/admin/collections/[id]">) {
  const { id } = await params;

  // Rejected before Shopify is called: the segment is the numeric part of a gid.
  const gid = collectionIdFromParam(id);
  if (!gid) return <ScreenNotFound backHref="/admin/collections" backLabel="Collections" />;

  const collection = await getCollection(gid);
  if (!collection)
    return (
      <ScreenNotFound
        backHref="/admin/collections"
        backLabel="Collections"
        description="That collection does not exist. It may have been deleted in Shopify."
      />
    );

  const products = await listCollectionProducts(gid, { first: 24 });

  const initial: CollectionFormState = {
    title: collection.title,
    handle: collection.handle,
    descriptionHtml: collection.descriptionHtml,
    sortOrder: collection.sortOrder ?? "MANUAL",
    seoTitle: collection.seo.title ?? "",
    seoDescription: collection.seo.description ?? "",
    // Shopify returns the image as a URL, not the gid it was set from, so the picker
    // starts empty and only a deliberate choice writes a new one.
    imageGid: "",
    imageAlt: collection.image?.altText ?? "",
  };

  const storeUrl = storefrontUrl(`/collections/${collection.handle}`);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <DetailHeader
        backHref="/admin/collections"
        backLabel="Collections"
        title={collection.title}
        meta={collection.handle}
      />

      <div className="flex flex-wrap gap-2">
        {storeUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={storeUrl} target="_blank" rel="noreferrer">
              View on store
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <a
            href={`https://admin.shopify.com/store/${process.env.SHOPIFY_STORE_DOMAIN?.replace(".myshopify.com", "")}/collections/${collection.param}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Shopify
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      </div>

      <CollectionForm
        mode="edit"
        id={collection.id}
        initial={initial}
        sortOrderOptions={SORT_ORDER_OPTIONS}
        ruleSet={collection.ruleSet}
      />

      <CollectionProducts
        collectionId={collection.id}
        initial={products.products}
        hasNextPage={products.hasNextPage}
        endCursor={products.endCursor}
        total={collection.productsCount}
        smart={collection.smart}
      />
    </div>
  );
}
