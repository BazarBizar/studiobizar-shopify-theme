/**
 * The page builder against the LIVE store and a running dev server, end to end.
 *
 *   yarn dev                      # in another terminal
 *   yarn check:page-builder-live
 *
 * WRITES TO THE STORE, and cleans up after itself: it creates ONE hidden page
 * (`pb-check-<time>`), exercises every write on it, and deletes it in `finally`.
 * It reads the real pages, and changes none of them.
 *
 * Covers what `check:page-builder` (offline) cannot: Shopify's own behaviour —
 * the draft really is unreadable through the Storefront API, publishing lands
 * once Shopify's ~30s response cache catches up, SEO set on the page survives a
 * publish — and that the storefront route draws what was published.
 *
 * `--conditions=react-server` is required (`server-only`), and `next/navigation`
 * is stubbed below: `lib/admin/shopify.ts` imports `unstable_rethrow`, which only
 * loads inside Next. Outside it there is no Next control flow to rethrow.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("=")).trim();
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (/^".*"$/.test(value)) value = value.slice(1, -1);
  process.env[key] ??= value;
}
{
  const require = createRequire(resolve(ROOT, "package.json"));
  const resolved = require.resolve("next/navigation");
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { unstable_rethrow: () => {} } } as never;
}

const load = (path: string) => import(pathToFileURL(resolve(ROOT, path)).href);

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 300)}` : ""}`);
  if (!ok) failures += 1;
}

const storefront = (query: string) =>
  fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${process.env.SHOPIFY_API_VERSION ?? "2026-07"}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN! },
    body: JSON.stringify({ query }),
  }).then((response) => response.json());

async function render(path: string) {
  await fetch(`${BASE}/api/revalidate?tag=content`, { method: "POST" });
  await fetch(`${BASE}${path}`, { cache: "no-store" }); // warm: a streamed band renders inline once cached
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const html = await response.text();
  return { status: response.status, html, main: (html.match(/<main[\s\S]*?<\/main>/) ?? [""])[0] };
}

const rich = (text: string) =>
  JSON.stringify({ type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: text }] }] });

async function main() {
  const reachable = await fetch(BASE).then(() => true).catch(() => false);
  if (!reachable) {
    console.error(`✗ No dev server at ${BASE}. Start one with \`yarn dev\` (or set CHECK_BASE_URL).`);
    process.exit(1);
  }

  const pb = await load("lib/admin/page-builder.ts");
  const doc = await load("lib/page-builder/document.ts");
  const pages = await load("lib/admin/pages.ts");
  const { adminGraphQL } = await load("lib/admin/shopify.ts");
  const { OPERATIONS } = await load("lib/admin/operations.ts");
  const { listCollections } = await load("lib/admin/collections.ts");

  const handle = `pb-check-${Date.now().toString(36)}`;
  const route = `/${handle}`;

  const reserved = await pb.createBuilderPage({ title: "x", handle: "shop", template: "blank" }, "check").catch((e: Error) => e);
  check("a reserved address (/shop) is refused", reserved instanceof pb.BuilderError);

  const created = await pb.createBuilderPage({ title: "PB check", handle, template: "landing" }, "check");
  try {
    /* ---------------- draft ---------------- */
    let state = await pb.getBuilderState(created.id);
    check("a new page is hidden, never published", !state.page.isPublished && state.published === null);

    const notReady = await pb.publish(created.id, state.draft.meta.revision, "check").catch((e: Error) => e);
    check("publish waits for required content", notReady instanceof pb.BuilderError && notReady.code === "NOT_READY");

    const stale = await pb.saveDraft(created.id, { page: state.draft.page, sections: [] }, 0, "check").catch((e: Error) => e);
    check("a save from a stale revision is a conflict", stale instanceof pb.BuilderError && stale.code === "CONFLICT");

    const draftOnly = await storefront(`{ page(handle: "${handle}") { id } }`);
    check("an unpublished page is not served by the Storefront API", draftOnly.data?.page === null);

    /* ---------------- content ---------------- */
    const collection = (await listCollections()).find((c: { handle: string; productsCount: number }) => c.handle !== "frontpage" && c.productsCount > 3);
    const make = (type: string, settings: Record<string, unknown>) => {
      const section = doc.createSection(type) as { settings: object };
      return { ...section, settings: { ...section.settings, ...settings } };
    };
    const content = doc.documentContentSchema.parse({
      page: { surface: "light", footerSurface: "olive" },
      sections: [
        make("page_heading", { title: "Check heading" }),
        make("text_block", { title: "Check text", body: rich("Body copy."), link: { label: "shop now", href: "/shop" } }),
        make("rich_text", {
          blocks: [
            { id: "b_check0001", type: "heading", settings: { text: "Block heading", level: "h2" } },
            { id: "b_check0002", type: "button", settings: { link: { label: "a button", href: "/contact" }, style: "solid" } },
          ],
        }),
        make("product_rail", {
          title: "Check rail",
          source: "collection",
          collection: { id: collection.id, handle: collection.handle, title: collection.title },
          limit: 4,
        }),
        make("faq", {
          title: "Check questions",
          source: "custom",
          questions: [{ id: "b_check0003", type: "question", settings: { question: "A question?", answer: rich("An answer.") } }],
        }),
        make("contact_details", { title: "Check form", showDetails: false }),
        make("go_back", { label: "back we go", fallback: "/" }),
      ],
    });
    state = await pb.getBuilderState(created.id);
    const saved = await pb.saveDraft(created.id, content, state.draft.meta.revision, "check");

    const first = await pb.publish(created.id, saved.revision, "check");
    check("Shopify serves the first publish", await pb.waitForStorefront(handle, { publishedAt: first.publishedAt }));
    state = await pb.getBuilderState(created.id);
    check("a first publish makes the page visible", state.page.isPublished);

    const live = await storefront(`{ page(handle: "${handle}") { draft: metafield(namespace: "custom", key: "sections_draft") { value } } }`);
    check("the draft is not readable through the Storefront API", live.data?.page?.draft === null);

    let page = await render(route);
    check(`${route} renders (200)`, page.status === 200, page.status);
    check("…the page heading as its one h1", /<h1 class="text-h1">Check heading<\/h1>/.test(page.main) && (page.main.match(/<h1/g) ?? []).length === 1);
    check("…the text band and its button", page.main.includes("Check text") && page.main.includes('href="/shop"'));
    check("…the text blocks", page.main.includes("Block heading") && page.main.includes('href="/contact"'));
    check("…the product carousel with products", page.main.includes("Check rail") && /\/shop\/[a-z0-9-]+/.test(page.main));
    check("…the written question", /<details[\s\S]*A question\?[\s\S]*An answer\./.test(page.main));
    check("…the contact form on its own", page.main.includes("Check form") && !page.main.includes("How to reach us"));
    check("…the go back link", page.main.includes("back we go"));

    /* ---------------- edit, publish, load previous ---------------- */
    const retitle = (title: string, from: { page: object; sections: { type: string; settings: object }[] }) => ({
      page: from.page,
      sections: from.sections.map((s) => (s.type === "page_heading" ? { ...s, settings: { ...s.settings, title } } : s)),
    });
    state = await pb.getBuilderState(created.id);
    const editSaved = await pb.saveDraft(created.id, doc.documentContentSchema.parse(retitle("Second heading", state.draft)), state.draft.meta.revision, "check");
    page = await render(route);
    check("a saved draft does not change the site", page.main.includes("Check heading") && !page.main.includes("Second heading"));

    const second = await pb.publish(created.id, editSaved.revision, "check");
    await pb.waitForStorefront(handle, { publishedAt: second.publishedAt });
    page = await render(route);
    check("publishing puts the edit live", page.main.includes("Second heading"));

    state = await pb.getBuilderState(created.id);
    await pb.rollback(created.id, state.draft.meta.revision, "check");
    state = await pb.getBuilderState(created.id);
    const draftHeading = (state.draft.sections.find((s: { type: string }) => s.type === "page_heading")!.settings as { title: string }).title;
    check("loading the previous version fills the draft", draftHeading === "Check heading" && state.hasUnpublishedChanges);
    page = await render(route);
    check("…and changes nothing on the site", page.main.includes("Second heading"));

    /* ---------------- page settings stay the page's ---------------- */
    await pages.updatePage(created.id, { seoTitle: "Check SEO title", seoDescription: "Check SEO description" });
    const restored = await pb.publish(created.id, state.draft.meta.revision, "check");
    await pb.waitForStorefront(handle, { publishedAt: restored.publishedAt });
    const seo = await storefront(`{ page(handle: "${handle}") { seo { title description } } }`);
    check("publishing content leaves the page's SEO alone", seo.data?.page?.seo?.title === "Check SEO title");
    page = await render(route);
    check("the <title> uses the page's SEO", page.html.includes("<title>Check SEO title"));

    /* ---------------- resilience ---------------- */
    const damaged = JSON.stringify({
      version: 1,
      sections: [
        { id: "s_zzzzzzzz", type: "custom_html", visible: true, settings: { html: "<script>alert(1)</script>" } },
        { id: "s_yyyyyyyy", type: "text_block", visible: true, settings: { title: "Survivor", link: { label: "x", href: "javascript:alert(1)" } } },
      ],
    });
    await adminGraphQL("pageUpdate", OPERATIONS.pageUpdate.document, {
      id: created.id,
      page: { metafields: [{ namespace: "custom", key: "sections", type: "json", value: damaged }] },
    });
    const { getLivePageBuilderDocument } = await load("lib/shopify/index.ts");
    for (let i = 0; i < 30; i++) {
      if ((await getLivePageBuilderDocument(handle)).value === damaged) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    page = await render(route);
    check("a hand-damaged document still renders (200)", page.status === 200);
    check("…unknown sections dropped, the valid one kept", page.main.includes("Survivor") && !page.main.includes("alert(1)"));
    check("…unsafe links removed", !page.main.includes("javascript:"));

    /* ---------------- deletion is for builder pages only ---------------- */
    const story = (await pages.listPages()).find((p: { handle: string }) => p.handle === "our-story");
    if (story) {
      const refused = await pb.deleteBuilderPage(story.id).catch((e: Error) => e);
      check("a site page (our-story) cannot be deleted", refused instanceof pb.BuilderError);
    }
  } finally {
    await pb.deleteBuilderPage(created.id).catch(() => undefined);
    await pb.waitForStorefront(handle, { gone: true });
    await fetch(`${BASE}/api/revalidate?tag=content`, { method: "POST" }).catch(() => undefined);
    const left = (await pages.listPages()).filter((p: { handle: string }) => p.handle.startsWith("pb-check-"));
    check("the test page is deleted", left.length === 0);
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll live page builder checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
