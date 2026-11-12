/**
 * Exercises the page builder's validation and parsing without touching Shopify:
 * the rules that keep unsafe content out, and the tolerance that keeps a broken
 * document from blanking a page.
 *
 *   yarn check:page-builder
 */

import { historyReducer, initialHistory } from "../components/admin/page-builder/reducer";
import {
  createSection,
  documentContentSchema,
  duplicateSection,
  emptyDocument,
  parsePageDocument,
  publishProblems,
  sameContent,
} from "../lib/page-builder/document";
import { isSafeHref, parseVideoUrl } from "../lib/page-builder/fields";
import { canConvertToCustom, convertToCustom, CONVERTIBLE_TYPES } from "../lib/page-builder/convert-custom";
import { withExamples } from "../lib/page-builder/examples";
import { findTextPath, withText } from "../lib/page-builder/inline-edit";
import { presetById, SECTION_PRESETS, sectionFromPreset } from "../lib/page-builder/presets";
import { builderHandleProblem, handleFromTitle, isBuilderEditable, isBuilderHandle } from "../lib/page-builder/handles";
import { PAGE_MIGRATIONS, migrateToDocument } from "../lib/page-builder/migrations";
import { carouselStyle, carouselView } from "../lib/page-builder/carousel";
import { contrastRatio, designSchema, designStyle, readDesign } from "../lib/page-builder/design";
import { croppedImage, croppedUrl, isCropped, withCrops } from "../lib/page-builder/image-crop";
import { imageRefSchema } from "../lib/page-builder/value-schemas";
import { SECTIONS, SECTION_TYPES } from "../lib/page-builder/registry";
import {
  defaultLayoutContent,
  MAX_AREA_SECTIONS,
  menusIn,
  parseThemeLayout,
  sameThemeContent,
  themeContentSchema,
  themePublishProblems,
} from "../lib/theme-builder/layout";
import { elementLook } from "../lib/theme-builder/element-look";
import {
  createMessage,
  createPopup,
  isBuilt,
  isScheduledNow,
  onDevice,
  paddingOn,
  popupBlocksFromReady,
  popupDefaults,
  popupHasContent,
  popupOnPath,
  readPopups,
} from "../lib/theme-builder/promo";
import { PAGE_TEMPLATES, documentFromTemplate } from "../lib/page-builder/templates";

let failures = 0;

function check(label: string, condition: boolean) {
  console.log(`${condition ? "✓" : "✗"} ${label}`);
  if (!condition) failures += 1;
}

const content = (sections: unknown[]) => ({ page: emptyDocument().page, sections });
const accepts = (sections: unknown[]) => documentContentSchema.safeParse(content(sections)).success;

const IMAGE = {
  id: "gid://shopify/MediaImage/1",
  url: "https://cdn.shopify.com/s/files/1/0/files/a.jpg?v=1",
  altText: null,
  width: 1200,
  height: 800,
};

const withSettings = (type: keyof typeof SECTIONS, patch: Record<string, unknown>) => {
  const section = createSection(type);
  return { ...section, settings: { ...section.settings, ...patch } };
};

const richLink = (url: string) =>
  JSON.stringify({
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "link", url, children: [{ type: "text", value: "x" }] }] }],
  });

/* --- every section's defaults, and every template, pass the strict schema --- */

for (const type of SECTION_TYPES) {
  check(`defaults of ${type} pass the write schema`, accepts([createSection(type)]));
}

for (const template of PAGE_TEMPLATES) {
  const doc = documentFromTemplate(template.id);
  check(`template "${template.id}" passes the write schema`, accepts(doc.sections));
}

/* --- unsafe input is refused on write --- */

check("javascript: button link is refused", !accepts([withSettings("text_block", { link: { label: "x", href: "javascript:alert(1)" } })]));
check("protocol-relative link is refused", !accepts([withSettings("text_block", { link: { label: "x", href: "//evil.example" } })]));
check("path link is accepted", accepts([withSettings("text_block", { link: { label: "x", href: "/shop" } })]));
check("https link is accepted", accepts([withSettings("text_block", { link: { label: "x", href: "https://example.com" } })]));
check("javascript: link inside rich text is refused", !accepts([withSettings("text_block", { body: richLink("javascript:alert(1)") })]));
check("https link inside rich text is accepted", accepts([withSettings("text_block", { body: richLink("https://example.com") })]));
check("raw HTML as rich text is refused", !accepts([withSettings("text_block", { body: "<script>alert(1)</script>" })]));
check("image on another host is refused", !accepts([withSettings("full_image", { image: { ...IMAGE, url: "https://evil.example/a.jpg" } })]));
check("Shopify CDN image is accepted", accepts([withSettings("full_image", { image: IMAGE })]));
check("unknown section type is refused", !accepts([{ id: "s_abcdefgh", type: "custom_html", visible: true, settings: {} }]));
check("unknown setting key is refused", !accepts([withSettings("text_block", { className: "p-[999px]" })]));
check("select outside its options is refused", !accepts([withSettings("media_text", { align: "center" })]));
check("surface outside the palette is refused", !accepts([withSettings("text_block", { surface: "#ff0000" })]));
check("number out of range is refused", !accepts([withSettings("product_rail", { limit: 500 })]));
const one = createSection("contact_cta");
check("duplicate section ids are refused", !accepts([one, { ...one }]));
check("bad section id is refused", !accepts([{ ...createSection("contact_cta"), id: "../../etc" }]));

check("isSafeHref refuses data:", !isSafeHref("data:text/html,x"));
check("isSafeHref refuses whitespace tricks", !isSafeHref("java\tscript:alert(1)"));
check("isSafeHref accepts mailto:", isSafeHref("mailto:info@studiobizar.be"));

/* --- reading never throws, and degrades per section / per setting --- */

check("empty value is absent", !parsePageDocument("").ok && parsePageDocument("")?.ok === false);
check("missing value is absent", (() => { const r = parsePageDocument(null); return !r.ok && r.reason === "absent"; })());
check("broken JSON is invalid, not a throw", (() => { const r = parsePageDocument("{not json"); return !r.ok && r.reason === "invalid"; })());
check("an object without sections is invalid", (() => { const r = parsePageDocument('{"foo":1}'); return !r.ok && r.reason === "invalid"; })());

const mixed = parsePageDocument(
  JSON.stringify({
    page: { surface: "neon" },
    sections: [
      { id: "s_aaaaaaaa", type: "text_block", visible: true, settings: { title: "Kept", link: { label: "x", href: "javascript:alert(1)" } } },
      { id: "s_bbbbbbbb", type: "made_up", visible: true, settings: {} },
      { id: "s_cccccccc", type: "full_image", settings: { image: { ...IMAGE, url: "https://evil.example/a.jpg" } } },
      "garbage",
    ],
  }),
);
check("a mixed document still parses", mixed.ok);
if (mixed.ok) {
  check("unknown type and garbage are dropped (2)", mixed.dropped === 2 && mixed.doc.sections.length === 2);
  const text = mixed.doc.sections[0] as { settings: { title: string; link: unknown } };
  check("a valid setting survives beside a bad one", text.settings.title === "Kept");
  check("an unsafe link falls back to none", text.settings.link === null);
  const image = mixed.doc.sections[1] as { visible: boolean; settings: { image: unknown } };
  check("an off-CDN image falls back to none", image.settings.image === null);
  check("visible defaults to true", image.visible === true);
  check("a bad page surface falls back to its default", mixed.doc.page.surface === "light");
}

