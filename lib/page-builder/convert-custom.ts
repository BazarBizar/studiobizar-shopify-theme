import { STYLE_KEYS } from "./define-section";
import type { SectionInstance } from "./document";
import { blockDefinition, createBlock, type BlocksFieldDef, type BlockValue, type FieldDef } from "./fields";
import { SECTIONS } from "./registry";
import { customSection } from "./sections-custom";

/**
 * "Turn into Custom section" — an existing section rebuilt as Custom section
 * blocks, so the editor can add any block to it and arrange columns. Its words,
 * photos, links and Style tab come along; the arrangement is the nearest the
 * blocks can draw (Columns stay columns, Image with text stays photo beside text),
 * so it may look a little different, and the editor's Undo puts it back.
 *
 * Only for sections whose content is all typed into the section itself. A section
 * drawn from the catalogue or a content library (products, FAQ entries, services),
 * or one whose photograph is its ground (banners, slideshow), has no blocks it could
 * become, and is not offered the change: `canConvertToCustom` says which.
 */

type S = Record<string, unknown>;
type Draft = { type: string; settings?: S };

const BLOCKS = (customSection.fields as readonly FieldDef[]).find((field) => field.kind === "blocks") as BlocksFieldDef;

/** Plain text (a textarea) → Shopify rich text, one paragraph per line. */
function richFromPlain(value: unknown): string {
  const lines = typeof value === "string" ? value.split(/\n+/).map((line) => line.trim()).filter(Boolean) : [];
  if (lines.length === 0) return "";
  return JSON.stringify({
    type: "root",
    children: lines.map((line) => ({ type: "paragraph", children: [{ type: "text", value: line }] })),
  });
}

const str = (value: unknown) => (typeof value === "string" ? value : "");
const filled = (value: unknown) => str(value).trim() !== "";
const hasRich = (value: unknown) => typeof value === "string" && /"value":"\s*\S/.test(value);
const hasLink = (value: unknown) => Boolean(value && typeof value === "object" && (value as { href?: string }).href);
const list = (value: unknown) => (Array.isArray(value) ? (value as BlockValue[]) : []);

/** A section's own heading and intro, as blocks — what `sectionHeading()` sections start with. */
function heading(s: S, align?: unknown): Draft[] {
  const own = align === "center" ? { align: "center" } : {};
  return [
    ...(filled(s.title) ? [{ type: "heading", settings: { title: str(s.title), ...own } }] : []),
    ...(filled(s.intro) ? [{ type: "text", settings: { body: richFromPlain(s.intro), ...own } }] : []),
  ];
}

const button = (first: unknown, firstStyle: unknown, second?: unknown, secondStyle?: unknown): Draft[] =>
  hasLink(first) || hasLink(second)
    ? [
        {
          type: "button",
          settings: {
            link: hasLink(first) ? first : second,
            style: hasLink(first) ? firstStyle : secondStyle,
            ...(hasLink(first) && hasLink(second) ? { second, secondStyle } : {}),
          },
        },
      ]
    : [];

/** Columns across on desktop → the Column width that gives that many in a row. */
const ACROSS: Record<string, string> = { "1": "100", "2": "50", "3": "33", "4": "25", "5": "20" };

/** A run of items, each in a Column: `across` on desktop, two on tablets, `phones` on phones. */
function columns(items: Draft[][], across: string, phones = "100"): Draft[] {
  const width = ACROSS[across] ?? "equal";
  return items.flatMap((item) => [
    { type: "column", settings: { width, widthTablet: width === "100" ? "100" : "50", widthMobile: phones } },
    ...item,
  ]);
}

/** Blocks after a run of columns would land in the last column; a full-width one takes them. */
const fullRow = (after: Draft[]): Draft[] =>
  after.length ? [{ type: "column", settings: { width: "100", widthMobile: "100" } }, ...after] : [];

const WIDTH: Record<string, string> = { narrow: "narrow", medium: "medium", full: "page", wide: "page" };
const RATIO: Record<string, string> = { portrait: "portrait", square: "square", landscape: "landscape", adapt: "adapt" };

type Converted = { blocks: Draft[]; layout?: S };

