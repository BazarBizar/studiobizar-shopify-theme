/**
 * Website → Templates: a template left as it was IS the page as its route draws it.
 *
 *   yarn check:templates
 *
 * For each kind (product, collection, project, designer, shop, search, the two lists)
 * and a few real items from the store, this renders — in-process, with the live
 * Storefront data, nothing written —
 *
 *   A. the route's own JSX (what visitors see today: no template is published), and
 *   B. the template's original layout (`defaultTemplateContent`) drawn by `BuilderPage`
 *      for the same item,
 *
 * then compares the two tag for tag. The only difference allowed is the wrapper the
 * page builder puts around every section (`data-section-id`), which is removed before
 * comparing, and React's generated ids. The page's ground and footer are compared too.
 *
 * Then every template section is drawn with each of its settings changed, to prove
 * that a setting the editor offers changes the page (or is explained below).
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";

const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  process.env[line.slice(0, line.indexOf("=")).trim()] ??= line.slice(line.indexOf("=") + 1).trim();
}
// next/image outside Next — as `audit:page-builder` sets it up.
process.env = { ...process.env, __NEXT_IMAGE_OPTS: {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  path: "/_next/image",
  loader: "default",
  unoptimized: true,
  remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
} as unknown as string };
{
  const require = createRequire(path.join(ROOT, "package.json"));
  const stub = (name: string, exports: unknown) => {
    const resolved = require.resolve(name);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } as never;
  };
  stub("server-only", {});
  stub("next/navigation", {
    unstable_rethrow: () => {},
    notFound: () => {
      throw new Error("notFound");
    },
    redirect: () => {},
    usePathname: () => "/",
    useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {} }),
    useSearchParams: () => new URLSearchParams(),
  });
}
const load = (file: string) => import(pathToFileURL(path.join(ROOT, file)).href);

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) {
    failures += 1;
    if (detail) console.log(detail);
  }
}

/* -------------------------------------------------------------------------- *
 * Rendering and comparing
 * -------------------------------------------------------------------------- */

type El = { type: unknown; props: { children?: unknown; surface?: string; footerSurface?: string } };

async function html(node: React.ReactNode): Promise<string> {
  // Required, not imported: the project's files are loaded as CommonJS, and the providers
  // must be the very modules their hooks read from (both packages ship two builds).
  const require = createRequire(path.join(ROOT, "package.json"));
  const React = require("react") as typeof import("react");
  const { renderToReadableStream } = await import("react-dom/server.edge");
  const { NuqsTestingAdapter } = require("nuqs/adapters/testing") as typeof import("nuqs/adapters/testing");
  const { QueryClient, QueryClientProvider } = require("@tanstack/react-query") as typeof import("@tanstack/react-query");
  const tree = React.createElement(
    NuqsTestingAdapter,
    null,
    React.createElement(QueryClientProvider, { client: new QueryClient() }, node),
  );
  let failure: unknown = null;
  const stream = await renderToReadableStream(tree, { onError: (error: unknown) => void (failure = error) });
  await stream.allReady;
  const out = await new Response(stream).text();
  if (failure) throw failure;
  return out;
}

const GENERATED_ID = /«[^»]*»|_R_[A-Za-z0-9_]*_|:r[0-9a-z]+:/g;

/**
 * A canonical text of the tree: no comments, no section wrappers, collapsed space,
 * generated ids blanked. Two things that cannot change what a visitor sees are evened
 * out too: the order of class names, and one text split into several (`Designed by
 * {name}` is two text nodes, `{`Designed by ${name}`}` one).
 */
function canonical(source: string): string[] {
  const out: string[] = [];
  let text = "";
  const flush = () => {
    const value = text.replace(/\s+/g, " ").trim();
    if (value) out.push(`"${value}"`);
    text = "";
  };
  const walk = (nodes: ChildNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        text += (node as unknown as { data: string }).data;
      } else if (node.type === "tag" || node.type === "script" || node.type === "style") {
        const element = node as Element;
        if ("data-section-id" in element.attribs) {
          walk(element.children);
          continue;
        }
        flush();
        const attrs = Object.entries(element.attribs)
          .map(([key, value]) => {
            const even = key === "class" ? value.split(/\s+/).filter(Boolean).sort().join(" ") : value;
            return `${key}="${even.replace(GENERATED_ID, "ID")}"`;
          })
          .sort()
          .join(" ");
        out.push(`<${element.name}${attrs ? ` ${attrs}` : ""}>`);
        walk(element.children);
        flush();
        out.push(`</${element.name}>`);
      }
    }
  };
  walk(parseDocument(source).children as ChildNode[]);
  flush();
  return out;
}

