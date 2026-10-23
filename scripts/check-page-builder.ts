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
import { withExamples } from "../lib/page-builder/examples";
import { findTextPath, withText } from "../lib/page-builder/inline-edit";
import { presetById, SECTION_PRESETS, sectionFromPreset } from "../lib/page-builder/presets";
import { builderHandleProblem, handleFromTitle, isBuilderEditable, isBuilderHandle } from "../lib/page-builder/handles";
import { PAGE_MIGRATIONS, migrateToDocument } from "../lib/page-builder/migrations";
import { carouselStyle, carouselView } from "../lib/page-builder/carousel";
import { contrastRatio, designSchema, designStyle, readDesign } from "../lib/page-builder/design";
import { SECTIONS, SECTION_TYPES } from "../lib/page-builder/registry";
import { defaultLayoutContent, menusIn, parseThemeLayout, sameThemeContent, themeContentSchema } from "../lib/theme-builder/layout";
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
  damaged.header.desktop.right[0].settings.menu = "not-a-menu";
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

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll page builder checks passed.");
process.exit(failures ? 1 : 0);
