import { shopifyUrlToRoute } from "../routes";

import type {
  Collection,
  CollectionCard,
  DesignerRef,
  Maybe,
  Metafield,
  MetafieldMap,
  MetafieldReference,
  MetaobjectField,
  MenuLink,
  Product,
  ProductCard,
  ShopifyCollection,
  ShopifyImage,
  ShopifyMenuItem,
  ShopifyMetaobject,
  ShopifyProduct,
  ShopifyProductCard,
  ShopifyVideoSource,
} from "./types";

/** The one video a captioned_image entry can carry, resolved to a playable file. */
export type ShopifyVideo = {
  url: string;
  mimeType: string;
  width: Maybe<number>;
  height: Maybe<number>;
};

/* -------------------------------------------------------------------------- *
 * Connections
 * -------------------------------------------------------------------------- */

/** Works for a full connection or the bare `{ nodes }` shape. */
export const nodesOf = <T>(connection: Maybe<{ nodes: T[] }> | undefined): T[] =>
  connection?.nodes ?? [];

/* -------------------------------------------------------------------------- *
 * Images
 * -------------------------------------------------------------------------- */

/**
 * Sizes an image with the Shopify CDN's own transform. Vercel's optimizer is
 * switched off in next.config.ts, so this is how images get resized.
 */
