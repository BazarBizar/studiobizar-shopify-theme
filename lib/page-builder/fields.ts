import { z } from "zod";

import { designSchema, readDesign, type DesignValue } from "./design";
import { HEX_COLOR, imageRefSchema, type ImageRef } from "./value-schemas";

export { HEX_COLOR, imageRefSchema, type ImageRef };

/**
 * THE VOCABULARY a section's settings are written in.
 *
 * A developer describes a section as a list of these, and everything else is
 * derived from that one list: the editor form in the panel, the Zod schema the
 * write API enforces, the lenient schema the storefront reads through, the
 * defaults a new section starts from, and the "is this ready to publish" check.
 * Nothing about a section's settings is declared twice.
 *
 * NO `server-only` and no React: the panel's client editor, the admin API and
 * the storefront renderer all import this module.
 *
 * WHY THE VALUES LOOK THE WAY THEY DO. The document is stored as a JSON page
 * metafield, which a Liquid theme can read as well (`page.metafields.custom.
 * sections.value`). So every value is something Liquid can use without a Next
 * helper: an image carries its CDN `url`, a product or collection carries its
 * `handle` beside its gid, rich text is Shopify's own rich text AST. A future
 * theme renderer reads the same document this one does.
 */

/* -------------------------------------------------------------------------- *
 * Value shapes
 * -------------------------------------------------------------------------- */

/** A product or collection. `title` is for the panel's list; `handle` is what renders. */
export type ResourceRef = { id: string; handle: string; title: string };

export type LinkValue = { label: string; href: string };

export type CaptionedImageValue = { image: ImageRef; caption: string };

/* -------------------------------------------------------------------------- *
 * Field definitions
 * -------------------------------------------------------------------------- */

/**
 * Where a field sits in the form. `advanced` is folded away by default: the fine
 * adjustments some pages need to look exactly as designed, which most edits never
 * touch.
 */
/** `style` is the editor's Style tab — spacing, lines and colours, as in Elementor. */
export type FieldGroup = "content" | "layout" | "style" | "advanced";

/**
 * `when` shows a field only while another field holds one of the listed values —
 * the collection picker only while "Products from" is "A collection". A hidden
 * field keeps its value and is skipped by the publish check.
 */
type Base<K extends string> = {
  key: K;
  label: string;
  help?: string;
  required?: boolean;
  group?: FieldGroup;
  when?: { field: string; is: readonly (string | boolean)[] };
  /**
   * A text field whose sensible values already exist elsewhere — offered as a
   * pick-list of them, so a typo cannot quietly match nothing.
   */
  suggest?: "faqCategories";
  /**
   * Rendered by the Next storefront only, for now: the Liquid theme does not draw
   * it yet (by decision — Next first). The schema generator and `check:liquid` skip
   * it, so it is one grep away when the theme catches up: `nextOnly: true`.
   */
  nextOnly?: boolean;
};

export type SelectOption = { value: string; label: string };

/**
 * How the form draws a select. `position` is a 3 × 3 grid for "where does the
 * text sit on the image" (values `top-left` … `bottom-right`); `icons` is a grid
 * of the icons `components/sections/section-icon.tsx` draws; `buttons` keeps a
 * row of buttons even past three short options (1 2 3 4 5 columns).
 */
export type SelectDisplay = "position" | "icons" | "buttons";

/** Every kind a block's own fields may use — anything except `blocks` itself. */
export type LeafFieldDef<K extends string = string> =
  | (Base<K> & { kind: "text"; max: number; default: string })
  | (Base<K> & { kind: "textarea"; max: number; default: string })
  | (Base<K> & { kind: "richText" })
  | (Base<K> & { kind: "image" })
  | (Base<K> & { kind: "imageList"; max: number; captions: boolean })
  | (Base<K> & { kind: "link" })
  | (Base<K> & { kind: "url"; default: string })
  | (Base<K> & { kind: "video" })
  | (Base<K> & { kind: "select"; options: readonly SelectOption[]; default: string; display?: SelectDisplay })
  | (Base<K> & { kind: "toggle"; default: boolean })
  | (Base<K> & { kind: "number"; min: number; max: number; default: number })
  | (Base<K> & { kind: "color" })
  | (Base<K> & { kind: "product" })
  | (Base<K> & { kind: "products"; max: number })
  | (Base<K> & { kind: "collection" })
  | (Base<K> & { kind: "collections"; max: number })
  | (Base<K> & { kind: "design"; parts: readonly DesignPart[] });

