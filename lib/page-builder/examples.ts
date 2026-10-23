import type { SectionInstance } from "./document";
import {
  blockDefinition,
  isFieldActive,
  isFieldFilled,
  type BlockValue,
  type FieldDef,
  type ImageRef,
  type LeafFieldDef,
  type ResourceRef,
} from "./fields";
import { sectionDefinition } from "./registry";

/**
 * EXAMPLE CONTENT for a section just added — so it arrives looking like a section, not
 * an empty band an editor cannot see and is not sure was added at all (Elementor's
 * "Add Your Heading Text Here").
 *
 * Only what is still EMPTY is filled, and only content: a preset's own copy stays,
 * and no colour, size or choice is touched. A field whose emptiness means something
 * ("Leave empty to use the page title") is left empty. Images, products and
 * collections are the shop's own (`ExampleMedia`), so the example looks like this site.
 *
 * It is a start, not content: the Add section dialog says so, and every value is
 * edited in place.
 */

export type ExampleMedia = { images: ImageRef[]; products: ResourceRef[]; collections: ResourceRef[] };

export const NO_EXAMPLE_MEDIA: ExampleMedia = { images: [], products: [], collections: [] };

/** Example words by field key; anything else gets its label. */
const WORDS: Record<string, string> = {
  title: "Your heading here",
  introTitle: "A heading for the intro",
  eyebrow: "Small label",
  body: "Write a few lines here to tell visitors more. This is example text — click it in the editor to put your own words in its place.",
  introBody: "A short introduction. Replace this example with your own words.",
  summary: "One short paragraph under the heading. Replace this example with your own.",
  text: "Example text — replace it with your own.",
  caption: "Example caption",
  question: "An example question visitors often ask?",
  answer: "The answer, in a few clear sentences. Replace this example with your own.",
  quote: "A sentence a client said about working with Studio Bizar — replace it with a real one.",
  author: "Client name",
  name: "Name",
  role: "Role or place",
  value: "25+",
  label: "Example label",
  item: "Example phrase",
  buttonLabel: "learn more",
};

/** Shopify's rich text AST, one paragraph — what the rich text editor writes. */
const richParagraph = (text: string) =>
  JSON.stringify({ type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: text }] }] });

/** Fields whose emptiness has a meaning of its own. */
const meansSomethingEmpty = (field: LeafFieldDef) => /leave empty|empty uses|optional/i.test(field.help ?? "");

type Pools = { image: number; product: number; collection: number };

function example(field: LeafFieldDef, media: ExampleMedia, next: Pools): unknown | undefined {
  const pick = <T>(list: T[], key: keyof Pools): T | undefined => {
    if (!list.length) return undefined;
    const value = list[next[key] % list.length];
    next[key] += 1;
    return value;
  };

  switch (field.kind) {
    case "text":
      return (WORDS[field.key] ?? field.label).slice(0, field.max);
    case "textarea":
      return (WORDS[field.key] ?? WORDS.body!).slice(0, field.max);
    case "richText":
      return richParagraph(WORDS[field.key] ?? WORDS.body!);
    case "link":
      return { label: "learn more", href: "/shop" };
    case "image":
      return pick(media.images, "image");
    case "imageList": {
      const images = Array.from({ length: Math.min(3, field.max, media.images.length) }, () => pick(media.images, "image")!);
      return images.length ? images.map((image) => ({ image, caption: field.captions ? WORDS.caption! : "" })) : undefined;
    }
    case "product":
      return pick(media.products, "product");
    case "products":
      return media.products.length ? media.products.slice(0, Math.min(field.max, 4)) : undefined;
    case "collection":
      return pick(media.collections, "collection");
    case "collections":
      return media.collections.length ? media.collections.slice(0, Math.min(field.max, 4)) : undefined;
    default:
      // Selects, toggles, numbers, colours, design, a video address: left as they are.
      return undefined;
  }
}

function fill(fields: readonly FieldDef[], settings: Record<string, unknown>, media: ExampleMedia, next: Pools) {
  const out = { ...settings };
  for (const field of fields) {
    if (!isFieldActive(field, out)) continue;
    if ((field.group ?? "content") !== "content") continue;

    if (field.kind === "blocks") {
      out[field.key] = ((out[field.key] as BlockValue[]) ?? []).map((item) => {
        const definition = blockDefinition(field, item.type);
        return definition ? { ...item, settings: fill(definition.fields, item.settings, media, next) } : item;
      });
      continue;
    }
    if (isFieldFilled(field, out[field.key]) || meansSomethingEmpty(field)) continue;
    const value = example(field, media, next);
    if (value !== undefined) out[field.key] = value;
  }
  return out;
}

/** The section with its empty content filled with examples. */
export function withExamples(section: SectionInstance, media: ExampleMedia): SectionInstance {
  const definition = sectionDefinition(section.type);
  if (!definition) return section;
  // A different photograph for each new section, so two added in a row do not look alike.
  const offset = media.images.length ? Math.floor(Math.random() * media.images.length) : 0;
  const settings = fill(definition.fields, section.settings as Record<string, unknown>, media, { image: offset, product: 0, collection: 0 });
  return { ...section, settings: definition.lenient(settings) } as SectionInstance;
}
