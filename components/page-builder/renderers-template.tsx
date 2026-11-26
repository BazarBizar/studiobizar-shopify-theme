import "server-only";

import Image from "next/image";
import Link from "next/link";

import { CollectionGrid } from "@/components/collection/collection-grid";
import { CollectionHighlightGrid } from "@/components/collection/collection-highlight-grid";
import { AddToInquiry } from "@/components/product/add-to-inquiry";
import { InContextGallery } from "@/components/product/in-context-gallery";
import { ProductCardGrid } from "@/components/product/product-card-grid";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductRail } from "@/components/product/product-rail";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectControls } from "@/components/project/project-controls";
import { ProjectGallery } from "@/components/project/project-gallery";
import { MediaText } from "@/components/sections/media-text";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopControls } from "@/components/shop/shop-controls";
import { Accordion } from "@/components/ui/accordion";
import { Carousel } from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { carouselView, DESIGNED } from "@/lib/page-builder/carousel";
import { headingLook, tint } from "@/lib/page-builder/template-look";
import { richTextToHtml } from "@/lib/shopify/transforms";
import {
  DEFAULT_SORT,
  METAOBJECT_TYPES,
  PRODUCTS_PER_PAGE,
  countCollectionProducts,
  countProducts,
  getCollectionProducts,
  getListedCollections,
  getMetaobjects,
  getPage,
  getProductDetails,
  getProductRecommendations,
  getProducts,
  getProductsByDesigner,
  getProductsByIds,
  getShopCategories,
  getSiteTexts,
  searchProducts,
} from "@/lib/shopify";
import { categoryQuery, findCategory } from "@/lib/shopify/categories";
import {
  catalogueFilterKey,
  catalogueFilterLabel,
  catalogueFilterQuery,
  catalogueProductFilters,
  combineQueries,
  hasCatalogueFilter,
  readCatalogueFilter,
} from "@/lib/shopify/catalogue-filter";
import { normalizeCaptionedImage, normalizeProjectCard, sortProjects } from "@/lib/shopify/entities";
import { AVAILABILITY_KEY } from "@/lib/shopify/product-details";
import {
  cdnImage,
  fieldImage,
  fieldRichText,
  fieldText,
  metafieldHtml,
  metafieldImage,
  metafieldInt,
  metafieldMetaobjects,
  metafieldRichText,
  metafieldText,
  toFieldMap,
} from "@/lib/shopify/transforms";
import type { MetafieldMap } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Look } from "./card-look";
import { renderer, type RenderContext, type SearchParams, type TemplateRecord } from "./renderer-kit";

/**
 * The templates' own sections (`lib/page-builder/sections-template.ts`) — each draws
 * part of the item a template page shows, with the markup its route drew before the
 * templates existed, so a template left as it was is that page exactly (proved by
 * `yarn check:templates`).
 *
 * Every one reads the item from `context.record`. Without the item it is meant for —
 * which the write paths make impossible — it draws nothing. Where the item simply
 * lacks what a section shows (a product with no designer), the live page leaves the
 * section out, as the route always did; the editor's preview shows a note instead, so
 * a section never seems to vanish.
 */

/* -------------------------------------------------------------------------- *
 * Shared
 * -------------------------------------------------------------------------- */

type Of<K extends TemplateRecord["kind"]> = Extract<TemplateRecord, { kind: K }>;

function recordOf<K extends TemplateRecord["kind"]>(context: RenderContext, kind: K): Of<K> | null {
  return context.record?.kind === kind ? (context.record as Of<K>) : null;
}

/** In the editor's preview only: why a section shows nothing for this item. */
function Absent({ preview, children }: { preview?: boolean; children: React.ReactNode }) {
  if (!preview) return null;
  return (
    <Container className="py-6">
      <p className="text-secondary rounded border border-dashed border-current/30 px-4 py-3 text-muted">{children}</p>
    </Container>
  );
}

const pick = (value: string, fallback: string) => value.trim() || fallback;


/** A colour laid over a photograph, under whatever is drawn on it. */
function Overlay({ s, className }: { s: { overlay: string; overlayColor: string; overlayOpacity: number }; className?: string }) {
  if (s.overlay !== "color") return null;
  // Black until another colour is picked: choosing "A colour" shows at once.
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)} style={{ background: tint(s.overlayColor || "#000000", s.overlayOpacity) }} />;
}

type DesignerRef = {
  handle: string;
  name: string | null;
  studio: string | null;
  bio: string;
  portrait: ReturnType<typeof fieldImage>;
};

/** The designer a product or collection names — the routes' `designerOf`. */
function designerOf(metafields: MetafieldMap): DesignerRef | null {
  const reference = metafields.designer?.reference;
  if (reference?.__typename !== "Metaobject") return null;
  const entry = reference as unknown as { handle: string; fields: [] };
  const fields = toFieldMap(entry.fields);
  return {
    handle: entry.handle,
    name: fieldText(fields, "name"),
    studio: fieldText(fields, "studio"),
    bio: fieldRichText(fields, "bio_full") || fieldRichText(fields, "bio_short"),
    portrait: fieldImage(fields, "portrait"),
  };
}