/* --- publish gate, duplication, equality --- */

const draft = documentFromTemplate("landing");
check("a fresh landing template is not ready to publish", publishProblems(draft).length > 0);
const hidden = { ...draft, sections: draft.sections.map((section) => ({ ...section, visible: false })) };
check("hidden sections do not block publishing", publishProblems(hidden).length === 0);
const rail = withSettings("product_rail", { title: "New", source: "products" });
check("a hidden-by-`when` field is not required", publishProblems(content([rail]) as never).every((p) => !p.fields.includes("Collection")));
check("a visible required field is", publishProblems(content([rail]) as never).some((p) => p.fields.includes("Products")));

const copy = duplicateSection(draft.sections[0]!);
check("duplicate gets a new id", copy.id !== draft.sections[0]!.id);
check("duplicate does not share settings", copy.settings !== draft.sections[0]!.settings);
const stamped = { ...draft, meta: { ...draft.meta, revision: 99 } };
check("sameContent ignores meta", sameContent(draft, stamped));
check("sameContent sees a change", !sameContent(draft, { ...draft, sections: draft.sections.slice(1) }));

/* --- blocks --- */

const faqSection = (questions: unknown[]) => withSettings("faq", { source: "custom", questions });
const question = (id: string, q: string, answer = richLink("https://example.com")) => ({
  id,
  type: "question",
  settings: { question: q, answer },
});

check("a FAQ section with written questions is accepted", accepts([faqSection([question("b_aaaaaaaa", "Lead time?")])]));
check("an unknown block type is refused", !accepts([faqSection([{ id: "b_aaaaaaaa", type: "html", settings: {} }])]));
check("an unknown block setting is refused", !accepts([faqSection([{ ...question("b_aaaaaaaa", "Q"), settings: { question: "Q", answer: "", style: "x" } }])]));
check("duplicate block ids are refused", !accepts([faqSection([question("b_aaaaaaaa", "A"), question("b_aaaaaaaa", "B")])]));
check("a javascript: link in a block's rich text is refused", !accepts([faqSection([question("b_aaaaaaaa", "Q", richLink("javascript:alert(1)"))])]));
check("too many blocks are refused", !accepts([faqSection(Array.from({ length: 41 }, (_, i) => question(`b_${String(i).padStart(8, "a")}`, "Q")))]));
check(
  "a button block with a javascript: link is refused",
  !accepts([withSettings("rich_text", { blocks: [{ id: "b_aaaaaaaa", type: "button", settings: { link: { label: "x", href: "javascript:x" }, style: "solid" } }] })]),
);
check(
  "a button block style outside the three weights is refused",
  !accepts([withSettings("rich_text", { blocks: [{ id: "b_aaaaaaaa", type: "button", settings: { link: { label: "x", href: "/shop" }, style: "neon" } }] })]),
);
check("a go-back address with javascript: is refused", !accepts([withSettings("go_back", { fallback: "javascript:alert(1)" })]));

const blockDoc = parsePageDocument(
  JSON.stringify({
    sections: [
      {
        id: "s_dddddddd",
        type: "faq",
        settings: {
          source: "custom",
          questions: [
            question("b_aaaaaaaa", "Kept"),
            { id: "b_bbbbbbbb", type: "made_up", settings: {} },
            { id: "not-an-id", type: "question", settings: { question: "No id" } },
            { id: "b_cccccccc", type: "question", settings: { question: "Bad answer kept", answer: "<script>" } },
          ],
        },
      },
    ],
  }),
);
check("a document with damaged blocks still parses", blockDoc.ok);
if (blockDoc.ok) {
  const questions = (blockDoc.doc.sections[0]!.settings as { questions: { settings: { question: string; answer: string } }[] }).questions;
  check("damaged blocks are dropped one at a time (2 of 4 kept)", questions.length === 2);
  check("a block with a bad setting keeps its other settings", questions[1]?.settings.question === "Bad answer kept");
  check("the bad setting falls back to its default", questions[1]?.settings.answer === "");
}

const richDefaults = createSection("rich_text").settings as { blocks: { type: string; id: string }[] };
check("Text & buttons starts with a heading and a text block", richDefaults.blocks.map((b) => b.type).join(",") === "heading,text");
check("default blocks get distinct ids", new Set(richDefaults.blocks.map((b) => b.id)).size === 2);

const emptyQuestion = faqSection([question("b_aaaaaaaa", "Filled"), { id: "b_bbbbbbbb", type: "question", settings: { question: "", answer: "" } }]);
const blockGaps = publishProblems(content([emptyQuestion]) as never).flatMap((problem) => problem.fields);
check("an empty required field INSIDE a block blocks publishing, labelled by position", blockGaps.includes("Question 2: Question") && blockGaps.includes("Question 2: Answer"));
check("a filled block is not reported", !blockGaps.some((label) => label.startsWith("Question 1")));

/* --- undo / redo --- */

{
  let h = initialHistory(content([createSection("text_block")]) as never);
  const id = h.present.sections[0]!.id;
  const title = () => (h.present.sections[0]!.settings as { title: string }).title;
  const type = (value: string) => (h = historyReducer(h, { kind: "setting", id, key: "title", value }));

  check("a fresh history cannot undo", historyReducer(h, { kind: "undo" }) === h);

  type("S");
  type("Su");
  type("Summer");
  check("typing in one field is one undo step", h.past.length === 1);
  h = historyReducer(h, { kind: "setting", id, key: "body", value: richLink("https://example.com") });
  check("moving to another field starts a new step", h.past.length === 2);

  h = historyReducer(h, { kind: "undo" });
  check("undo restores the field before", title() === "Summer" && h.future.length === 1);
  h = historyReducer(h, { kind: "undo" });
  check("a second undo takes the whole typed word back", title() === "");
  h = historyReducer(h, { kind: "redo" });
  check("redo puts it back", title() === "Summer");

  type("Winter");
  check("a new edit after undo clears redo", h.future.length === 0 && title() === "Winter");

  const before = h.present.sections.length;
  h = historyReducer(h, { kind: "insert", section: createSection("contact_cta"), index: 1 });
  h = historyReducer(h, { kind: "undo" });
  check("adding a section can be undone", h.present.sections.length === before);

  h = historyReducer(h, { kind: "remove", id });
  h = historyReducer(h, { kind: "undo" });
  check("deleting a section can be undone", h.present.sections.some((section) => section.id === id));

  // Hide/show, because inserts stop counting at the 40-section cap.
  const cta = createSection("contact_cta");
  let long = initialHistory(content([cta]) as never);
  for (let i = 0; i < 150; i++) long = historyReducer(long, { kind: "toggle", id: cta.id });
  check("history is bounded at 100 steps", long.past.length === 100);
  check("an edit the reducer refuses is not a step", (() => {
    let full = initialHistory(content(Array.from({ length: 40 }, () => createSection("contact_cta"))) as never);
    full = historyReducer(full, { kind: "insert", section: createSection("contact_cta"), index: 0 });
    return full.past.length === 0;
  })());
}

