import "server-only";

import { CollectionGrid } from "@/components/collection/collection-grid";
import { CollectionHighlightGrid } from "@/components/collection/collection-highlight-grid";
import { ContactDetails } from "@/components/contact/contact-details";
import { ContactForm } from "@/components/contact/contact-form";
import { DesignerGrid } from "@/components/designer/designer-grid";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { ProductCardGrid } from "@/components/product/product-card-grid";
import { ProductRail } from "@/components/product/product-rail";
import { CaptionedRow } from "@/components/sections/captioned-row";
import { CollectionCarousel } from "@/components/sections/collection-carousel";
import { ContactCta } from "@/components/sections/contact-cta";
import { FaqGroups } from "@/components/sections/faq-groups";
import { FullBleedImage } from "@/components/sections/full-bleed-image";
import { HeroSlider } from "@/components/sections/hero-slider";
import { InstagramRow } from "@/components/sections/instagram-row";
import { ProjectCarousel } from "@/components/sections/project-carousel";
import { IntroBlock, IntroBody } from "@/components/sections/intro-block";
import { ItemList } from "@/components/sections/item-list";
import { LocationList } from "@/components/sections/location-list";
import { MediaText } from "@/components/sections/media-text";
import { PageHeading } from "@/components/sections/page-heading";
import { ProjectCards } from "@/components/sections/project-cards";
import { RichContent, type RichContentBlock } from "@/components/sections/rich-content";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getInstagramPosts } from "@/lib/instagram/behold";
import { carouselView, DESIGNED } from "@/lib/page-builder/carousel";
import { isSafeHref, type CaptionedImageValue } from "@/lib/page-builder/fields";
import type { SectionType } from "@/lib/page-builder/registry";
import { shopifyUrlToRoute } from "@/lib/routes";
import {
  METAOBJECT_TYPES,
  getCollectionProducts,
  getCollections,
  getListedCollections,
  getMetaobjects,
  getProductsByIds,
  getSignatureCollections,
} from "@/lib/shopify";
import {
  featuredProjects,
  groupFaqItems,
  normalizeContactChannel,
  normalizeDesigner,
  normalizeFaqItem,
  normalizeLocation,
  normalizeProjectCard,
  normalizeService,
  sortContactChannels,
  sortDesigners,
  sortLocations,
  sortProjects,
  sortServices,
  type CaptionedImage,
  type FaqGroup,
} from "@/lib/shopify/entities";
import { richTextToHtml } from "@/lib/shopify/transforms";

import { renderer, type SomeRenderer } from "./renderer-kit";
import { LANDING_RENDERERS } from "./renderers-landing";

/**
 * Section type → how to fetch what it needs and which EXISTING component draws
 * it. This is the adapter layer and only that: settings in, the component's own
 * props out. No markup is invented here beyond a heading where a component has
 * none of its own.
 *
 * `load` runs on the server, in parallel with every other section's (see
 * `section-renderer.tsx`), through the same cached `lib/shopify` functions the
 * hand-built pages use — no second Shopify client, no new queries.
 *
 * Typed against the registry: a section added to `SECTIONS` without an entry
 * here fails the build.
 */

export type { RenderContext, SectionContext } from "./renderer-kit";

/** The line a hand-built page shows when its list is empty, kept for the same page drawn here. */
const Empty = ({ className, children }: { className: string; children: string }) => (
  <p className={`text-body ${className} text-muted`}>{children}</p>
);

/** A builder image list → the `CaptionedImage` the image components take. */
function toCaptioned(id: string, items: CaptionedImageValue[]): CaptionedImage[] {
  return items.map((item, index) => ({
    handle: `${id}-${index}`,
    image: item.image,
    video: null,
    caption: item.caption || null,
    altText: item.image.altText,
    credit: null,
  }));
}

const collectionHref = (handle: string) => shopifyUrlToRoute(`/collections/${handle}`);

/** Off-site links open in a new tab with the right `rel`; everything else is a client navigation. */
const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** "Inquiry types", one per line, as the contact form's menu takes them. */
const inquiryTypesOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

/** A section's own heading, where its component has none — the same h2 ProductRail uses. */
function Titled({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="pb-section">
      {title && <h2 className="text-h2 mb-8">{title}</h2>}
      {children}
    </Container>
  );
}

type Products = Awaited<ReturnType<typeof getProductsByIds>>;
type Collections = Awaited<ReturnType<typeof getSignatureCollections>>;

