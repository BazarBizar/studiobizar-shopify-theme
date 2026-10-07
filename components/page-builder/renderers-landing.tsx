import "server-only";

import { CtaBanner } from "@/components/sections/landing/cta-banner";
import { Collage } from "@/components/sections/landing/collage";
import { Collapsible } from "@/components/sections/landing/collapsible";
import { FeaturedProduct } from "@/components/sections/landing/featured-product";
import { ImageBanner, type BannerCopy } from "@/components/sections/landing/image-banner";
import { LogoList } from "@/components/sections/landing/logo-list";
import { Marquee } from "@/components/sections/landing/marquee";
import { Multicolumn } from "@/components/sections/landing/multicolumn";
import { NewsletterBand } from "@/components/sections/landing/newsletter-band";
import type { LandingLink } from "@/components/sections/landing/shared";
import { Slideshow } from "@/components/sections/landing/slideshow";
import { Spacer } from "@/components/sections/landing/spacer";
import { Stats } from "@/components/sections/landing/stats";
import { Steps } from "@/components/sections/landing/steps";
import { Tabs } from "@/components/sections/landing/tabs";
import { Testimonials } from "@/components/sections/landing/testimonials";
import { VideoEmbed } from "@/components/sections/landing/video-embed";
import { isSafeHref, parseVideoUrl, type LinkValue } from "@/lib/page-builder/fields";
import { getProduct } from "@/lib/shopify";
import { richTextToHtml } from "@/lib/shopify/transforms";

import { renderer } from "./renderer-kit";

/**
 * Renderers for the landing sections (`lib/page-builder/sections-landing.ts`).
 * Settings in, the component's own props out — each component takes plain
 * values, so a Liquid section can be written from the same settings.
 *
 * `preview` (the builder's preview) lets a component draw a neutral box where a
 * required image is still empty. On the live site that cannot happen for a
 * required image — publishing refuses it — and an optional one is simply left out.
 */

const linkOf = (value: LinkValue | null | undefined): LandingLink | null =>
  value?.href && value.label && isSafeHref(value.href) ? { href: value.href, label: value.label } : null;

const hrefOf = (value: string) => (value && isSafeHref(value) ? value : "");

