import type { SectionCategory } from "./define-section";
import { createSection, type SectionInstance } from "./document";
import { blockDefinition, createBlock, type FieldDef } from "./fields";
import { SECTION_CATEGORIES, SECTION_TYPES, SECTIONS, type SectionType } from "./registry";

/**
 * PRESETS — what Add section offers. A preset is a section type with settings
 * chosen in advance and demo copy filled in, the way a Shopify theme's presets
 * are: "Icon features" and "Cards" are both the Columns section, set up two ways.
 *
 * A preset is only a starting point. What it produces is an ordinary section,
 * every setting still editable, validated by the same schema as one built by
 * hand — `sectionFromPreset` runs the result through the section's own lenient
 * read, so a preset can never create a section the API would refuse.
 *
 * Images are never pre-filled: the operator's own photographs belong there, and
 * the preview shows a neutral box until one is chosen. A required image left
 * empty blocks publishing, as for any section.
 *
 * Each preset's `id` also names its picture in Add section
 * (`components/admin/page-builder/section-thumbnails.tsx`).
 */

export type PresetBlock = { type: string; settings?: Record<string, unknown> };

export type SectionPreset = {
  id: string;
  type: SectionType;
  label: string;
  description: string;
  category: SectionCategory;
  /** Values over the section's defaults. A blocks field takes `PresetBlock[]`. */
  settings?: Record<string, unknown>;
};

/** One paragraph of Shopify rich text. */
const para = (...paragraphs: string[]) =>
  JSON.stringify({
    type: "root",
    children: paragraphs.map((value) => ({ type: "paragraph", children: [{ type: "text", value }] })),
  });

const repeat = (count: number, block: (index: number) => PresetBlock) => Array.from({ length: count }, (_, index) => block(index));