/* --- MVP-2 migrations --- */

for (const migration of Object.values(PAGE_MIGRATIONS)) {
  const migrated = migrateToDocument(migration, {
    metafields: { intro_body: richLink("https://example.com") },
    images: {},
    bodySummary: "",
    collections: {},
    files: {},
  });
  check(`migration "${migration.handle}" produces a document the write schema accepts`, documentContentSchema.safeParse(migrated).success);
  check(`migration "${migration.handle}" keeps the page's ground (${migration.surface})`, migrated.page.surface === migration.surface);
  check(`"${migration.handle}" is editable in the builder but not a /<handle> page`, isBuilderEditable(migration.handle) && !isBuilderHandle(migration.handle));
}
{
  const carried = migrateToDocument(PAGE_MIGRATIONS.careers!, {
    metafields: { intro_body: richLink("https://example.com") },
    images: {},
    bodySummary: "",
    collections: {},
    files: {},
  });
  const heading = carried.sections[0]!.settings as { title: string; intro: string };
  check("migration carries the intro over unchanged", heading.intro === richLink("https://example.com"));
  check("migration leaves the heading empty so it follows the page title", heading.title === "");
  check("migration leaves SEO to the Shopify page (not in the document)", !("seoTitle" in carried.page));
  const empty = migrateToDocument(PAGE_MIGRATIONS.careers!, { metafields: {}, images: {}, bodySummary: "", collections: {}, files: {} });
  check("a page with no intro migrates to a heading with no intro", (empty.sections[0]!.settings as { intro: string }).intro === "");
}
check("a hand-built page without a migration is not editable (legal)", !isBuilderEditable("privacy-policy"));
{
  const image = (n: number) => ({
    image: { id: `gid://shopify/MediaImage/${n}`, url: `https://cdn.shopify.com/s/files/${n}.jpg`, altText: null, width: 10, height: 10 },
    caption: `c${n}`,
  });
  const story = migrateToDocument(PAGE_MIGRATIONS["our-story"]!, {
    metafields: { story_block_1: richLink("https://example.com"), story_block_2: "" },
    images: { feature_images: [image(1), null, image(2)], gallery: [image(3), image(4), image(5), image(6), null, image(7), image(8)] },
    bodySummary: "",
    collections: {},
    files: {},
  });
  const rows = story.sections.filter((s) => s.type === "captioned_row") as { visible: boolean; settings: { images: { caption: string }[] } }[];
  check("our-story: entries with no image are skipped", rows[0]!.settings.images.map((i) => i.caption).join() === "c1,c2");
  check("our-story: gallery row takes positions 4-6, as the JSX does", rows[1]!.settings.images.map((i) => i.caption).join() === "c6,c7");
  const second = story.sections.find((s) => s.type === "text_block")!;
  check("our-story: an empty second block becomes a hidden section", second.visible === false);
  check("our-story: migration passes the write schema", documentContentSchema.safeParse(story).success);
  const empty = migrateToDocument(PAGE_MIGRATIONS["our-artisans"]!, { metafields: {}, images: {}, bodySummary: "", collections: {}, files: {} });
  check("our-artisans: no photographs → the row is there but hidden", empty.sections.some((s) => s.type === "captioned_row" && !s.visible));
}

/* --- presets: what Add section offers --- */

check("every offered section type has at least one preset", SECTION_TYPES.filter((type) => !SECTIONS[type].hidden).every((type) => SECTION_PRESETS.some((preset) => preset.type === type)));
check("preset ids are unique", new Set(SECTION_PRESETS.map((preset) => preset.id)).size === SECTION_PRESETS.length);
check("no preset offers a retired section", SECTION_PRESETS.every((preset) => !SECTIONS[preset.type].hidden));
for (const preset of SECTION_PRESETS) {
  const section = sectionFromPreset(preset);
  check(`preset "${preset.id}" passes the write schema`, accepts([section]));
  // A preset's own values must survive the lenient read — a typo in a preset would otherwise silently become a default.
  const kept = Object.entries(preset.settings ?? {}).every(([key, value]) => {
    const got = (section.settings as Record<string, unknown>)[key];
    if (Array.isArray(value)) return Array.isArray(got) && got.length === value.length;
    return JSON.stringify(got) === JSON.stringify(value);
  });
  check(`preset "${preset.id}" keeps every value it sets`, kept);
}
const twice = [sectionFromPreset(SECTION_PRESETS.find((preset) => preset.id === "multicolumn")!), sectionFromPreset(SECTION_PRESETS.find((preset) => preset.id === "multicolumn")!)];
check("two sections from one preset share no section or block id", twice[0]!.id !== twice[1]!.id && (twice[0]!.settings as { columns: { id: string }[] }).columns[0]!.id !== (twice[1]!.settings as { columns: { id: string }[] }).columns[0]!.id);

/* --- landing sections --- */