export function cdnImage(url: string, width: number, height?: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("width", String(width));
    if (height) parsed.searchParams.set("height", String(height));
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Pulls an image out of whichever reference shape carries one. */
export function imageFromReference(reference: Maybe<MetafieldReference>): Maybe<ShopifyImage> {
  if (!reference) return null;
  if (reference.__typename === "MediaImage") {
    const media = reference as Extract<MetafieldReference, { __typename: "MediaImage" }>;
    if (!media.image) return null;
    return { ...media.image, altText: media.image.altText ?? media.alt ?? null };
  }
  if (reference.__typename === "GenericFile") {
    return (reference as Extract<MetafieldReference, { __typename: "GenericFile" }>).previewImage ?? null;
  }
  if (reference.__typename === "Product") {
    return (reference as Extract<MetafieldReference, { __typename: "Product" }>).featuredImage ?? null;
  }
  return null;
}

/** Picks the best playable file out of Shopify's per-resolution source list. */
function bestVideoSource(sources: ShopifyVideoSource[]): Maybe<ShopifyVideoSource> {
  const mp4 = sources.filter((source) => source.mimeType === "video/mp4");
  const pool = mp4.length ? mp4 : sources;
  return pool.reduce<Maybe<ShopifyVideoSource>>(
    (best, source) => (!best || (source.width ?? 0) > (best.width ?? 0) ? source : best),
    null,
  );
}

/** Pulls a video out of a reference, for the one field that can carry one. */
export function videoFromReference(reference: Maybe<MetafieldReference>): Maybe<ShopifyVideo> {
  if (!reference || reference.__typename !== "Video") return null;
  const video = reference as Extract<MetafieldReference, { __typename: "Video" }>;
  const source = bestVideoSource(video.sources ?? []);
  if (!source) return null;
  return { url: source.url, mimeType: source.mimeType, width: source.width, height: source.height };
}

/* -------------------------------------------------------------------------- *
 * Metafields
 *
 * `metafields(identifiers: [...])` answers positionally and puts `null` where a
 * key has no value, so the array is compacted into a keyed map before use.
 * -------------------------------------------------------------------------- */

export function toMetafieldMap(metafields: Maybe<Metafield>[] | undefined): MetafieldMap {
  const map: MetafieldMap = {};
  for (const metafield of metafields ?? []) {
    if (metafield?.key) map[metafield.key] = metafield;
  }
  return map;
}

export const metafieldText = (map: MetafieldMap, key: string): Maybe<string> =>
  map[key]?.value ?? null;

export const metafieldBool = (map: MetafieldMap, key: string): boolean =>
  map[key]?.value === "true";

export function metafieldInt(map: MetafieldMap, key: string): Maybe<number> {
  const raw = map[key]?.value;
  if (raw == null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export const metafieldImage = (map: MetafieldMap, key: string): Maybe<ShopifyImage> =>
  imageFromReference(map[key]?.reference ?? null);

export const metafieldImages = (map: MetafieldMap, key: string): ShopifyImage[] =>
  (map[key]?.references?.nodes ?? [])
    .map(imageFromReference)
    .filter((image): image is ShopifyImage => Boolean(image));

/** Entries behind a `list.metaobject_reference`. */
export function metafieldMetaobjects(map: MetafieldMap, key: string): ShopifyMetaobject[] {
  return (map[key]?.references?.nodes ?? []).filter(
    (node): node is ShopifyMetaobject & { __typename: "Metaobject" } => node.__typename === "Metaobject",
  );
}

export function metafieldMetaobject(map: MetafieldMap, key: string): Maybe<ShopifyMetaobject> {
  const reference = map[key]?.reference;
  return reference?.__typename === "Metaobject" ? (reference as unknown as ShopifyMetaobject) : null;
}

/** Values behind a `list.*` metafield, which Shopify stores as a JSON array. */
export function metafieldList(map: MetafieldMap, key: string): string[] {
  const raw = map[key]?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- *
 * Metaobject fields — same helpers, different container
 * -------------------------------------------------------------------------- */

export type MetaobjectFieldMap = Record<string, MetaobjectField>;

export function toFieldMap(fields: MetaobjectField[] | undefined): MetaobjectFieldMap {
  const map: MetaobjectFieldMap = {};
  for (const field of fields ?? []) {
    if (field?.key) map[field.key] = field;
  }
  return map;
}

export const fieldText = (map: MetaobjectFieldMap, key: string): Maybe<string> =>
  map[key]?.value ?? null;

export const fieldBool = (map: MetaobjectFieldMap, key: string): boolean =>
  map[key]?.value === "true";

export function fieldInt(map: MetaobjectFieldMap, key: string): Maybe<number> {
  const raw = map[key]?.value;
  if (raw == null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export const fieldImage = (map: MetaobjectFieldMap, key: string): Maybe<ShopifyImage> =>
  imageFromReference(map[key]?.reference ?? null);

export const fieldVideo = (map: MetaobjectFieldMap, key: string): Maybe<ShopifyVideo> =>
  videoFromReference(map[key]?.reference ?? null);

export const fieldImages = (map: MetaobjectFieldMap, key: string): ShopifyImage[] =>
  (map[key]?.references?.nodes ?? [])
    .map(imageFromReference)
    .filter((image): image is ShopifyImage => Boolean(image));

export function fieldMetaobjects(map: MetaobjectFieldMap, key: string): ShopifyMetaobject[] {
  return (map[key]?.references?.nodes ?? []).filter(
    (node): node is ShopifyMetaobject & { __typename: "Metaobject" } => node.__typename === "Metaobject",
  );
}

export function fieldProducts(map: MetaobjectFieldMap, key: string) {
  return (map[key]?.references?.nodes ?? []).filter(
    (node): node is Extract<MetafieldReference, { __typename: "Product" }> =>
      node.__typename === "Product",
  );
}

/* -------------------------------------------------------------------------- *
 * Rich text
 *
 * `rich_text_field` stores a JSON AST, not HTML. This renders the node types
 * Shopify emits and escapes every text value.
 * -------------------------------------------------------------------------- */

type RichTextNode = {
  type: string;
  value?: string;
  level?: number;
  listType?: "unordered" | "ordered";
  url?: string;
  title?: string;
  target?: string;
  bold?: boolean;
  italic?: boolean;
  children?: RichTextNode[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderNode(node: RichTextNode): string {
  const children = (node.children ?? []).map(renderNode).join("");

  switch (node.type) {
    case "root":
      return children;
    case "paragraph":
      return `<p>${children}</p>`;
    case "heading": {
      const level = Math.min(Math.max(node.level ?? 2, 1), 6);
      return `<h${level}>${children}</h${level}>`;
    }
    case "list":
      return node.listType === "ordered" ? `<ol>${children}</ol>` : `<ul>${children}</ul>`;
    case "list-item":
      return `<li>${children}</li>`;
    case "link": {
      const href = escapeHtml(node.url ?? "#");
      const target = node.target ? ` target="${escapeHtml(node.target)}" rel="noopener noreferrer"` : "";
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : "";
      return `<a href="${href}"${title}${target}>${children}</a>`;
    }
    case "text": {
      let text = escapeHtml(node.value ?? "");
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      return text;
    }
    default:
      return children;
  }
}

/** Returns "" for empty or unparseable input, never throws. */
export function richTextToHtml(value: Maybe<string> | undefined): string {
  if (!value) return "";
  try {
    return renderNode(JSON.parse(value) as RichTextNode);
  } catch {
    // Older entries may already hold plain text.
    return `<p>${escapeHtml(value)}</p>`;
  }
}

export const metafieldRichText = (map: MetafieldMap, key: string): string =>
  richTextToHtml(map[key]?.value ?? null);

export const fieldRichText = (map: MetaobjectFieldMap, key: string): string =>
  richTextToHtml(map[key]?.value ?? null);

/* -------------------------------------------------------------------------- *
 * Normalisers
 * -------------------------------------------------------------------------- */

export function normalizeProductCard(product: ShopifyProductCard): ProductCard {
  const metafields = toMetafieldMap(product.metafields);
  const defaultVariant = product.variants?.nodes[0];
  const images = product.images?.nodes ?? [];
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    image: images[0] ?? null,
    hoverImage: images[1] ?? null,
    tags: product.tags ?? [],
    collectionLabel: metafieldText(metafields, "collection_label"),
    defaultVariantId: defaultVariant?.id ?? null,
    defaultVariantTitle:
      defaultVariant && defaultVariant.title !== "Default Title" ? defaultVariant.title : null,
  };
}

export function normalizeProduct(product: ShopifyProduct): Product {
  const metafields = toMetafieldMap(product.metafields);
  return {
    ...normalizeProductCard(product),
    description: product.description,
    descriptionHtml: product.descriptionHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags ?? [],
    seo: product.seo,
    updatedAt: product.updatedAt,
    images: nodesOf(product.images),
    options: (product.options ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      values: (option.optionValues ?? []).map((value) => value.name),
    })),
    variants: nodesOf(product.variants),
    metafields,
  };
}

/** The `by …` byline on a collection card comes from the linked designer entry. */
export function designerRefFrom(entry: Maybe<ShopifyMetaobject>): Maybe<DesignerRef> {
  if (!entry) return null;
  const fields = toFieldMap(entry.fields);
  return {
    handle: entry.handle,
    name: fieldText(fields, "name"),
    studio: fieldText(fields, "studio"),
  };
}

export function normalizeCollectionCard(collection: ShopifyCollection): CollectionCard {
  const metafields = toMetafieldMap(collection.metafields);
  return {
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    image: collection.image,
    cardImage: metafieldImage(metafields, "card_image") ?? collection.image,
    logo: metafieldImage(metafields, "hero_logo"),
    isSignature: metafieldBool(metafields, "is_signature"),
    sortOrder: metafieldInt(metafields, "sort_order"),
    designer: designerRefFrom(metafieldMetaobject(metafields, "designer")),
  };
}

export function normalizeCollection(collection: ShopifyCollection): Collection {
  const metafields = toMetafieldMap(collection.metafields);
  return {
    ...normalizeCollectionCard(collection),
    description: collection.description,
    descriptionHtml: collection.descriptionHtml,
    heroImage: metafieldImage(metafields, "hero_image") ?? collection.image,
    seo: collection.seo,
    updatedAt: collection.updatedAt,
    metafields,
  };
}

/* -------------------------------------------------------------------------- *
 * Menus
 * -------------------------------------------------------------------------- */

/**
 * Shopify menu URLs are absolute and point at the Shopify domain. `lib/routes`
 * holds the mapping onto the routes this app serves.
 */
export const menuHref = (url: Maybe<string>): string => shopifyUrlToRoute(url);

export function normalizeMenuItem(item: ShopifyMenuItem): MenuLink {
  return {
    id: item.id,
    title: item.title,
    href: menuHref(item.url),
    items: (item.items ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      href: menuHref(child.url),
    })),
  };
}
