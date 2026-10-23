import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuilderFallback, BuilderPage } from "@/components/page-builder/builder-page";
import { BUILDER_METAFIELDS, parsePageDocument } from "@/lib/page-builder/document";
import { isBuilderHandle } from "@/lib/page-builder/handles";
import { getPage } from "@/lib/shopify";
import { toMetafieldMap } from "@/lib/shopify/transforms";

/**
 * Page builder pages, at `/<handle>`.
 *
 * Every static route beside this one wins over it, so `/shop` is never asked
 * about here. What does arrive is refused unless BOTH hold:
 *
 *  - the handle is one a builder page may have (`lib/page-builder/handles.ts`) —
 *    so `/home` cannot render a second copy of the landing page;
 *  - the Shopify page carries a published builder document. An ordinary page
 *    without one 404s here, so this route cannot be used to reach any Shopify
 *    page by guessing its handle — the same rule `/legal/[handle]` keeps.
 *
 * A document that exists but cannot be read renders the page's own title and
 * body instead of failing.
 *
 * Empty `generateStaticParams`: nothing is built ahead, each page renders on its
 * first visit and is then served from the ISR cache like any other page. Publish
 * drops the `content` tag, which is what `getPage` is cached under.
 */
export function generateStaticParams() {
  return [];
}

async function load(handle: string) {
  if (!isBuilderHandle(handle)) return null;

  const page = await getPage(handle).catch(() => null);
  if (!page) return null;

  const raw = toMetafieldMap(page.metafields)[BUILDER_METAFIELDS.published]?.value;
  const parsed = parsePageDocument(raw);
  if (!parsed.ok && parsed.reason === "absent") return null;

  return { page, parsed };
}

export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const loaded = await load(handle);
  if (!loaded) return { title: "Not found" };

  const { page } = loaded;
  return {
    title: page.seo.title ?? page.title,
    description: page.seo.description ?? (page.bodySummary?.slice(0, 160) || undefined),
    alternates: { canonical: `/${handle}` },
  };
}

export default async function BuilderRoute({ params }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const loaded = await load(handle);
  if (!loaded) notFound();

  const { page, parsed } = loaded;

  if (!parsed.ok) {
    console.error(`[page-builder] /${handle}: the published document is not readable — showing the page body.`);
    return <BuilderFallback title={page.title} body={page.body} />;
  }

  return <BuilderPage doc={parsed.doc} title={page.title} />;
}
