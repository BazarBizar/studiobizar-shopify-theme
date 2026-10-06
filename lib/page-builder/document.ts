import { z } from "zod";

import { SECTIONS, isSectionType, sectionDefinition, type SectionType, type SettingsFor } from "./registry";

/**
 * The page document: which sections a page has, in what order, with what
 * settings. Stored as JSON in PAGE metafields, three copies of it:
 *
 *   custom.sections           the published version — the ONLY one the storefront reads
 *   custom.sections_draft     the working copy the builder saves to
 *   custom.sections_previous  the version publishing last replaced, for one-step rollback
 *
 * `sections_draft` and `sections_previous` are defined with storefront access
 * NONE, so a draft is unreadable through the Storefront API at all — not merely
 * unread by this code.
 *
 * ORDER IS THE ARRAY ORDER. There is no `position` field: two sources of truth
 * for the same order is how a page ends up with two sections at position 3.
 */

export const BUILDER_METAFIELDS = {
  published: "sections",
  draft: "sections_draft",
  previous: "sections_previous",
} as const;

export const BUILDER_METAFIELD_KEYS: readonly string[] = Object.values(BUILDER_METAFIELDS);

export const DOCUMENT_VERSION = 1;

/** Generous for a page, small enough that a runaway paste cannot fill a metafield. */
export const MAX_SECTIONS = 40;
export const MAX_DOCUMENT_BYTES = 200 * 1024;

/** The grounds `PageShell` accepts. A page has a ground; only a section can "inherit". */
export const PAGE_SURFACES = ["light", "dark", "olive", "blue", "mocha", "black"] as const;
export type PageSurface = (typeof PAGE_SURFACES)[number];

export type PageSettings = {
  surface: PageSurface;
  footerSurface: PageSurface;
  /** Written to Shopify's own SEO fields on publish, so a draft title never goes live early. */
  seoTitle: string;
  seoDescription: string;
};

export type SectionInstance<T extends SectionType = SectionType> = {
  [K in T]: { id: string; type: K; visible: boolean; settings: SettingsFor<K> };
}[T];

export type DocumentMeta = {
  /** Bumped by the server on every save. A save naming an older one is a conflict. */
  revision: number;
  savedAt: string | null;
  savedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type PageDocument = {
  version: typeof DOCUMENT_VERSION;
  page: PageSettings;
  sections: SectionInstance[];
  meta: DocumentMeta;
};

/** What the editor owns. `meta` is the server's. */
export type DocumentContent = Pick<PageDocument, "page" | "sections">;

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  surface: "light",
  footerSurface: "olive",
  seoTitle: "",
  seoDescription: "",
};

const EMPTY_META: DocumentMeta = {
  revision: 0,
  savedAt: null,
  savedBy: null,
  publishedAt: null,
  publishedBy: null,
};

export function emptyDocument(): PageDocument {
  return { version: DOCUMENT_VERSION, page: { ...DEFAULT_PAGE_SETTINGS }, sections: [], meta: { ...EMPTY_META } };
}

/* -------------------------------------------------------------------------- *
 * Section instances
 * -------------------------------------------------------------------------- */

const SECTION_ID = /^s_[a-z0-9]{6,24}$/;

/** `crypto.getRandomValues` exists in the browser, in Node 20 and at the edge. */
export function newSectionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `s_${Array.from(bytes, (byte) => (byte % 36).toString(36)).join("")}`;
}

export function createSection<T extends SectionType>(type: T): SectionInstance<T> {
  return {
    id: newSectionId(),
    type,
    visible: true,
    settings: SECTIONS[type].defaults(),
  } as SectionInstance<T>;
}

export function duplicateSection(section: SectionInstance): SectionInstance {
  return { ...section, id: newSectionId(), settings: structuredClone(section.settings) } as SectionInstance;
}

/* -------------------------------------------------------------------------- *
 * Writes — strict
 * -------------------------------------------------------------------------- */

const pageSettingsSchema = z.strictObject({
  surface: z.enum(PAGE_SURFACES),
  footerSurface: z.enum(PAGE_SURFACES),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(320),
});

const sectionSchema = z.discriminatedUnion(
  "type",
  Object.values(SECTIONS).map((definition) =>
    z.strictObject({
      id: z.string().regex(SECTION_ID),
      type: z.literal(definition.type),
      visible: z.boolean(),
      settings: definition.strict,
    }),
  ) as unknown as [z.ZodObject, ...z.ZodObject[]],
);

/**
 * What the builder may SEND. Every section's settings go through that section's
 * strict schema — an unknown type, an unknown key, an unsafe link or an image on
 * another host is refused before anything reaches Shopify.
 */
