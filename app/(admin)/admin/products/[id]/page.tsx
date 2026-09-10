import { ExternalLinkIcon } from "lucide-react";

import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { DetailHeader } from "@/components/admin/detail-header";
import { ProductChannels } from "@/components/admin/products-table/product-channels";
import { ProductEditor } from "@/components/admin/products-table/product-editor";
import { ProductMedia } from "@/components/admin/products-table/product-media";
import {
  CollapsibleSection,
  ProductSectionProvider,
} from "@/components/admin/products-table/product-sections";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { formatDate } from "@/lib/admin/field-values";
import { buildProductMetafieldSpecs } from "@/lib/admin/product-specs";
import { storefrontUrl } from "@/lib/admin/links";
import { getProduct, getProductFilterOptions, productIdFromParam } from "@/lib/admin/products";
import { listPublications } from "@/lib/admin/publications";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const gid = productIdFromParam(id);
  const product = gid ? await getProduct(gid) : null;
  return { title: product?.title ?? "Not found" };
}

export default async function ProductDetailPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;

  const gid = productIdFromParam(id);
  if (!gid) return <ScreenNotFound backHref="/admin/products" backLabel="Products" />;

  const product = await getProduct(gid);
  if (!product)
    return (
      <ScreenNotFound
        backHref="/admin/products"
        backLabel="Products"
        description="That product does not exist. It may have been deleted in Shopify."
      />
    );

  const [specs, options, publications] = await Promise.all([
    buildProductMetafieldSpecs(product.metafields),
    getProductFilterOptions(),
    listPublications(),
  ]);

  const storeUrl = storefrontUrl(`/shop/${product.handle}`);
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN?.replace(".myshopify.com", "");

  return (
    /* Wider than a form-only page: the details list and media grid want the room. */
    <div className="w-full max-w-5xl space-y-4">
      <DetailHeader
        backHref="/admin/products"
        backLabel="Products"
        title={product.title}
        meta={product.handle}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={product.status === "ARCHIVED" ? "secondary" : "outline"}
          className={
            product.status === "ACTIVE"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : product.status === "DRAFT"
                ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : undefined
          }
        >
          {product.status.charAt(0) + product.status.slice(1).toLowerCase()}
        </Badge>

        <div className="ms-auto flex gap-2">
          {/* Built from STOREFRONT_URL: Shopify cannot answer this, because a headless
              store's primaryDomain is still the Shopify-hosted address. */}
          {storeUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={storeUrl} target="_blank" rel="noreferrer">
                View on store
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          ) : null}

          {shopDomain ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://admin.shopify.com/store/${shopDomain}/products/${product.param}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Shopify
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <ProductSectionProvider>
        <ProductMedia productId={product.id} media={product.media} />

        <ProductEditor
          productId={product.id}
          initialCore={{
            title: product.title,
            handle: product.handle,
            descriptionHtml: product.descriptionHtml,
            vendor: product.vendor,
            productType: product.productType,
            status: product.status,
            tags: product.tags,
            seoTitle: product.seo.title ?? "",
            seoDescription: product.seo.description ?? "",
          }}
          specs={specs}
          vendors={options.vendors}
          productTypes={options.productTypes}
        />

        <ProductChannels
          productId={product.id}
          channels={product.channels}
          productStatus={product.status}
          allPublications={publications}
        />

        <CollapsibleSection
          id="details"
          title="Details"
          description="Read-only. Edited in Shopify."
        >
          {/* Read-only facts as a description list, not a form with disabled inputs — a
              greyed control reads worse than plain text and offers an edit that will
              never work. */}
          <dl className="divide-border divide-y">
            {[
              ["Category", product.category?.fullName ?? "—"],
              ["Variants", String(product.variants)],
              [
                "Inventory",
                // `—`, never `0`: this catalogue is made-to-order and tracks nothing.
                product.stock === null ? "Not tracked" : String(product.stock),
              ],
              [
                "Collections",
                product.collections.length
                  ? product.collections.map((collection) => collection.title).join(", ")
                  : "—",
              ],
              ["Created", formatDate(product.createdAt, true)],
              ["Updated", formatDate(product.updatedAt, true)],
            ].map(([label, value]) => (
              <div key={label} className="py-2">
                <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </CollapsibleSection>
      </ProductSectionProvider>
    </div>
  );
}
