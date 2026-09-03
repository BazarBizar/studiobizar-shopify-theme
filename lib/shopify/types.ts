export type Maybe<T> = T | null;

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: Maybe<string>;
  endCursor: Maybe<string>;
};

export type Connection<T> = {
  nodes: T[];
  pageInfo: PageInfo;
};

/** A page of results plus the cursor needed to ask for the next one. */
export type Paginated<T> = {
  items: T[];
  pageInfo: PageInfo;
};

export type ShopifyImage = {
  url: string;
  altText: Maybe<string>;
  width: Maybe<number>;
  height: Maybe<number>;
};

export type SEO = {
  title: Maybe<string>;
  description: Maybe<string>;
};

/* -------------------------------------------------------------------------- *
 * Metafields and references
 * -------------------------------------------------------------------------- */

export type MetafieldReference =
  | { __typename: "MediaImage"; id: string; alt: Maybe<string>; image: Maybe<ShopifyImage> }
  | {
      __typename: "GenericFile";
      id: string;
      url: Maybe<string>;
      mimeType: Maybe<string>;
      previewImage: Maybe<ShopifyImage>;
    }
  | { __typename: "Metaobject"; id: string; handle: string; type: string; fields: MetaobjectField[] }
  | { __typename: "Product"; id: string; handle: string; title: string; featuredImage: Maybe<ShopifyImage> }
  | { __typename: "Collection"; id: string; handle: string; title: string }
  | { __typename: "Page"; id: string; handle: string; title: string }
  | { __typename: string };

export type Metafield = {
  key: string;
  namespace: string;
  type: string;
  value: Maybe<string>;
  reference: Maybe<MetafieldReference>;
  references: Maybe<{ nodes: MetafieldReference[] }>;
};

export type MetaobjectField = {
  key: string;
  type: string;
  value: Maybe<string>;
  reference: Maybe<MetafieldReference>;
  references: Maybe<{ nodes: MetafieldReference[] }>;
};

/** Metafields keyed by key, with the positional nulls Shopify returns dropped. */
export type MetafieldMap = Record<string, Metafield>;

/* -------------------------------------------------------------------------- *
 * Raw shapes, as returned by the Storefront API
 * -------------------------------------------------------------------------- */

export type ShopifyProductCard = {
  id: string;
  handle: string;
  title: string;
  tags: string[];
  images: { nodes: ShopifyImage[] };
  variants: { nodes: { id: string; title: string }[] };
  metafields: Maybe<Metafield>[];
};

export type ShopifyProductVariant = {
  id: string;
  title: string;
  sku: Maybe<string>;
  selectedOptions: { name: string; value: string }[];
  image: Maybe<ShopifyImage>;
};

export type ShopifyProduct = ShopifyProductCard & {
  descriptionHtml: string;
  description: string;
  vendor: Maybe<string>;
  productType: Maybe<string>;
  tags: string[];
  seo: SEO;
  updatedAt: string;
  images: { nodes: ShopifyImage[] };
  options: { id: string; name: string; optionValues: { id: string; name: string }[] }[];
  variants: { nodes: ShopifyProductVariant[] };
};

export type ShopifyCollection = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  image: Maybe<ShopifyImage>;
  seo: SEO;
  updatedAt: string;
  metafields: Maybe<Metafield>[];
};

export type ShopifyMetaobject = {
  id: string;
  handle: string;
  type: string;
  updatedAt: Maybe<string>;
  fields: MetaobjectField[];
};

export type ShopifyPage = {
  id: string;
  handle: string;
  title: string;
  body: string;
  bodySummary: string;
  seo: SEO;
  updatedAt: string;
  metafields: Maybe<Metafield>[];
};

export type ShopifyMenuItem = {
  id: string;
  title: string;
  url: Maybe<string>;
  type: string;
  items: Omit<ShopifyMenuItem, "items">[];
};

export type ShopifyMenu = {
  id: string;
  handle: string;
  title: string;
  items: ShopifyMenuItem[];
};

/* -------------------------------------------------------------------------- *
 * Normalised shapes the UI consumes
 * -------------------------------------------------------------------------- */

export type ProductCard = {
  id: string;
  handle: string;
  title: string;
  image: Maybe<ShopifyImage>;
  /** Second product photo — crossfades in on card hover. */
  hoverImage: Maybe<ShopifyImage>;
  /** Real Shopify tags — the card badge is the first one, e.g. "New", "Sale". */
  tags: string[];
  collectionLabel: Maybe<string>;
  /** For the quick-add on the card itself; null for a product with no variants. */
  defaultVariantId: Maybe<string>;
  defaultVariantTitle: Maybe<string>;
};

export type ProductVariantOption = {
  id: string;
  title: string;
  sku: Maybe<string>;
  selectedOptions: { name: string; value: string }[];
  image: Maybe<ShopifyImage>;
};

export type Product = ProductCard & {
  descriptionHtml: string;
  description: string;
  vendor: Maybe<string>;
  productType: Maybe<string>;
  tags: string[];
  seo: SEO;
  updatedAt: string;
  images: ShopifyImage[];
  options: { id: string; name: string; values: string[] }[];
  variants: ProductVariantOption[];
  metafields: MetafieldMap;
};

export type DesignerRef = {
  handle: string;
  name: Maybe<string>;
  studio: Maybe<string>;
};

export type CollectionCard = {
  id: string;
  handle: string;
  title: string;
  image: Maybe<ShopifyImage>;
  cardImage: Maybe<ShopifyImage>;
  logo: Maybe<ShopifyImage>;
  isSignature: boolean;
  sortOrder: Maybe<number>;
  designer: Maybe<DesignerRef>;
};

export type Collection = CollectionCard & {
  description: string;
  descriptionHtml: string;
  heroImage: Maybe<ShopifyImage>;
  seo: SEO;
  updatedAt: string;
  metafields: MetafieldMap;
};

export type MenuLink = {
  id: string;
  title: string;
  /** Rewritten to a storefront-relative path where possible. */
  href: string;
  items: Omit<MenuLink, "items">[];
};