const CONVERTERS: Record<string, (s: S) => Converted | null> = {
  text_block: (s) => ({
    blocks: [
      ...(filled(s.title) ? [{ type: "heading", settings: { title: str(s.title) } }] : []),
      ...(hasRich(s.body) ? [{ type: "text", settings: { body: s.body } }] : []),
      ...button(s.link, s.buttonStyle),
    ],
  }),

  rich_text: (s) => ({
    blocks: list(s.blocks).flatMap((item): Draft[] => {
      const b = item.settings;
      if (item.type === "heading") return [{ type: "heading", settings: { title: str(b.text), size: b.level === "h3" ? "h3" : "h2" } }];
      if (item.type === "text") return [{ type: "text", settings: { body: b.body, size: b.scale === "lead" ? "lead" : "body" } }];
      if (item.type === "button") return button(b.link, b.style);
      return [];
    }),
    layout: { width: WIDTH[str(s.width)] ?? "medium", align: s.align === "center" ? "center" : "left" },
  }),

  media_text: (s) => {
    const imageWidth = s.imageWidth === "narrow" ? "33" : s.imageWidth === "wide" ? "67" : "50";
    const right = s.align === "right";
    const photo: Draft[] = [
      { type: "column", settings: { width: imageWidth, widthTablet: "50", ...(right ? { mobileFirst: true } : {}) } },
      { type: "image", settings: { image: s.image, ratio: RATIO[str(s.ratio)] ?? "portrait" } },
    ];
    const words: Draft[] = [
      { type: "column", settings: { position: s.verticalAlign === "top" ? "top" : s.verticalAlign === "bottom" ? "bottom" : "middle" } },
      ...(filled(s.eyebrow) ? [{ type: "eyebrow", settings: { eyebrow: str(s.eyebrow) } }] : []),
      ...(filled(s.title) ? [{ type: "heading", settings: { title: str(s.title) } }] : []),
      ...(hasRich(s.body) ? [{ type: "text", settings: { body: s.body } }] : []),
      ...button(s.link, s.buttonStyle),
    ];
    return { blocks: right ? [...words, ...photo] : [...photo, ...words], layout: { columnGap: "lg" } };
  },

  multicolumn: (s) => {
    const items = list(s.columns).map((item): Draft[] => {
      const b = item.settings;
      if (s.media === "image") {
        return [
          {
            type: "card",
            settings: {
              image: b.image,
              title: str(b.title),
              body: b.body,
              link: b.link,
              ratio: RATIO[str(s.ratio)] ?? "portrait",
              style: s.style === "cards" ? "panel" : "plain",
            },
          },
        ];
      }
      return [
        {
          type: "icon",
          settings: { icon: s.media === "icon" ? b.icon : "none", title: str(b.title), body: b.body, link: b.link },
        },
      ];
    });
    return {
      blocks: [
        ...heading(s, s.headingAlign),
        ...columns(items, str(s.columnsDesktop), s.columnsMobile === "2" ? "50" : "100"),
        ...fullRow(button(s.button, "outline")),
      ],
      layout: { align: s.align === "center" ? "center" : "left" },
    };
  },

  stats: (s) => {
    const items = list(s.items).map((item): Draft[] => [
      { type: "heading", settings: { title: str(item.settings.value), size: "h1", tag: "h3" } },
      ...(filled(item.settings.label) ? [{ type: "eyebrow", settings: { eyebrow: str(item.settings.label), space: "sm" } }] : []),
      ...(filled(item.settings.body) ? [{ type: "text", settings: { body: richFromPlain(item.settings.body), size: "small" } }] : []),
    ]);
    return {
      blocks: [...heading(s), ...columns(items, String(Math.min(items.length, 5)), "50")],
      layout: { align: s.align === "center" ? "center" : "left" },
    };
  },

  steps: (s) => {
    const items = list(s.items).map((item, index): Draft[] => [
      ...(s.showImages && item.settings.image ? [{ type: "image", settings: { image: item.settings.image, ratio: "landscape" } }] : []),
      ...(s.numbered !== false ? [{ type: "eyebrow", settings: { eyebrow: String(index + 1).padStart(2, "0") } }] : []),
      { type: "heading", settings: { title: str(item.settings.title), size: "h3" } },
      ...(hasRich(item.settings.body) ? [{ type: "text", settings: { body: item.settings.body, size: "small" } }] : []),
    ]);
    return { blocks: [...heading(s), ...columns(items, String(Math.min(items.length, 4)))] };
  },

  collapsible: (s) => {
    const rows: Draft[] = list(s.rows).map((item, index) => ({
      type: "fold",
      settings: { title: str(item.settings.heading), body: item.settings.body, open: Boolean(s.openFirst) && index === 0 },
    }));
    if (!s.image) return { blocks: [...heading(s), ...rows], layout: { gap: "none", width: "medium" } };
    return {
      blocks: [
        { type: "column", settings: { width: "50" } },
        { type: "image", settings: { image: s.image, ratio: "portrait" } },
        { type: "column" },
        ...heading(s),
        ...rows,
      ],
      layout: { gap: "none" },
    };
  },

  video: (s) => ({
    blocks: [
      ...heading(s, s.headingAlign),
      { type: "video", settings: { url: str(s.url), cover: s.cover, caption: str(s.caption), ratio: s.ratio === "4:3" || s.ratio === "9:16" ? s.ratio : "16:9" } },
    ],
    layout: { width: WIDTH[str(s.width)] ?? "page" },
  }),

  cta_banner: (s) =>
    // On a photograph, the photo is the section's ground — nothing a block can be.
    s.layout === "image"
      ? null
      : {
          blocks: [
            ...(filled(s.eyebrow) ? [{ type: "eyebrow", settings: { eyebrow: str(s.eyebrow) } }] : []),
            ...(filled(s.title)
              ? [{ type: "heading", settings: { title: str(s.title), size: s.headingSize === "display" ? "display" : s.headingSize === "h2" ? "h2" : "h1" } }]
              : []),
            ...(filled(s.body) ? [{ type: "text", settings: { body: richFromPlain(s.body) } }] : []),
            ...button(s.primary, s.primaryStyle, s.secondary, s.secondaryStyle),
          ],
          layout: { align: s.layout === "split" ? "left" : "center", width: WIDTH[str(s.width)] ?? "medium" },
        },

  testimonials: (s) => {
    const items = list(s.quotes).map((item): Draft[] => [
      ...(item.settings.image ? [{ type: "image", settings: { image: item.settings.image, ratio: "square", size: "25" } }] : []),
      { type: "quote", settings: { quote: str(item.settings.quote), author: str(item.settings.author), role: str(item.settings.role) } },
    ]);
    return { blocks: [...heading(s, s.headingAlign), ...columns(items, String(Math.min(items.length, 3)))] };
  },

  logo_list: (s) => {
    const items = list(s.logos)
      .filter((item) => item.settings.image)
      .map((item): Draft[] => [{ type: "image", settings: { image: item.settings.image, ratio: "adapt", size: "75" } }]);
    return {
      blocks: [...heading(s, s.headingAlign), ...columns(items, String(Math.min(Math.max(items.length, 1), 5)), "50")],
      layout: { align: "center" },
    };
  },
};