export const LANDING_RENDERERS = {
  image_banner: renderer<"image_banner">({
    render: (s, _, { preview, first }) => {
      const copy: BannerCopy = {
        eyebrow: s.eyebrow,
        title: s.title,
        body: s.body,
        headingSize: s.headingSize,
        primary: linkOf(s.primary),
        primaryStyle: s.primaryStyle,
        secondary: linkOf(s.secondary),
        secondaryStyle: s.secondaryStyle,
      };
      return (
        <ImageBanner
          image={s.image}
          mobileImage={s.mobileImage}
          copy={copy}
          height={s.height}
          position={s.position}
          align={s.align}
          tone={s.tone}
          overlay={s.overlay}
          panel={s.panel}
          placeholder={preview}
          priority={first}
        />
      );
    },
  }),

  slideshow: renderer<"slideshow">({
    render: (s, _, { preview, first }) => {
      const slides = s.slides
        .filter((slide) => slide.settings.image || preview)
        .map((slide) => ({
          id: slide.id,
          image: slide.settings.image,
          position: slide.settings.position,
          tone: slide.settings.tone,
          copy: {
            eyebrow: slide.settings.eyebrow,
            title: slide.settings.title,
            body: slide.settings.body,
            headingSize: s.headingSize,
            primary: linkOf(slide.settings.link),
            primaryStyle: slide.settings.buttonStyle,
          },
        }));
      return slides.length > 0 ? (
        <Slideshow
          slides={slides}
          height={s.height}
          overlay={s.overlay}
          autoplay={s.autoplay}
          interval={s.interval}
          controls={s.controls}
          placeholder={preview}
          priority={first}
        />
      ) : null;
    },
  }),

  cta_banner: renderer<"cta_banner">({
    render: (s, _, { preview }) => (
      <CtaBanner
        copy={{
          eyebrow: s.eyebrow,
          title: s.title,
          body: s.body,
          headingSize: s.headingSize,
          primary: linkOf(s.primary),
          primaryStyle: s.primaryStyle,
          secondary: linkOf(s.secondary),
          secondaryStyle: s.secondaryStyle,
        }}
        layout={s.layout}
        image={s.image}
        tone={s.tone}
        overlay={s.overlay}
        width={s.width}
        placeholder={preview}
      />
    ),
  }),

  multicolumn: renderer<"multicolumn">({
    render: (s, _, { preview }) => (
      <Multicolumn
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        columns={s.columns.map((column) => ({
          id: column.id,
          image: column.settings.image,
          icon: column.settings.icon,
          title: column.settings.title,
          html: richTextToHtml(column.settings.body),
          link: linkOf(column.settings.link),
        }))}
        button={linkOf(s.button)}
        media={s.media}
        ratio={s.ratio}
        columnsDesktop={s.columnsDesktop}
        columnsMobile={s.columnsMobile}
        align={s.align}
        style={s.style}
        placeholder={preview}
      />
    ),
  }),

  stats: renderer<"stats">({
    render: (s) => (
      <Stats
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        items={s.items
          .filter((item) => item.settings.value.trim())
          .map((item) => ({ id: item.id, ...item.settings }))}
        size={s.size}
        align={s.align}
        lines={s.lines}
      />
    ),
  }),

  steps: renderer<"steps">({
    render: (s, _, { preview }) => (
      <Steps
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        items={s.items
          .filter((item) => item.settings.title.trim())
          .map((item) => ({
            id: item.id,
            image: item.settings.image,
            title: item.settings.title,
            html: richTextToHtml(item.settings.body),
          }))}
        layout={s.layout}
        numbered={s.numbered}
        showImages={s.showImages}
        placeholder={preview}
      />
    ),
  }),

  tabs: renderer<"tabs">({
    render: (s, _, { id, preview }) => (
      <Tabs
        id={id}
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        items={s.items
          .filter((item) => item.settings.label.trim())
          .map((item) => ({
            id: item.id,
            label: item.settings.label,
            title: item.settings.title,
            html: richTextToHtml(item.settings.body),
            image: item.settings.image,
            link: linkOf(item.settings.link),
          }))}
        imageSide={s.imageSide}
        tabStyle={s.tabStyle}
        placeholder={preview}
      />
    ),
  }),

  collapsible: renderer<"collapsible">({
    render: (s) => (
      <Collapsible
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        rows={s.rows
          .filter((row) => row.settings.heading.trim())
          .map((row) => ({ id: row.id, heading: row.settings.heading, html: richTextToHtml(row.settings.body) }))}
        image={s.image}
        imageSide={s.imageSide}
        openFirst={s.openFirst}
      />
    ),
  }),

  video: renderer<"video">({
    render: (s, _, { preview }) => {
      const video = parseVideoUrl(s.url);
      if (!video && !preview) return null;
      return (
        <VideoEmbed
          title={s.title}
          intro={s.intro}
          headingAlign={s.headingAlign}
          video={video}
          cover={s.cover}
          caption={s.caption}
          ratio={s.ratio}
          width={s.width}
        />
      );
    },
  }),

  marquee: renderer<"marquee">({
    render: (s) => (
      <Marquee
        items={s.items.map((item) => ({ id: item.id, text: item.settings.text }))}
        size={s.size}
        speed={s.speed}
        direction={s.direction}
        separator={s.separator}
        lines={s.lines}
      />
    ),
  }),

  collage: renderer<"collage">({
    render: (s, _, { preview }) => (
      <Collage
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        tiles={s.tiles.map((tile) => ({
          id: tile.id,
          image: tile.settings.image,
          title: tile.settings.title,
          href: hrefOf(tile.settings.href),
        }))}
        layout={s.layout}
        captions={s.captions}
        placeholder={preview}
      />
    ),
  }),

  testimonials: renderer<"testimonials">({
    render: (s) => (
      <Testimonials
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        quotes={s.quotes.map((quote) => ({ id: quote.id, ...quote.settings }))}
        layout={s.layout}
        columns={s.columns}
        marks={s.marks}
      />
    ),
  }),

  logo_list: renderer<"logo_list">({
    render: (s, _, { preview }) => (
      <LogoList
        title={s.title}
        intro={s.intro}
        headingAlign={s.headingAlign}
        logos={s.logos.map((logo) => ({
          id: logo.id,
          image: logo.settings.image,
          name: logo.settings.name,
          href: hrefOf(logo.settings.href),
        }))}
        columns={s.columns}
        size={s.size}
        muted={s.muted}
        placeholder={preview}
      />
    ),
  }),

  featured_product: renderer<"featured_product", Awaited<ReturnType<typeof getProduct>>>({
    load: async (s) => (s.product ? getProduct(s.product.handle) : null),
    render: (s, product, { preview }) => {
      // A product since deleted or unpublished leaves the band out on the live site.
      if (!product && !preview) return null;
      const html = richTextToHtml(s.body) || product?.descriptionHtml || "";
      return (
        <FeaturedProduct
          href={product ? `/shop/${product.handle}` : null}
          images={(product?.images.length ? product.images : product?.image ? [product.image] : []).slice(0, Number(s.images))}
          eyebrow={s.eyebrow}
          title={s.title.trim() || product?.title || ""}
          html={html}
          buttonLabel={s.buttonLabel}
          buttonStyle={s.buttonStyle}
          imageSide={s.imageSide}
          placeholder={preview}
        />
      );
    },
  }),

  spacer: renderer<"spacer">({
    render: (s) => <Spacer height={s.height} line={s.line} />,
  }),

  newsletter: renderer<"newsletter">({
    render: (s, _, { id }) => <NewsletterBand id={id} title={s.title} body={s.body} align={s.align} style={s.style} />,
  }),
};