/**
 * The parts of the design panel a `design` field offers. A section offers them all;
 * a slide, which has its own position and size controls, offers fewer.
 */
export type DesignPart =
  | "typography"
  | "buttons"
  | "background"
  | "spacing"
  | "effects"
  | "images"
  | "layout"
  | "visibility";
export const ALL_DESIGN_PARTS: readonly DesignPart[] = [
  "typography",
  "buttons",
  "background",
  "spacing",
  "effects",
  "images",
  "layout",
  "visibility",
];

/**
 * A BLOCK: one repeatable, reorderable piece inside a section — a question in a
 * FAQ, a heading or a button in a Text section — with fields of its own. The
 * same idea as a Shopify theme block, and stored the same way: an ordered list of
 * `{ id, type, settings }`.
 *
 * Blocks do not nest. A block's fields are leaf fields; a section of blocks of
 * blocks is a page builder inside a page builder, which is the free canvas this
 * design system is protected from.
 */
export type BlockDef = {
  type: string;
  label: string;
  fields: readonly LeafFieldDef[];
  /** The field whose value labels the block in the list. */
  summaryKey?: string;
};

export type BlocksFieldDef<K extends string = string> = Base<K> & {
  kind: "blocks";
  blocks: readonly BlockDef[];
  max: number;
  /** Block types a new section starts with, in order. */
  defaults: readonly string[];
};

export type FieldDef<K extends string = string> = LeafFieldDef<K> | BlocksFieldDef<K>;

export type FieldKind = FieldDef["kind"];

/** One stored block. */
export type BlockValue = { id: string; type: string; settings: Record<string, unknown> };

type ValueByKind = {
  text: string;
  textarea: string;
  richText: string;
  image: ImageRef | null;
  imageList: CaptionedImageValue[];
  link: LinkValue | null;
  url: string;
  video: string;
  select: string;
  toggle: boolean;
  number: number;
  /** `#rrggbb`, or "" for none. */
  color: string;
  product: ResourceRef | null;
  products: ResourceRef[];
  collection: ResourceRef | null;
  collections: ResourceRef[];
  blocks: BlockValue[];
  design: DesignValue;
};

export type FieldValue<F extends FieldDef> = ValueByKind[F["kind"]];

/** The typed blocks a `blocks` field holds — a union over its block types. */
export type BlocksOf<B extends readonly BlockDef[]> = {
  [I in keyof B]: { id: string; type: B[I]["type"]; settings: SettingsOf<B[I]["fields"]> };
}[number];

/** `{ title: string; image: ImageRef | null; … }` from a field list. */
export type SettingsOf<F extends readonly FieldDef[]> = {
  [D in F[number] as D["key"]]: D extends { kind: "select"; options: readonly { value: infer V }[] }
    ? V
    : D extends { kind: "blocks"; blocks: infer B extends readonly BlockDef[] }
      ? BlocksOf<B>[]
      : FieldValue<D>;
};

/* -------------------------------------------------------------------------- *
 * Builders — what a section definition is written with
 * -------------------------------------------------------------------------- */

type Opts = Omit<Base<string>, "key" | "label">;

export const text = <K extends string>(
  key: K,
  label: string,
  opts: Opts & { max?: number; default?: string } = {},
) => ({ ...opts, key, label, kind: "text" as const, max: opts.max ?? 120, default: opts.default ?? "" });

export const textarea = <K extends string>(
  key: K,
  label: string,
  opts: Opts & { max?: number; default?: string } = {},
) => ({ ...opts, key, label, kind: "textarea" as const, max: opts.max ?? 600, default: opts.default ?? "" });

export const richText = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "richText" as const,
});

export const image = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "image" as const,
});

export const imageList = <K extends string>(
  key: K,
  label: string,
  opts: Opts & { max: number; captions?: boolean },
) => ({ ...opts, key, label, kind: "imageList" as const, captions: opts.captions ?? true });

export const link = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "link" as const,
});

/** An address on its own, checked like a button's — for "go back to …". */
export const url = <K extends string>(key: K, label: string, opts: Opts & { default?: string } = {}) => ({
  ...opts,
  key,
  label,
  kind: "url" as const,
  default: opts.default ?? "",
});