check("YouTube watch address parses", parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.id === "dQw4w9WgXcQ");
check("youtu.be address parses", parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=10")?.provider === "youtube");
check("YouTube shorts address parses", parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")?.id === "dQw4w9WgXcQ");
check("Vimeo address parses", parseVideoUrl("https://vimeo.com/76979871")?.id === "76979871");
check("http (not https) video is refused", parseVideoUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ") === null);
check("another host is refused as a video", parseVideoUrl("https://evil.example/watch?v=dQw4w9WgXcQ") === null);
check("a lookalike host is refused", parseVideoUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ") === null);
check("a malformed YouTube id is refused", parseVideoUrl("https://www.youtube.com/watch?v=<script>") === null);
check("Video section refuses a non-video address on write", !accepts([withSettings("video", { url: "https://evil.example/x" })]));
check("Video section accepts a YouTube address", accepts([withSettings("video", { url: "https://youtu.be/dQw4w9WgXcQ" })]));
check("an icon outside the set is refused", !accepts([withSettings("multicolumn", { columns: [{ id: "b_icon0001", type: "column", settings: { ...(sectionFromPreset(SECTION_PRESETS.find((p) => p.id === "multicolumn.icons")!).settings as { columns: { settings: object }[] }).columns[0]!.settings, icon: "skull" } }] })]));
check("overlay above 80% is refused", !accepts([withSettings("image_banner", { overlay: 95 })]));
check("a text position outside the grid is refused", !accepts([withSettings("image_banner", { position: "far-left" })]));
check("a javascript: link on a collage tile is refused", !accepts([withSettings("collage", { tiles: [{ id: "b_tile00001", type: "tile", settings: { image: IMAGE, title: "", href: "javascript:alert(1)" } }] })]));
check("an image banner without its image cannot be published", publishProblems({ page: emptyDocument().page, sections: [createSection("image_banner")] }).length > 0);

/* --- handles --- */

for (const reserved of ["shop", "admin", "api", "preview", "home", "our-services", "privacy-policy", "products", "cart"]) {
  check(`handle "${reserved}" is reserved`, builderHandleProblem(reserved) !== null);
}
check('handle "summer-campaign" is allowed', builderHandleProblem("summer-campaign") === null);
check('handle "-bad-" is refused', builderHandleProblem("-bad-") !== null);
check('handleFromTitle("Été & Co!")', handleFromTitle("Été & Co!") === "ete-and-co");


/* --- design value: sparse, validated, per device --- */

check("an empty design changes nothing", Object.keys(designStyle({}).style).length === 0 && Object.keys(designStyle({}).attrs).length === 0);
check("a design colour must be #rrggbb", !designSchema.safeParse({ heading: { color: "red; background:url(x)" } }).success);
check("a font must be one of the list", !designSchema.safeParse({ heading: { font: "comic-sans" } }).success);
check(
  "a damaged design part costs only that part",
  JSON.stringify(readDesign({ heading: { size: { d: 9999 } }, opacity: 50 })) === JSON.stringify({ opacity: 50 }),
);
{
  const { style, attrs } = designStyle({ heading: { size: { d: 40, m: 28 } } });
  check(
    "per-device sizes become desktop and mobile properties",
    style["--sb-h-size"] === "40px" && style["--sb-h-size-m"] === "28px" && attrs["data-sb-hsize"] === "d m",
  );
}
check(
  "a section saved before the design existed reads an empty design",
  (() => {
    const read = SECTIONS.text_block.lenient({ title: "Kept" }) as { title: string; design: unknown };
    return read.title === "Kept" && JSON.stringify(read.design) === "{}";
  })(),
);

/* --- theme layout: the header and footer --- */

{
  const content = defaultLayoutContent();
  check("the default header and footer pass the write schema", themeContentSchema.safeParse(content).success);
  const read = parseThemeLayout(
    JSON.stringify({ ...content, version: 1, meta: { revision: 3, savedAt: null, savedBy: null, publishedAt: null, publishedBy: null } }),
  );
  check("a saved layout reads back the same", read.ok && sameThemeContent(read.layout, content) && read.layout.meta.revision === 3);
  check("the default uses the five site menus", menusIn(content).length === 5);

  const damaged = JSON.parse(JSON.stringify(content));
  damaged.header.desktop.left.push({ id: "b_zzzzzzzz", type: "made_up", settings: {} });
  damaged.header.desktop.right[0].settings.menu = 42;
  const repaired = parseThemeLayout(JSON.stringify(damaged));
  check(
    "a damaged layout keeps every valid element and repairs the bad setting",
    repaired.ok &&
      repaired.layout.header.desktop.left.length === content.header.desktop.left.length &&
      repaired.layout.header.desktop.right[0]!.settings.menu === "primary",
  );
  const unsafe = JSON.parse(JSON.stringify(content));
  unsafe.header.style.background = "red";
  check("a layout with a bad colour is refused on write", !themeContentSchema.safeParse(unsafe).success);
  check("broken JSON is not a layout", !parseThemeLayout("{oops").ok);
}

/* --- theme layout: sections under the header and in the footer, and element styles --- */

{
  const content = defaultLayoutContent();
  check("the default has no sections under the header or in the footer", content.header.sections.length === 0 && content.footer.sections.length === 0);

  const withSections = structuredClone(content);
  withSections.header.sections = [sectionFromPreset(presetById("image_banner")!)];
  withSections.footer.sections = [sectionFromPreset(presetById("custom_section")!), createSection("text_block")];
  check("a layout with sections passes the write schema", themeContentSchema.safeParse(withSections).success);
  const back = parseThemeLayout(JSON.stringify(withSections));
  check(
    "sections read back the same, in order",
    back.ok && sameThemeContent(back.layout, withSections) && back.layout.footer.sections[1]!.type === "text_block",
  );

  const heading = structuredClone(content);
  heading.footer.sections = [createSection("page_heading")];
  check("a Page heading is refused in the footer (it draws the page's h1)", !themeContentSchema.safeParse(heading).success);
  const headingBack = parseThemeLayout(JSON.stringify(heading));
  check("a stored Page heading is left out on read", headingBack.ok && headingBack.layout.footer.sections.length === 0);

  const tooMany = structuredClone(content);
  tooMany.header.sections = Array.from({ length: MAX_AREA_SECTIONS + 1 }, () => createSection("spacer"));
  check(`more than ${MAX_AREA_SECTIONS} sections in one place are refused on write`, !themeContentSchema.safeParse(tooMany).success);

  const damaged = JSON.parse(JSON.stringify(withSections));
  damaged.footer.sections.push({ id: "s_madeupone", type: "made_up", visible: true, settings: {} });
  damaged.footer.sections[1].settings.title = 42;
  const repaired = parseThemeLayout(JSON.stringify(damaged));
  check(
    "a damaged footer section is dropped, a bad setting defaults, the rest stay",
    repaired.ok && repaired.layout.footer.sections.length === 2 && typeof (repaired.layout.footer.sections[1]!.settings as { title?: unknown }).title === "string",
  );

  const incomplete = structuredClone(content);
  incomplete.footer.sections = [createSection("image_banner")];
  const problems = themePublishProblems(incomplete);
  check(
    "a visible footer section missing required content stops Publish, and says where",
    problems.length === 1 && problems[0]!.area === "footer" && problems[0]!.sectionId === incomplete.footer.sections[0]!.id,
  );
  incomplete.footer.sections[0] = { ...incomplete.footer.sections[0]!, visible: false };
  check("a hidden one does not", themePublishProblems(incomplete).length === 0);

  const styled = structuredClone(content);
  styled.header.desktop.left[1] = {
    ...styled.header.desktop.left[1]!,
    style: {
      color: "#302f2d",
      hoverColor: "#7a6a4f",
      background: "#ebe8e3",
      padX: { d: 16, m: 8 },
      padY: { d: 6 },
      radius: 100,
      borderWidth: 1,
      borderColor: "#302f2d",
      shadow: "soft",
      design: { text: { font: "inter", size: { d: 15 }, transform: "uppercase" }, buttonLook: { radius: 4 } },
    },
  };
  check("a styled element passes the write schema", themeContentSchema.safeParse(styled).success);
  const styledBack = parseThemeLayout(JSON.stringify(styled));
  check("an element's style reads back the same", styledBack.ok && sameThemeContent(styledBack.layout, styled));
  const look = elementLook(styled.header.desktop.left[1]!.style);
  check(
    "an element's style draws colours, padding per device and its typography",
    look.style.color === "#302f2d" &&
      look.style["--sb-foreground"] === "#302f2d" &&
      look.style["--sb-el-px-m"] === "8px" &&
      look.attrs["data-el-px"] === "d m" &&
      look.attrs["data-el-hover"] === "" &&
      look.attrs["data-sb-psize"] === "d",
  );
  check("an element without a style draws nothing of its own", Object.keys(elementLook(undefined).style).length === 0);

  for (const [label, style] of [
    ["a colour that is not #rrggbb", { color: "red" }],
    ["padding past the limit", { padX: { d: 500 } }],
    ["a background image in its design (sections only)", { design: { background: { overlay: "#000000" } } }],
    ["an unknown key", { float: "left" }],
  ] as const) {
    const bad = structuredClone(content);
    bad.footer.columns[0]!.elements[0] = { ...bad.footer.columns[0]!.elements[0]!, style: style as never };
    check(`element style: ${label} is refused on write`, !themeContentSchema.safeParse(bad).success);
  }

  const damagedStyle = JSON.parse(JSON.stringify(styled));
  damagedStyle.header.desktop.left[1].style.color = "red";
  damagedStyle.header.desktop.left[1].style.design.background = { overlay: "#000000" };
  const styleRepaired = parseThemeLayout(JSON.stringify(damagedStyle));
  const kept = styleRepaired.ok ? styleRepaired.layout.header.desktop.left[1]!.style : undefined;
  check(
    "a damaged element style loses only the bad parts",
    kept !== undefined && kept.color === undefined && kept.background === "#ebe8e3" && kept.design?.background === undefined && kept.design?.text?.size?.d === 15,
  );
}

/* --- promotions: the announcement bar and pop-ups --- */

{
  const content = defaultLayoutContent();

  // The bar before several messages: one `text`, one `link`.
  const old = JSON.parse(JSON.stringify(content));
  old.header.announcement = { enabled: true, text: "Free delivery", link: { label: "Free delivery", href: "/shop" }, background: "", color: "" };
  const migrated = parseThemeLayout(JSON.stringify(old));
  check(
    "an announcement saved with one text reads as one message, link kept",
    migrated.ok &&
      migrated.layout.header.announcement.enabled &&
      migrated.layout.header.announcement.messages.length === 1 &&
      migrated.layout.header.announcement.messages[0]!.text === "Free delivery" &&
      migrated.layout.header.announcement.messages[0]!.href === "/shop" &&
      themeContentSchema.safeParse({
        header: migrated.layout.header,
        footer: migrated.layout.footer,
        global: migrated.layout.global,
        popups: migrated.layout.popups,
      }).success,
  );

  const withPromo = structuredClone(content);
  withPromo.header.announcement = {
    ...withPromo.header.announcement,
    enabled: true,
    mode: "scroll",
    messages: [createMessage("One"), { ...createMessage("Two"), startsAt: "2026-12-01T08:00:00.000Z" }],
  };
  const popup = createPopup("Event", { heading: "Join us" });
  withPromo.popups = [popup, createPopup("Empty")];
  check("a layout with messages and pop-ups passes the write schema", themeContentSchema.safeParse(withPromo).success);
  const back = parseThemeLayout(JSON.stringify(withPromo));
  check("messages and pop-ups read back the same", back.ok && sameThemeContent(back.layout, withPromo));

  const unsafeLink = structuredClone(withPromo);
  unsafeLink.header.announcement.messages[0]!.href = "javascript:alert(1)";
  check("a message linking to javascript: is refused on write", !themeContentSchema.safeParse(unsafeLink).success);
  const badPath = structuredClone(withPromo);
  badPath.popups[0]!.pages = { mode: "only", paths: ["https://elsewhere.example"] };
  check("a pop-up page that is not a path is refused on write", !themeContentSchema.safeParse(badPath).success);
  const twice = structuredClone(withPromo);
  twice.popups[1]!.id = twice.popups[0]!.id;
  check("two pop-ups with one id are refused on write", !themeContentSchema.safeParse(twice).success);

  const styled = structuredClone(withPromo);
  Object.assign(styled.popups[0]!.settings, {
    width: "custom",
    imagePosition: "right",
    imageShare: "third",
    imageInset: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#302f2d",
    shadow: "strong",
    overlay: "#1a2b3c",
    overlayOpacity: 70,
    blur: 6,
    closeSize: "large",
    closeBackground: "#ffffff",
    animation: "zoom",
    speed: "slow",
    buttonStyle: "outline",
    design: {
      heading: { size: { d: 40, m: 28 }, color: "#aa3300" },
      buttonLook: { radius: 100 },
      background: { overlay: "#000000", overlayOpacity: 20, gradient: { from: "#ebe8e3", to: "#c9c2b8", angle: 180 } },
      images: { radius: 12 },
    },
  });
  styled.popups[0]!.box = {
    width: { d: 640, m: 320 },
    padding: { d: { top: 48, right: 40, bottom: 48, left: 40 }, m: { right: 16, left: 16 } },
    offset: { d: 24 },
    gap: { t: 12 },
    radius: { d: 16, m: 8 },
  };
  check("a styled pop-up passes the write schema", themeContentSchema.safeParse(styled).success);
  const styledBack = parseThemeLayout(JSON.stringify(styled));
  check("a styled pop-up reads back the same, per-device sizes and all", styledBack.ok && sameThemeContent(styledBack.layout, styled));
  for (const [label, change] of [
    ["a line colour that is not a colour", { borderColor: "red;background:url(x)" }],
    ["an unknown line style", { borderStyle: "groove;x" }],
    ["a blur past 20px", { blur: 50 }],
    ["an unknown animation", { animation: "spin" }],
    ["a design part that does not exist", { design: { script: "x" } }],
    ["a setting that no longer exists (the old single width)", { customWidth: 640 }],
  ] as const) {
    const bad = structuredClone(styled);
    Object.assign(bad.popups[0]!.settings, change);
    check(`pop-up style: ${label} is refused on write`, !themeContentSchema.safeParse(bad).success);
  }
  for (const [label, box] of [
    ["a width past 1200px", { width: { d: 5000 } }],
    ["padding as text", { padding: { d: { top: "10px;x" } } }],
    ["a device that does not exist", { radius: { w: 4 } }],
    ["an unknown size", { height: { d: 100 } }],
  ] as const) {
    const bad = structuredClone(styled) as unknown as { popups: { box: unknown }[] };
    bad.popups[0]!.box = box;
    check(`pop-up sizes: ${label} is refused on write`, !themeContentSchema.safeParse(bad).success);
  }

  // A pop-up saved before its sizes could differ per device keeps its look.
  const before = JSON.parse(JSON.stringify(withPromo));
  Object.assign(before.popups[0].settings, { width: "custom", customWidth: 640, radius: 16, padding: 20 });
  const beforeBack = parseThemeLayout(JSON.stringify(before));
  const beforeBox = beforeBack.ok ? beforeBack.layout.popups[0]!.box : undefined;
  check(
    "an earlier pop-up's one width, corner and space inside read as desktop's",
    beforeBox?.width?.d === 640 &&
      beforeBox?.radius?.d === 16 &&
      beforeBox?.padding?.d?.top === 20 &&
      beforeBox?.padding?.d?.left === 20 &&
      beforeBack.ok &&
      !("customWidth" in beforeBack.layout.popups[0]!.settings) &&
      themeContentSchema.safeParse({
        header: beforeBack.layout.header,
        footer: beforeBack.layout.footer,
        global: beforeBack.layout.global,
        popups: beforeBack.layout.popups,
      }).success,
  );
  const damagedBox = JSON.parse(JSON.stringify(styled));
  damagedBox.popups[0].box.width = { d: "wide" };
  const damagedBack = parseThemeLayout(JSON.stringify(damagedBox));
  check(
    "a damaged size is dropped alone, the others kept",
    damagedBack.ok && !damagedBack.layout.popups[0]!.box?.width && damagedBack.layout.popups[0]!.box?.radius?.m === 8,
  );

  const defaults = popupDefaults("center", false);
  check(
    "padding per device follows the larger screen, then the pop-up's own",
    JSON.stringify(paddingOn(styled.popups[0]!.box, "m", defaults.padding)) === JSON.stringify({ top: 48, right: 16, bottom: 48, left: 16 }) &&
      JSON.stringify(paddingOn(undefined, "m", defaults.padding)) === JSON.stringify({ top: 40, right: 24, bottom: 24, left: 24 }),
  );
  check("a size on a device follows the larger screen", onDevice(styled.popups[0]!.box!.gap, "m") === 12 && onDevice(styled.popups[0]!.box!.gap, "d") === undefined);

  const broken = JSON.parse(JSON.stringify(withPromo));
  broken.popups.push({ id: "nope", settings: {} });
  broken.popups[0].settings.trigger = "teleport";
  broken.header.announcement.messages.push({ id: "b_brokenone", text: 42 });
  const repaired = parseThemeLayout(JSON.stringify(broken));
  check(
    "a damaged pop-up is dropped, a damaged setting defaults, a damaged message is dropped",
    repaired.ok &&
      repaired.layout.popups.length === 2 &&
      repaired.layout.popups[0]!.settings.trigger === "delay" &&
      repaired.layout.header.announcement.messages.length === 2,
  );

  const at = Date.parse("2026-11-15T12:00:00.000Z");
  check("no dates: always showing", isScheduledNow({ startsAt: "", endsAt: "" }, at));
  check("before its start: not yet", !isScheduledNow({ startsAt: "2026-12-01T00:00:00.000Z", endsAt: "" }, at));
  check("after its end: no longer", !isScheduledNow({ startsAt: "", endsAt: "2026-11-01T00:00:00.000Z" }, at));
  check("between its dates: showing", isScheduledNow({ startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" }, at));

  check("every page includes the home page", popupOnPath({ mode: "all", paths: [] }, "/"));
  check("home only: not on another page", !popupOnPath({ mode: "home", paths: [] }, "/our-story"));
  check("only listed: a trailing slash still matches", popupOnPath({ mode: "only", paths: ["/our-story"] }, "/our-story/"));
  check("only listed: /products/* covers a product", popupOnPath({ mode: "only", paths: ["/products/*"] }, "/products/chair"));
  check("only listed: /products/* does not cover /productsale", !popupOnPath({ mode: "only", paths: ["/products/*"] }, "/productsale"));
  check("except listed: stays away from the listed page", !popupOnPath({ mode: "except", paths: ["/contact"] }, "/contact"));
  check("a pop-up with a heading has content; a blank one has none", popupHasContent(popup) && !popupHasContent(createPopup("Blank")));

  // Built from blocks: the ready-made content becomes blocks, saves, reads back and counts as content.
  const IMG = { id: "gid://shopify/MediaImage/1", url: "https://cdn.shopify.com/s/files/1/example.jpg", altText: null, width: 1600, height: 1000 };
  const ready = createPopup("Event", {
    heading: "Join us",
    text: "Drinks\nNew pieces",
    image: IMG,
    imagePosition: "right",
    imageShare: "third",
    button: { label: "Book", href: "/contact" },
    newsletter: true,
  });
  const converted = popupBlocksFromReady(ready.settings);
  check(
    "ready-made → blocks: words column then photo column, photo first on phones, nothing lost",
    JSON.stringify(converted.map((item) => item.type)) === JSON.stringify(["column", "heading", "text", "newsletter", "button", "column", "image"]) &&
      converted[0]!.settings.width === "67" &&
      converted[5]!.settings.width === "33" &&
      converted[5]!.settings.mobileFirst === true &&
      String(converted[2]!.settings.body).includes("New pieces"),
  );
  const bar = popupBlocksFromReady(createPopup("Bar", { layout: "bar", text: "Open Sundays", button: { label: "Visit", href: "/visit" } }).settings);
  check("a bar's words and button stay side by side", JSON.stringify(bar.map((item) => item.type)) === JSON.stringify(["column", "text", "column", "button"]));

  const built = { ...ready, settings: { ...ready.settings, build: "blocks", blocks: converted } };
  const withBuilt = { ...withPromo, popups: [built] };
  check("a built pop-up saves", themeContentSchema.safeParse(withBuilt).success);
  const builtBack = parseThemeLayout(JSON.stringify(withBuilt));
  check(
    "a built pop-up reads back with its blocks",
    builtBack.ok && (builtBack.layout.popups[0]!.settings.blocks as unknown[]).length === converted.length && isBuilt(builtBack.layout.popups[0]!.settings),
  );
  const frameOnly = createPopup("Frame", { build: "blocks", blocks: converted.filter((item) => item.type === "column") });
  check("built from only columns: empty; with a heading: content", !popupHasContent(frameOnly) && popupHasContent(built));
  check("an earlier pop-up reads as ready-made", !isBuilt(readPopups([{ ...popup, settings: { heading: "Hi" } }])[0]!.settings));
  const productBlock = { ...withPromo, popups: [{ ...built, settings: { ...built.settings, blocks: [{ id: "b_product01", type: "product", settings: {} }] } }] };
  check("a Product block is refused in a pop-up", !themeContentSchema.safeParse(productBlock).success);
}


/* --- example content: a section added is never empty --- */

{
  const IMAGE_EXAMPLE = {
    id: "gid://shopify/MediaImage/1",
    url: "https://cdn.shopify.com/s/files/1/example.jpg",
    altText: null,
    width: 1600,
    height: 1000,
  };
  const media = {
    images: [IMAGE_EXAMPLE],
    products: [{ id: "gid://shopify/Product/1", handle: "chair", title: "Chair" }],
    collections: [{ id: "gid://shopify/Collection/1", handle: "chairs", title: "Chairs" }],
  };
  const unfillable = /Video address|Logo/;
  let valid = 0;
  const empty: string[] = [];
  for (const preset of SECTION_PRESETS) {
    const section = withExamples(sectionFromPreset(preset), media);
    const definition = SECTIONS[section.type];
    if ((definition.strict as { safeParse: (v: unknown) => { success: boolean } }).safeParse(section.settings).success) valid += 1;
    const missing = (definition.missing as (s: unknown) => string[])(section.settings).filter((label) => !unfillable.test(label));
    if (missing.length) empty.push(`${preset.id}: ${missing.join(", ")}`);
  }
  check(`every preset with examples passes the write schema (${valid}/${SECTION_PRESETS.length})`, valid === SECTION_PRESETS.length);
  check(`every preset with examples has its required content filled${empty.length ? " — " + empty.slice(0, 3).join(" | ") : ""}`, empty.length === 0);
  const text = withExamples(sectionFromPreset(presetById("text_block")!), media) as { settings: { title: string } };
  check("a plain Text section arrives with an example heading", text.settings.title === "Your heading here");
  const heading = withExamples(sectionFromPreset(presetById("page_heading")!), media) as { settings: { title: string } };
  check("a Page heading keeps its title empty (empty means: the page's title)", heading.settings.title === "");
}


/* --- design: gradient, corners per device, images, readability --- */

{
  const gradient = designStyle({ background: { gradient: { from: "#ebe8e3", to: "#302f2d", angle: 90 } } });
  check("a gradient becomes the background", gradient.style["--sb-bg"] === "linear-gradient(90deg, #ebe8e3, #302f2d)" && gradient.attrs["data-sb-bg"] === "");
  check("a gradient with a bad colour is refused", !designSchema.safeParse({ background: { gradient: { from: "red", to: "#302f2d", angle: 90 } } }).success);
  const corners = designStyle({ radius: { m: 24 } });
  check("mobile corners set their own property and clip", corners.style["--sb-rad-m"] === "24px" && corners.attrs["data-sb-rad"] === "m" && corners.style.overflow === "clip");
  const images = designStyle({ images: { ratio: "square", radius: 8, zoom: true } });
  check(
    "image shape, corners and zoom reach the section",
    images.style["--sb-ratio"] === "1 / 1" && images.style["--sb-imgr"] === "8px" && images.attrs["data-sb-zoom"] === "",
  );
  check("an unknown image shape is refused", !designSchema.safeParse({ images: { ratio: "circle" } }).success);
  const buttons = designStyle({
    buttonLook: { background: "#a65a3f", hoverColor: "#ebe8e3", borderWidth: 0, radius: 12, padX: { d: 40, m: 16 }, spaceAbove: { t: 24 } },
  });
  check(
    "the buttons' look: colours, line, corners and per-device spacing",
    buttons.style["--sb-btn-bg"] === "#a65a3f" &&
      buttons.style["--sb-btn-hfg"] === "#ebe8e3" &&
      buttons.style["--sb-btn-bw"] === "0px" &&
      buttons.style["--sb-btn-r"] === "12px" &&
      buttons.attrs["data-sb-btn-px"] === "d m" &&
      buttons.style["--sb-btn-px-m"] === "16px" &&
      buttons.attrs["data-sb-btn-mt"] === "t",
  );
  check("a button colour must be #rrggbb", !designSchema.safeParse({ buttonLook: { background: "red" } }).success);
  const sides = designStyle({ sides: { padLeft: { d: 64, m: 16 }, marginRight: { t: 24 } } });
  check(
    "space at the sides: per device, as properties the shared rules read",
    sides.style["--sb-padl"] === "64px" &&
      sides.style["--sb-padl-m"] === "16px" &&
      sides.attrs["data-sb-padl"] === "d m" &&
      sides.style["--sb-marr-t"] === "24px" &&
      sides.attrs["data-sb-marr"] === "t",
  );
  check("space at the sides is bounded", !designSchema.safeParse({ sides: { padLeft: { d: 900 } } }).success);
  const designedRow = { d: 4, t: 2.15, m: 1.28 };
  check(
    "carousel: all 'As designed' keeps the section's own widths",
    carouselView({ perDesktop: "auto", perTablet: "auto", perMobile: "auto", step: "1" }, designedRow).perView === null,
  );
  const chosenRow = carouselView({ perDesktop: "2", perTablet: "auto", perMobile: "1.25", step: "page" }, designedRow);
  check(
    "carousel: one device chosen, the others from the design; a whole row per press",
    JSON.stringify(chosenRow) === JSON.stringify({ perView: { d: 2, t: 2.15, m: 1.25 }, step: "page" }),
  );
  check("carousel: the gaps between items, for a peek too", carouselStyle({ d: 3, t: 2.25, m: 1 })["--cv-t-gaps"] === "2" && carouselStyle({ d: 3, t: 2.25, m: 1 })["--cv-m-gaps"] === "0");
  check("button corners are bounded", !designSchema.safeParse({ buttonLook: { radius: 500 } }).success);
  check("a damaged button look is dropped on read, the rest kept", readDesign({ buttonLook: { color: "x" }, shadow: "soft" }).shadow === "soft" && readDesign({ buttonLook: { color: "x" } }).buttonLook === undefined);
  check("contrast: dark wood on earth reads well", contrastRatio("#302f2d", "#ebe8e3") > 10);
  check("contrast: earth on white does not", contrastRatio("#ebe8e3", "#ffffff") < 1.5);
}


/* --- editing text in the preview --- */

{
  const settings = {
    title: "Soft geometry",
    link: { label: "discover", href: "/shop" },
    body: '{"type":"root","children":[]}',
    slides: [{ id: "b_aaaaaaaa", type: "slide", settings: { title: "Second  slide\n" } }],
  };
  check("in place: a heading is found by its text", JSON.stringify(findTextPath(settings, "Soft geometry")) === '["title"]');
  check("in place: a button's label, never its address", JSON.stringify(findTextPath(settings, "discover")) === '["link","label"]' && findTextPath(settings, "/shop") === null);
  check("in place: text inside a slide, whitespace aside", JSON.stringify(findTextPath(settings, "Second slide")) === '["slides",0,"settings","title"]');
  check("in place: rich text is not offered", findTextPath(settings, '{"type":"root","children":[]}') === null);
  const changed = withText(settings, ["slides", 0, "settings", "title"], "New");
  check("in place: the new value lands at its path, the old settings untouched", changed.slides[0]!.settings.title === "New" && settings.slides[0]!.settings.title === "Second  slide\n");
}

/* ---------------- Turn into Custom section ---------------- */
{
  // Every preset of a type that can become a Custom section: the result passes the
  // write schema, keeps its id, and still says what the original said.
  const words = (value: unknown): string[] =>
    typeof value === "string"
      ? value.startsWith("{")
        ? [...value.matchAll(/"value":"([^"]+)"/g)].map((match) => match[1]!.trim())
        : [value.trim()]
      : Array.isArray(value)
        ? value.flatMap(words)
        : value && typeof value === "object"
          ? Object.entries(value)
              .filter(([key]) => !["href", "id", "url", "handle"].includes(key))
              .flatMap(([, inner]) => words(inner))
          : [];
  for (const preset of SECTION_PRESETS.filter((item) => CONVERTIBLE_TYPES.includes(item.type))) {
    const section = withExamples(sectionFromPreset(preset), { images: [], products: [], collections: [] });
    if (!canConvertToCustom(section)) continue;
    const converted = convertToCustom(section)!;
    const valid = SECTIONS.custom_section.strict.safeParse(converted.settings);
    check(`custom: "${preset.label}" becomes a valid Custom section`, valid.success && converted.id === section.id);
    const after = JSON.stringify(converted.settings);
    // Only sentences (content) must survive — single words are option values.
    const lost = [...new Set(words(section.settings))].filter(
      (word) => /\s/.test(word) && !after.includes(JSON.stringify(word).slice(1, -1)),
    );
    check(`custom: "${preset.label}" keeps its words${lost.length ? ` (lost: ${lost.slice(0, 2).join(" | ")})` : ""}`, lost.length === 0);
  }
  check(
    "custom: a call to action on a photograph is not offered the change",
    !canConvertToCustom(sectionFromPreset(presetById("cta_banner.image")!)),
  );
  check("custom: a catalogue section is not offered the change", !canConvertToCustom(sectionFromPreset(presetById("product_grid")!)));
}

/* -------------------------------------------------------------------------- *
 * Photos: shape, size, fit, focus — and one photo's own crop
 * -------------------------------------------------------------------------- */
{
  const look = designStyle({
    images: { ratio: "portrait_2_3", width: { d: 480, m: 280 }, height: { t: 500 }, fit: "contain", focus: "center top" },
  });
  check("photos: a portrait 2:3 is drawn 2 / 3", look.style["--sb-ratio"] === "2 / 3" && look.attrs["data-sb-ratio"] === "");
  check(
    "photos: a width in px per device",
    look.style["--sb-imgw"] === "480px" && look.style["--sb-imgw-m"] === "280px" && look.attrs["data-sb-imgw"] === "d m",
  );
  check("photos: a height for tablet only", look.style["--sb-imgh-t"] === "500px" && look.attrs["data-sb-imgh"] === "t");
  check("photos: the whole photo", look.style["--sb-imgfit"] === "contain" && look.attrs["data-sb-imgfit"] === "");
  check("photos: kept in view at the top", look.style["--sb-imgpos"] === "center top" && look.attrs["data-sb-imgpos"] === "");
  check("photos: the old shapes still draw as before", designStyle({ images: { ratio: "landscape" } }).style["--sb-ratio"] === "3 / 2");

  const custom = designStyle({ images: { ratio: "custom", custom: { w: 7, h: 3 } } });
  check("photos: a custom shape 7 : 3", custom.style["--sb-ratio"] === "7 / 3");
  const own = designStyle({ images: { ratio: "own" } });
  check("photos: 'As uploaded' marks the section, with no shape of its own", own.attrs["data-sb-own"] === "" && own.style["--sb-ratio"] === undefined);
  check("photos: 'Section default' writes nothing", designStyle({ images: { zoom: true } }).attrs["data-sb-own"] === undefined);
  check("photos: custom with no numbers draws no shape", designStyle({ images: { ratio: "custom" } }).attrs["data-sb-ratio"] === undefined);

  const ok = (value: unknown) => designSchema.safeParse({ images: value }).success;
  check("photos: every new setting saves", ok({ ratio: "custom", custom: { w: 16, h: 9 }, width: { d: 600 }, height: { m: 300 }, fit: "contain", focus: "right bottom" }));
  check("photos: a custom shape of 0 is refused", !ok({ ratio: "custom", custom: { w: 0, h: 9 } }));
  check("photos: a width under 40 px is refused", !ok({ width: { d: 10 } }));
  check("photos: an unknown shape is refused", !ok({ ratio: "banana" }));
  check("photos: 'As uploaded' saves", ok({ ratio: "own" }));
  check("photos: 'the middle' is the default, not a stored value", !ok({ focus: "center" }));
  check("photos: a fit of 'cover' is the default, not a stored value", !ok({ fit: "cover" }));

  const photo = {
    id: "gid://shopify/MediaImage/1",
    url: "https://cdn.shopify.com/s/files/1/0750/8108/9160/files/a.jpg?v=1",
    altText: null,
    width: 3000,
    height: 2000,
  };
  const crop = { x: 100, y: 50, width: 1200, height: 1500 };
  check("crop: a crop inside the photo saves", imageRefSchema.safeParse({ ...photo, crop }).success);
  check("crop: a photo without one still saves", imageRefSchema.safeParse(photo).success);
  check("crop: past the right edge is refused", !imageRefSchema.safeParse({ ...photo, crop: { ...crop, x: 2000 } }).success);
  check("crop: past the bottom is refused", !imageRefSchema.safeParse({ ...photo, crop: { ...crop, y: 600 } }).success);
  check("crop: a zero size is refused", !imageRefSchema.safeParse({ ...photo, crop: { ...crop, width: 0 } }).success);
  check("crop: an unknown key is refused", !imageRefSchema.safeParse({ ...photo, crop: { ...crop, zoom: 2 } }).success);

  const url = new URL(croppedUrl(photo.url, crop));
  check(
    "crop: the CDN is asked for just that region, the version kept",
    url.searchParams.get("crop") === "region" &&
      url.searchParams.get("crop_left") === "100" &&
      url.searchParams.get("crop_top") === "50" &&
      url.searchParams.get("crop_width") === "1200" &&
      url.searchParams.get("crop_height") === "1500" &&
      url.searchParams.get("v") === "1",
  );
  const seen = croppedImage({ ...photo, crop });
  check("crop: the photo is seen at the crop's size (a portrait now)", seen.width === 1200 && seen.height === 1500);
  check("crop: a cropped photo is known as cropped, after it is drawn too", isCropped({ ...photo, crop }) && isCropped(seen) && !isCropped(photo));

  const section = {
    id: "s1",
    type: "multicolumn",
    visible: true,
    settings: {
      title: "x",
      columns: [{ id: "b1", type: "column", settings: { image: { ...photo, crop } } }, { id: "b2", type: "column", settings: { image: photo } }],
      design: { background: { image: { ...photo, crop } } },
    },
  };
  const drawn = withCrops(section);
  check("crop: a cropped photo in a block is drawn cropped", drawn.settings.columns[0]!.settings.image.url.includes("crop=region"));
  check("crop: an uncropped photo is left exactly as it was", drawn.settings.columns[1] === section.settings.columns[1]);
  check("crop: a cropped background is drawn cropped too", drawn.settings.design.background.image.width === 1200);
  check("crop: the saved section is not changed", section.settings.columns[0]!.settings.image.url === photo.url);
  const plain = { ...section, settings: { ...section.settings, columns: [section.settings.columns[1]!], design: {} } };
  check("crop: a section with no crop is not copied", withCrops(plain) === plain);
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll page builder checks passed.");
process.exit(failures ? 1 : 0);