export const documentContentSchema = z.strictObject({
  page: pageSettingsSchema,
  sections: z
    .array(sectionSchema)
    .max(MAX_SECTIONS)
    .superRefine((sections, context) => {
      const seen = new Set<string>();
      sections.forEach((section, index) => {
        const { id } = section as { id: string };
        if (seen.has(id)) {
          context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate section id." });
        }
        seen.add(id);
      });
    }),
}) as unknown as z.ZodType<DocumentContent>;

/* -------------------------------------------------------------------------- *
 * Reads — lenient
 * -------------------------------------------------------------------------- */

export type ParsedDocument =
  | { ok: true; doc: PageDocument; dropped: number }
  | { ok: false; reason: "absent" | "invalid" };

const lenientPageSettings = z.object({
  surface: z.enum(PAGE_SURFACES).catch(DEFAULT_PAGE_SETTINGS.surface),
  footerSurface: z.enum(PAGE_SURFACES).catch(DEFAULT_PAGE_SETTINGS.footerSurface),
  seoTitle: z.string().max(70).catch(""),
  seoDescription: z.string().max(320).catch(""),
});

const lenientMeta = z.object({
  revision: z.number().int().nonnegative().catch(0),
  savedAt: z.string().nullable().catch(null),
  savedBy: z.string().nullable().catch(null),
  publishedAt: z.string().nullable().catch(null),
  publishedBy: z.string().nullable().catch(null),
});

/**
 * NEVER THROWS. This is what stands between a hand-edited metafield and a blank
 * production page:
 *
 *  - no value                      → `absent`
 *  - not JSON, or not a document   → `invalid` (the caller falls back)
 *  - an unknown section type       → that section is dropped, the rest render
 *  - a bad setting                 → that setting becomes its default
 *
 * `dropped` counts what was discarded, so the panel can say so rather than let a
 * section vanish without comment.
 */
export function parsePageDocument(raw: string | null | undefined): ParsedDocument {
  if (raw === null || raw === undefined || raw.trim() === "") return { ok: false, reason: "absent" };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!value || typeof value !== "object" || !Array.isArray((value as { sections?: unknown }).sections)) {
    return { ok: false, reason: "invalid" };
  }

  const input = value as { page?: unknown; sections: unknown[]; meta?: unknown };
  const sections: SectionInstance[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const entry of input.sections.slice(0, MAX_SECTIONS)) {
    const candidate = entry as { id?: unknown; type?: unknown; visible?: unknown; settings?: unknown } | null;
    const type = candidate?.type;
    const rawId = candidate?.id;
    const definition = isSectionType(type) ? sectionDefinition(type) : null;
    const id = typeof rawId === "string" && SECTION_ID.test(rawId) ? rawId : null;

    if (!definition || !id || seen.has(id)) {
      dropped += 1;
      continue;
    }

    seen.add(id);
    sections.push({
      id,
      type: definition.type,
      visible: candidate?.visible !== false,
      settings: definition.lenient(candidate?.settings),
    } as SectionInstance);
  }

  dropped += Math.max(0, input.sections.length - MAX_SECTIONS);

  const page = lenientPageSettings.safeParse(input.page ?? {});
  const meta = lenientMeta.safeParse(input.meta ?? {});

  return {
    ok: true,
    dropped,
    doc: {
      version: DOCUMENT_VERSION,
      page: page.success ? page.data : { ...DEFAULT_PAGE_SETTINGS },
      sections,
      meta: meta.success ? meta.data : { ...EMPTY_META },
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Comparisons and checks
 * -------------------------------------------------------------------------- */

/**
 * Content equality — meta deliberately excluded, since a publish stamps
 * `publishedAt` and that is not a change to the page. Both copies are written by
 * the same serializer, so key order agrees and a string compare is exact.
 */
export function sameContent(a: DocumentContent | null, b: DocumentContent | null): boolean {
  if (!a || !b) return a === b;
  return (
    JSON.stringify({ page: a.page, sections: a.sections }) ===
    JSON.stringify({ page: b.page, sections: b.sections })
  );
}

export type PublishProblem = { sectionId: string; section: string; fields: string[] };

/**
 * Required fields left empty, on visible sections only — a hidden half-finished
 * section does not block publishing the rest. Drafts may be saved incomplete;
 * this is the publish gate.
 */
export function publishProblems(content: DocumentContent): PublishProblem[] {
  return content.sections.flatMap((section) => {
    if (!section.visible) return [];
    const definition = sectionDefinition(section.type);
    if (!definition) return [];

    const fields = definition.missing(section.settings as Record<string, unknown>);
    return fields.length ? [{ sectionId: section.id, section: definition.label, fields }] : [];
  });
}