export const select = <K extends string, const V extends string>(
  key: K,
  label: string,
  options: readonly { value: V; label: string }[],
  opts: Opts & { default?: NoInfer<V>; display?: SelectDisplay } = {},
) => ({
  ...opts,
  key,
  label,
  kind: "select" as const,
  options,
  default: opts.default ?? options[0]!.value,
});

/** A YouTube or Vimeo address — see `parseVideoUrl`. Nothing else is embeddable. */
export const video = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "video" as const,
});

export const toggle = <K extends string>(key: K, label: string, opts: Opts & { default?: boolean } = {}) => ({
  ...opts,
  key,
  label,
  kind: "toggle" as const,
  default: opts.default ?? false,
});

export const number = <K extends string>(
  key: K,
  label: string,
  opts: Opts & { min: number; max: number; default: number },
) => ({ ...opts, key, label, kind: "number" as const });

/**
 * A colour, stored as `#rrggbb` or "" for "none". Only that shape is accepted —
 * the value lands in a style attribute, so nothing else may get through.
 */
export const color = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "color" as const,
});

export const product = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "product" as const,
});

export const products = <K extends string>(key: K, label: string, opts: Opts & { max: number }) => ({
  ...opts,
  key,
  label,
  kind: "products" as const,
});

export const collection = <K extends string>(key: K, label: string, opts: Opts = {}) => ({
  ...opts,
  key,
  label,
  kind: "collection" as const,
});

export const collections = <K extends string>(key: K, label: string, opts: Opts & { max: number }) => ({
  ...opts,
  key,
  label,
  kind: "collections" as const,
});

/**
 * The advanced look — typography, background, effects, layout, per device. One
 * object (see `design.ts`), empty by default, so adding it changes nothing.
 */
export const design = <K extends string>(
  key: K,
  label: string,
  opts: Opts & { parts?: readonly DesignPart[] } = {},
) => ({ ...opts, key, label, kind: "design" as const, parts: opts.parts ?? ALL_DESIGN_PARTS });

export const block = <const T extends string, const F extends readonly LeafFieldDef[]>(
  type: T,
  label: string,
  fields: F,
  opts: { summaryKey?: F[number]["key"] } = {},
) => ({ type, label, fields, ...opts });

export const blocks = <K extends string, const B extends readonly BlockDef[]>(
  key: K,
  label: string,
  opts: Opts & { blocks: B; max: number; defaults?: readonly B[number]["type"][] },
) => ({ ...opts, key, label, kind: "blocks" as const, defaults: opts.defaults ?? [] });

/* -------------------------------------------------------------------------- *
 * Blocks — ids and instances
 * -------------------------------------------------------------------------- */

const BLOCK_ID = /^b_[a-z0-9]{6,24}$/;

export function newBlockId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `b_${Array.from(bytes, (byte) => (byte % 36).toString(36)).join("")}`;
}

export function createBlock(definition: BlockDef): BlockValue {
  return {
    id: newBlockId(),
    type: definition.type,
    settings: Object.fromEntries(definition.fields.map((field) => [field.key, fieldDefault(field)])),
  };
}

export function blockDefinition(field: BlocksFieldDef, type: string): BlockDef | null {
  return field.blocks.find((candidate) => candidate.type === type) ?? null;
}

/* -------------------------------------------------------------------------- *
 * Validation
 * -------------------------------------------------------------------------- */

/**
 * Where a link may point. A path on this site, an https URL, an email address or
 * a phone number — and nothing else. `javascript:`, `data:` and protocol-relative
 * `//host` are refused here, on the server, whatever the editor sent.
 */
export function isSafeHref(href: string): boolean {
  if (/[\u0000-\u001f\s]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  if (href.startsWith("#")) return true;
  return /^(https:\/\/[^/]|mailto:|tel:)/i.test(href);
}

/**
 * The two video hosts a Video section may embed, reduced to provider and id —
 * the embed URL is built from those alone, never from what was typed, so the
 * address field cannot smuggle a different host or parameters into the iframe.
 */
export type VideoRef = { provider: "youtube" | "vimeo"; id: string };

export function parseVideoUrl(value: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const youtubeId = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return youtubeId.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? "";
    return youtubeId.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/|$)/)?.[1];
    return id ? { provider: "vimeo", id } : null;
  }
  return null;
}

