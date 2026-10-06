/**
 * Exercises the page builder's validation and parsing without touching Shopify:
 * the rules that keep unsafe content out, and the tolerance that keeps a broken
 * document from blanking a page.
 *
 *   yarn check:page-builder
 */

import {
  createSection,
  documentContentSchema,
  duplicateSection,
  emptyDocument,
  parsePageDocument,
  publishProblems,
  sameContent,
} from "../lib/page-builder/document";
import { isSafeHref } from "../lib/page-builder/fields";
import { builderHandleProblem, handleFromTitle } from "../lib/page-builder/handles";
import { SECTIONS, SECTION_TYPES } from "../lib/page-builder/registry";
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

/* --- handles --- */

for (const reserved of ["shop", "admin", "api", "preview", "home", "our-services", "privacy-policy", "products", "cart"]) {
  check(`handle "${reserved}" is reserved`, builderHandleProblem(reserved) !== null);
}
check('handle "summer-campaign" is allowed', builderHandleProblem("summer-campaign") === null);
check('handle "-bad-" is refused', builderHandleProblem("-bad-") !== null);
check('handleFromTitle("Été & Co!")', handleFromTitle("Été & Co!") === "ete-and-co");

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll page builder checks passed.");
process.exit(failures ? 1 : 0);