/** Alternative set-ups of a section, beyond the one its own defaults give. Listed after it. */
const VARIANTS: SectionPreset[] = [
  /* ---------------- Build your own ---------------- */
  {
    id: "custom_section",
    type: "custom_section",
    label: "Custom section",
    description: "Starts with a heading, text and a button — then add any block you like, stacked or in columns.",
    category: "Build your own",
    settings: {
      blocks: [
        { type: "heading", settings: { title: "Your heading here" } },
        { type: "text", settings: { body: para("Write a few lines here. Add photos, buttons, icons, a video or a list with Add block — and put them side by side with Column blocks.") } },
        { type: "button", settings: { link: { label: "learn more", href: "/shop" } } },
      ],
    },
  },
  {
    id: "custom_section.photo",
    type: "custom_section",
    label: "Photo beside text",
    description: "A photograph on one side; a label, heading, text and button on the other. Every block can be changed.",
    category: "Build your own",
    settings: {
      columnGap: "lg",
      blocks: [
        { type: "column" },
        { type: "image", settings: { ratio: "portrait" } },
        { type: "column", settings: { position: "middle" } },
        { type: "eyebrow", settings: { eyebrow: "The workshop" } },
        { type: "heading", settings: { title: "Made by hand, made to last" } },
        { type: "text", settings: { body: para("A few lines on how the pieces are made, by whom, and why it matters.") } },
        { type: "button", settings: { link: { label: "our story", href: "/our-story" }, style: "outline" } },
      ],
    },
  },
  {
    id: "custom_section.features",
    type: "custom_section",
    label: "Heading and three features",
    description: "A centred heading over three icons with a short text each.",
    category: "Build your own",
    settings: {
      align: "center",
      blocks: [
        { type: "heading", settings: { title: "Why clients choose us" } },
        { type: "column" },
        { type: "icon", settings: { icon: "hammer", title: "Made by hand", body: para("By the workshops that design them.") } },
        { type: "column" },
        { type: "icon", settings: { icon: "truck", title: "White-glove delivery", body: para("Placed in the room, packaging taken away.") } },
        { type: "column" },
        { type: "icon", settings: { icon: "shield", title: "Five-year guarantee", body: para("On every frame and every joint.") } },
      ],
    },
  },
  {
    id: "custom_section.cards",
    type: "custom_section",
    label: "Four cards",
    description: "Four photo cards in a row — two on tablets, one under the other on phones.",
    category: "Build your own",
    settings: {
      blocks: [
        { type: "heading", settings: { title: "Ways to work with us" } },
        ...["Shop the collection", "Made to order", "Interior projects", "Visit a showroom"].flatMap((title) => [
          { type: "column", settings: { width: "25", widthTablet: "50" } },
          { type: "card", settings: { title, body: para("A sentence on what this means for the client."), link: { label: "learn more", href: "/contact" } } },
        ]),
      ],
    },
  },
  {
    id: "custom_section.questions",
    type: "custom_section",
    label: "Questions and answers",
    description: "A heading with questions that open to show their answer, on a narrow column.",
    category: "Build your own",
    settings: {
      width: "narrow",
      gap: "none",
      blocks: [
        { type: "heading", settings: { title: "Good to know", space: "none" } },
        { type: "space", settings: { height: 24, heightMobile: 16 } },
        ...["How long does delivery take?", "Can I change the size or material?", "Do you deliver abroad?"].map((title) => ({
          type: "fold",
          settings: { title, body: para("The answer, in a few clear sentences.") },
        })),
      ],
    },
  },

  /* ---------------- Banners ---------------- */
  {
    id: "image_banner",
    type: "image_banner",
    label: "Image banner",
    description: "A large photograph with a centred heading and two buttons.",
    category: "Banners",
    settings: {
      eyebrow: "New collection",
      title: "Designed for life, inspired by the world",
      body: "Pieces made to be lived with, by the makers who design them.",
      primary: { label: "discover", href: "/shop" },
      secondary: { label: "our story", href: "/our-story" },
    },
  },
  {
    id: "image_banner.corner",
    type: "image_banner",
    label: "Banner — text in the corner",
    description: "Very large type at the bottom left of a full-screen photograph. Editorial, quiet.",
    category: "Banners",
    settings: {
      title: "The quiet room",
      headingSize: "display",
      position: "bottom-left",
      align: "left",
      height: "screen",
      overlay: 20,
      primary: { label: "explore", href: "/shop" },
      primaryStyle: "text",
    },
  },
  {
    id: "image_banner.panel",
    type: "image_banner",
    label: "Banner with text panel",
    description: "The copy on a solid panel over the photograph — readable on any image.",
    category: "Banners",
    settings: {
      eyebrow: "Atelier",
      title: "Made to order, made to last",
      body: "Every piece is built by hand once it is ordered, in the material and the size you choose.",
      position: "middle-left",
      align: "left",
      tone: "dark",
      overlay: 0,
      panel: true,
      headingSize: "h2",
      primary: { label: "start a commission", href: "/contact" },
      primaryStyle: "outline",
    },
  },
  {
    id: "image_banner.short",
    type: "image_banner",
    label: "Short banner",
    description: "A low strip of photograph with one line on it — the top of an inner page.",
    category: "Banners",
    settings: { title: "Projects", height: "small", headingSize: "h1", overlay: 35 },
  },
  {
    id: "slideshow",
    type: "slideshow",
    label: "Hero slider",
    description: "Slides with their own photo, heading and buttons — each one designed on its own.",
    category: "Banners",
    settings: {
      slides: [
        { type: "slide", settings: { eyebrow: "New in", title: "Soft geometry", link: { label: "discover", href: "/shop" } } },
        { type: "slide", settings: { eyebrow: "Collections", title: "Rooms with a story", link: { label: "see the collections", href: "/collections" } } },
        { type: "slide", settings: { eyebrow: "Projects", title: "Spaces we furnished", link: { label: "see projects", href: "/projects" } } },
      ],
    },
  },
  {
    id: "cta_banner",
    type: "cta_banner",
    label: "Call to action",
    description: "One centred message and its buttons, on the band's colour.",
    category: "Banners",
    settings: {
      title: "Let us furnish your next project",
      body: "Tell us about the space, the timing and the feeling you are after. We answer within two working days.",
      primary: { label: "get in touch", href: "/contact" },
      secondary: { label: "see projects", href: "/projects" },
      surface: "dark",
    },
  },
  {
    id: "cta_banner.split",
    type: "cta_banner",
    label: "Call to action — split",
    description: "The message on the left, the buttons on the right, under a hairline.",
    category: "Banners",
    settings: {
      layout: "split",
      title: "Visit the showroom",
      body: "See, touch and sit on the pieces before you choose.",
      headingSize: "h2",
      primary: { label: "plan a visit", href: "/our-locations" },
    },
  },
  {
    id: "cta_banner.image",
    type: "cta_banner",
    label: "Call to action on a photograph",
    description: "The closing message over a full-width photograph.",
    category: "Banners",
    settings: {
      layout: "image",
      title: "Designed for life",
      body: "Furniture and objects from the designers we believe in.",
      primary: { label: "shop now", href: "/shop" },
      overlay: 40,
    },
  },

  /* ---------------- Text & media ---------------- */
  {
    id: "media_text.right",
    type: "media_text",
    label: "Image with text — image right",
    description: "The same band with the photograph on the right and the copy on the left.",
    category: "Text & media",
    settings: { title: "The idea", body: para("Write a few lines about the piece, the maker or the room."), align: "right" },
  },
  {
    id: "media_text.landscape",
    type: "media_text",
    label: "Image with text — wide photograph",
    description: "A larger landscape photograph beside a narrower column of copy.",
    category: "Text & media",
    settings: {
      eyebrow: "Material",
      title: "Oak, oiled by hand",
      body: para("Write a few lines about the material and the way it is finished."),
      ratio: "landscape",
      imageWidth: "wide",
      buttonStyle: "text",
      link: { label: "learn more", href: "/care-maintenance" },
    },
  },
  {
    id: "multicolumn",
    type: "multicolumn",
    label: "Columns with images",
    description: "Three photographs side by side, each with a heading, a few lines and a link.",
    category: "Text & media",
    settings: {
      title: "Ways to work with us",
      columns: [
        { type: "column", settings: { title: "Shop the collection", body: para("Pieces in stock, ready to deliver."), link: { label: "shop", href: "/shop" } } },
        { type: "column", settings: { title: "Made to order", body: para("Your size, your material, built for you."), link: { label: "enquire", href: "/contact" } } },
        { type: "column", settings: { title: "Interior projects", body: para("Complete rooms, from plan to placement."), link: { label: "see projects", href: "/projects" } } },
      ],
    },
  },
  {
    id: "multicolumn.icons",
    type: "multicolumn",
    label: "Icon features",
    description: "Four short promises, each under an icon — delivery, craft, guarantee, advice.",
    category: "Text & media",
    settings: {
      media: "icon",
      columnsDesktop: "4",
      columnsMobile: "2",
      align: "center",
      headingAlign: "center",
      columns: [
        { type: "column", settings: { icon: "truck", title: "White-glove delivery", body: para("Placed in the room, packaging taken away.") } },
        { type: "column", settings: { icon: "hammer", title: "Made by hand", body: para("By the workshops that design them.") } },
        { type: "column", settings: { icon: "shield", title: "Five-year guarantee", body: para("On every frame and every joint.") } },
        { type: "column", settings: { icon: "message", title: "Personal advice", body: para("In the showroom or at your home.") } },
      ],
    },
  },
  {
    id: "multicolumn.cards",
    type: "multicolumn",
    label: "Cards",
    description: "Text on soft panels — services, reasons to choose, what is included.",
    category: "Text & media",
    settings: {
      title: "What is included",
      media: "none",
      style: "cards",
      columns: repeat(3, (index) => ({
        type: "column",
        settings: {
          title: ["Measured visit", "Material samples", "Installation"][index],
          body: para("A sentence or two on what this means for the client."),
        },
      })),
    },
  },
  {
    id: "multicolumn.text",
    type: "multicolumn",
    label: "Text columns",
    description: "Columns of text divided by hairlines — principles, values, a manifesto.",
    category: "Text & media",
    settings: {
      media: "none",
      style: "lines",
      columns: repeat(3, (index) => ({
        type: "column",
        settings: { title: ["Honest materials", "Slow design", "Made to last"][index], body: para("A few lines on what this means in practice.") },
      })),
    },
  },
  {
    id: "stats",
    type: "stats",
    label: "Numbers",
    description: "Key figures in large type, each with a label.",
    category: "Text & media",
    settings: {
      items: [
        { type: "stat", settings: { value: "25+", label: "Years of design" } },
        { type: "stat", settings: { value: "40", label: "Workshops in Europe" } },
        { type: "stat", settings: { value: "1 200", label: "Interiors furnished" } },
      ],
    },
  },
  {
    id: "steps",
    type: "steps",
    label: "Steps",
    description: "A process in numbered steps, in a row.",
    category: "Text & media",
    settings: {
      title: "How a commission works",
      items: [
        { type: "step", settings: { title: "Conversation", body: para("We listen to what the room and the people in it need.") } },
        { type: "step", settings: { title: "Proposal", body: para("Drawings, materials and a price, within two weeks.") } },
        { type: "step", settings: { title: "Making", body: para("The workshop builds the piece by hand.") } },
        { type: "step", settings: { title: "Placing", body: para("We deliver, place and finish it in your home.") } },
      ],
    },
  },
  {
    id: "steps.timeline",
    type: "steps",
    label: "Timeline",
    description: "Steps or dates down a vertical line — a history, a project's progress.",
    category: "Text & media",
    settings: {
      title: "Our story",
      layout: "timeline",
      numbered: false,
      items: [
        { type: "step", settings: { title: "1998 — The first workshop", body: para("A short paragraph about this moment.") } },
        { type: "step", settings: { title: "2010 — The showroom opens", body: para("A short paragraph about this moment.") } },
        { type: "step", settings: { title: "Today", body: para("A short paragraph about this moment.") } },
      ],
    },
  },
  {
    id: "tabs",
    type: "tabs",
    label: "Tabs",
    description: "Several topics behind tabs, each with text, an image and a button.",
    category: "Text & media",
    settings: {
      title: "Materials",
      items: [
        { type: "tab", settings: { label: "Wood", title: "Solid oak and walnut", body: para("Describe the material, where it comes from and how it ages.") } },
        { type: "tab", settings: { label: "Textile", title: "Linen, wool and bouclé", body: para("Describe the material, where it comes from and how it ages.") } },
        { type: "tab", settings: { label: "Stone", title: "Travertine and marble", body: para("Describe the material, where it comes from and how it ages.") } },
      ],
    },
  },
  {
    id: "collapsible",
    type: "collapsible",
    label: "Collapsible content",
    description: "Rows that open on click, beside a photograph.",
    category: "Text & media",
    settings: {
      title: "Good to know",
      rows: [
        { type: "row", settings: { heading: "Delivery", body: para("How and when a piece is delivered.") } },
        { type: "row", settings: { heading: "Care", body: para("How to look after the materials.") } },
        { type: "row", settings: { heading: "Returns", body: para("What happens if a piece is not right.") } },
      ],
      openFirst: true,
    },
  },
  {
    id: "video",
    type: "video",
    label: "Video",
    description: "A YouTube or Vimeo film behind a cover image.",
    category: "Text & media",
    settings: { title: "Inside the workshop", width: "medium" },
  },
  {
    id: "marquee",
    type: "marquee",
    label: "Scrolling text",
    description: "Short phrases moving slowly across the page.",
    category: "Text & media",
    settings: {
      items: ["Designed for life", "Inspired by the world", "Made by hand"].map((text) => ({ type: "item", settings: { text } })),
      lines: true,
    },
  },

  /* ---------------- Images ---------------- */
  {
    id: "collage",
    type: "collage",
    label: "Collage",
    description: "One large photograph beside smaller ones, each with a title and link.",
    category: "Images",
    settings: {
      tiles: [
        { type: "tile", settings: { title: "Living", href: "/shop" } },
        { type: "tile", settings: { title: "Dining", href: "/shop" } },
        { type: "tile", settings: { title: "Lighting", href: "/shop" } },
      ],
    },
  },
  {
    id: "collage.even",
    type: "collage",
    label: "Image grid with titles",
    description: "Photographs in an even grid, titles on the image — rooms, categories, projects.",
    category: "Images",
    settings: {
      layout: "even",
      captions: "overlay",
      tiles: ["Living", "Dining", "Bedroom"].map((title) => ({ type: "tile", settings: { title } })),
    },
  },

  /* ---------------- Social proof ---------------- */
  {
    id: "testimonials",
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes from clients in a grid, each with a name.",
    category: "Social proof",
    settings: {
      title: "What our clients say",
      quotes: repeat(3, (index) => ({
        type: "quote",
        settings: {
          quote: "Write what the client said, in their words.",
          author: ["Client name", "Architect", "Magazine"][index],
          role: ["Antwerp", "Studio name", "Issue, year"][index],
        },
      })),
    },
  },
  {
    id: "testimonials.single",
    type: "testimonials",
    label: "Large quote",
    description: "One quote at a time, in large type — a press line, a designer's words.",
    category: "Social proof",
    settings: {
      layout: "single",
      quotes: [{ type: "quote", settings: { quote: "A short, strong sentence someone said about the work.", author: "Name", role: "Publication" } }],
    },
  },
  {
    id: "logo_list",
    type: "logo_list",
    label: "Logo list",
    description: "A row of logos — press, partners, brands.",
    category: "Social proof",
    settings: { title: "As seen in", headingAlign: "center" },
  },

  /* ---------------- Catalogue ---------------- */
  {
    id: "featured_product",
    type: "featured_product",
    label: "Featured product",
    description: "One product with its photographs and its story.",
    category: "Catalogue",
    settings: { eyebrow: "Featured" },
  },

  /* ---------------- Layout ---------------- */
  {
    id: "spacer.divider",
    type: "spacer",
    label: "Divider",
    description: "A hairline between two bands, within the page margins.",
    category: "Layout",
    settings: { height: "xs", line: "contained" },
  },

  /* ---------------- Site ---------------- */
  {
    id: "newsletter",
    type: "newsletter",
    label: "Newsletter sign-up",
    description: "An email field with a heading and a short invitation.",
    category: "Site",
    settings: {
      title: "Stay in touch",
      body: "Seasonal news, new pieces and invitations to our events. A few emails a year, never more.",
    },
  },
];