const HANDLE = /^[a-z0-9][a-z0-9-]*$/;

const resourceRefSchema = (kind: "Product" | "Collection") =>
  z.strictObject({
    id: z.string().regex(new RegExp(`^gid://shopify/${kind}/\\d+$`)),
    handle: z.string().max(255).regex(HANDLE),
    title: z.string().max(255),
  });

const linkSchema = z.strictObject({
  label: z.string().max(80),
  href: z.string().max(2048).refine(isSafeHref, "Use a path like /shop, or an https:// address."),
});

type RichNode = { type?: unknown; url?: unknown; children?: unknown };

/** Every link in the tree must pass `isSafeHref`; depth-capped so a crafted tree cannot recurse forever. */
function richLinksSafe(node: RichNode, depth = 0): boolean {
  if (depth > 32 || !node || typeof node !== "object") return false;
  if (node.type === "link" && !(typeof node.url === "string" && isSafeHref(node.url))) return false;
  if (node.children === undefined) return true;
  return Array.isArray(node.children) && node.children.every((child) => richLinksSafe(child as RichNode, depth + 1));
}

/**
 * Rich text is Shopify's AST, as the panel's Tiptap editor writes it and as
 * `richTextToHtml` renders it — every text node escaped there. Anything that
 * does not parse as that AST is refused, so a crafted HTML string never reaches
 * the renderer as "rich text".
 *
 * Links are checked too. `richTextToHtml` escapes a link's `url` but does not
 * look at its scheme, so a `javascript:` link would survive rendering; the
 * builder refuses one here, on write and again on read.
 */
const richTextSchema = z
  .string()
  .max(64 * 1024)
  .refine((value) => {
    if (value === "") return true;
    try {
      const parsed = JSON.parse(value) as RichNode;
      return parsed?.type === "root" && richLinksSafe(parsed);
    } catch {
      return false;
    }
  }, "Not valid rich text, or it contains a link that is not allowed.");

function blockSettingsSchema(definition: BlockDef, mode: "strict" | "lenient"): z.ZodType {
  const shape = Object.fromEntries(
    definition.fields.map((field) => [
      field.key,
      mode === "strict" ? fieldSchema(field) : lenientFieldSchema(field),
    ]),
  );
  return mode === "strict" ? z.strictObject(shape) : z.object(shape);
}

function blocksSchema(field: BlocksFieldDef): z.ZodType {
  const variants = field.blocks.map((definition) =>
    z.strictObject({
      id: z.string().regex(BLOCK_ID),
      type: z.literal(definition.type),
      settings: blockSettingsSchema(definition, "strict"),
    }),
  ) as unknown as [z.ZodObject, ...z.ZodObject[]];

  return z
    .array(z.discriminatedUnion("type", variants))
    .max(field.max)
    .superRefine((items, context) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        const { id } = item as { id: string };
        if (seen.has(id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate block id." });
        seen.add(id);
      });
    });
}

/**
 * Blocks read leniently ONE AT A TIME: an unknown block type or a block with no
 * usable id is dropped, a bad setting inside a block becomes its default, and the
 * rest of the list survives. Catching the whole array instead would lose every
 * question in a FAQ because one of them was damaged.
 */
function lenientBlocks(field: BlocksFieldDef): z.ZodType {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) => {
      const seen = new Set<string>();
      const kept: BlockValue[] = [];

      for (const item of items.slice(0, field.max)) {
        const candidate = item as { id?: unknown; type?: unknown; settings?: unknown } | null;
        const id = typeof candidate?.id === "string" && BLOCK_ID.test(candidate.id) ? candidate.id : null;
        const definition = typeof candidate?.type === "string" ? blockDefinition(field, candidate.type) : null;
        if (!id || !definition || seen.has(id)) continue;

        const settings = blockSettingsSchema(definition, "lenient").safeParse(
          candidate?.settings && typeof candidate.settings === "object" ? candidate.settings : {},
        );
        if (!settings.success) continue;

        seen.add(id);
        kept.push({ id, type: definition.type, settings: settings.data as Record<string, unknown> });
      }

      return kept;
    });
}