function firstDifference(a: string[], b: string[]): string | null {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      const around = (list: string[]) => list.slice(Math.max(0, index - 4), index + 4).join(" ");
      return `    at token ${index}\n    route:    ${around(a)}\n    template: ${around(b)}`;
    }
  }
  return null;
}

/** The shell's own settings and what is inside it — the shell itself (header, footer) is the same component either way. */
function insideShell(element: unknown): { surface?: string; footerSurface?: string; children: React.ReactNode } {
  const el = element as El;
  return { surface: el.props.surface ?? "light", footerSurface: el.props.footerSurface ?? "olive", children: el.props.children as React.ReactNode };
}

/* -------------------------------------------------------------------------- *
 * The cases
 * -------------------------------------------------------------------------- */

async function main() {
  const { BuilderPage } = await load("components/page-builder/builder-page.tsx");
  const { loadTemplateRecord, templateSamples } = await load("components/page-builder/template-record.ts");
  const { defaultTemplateContent } = await load("lib/page-builder/template-defaults.ts");
  const { DOCUMENT_VERSION } = await load("lib/page-builder/document.ts");
  const shopify = await load("lib/shopify/index.ts");

  const doc = (kind: string) => ({
    version: DOCUMENT_VERSION,
    ...defaultTemplateContent(kind),
    meta: { revision: 0, savedAt: null, savedBy: null, publishedAt: null, publishedBy: null },
  });

  /** One comparison: the route's page against the template's, for one item. */
  async function compare(label: string, routeElement: unknown, templateElement: unknown) {
    const route = insideShell(routeElement);
    const template = insideShell(templateElement);
    check(`${label}: same page and footer ground`, route.surface === template.surface && route.footerSurface === template.footerSurface,
      `    route ${route.surface}/${route.footerSurface}, template ${template.surface}/${template.footerSurface}`);
    const [a, b] = await Promise.all([html(route.children), html(template.children)]);
    const diff = firstDifference(canonical(a), canonical(b));
    check(`${label}: the template draws the same page`, diff === null, diff ?? undefined);
  }

  const routes = {
    product: await load("app/(storefront)/shop/[handle]/page.tsx"),
    collection: await load("app/(storefront)/collections/[handle]/page.tsx"),
    project: await load("app/(storefront)/projects/[handle]/page.tsx"),
    designer: await load("app/(storefront)/designers/[handle]/page.tsx"),
    shop: await load("app/(storefront)/shop/page.tsx"),
    search: await load("app/(storefront)/search/page.tsx"),
    collections: await load("app/(storefront)/collections/page.tsx"),
    projects: await load("app/(storefront)/projects/page.tsx"),
  };

  // The live templates must be unpublished for A to be the route's own JSX.
  for (const kind of Object.keys(routes)) {
    if (await shopify.getPublishedTemplate(kind)) {
      console.log(`! The ${kind} template is published, so its route no longer draws its own layout — skipped.`);
      delete (routes as Record<string, unknown>)[kind];
    }
  }

  const props = (params: Record<string, string>, search: Record<string, string> = {}) => ({
    params: Promise.resolve(params),
    searchParams: Promise.resolve(search),
  });

  // Items: a few of each, so a product with and one without a designer or an idea are both met.
  for (const kind of ["product", "collection", "project", "designer"] as const) {
    if (!(kind in routes)) continue;
    const samples = (await templateSamples(kind)).slice(0, kind === "product" ? 6 : 3);
    for (const sample of samples) {
      const loaded = await loadTemplateRecord(kind, sample.value);
      const routeElement = await routes[kind].default(props({ handle: sample.value }));
      const before = (routeElement as El).props.children;
      // The structured data the route puts first comes along as `before`.
      const first = Array.isArray(before) ? before[0] : null;
      const jsonLd = first && typeof first === "object" && (first as El).type !== undefined && kind !== "collection" ? first : undefined;
      const templateElement = BuilderPage({ doc: doc(kind), title: loaded.title, record: loaded.record, before: jsonLd });
      await compare(`${kind} ${sample.value}`, routeElement, templateElement);
    }
  }

  const lists: [kind: string, label: string, search: Record<string, string>, record: unknown, title: string][] = [];
  if ("shop" in routes) {
    const categories = await shopify.getShopCategories();
    const collections = await shopify.getListedCollections();
    lists.push(["shop", "shop", {}, { kind: "shop", params: {} }, "Products"]);
    if (categories[0]) {
      const search = { category: categories[0].slug, sort: "title-asc" };
      lists.push(["shop", `shop ?category=${categories[0].slug}`, search, { kind: "shop", params: search }, "Products"]);
    }
    if (collections[0]) {
      const search = { view: "collection", collection: collections[0].handle };
      lists.push(["shop", `shop ?collection=${collections[0].handle}`, search, { kind: "shop", params: search }, "Products"]);
    }
  }
  if ("search" in routes) {
    const word = (await shopify.getProducts({ first: 1 })).items[0]?.title.split(" ")[0]?.toLowerCase() ?? "chair";
    lists.push(["search", `search ?q=${word}`, { q: word }, { kind: "search", query: word }, "Search"]);
    lists.push(["search", "search with no result", { q: "zzzqqq" }, { kind: "search", query: "zzzqqq" }, "Search"]);
    lists.push(["search", "search, nothing typed", {}, { kind: "search", query: "" }, "Search"]);
  }
  if ("collections" in routes) lists.push(["collections", "collections", {}, { kind: "collections" }, "Collections"]);
  if ("projects" in routes) {
    lists.push(["projects", "projects", {}, { kind: "projects", params: {} }, "Projects"]);
    lists.push(["projects", "projects ?view=l", { view: "l" }, { kind: "projects", params: { view: "l" } }, "Projects"]);
  }

  for (const [kind, label, search, record, title] of lists) {
    const route = (routes as Record<string, { default: (props: unknown) => Promise<unknown> }>)[kind]!;
    const routeElement = await route.default(props({}, search));
    const templateElement = BuilderPage({ doc: doc(kind), title, record });
    await compare(label, routeElement, templateElement);
  }

  await everySetting({ BuilderPage, loadTemplateRecord, templateSamples, DOCUMENT_VERSION });
}