/**
 * Every preset, in Add section order: by category, and within one the registry's
 * order, each type followed by its variants. A type with no preset of its own
 * id is offered as itself, from its defaults.
 */
export const SECTION_PRESETS: readonly SectionPreset[] = SECTION_CATEGORIES.flatMap((category) =>
  SECTION_TYPES.filter((type) => SECTIONS[type].category === category && !SECTIONS[type].hidden).flatMap((type) => {
    const definition = SECTIONS[type];
    const own = VARIANTS.filter((preset) => preset.type === type);
    const base = own.find((preset) => preset.id === type) ?? {
      id: type,
      type,
      label: definition.label,
      description: definition.description,
      category,
    };
    return [base, ...own.filter((preset) => preset.id !== type)];
  }),
);

export function presetById(id: string): SectionPreset | null {
  return SECTION_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** A new section from a preset: its defaults, the preset's values over them, fresh block ids. */
export function sectionFromPreset(preset: SectionPreset): SectionInstance {
  const section = createSection(preset.type);
  const definition = SECTIONS[preset.type];
  const base = section.settings as Record<string, unknown>;
  const settings: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(preset.settings ?? {})) {
    if (!Object.hasOwn(base, key)) continue;
    const field = (definition.fields as readonly FieldDef[]).find((candidate) => candidate.key === key);
    if (field?.kind === "blocks" && Array.isArray(value)) {
      settings[key] = (value as PresetBlock[]).flatMap((item) => {
        const blockDef = blockDefinition(field, item.type);
        if (!blockDef) return [];
        const created = createBlock(blockDef);
        return [{ ...created, settings: { ...created.settings, ...item.settings } }];
      });
    } else {
      settings[key] = value;
    }
  }

  return { ...section, settings: definition.lenient(settings) } as SectionInstance;
}