export const RENDERERS = {
  page_heading: renderer<"page_heading">({
    render: (s, _, { pageTitle, children }) =>
      // Under an image-only hero the page's one h1 is for screen readers and
      // search engines — the arrangement the landing page has always had.
      s.style === "hidden" ? (
        <h1 className="sr-only">{s.title.trim() || pageTitle}</h1>
      ) : (
      <PageHeading
        title={s.title.trim() || pageTitle}
        variant={s.style}
        html={richTextToHtml(s.intro) || undefined}
        summary={s.summary.trim() || undefined}
        compact={s.introSpacing === "compact"}
      >
        {children}
      </PageHeading>
      ),
  }),

  hero: renderer<"hero">({
    render: (s, _, { id }) => <HeroSlider slides={toCaptioned(id, s.slides)} />,
  }),

  text_block: renderer<"text_block">({
    render: (s) => (
      <IntroBlock
        title={s.title}
        html={richTextToHtml(s.body) || undefined}
        href={s.link?.href || undefined}
        label={s.link?.label || undefined}
        variant={s.buttonStyle}
        plain={s.textStyle === "plain"}
        flush={s.spaceAbove === "none"}
      />
    ),
  }),

  rich_text: renderer<"rich_text">({
    render: (s) => (
      <RichContent
        width={s.width}
        align={s.align}
        blocks={s.blocks.flatMap((block): RichContentBlock[] => {
          if (block.type === "heading") {
            const settings = block.settings as { text: string; level: "h2" | "h3" };
            return settings.text.trim() ? [{ id: block.id, kind: "heading", text: settings.text, level: settings.level }] : [];
          }
          if (block.type === "text") {
            const settings = block.settings as { body: string; scale: "body" | "lead" };
            const html = richTextToHtml(settings.body);
            return html ? [{ id: block.id, kind: "text", html, scale: settings.scale }] : [];
          }
          const settings = block.settings as { link: { href: string; label: string } | null; style: "outline" | "solid" | "text" };
          return settings.link?.href && settings.link.label
            ? [
                {
                  id: block.id,
                  kind: "button",
                  href: settings.link.href,
                  label: settings.link.label,
                  variant: settings.style,
                  external: isExternal(settings.link.href),
                },
              ]
            : [];
        })}
      />
    ),
  }),

  item_list: renderer<"item_list", { key: string; title: string; html: string }[]>({
    load: async (s) => {
      if (s.source === "services") {
        const page = await getMetaobjects("service", { first: 100 });
        return sortServices(page.items.map(normalizeService)).map((service) => ({
          key: service.handle,
          title: service.title,
          html: service.bodyHtml,
        }));
      }
      return s.items.map((item) => {
        const settings = item.settings as { title: string; body: string };
        return { key: item.id, title: settings.title, html: richTextToHtml(settings.body) };
      });
    },
    render: (s, items) => <ItemList title={s.title || undefined} items={items.filter((item) => item.title.trim())} />,
  }),

  faq: renderer<"faq", FaqGroup[]>({
    load: async (s) => {
      if (s.source === "custom") {
        const items = s.questions.map((block, index) => {
          const settings = block.settings as { question: string; answer: string };
          return {
            handle: block.id,
            question: settings.question,
            answer: richTextToHtml(settings.answer),
            category: null,
            sortOrder: index,
          };
        });
        // One group, no heading — the questions were written for this page.
        return groupFaqItems(items.filter((item) => item.question.trim()), null);
      }

      const page = await getMetaobjects("faq_item", { first: 100 });
      const items = page.items.map(normalizeFaqItem);
      const wanted = s.category.trim().toLowerCase();
      return groupFaqItems(
        s.source === "category" ? items.filter((item) => item.category?.toLowerCase() === wanted) : items,
      );
    },
    render: (s, groups, { inline }) =>
      inline ? (
        groups.length > 0 ? (
          <FaqGroups groups={groups} className="mt-12" />
        ) : (
          <Empty className="mt-10">No questions published yet.</Empty>
        )
      ) : groups.length > 0 ? (
        <Titled title={s.title}>
          <FaqGroups groups={groups} />
        </Titled>
      ) : null,
  }),

  media_text: renderer<"media_text">({
    render: (s) => (
      <MediaText
        title={s.title}
        html={richTextToHtml(s.body) || undefined}
        image={s.image}
        align={s.align}
        padding={s.padding}
        link={s.link?.href && s.link.label ? { href: s.link.href, label: s.link.label } : undefined}
        eyebrow={s.eyebrow.trim() || undefined}
        buttonVariant={s.buttonStyle}
        ratio={s.ratio}
        imageWidth={s.imageWidth}
        verticalAlign={s.verticalAlign}
      />
    ),
  }),

  captioned_row: renderer<"captioned_row">({
    render: (s, _, { id }) => <CaptionedRow images={toCaptioned(id, s.images)} />,
  }),

  full_image: renderer<"full_image">({
    render: (s) => (s.image ? <FullBleedImage image={s.image} /> : null),
  }),

  gallery: renderer<"gallery">({
    // GalleryGrid says "No images published yet" when empty — right for the
    // Gallery page, wrong for a band someone has not filled in yet.
    render: (s, _, { id, inline }) =>
      inline ? (
        // Under the heading the grid says "No images published yet" itself, as on /gallery.
        <div className="mt-12">
          <GalleryGrid images={toCaptioned(id, s.images)} />
        </div>
      ) : s.images.length > 0 ? (
        <Titled title={s.title}>
          <GalleryGrid images={toCaptioned(id, s.images)} />
        </Titled>
      ) : null,
  }),

  product_rail: renderer<"product_rail", Awaited<ReturnType<typeof getProductsByIds>>>({
    load: async (s) => {
      if (s.source === "products") return getProductsByIds(s.products.map((item) => item.id));
      if (!s.collection) return [];
      const page = await getCollectionProducts({ handle: s.collection.handle, first: s.limit });
      return page.items;
    },
    render: (s, products) => (
      <ProductRail
        title={s.title}
        products={products}
        viewAllHref={
          // A collection's own page by default; chosen products have none, so only a link given.
          s.viewAll
            ? s.moreLink?.href || (s.source === "collection" && s.collection ? collectionHref(s.collection.handle) : undefined)
            : undefined
        }
        viewAllLabel={s.moreLink?.label || undefined}
        viewAllPlacement={s.viewAllPlacement}
        view={carouselView(s, DESIGNED.row)}
      />
    ),
  }),

  product_mosaic: renderer<"product_mosaic", Awaited<ReturnType<typeof getProductsByIds>>>({
    load: async (s) =>
      s.collection ? (await getCollectionProducts({ handle: s.collection.handle, first: 10 })).items : [],
    render: (s, products) =>
      products.length > 0 ? (
        <Container className="pb-section">
          {s.title && <h2 className="text-h2 mb-8">{s.title}</h2>}
          <CollectionHighlightGrid products={products} />
        </Container>
      ) : null,
  }),

  product_grid: renderer<"product_grid", Products>({
    load: async (s) => {
      if (s.source === "products") return getProductsByIds(s.products.map((item) => item.id));
      if (!s.collection) return [];
      return (await getCollectionProducts({ handle: s.collection.handle, first: s.limit })).items;
    },
    render: (s, products) =>
      products.length > 0 ? (
        <Titled title={s.title}>
          <ProductCardGrid products={products} />
          {s.source === "collection" && s.viewAll && s.collection && (
            <div className="mt-8">
              <ButtonLink href={collectionHref(s.collection.handle)} variant="outline">
                view all
              </ButtonLink>
            </div>
          )}
        </Titled>
      ) : null,
  }),

  collection_grid: renderer<"collection_grid", Collections>({
    load: async (s) => {
      if (s.source === "listed") return getListedCollections();
      if (s.source === "signature") return getSignatureCollections(24);
      const all = await getCollections({ first: 100 });
      const byId = new Map(all.items.map((item) => [item.id, item]));
      return s.collections.flatMap((ref) => byId.get(ref.id) ?? []);
    },
    render: (s, collections) =>
      collections.length > 0 ? (
        <Titled title={s.title}>
          <CollectionGrid collections={collections} />
        </Titled>
      ) : null,
  }),

  designer_grid: renderer<"designer_grid", ReturnType<typeof sortDesigners>>({
    load: async (s) => {
      const page = await getMetaobjects(METAOBJECT_TYPES.designer, { first: 200 });
      return sortDesigners(page.items.map(normalizeDesigner)).slice(0, s.limit);
    },
    render: (s, designers, { inline }) =>
      inline ? (
        designers.length > 0 ? (
          <DesignerGrid designers={designers} className="mt-12" />
        ) : (
          <Empty className="mt-16">No designers published yet.</Empty>
        )
      ) : designers.length > 0 ? (
        <Titled title={s.title}>
          <DesignerGrid designers={designers} />
        </Titled>
      ) : null,
  }),

  locations: renderer<"locations", ReturnType<typeof sortLocations>>({
    load: async () => {
      const page = await getMetaobjects(METAOBJECT_TYPES.location, { first: 50 });
      return sortLocations(page.items.map(normalizeLocation));
    },
    render: (s, locations, { inline }) =>
      inline ? (
        locations.length > 0 ? (
          <LocationList locations={locations} className="mt-16" />
        ) : (
          <Empty className="mt-12">No locations published yet.</Empty>
        )
      ) : locations.length > 0 ? (
        <Titled title={s.title}>
          <LocationList locations={locations} headingLevel={s.title ? "h3" : "h2"} />
        </Titled>
      ) : null,
  }),

  collection_carousel: renderer<"collection_carousel", Collections>({
    load: async (s) => {
      if (s.source === "signature") return getSignatureCollections(12);
      const all = await getCollections({ first: 100 });
      const byId = new Map(all.items.map((item) => [item.id, item]));
      // In the order the operator chose; a collection since deleted or unpublished drops out.
      return s.collections.flatMap((ref) => byId.get(ref.id) ?? []);
    },
    render: (s, collections) => (
      <CollectionCarousel
        title={s.title}
        collections={collections.slice(0, s.maxItems)}
        viewAllHref={s.viewAll ? s.moreLink?.href || "/collections" : undefined}
        viewAllLabel={s.moreLink?.label || undefined}
        view={carouselView(s, DESIGNED.row)}
      />
    ),
  }),

  project_carousel: renderer<"project_carousel", ReturnType<typeof featuredProjects>>({
    load: async (s) => {
      const page = await getMetaobjects(METAOBJECT_TYPES.project, { first: 100 });
      const projects = page.items.map(normalizeProjectCard);
      return s.source === "selected" ? featuredProjects(projects, s.maxItems) : sortProjects(projects).slice(0, s.maxItems);
    },
    render: (s, projects) => (
      <ProjectCarousel
        title={s.title}
        projects={projects}
        view={carouselView(s, DESIGNED.projects)}
        more={s.viewAll ? { href: s.moreLink?.href || "/projects", label: s.moreLink?.label || "view all" } : undefined}
      />
    ),
  }),

  project_cards: renderer<"project_cards", ReturnType<typeof featuredProjects>>({
    load: async (s) => {
      const page = await getMetaobjects(METAOBJECT_TYPES.project, { first: 100 });
      const projects = page.items.map(normalizeProjectCard);
      return s.source === "selected" ? featuredProjects(projects, s.limit) : sortProjects(projects).slice(0, s.limit);
    },
    render: (s, projects) => {
      const introHtml = richTextToHtml(s.introBody);
      return (
        <ProjectCards title={s.title} href={s.viewAll ? "/projects" : undefined} projects={projects} view={s.view}>
          {introHtml && (
            <div className="mt-section-sm">
              <IntroBody
                title={s.introTitle}
                html={introHtml}
                href={s.introLink?.href || undefined}
                label={s.introLink?.label || undefined}
              />
            </div>
          )}
        </ProjectCards>
      );
    },
  }),

  instagram: renderer<"instagram", Awaited<ReturnType<typeof getInstagramPosts>>>({
    load: (s) => getInstagramPosts(Math.max(10, s.maxItems)),
    render: (s, posts, { id }) => (
      <InstagramRow
        posts={posts}
        fallback={toCaptioned(id, s.fallback)}
        max={s.maxItems}
        view={carouselView(s, DESIGNED.instagram)}
      />
    ),
  }),

  contact_details: renderer<"contact_details", ReturnType<typeof sortContactChannels>>({
    load: async () => {
      const page = await getMetaobjects(METAOBJECT_TYPES.contactChannel, { first: 50 });
      return sortContactChannels(page.items.map(normalizeContactChannel));
    },
    render: (s, channels, { inline }) => {
      const types = inquiryTypesOf(s.types);
      const details = s.showDetails ? (
        <ContactDetails channels={channels} inquiryTypes={types} className={inline ? "mt-16" : undefined} />
      ) : (
        // The form on its own, at the width the retired Contact form section used.
        <div className={inline ? "mt-16 max-w-[44rem]" : "max-w-[44rem]"}>
          <ContactForm inquiryTypes={types.length ? types : ["General"]} />
        </div>
      );
      return inline ? details : <Titled title={s.title}>{details}</Titled>;
    },
  }),

  contact_form: renderer<"contact_form">({
    render: (s) => {
      const types = inquiryTypesOf(s.types);
      return (
        <Titled title={s.title}>
          <div className="max-w-[44rem]">
            <ContactForm inquiryTypes={types.length ? types : ["General"]} />
          </div>
        </Titled>
      );
    },
  }),

  contact_cta: renderer<"contact_cta">({
    render: () => <ContactCta />,
  }),

  go_back: renderer<"go_back">({
    render: (s) => (
      <Container className="pb-section">
        <GoBack fallbackHref={isSafeHref(s.fallback) ? s.fallback : "/"} label={s.label.trim() || "go back"} />
      </Container>
    ),
  }),

  ...LANDING_RENDERERS,
} satisfies { [K in SectionType]: SomeRenderer<K> };