/* -------------------------------------------------------------------------- *
 * Every setting of every template section changes the page
 * -------------------------------------------------------------------------- */

type Field = {
  key: string;
  when?: { field: string; is: readonly (string | boolean)[] };
  label: string;
  kind: string;
  group?: string;
  min?: number;
  max?: number;
  options?: readonly { value: string }[];
  blocks?: readonly { type: string; label: string; fields: readonly Field[] }[];
};
type Block = { id: string; type: string; settings: Record<string, unknown> };

/** The universal settings and the Style tab are drawn by the section's frame — measured by `check:page-builder-style`. */
const FRAME_KEYS = new Set(["surface", "rhythm", "hideOn"]);

/** Settings that do nothing in the page's HTML by design — each with why. */
const EXPLAINED: Record<string, string> = {
  "product_collection.step": "how far an arrow moves is read in the browser",
  "product_recommendations.step": "how far an arrow moves is read in the browser",
  "project_featured.step": "how far an arrow moves is read in the browser",
};

function variants(field: Field, value: unknown): unknown[] {
  switch (field.kind) {
    case "text":
    case "textarea":
      return ["ZZ marker {query} ZZ"];
    case "color":
      return ["#aa3300"];
    case "richText":
      return [JSON.stringify({ type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: "ZZ marker ZZ" }] }] })];
    case "toggle":
      return [!value];
    case "select":
      return (field.options ?? []).map((option) => option.value).filter((option) => option !== value);
    case "number":
      return [field.min, field.max].filter((n) => n !== value);
    default:
      return [];
  }
}

