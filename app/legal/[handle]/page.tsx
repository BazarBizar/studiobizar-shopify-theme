import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";

/** The four legal pages provisioned by `schema-push`. */
const LEGAL_HANDLES = new Set([
  "privacy-policy",
  "terms-conditions",
  "shipping-delivery",
  "returns-refunds",
]);

export function generateStaticParams() {
  return [...LEGAL_HANDLES].map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: PageProps<"/legal/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  if (!LEGAL_HANDLES.has(handle)) return { title: "Not found" };

  const page = await getPage(handle).catch(() => null);
  if (!page) return { title: "Not found" };

  return {
    title: page.seo.title ?? page.title,
    description: page.seo.description ?? page.bodySummary?.slice(0, 160),
    alternates: { canonical: `/legal/${handle}` },
  };
}

export default async function LegalPage({ params }: PageProps<"/legal/[handle]">) {
  const { handle } = await params;
  // Only the four known legal handles, so /legal/<anything> cannot proxy a page.
  if (!LEGAL_HANDLES.has(handle)) notFound();

  const page = await getPage(handle);
  if (!page) notFound();

  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{page.title}</h1>
        {page.body && (
          <div className="sb-prose mt-10 max-w-[46rem]" dangerouslySetInnerHTML={{ __html: page.body }} />
        )}
      </Container>

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