/** A list page's intro: the one typed in the section, else its Shopify page's summary. */
async function introFor(typed: string, handle: string): Promise<string | null> {
  if (typed.trim()) return typed.trim();
  const page = await getPage(handle).catch(() => null);
  return page?.bodySummary || null;
}

const param = (params: SearchParams, key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

/* -------------------------------------------------------------------------- *
 * Product page
 * -------------------------------------------------------------------------- */

async function loadProductMain(context: RenderContext) {
  const record = recordOf(context, "product");
  if (!record) return null;
  const [texts, details] = await Promise.all([getSiteTexts(), getProductDetails()]);
  return { product: record.product, texts, details };
}

const productMain = renderer<"product_main", Awaited<ReturnType<typeof loadProductMain>>>({
  load: (_, context) => loadProductMain(context),
  render: (s, data) => {
    if (!data) return null;
    const { product, texts, details } = data;
    const metafields = product.metafields;
    const designer = designerOf(metafields);
    const variant = product.variants[0];
    const leadTime = metafieldText(metafields, "lead_time_weeks");
    const moq = metafieldInt(metafields, "moq") ?? 1;

    const specs = details.rows
      .map((row) => {
        const value = metafieldText(metafields, row.key);
        return { label: row.label, value: row.key === AVAILABILITY_KEY && value && leadTime ? `${value} | ${leadTime}` : value };
      })
      .filter((row) => row.value);
    const panels = details.panels
      .map((panel) => ({ label: panel.label, html: metafieldHtml(metafields, panel.key) }))
      .filter((panel) => panel.html);
    const inContextImages = metafieldMetaobjects(metafields, "in_context_images").map(normalizeCaptionedImage);
    const downloads = metafields.downloads?.references?.nodes ?? [];

    const part = (block: (typeof s.blocks)[number]): React.ReactNode => {
      switch (block.type) {
        case "breadcrumb":
          return (
            <nav key={block.id} aria-label="Breadcrumb" className="text-tertiary font-medium tracking-[0.02em] text-muted uppercase">
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
          );
        case "title": {
          const look = headingLook(s, "text-h1");
          return (
            <h1 key={block.id} className={`${look.className} mt-4`} style={look.style}>
              {product.title}
            </h1>
          );
        }
        case "designer":
          return designer?.name ? (
            <p key={block.id} className="text-h2 mt-3 text-muted">
              {block.settings.prefix.trim() ? `${block.settings.prefix.trim()} ` : ""}
              {designer.name}
              {designer.studio ? `, ${designer.studio}` : ""}
            </p>
          ) : null;
        case "description":
          return product.descriptionHtml ? (
            <div key={block.id} className="sb-prose mt-8" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          ) : null;
        case "in_context":
          return inContextImages.length > 0 ? (
            <div key={block.id} className="mt-8 border-t border-border pt-8">
              <InContextGallery images={inContextImages} title={product.title} />
            </div>
          ) : null;
        case "specs":
          return specs.length > 0 ? (
            <dl key={block.id} className="mt-12 flex flex-col gap-3">
              {specs.map((spec) => (
                <div key={spec.label} className="grid grid-cols-[10rem_1fr] gap-4">
                  <dt className="text-h4">{spec.label}</dt>
                  <dd className="text-tertiary">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null;
        case "price":
          return (
            <p key={block.id} className="text-h4 mt-10 border-t border-border pt-10 italic">
              {texts["product.priceOnRequest"]}
            </p>
          );
        case "inquiry":
          return (
            <div key={block.id} className="mt-5">
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
          );
        case "panels": {
          const withDownloads = block.settings.downloads && metafields.downloads;
          if (panels.length === 0 && !withDownloads) return null;
          return (
            <div key={block.id} className="mt-12">
              {panels.map((panel) => (
                <Accordion key={panel.label} title={panel.label}>
                  <div dangerouslySetInnerHTML={{ __html: panel.html }} />
                </Accordion>
              ))}
              {block.settings.downloads && downloads.length > 0 && (
                <Accordion title={texts["product.panelDownloads"]}>
                  <ul className="flex flex-col gap-2">
                    {downloads.map((node, index) => {
                      const file = node as { __typename: string; url?: string | null };
                      if (file.__typename !== "GenericFile" || !file.url) return null;
                      return (
                        <li key={file.url ?? index}>
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-secondary sb-underline">
                            {file.url.split("/").pop()?.split("?")[0] ?? "Download"}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </Accordion>
              )}
            </div>
          );
        }
        case "text": {
          const html = richTextToHtml(block.settings.body);
          return html ? <div key={block.id} className="sb-prose mt-8" dangerouslySetInnerHTML={{ __html: html }} /> : null;
        }
      }
    };

    // The photos' share of the row; with the photos on the right, the columns swap.
    const right = s.galleryPosition === "right";
    const columns =
      s.galleryWidth === "wide"
        ? right ? "lg:grid-cols-[2fr_3fr]" : "lg:grid-cols-[3fr_2fr]"
        : s.galleryWidth === "narrow"
          ? right ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-[2fr_3fr]"
          : "lg:grid-cols-2";
    const gap = s.columnGap === "tight" ? "gap-8 lg:gap-8" : s.columnGap === "roomy" ? "gap-16 lg:gap-28" : "gap-12 lg:gap-16";
    return (
      <Container className="pt-8 pb-section">
        <div className={`grid ${gap} ${columns}`}>
          <ProductGallery images={product.images} title={product.title} />
          <div className={cn("max-w-[35rem]", right && "lg:order-first", s.sticky && "lg:sticky lg:top-24 lg:self-start")}>
            {s.blocks.map(part)}
          </div>
        </div>
      </Container>
    );
  },
});

async function loadTexts<K extends TemplateRecord["kind"]>(context: RenderContext, kind: K) {
  const record = recordOf(context, kind);
  return record ? { record, texts: await getSiteTexts() } : null;
}

const productIdea = renderer<"product_idea", Awaited<ReturnType<typeof loadTexts<"product">>>>({
  load: (_, context) => loadTexts(context, "product"),
  render: (s, data, { preview }) => {
    if (!data) return null;
    const metafields = data.record.product.metafields;
    const body = metafieldRichText(metafields, "idea_body");
    if (!body) return <Absent preview={preview}>The idea — this product has no idea text, so the section is left out of its page.</Absent>;
    return (
      <MediaText
        title={pick(s.title, data.texts["product.idea"])}
        html={body}
        image={metafieldImage(metafields, "idea_image")}
        align={s.align}
        surface={s.tone === "olive" ? "olive" : undefined}
        padding={s.padding}
        imageWidth={s.imageWidth}
        ratio={s.ratio}
        verticalAlign={s.verticalAlign}
      />
    );
  },
});

const productDesigner = renderer<"product_designer", Awaited<ReturnType<typeof loadTexts<"product">>>>({
  load: (_, context) => loadTexts(context, "product"),
  render: (s, data, { preview }) => {
    if (!data) return null;
    const designer = designerOf(data.record.product.metafields);
    if (!designer?.bio) return <Absent preview={preview}>About the designer — this product names no designer with a biography.</Absent>;
    return (
      <MediaText
        title={pick(s.title, data.texts["product.designer"])}
        html={designer.bio}
        image={designer.portrait}
        align={s.align}
        link={{ href: `/designers/${designer.handle}`, label: pick(s.linkLabel, data.texts["product.designerLink"]) }}
        padding={s.padding}
        imageWidth={s.imageWidth}
        ratio={s.ratio}
        verticalAlign={s.verticalAlign}
        buttonVariant={s.buttonStyle}
      />
    );
  },
});

async function loadProductCollection(limit: number, context: RenderContext) {
  const record = recordOf(context, "product");
  if (!record) return null;
  const reference = record.product.metafields.signature_collection?.reference;
  const collection = reference?.__typename === "Collection" ? (reference as unknown as { handle: string; title: string }) : null;
  const [texts, products] = await Promise.all([
    getSiteTexts(),
    collection ? getCollectionProducts({ handle: collection.handle, first: limit }).then((page) => page.items) : Promise.resolve([]),
  ]);
  return { collection, texts, products: products.filter((item) => item.handle !== record.product.handle) };
}

const productCollection = renderer<"product_collection", Awaited<ReturnType<typeof loadProductCollection>>>({
  load: (s, context) => loadProductCollection(s.limit, context),
  render: (s, data, { preview }) => {
    if (!data) return null;
    if (!data.collection) return <Absent preview={preview}>More from the collection — this product is in no signature collection.</Absent>;
    return (
      <Look s={s}>
        <ProductRail
          title={pick(s.title, data.texts["product.collection"])}
          products={data.products}
          viewAllHref={s.viewAll ? `/collections/${data.collection.handle}` : undefined}
          viewAllLabel={pick(s.viewAllLabel, "view all")}
          viewAllPlacement={s.viewAllPlacement}
          view={carouselView(s, DESIGNED.row)}
        />
      </Look>
    );
  },
});

async function loadRecommendations(context: RenderContext) {
  const record = recordOf(context, "product");
  if (!record) return null;
  const { product } = record;
  // Shopify derives recommendations from order history, which this store has none of,
  // so fall back to the same product type — as the route always has.
  const [texts, products] = await Promise.all([
    getSiteTexts(),
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
  return { texts, products };
}

const productRecommendations = renderer<"product_recommendations", Awaited<ReturnType<typeof loadRecommendations>>>({
  load: (_, context) => loadRecommendations(context),
  render: (s, data) =>
    data ? (
      <Look s={s}>
        <ProductRail
          title={pick(s.title, data.texts["product.discover"])}
          products={data.products}
          viewAllHref={s.viewAll ? "/shop" : undefined}
          viewAllLabel={pick(s.viewAllLabel, "view all")}
          viewAllPlacement={s.viewAllPlacement}
          view={carouselView(s, DESIGNED.row)}
        />
      </Look>
    ) : null,
});

/* -------------------------------------------------------------------------- *
 * Collection page
 * -------------------------------------------------------------------------- */

const HERO_HEIGHT = {
  standard: "min-h-[32rem] lg:min-h-[44rem]",
  short: "min-h-[20rem] lg:min-h-[28rem]",
  screen: "min-h-svh",
} as const;

const collectionHero = renderer<"collection_hero", null>({
  load: async () => null,
  render: (s, _, context) => {
    const record = recordOf(context, "collection");
    if (!record) return null;
    const { collection } = record;
    const wordmark = collection.title.replace(/^The\s+/i, "").replace(/\s+Collection$/i, "");
    return (
      // The design lays a 128px wordmark over a full-bleed image.
      <section data-surface="dark" className={cn("relative isolate flex items-center justify-center overflow-hidden", HERO_HEIGHT[s.height])}>
        {collection.heroImage && (
          <Image
            src={cdnImage(collection.heroImage.url)}
            alt={collection.heroImage.altText ?? collection.title}
            fill
            priority
            className="-z-10 object-cover"
            sizes="100vw"
          />
        )}
        <Overlay s={s} className="-z-[5]" />
        {collection.logo && s.logo ? (
          <Image
            src={cdnImage(collection.logo.url)}
            alt={collection.title}
            width={600}
            height={200}
            className="h-auto w-[min(60vw,38rem)] object-contain"
          />
        ) : (
          <h1
            className={`${s.nameSize === "display" ? "text-display" : s.nameSize === "h1" ? "text-h1" : "text-display-lg"} px-gutter text-center leading-none tracking-[0.02em] text-foreground uppercase`}
            style={s.nameColor ? { color: s.nameColor } : undefined}
          >
            {wordmark}
          </h1>
        )}
      </section>
    );
  },
});

const collectionIdea = renderer<"collection_idea", null>({
  load: async () => null,
  render: (s, _, context) => {
    const record = recordOf(context, "collection");
    if (!record) return null;
    const metafields = record.collection.metafields;
    const body = metafieldRichText(metafields, "idea_body");
    if (!body) return <Absent preview={context.preview}>The idea — this collection has no idea text, so the section is left out of its page.</Absent>;
    return (
      <MediaText
        title={pick(s.title, metafieldText(metafields, "idea_title") ?? "The Idea")}
        html={body}
        image={metafieldImage(metafields, "idea_image")}
        align={s.align}
        padding={s.padding}
        imageWidth={s.imageWidth}
        ratio={s.ratio}
        verticalAlign={s.verticalAlign}
      />
    );
  },
});

const collectionDesigner = renderer<"collection_designer", Awaited<ReturnType<typeof loadTexts<"collection">>>>({
  load: (_, context) => loadTexts(context, "collection"),
  render: (s, data, { preview }) => {
    if (!data) return null;
    const designer = designerOf(data.record.collection.metafields);
    if (!designer?.bio) return <Absent preview={preview}>About the designer — this collection names no designer with a biography.</Absent>;
    return (
      <MediaText
        title={pick(s.title, data.texts["collection.designer"])}
        html={designer.bio}
        image={designer.portrait}
        align={s.align}
        link={{ href: `/designers/${designer.handle}`, label: pick(s.linkLabel, "learn more") }}
        surface={s.tone === "olive" ? "olive" : undefined}
        padding={s.padding}
        imageWidth={s.imageWidth}
        ratio={s.ratio}
        verticalAlign={s.verticalAlign}
        buttonVariant={s.buttonStyle}
      />
    );
  },
});

async function loadCollectionProducts(limit: number, context: RenderContext) {
  const record = recordOf(context, "collection");
  if (!record) return null;
  const page = await getCollectionProducts({ handle: record.collection.handle, first: limit });
  return { collection: record.collection, products: page.items };
}

const collectionProducts = renderer<"collection_products", Awaited<ReturnType<typeof loadCollectionProducts>>>({
  load: (s, context) => loadCollectionProducts(s.limit, context),
  render: (s, data) => {
    if (!data) return null;
    const { collection, products } = data;
    return (
      <Container className="pb-section">
        {s.showTitle && (
          <h2 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
            {collection.title}
          </h2>
        )}
        {s.showDescription && collection.descriptionHtml && (
          <div className="sb-prose mt-6 max-w-[46rem]" dangerouslySetInnerHTML={{ __html: collection.descriptionHtml }} />
        )}
        <div className={s.showTitle || s.showDescription ? "mt-12" : undefined}>
          <Look s={s}>
            {s.layout === "grid" ? <ProductCardGrid products={products} /> : <CollectionHighlightGrid products={products} />}
          </Look>
        </div>
      </Container>
    );
  },
});

const collectionInContext = renderer<"collection_in_context", Awaited<ReturnType<typeof loadTexts<"collection">>>>({
  load: (_, context) => loadTexts(context, "collection"),
  render: (s, data, { preview }) => {
    if (!data) return null;
    const projects = metafieldMetaobjects(data.record.collection.metafields, "in_context_projects").map((entry) => {
      const fields = toFieldMap(entry.fields);
      return {
        handle: entry.handle,
        title: fieldText(fields, "title"),
        location: fieldText(fields, "location"),
        image: fieldImage(fields, "card_image") ?? fieldImage(fields, "hero_image"),
      };
    });
    if (projects.length === 0) return <Absent preview={preview}>Projects with this collection — none are chosen on this collection.</Absent>;
    const title = pick(s.title, data.texts["collection.inContext"]);
    return (
      // Full-bleed on charcoal-blue — edge to edge across the row.
      <section data-surface="blue" className="bg-background py-section text-foreground">
        <Container>
          <h2 className={`${headingLook(s, "text-h2").className} mb-8`} style={headingLook(s, "text-h2").style}>
            {title}
          </h2>
        </Container>
        <Look s={s}>
        <Carousel ariaLabel={title} gap="none" slideClassName="w-full sm:w-1/2 lg:w-1/3">
          {projects.map((project) => (
            <Link key={project.handle} href={`/projects/${project.handle}`} className="group block">
              <div className="relative aspect-3/4 overflow-hidden bg-foreground/10">
                {project.image && (
                  <Image
                    src={cdnImage(project.image.url)}
                    alt={project.image.altText ?? project.title ?? ""}
                    fill
                    className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
                    sizes="(max-width: 749px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  />
                )}
              </div>
              <div className="px-gutter mt-3">
                <h3 className="text-h4">{project.title}</h3>
                {project.location && <p className="text-secondary text-muted italic">{project.location}</p>}
              </div>
            </Link>
          ))}
        </Carousel>
        </Look>
      </section>
    );
  },
});

/* -------------------------------------------------------------------------- *
 * Project page
 * -------------------------------------------------------------------------- */

const PROJECT_SHAPE = {
  standard: "aspect-[2/3] sm:aspect-[16/10] lg:aspect-[16/8]",
  wide: "aspect-[16/9]",
  screen: "h-svh",
} as const;

const projectHero = renderer<"project_hero", null>({
  load: async () => null,
  render: (s, _, context) => {
    const record = recordOf(context, "project");
    if (!record) return null;
    const { project } = record;
    if (!project.heroImage) return <Absent preview={context.preview}>Project photo — this project has no main photograph.</Absent>;
    return (
      <div className={cn("relative w-full overflow-hidden", PROJECT_SHAPE[s.height])}>
        <Image src={cdnImage(project.heroImage.url)} alt={project.heroImage.altText ?? project.title} fill priority className="object-cover" sizes="100vw" />
        <Overlay s={s} />
      </div>
    );
  },
});

/** location / year / creative lead / collaborators / photography */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-secondary text-muted lowercase">{label}</dt>
      {/* Collaborators arrive as a multi-line field; each credit gets its own line. */}
      <dd className="text-secondary mt-1 whitespace-pre-line">{value}</dd>
    </div>
  );
}

const projectDetails = renderer<"project_details", null>({
  load: async () => null,
  render: (s, _, context) => {
    const record = recordOf(context, "project");
    if (!record) return null;
    const { project } = record;
    const meta = s.showCredits
      ? [
          { label: "location", value: project.location },
          { label: "year", value: project.year },
          { label: "creative lead", value: project.creativeLead },
          { label: "collaborators", value: project.collaborators },
          { label: "photography", value: project.photography },
        ].filter((row): row is { label: string; value: string } => Boolean(row.value))
      : [];
    const body = s.showBody ? project.bodyHtml : null;
    return (
      <Container className="py-section">
        <header className="max-w-[46rem]">
          <h1 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
            {project.title}
          </h1>
          {s.showSubtitle && project.subtitle && <p className="text-h2 mt-4 text-muted">{project.subtitle}</p>}
        </header>

        {(s.showCredits || s.showBody) && (
          <div className={s.creditsPlacement === "above" ? "mt-14 flex flex-col gap-10" : "mt-14 grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-20"}>
            {meta.length > 0 && (
              <dl className={s.creditsPlacement === "above" ? "flex flex-wrap gap-x-12 gap-y-6" : "flex flex-col gap-6"}>
                {meta.map((row) => (
                  <MetaRow key={row.label} label={row.label} value={row.value} />
                ))}
              </dl>
            )}
            {body && <div className="sb-prose max-w-[38rem]" dangerouslySetInnerHTML={{ __html: body }} />}
          </div>
        )}

        {s.showGallery && project.gallery.length > 0 && (
          <div className="mt-16">
            <ProjectGallery images={project.gallery} title={project.title} />
          </div>
        )}
      </Container>
    );
  },
});

async function loadProjectFeatured(context: RenderContext) {
  const record = recordOf(context, "project");
  if (!record) return null;
  const [texts, products] = await Promise.all([
    getSiteTexts(),
    getProductsByIds(record.project.featuredProductIds).catch((error: unknown) => {
      console.error(`[templates/project] featured items failed`, error);
      return [];
    }),
  ]);
  return { texts, products };
}

const projectFeatured = renderer<"project_featured", Awaited<ReturnType<typeof loadProjectFeatured>>>({
  load: (_, context) => loadProjectFeatured(context),
  render: (s, data, { preview }) => {
    if (!data) return null;
    if (data.products.length === 0) return <Absent preview={preview}>Pieces in this project — no products are chosen on this project.</Absent>;
    return (
      <Look s={s}>
        <ProductRail
          title={pick(s.title, data.texts["project.featured"])}
          products={data.products}
          viewAllHref={s.viewAll ? "/shop" : undefined}
          viewAllLabel={pick(s.viewAllLabel, "view all")}
          viewAllPlacement={s.viewAllPlacement}
          view={carouselView(s, DESIGNED.row)}
        />
      </Look>
    );
  },
});

async function loadProjectOthers(limit: number, context: RenderContext) {
  const record = recordOf(context, "project");
  if (!record) return null;
  const { project } = record;
  // `related_projects` is often unset, so "Other Projects" falls back to the rest.
  const [texts, others] = await Promise.all([
    getSiteTexts(),
    project.relatedProjects.length > 0
      ? Promise.resolve(project.relatedProjects)
      : getMetaobjects(METAOBJECT_TYPES.project, { first: 50 })
          .then((page) =>
            sortProjects(page.items.map(normalizeProjectCard))
              .filter((item) => item.handle !== project.handle)
              .slice(0, limit),
          )
          .catch(() => []),
  ]);
  return { texts, others };
}

const projectOthers = renderer<"project_others", Awaited<ReturnType<typeof loadProjectOthers>>>({
  load: (s, context) => loadProjectOthers(s.limit, context),
  render: (s, data, { preview }) => {
    if (!data) return null;
    if (data.others.length === 0) return <Absent preview={preview}>Other projects — there are no other projects yet.</Absent>;
    return (
      <Container className="pb-section">
        <h2 className={`${headingLook(s, "text-h2").className} mb-8`} style={headingLook(s, "text-h2").style}>
          {pick(s.title, data.texts["project.others"])}
        </h2>
        <Look s={s}>
          <ul className="grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {data.others.map((other) => (
              <li key={other.handle}>
                <ProjectCard project={other} view="m" />
              </li>
            ))}
          </ul>
        </Look>
      </Container>
    );
  },
});

/* -------------------------------------------------------------------------- *
 * Designer page
 * -------------------------------------------------------------------------- */

async function loadDesignerWork(limit: number, context: RenderContext) {
  const record = recordOf(context, "designer");
  if (!record) return null;
  // No metafield filter exists on the Storefront product query, so a designer's work
  // is reached through the collections that credit them.
  const work = await getProductsByDesigner(record.designer.handle, { first: limit }).catch((error: unknown) => {
    console.error(`[templates/designer] products lookup failed`, error);
    return { products: [], collections: [] };
  });
  return { designer: record.designer, ...work };
}

const designerProfile = renderer<"designer_profile", Awaited<ReturnType<typeof loadDesignerWork>>>({
  // The same lookup the products section makes (cached), for the list of collections.
  load: (_, context) => loadDesignerWork(8, context),
  render: (s, data) => {
    if (!data) return null;
    const { designer, collections } = data;
    return (
      <Container className="pt-12 pb-section">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {designer.portrait && (
            <figure
              className={cn(
                "relative w-full overflow-hidden bg-foreground/10",
                s.portraitShape === "square" ? "aspect-square" : s.portraitShape === "portrait" ? "aspect-[3/4]" : s.portraitShape === "landscape" ? "aspect-[4/3]" : "aspect-[619/728]",
                s.align === "right" && "lg:order-last",
              )}
              style={s.portraitRadius ? { borderRadius: `${s.portraitRadius}px` } : undefined}
            >
              <Image
                src={cdnImage(designer.portrait.url)}
                alt={designer.portrait.altText ?? designer.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1023px) 100vw, 45vw"
              />
            </figure>
          )}

          <div className="max-w-[34rem]">
            <h1 className={headingLook(s, "text-h2").className} style={headingLook(s, "text-h2").style}>
              {designer.name}
            </h1>
            {designer.studio && designer.studio !== designer.name && <p className="text-secondary mt-1 text-muted">{designer.studio}</p>}
            {designer.byline && <p className="text-h3 mt-6">{designer.byline}</p>}

            {designer.bioHtml ? (
              <div className="sb-prose mt-6" dangerouslySetInnerHTML={{ __html: designer.bioHtml }} />
            ) : (
              designer.bioShort && <p className="text-body mt-6">{designer.bioShort}</p>
            )}

            {s.showCollections && collections.length > 0 && (
              <p className="text-secondary mt-8 text-muted">
                Collections:{" "}
                {collections.map((collection, index) => (
                  <span key={collection.handle}>
                    {index > 0 && ", "}
                    <Link href={`/collections/${collection.handle}`} className="sb-underline">
                      {collection.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </Container>
    );
  },
});

const designerProducts = renderer<"designer_products", Awaited<ReturnType<typeof loadDesignerWork>>>({
  load: (s, context) => loadDesignerWork(s.limit, context),
  render: (s, data, { preview }) => {
    if (!data) return null;
    if (data.products.length === 0) return <Absent preview={preview}>Pieces by the designer — none of their collections has products yet.</Absent>;
    return (
      <Container className="pb-section">
        <h2 className={`${headingLook(s, "text-h2").className} mb-8`} style={headingLook(s, "text-h2").style}>
          {pick(s.title, `Designed by ${data.designer.name}`)}
        </h2>
        <Look s={s}>
          <ProductCardGrid products={data.products} />
        </Look>
      </Container>
    );
  },
});

/* -------------------------------------------------------------------------- *
 * The lists
 * -------------------------------------------------------------------------- */

/** Shop All, as its route works it out from the address — see `app/(storefront)/shop/page.tsx`. */
async function loadShop(intro: string, context: RenderContext) {
  const record = recordOf(context, "shop");
  if (!record) return null;
  const params = record.params;
  const sort = param(params, "sort");
  const byCollection = params.view === "collection";
  const filter = readCatalogueFilter((key) => params[key]);
  const filtered = hasCatalogueFilter(filter);
  const [collections, categories, texts] = await Promise.all([getListedCollections().catch(() => []), getShopCategories(), getSiteTexts()]);
  const requested = param(params, "collection");
  const collectionHandle = byCollection
    ? (collections.find((item) => item.handle === requested)?.handle ??
      (filtered && requested && /^[a-z0-9][a-z0-9-]*$/.test(requested) ? requested : undefined))
    : undefined;
  const categorySlug = !byCollection ? param(params, "category") : undefined;
  const category = findCategory(categories, categorySlug);
  const query = combineQueries(categoryQuery(category), catalogueFilterQuery(filter));

  const [firstPage, introText, total] = await Promise.all([
    collectionHandle
      ? getCollectionProducts({ handle: collectionHandle, first: PRODUCTS_PER_PAGE, sort, filters: catalogueProductFilters(filter) })
      : getProducts({ first: PRODUCTS_PER_PAGE, sort, query }),
    introFor(intro, "shop"),
    (collectionHandle ? (filtered ? Promise.resolve(null) : countCollectionProducts(collectionHandle)) : query ? countProducts(query) : Promise.resolve(null)).catch(
      () => null,
    ),
  ]);

  return { sort, filter, filtered, collections, categories, texts, collectionHandle, categorySlug, firstPage, introText, total };
}

const shopMain = renderer<"shop_main", Awaited<ReturnType<typeof loadShop>>>({
  load: (s, context) => loadShop(s.intro, context),
  render: (s, data) => {
    if (!data) return null;
    const filterLabel = catalogueFilterLabel(data.filter);
    return (
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
            {pick(s.title, data.texts["shop.title"])}
          </h1>
          {data.introText && <p className="text-body mt-6">{data.introText}</p>}
          {filterLabel ? (
            <p className="text-secondary mt-6">
              Showing <span className="font-medium">{filterLabel}</span>
              {" · "}
              <Link href="/shop" className="sb-underline">
                show everything
              </Link>
            </p>
          ) : null}
        </header>

        {s.showControls && (
          <div className="mt-12">
            <ShopControls
              total={data.total ?? undefined}
              categories={data.categories.map(({ slug, label }) => ({ slug, label }))}
              collections={data.collections.map(({ handle, title }) => ({ handle, title }))}
            />
          </div>
        )}

        <div className="mt-10">
          <Look s={s}>
          <ProductGrid
            key={`${data.collectionHandle ?? data.categorySlug ?? "all"}-${catalogueFilterKey(data.filter)}-${data.sort ?? DEFAULT_SORT}`}
            initial={data.firstPage}
            category={data.categorySlug}
            collection={data.collectionHandle}
            filter={data.filtered ? catalogueFilterKey(data.filter) : undefined}
            sort={data.sort}
          />
          </Look>
        </div>
      </Container>
    );
  },
});

async function loadSearch(context: RenderContext) {
  const record = recordOf(context, "search");
  if (!record) return null;
  const [results, texts] = await Promise.all([
    record.query ? searchProducts({ query: record.query, first: PRODUCTS_PER_PAGE }) : Promise.resolve(null),
    getSiteTexts(),
  ]);
  return { query: record.query, results, texts };
}

const searchMain = renderer<"search_main", Awaited<ReturnType<typeof loadSearch>>>({
  load: (_, context) => loadSearch(context),
  render: (s, data) => {
    if (!data) return null;
    const { query, results } = data;
    const [before, after] = pick(s.empty, "Nothing matched “{query}”. Try a different word, or browse").split("{query}");
    return (
      <Container className="py-section">
        <h1 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
          {pick(s.title, data.texts["search.title"])}
        </h1>

        <form action="/search" className="mt-8 max-w-[32rem]">
          <div className="flex items-center gap-4 border-b border-foreground pb-2">
            <label htmlFor="q" className="sr-only">
              Search products
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={pick(s.placeholder, "Search products")}
              className="text-body w-full bg-transparent placeholder:text-muted focus:outline-none"
            />
            <button type="submit" className="text-button shrink-0 uppercase tracking-[0.06em]">
              {pick(s.button, "Search")}
            </button>
          </div>
        </form>

        {results && s.showCount && (
          <p className="text-tertiary mt-6 text-muted">
            {results.totalCount} {results.totalCount === 1 ? "result" : "results"} for “{query}”
          </p>
        )}

        {results && results.items.length > 0 && (
          <div className="mt-10">
            <Look s={s}>
              <ProductGrid key={query} initial={results} search={query} />
            </Look>
          </div>
        )}

        {results && results.items.length === 0 && (
          <p className="text-body mt-10 text-muted">
            {before}
            {after !== undefined ? query : null}
            {after ?? ""}{" "}
            <Link href="/shop" className="sb-underline">
              all products
            </Link>
            .
          </p>
        )}
      </Container>
    );
  },
});

async function loadCollectionsList(intro: string, context: RenderContext) {
  if (!recordOf(context, "collections")) return null;
  const [collections, introText, texts] = await Promise.all([getListedCollections(), introFor(intro, "collections"), getSiteTexts()]);
  return { collections, introText, texts };
}

const collectionsMain = renderer<"collections_main", Awaited<ReturnType<typeof loadCollectionsList>>>({
  load: (s, context) => loadCollectionsList(s.intro, context),
  render: (s, data) =>
    data ? (
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
            {pick(s.title, data.texts["collections.title"])}
          </h1>
          {data.introText && <p className="text-body mt-6">{data.introText}</p>}
        </header>

        {data.collections.length === 0 ? (
          <p className="text-body mt-16 text-muted">No collections published yet.</p>
        ) : (
          <Look s={s}>
            <CollectionGrid collections={data.collections} className="mt-12" />
          </Look>
        )}
      </Container>
    ) : null,
});

async function loadProjectsList(intro: string, context: RenderContext) {
  const record = recordOf(context, "projects");
  if (!record) return null;
  const category = param(record.params, "category");
  const view: "l" | "m" = record.params.view === "l" ? "l" : "m";
  const [page, introText, texts] = await Promise.all([
    getMetaobjects(METAOBJECT_TYPES.project, { first: 200 }),
    introFor(intro, "projects"),
    getSiteTexts(),
  ]);
  const all = sortProjects(page.items.map(normalizeProjectCard));
  // `metaobjects` takes no query argument, so the category filter runs here.
  const counts = all.reduce<Record<string, number>>((acc, project) => {
    if (project.category) acc[project.category] = (acc[project.category] ?? 0) + 1;
    return acc;
  }, {});
  const projects = category ? all.filter((project) => project.category === category) : all;
  return { projects, counts, view, introText, texts };
}

const projectsMain = renderer<"projects_main", Awaited<ReturnType<typeof loadProjectsList>>>({
  load: (s, context) => loadProjectsList(s.intro, context),
  render: (s, data) => {
    if (!data) return null;
    return (
      <Container className="pt-12 pb-section">
        <header className="max-w-[46rem]">
          <h1 className={headingLook(s, "text-h1").className} style={headingLook(s, "text-h1").style}>
            {pick(s.title, data.texts["projects.title"])}
          </h1>
          {data.introText && <p className="text-body mt-6">{data.introText}</p>}
        </header>

        {s.showControls && (
          <div className="mt-12">
            <ProjectControls counts={data.counts} />
          </div>
        )}

        {data.projects.length === 0 ? (
          <p className="text-body py-16 text-muted">No projects in this category yet.</p>
        ) : (
          <Look s={s}>
            <ul className={data.view === "l" ? "mt-10 flex flex-col gap-16" : "mt-10 grid gap-grid-gap gap-y-12 sm:grid-cols-2 lg:grid-cols-3"}>
              {data.projects.map((project, index) => (
                <li key={project.handle}>
                  <ProjectCard project={project} view={data.view} priority={index < 3} />
                </li>
              ))}
            </ul>
          </Look>
        )}
      </Container>
    );
  },
});

export const TEMPLATE_RENDERERS = {
  product_main: productMain,
  product_idea: productIdea,
  product_designer: productDesigner,
  product_collection: productCollection,
  product_recommendations: productRecommendations,
  collection_hero: collectionHero,
  collection_idea: collectionIdea,
  collection_designer: collectionDesigner,
  collection_products: collectionProducts,
  collection_in_context: collectionInContext,
  project_hero: projectHero,
  project_details: projectDetails,
  project_featured: projectFeatured,
  project_others: projectOthers,
  designer_profile: designerProfile,
  designer_products: designerProducts,
  shop_main: shopMain,
  search_main: searchMain,
  collections_main: collectionsMain,
  projects_main: projectsMain,
};