async function everySetting({
  BuilderPage,
  loadTemplateRecord,
  templateSamples,
  DOCUMENT_VERSION,
}: {
  BuilderPage: (props: unknown) => unknown;
  loadTemplateRecord: (kind: string, item?: string) => Promise<{ record: unknown; title: string } | null>;
  templateSamples: (kind: string) => Promise<{ value: string }[]>;
  DOCUMENT_VERSION: number;
}) {
  const { SECTIONS, SECTION_TYPES } = await load("lib/page-builder/registry.ts");
  const { createSection } = await load("lib/page-builder/document.ts");
  const { TEMPLATE_KINDS } = await load("lib/page-builder/template-kinds.ts");

  console.log("\nEvery setting of every template section:");

  for (const kind of TEMPLATE_KINDS as string[]) {
    // The items to try: several, since a setting can only show where the item has
    // what it shows (a product with no designer has no designer link to rename).
    const items = (await templateSamples(kind)).slice(0, 8).map((item) => item.value);
    const candidates = kind === "search" ? ["table", "zzzqqq"] : items.length ? items : [""];
    const records = (await Promise.all(candidates.map((item) => loadTemplateRecord(kind, item || undefined)))).filter(Boolean) as {
      record: unknown;
      title: string;
    }[];

    // No product in the store has an idea, a designer, a collection or downloads yet, and
    // no collection a logo — so one of each is made up from real data, in memory only,
    // or the settings that only show with them could not be tried at all.
    if (kind === "product" && records[0]) {
      const source = (await loadTemplateRecord("collection", undefined)) as { record: { collection: Record<string, unknown> & { metafields: Record<string, unknown> } } } | null;
      const product = structuredClone((records[0].record as { product: { title: string; metafields: Record<string, unknown> } }).product);
      if (source) {
        const collection = source.record.collection as { handle: string; title: string; metafields: Record<string, unknown> };
        product.metafields = {
          ...product.metafields,
          idea_body: collection.metafields.idea_body,
          idea_image: collection.metafields.idea_image,
          designer: collection.metafields.designer,
          signature_collection: { reference: { __typename: "Collection", handle: collection.handle, title: collection.title } },
          downloads: { references: { nodes: [{ __typename: "GenericFile", url: "https://cdn.shopify.com/s/files/1/0/files/care-guide.pdf" }] } },
        };
        records.push({ record: { kind: "product", product }, title: product.title });
        console.log("  (also a product given an idea, a designer, a collection and a download, in memory)");
      }
    }
    if (kind === "collection" && records[0]) {
      const collection = structuredClone((records[0].record as { collection: { title: string; heroImage: unknown; logo: unknown } }).collection);
      collection.logo = collection.heroImage;
      records.push({ record: { kind: "collection", collection }, title: collection.title });
      console.log("  (also a collection given a logo, in memory)");
    }

    for (const type of (SECTION_TYPES as string[]).filter((candidate) => SECTIONS[candidate].template === kind)) {
      const base = createSection(type) as { id: string; type: string; visible: boolean; settings: Record<string, unknown> };
      const draw = async (settings: Record<string, unknown>, at: { record: unknown; title: string }) => {
        const page = BuilderPage({
          doc: {
            version: DOCUMENT_VERSION,
            page: { surface: "light", footerSurface: "olive" },
            sections: [{ ...base, settings }],
            meta: { revision: 0, savedAt: null, savedBy: null, publishedAt: null, publishedBy: null },
          },
          title: at.title,
          record: at.record,
        });
        return canonical(await html(insideShell(page).children)).join(" ");
      };
      const before = await Promise.all(records.map((at) => draw(base.settings, at)));

      /** Does any item's page change when the settings change like this? */
      const changes = async (patch: (settings: Record<string, unknown>) => Record<string, unknown>) => {
        for (const [index, at] of records.entries()) {
          if ((await draw(patch(structuredClone(base.settings)), at)) !== before[index]) return true;
        }
        return false;
      };

      const fields = (SECTIONS[type].fields as readonly Field[]).filter(
        (field) => field.group !== "style" && field.kind !== "design" && !FRAME_KEYS.has(field.key),
      );

      for (const field of fields) {
        const name = `${type}.${field.key}`;
        if (field.kind === "blocks") {
          const list = base.settings[field.key] as Block[];
          check(`${name}: removing a part changes the page`, await changes((s) => ({ ...s, [field.key]: list.slice(1) })));
          check(`${name}: reordering the parts changes the page`, await changes((s) => ({ ...s, [field.key]: [...list].reverse() })));
          for (const blockDef of field.blocks ?? []) {
            for (const leaf of blockDef.fields) {
              const present = list.some((item) => item.type === blockDef.type);
              const blocks = present ? list : [...list, { id: "b_auditaaaa", type: blockDef.type, settings: {} }];
              let changed = false;
              for (const value of variants(leaf, blocks.find((item) => item.type === blockDef.type)?.settings[leaf.key])) {
                const patched = (s: Record<string, unknown>) => ({
                  ...s,
                  [field.key]: blocks.map((item) => (item.type === blockDef.type ? { ...item, settings: { ...item.settings, [leaf.key]: value } } : item)),
                });
                if (await changes(patched)) {
                  changed = true;
                  break;
                }
              }
              // A part the template does not start with is added for the try.
              check(`${name} › ${blockDef.label} › ${leaf.label} changes the page${present ? "" : " (part added)"}`, changed);
            }
          }
          continue;
        }

        if (EXPLAINED[name]) {
          console.log(`  ${name}: explained — ${EXPLAINED[name]}`);
          continue;
        }
        // A field shown only under another one's value is tried with that value set — and
        // compared with the page as it is then, not as it was before.
        const shown = (settings: Record<string, unknown>) => (field.when ? { ...settings, [field.when.field]: field.when.is[0] } : settings);
        let changed = false;
        for (const value of variants(field, base.settings[field.key])) {
          for (const [index, at] of records.entries()) {
            const before = await draw(shown(structuredClone(base.settings)), at);
            if ((await draw({ ...shown(structuredClone(base.settings)), [field.key]: value }, at)) !== before) {
              changed = true;
              break;
            }
            void index;
          }
          if (changed) break;
        }
        check(`${name} (${field.label}) changes the page`, changed);
      }
    }
  }
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} check(s) failed.` : "\nEvery template draws its page exactly as the route does, and every setting changes it.");
    process.exit(failures ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
