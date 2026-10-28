import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import { SectionIcon } from "@/components/sections/section-icon";
import { ButtonLink } from "@/components/ui/button";
import { designStyle } from "@/lib/page-builder/design-style";
import { HEX_COLOR, isSafeHref, parseVideoUrl, type LinkValue } from "@/lib/page-builder/fields";
import type { SettingsFor } from "@/lib/page-builder/registry";
import { groupColumns } from "@/lib/page-builder/sections-custom";
import { richTextToHtml } from "@/lib/shopify/transforms";
import type { ProductCard as ProductCardType } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

import { Picture, Prose } from "./shared";
import { VideoPlayer } from "./video-embed";

/**
 * The Custom section (`lib/page-builder/sections-custom.ts`): the editor's own
 * blocks, stacked, or in columns where a Column block starts one. Every choice is a
 * data attribute drawn by `styles/sb-blocks.css`, which the Liquid twin
 * (`theme/sections/sb-custom.liquid`) writes the same way.
 */

type Settings = SettingsFor<"custom_section">;
type Block = Settings["blocks"][number];
type ColumnBlock = Extract<Block, { type: "column" }>;

const WIDTH = { page: "", medium: "mx-auto max-w-[64rem]", narrow: "mx-auto max-w-[46rem]", full: "" } as const;

const HEADING = {
  display: "text-display leading-[1.05]",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-h4",
} as const;

const HIDE = { none: undefined, mobile: "mobile", desktop: "desktop" } as const;

const isExternal = (href: string) => /^https?:\/\//i.test(href);
const safe = (link: LinkValue | null | undefined) =>
  link?.href && link.label && isSafeHref(link.href) ? link : null;