/** What a READ goes through: never fails, a bad value becomes its default. */
export function lenientFieldSchema(field: FieldDef): z.ZodType {
  if (field.kind === "blocks") return lenientBlocks(field);
  // Part by part, so one damaged value costs that value and not the whole design.
  // `optional()` first: in Zod 4 a bare transform makes a missing key an error, and a
  // section saved before the design existed has none.
  if (field.kind === "design") return z.unknown().optional().transform(readDesign);
  return fieldSchema(field).catch(fieldDefault(field));
}

/** The strict schema for one field — what a WRITE must satisfy. */
export function fieldSchema(field: FieldDef): z.ZodType {
  switch (field.kind) {
    case "text":
    case "textarea":
      return z.string().max(field.max);
    case "richText":
      return richTextSchema;
    case "image":
      return imageRefSchema.nullable();
    case "imageList":
      return z
        .array(z.strictObject({ image: imageRefSchema, caption: z.string().max(200) }))
        .max(field.max);
    case "link":
      return linkSchema.nullable();
    case "url":
      return z
        .string()
        .max(2048)
        .refine((value) => value === "" || isSafeHref(value), "Use a path like /shop, or an https:// address.");
    case "video":
      return z
        .string()
        .max(512)
        .refine((value) => value === "" || parseVideoUrl(value) !== null, "Paste a YouTube or Vimeo address.");
    case "select":
      return z.enum(field.options.map((option) => option.value) as [string, ...string[]]);
    case "toggle":
      return z.boolean();
    case "number":
      return z.number().int().min(field.min).max(field.max);
    case "color":
      return z.string().refine((value) => value === "" || HEX_COLOR.test(value), "Use a colour like #302f2d.");
    case "product":
      return resourceRefSchema("Product").nullable();
    case "products":
      return z.array(resourceRefSchema("Product")).max(field.max);
    case "collection":
      return resourceRefSchema("Collection").nullable();
    case "collections":
      return z.array(resourceRefSchema("Collection")).max(field.max);
    case "blocks":
      return blocksSchema(field);
    case "design":
      // Optional on write too: a section built before the design existed has none.
      return designSchema.optional();
  }
}

export function fieldDefault(field: FieldDef): unknown {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "url":
    case "select":
    case "toggle":
    case "number":
      return field.default;
    case "richText":
    case "video":
    case "color":
      return "";
    case "image":
    case "link":
    case "product":
    case "collection":
      return null;
    case "imageList":
    case "products":
    case "collections":
      return [];
    case "design":
      return {};
    case "blocks":
      return field.defaults.flatMap((type) => {
        const definition = blockDefinition(field, type);
        return definition ? [createBlock(definition)] : [];
      });
  }
}

/** Whether `when` currently shows the field, given the section's other settings. */
export function isFieldActive(field: FieldDef, settings: Record<string, unknown>): boolean {
  if (!field.when) return true;
  return field.when.is.includes(settings[field.when.field] as string | boolean);
}

/** Has the operator filled this in? What `required` means at publish time. */
export function isFieldFilled(field: FieldDef, value: unknown): boolean {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "url":
    case "video":
    case "color":
      return typeof value === "string" && value.trim() !== "";
    case "richText":
      return typeof value === "string" && value !== "" && /"value":"\s*\S/.test(value);
    case "link":
      return Boolean(value && (value as LinkValue).href && (value as LinkValue).label);
    case "imageList":
    case "products":
    case "collections":
    case "blocks":
      return Array.isArray(value) && value.length > 0;
    case "image":
    case "product":
    case "collection":
      return value !== null && value !== undefined;
    case "select":
    case "toggle":
    case "number":
    case "design":
      return true;
  }
}

/**
 * Required fields left empty INSIDE a blocks field, labelled so the operator can
 * find them: "Question 2: Answer".
 */
export function blockProblems(field: BlocksFieldDef, value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const counts = new Map<string, number>();
  return (value as BlockValue[]).flatMap((item) => {
    const definition = blockDefinition(field, item.type);
    if (!definition) return [];

    const position = (counts.get(item.type) ?? 0) + 1;
    counts.set(item.type, position);

    return definition.fields
      .filter((child) => child.required && isFieldActive(child, item.settings))
      .filter((child) => !isFieldFilled(child, item.settings[child.key]))
      .map((child) => `${definition.label} ${position}: ${child.label}`);
  });
}
