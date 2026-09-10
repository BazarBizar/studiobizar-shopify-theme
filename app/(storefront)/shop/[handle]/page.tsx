import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { AddToInquiry } from "@/components/product/add-to-inquiry";
import { InContextGallery } from "@/components/product/in-context-gallery";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductRail } from "@/components/product/product-rail";
import { MediaText } from "@/components/sections/media-text";
import { Accordion } from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";
import {
  getCollectionProducts,
  getProduct,
  getProductRecommendations,
  getProducts,
} from "@/lib/shopify";
import { normalizeCaptionedImage } from "@/lib/shopify/entities";
import {
  metafieldImage,
  metafieldInt,
  metafieldMetaobjects,
  metafieldRichText,
  metafieldText,
  toFieldMap,
  fieldText,
  fieldImage,
  fieldRichText,
} from "@/lib/shopify/transforms";
import type { MetafieldMap, Product } from "@/lib/shopify/types";

/** The four rows above the buy controls. */
const SPEC_ROWS = [
  { key: "material_finish", label: "Material / Finish" },
  { key: "colour", label: "Colour" },
  { key: "upholstery", label: "Upholstery" },
  { key: "availability", label: "Availability" },
] as const;

/** The five disclosure panels, in design order. */
const PANELS = [
  { key: "technical_specifications", label: "Technical Specifications" },
  { key: "dimensions", label: "Dimensions" },
  { key: "care_maintenance", label: "Care & Maintenance" },
  { key: "shipping_delivery", label: "Shipping & Delivery" },
] as const;

function designerOf(metafields: MetafieldMap) {
  const reference = metafields.designer?.reference;
  if (reference?.__typename !== "Metaobject") return null;

  const entry = reference as unknown as { handle: string; fields: [] };
  const fields = toFieldMap(entry.fields);

  return {
    handle: entry.handle,
    name: fieldText(fields, "name"),
    studio: fieldText(fields, "studio"),
    byline: fieldText(fields, "byline"),
    bio: fieldRichText(fields, "bio_full") || fieldRichText(fields, "bio_short"),
    portrait: fieldImage(fields, "portrait"),
  };
}

export async function generateMetadata({
  params,
}: PageProps<"/shop/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => null);
  if (!product) return { title: "Not found" };

  return {
    title: product.seo.title ?? product.title,
    description: product.seo.description ?? product.description.slice(0, 160),
    alternates: { canonical: `/shop/${product.handle}` },
    openGraph: {
      title: product.seo.title ?? product.title,
      description: product.seo.description ?? product.description.slice(0, 160),
      images: product.image ? [{ url: product.image.url }] : undefined,
      type: "website",
    },
  };
}