/** Whether this section can become a Custom section — the offer is only shown when it can. */
export function canConvertToCustom(section: SectionInstance): boolean {
  const convert = CONVERTERS[section.type];
  return Boolean(convert && convert(section.settings as S));
}

/**
 * The section as a Custom section: the same id, visibility and Style tab, its content
 * as blocks. Null where `canConvertToCustom` is false.
 */
export function convertToCustom(section: SectionInstance): SectionInstance | null {
  const converted = CONVERTERS[section.type]?.(section.settings as S);
  if (!converted) return null;
  const source = section.settings as S;

  const blocks = converted.blocks.slice(0, BLOCKS.max).flatMap((draft) => {
    const definition = blockDefinition(BLOCKS, draft.type);
    if (!definition) return [];
    const created = createBlock(definition);
    return [{ ...created, settings: { ...created.settings, ...draft.settings } }];
  });

  // The background, spacing, line, design and devices stay as they were.
  const kept = Object.fromEntries(
    ["surface", "rhythm", "hideOn", ...STYLE_KEYS].filter((key) => key in source).map((key) => [key, source[key]]),
  );
  const settings = customSection.lenient({ ...customSection.defaults(), ...kept, ...converted.layout, blocks });
  return { id: section.id, type: "custom_section", visible: section.visible, settings } as SectionInstance;
}

/** Every section type that can become a Custom section — for the checks. */
export const CONVERTIBLE_TYPES = Object.keys(CONVERTERS).filter((type) => type in SECTIONS);