function Anchor({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return isExternal(href) ? (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function CustomSection({
  settings,
  products,
  placeholder = false,
}: {
  settings: Settings;
  /** The Product blocks' products, by id — loaded by the renderer. */
  products: Record<string, ProductCardType>;
  /** The builder's preview: draw a box where a photo is still empty, and say where a column is empty. */
  placeholder?: boolean;
}) {
  const groups = groupColumns(settings.blocks);
  if (groups.length === 0) return null;
  const full = settings.width === "full";

  return (
    <div className={cn("py-section", !full && "sb-container")}>
      <div
        className={cn("sb-blocks", WIDTH[settings.width])}
        data-align={settings.align}
        data-gap={settings.gap}
        data-cgap={settings.columnGap}
      >
        {groups.map((group, index) => (
          <Column key={group.column?.id ?? `lead-${index}`} column={group.column as ColumnBlock | null} placeholder={placeholder}>
            {group.blocks.map((item) => (
              <BlockView key={item.id} block={item as Exclude<Block, ColumnBlock>} products={products} placeholder={placeholder} />
            ))}
          </Column>
        ))}
      </div>
    </div>
  );
}

function Column({
  column,
  placeholder,
  children,
}: {
  column: ColumnBlock | null;
  placeholder: boolean;
  children: React.ReactNode[];
}) {
  if (!column) {
    return (
      <div className="sb-bk-col" data-wd="100" data-wt="100" data-wm="100">
        {children}
      </div>
    );
  }
  const s = column.settings;
  const background = HEX_COLOR.test(s.background) ? s.background : "";
  return (
    <div
      className="sb-bk-col"
      data-wd={s.width}
      data-wt={s.widthTablet === "same" ? s.width : s.widthTablet}
      data-wm={s.widthMobile}
      data-pos={s.position}
      data-pad={s.padding}
      data-first={s.mobileFirst ? "" : undefined}
      data-hide={HIDE[s.hideOn]}
      style={{
        ...(background ? { backgroundColor: background } : {}),
        ...(s.border ? { border: "1px solid var(--sb-border)" } : {}),
        ...(s.radius > 0 ? { borderRadius: `${s.radius}px`, overflow: "clip" } : {}),
      }}
    >
      {children.length > 0
        ? children
        : placeholder && (
            <p className="text-tertiary text-muted border-border border border-dashed p-6 text-center">
              Empty column — add blocks below it in the list.
            </p>
          )}
    </div>
  );
}

function BlockView({
  block,
  products,
  placeholder,
}: {
  block: Exclude<Block, ColumnBlock>;
  products: Record<string, ProductCardType>;
  placeholder: boolean;
}) {
  const content = blockContent(block, products, placeholder);
  if (content === null) return null;

  const s = block.settings as { align?: string; space?: string; hideOn: keyof typeof HIDE; design?: Parameters<typeof designStyle>[0] };
  const designed = designStyle(s.design);
  return (
    <div
      className="sb-bk"
      data-type={block.type}
      data-align={s.align && s.align !== "inherit" ? s.align : undefined}
      data-space={s.space && s.space !== "auto" ? s.space : undefined}
      data-hide={HIDE[s.hideOn]}
      {...designed.attrs}
      style={designed.style as React.CSSProperties}
    >
      {content}
    </div>
  );
}

function blockContent(
  block: Exclude<Block, ColumnBlock>,
  products: Record<string, ProductCardType>,
  placeholder: boolean,
): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const s = block.settings;
      if (!s.title.trim()) return null;
      const Tag = s.tag !== "auto" ? s.tag : s.size === "h3" ? "h3" : s.size === "h4" ? "h4" : "h2";
      return <Tag className={cn(HEADING[s.size], "whitespace-pre-line")}>{s.title}</Tag>;
    }

    case "eyebrow":
      return block.settings.eyebrow.trim() ? (
        <p className="text-tertiary uppercase tracking-[0.08em] opacity-80">{block.settings.eyebrow}</p>
      ) : null;

    case "text": {
      const s = block.settings;
      const html = richTextToHtml(s.body);
      if (!html) return null;
      return (
        <div
          className={cn("sb-prose", s.size === "small" && "sb-bk-small", s.size === "lead" && "sb-bk-lead", s.narrow && "sb-bk-measure")}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    case "image": {
      const s = block.settings;
      if (!s.image && !placeholder) return null;
      const href = s.href && isSafeHref(s.href) ? s.href : "";
      const picture = (
        <Picture image={s.image} ratio={s.ratio} placeholder={placeholder} sizes="(max-width: 749px) 100vw, 50vw" />
      );
      return (
        <figure className="sb-bk-row">
          <div className="sb-bk-media" data-size={s.size}>
            {href ? (
              <Anchor href={href} className="block">
                {picture}
              </Anchor>
            ) : (
              picture
            )}
            {s.caption.trim() && <figcaption className="text-tertiary text-muted mt-3">{s.caption}</figcaption>}
          </div>
        </figure>
      );
    }

    case "button": {
      const s = block.settings;
      const links = [
        safe(s.link) && { ...s.link!, variant: s.style },
        safe(s.second) && { ...s.second!, variant: s.secondStyle },
      ].filter((item) => Boolean(item)) as (LinkValue & { variant: typeof s.style })[];
      if (links.length === 0) return null;
      return (
        <div data-sb-buttons="" className="sb-bk-row" data-stretch={s.stretch ? "" : undefined}>
          {links.map((item, index) => (
            <ButtonLink key={index} href={item.href} variant={item.variant} external={isExternal(item.href)}>
              {item.label}
            </ButtonLink>
          ))}
        </div>
      );
    }

    case "icon": {
      const s = block.settings;
      const html = richTextToHtml(s.body);
      const link = safe(s.link);
      const icon = s.icon !== "none" && <SectionIcon name={s.icon} className="size-full" />;
      const words = (
        <div className="min-w-0">
          {s.title.trim() && <h3 className="text-h3">{s.title}</h3>}
          <Prose html={html} size="secondary" className={cn(s.title.trim() && "mt-2")} />
          {link && (
            <Anchor href={link.href} className="sb-underline text-button mt-4 inline-block uppercase">
              {link.label}
            </Anchor>
          )}
        </div>
      );
      if (!icon && !s.title.trim() && !html && !link) return null;
      return s.layout === "beside" ? (
        <div className="sb-bk-beside">
          {icon && <IconBox size={s.iconSize}>{icon}</IconBox>}
          {words}
        </div>
      ) : (
        <>
          {icon && (
            <div className="sb-bk-row mb-4">
              <IconBox size={s.iconSize}>{icon}</IconBox>
            </div>
          )}
          {words}
        </>
      );
    }

    case "card": {
      const s = block.settings;
      const html = richTextToHtml(s.body);
      const link = safe(s.link);
      if (!s.image && !placeholder && !s.title.trim() && !html && !link) return null;
      return (
        <div className="sb-bk-card" data-style={s.style}>
          {(s.image || placeholder) && (
            <Picture image={s.image} ratio={s.ratio} placeholder={placeholder} sizes="(max-width: 749px) 100vw, 33vw" className="mb-5" />
          )}
          {s.title.trim() && <h3 className="text-h3">{s.title}</h3>}
          <Prose html={html} size="secondary" className={cn(s.title.trim() && "mt-2")} />
          {link && (
            <Anchor href={link.href} className="sb-underline text-button mt-4 inline-block uppercase">
              {link.label}
            </Anchor>
          )}
        </div>
      );
    }

    case "video": {
      const s = block.settings;
      const video = s.url ? parseVideoUrl(s.url) : null;
      if (!video && !placeholder) return null;
      return (
        <VideoPlayer
          video={video}
          cover={s.cover}
          caption={s.caption}
          ratio={s.ratio}
          name={s.caption.trim() || "Video"}
          className={cn(s.ratio === "9:16" && "max-w-[28rem]")}
        />
      );
    }

    case "list": {
      const s = block.settings;
      const items = s.items.split("\n").map((line) => line.trim()).filter(Boolean);
      if (items.length === 0) return null;
      const List = s.marker === "number" ? "ol" : "ul";
      return (
        <List className="sb-bk-list text-body" data-marker={s.marker}>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </List>
      );
    }

    case "quote": {
      const s = block.settings;
      if (!s.quote.trim()) return null;
      return (
        <figure>
          <blockquote className={cn("whitespace-pre-line", s.size === "large" ? "text-h3" : "text-body")}>
            “{s.quote.trim()}”
          </blockquote>
          {(s.author.trim() || s.role.trim()) && (
            <figcaption className="text-tertiary mt-4 uppercase tracking-[0.08em]">
              {s.author.trim()}
              {s.author.trim() && s.role.trim() && <span className="text-muted"> — </span>}
              {s.role.trim() && <span className="text-muted">{s.role}</span>}
            </figcaption>
          )}
        </figure>
      );
    }

    case "fold": {
      const s = block.settings;
      if (!s.title.trim()) return null;
      return (
        <details className="sb-bk-fold" open={s.open || undefined}>
          <summary>
            <h3 className="text-h4">{s.title}</h3>
          </summary>
          <Prose html={richTextToHtml(s.body)} />
        </details>
      );
    }

    case "line": {
      const s = block.settings;
      const colour = HEX_COLOR.test(s.color) ? s.color : "var(--sb-border)";
      return (
        <div className="sb-bk-row">
          <hr
            className="m-0 border-0"
            style={{
              borderTop: `${s.thickness}px solid ${colour}`,
              width: s.length === "full" ? "100%" : s.length === "half" ? "50%" : "4rem",
            }}
          />
        </div>
      );
    }

    case "space":
      return (
        <div
          aria-hidden
          className="sb-bk-space"
          style={{ "--bk-h": `${block.settings.height}px`, "--bk-hm": `${block.settings.heightMobile}px` } as React.CSSProperties}
        />
      );

    case "product": {
      const found = block.settings.product ? products[block.settings.product.id] : undefined;
      return found ? <ProductCard product={found} /> : null;
    }
  }
}

function IconBox({ size, children }: { size: "sm" | "md" | "lg"; children: React.ReactNode }) {
  return (
    <span className="sb-bk-icon inline-flex" data-size={size}>
      {children}
    </span>
  );
}