/** Product schema with no `offers` — there is no price to advertise. */
function ProductJsonLd({ product }: { product: Product }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((image) => image.url),
    sku: product.variants[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: product.vendor ?? "Studio Bizar" },
    category: product.productType ?? undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function ProductPage({ params }: PageProps<"/shop/[handle]">) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const metafields = product.metafields;
  const designer = designerOf(metafields);
  const variant = product.variants[0];

  const collectionRef = metafields.signature_collection?.reference;
  const collection =
    collectionRef?.__typename === "Collection"
      ? (collectionRef as unknown as { handle: string; title: string })
      : null;

  // Shopify derives recommendations from order history, which this store has
  // none of, so fall back to the same product type.
  const [collectionProducts, recommended] = await Promise.all([
    collection
      ? getCollectionProducts({ handle: collection.handle, first: 4 }).then((page) => page.items)
      : Promise.resolve([]),
    getProductRecommendations(product.handle)
      .then((items) =>
        items.length || !product.productType
          ? items
          : getProducts({ first: 5, query: `product_type:"${product.productType}"` }).then((page) =>
              page.items.filter((item) => item.handle !== product.handle),
            ),
      )
      .catch(() => []),
  ]);

  const leadTime = metafieldText(metafields, "lead_time_weeks");

  // Availability and lead time render as one row — "Made to order | Lead
  // time of 12–16 weeks" — rather than two separate lines.
  const specs = SPEC_ROWS.map((row) => {
    const value = metafieldText(metafields, row.key);
    return {
      label: row.label,
      value: row.key === "availability" && value && leadTime ? `${value} | ${leadTime}` : value,
    };
  }).filter((row) => row.value);

  const panels = PANELS.map((panel) => ({
    label: panel.label,
    html: metafieldRichText(metafields, panel.key),
  })).filter((panel) => panel.html);

  const ideaBody = metafieldRichText(metafields, "idea_body");
  const ideaImage = metafieldImage(metafields, "idea_image");
  const moq = metafieldInt(metafields, "moq") ?? 1;
  const inContextImages = metafieldMetaobjects(metafields, "in_context_images").map(
    normalizeCaptionedImage,
  );

  return (
    <PageShell surface="light">
      <ProductJsonLd product={product} />

      <Container className="pt-8 pb-section">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} title={product.title} />

          <div className="max-w-[35rem]">
            <nav
              aria-label="Breadcrumb"
              className="text-tertiary font-medium tracking-[0.02em] text-muted uppercase"
            >
              <Link href="/shop" className="sb-underline">
                products
              </Link>
              {product.productType && (
                <>
                  <span aria-hidden> {">"} </span>
                  <span>{product.productType}</span>
                </>
              )}
            </nav>

            <h1 className="text-h1 mt-4">{product.title}</h1>

            {designer?.name && (
              <p className="text-h2 mt-3 text-muted">
                by {designer.name}
                {designer.studio ? `, ${designer.studio}` : ""}
              </p>
            )}

            {product.descriptionHtml && (
              <div
                className="sb-prose mt-8"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            )}

            {inContextImages.length > 0 && (
              <div className="mt-8 border-t border-border pt-8">
                <InContextGallery images={inContextImages} title={product.title} />
              </div>
            )}

            {specs.length > 0 && (
              <dl className="mt-12 flex flex-col gap-3">
                {specs.map((spec) => (
                  <div key={spec.label} className="grid grid-cols-[10rem_1fr] gap-4">
                    <dt className="text-h4">{spec.label}</dt>
                    <dd className="text-tertiary">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="text-h4 mt-10 border-t border-border pt-10 italic">Price on request</p>

            <div className="mt-5">
              {variant ? (
                <AddToInquiry
                  moq={moq}
                  item={{
                    variantId: variant.id,
                    productHandle: product.handle,
                    sku: variant.sku,
                    title: product.title,
                    variantTitle: variant.title === "Default Title" ? null : variant.title,
                    image: product.image?.url ?? null,
                  }}
                />
              ) : null}
            </div>

            {(panels.length > 0 || metafields.downloads) && (
              <div className="mt-12">
                {panels.map((panel) => (
                  <Accordion key={panel.label} title={panel.label}>
                    <div dangerouslySetInnerHTML={{ __html: panel.html }} />
                  </Accordion>
                ))}

                {(metafields.downloads?.references?.nodes.length ?? 0) > 0 && (
                  <Accordion title="Downloads">
                    <ul className="flex flex-col gap-2">
                      {metafields.downloads?.references?.nodes.map((node, index) => {
                        const file = node as { __typename: string; url?: string | null };
                        if (file.__typename !== "GenericFile" || !file.url) return null;
                        return (
                          <li key={file.url ?? index}>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-secondary sb-underline"
                            >
                              {file.url.split("/").pop()?.split("?")[0] ?? "Download"}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </Accordion>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>

      {ideaBody && (
        <MediaText
          title="The Idea"
          html={ideaBody}
          image={ideaImage}
          align="left"
          surface="olive"
          padding="wide"
        />
      )}

      {designer?.bio && (
        <MediaText
          title="The Designer"
          html={designer.bio}
          image={designer.portrait}
          align="right"
          link={{ href: `/designers/${designer.handle}`, label: "learn more" }}
          padding="wide"
        />
      )}

      {collection && (
        <ProductRail
          title="The Collection"
          products={collectionProducts.filter((item) => item.handle !== product.handle)}
          viewAllHref={`/collections/${collection.handle}`}
        />
      )}

      <ProductRail title="Discover More" products={recommended} viewAllHref="/shop" />
    </PageShell>
  );
}
